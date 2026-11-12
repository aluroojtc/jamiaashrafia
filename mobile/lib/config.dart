/// Where the LMS portal lives. Override at build time with
/// `--dart-define=LMS_BASE_URL=https://staging.example.org` (e.g. a local test server).
class AppConfig {
  static const String baseUrl = String.fromEnvironment(
    'LMS_BASE_URL',
    defaultValue: 'https://lms.jamiaashrafia.asia',
  );

  static Uri get base => Uri.parse(baseUrl);

  static String get host => base.host;

  /// Custom scheme that also opens meeting links: jamiaashrafia://meet/<code>
  static const String scheme = 'jamiaashrafia';

  static const String appName = 'Jamia Ashrafia LMS';

  /// Public page, also linked from the Google Play listing
  static Uri get privacyPolicy => base.replace(path: '/privacy-policy');

  /// The session cookie the portal server issues (server/auth.js)
  static const String sessionCookie = 'jamia_sid';
}
