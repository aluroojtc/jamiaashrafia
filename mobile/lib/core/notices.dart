import 'package:flutter/foundation.dart';

import 'api_client.dart';

/// The person's notifications (/api/notifications): the server picks the ones addressed to them,
/// their role or their classes.
class Notices extends ChangeNotifier {
  Notices(this.api);

  final ApiClient api;
  List<Map<String, dynamic>> items = const [];
  bool loaded = false;
  String? error;

  int get unread => items.where((n) => n['isRead'] != true).length;

  Future<void> load() async {
    try {
      final data = await api.get('/api/notifications');
      items = ((data['notifications'] as List?) ?? const []).map((n) => Map<String, dynamic>.from(n as Map)).toList();
      error = null;
    } on ApiException catch (e) {
      if (!e.unauthorized) error = e.message;
    }
    loaded = true;
    notifyListeners();
  }

  Future<void> markRead(Map<String, dynamic> n) async {
    if (n['isRead'] == true) return;
    n['isRead'] = true;
    notifyListeners();
    try {
      await api.post('/api/notifications/read', {'id': n['id']});
    } on ApiException {
      // Marked again on the next load
    }
  }

  Future<void> markAllRead() async {
    final ids = items.where((n) => n['isRead'] != true).map((n) => n['id']).toList();
    if (ids.isEmpty) return;
    for (final n in items) {
      n['isRead'] = true;
    }
    notifyListeners();
    try {
      await api.post('/api/notifications/read', {'markAll': true, 'ids': ids});
    } on ApiException {
      // Marked again on the next load
    }
  }

  void clear() {
    items = const [];
    loaded = false;
    error = null;
  }
}
