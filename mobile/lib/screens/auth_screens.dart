import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../core/api_client.dart';
import '../core/deep_links.dart';
import '../core/session.dart';
import '../widgets/common.dart';
import 'guest_join_screen.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: brandTealDark,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Crest(size: 110),
            SizedBox(height: 28),
            CircularProgressIndicator(color: brandGold),
          ],
        ),
      ),
    );
  }
}

class _Crest extends StatelessWidget {
  const _Crest({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) => Image.asset('assets/crest.png', width: size, height: size, fit: BoxFit.contain);
}

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _id = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _hidden = true;
  String? _error;

  @override
  void dispose() {
    _id.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    final session = context.read<Session>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await session.signIn(_id.text, _password.text);
    } on ApiException catch (e) {
      if (!mounted) return;
      _password.clear();
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// A saved session that could not be checked because the server was unreachable
  Future<void> _retry() async {
    setState(() => _busy = true);
    await context.read<Session>().start();
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _joinByLink() async {
    final controller = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Join a meeting'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Meeting link', hintText: 'Paste the link you received'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, DeepLinks.codeFromText(controller.text) ?? ''),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (!mounted || code == null) return;
    if (code.isEmpty) {
      showMessage(context, 'This is not a meeting link of ${AppConfig.host}.', error: true);
      return;
    }
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => GuestJoinScreen(code: code)));
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final scheme = Theme.of(context).colorScheme;
    final notice = _error ?? session.notice;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: AutofillGroup(
                child: Form(
                  key: _form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: _Crest(size: 96)),
                      const SizedBox(height: 16),
                      Text('Jamia Ashrafia Lahore',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text('Learning Management System',
                          textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
                      const SizedBox(height: 28),
                      if (notice != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _error != null ? scheme.errorContainer : scheme.secondaryContainer,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(notice,
                              style: TextStyle(
                                  color: _error != null ? scheme.onErrorContainer : scheme.onSecondaryContainer)),
                        ),
                        const SizedBox(height: 16),
                      ],
                      TextFormField(
                        controller: _id,
                        autofillHints: const [AutofillHints.username],
                        textInputAction: TextInputAction.next,
                        autocorrect: false,
                        enableSuggestions: false,
                        decoration: const InputDecoration(
                          labelText: 'ID',
                          hintText: 'Roll No, Email or Teacher ID',
                          prefixIcon: Icon(Icons.person_outline_rounded),
                        ),
                        validator: (v) => (v ?? '').trim().isEmpty ? 'Enter your ID' : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _password,
                        obscureText: _hidden,
                        autofillHints: const [AutofillHints.password],
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline_rounded),
                          suffixIcon: IconButton(
                            tooltip: _hidden ? 'Show password' : 'Hide password',
                            icon: Icon(_hidden ? Icons.visibility_rounded : Icons.visibility_off_rounded),
                            onPressed: () => setState(() => _hidden = !_hidden),
                          ),
                        ),
                        validator: (v) => (v ?? '').isEmpty ? 'Enter your password' : null,
                      ),
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        onPressed: _busy ? null : _submit,
                        icon: _busy
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.login_rounded),
                        label: const Text('Sign in'),
                      ),
                      if (context.read<ApiClient>().hasSession) ...[
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _retry,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Try again'),
                        ),
                      ],
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: _joinByLink,
                        icon: const Icon(Icons.link_rounded),
                        label: const Text('Join a meeting with a link'),
                      ),
                      const SizedBox(height: 16),
                      Text('Forgot your password? Contact the Academic Office.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
                      TextButton(
                        onPressed: () => launchUrl(AppConfig.privacyPolicy, mode: LaunchMode.externalApplication),
                        child: const Text('Privacy policy'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Changing one's own password. [forced]: signed in with a temporary password, nothing else opens until
/// a new one is chosen (the server enforces this too).
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key, this.forced = false});

  final bool forced;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _again = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _again.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    final session = context.read<Session>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await session.changePassword(_current.text, _next.text);
      if (!mounted) return;
      if (!widget.forced) {
        showMessage(context, 'Password changed.');
        Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(TextEditingController c, String label, String? Function(String?) validator, {bool last = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: c,
        obscureText: true,
        textInputAction: last ? TextInputAction.done : TextInputAction.next,
        onFieldSubmitted: last ? (_) => _submit() : null,
        decoration: InputDecoration(labelText: label, prefixIcon: const Icon(Icons.lock_outline_rounded)),
        validator: validator,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.forced ? 'Choose a new password' : 'Change password'),
        automaticallyImplyLeading: !widget.forced,
        actions: [
          if (widget.forced)
            TextButton(
              onPressed: () => context.read<Session>().signOut(),
              child: const Text('Sign out', style: TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (widget.forced)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(
                      'You signed in with a temporary password. Choose your own password to continue.',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                  ),
                if (_error != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: scheme.errorContainer, borderRadius: BorderRadius.circular(12)),
                    child: Text(_error!, style: TextStyle(color: scheme.onErrorContainer)),
                  ),
                _field(_current, widget.forced ? 'Temporary password' : 'Current password',
                    (v) => (v ?? '').isEmpty ? 'Enter your current password' : null),
                _field(_next, 'New password', (v) {
                  final p = v ?? '';
                  if (p.length < 8) return 'Use at least 8 characters';
                  if (p == _current.text) return 'Choose a password different from the current one';
                  return null;
                }),
                _field(_again, 'New password again', (v) => v != _next.text ? 'The two passwords do not match' : null,
                    last: true),
                const SizedBox(height: 6),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: _busy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Save password'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
