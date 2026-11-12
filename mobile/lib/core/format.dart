import 'package:intl/intl.dart';

import 'store.dart';

/// Small helpers for reading LMS records and showing dates.
String str(Object? v, [String fallback = '']) {
  final s = v?.toString().trim() ?? '';
  return s.isEmpty ? fallback : s;
}

num numOf(Object? v) => v is num ? v : num.tryParse(v?.toString() ?? '') ?? 0;

String today() => DateFormat('yyyy-MM-dd').format(DateTime.now());

String nowHHMM() => DateFormat('HH:mm').format(DateTime.now());

String todayName() => DateFormat('EEEE').format(DateTime.now());

const List<String> weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/// "2026-10-28" or an ISO timestamp -> "28 Oct 2026"
String prettyDate(Object? value) {
  final s = str(value);
  if (s.isEmpty) return '';
  final d = DateTime.tryParse(s);
  return d == null ? s : DateFormat('d MMM yyyy').format(d.toLocal());
}

/// "13:30" -> "1:30 PM"
String prettyTime(Object? value) {
  final s = str(value);
  final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(s);
  if (m == null) return s;
  final t = DateTime(2000, 1, 1, int.parse(m.group(1)!), int.parse(m.group(2)!));
  return DateFormat('h:mm a').format(t);
}

String money(Object? value) => 'Rs ${NumberFormat('#,##0').format(numOf(value))}';

String initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return 'JA';
  return (parts.length == 1 ? parts.first.substring(0, 1) : parts.first.substring(0, 1) + parts.last.substring(0, 1))
      .toUpperCase();
}

String className(DataStore store, Object? classId) {
  final c = store.find('classes', classId?.toString());
  if (c == null) return '';
  final section = str(c['section']);
  return section.isEmpty ? str(c['name']) : '${str(c['name'])} - $section';
}

String courseName(DataStore store, Object? courseId) => str(store.find('courses', courseId?.toString())?['title']);

String userName(DataStore store, Object? userId) => str(store.find('users', userId?.toString())?['name']);

/// The classes a teacher works with: class teacher, or teaching a kitab there
Set<String> teacherClassIds(DataStore store, String teacherId) {
  final ids = <String>{};
  for (final c in store.list('classes')) {
    final teaches = c['teacherId'] == teacherId ||
        ((c['courseTeachers'] as List?) ?? const []).any((ct) => ct is Map && ct['teacherId'] == teacherId);
    if (teaches) ids.add(c['id'].toString());
  }
  return ids;
}

bool isLive(Record session) => session['isLive'] == true || session['status'] == 'LIVE';
