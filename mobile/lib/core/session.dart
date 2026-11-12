import 'package:flutter/foundation.dart';

import 'api_client.dart';

enum AuthStatus { starting, signedOut, mustChangePassword, signedIn }

/// Which version of the app a person sees. It follows the data scope of their role on the server
/// (ALL: office staff, TEACHING: teachers, SELF: students), as the web portal does.
enum Portal { staff, teacher, student }

/// Who is signed in and what they may do. Everything here is the server's answer to /api/auth/me;
/// the app only uses it to shape its screens. The server checks every request again.
class Session extends ChangeNotifier {
  Session(this.api) {
    api.onSessionLost = _sessionLost;
  }

  final ApiClient api;

  AuthStatus status = AuthStatus.starting;
  Map<String, dynamic> user = const {};
  Set<String> permissions = const {};
  Map<String, dynamic> scopes = const {};
  List<Map<String, dynamic>> roles = const [];
  String scope = 'SELF';
  bool isSuperAdmin = false;
  bool allCampuses = false;
  List<String> campusIds = const [];
  Map<String, dynamic>? preview;
  String? language;

  /// Shown once on the sign-in screen (e.g. "Your session has expired")
  String? notice;

  String get userId => (user['id'] ?? '').toString();
  String get name => (user['name'] ?? '').toString();
  String get roleNames =>
      roles.isEmpty ? (user['role'] ?? '').toString().replaceAll('_', ' ') : roles.map((r) => r['name']).join(' + ');

  Portal get portal {
    if (isSuperAdmin || scope == 'ALL') return Portal.staff;
    return scope == 'TEACHING' ? Portal.teacher : Portal.student;
  }

  bool get isStudent => portal == Portal.student;
  bool get isTeacher => portal == Portal.teacher;
  bool get isStaff => portal == Portal.staff;

  bool can(String permission) => status == AuthStatus.signedIn && (isSuperAdmin || permissions.contains(permission));

  bool canAny(Iterable<String> list) => list.any(can);

  /// Held for the whole institution, not only for one's own classes or records
  bool wide(String permission) => isSuperAdmin || scopes[permission] == 'ALL';

  bool hasCampus(String? branchId) => isSuperAdmin || allCampuses || campusIds.contains(branchId);

  /// Restores the saved session (if any) when the app opens
  Future<void> start() async {
    await api.restore();
    if (!api.hasSession) {
      _set(AuthStatus.signedOut);
      return;
    }
    try {
      await refresh();
    } on ApiException catch (e) {
      // Offline: the saved session is kept and the sign-in screen offers to retry
      if (!e.offline) await api.clearSession();
      notice = e.offline ? e.message : null;
      _clear();
      _set(AuthStatus.signedOut);
    }
  }

  /// Asks the server who is signed in. Picks up role and permission changes made by an administrator.
  Future<void> refresh() async {
    final data = await api.get('/api/auth/me');
    if (data['user'] == null) {
      await api.clearSession();
      _clear();
      _set(AuthStatus.signedOut);
      return;
    }
    _apply(data);
    _set(data['mustChangePassword'] == true ? AuthStatus.mustChangePassword : AuthStatus.signedIn);
  }

  Future<void> signIn(String identifier, String password) async {
    notice = null;
    final data = await api.post('/api/auth/login', {'identifier': identifier.trim(), 'password': password});
    if (data['success'] != true || data['user'] == null || !api.hasSession) {
      throw ApiException(500, 'Sign-in failed. Please try again.');
    }
    if (data['mustChangePassword'] == true) {
      user = Map<String, dynamic>.from(data['user'] as Map);
      _set(AuthStatus.mustChangePassword);
      return;
    }
    await refresh();
  }

  Future<void> changePassword(String current, String next) async {
    await api.post('/api/auth/change-password', {'currentPassword': current, 'newPassword': next});
    await refresh();
  }

  Future<void> signOut() async {
    try {
      await api.post('/api/auth/logout');
    } on ApiException {
      // Offline: the device forgets the session anyway
    }
    await api.clearSession();
    _clear();
    _set(AuthStatus.signedOut);
  }

  void _sessionLost() {
    if (status == AuthStatus.signedOut || status == AuthStatus.starting) return;
    _clear();
    notice = 'Your session has ended. Please sign in again.';
    _set(AuthStatus.signedOut);
  }

  void _apply(Map<String, dynamic> data) {
    user = Map<String, dynamic>.from(data['user'] as Map);
    permissions = ((data['permissions'] as List?) ?? const []).map((p) => p.toString()).toSet();
    scopes = Map<String, dynamic>.from((data['scopes'] as Map?) ?? const {});
    roles = ((data['roles'] as List?) ?? const []).map((r) => Map<String, dynamic>.from(r as Map)).toList();
    scope = (data['scope'] ?? 'SELF').toString();
    isSuperAdmin = data['isSuperAdmin'] == true;
    final campuses = (data['campuses'] as Map?) ?? const {};
    allCampuses = campuses['all'] == true;
    campusIds = ((campuses['ids'] as List?) ?? const []).map((c) => c.toString()).toList();
    preview = data['preview'] == null ? null : Map<String, dynamic>.from(data['preview'] as Map);
    language = data['language']?.toString();
  }

  void _clear() {
    user = const {};
    permissions = const {};
    scopes = const {};
    roles = const [];
    scope = 'SELF';
    isSuperAdmin = false;
    allCampuses = false;
    campusIds = const [];
    preview = null;
  }

  void _set(AuthStatus next) {
    status = next;
    notifyListeners();
  }
}
