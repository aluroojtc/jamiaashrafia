import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/format.dart';
import '../core/notices.dart';
import '../core/session.dart';
import '../core/store.dart';
import '../widgets/common.dart';
import 'portal_web_screen.dart';

void _openPortal(BuildContext context, String route, String title) {
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => PortalWebScreen(route: route, title: title)));
}

/// "Open in portal" button for the things done on the portal's own page (marking, grading, uploading)
Widget _portalAction(BuildContext context, String route, String title, {String tooltip = 'Open the full page'}) {
  return IconButton(
    tooltip: tooltip,
    icon: const Icon(Icons.open_in_new_rounded),
    onPressed: () => _openPortal(context, route, title),
  );
}

// =============================================================================
// Timetable
// =============================================================================

class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  String _day = weekDays.contains(todayName()) ? todayName() : weekDays.first;
  String? _classId;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return StorePage(
      title: 'Timetable',
      actions: [if (session.can('timetable.manage')) _portalAction(context, 'timetable', 'Manage timetable')],
      builder: (context, store) {
        final classes = store.list('classes')..sort((a, b) => str(a['name']).compareTo(str(b['name'])));
        var periods = store.list('timetables').where((p) => p['day'] == _day);
        if (session.isStudent) {
          periods = periods.where((p) => p['classId'] == session.user['classId']);
        } else if (session.isTeacher && _classId == null) {
          periods = periods.where((p) => p['teacherId'] == session.userId);
        } else if (_classId != null) {
          periods = periods.where((p) => p['classId'] == _classId);
        }
        final list = periods.toList()..sort((a, b) => str(a['startTime']).compareTo(str(b['startTime'])));
        final now = nowHHMM();
        return [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final d in weekDays)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(d.substring(0, 3)),
                      selected: d == _day,
                      onSelected: (_) => setState(() => _day = d),
                    ),
                  ),
              ],
            ),
          ),
          if (!session.isStudent && classes.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: DropdownButtonFormField<String?>(
                initialValue: classes.any((c) => c['id'] == _classId) ? _classId : null,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Class', isDense: true),
                items: [
                  DropdownMenuItem(value: null, child: Text(session.isTeacher ? 'My periods' : 'All classes')),
                  for (final c in classes)
                    DropdownMenuItem(value: c['id'].toString(), child: Text(className(store, c['id']))),
                ],
                onChanged: (v) => setState(() => _classId = v),
              ),
            ),
          const SizedBox(height: 8),
          if (list.isEmpty)
            EmptyState(icon: Icons.event_busy_rounded, title: 'No periods on $_day')
          else
            for (final p in list)
              Card(
                color: _day == todayName() && now.compareTo(str(p['startTime'])) >= 0 && now.compareTo(str(p['endTime'])) < 0
                    ? Theme.of(context).colorScheme.primaryContainer
                    : null,
                child: ListTile(
                  leading: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(prettyTime(p['startTime']), style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(prettyTime(p['endTime']), style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                  title: Text(str(courseName(store, p['courseId']), str(p['periodName'], 'Period')),
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text([
                    if (!session.isStudent) className(store, p['classId']),
                    userName(store, p['teacherId']),
                    if (str(p['room']).isNotEmpty) 'Room ${p['room']}',
                  ].where((t) => t.isNotEmpty).join(' • ')),
                ),
              ),
        ];
      },
    );
  }
}

