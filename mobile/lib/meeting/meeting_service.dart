import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:jitsi_meet_flutter_sdk/jitsi_meet_flutter_sdk.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/store.dart';

/// What a join attempt led to
enum JoinResult { joined, openedExternal }

/// Opens live classes and public meetings in the native Jitsi Meet SDK, so Android can share its screen
/// (a browser on Android cannot). Who may enter, and as host or participant, is decided by the portal
/// server exactly as for the web portal: the app only receives a signed token for one room.
class MeetingService extends ChangeNotifier {
  MeetingService(this.api, this.session, this.store);

  final ApiClient api;
  final Session session;
  final DataStore store;
  final JitsiMeet _jitsi = JitsiMeet();

  bool inMeeting = false;
  Completer<void>? _closed;

  /// The host's Meeting Settings as the web portal applies them (server/meeting-controls.js DEFAULTS)
  static const Map<String, dynamic> _defaultControls = {'chat': true, 'rename': true, 'unmute': true, 'video': true};

  /// Same room name the portal and the server use (meetingRoomName in server/lms-api.js)
  static String roomNameFor(Record s) {
    String clean(Object? v) => v.toString().replaceAll(RegExp(r'[^a-zA-Z0-9]'), '');
    final id = clean(s['id']);
    final uuid = clean(str(s['meetingUuid'], s['id'].toString()));
    return 'JamiaAshrafia$uuid${id.length > 6 ? id.substring(id.length - 6) : id}';
  }

  /// Whether this person hosts the class (the server confirms it again on joining)
  bool canHost(Record s) {
    if (session.can('virtual_classes.manage')) return true;
    if (!session.can('virtual_classes.host')) return false;
    final me = session.userId;
    return s['hostId'] == me ||
        session.isStaff ||
        teacherClassIds(store, me).contains(s['classId']) ||
        ((s['periods'] as List?) ?? const []).any((p) => p is Map && p['teacherId'] == me);
  }

  Future<Map<String, dynamic>> _serviceSettings() async {
    final data = await api.get('/api/settings/meeting');
    final s = Map<String, dynamic>.from((data['settings'] as Map?) ?? const {});
    if (s['authMode'] == 'JAAS') s['domain'] = '8x8.vc';
    s['domain'] = str(s['domain'], 'meet.jit.si');
    return s;
  }

  Future<Map<String, dynamic>> _controls(Map<String, dynamic> target) async {
    try {
      final data = await api.post('/api/meeting-controls/state', target);
      return {..._defaultControls, ...Map<String, dynamic>.from((data['settings'] as Map?) ?? const {})};
    } on ApiException {
      return _defaultControls;
    }
  }

  // ---------------------------------------------------------------------------
  // Live classes (signed-in users)
  // ---------------------------------------------------------------------------

  /// Joins a class. [start] lets its host open a class that is not live yet.
  Future<JoinResult> joinClass(String sessionId, {bool start = false}) async {
    final access = await api.post('/api/virtual-class/verify-access', {'sessionId': sessionId});
    final isHost = access['isHost'] == true;
    var cls = {...?store.find('virtualClasses', sessionId), ...Map<String, dynamic>.from(access['session'] as Map)};

    if (!isLive(cls)) {
      if (!isHost) throw ApiException(403, 'This class has not started yet.');
      if (!start) throw ApiException(409, 'Start the class first.');
      cls = {...cls, 'status': 'LIVE', 'isLive': true, 'startedAt': DateTime.now().toUtc().toIso8601String()};
      await store.save('virtualClasses', cls);
      _notifyClassStarted(cls);
    }

    // A class held on Zoom / Google Meet / Teams opens there
    if (cls['platform'] == 'EXTERNAL' && str(cls['externalUrl']).isNotEmpty) {
      final url = Uri.tryParse(str(cls['externalUrl']));
      if (url == null || !url.hasScheme) throw ApiException(400, 'This class has no valid meeting link.');
      await _recordAttendance(cls);
      if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
        throw ApiException(500, 'The meeting link could not be opened on this device.');
      }
      return JoinResult.openedExternal;
    }

    final service = await _serviceSettings();
    final needsToken = service['authMode'] == 'JWT' || service['authMode'] == 'JAAS';
    String? token;
    if (needsToken) {
      final data = await api.post('/api/virtual-class/join-token', {'sessionId': sessionId});
      token = data['token']?.toString();
      if (token == null) throw ApiException(500, 'The live classroom sign-in is not set up correctly.');
    }
    final room = roomNameFor(cls);
    final controls = await _controls({'sessionId': sessionId});
    await _recordAttendance(cls);

