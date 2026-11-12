import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/session.dart';
import '../meeting/meeting_service.dart';
import '../widgets/common.dart';

/// A public meeting link opened in the app (from WhatsApp, or pasted): shows the meeting, asks for a name
/// and joins as a guest. No LMS account is needed, exactly as on the portal's /meet/<code> page.
class GuestJoinScreen extends StatefulWidget {
  const GuestJoinScreen({super.key, required this.code});

  final String code;

  @override
  State<GuestJoinScreen> createState() => _GuestJoinScreenState();
}

class _GuestJoinScreenState extends State<GuestJoinScreen> {
  final _name = TextEditingController();
  Map<String, dynamic>? _meeting;
  String? _error;
  bool _loading = true;
  bool _joining = false;
  bool _left = false;

  @override
  void initState() {
    super.initState();
    final session = context.read<Session>();
    if (session.status == AuthStatus.signedIn) _name.text = session.name;
    _lookup();
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await context.read<ApiClient>().post('/api/public-meetings/lookup', {'code': widget.code});
      if (!mounted) return;
      setState(() => _meeting = Map<String, dynamic>.from(data['meeting'] as Map));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _join() async {
    final name = _name.text.trim();
    if (name.length < 2) {
      showMessage(context, 'Enter your name.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    final meetings = context.read<MeetingService>();
    setState(() => _joining = true);
    try {
      await meetings.joinPublicAsGuest(widget.code, name);
      await meetings.closed;
      if (mounted) setState(() => _left = true);
    } on ApiException catch (e) {
      if (!mounted) return;
      showMessage(context, e.message, error: true);
      // The meeting may have ended meanwhile
      if (e.status == 410) _lookup();
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final meeting = _meeting;
    final active = meeting != null && meeting['active'] == true;

    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (_error != null || meeting == null) {
      body = Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          EmptyState(icon: Icons.link_off_rounded, title: 'This meeting cannot be opened', text: _error),
          OutlinedButton.icon(onPressed: _lookup, icon: const Icon(Icons.refresh_rounded), label: const Text('Try again')),
        ]),
      );
    } else {
      body = Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(active ? Icons.videocam_rounded : Icons.meeting_room_outlined, size: 56, color: scheme.primary),
                const SizedBox(height: 14),
                Text(meeting['title'].toString(),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Text('Hosted by ${meeting['hostName']}',
                    textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
                const SizedBox(height: 28),
                if (!active)
                  const EmptyState(
                      icon: Icons.door_front_door_outlined,
                      title: 'This meeting has ended',
                      text: 'Ask the host for a new link.')
                else ...[
                  if (_left)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Text('You have left the meeting. You can rejoin while it is open.',
                          textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
                    ),
                  TextField(
                    controller: _name,
                    maxLength: 60,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _join(),
                    decoration: const InputDecoration(
                      labelText: 'Your name',
                      hintText: 'e.g. Muhammad Ahmad',
                      prefixIcon: Icon(Icons.person_outline_rounded),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: _joining ? null : _join,
                    icon: _joining
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.videocam_rounded),
                    label: Text(_left ? 'Rejoin meeting' : 'Join meeting'),
                  ),
                  const SizedBox(height: 14),
                  Text('Your camera and microphone start switched off. Screen sharing is in the meeting\'s menu.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
                ],
              ],
            ),
          ),
        ),
      );
    }
    return Scaffold(appBar: AppBar(title: const Text('Join meeting')), body: SafeArea(child: body));
  }
}
