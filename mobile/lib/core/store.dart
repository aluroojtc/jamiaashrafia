import 'dart:async';

import 'package:flutter/foundation.dart';

import 'api_client.dart';

typedef Record = Map<String, dynamic>;

/// The LMS records this person may see (classes, timetable, attendance, assignments, fees ...), pulled from
/// the server's shared record store (/api/store). The server decides what is included and removes fields the
/// person may not see, so nothing here needs filtering for security. Kept in memory only: signing out leaves
/// nothing of a person's data on the device.
class DataStore extends ChangeNotifier {
  DataStore(this.api);

  final ApiClient api;
  final Map<String, Map<String, Record>> _collections = {};
  String? _serverTime;
  Timer? _timer;
  Future<void>? _running;

  bool loaded = false;
  bool loading = false;
  String? error;

  List<Record> list(String collection) => _collections[collection]?.values.toList() ?? const [];

  Record? find(String collection, String? id) => id == null ? null : _collections[collection]?[id];

  /// First load after sign-in, then a light refresh every minute while the app is open
  Future<void> start() async {
    await refresh(full: true);
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 60), (_) => refresh());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _collections.clear();
    _serverTime = null;
    loaded = false;
    error = null;
  }

  Future<void> refresh({bool full = false}) {
    return _running ??= _pull(full || _serverTime == null).whenComplete(() => _running = null);
  }

  Future<void> _pull(bool full) async {
    loading = true;
    if (!loaded) notifyListeners();
    try {
      final data = await api.get('/api/store', query: full ? null : {'since': _serverTime!});
      if (data['full'] == true) _collections.clear();
      final incoming = (data['collections'] as Map?) ?? const {};
      incoming.forEach((name, records) {
        final target = _collections.putIfAbsent(name.toString(), () => {});
        for (final r in (records as List)) {
          final rec = Map<String, dynamic>.from(r as Map);
          target[rec['id'].toString()] = rec;
        }
      });
      final removed = (data['deleted'] as Map?) ?? const {};
      removed.forEach((name, ids) {
        final target = _collections[name.toString()];
        if (target == null) return;
        for (final id in (ids as List)) {
          target.remove(id.toString());
        }
      });
      _serverTime = data['serverTime']?.toString() ?? _serverTime;
      loaded = true;
      error = null;
    } on ApiException catch (e) {
      // A lost session is handled by Session; anything else is shown and retried on the next refresh
      if (!e.unauthorized) error = e.message;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Saves one record through the same sync endpoint the web portal uses. The server applies the person's
  /// permissions to the write and refuses what they may not change.
  Future<void> save(String collection, Record record) async {
    final id = record['id'].toString();
    final data = await api.post('/api/store/sync', {
      'upserts': {
        collection: [record],
      },
    });
    final rejected = ((data['rejected'] as Map?)?[collection] as List?) ?? const [];
    if (rejected.map((e) => e.toString()).contains(id)) {
      final reason = ((data['errors'] as Map?)?[collection] as Map?)?[id];
      throw ApiException(403, (reason ?? 'The server did not accept this change.').toString());
    }
    _collections.putIfAbsent(collection, () => {})[id] = record;
    notifyListeners();
  }
}