    final me = session.user;
    final suffix = isHost ? ' (Ustad)' : (str(me['rollNo']).isNotEmpty ? ' • ${me['rollNo']}' : '');
    await _open(
      domain: service['domain'].toString(),
      roomPath: service['authMode'] == 'JAAS' ? '${service['appId']}/$room' : room,
      token: token,
      title: str(cls['title'], 'Live Class'),
      displayName: '${str(me['name'], 'Guest')}$suffix',
      email: str(me['email']),
      isHost: isHost,
      controls: controls,
    );
    return JoinResult.joined;
  }

  /// Ends a class for everyone (its host only; the server checks)
  Future<void> endClass(Record cls) async {
    final attended = store
        .list('attendance')
        .where((a) => a['session'] == 'VIRTUAL_CLASS' && a['virtualSessionId'] == cls['id'] && a['role'] == 'STUDENT')
        .map((a) => a['userId'])
        .toSet()
        .length;
    await store.save('virtualClasses', {
      ...cls,
      'status': 'COMPLETED',
      'isLive': false,
      'endedAt': DateTime.now().toUtc().toIso8601String(),
      'attendanceCount': attended,
    });
  }

  void _notifyClassStarted(Record cls) {
    if (str(cls['classId']).isEmpty) return;
    api.post('/api/notifications', {
      'targetClassId': cls['classId'],
      'targetRole': 'STUDENT',
      'title': 'Live class started: ${str(cls['title'])}',
      'message': '${str(cls['hostTeacher'], session.name)} is live now. Open Online Classes and press "Join Live Class".',
      'category': 'LIVE_CLASS',
      'linkRoute': 'virtual-class',
    }).catchError((_) => <String, dynamic>{});
  }

  /// One attendance entry per person per class (per timetable period in a full-day room), as the portal records it
  Future<void> _recordAttendance(Record cls) async {
    final me = session.user;
    Map? period;
    if (cls['dayRoom'] == true && cls['date'] == today()) {
      final now = nowHHMM();
      for (final p in (cls['periods'] as List?) ?? const []) {
        if (p is Map && now.compareTo(str(p['startTime'])) >= 0 && now.compareTo(str(p['endTime'])) < 0) period = p;
      }
    }
    final periodStart = period?['startTime'];
    final already = store.list('attendance').any((a) =>
        a['userId'] == me['id'] &&
        a['session'] == 'VIRTUAL_CLASS' &&
        a['periodStart'] == periodStart &&
        (a['virtualSessionId'] == cls['id'] ||
            (a['virtualSessionId'] == null && a['date'] == today() && a['classId'] == cls['classId'])));
    if (already) return;
    final periodName = period == null ? null : str(period['courseName'], str(period['periodName']));
    try {
      await store.save('attendance', {
        'id': 'att_vc_${DateTime.now().millisecondsSinceEpoch}',
        'userId': me['id'],
        'userName': me['name'],
        'role': me['role'],
        'identifier': str(me['rollNo'], str(me['email'], session.userId)),
        'classId': cls['classId'],
        'className': cls['className'],
        'date': today(),
        'checkInTime': prettyTime(nowHHMM()),
        'checkOutTime': null,
        'status': 'PRESENT',
        'session': 'VIRTUAL_CLASS',
        'virtualSessionId': cls['id'],
        'periodStart': periodStart,
        'periodName': periodName,
        'notes': 'Joined online class: ${str(cls['title'])}${periodName == null ? '' : ' ($periodName)'} (mobile app)',
      });
    } on ApiException {
      // Attendance the server does not accept (e.g. an office account) must not keep anyone out of the class
    }
  }

  // ---------------------------------------------------------------------------
  // Public meetings
  // ---------------------------------------------------------------------------

  /// A guest opening a public link (/meet/<code>): no sign-in, the server gives a token for this one room
  Future<void> joinPublicAsGuest(String code, String name) async {
    final data = await api.post('/api/public-meetings/join', {'code': code, 'name': name});
    final join = Map<String, dynamic>.from(data['join'] as Map);
    final guest = Map<String, dynamic>.from(data['guest'] as Map);
    final controls = await _controls({
      'code': code,
      'guestId': guest['id'],
      'guestName': guest['name'],
      'guestKey': guest['key'],
    });
    await _open(
      domain: join['domain'].toString(),
      roomPath: join['roomPath'].toString(),
      token: join['token']?.toString(),
      title: str(data['title'], 'Meeting'),
      displayName: str(data['displayName'], name),
      email: '',
      isHost: false,
      controls: controls,
    );
  }

  /// The moderator's way into a public meeting they may manage
  Future<void> hostPublic(String meetingId) async {
    final data = await api.post('/api/public-meetings/${Uri.encodeComponent(meetingId)}/host');
    await _openPublicHost(data);
  }

  Future<Map<String, dynamic>> createPublic(String title, int hours) async {
    final data = await api.post('/api/public-meetings', {'title': title, 'hours': hours});
    return Map<String, dynamic>.from(data);
  }

  Future<void> openCreatedPublic(Map<String, dynamic> created) => _openPublicHost(created);

  Future<void> _openPublicHost(Map<String, dynamic> data) async {
    final meeting = Map<String, dynamic>.from(data['meeting'] as Map);
    final join = Map<String, dynamic>.from(data['join'] as Map);
    final controls = await _controls({'publicMeetingId': meeting['id']});
    await _open(
      domain: join['domain'].toString(),
      roomPath: join['roomPath'].toString(),
      token: join['token']?.toString(),
      title: str(meeting['title'], 'Meeting'),
      displayName: '${session.name} (Host)',
      email: str(session.user['email']),
      isHost: true,
      controls: controls,
    );
  }

  Future<List<Map<String, dynamic>>> publicMeetings() async {
    final data = await api.get('/api/public-meetings');
    return ((data['meetings'] as List?) ?? const []).map((m) => Map<String, dynamic>.from(m as Map)).toList();
  }

  Future<void> endPublic(String meetingId) => api.post('/api/public-meetings/${Uri.encodeComponent(meetingId)}/end');

  // ---------------------------------------------------------------------------
  // The meeting itself
  // ---------------------------------------------------------------------------

  /// Completes when the meeting screen has closed
  Future<void> get closed => _closed?.future ?? Future.value();

  Future<void> _open({
    required String domain,
    required String roomPath,
    required String? token,
    required String title,
    required String displayName,
    required String email,
    required bool isHost,
    required Map<String, dynamic> controls,
  }) async {
    // A meeting whose end was never reported must not block the next one: joining again replaces it
    final previous = _closed;
    if (previous != null && !previous.isCompleted) previous.complete();
    final chat = controls['chat'] != false;
    final options = JitsiMeetConferenceOptions(
      serverURL: 'https://$domain',
      room: roomPath,
      token: token,
      userInfo: JitsiMeetUserInfo(displayName: displayName, email: email.isEmpty ? null : email),
      configOverrides: {
        'subject': title,
        'prejoinConfig': {'enabled': false},
        'startWithAudioMuted': !isHost,
        'startWithVideoMuted': !isHost,
        'disableInviteFunctions': true,
        'disableDeepLinking': true,
        // The host's Meeting Settings, as the portal applies them
        'disableChat': !chat,
        if (!isHost) 'readOnlyName': controls['rename'] == false,
        // Recording goes through the portal (which stores it under the school's retention rules)
        'localRecording': {'disable': true},
      },
      featureFlags: {
        'welcomepage.enabled': false,
        'prejoinpage.enabled': false,
        'invite.enabled': false,
        'add-people.enabled': false,
        'calendar.enabled': false,
        'call-integration.enabled': false,
        'recording.enabled': false,
        'live-streaming.enabled': false,
        'server-url-change.enabled': false,
        'meeting-password.enabled': false,
        'security-options.enabled': false,
        'unsaferoomwarning.enabled': false,
        'help.enabled': false,
        'chat.enabled': chat,
        'pip.enabled': true,
        // Share the phone's screen: the reason this app uses the native meeting instead of a browser
        'android.screensharing.enabled': true,
        'ios.screensharing.enabled': false,
        'ios.recording.enabled': false,
      },
    );

    final done = Completer<void>();
    _closed = done;
    void finish() {
      if (!done.isCompleted) done.complete();
      if (inMeeting) {
        inMeeting = false;
        notifyListeners();
      }
    }

    inMeeting = true;
    notifyListeners();
    try {
      await _jitsi.join(
        options,
        JitsiMeetEventListener(
          conferenceTerminated: (url, error) => finish(),
          readyToClose: finish,
        ),
      );
    } catch (e) {
      finish();
      throw ApiException(500, 'The meeting could not be opened on this device.');
    }
  }
}
