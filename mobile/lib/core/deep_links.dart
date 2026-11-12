import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

import '../config.dart';

/// A link the app was opened with
sealed class LinkTarget {
  const LinkTarget();
}

/// A public meeting link shared on WhatsApp: `https://PORTAL/meet/CODE`
class PublicMeetingLink extends LinkTarget {
  const PublicMeetingLink(this.code);
  final String code;
}

/// A class link: `https://PORTAL/live.html?session=ID` (sign-in required)
class ClassLink extends LinkTarget {
  const ClassLink(this.sessionId);
  final String sessionId;
}

/// Turns incoming links into things the app can open. Only links to the portal's own host (or the app's
/// own scheme) are accepted; anything else is ignored.
class DeepLinks extends ChangeNotifier {
  final AppLinks _links = AppLinks();
  StreamSubscription<Uri>? _sub;

  /// The link waiting to be opened (taken once by the app shell)
  LinkTarget? pending;

  static final _code = RegExp(r'^[A-Za-z0-9_-]{20,64}$');

  void start() {
    _sub ??= _links.uriLinkStream.listen(_handle, onError: (_) {});
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  LinkTarget? take() {
    final t = pending;
    pending = null;
    return t;
  }

  void _handle(Uri uri) {
    final target = parse(uri);
    if (target == null) return;
    pending = target;
    notifyListeners();
  }

  static LinkTarget? parse(Uri uri) {
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    if (uri.scheme == AppConfig.scheme) {
      // jamiaashrafia://meet/<code>  |  jamiaashrafia://class/<sessionId>
      final code = segments.isNotEmpty ? segments.first : '';
      if (uri.host == 'meet' && _code.hasMatch(code)) return PublicMeetingLink(code);
      if (uri.host == 'class' && code.isNotEmpty && code.length <= 120) return ClassLink(code);
      return null;
    }
    if ((uri.scheme != 'https' && uri.scheme != 'http') || uri.host.toLowerCase() != AppConfig.host.toLowerCase()) {
      return null;
    }
    if (segments.length == 2 && segments[0] == 'meet' && _code.hasMatch(segments[1])) {
      return PublicMeetingLink(segments[1]);
    }
    if (segments.length == 1 && segments[0] == 'live.html') {
      final id = uri.queryParameters['session'] ?? '';
      if (id.isNotEmpty && id.length <= 120) return ClassLink(id);
    }
    return null;
  }

  /// A link typed or pasted by hand: the whole address or just its code
  static String? codeFromText(String text) {
    final t = text.trim();
    if (_code.hasMatch(t)) return t;
    final uri = Uri.tryParse(t.contains('://') ? t : 'https://$t');
    final target = uri == null ? null : parse(uri);
    return target is PublicMeetingLink ? target.code : null;
  }
}
