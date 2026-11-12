import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message, [this.data = const {}]);

  /// HTTP status, or 0 when the server could not be reached
  final int status;
  final String message;
  final Map<String, dynamic> data;

  bool get offline => status == 0;
  bool get unauthorized => status == 401;
  bool get mustChangePassword => data['mustChangePassword'] == true;

  @override
  String toString() => message;
}

/// Talks to the portal server exactly as the web portal does: the same endpoints and the same
/// session cookie. The cookie value is the only thing kept on the device (in the platform keystore);
/// the password never is.
class ApiClient {
  ApiClient({http.Client? client}) : _http = client ?? http.Client();

  static const _storageKey = 'session_token';
  static final _tokenPattern = RegExp('${AppConfig.sessionCookie}=([a-f0-9]{64})');

  final http.Client _http;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  String? _token;

  /// Called when the server says the session is no longer valid (expired, revoked, account suspended)
  void Function()? onSessionLost;

  String? get token => _token;
  bool get hasSession => _token != null;

  Future<void> restore() async {
    try {
      final saved = await _storage.read(key: _storageKey);
      _token = saved != null && RegExp(r'^[a-f0-9]{64}$').hasMatch(saved) ? saved : null;
    } catch (_) {
      _token = null;
    }
  }

  Future<void> clearSession() async {
    _token = null;
    try {
      await _storage.delete(key: _storageKey);
    } catch (_) {/* nothing stored */}
  }

  Future<void> _remember(http.Response res) async {
    final header = res.headers['set-cookie'];
    if (header == null || !header.contains('${AppConfig.sessionCookie}=')) return;
    final match = _tokenPattern.firstMatch(header);
    if (match != null) {
      _token = match.group(1);
      try {
        await _storage.write(key: _storageKey, value: _token);
      } catch (_) {/* stays in memory for this run */}
    } else {
      // An emptied cookie: the server ended the session
      await clearSession();
    }
  }

  Map<String, String> _headers({bool json = false}) => {
        'Accept': 'application/json',
        if (json) 'Content-Type': 'application/json',
        if (_token != null) 'Cookie': '${AppConfig.sessionCookie}=$_token',
        'User-Agent': 'JamiaAshrafiaLMS-App/1.0 (${Platform.operatingSystem})',
      };

  Uri _uri(String path, [Map<String, String>? query]) =>
      AppConfig.base.replace(path: path, queryParameters: query == null || query.isEmpty ? null : query);

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) =>
      _send(() => _http.get(_uri(path, query), headers: _headers()));

  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) =>
      _send(() => _http.post(_uri(path), headers: _headers(json: true), body: jsonEncode(body ?? const {})));

  Future<Map<String, dynamic>> delete(String path) =>
      _send(() => _http.delete(_uri(path), headers: _headers()));

  Future<Map<String, dynamic>> _send(Future<http.Response> Function() request) async {
    http.Response res;
    try {
      res = await request().timeout(const Duration(seconds: 30));
    } on TimeoutException {
      throw ApiException(0, 'The portal server took too long to answer. Please try again.');
    } on SocketException {
      throw ApiException(0, 'The portal server cannot be reached. Please check your internet connection.');
    } on http.ClientException {
      throw ApiException(0, 'The portal server cannot be reached. Please check your internet connection.');
    } on HandshakeException {
      throw ApiException(0, 'A secure connection to the portal could not be made.');
    }
    await _remember(res);

    Map<String, dynamic> data = const {};
    try {
      final decoded = jsonDecode(utf8.decode(res.bodyBytes));
      if (decoded is Map<String, dynamic>) data = decoded;
    } catch (_) {/* not JSON (e.g. a proxy error page) */}

    if (res.statusCode >= 200 && res.statusCode < 300) return data;

    final message = (data['message'] ?? data['error'] ?? 'The request failed (${res.statusCode}).').toString();
    if (res.statusCode == 401 && _token != null) {
      await clearSession();
      onSessionLost?.call();
    }
    throw ApiException(res.statusCode, message, data);
  }
}