// =============================================================================
// Attendance
// =============================================================================

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  DateTime _date = DateTime.now();

  String get _iso => '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  Widget _row(BuildContext context, Record a, {required bool own}) {
    final sub = [
      if (own) prettyDate(a['date']) else str(a['identifier']),
      str(a['className']),
      if (str(a['periodName']).isNotEmpty) str(a['periodName']),
      if (str(a['checkInTime']).isNotEmpty) 'In ${a['checkInTime']}',
      if (a['session'] == 'VIRTUAL_CLASS') 'Online class',
    ].where((t) => t.isNotEmpty).join(' • ');
    return Card(
      child: ListTile(
        title: Text(own ? prettyDate(a['date']) : str(a['userName'], 'Unknown'),
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(own ? sub.replaceFirst('${prettyDate(a['date'])} • ', '') : sub),
        trailing: StatusChip(str(a['status'], 'PRESENT')),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final canMark = session.canAny(const ['attendance.mark', 'attendance.self_checkin']);
    return StorePage(
      title: session.isStudent ? 'My Attendance' : 'Attendance',
      actions: [
        if (canMark)
          _portalAction(context, 'attendance', 'Attendance',
              tooltip: session.can('attendance.mark') ? 'Mark attendance' : 'Daily check-in'),
      ],
      builder: (context, store) {
        final all = store.list('attendance');
        if (session.isStudent) {
          final mine = all.where((a) => a['userId'] == session.userId).toList()
            ..sort((a, b) => str(b['date']).compareTo(str(a['date'])));
          int count(String s) => mine.where((a) => a['status'] == s).length;
          final attended = count('PRESENT') + count('LATE');
          final pct = mine.isEmpty ? 0 : (attended * 100 / mine.length).round();
          return [
            TileGrid(aspect: 1.5, children: [
              StatTile(icon: Icons.percent_rounded, value: '$pct%', label: 'Attendance'),
              StatTile(
                  icon: Icons.check_circle_rounded, value: '${count('PRESENT')}', label: 'Present', color: Colors.green),
              StatTile(icon: Icons.schedule_rounded, value: '${count('LATE')}', label: 'Late', color: Colors.orange),
              StatTile(icon: Icons.cancel_rounded, value: '${count('ABSENT')}', label: 'Absent', color: Colors.red),
            ]),
            const SectionTitle('History'),
            if (mine.isEmpty)
              const EmptyState(icon: Icons.fact_check_outlined, title: 'No attendance recorded yet')
            else
              ...mine.take(120).map((a) => _row(context, a, own: true)),
          ];
        }

        final day = all.where((a) => a['date'] == _iso).toList()
          ..sort((a, b) => str(a['userName']).compareTo(str(b['userName'])));
        int count(String s) => day.where((a) => a['status'] == s).length;
        return [
          Card(
            child: Row(children: [
              IconButton(
                  tooltip: 'Previous day',
                  icon: const Icon(Icons.chevron_left_rounded),
                  onPressed: () => setState(() => _date = _date.subtract(const Duration(days: 1)))),
              Expanded(
                child: TextButton(
                  onPressed: () async {
                    final picked = await showDatePicker(
                        context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now());
                    if (picked != null) setState(() => _date = picked);
                  },
                  child: Text(prettyDate(_iso), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                ),
              ),
              IconButton(
                  tooltip: 'Next day',
                  icon: const Icon(Icons.chevron_right_rounded),
                  onPressed: _iso.compareTo(today()) >= 0
                      ? null
                      : () => setState(() => _date = _date.add(const Duration(days: 1)))),
            ]),
          ),
          TileGrid(aspect: 1.9, children: [
            StatTile(icon: Icons.check_circle_rounded, value: '${count('PRESENT')}', label: 'Present', color: Colors.green),
            StatTile(icon: Icons.schedule_rounded, value: '${count('LATE')}', label: 'Late', color: Colors.orange),
            StatTile(icon: Icons.cancel_rounded, value: '${count('ABSENT')}', label: 'Absent', color: Colors.red),
            StatTile(icon: Icons.list_alt_rounded, value: '${day.length}', label: 'Records'),
          ]),
          const SectionTitle('Records'),
          if (day.isEmpty)
            const EmptyState(icon: Icons.fact_check_outlined, title: 'No attendance on this day')
          else
            ...day.map((a) => _row(context, a, own: false)),
        ];
      },
    );
  }
}

// =============================================================================
// Assignments
// =============================================================================

class AssignmentsScreen extends StatelessWidget {
  const AssignmentsScreen({super.key});

  void _details(BuildContext context, DataStore store, Session session, Record a, Record? mine) {
    final attachments = ((a['attachments'] as List?) ?? const []).whereType<Map>().toList();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(str(a['title']), style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
              if (str(a['urduTitle']).isNotEmpty)
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(str(a['urduTitle']), textDirection: TextDirection.rtl, style: Theme.of(ctx).textTheme.titleMedium),
                ),
              const SizedBox(height: 10),
              InfoRow('Class', className(store, a['classId'])),
              InfoRow('Kitab', courseName(store, a['courseId'])),
              InfoRow('Due', prettyDate(a['dueDate'])),
              InfoRow('Marks', str(a['maxMarks'])),
              if (str(a['description']).isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(str(a['description'])),
              ],
              for (final f in attachments)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.attach_file_rounded),
                  title: Text(str(f['name'], 'Attachment')),
                  onTap: () => Navigator.of(ctx).push(MaterialPageRoute(
                      builder: (_) => PortalWebScreen(path: str(f['url']), title: str(f['name'], 'Attachment')))),
                ),
              if (mine != null) ...[
                const Divider(height: 28),
                InfoRow('Submitted', prettyDate(mine['submittedAt'])),
                if (mine['isGraded'] == true) ...[
                  InfoRow('Marks obtained', '${str(mine['marksObtained'])} / ${str(a['maxMarks'])}'),
                  InfoRow('Grade', str(mine['wifaqGrade'])),
                  InfoRow('Feedback', str(mine['feedback'])),
                ],
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _openPortal(context, 'assignments', 'Assignments');
                  },
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: Text(session.can('assignments.submit')
                      ? (mine == null ? 'Submit in the portal' : 'Open in the portal')
                      : 'Open in the portal'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return StorePage(
      title: session.isStudent ? 'My Assignments' : 'Assignments',
      actions: [
        if (session.canAny(const ['assignments.create', 'assignments.grade']))
          _portalAction(context, 'assignments', 'Assignments', tooltip: 'Create and grade'),
      ],
      builder: (context, store) {
        final submissions = store.list('assignmentSubmissions');
        final list = store.list('assignments').where((a) {
          return !session.isStudent || a['classId'] == session.user['classId'];
        }).toList()
          ..sort((a, b) => str(b['dueDate']).compareTo(str(a['dueDate'])));
        if (list.isEmpty) return const [EmptyState(icon: Icons.assignment_outlined, title: 'No assignments yet')];
        return [
          for (final a in list)
            Builder(builder: (context) {
              final subs = submissions.where((s) => s['assignmentId'] == a['id']).toList();
              final mine = session.isStudent ? subs.where((s) => s['studentId'] == session.userId).firstOrNull : null;
              final overdue = str(a['dueDate']).compareTo(today()) < 0;
              String status;
              if (session.isStudent) {
                status = mine == null ? (overdue ? 'MISSING' : 'DUE') : (mine['isGraded'] == true ? 'GRADED' : 'SUBMITTED');
              } else {
                status = '${subs.where((s) => s['isGraded'] == true).length}/${subs.length} graded';
              }
              return Card(
                child: ListTile(
                  onTap: () => _details(context, store, session, a, mine),
                  title: Text(str(a['title']), style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text([
                    courseName(store, a['courseId']),
                    if (!session.isStudent) className(store, a['classId']),
                    'Due ${prettyDate(a['dueDate'])}',
                    if (mine != null && mine['isGraded'] == true) '${str(mine['marksObtained'])}/${str(a['maxMarks'])}',
                  ].where((t) => t.isNotEmpty).join(' • ')),
                  trailing: StatusChip(status, color: session.isStudent ? null : StatusChip.colorFor('')),
                ),
              );
            }),
        ];
      },
    );
  }
}

// =============================================================================
// Exams & results
// =============================================================================

class ExamsScreen extends StatelessWidget {
  const ExamsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return StorePage(
      title: session.isStudent ? 'Exams & Results' : 'Exams',
      actions: [
        _portalAction(context, 'exams', 'Exams',
            tooltip: session.isStudent ? 'Sit an online paper' : 'Papers, marking and results'),
      ],
      builder: (context, store) {
        final results = store.list('examResults');
        final exams = store.list('exams').where((e) {
          return !session.isStudent || e['classId'] == session.user['classId'];
        }).toList()
          ..sort((a, b) => str(b['examDate']).compareTo(str(a['examDate'])));
        if (exams.isEmpty) return const [EmptyState(icon: Icons.workspace_premium_outlined, title: 'No exams yet')];
        return [
          for (final e in exams)
            Builder(builder: (context) {
              final forExam = results.where((r) => r['examId'] == e['id']).toList();
              // A student sees a result only once it has been published
              final mine = session.isStudent
                  ? forExam.where((r) => r['studentId'] == session.userId && r['published'] == true).firstOrNull
                  : null;
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(
                            child: Text(str(e['title']),
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
                        StatusChip(str(e['status'], 'SCHEDULED')),
                      ]),
                      const SizedBox(height: 4),
                      Text(
                        [
                          courseName(store, e['courseId']),
                          if (!session.isStudent) className(store, e['classId']),
                          str(e['examType']).replaceAll('_', ' '),
                          prettyDate(e['examDate']),
                          prettyTime(e['startTime']),
                        ].where((t) => t.isNotEmpty).join(' • '),
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                      if (mine != null) ...[
                        const Divider(height: 20),
                        Row(children: [
                          Expanded(
                            child: Text(
                              '${str(mine['marksObtained'])} / ${str(mine['totalMarks'])}  (${str(mine['percentage'])}%)',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                          StatusChip(mine['passed'] == true ? 'PASSED' : 'FAILED'),
                        ]),
                        if (str(mine['urduGrade'], str(mine['wifaqGrade'])).isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(str(mine['urduGrade'], str(mine['wifaqGrade']))),
                          ),
                        if (str(mine['examinerRemarks']).isNotEmpty)
                          Padding(padding: const EdgeInsets.only(top: 4), child: Text(str(mine['examinerRemarks']))),
                      ] else if (!session.isStudent && forExam.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                              '${forExam.length} result${forExam.length == 1 ? '' : 's'} • ${e['resultsPublished'] == true ? 'published' : 'not published'}'),
                        ),
                    ],
                  ),
                ),
              );
            }),
        ];
      },
    );
  }
}

