import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../config.dart';
import '../core/api_client.dart';
import '../core/session.dart';
import '../meeting/meeting_service.dart';
import '../widgets/common.dart';
import 'live_classes_screen.dart';

/// A page of the web portal shown inside the app, already signed in with the app's own session.
/// Used for the pages that have no screen of their own here (user and role management, admissions,
/// reports, institution setup ...), so every role keeps everything it can do on the portal. The portal
/// server applies the same permissions as always.
class PortalWebScreen extends StatefulWidget {
  const PortalWebScreen({super.key, this.route, this.path, required this.title});

  /// A portal page: `index.html#ROUTE`
  final String? route;

  /// Or a file on the portal (an uploaded attachment), e.g. uploads/2026-10/paper.pdf
  final String? path;
  final String title;

  @override
  State<PortalWebScreen> createState() => _PortalWebScreenState();
}

class _PortalWebScreenState extends State<PortalWebScreen> {
  late final WebViewController _web;
  int _progress = 0;
  bool _ready = false;
  String? _error;

  Uri get _start {
    if (widget.path != null) {
      return AppConfig.base.replace(path: '/${widget.path!.replaceFirst(RegExp(r'^/+'), '')}');
    }
    return AppConfig.base.replace(path: '/index.html', fragment: widget.route ?? 'dashboard');
  }

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => mounted ? setState(() => _progress = p) : null,
        onPageStarted: (_) => mounted ? setState(() => _error = null) : null,
        onWebResourceError: (e) {
          if (e.isForMainFrame == true && mounted) setState(() => _error = e.description);
        },
        onNavigationRequest: _onNavigate,
      ));
    _open();
  }

  /// The app's session becomes the WebView's, so the portal opens signed in as the same person
  Future<void> _open() async {
    final token = context.read<ApiClient>().token;
    if (token != null) {
      await WebViewCookieManager().setCookie(
        WebViewCookie(name: AppConfig.sessionCookie, value: token, domain: AppConfig.host, path: '/'),
      );
    }
    await _web.loadRequest(_start);
    if (mounted) setState(() => _ready = true);
  }

  NavigationDecision _onNavigate(NavigationRequest request) {
    final uri = Uri.tryParse(request.url);
    if (uri == null) return NavigationDecision.prevent;
    if (uri.scheme == 'about' || uri.scheme == 'data' || uri.scheme == 'blob') return NavigationDecision.navigate;

    // Anything outside the portal (a Zoom link, a website) opens in its own app
    if (uri.host.toLowerCase() != AppConfig.host.toLowerCase()) {
      launchUrl(uri, mode: LaunchMode.externalApplication);
      return NavigationDecision.prevent;
    }
    final file = uri.pathSegments.isEmpty ? '' : uri.pathSegments.last;

    // A live class or public meeting opens in the native meeting (screen sharing works there)
    if (file == 'live.html') {
      final sessionId = uri.queryParameters['session'];
      final publicId = uri.queryParameters['publicMeeting'];
      if (sessionId != null && sessionId.isNotEmpty) {
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => LiveClassesScreen(autoJoinId: sessionId)));
      } else if (publicId != null && publicId.isNotEmpty) {
        _hostPublic(publicId);
      }
      return NavigationDecision.prevent;
    }
    // The portal went to its sign-in page: the session ended (or the person signed out there)
    if (file == 'login.html' || file == 'login' || uri.path == '/') {
      _sessionEnded();
      return NavigationDecision.prevent;
    }
    return NavigationDecision.navigate;
  }

  Future<void> _hostPublic(String id) async {
    final meetings = context.read<MeetingService>();
    try {
      await meetings.hostPublic(id);
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    }
  }

  Future<void> _sessionEnded() async {
    final session = context.read<Session>();
    try {
      await session.refresh();
    } on ApiException {
      // Offline: stay where we are
    }
  }

  Future<void> _back() async {
    if (await _web.canGoBack()) {
      await _web.goBack();
    } else if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          leading: IconButton(
            tooltip: 'Close',
            icon: const Icon(Icons.close_rounded),
            onPressed: () => Navigator.of(context).pop(),
          ),
          actions: [
            IconButton(tooltip: 'Reload', icon: const Icon(Icons.refresh_rounded), onPressed: () => _web.reload()),
          ],
          bottom: _progress < 100
              ? PreferredSize(
                  preferredSize: const Size.fromHeight(3),
                  child: LinearProgressIndicator(value: _progress / 100, minHeight: 3),
                )
              : null,
        ),
        body: _error != null
            ? Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  EmptyState(icon: Icons.cloud_off_rounded, title: 'This page could not be loaded', text: _error),
                  OutlinedButton.icon(
                    onPressed: () => _web.loadRequest(_start),
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Try again'),
                  ),
                ]),
              )
            : !_ready
                ? const Center(child: CircularProgressIndicator())
                : WebViewWidget(controller: _web),
      ),
    );
  }
}
