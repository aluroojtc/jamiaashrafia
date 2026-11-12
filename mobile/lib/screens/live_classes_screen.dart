import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/store.dart';
import '../meeting/meeting_service.dart';
import '../widgets/common.dart';
import 'portal_web_screen.dart';

/// The classes this person may see, soonest first; a student only their own class's
List<Record> visibleClasses(DataStore store, Session session) {
  final all = store.list('virtualClasses').where((s) {
    if (!session.isStudent) return true;
    return s['classId'] == session.user['classId'];
  }).toList();
  int rank(Record s) => isLive(s) ? 0 : (s['status'] == 'UPCOMING' ? 1 : 2);
  String when(Record s) => str(s['scheduledStart'], str(s['startsAt'], str(s['date'])));
  all.sort((a, b) {
    final r = rank(a).compareTo(rank(b));
    if (r != 0) return r;
    // Upcoming: soonest first; finished: latest first
    return rank(a) == 2 ? when(b).compareTo(when(a)) : when(a).compareTo(when(b));
  });
  return all;
}

/// Online classes: join (or, for the host, start and end) a class in the native meeting, and for those who
/// may hold them, public meetings with a shareable link.
class LiveClassesScreen extends StatefulWidget {
  const LiveClassesScreen({super.key, this.autoJoinId});

  /// A class link opened the app: join this class straight away
  final String? autoJoinId;

  @override
  State<LiveClassesScreen> createState() => _LiveClassesScreenState();
}

class _LiveClassesScreenState extends State<LiveClassesScreen> {
  String? _busyId;
  List<Map<String, dynamic>>? _public;
  String? _publicError;