// =============================================================================
// Fees
// =============================================================================

class FeesScreen extends StatefulWidget {
  const FeesScreen({super.key});

  @override
  State<FeesScreen> createState() => _FeesScreenState();
}

class _FeesScreenState extends State<FeesScreen> {
  String _filter = 'ALL';

  void _details(BuildContext context, Record c) {
    const parts = {
      'tuitionFee': 'Tuition',
      'hostelMessFee': 'Hostel & mess',
      'examFee': 'Exam',
      'registrationFee': 'Registration',
      'admissionFee': 'Admission',
      'otherFee': 'Other',
    };
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text(str(c['challanNumber'], 'Challan'),
                      style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                ),
                StatusChip(str(c['status'], 'UNPAID')),
              ]),
              const SizedBox(height: 10),
              InfoRow('Student', '${str(c['studentName'])} ${str(c['rollNo']).isEmpty ? '' : '(${c['rollNo']})'}'.trim()),
              InfoRow('For', str(c['billingMonth'])),
              InfoRow('Due', prettyDate(c['dueDate'])),
              const Divider(height: 24),
              for (final e in parts.entries)
                if (numOf(c[e.key]) > 0)
                  InfoRow(e.key == 'otherFee' ? str(c['otherLabel'], e.value) : e.value, money(c[e.key])),
              if (numOf(c['scholarshipWaiver']) > 0) InfoRow('Scholarship', '- ${money(c['scholarshipWaiver'])}'),
              InfoRow('Net payable', money(c['netPayable'])),
              if (str(c['paidAt']).isNotEmpty) InfoRow('Paid on', prettyDate(c['paidAt'])),
              InfoRow('Bank reference', str(c['bankRef'])),
              InfoRow('Note', str(c['rejectionNote'])),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _openPortal(context, 'fees', 'Fees & Payments');
                  },
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('Open in the portal'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return StorePage(
      title: session.isStudent ? 'My Fees & Payments' : 'Fees & Payments',
      actions: [_portalAction(context, 'fees', 'Fees & Payments', tooltip: 'Challans, proofs and verification')],
      builder: (context, store) {
        final all = store.list('feeChallans').where((c) {
          return !session.isStudent || c['studentId'] == session.userId;
        }).toList()
          ..sort((a, b) => str(b['dueDate']).compareTo(str(a['dueDate'])));
        bool paid(Record c) => c['status'] == 'PAID';
        final due = all.where((c) => !paid(c)).fold<num>(0, (sum, c) => sum + numOf(c['netPayable']));
        final shown = all.where((c) => _filter == 'ALL' || (_filter == 'PAID' ? paid(c) : !paid(c))).toList();
        return [
          TileGrid(aspect: 1.9, children: [
            StatTile(icon: Icons.account_balance_wallet_rounded, value: money(due), label: 'Outstanding', color: Colors.orange),
            StatTile(
                icon: Icons.receipt_long_rounded,
                value: '${all.where(paid).length}/${all.length}',
                label: 'Challans paid',
                color: Colors.green),
          ]),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'ALL', label: Text('All')),
              ButtonSegment(value: 'DUE', label: Text('Not paid')),
              ButtonSegment(value: 'PAID', label: Text('Paid')),
            ],
            selected: {_filter},
            onSelectionChanged: (s) => setState(() => _filter = s.first),
          ),
          const SizedBox(height: 8),
          if (shown.isEmpty)
            const EmptyState(icon: Icons.receipt_long_outlined, title: 'No challans here')
          else
            for (final c in shown.take(200))
              Card(
                child: ListTile(
                  onTap: () => _details(context, c),
                  title: Text(session.isStudent ? str(c['billingMonth'], str(c['challanNumber'])) : str(c['studentName']),
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text([
                    if (!session.isStudent) str(c['billingMonth']),
                    money(c['netPayable']),
                    'Due ${prettyDate(c['dueDate'])}',
                  ].where((t) => t.isNotEmpty).join(' • ')),
                  trailing: StatusChip(str(c['status'], 'UNPAID')),
                ),
              ),
        ];
      },
    );
  }
}

