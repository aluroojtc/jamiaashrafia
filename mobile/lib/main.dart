import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config.dart';
import 'core/api_client.dart';
import 'core/deep_links.dart';
import 'core/notices.dart';
import 'core/session.dart';
import 'core/store.dart';
import 'meeting/meeting_service.dart';
import 'screens/auth_screens.dart';
import 'screens/guest_join_screen.dart';
import 'screens/home_shell.dart';
import 'screens/live_classes_screen.dart';
import 'widgets/common.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  final session = Session(api);
  final store = DataStore(api);
  final meetings = MeetingService(api, session, store);
  final links = DeepLinks();
  final notices = Notices(api);

  runApp(MultiProvider(
    providers: [
      Provider<ApiClient>.value(value: api),
      ChangeNotifierProvider<Session>.value(value: session),
      ChangeNotifierProvider<DataStore>.value(value: store),
      ChangeNotifierProvider<MeetingService>.value(value: meetings),
      ChangeNotifierProvider<DeepLinks>.value(value: links),
      ChangeNotifierProvider<Notices>.value(value: notices),
    ],
    child: const LmsApp(),
  ));

  session.start();
  links.start();
}

class LmsApp extends StatelessWidget {
  const LmsApp({super.key});

  ThemeData _theme(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(seedColor: brandTeal, brightness: brightness, secondary: brandGold);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: brightness == Brightness.light ? const Color(0xFFF4F7F8) : null,
      appBarTheme: AppBarTheme(
        backgroundColor: brightness == Brightness.light ? brandTeal : scheme.surface,
        foregroundColor: brightness == Brightness.light ? Colors.white : scheme.onSurface,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: const EdgeInsets.symmetric(vertical: 4),
        color: scheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.6)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
        fillColor: scheme.surface,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      home: const AuthGate(),
    );
  }
}

/// Chooses the screen for the sign-in state, loads the person's records once they are in, and opens
/// meeting links the app was started with.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> with WidgetsBindingObserver {
  AuthStatus? _last;
  late final Session _session;
  late final DataStore _store;
  late final DeepLinks _links;

  /// A class link opened while signed out: joined right after sign-in
  String? _classAfterSignIn;

  @override
  void initState() {
    super.initState();
    _session = context.read<Session>();
    _store = context.read<DataStore>();
    _links = context.read<DeepLinks>();
    _session.addListener(_onSession);
    _links.addListener(_onLink);
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _onSession();
      _onLink();
    });
  }

  @override
  void dispose() {
    _session.removeListener(_onSession);
    _links.removeListener(_onLink);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Back in the foreground: permissions and records may have changed meanwhile
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || _session.status != AuthStatus.signedIn) return;
    _session.refresh().catchError((_) {});
    _store.refresh();
  }

  void _onSession() {
    final status = _session.status;
    if (status == _last) return;
    _last = status;
    if (status == AuthStatus.signedIn) {
      _store.start();
      final pendingClass = _classAfterSignIn;
      _classAfterSignIn = null;
      if (pendingClass != null) _openClass(pendingClass);
    } else if (status == AuthStatus.signedOut) {
      _store.stop();
      context.read<Notices>().clear();
      // Nothing of the previous person stays on screen
      navigatorKey.currentState?.popUntil((r) => r.isFirst);
    }
  }

  void _onLink() {
    if (_session.status == AuthStatus.starting) return;
    final target = _links.take();
    if (target == null) return;
    switch (target) {
      case PublicMeetingLink(:final code):
        navigatorKey.currentState?.push(MaterialPageRoute(builder: (_) => GuestJoinScreen(code: code)));
      case ClassLink(:final sessionId):
        if (_session.status == AuthStatus.signedIn) {
          _openClass(sessionId);
        } else {
          _classAfterSignIn = sessionId;
          _session.notice = 'Sign in to join the class.';
          setState(() {});
        }
    }
  }

  void _openClass(String sessionId) {
    navigatorKey.currentState?.push(MaterialPageRoute(builder: (_) => LiveClassesScreen(autoJoinId: sessionId)));
  }

  @override
  Widget build(BuildContext context) {
    final status = context.watch<Session>().status;
    // A link that arrived while the app was still starting
    if (status != AuthStatus.starting && _links.pending != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _onLink());
    }
    return switch (status) {
      AuthStatus.starting => const SplashScreen(),
      AuthStatus.signedOut => const SignInScreen(),
      AuthStatus.mustChangePassword => const ChangePasswordScreen(forced: true),
      AuthStatus.signedIn => const HomeShell(),
    };
  }
}