  bool get _canPublic => context.read<Session>().can('virtual_classes.public_meeting');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_canPublic) _loadPublic();
      final id = widget.autoJoinId;
      if (id != null) _join(id);
    });
  }

  Future<void> _loadPublic() async {
    try {
      final list = await context.read<MeetingService>().publicMeetings();
      if (mounted) {
        setState(() {
          _public = list;
          _publicError = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _publicError = e.message);
    }
  }

  Future<void> _join(String sessionId, {bool start = false}) async {
    if (_busyId != null) return;
    final meetings = context.read<MeetingService>();
    final store = context.read<DataStore>();
    setState(() => _busyId = sessionId);
    try {
      // A class opened from a link may not have reached this device yet
      if (store.find('virtualClasses', sessionId) == null) await store.refresh();
      final result = await meetings.joinClass(sessionId, start: start);
      // The meeting is open: the list is usable again while it runs
      if (mounted) setState(() => _busyId = null);
      if (result == JoinResult.joined) await meetings.closed;
      if (!mounted) return;
      final cls = store.find('virtualClasses', sessionId);
      if (result == JoinResult.joined && cls != null && isLive(cls) && meetings.canHost(cls)) {
        await _askEnd(cls);
      }
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    } finally {
      if (mounted && _busyId == sessionId) setState(() => _busyId = null);
      store.refresh();
    }
  }

  /// The host has left: the class stays open for students unless it is ended
  Future<void> _askEnd(Record cls) async {
    final end = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End the class for everyone?'),
        content: const Text('You have left. Students can stay in the class until it is ended.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep it open')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('End class')),
        ],
      ),
    );
    if (end != true || !mounted) return;
    try {
      await context.read<MeetingService>().endClass(cls);
      if (mounted) showMessage(context, 'Class ended.');
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    }
  }

  Future<void> _newPublic() async {
    final title = TextEditingController();
    int hours = 2;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Start a public meeting'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                autofocus: true,
                maxLength: 200,
                decoration: const InputDecoration(labelText: 'Title'),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<int>(
                initialValue: hours,
                decoration: const InputDecoration(labelText: 'Link works for'),
                items: const [1, 2, 3, 4, 6, 8, 12]
                    .map((h) => DropdownMenuItem(value: h, child: Text('$h hour${h == 1 ? '' : 's'}')))
                    .toList(),
                onChanged: (v) => setLocal(() => hours = v ?? 2),
              ),
              const SizedBox(height: 8),
              const Text('Anyone with the link can join as a guest, without an LMS account.'),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Start')),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    if (title.text.trim().isEmpty) {
      showMessage(context, 'Enter a title for the meeting.', error: true);
      return;
    }
    final meetings = context.read<MeetingService>();
    try {
      final created = await meetings.createPublic(title.text.trim(), hours);
      final link = (created['meeting'] as Map)['link'].toString();
      await Clipboard.setData(ClipboardData(text: link));
      if (mounted) showMessage(context, 'Meeting started. Its link is copied: share it on WhatsApp.');
      _loadPublic();
      await meetings.openCreatedPublic(created);
      await meetings.closed;
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    } finally {
      _loadPublic();
    }
  }

  Future<void> _hostPublic(Map<String, dynamic> m) async {
    final meetings = context.read<MeetingService>();
    try {
      await meetings.hostPublic(m['id'].toString());
      await meetings.closed;
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    } finally {
      _loadPublic();
    }
  }

  Future<void> _endPublic(Map<String, dynamic> m) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End this meeting for everyone?'),
        content: const Text('The public link stops working at once.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('End meeting')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<MeetingService>().endPublic(m['id'].toString());
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    }
    _loadPublic();
  }

  Widget _classCard(Record s, Session session, MeetingService meetings) {
    final live = isLive(s);
    final host = meetings.canHost(s);
    final status = live ? 'LIVE' : str(s['status'], 'UPCOMING');
    final busy = _busyId == s['id'];
    final when = [prettyDate(str(s['scheduledStart'], str(s['date']))), prettyTime(s['startTime'])]
        .where((t) => t.isNotEmpty)
        .join(' • ');
    Widget? action;
    if (live) {
      action = FilledButton.icon(
        onPressed: busy ? null : () => _join(s['id'].toString()),
        icon: const Icon(Icons.videocam_rounded, size: 18),
        label: Text(host ? 'Enter class' : 'Join live class'),
      );
    } else if (host && status == 'UPCOMING') {
      action = OutlinedButton.icon(
        onPressed: busy ? null : () => _join(s['id'].toString(), start: true),
        icon: const Icon(Icons.play_arrow_rounded, size: 18),
        label: const Text('Start class'),
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(str(s['title'], 'Online class'),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
              StatusChip(status),
            ]),
            const SizedBox(height: 6),
            Text(
              [str(s['className']), str(s['hostTeacher']), when].where((t) => t.isNotEmpty).join(' • '),
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
            if (action != null) ...[
              const SizedBox(height: 10),
              Row(children: [
                action,
                if (busy) ...[
                  const SizedBox(width: 12),
                  const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                ],
              ]),
            ],
          ],
        ),
      ),
    );
  }

  Widget _publicCard(Map<String, dynamic> m) {
    final active = m['status'] == 'ACTIVE';
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
        title: Text(m['title'].toString(), style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(active ? 'Open until ${prettyDate(m['expiresAt'])}' : str(m['status']).toLowerCase()),
        trailing: !active
            ? null
            : Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(
                  tooltip: 'Copy link',
                  icon: const Icon(Icons.link_rounded),
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: m['link'].toString()));
                    if (mounted) showMessage(context, 'Link copied.');
                  },
                ),
                IconButton(
                  tooltip: 'Enter as host',
                  icon: const Icon(Icons.videocam_rounded),
                  onPressed: () => _hostPublic(m),
                ),
                IconButton(
                  tooltip: 'End meeting',
                  icon: const Icon(Icons.stop_circle_outlined),
                  onPressed: () => _endPublic(m),
                ),
              ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final meetings = context.watch<MeetingService>();
    final canPublic = session.can('virtual_classes.public_meeting');
    final canManage = session.canAny(const ['virtual_classes.manage', 'virtual_classes.host']);
    return StorePage(
      title: 'Online Classes',
      actions: [
        if (canManage)
          IconButton(
            tooltip: 'Schedule and manage classes',
            icon: const Icon(Icons.edit_calendar_rounded),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const PortalWebScreen(route: 'virtual-class', title: 'Manage online classes'))),
          ),
      ],
      floatingActionButton: canPublic
          ? FloatingActionButton.extended(
              onPressed: _newPublic,
              icon: const Icon(Icons.add_link_rounded),
              label: const Text('Public meeting'),
            )
          : null,
      builder: (context, store) {
        final classes = visibleClasses(store, session);
        final current = classes.where((s) => isLive(s) || s['status'] == 'UPCOMING').toList();
        final past = classes.where((s) => !isLive(s) && s['status'] != 'UPCOMING').take(10).toList();
        return [
          if (canPublic) ...[
            const SectionTitle('Public meetings'),
            if (_publicError != null)
              StoreErrorBanner(message: _publicError!)
            else if (_public == null)
              const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
            else if (_public!.where((m) => m['status'] == 'ACTIVE').isEmpty)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.public_rounded),
                  title: const Text('No public meeting is open'),
                  subtitle: const Text('Start one to get a link anyone can join.'),
                ),
              )
            else
              ..._public!.where((m) => m['status'] == 'ACTIVE').map(_publicCard),
          ],
          const SectionTitle('Live and upcoming'),
          if (current.isEmpty)
            const EmptyState(
                icon: Icons.videocam_off_outlined,
                title: 'No class is live or scheduled',
                text: 'Classes appear here as soon as they are scheduled.')
          else
            ...current.map((s) => _classCard(s, session, meetings)),
          if (past.isNotEmpty) ...[
            const SectionTitle('Recently completed'),
            ...past.map((s) => _classCard(s, session, meetings)),
          ],
          if (canPublic) const SizedBox(height: 64),
        ];
      },
    );
  }
}