// =============================================================================
// Notifications
// =============================================================================

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<Notices>().load());
  }

  @override
  Widget build(BuildContext context) {
    final notices = context.watch<Notices>();
    final session = context.watch<Session>();
    final scheme = Theme.of(context).colorScheme;
    final canSend = session.canAny(const [
      'notifications.broadcast_all',
      'notifications.broadcast_role',
      'notifications.send_class',
      'notifications.send_individual',
    ]);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (notices.unread > 0)
            IconButton(
                tooltip: 'Mark all as read', icon: const Icon(Icons.done_all_rounded), onPressed: notices.markAllRead),
          if (canSend) _portalAction(context, 'notifications', 'Broadcasts & Alerts', tooltip: 'Send a notice'),
        ],
      ),
      body: !notices.loaded
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: notices.load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  if (notices.error != null) StoreErrorBanner(message: notices.error!),
                  if (notices.items.isEmpty && notices.error == null)
                    const EmptyState(icon: Icons.notifications_none_rounded, title: 'No notifications'),
                  for (final n in notices.items)
                    Card(
                      color: n['isRead'] == true ? null : scheme.primaryContainer.withValues(alpha: 0.45),
                      child: ListTile(
                        onTap: () => notices.markRead(n),
                        leading: Icon(
                          n['isRead'] == true ? Icons.notifications_none_rounded : Icons.notifications_active_rounded,
                          color: n['isRead'] == true ? scheme.outline : scheme.primary,
                        ),
                        title: Text(str(n['title']),
                            style: TextStyle(fontWeight: n['isRead'] == true ? FontWeight.w500 : FontWeight.w700)),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 2),
                            Text(str(n['message'])),
                            const SizedBox(height: 4),
                            Text('${str(n['sender'])} • ${str(n['time'])}',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
