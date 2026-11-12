import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/format.dart';
import '../core/modules.dart';
import '../core/notices.dart';
import '../core/session.dart';
import '../core/store.dart';
import '../meeting/meeting_service.dart';
import '../widgets/common.dart';
import 'home_shell.dart';
import 'live_classes_screen.dart';

/// The home tab: the dashboard of the person's portal. Which one is shown follows the role's data scope
/// the server reports (whole institution: office staff and the Super Admin; classes they teach: teachers;
/// own records: students).
class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final store = context.watch<DataStore>();
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([store.refresh(), context.read<Notices>().load(), session.refresh().catchError((_) {})]);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _Header(session: session)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
              sliver: SliverList.list(children: [
                if (store.error != null) StoreErrorBanner(message: store.error!),
                if (!store.loaded && store.loading)
                  const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
                else
                  switch (session.portal) {
                    Portal.student => const StudentDashboard(),
                    Portal.teacher => const TeacherDashboard(),
                    Portal.staff => const AdminDashboard(),
                  },
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final portalName = switch (session.portal) {
      Portal.student => 'Talib-e-Ilm Portal',
      Portal.teacher => 'Faculty Workspace',
      Portal.staff => session.isSuperAdmin ? 'Super Admin' : 'Executive Control',
    };
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [brandTealDark, brandTeal], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 22),
          child: Row(children: [
            Image.asset('assets/crest.png', width: 54, height: 54),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(portalName.toUpperCase(),
                    style: const TextStyle(color: brandGold, fontSize: 11.5, fontWeight: FontWeight.w700, letterSpacing: 1)),
                const SizedBox(height: 2),
                Text(
                  '${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${session.name.split(' ').first}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text('${session.roleNames} • ${prettyDate(today())}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Pieces the dashboards share
// -----------------------------------------------------------------------------

/// Classes that are live now, each with its way in
class _LiveNow extends StatelessWidget {
  const _LiveNow({required this.classes});

  final List<Record> classes;

  @override
  Widget build(BuildContext context) {
    final meetings = context.watch<MeetingService>();
    if (classes.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionTitle('Live now'),
      for (final s in classes)
        Card(
          color: const Color(0xFFB3261E).withValues(alpha: 0.07),
          child: ListTile(
            leading: const Icon(Icons.sensors_rounded, color: Color(0xFFB3261E)),
            title: Text(str(s['title'], 'Online class'), style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text([str(s['className']), str(s['hostTeacher'])].where((t) => t.isNotEmpty).join(' • ')),
            trailing: FilledButton(
              onPressed: meetings.inMeeting
                  ? null
                  : () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => LiveClassesScreen(autoJoinId: s['id'].toString()))),
              child: Text(meetings.canHost(s) ? 'Enter' : 'Join'),
            ),
          ),
        ),
    ]);
  }
}

class _TodayPeriods extends StatelessWidget {
  const _TodayPeriods({required this.periods, required this.showClass, required this.emptyText});

  final List<Record> periods;
  final bool showClass;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    final store = context.watch<DataStore>();
    final now = nowHHMM();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle("Today's schedule",
          trailing: TextButton(onPressed: () => openRoute(context, 'timetable'), child: const Text('Timetable'))),
      if (periods.isEmpty)
        Card(child: ListTile(leading: const Icon(Icons.event_available_rounded), title: Text(emptyText)))
      else
        Card(
          child: Column(children: [
            for (final p in periods)
              ListTile(
                dense: true,
                selected: now.compareTo(str(p['startTime'])) >= 0 && now.compareTo(str(p['endTime'])) < 0,
                leading: SizedBox(
                  width: 70,
                  child: Text(prettyTime(p['startTime']), style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                title: Text(str(courseName(store, p['courseId']), str(p['periodName'], 'Period'))),
                subtitle: Text([
                  if (showClass) className(store, p['classId']) else userName(store, p['teacherId']),
                  'until ${prettyTime(p['endTime'])}',
                ].where((t) => t.isNotEmpty).join(' • ')),
              ),
          ]),
        ),
    ]);
  }
}

/// Shortcuts to the pages this person's role opens
class _Shortcuts extends StatelessWidget {
  const _Shortcuts({required this.routes});

  final List<String> routes;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final modules = routes.map(moduleFor).whereType<LmsModule>().where((m) => m.openFor(session)).toList();
    if (modules.isEmpty) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionTitle('Quick access'),
      TileGrid(aspect: 2.5, children: [
        for (final m in modules)
          Card(
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => openModule(context, m),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(children: [
                  Icon(m.icon, color: scheme.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(m.label(session.portal),
                        maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ]),
              ),
            ),
          ),
      ]),
    ]);
  }
}

List<Record> _todaysPeriods(DataStore store, bool Function(Record) where) {
  return store.list('timetables').where((p) => p['day'] == todayName() && where(p)).toList()
    ..sort((a, b) => str(a['startTime']).compareTo(str(b['startTime'])));
}

// -----------------------------------------------------------------------------
// Student
// -----------------------------------------------------------------------------

class StudentDashboard extends StatelessWidget {
  const StudentDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final store = context.watch<DataStore>();
    final unread = context.watch<Notices>().unread;
    final me = session.userId;
    final classId = session.user['classId'];

    final attendance = store.list('attendance').where((a) => a['userId'] == me).toList();
    final attended = attendance.where((a) => a['status'] == 'PRESENT' || a['status'] == 'LATE').length;
    final pct = attendance.isEmpty ? null : (attended * 100 / attendance.length).round();

    final submitted = store.list('assignmentSubmissions').where((s) => s['studentId'] == me).map((s) => s['assignmentId']).toSet();
    final pending = store
        .list('assignments')
        .where((a) => a['classId'] == classId && !submitted.contains(a['id']) && str(a['dueDate']).compareTo(today()) >= 0)
        .length;

    final unpaid = store.list('feeChallans').where((c) => c['studentId'] == me && c['status'] != 'PAID');
    final due = unpaid.fold<num>(0, (sum, c) => sum + numOf(c['netPayable']));

    final live = visibleClasses(store, session).where(isLive).toList();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (str(className(store, classId)).isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 12, 4, 0),
          child: Text('${className(store, classId)}${str(session.user['rollNo']).isEmpty ? '' : ' • ${session.user['rollNo']}'}',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ),
      _LiveNow(classes: live),
      const SectionTitle('My overview'),
      TileGrid(children: [
        if (session.canAny(const ['attendance.view', 'attendance.self_checkin']))
          StatTile(
              icon: Icons.fact_check_rounded,
              value: pct == null ? '—' : '$pct%',
              label: 'Attendance',
              onTap: () => openRoute(context, 'attendance')),
        if (session.can('assignments.view'))
          StatTile(
              icon: Icons.assignment_rounded,
              value: '$pending',
              label: 'Assignments to submit',
              color: pending > 0 ? Colors.orange : null,
              onTap: () => openRoute(context, 'assignments')),
        if (session.canAny(const ['fees.challans.view', 'fees.structures.view']))
          StatTile(
              icon: Icons.receipt_long_rounded,
              value: due > 0 ? money(due) : 'Clear',
              label: 'Fees outstanding',
              color: due > 0 ? Colors.red : Colors.green,
              onTap: () => openRoute(context, 'fees')),
        StatTile(
            icon: Icons.notifications_rounded,
            value: '$unread',
            label: 'Unread notices',
            onTap: () => openRoute(context, 'notifications')),
      ]),
      if (session.can('timetable.view'))
        _TodayPeriods(
          periods: _todaysPeriods(store, (p) => p['classId'] == classId),
          showClass: false,
          emptyText: 'No periods today',
        ),
      const _Shortcuts(routes: ['virtual-class', 'exams', 'class-recordings', 'classes', 'library', 'teachers']),
    ]);
  }
}

// -----------------------------------------------------------------------------
// Teacher
// -----------------------------------------------------------------------------

class TeacherDashboard extends StatelessWidget {
  const TeacherDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final store = context.watch<DataStore>();
    final meetings = context.watch<MeetingService>();
    final unread = context.watch<Notices>().unread;
    final me = session.userId;

    final myClasses = teacherClassIds(store, me);
    final students = store.list('users').where((u) => u['role'] == 'STUDENT' && myClasses.contains(u['classId'])).length;
    final myAssignments = store.list('assignments').where((a) => a['teacherId'] == me || myClasses.contains(a['classId'])).map((a) => a['id']).toSet();
    final toGrade = store.list('assignmentSubmissions').where((s) => myAssignments.contains(s['assignmentId']) && s['isGraded'] != true).length;

    final sessions = visibleClasses(store, session);
    final live = sessions.where(isLive).toList();
    final mineUpcoming = sessions.where((s) => !isLive(s) && s['status'] == 'UPCOMING' && meetings.canHost(s)).take(3).toList();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _LiveNow(classes: live),
      if (mineUpcoming.isNotEmpty) ...[
        const SectionTitle('Your next classes'),
        for (final s in mineUpcoming)
          Card(
            child: ListTile(
              leading: const Icon(Icons.schedule_rounded),
              title: Text(str(s['title'], 'Online class'), style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text([
                str(s['className']),
                prettyDate(str(s['scheduledStart'], str(s['date']))),
              ].where((t) => t.isNotEmpty).join(' • ')),
              trailing: OutlinedButton(
                onPressed: () => openRoute(context, 'virtual-class'),
                child: const Text('Open'),
              ),
            ),
          ),
      ],
      const SectionTitle('My teaching'),
      TileGrid(children: [
        StatTile(
            icon: Icons.menu_book_rounded,
            value: '${myClasses.length}',
            label: 'Classes I teach',
            onTap: () => openRoute(context, 'classes')),
        if (session.can('students.view'))
          StatTile(
              icon: Icons.groups_rounded,
              value: '$students',
              label: 'Students in my classes',
              onTap: () => openRoute(context, 'students')),
        if (session.can('assignments.view'))
          StatTile(
              icon: Icons.rate_review_rounded,
              value: '$toGrade',
              label: 'Submissions to check',
              color: toGrade > 0 ? Colors.orange : null,
              onTap: () => openRoute(context, 'assignments')),
        StatTile(
            icon: Icons.notifications_rounded,
            value: '$unread',
            label: 'Unread notices',
            onTap: () => openRoute(context, 'notifications')),
      ]),
      if (session.can('timetable.view'))
        _TodayPeriods(
          periods: _todaysPeriods(store, (p) => p['teacherId'] == me),
          showClass: true,
          emptyText: 'You have no periods today',
        ),
      const _Shortcuts(routes: ['attendance', 'exams', 'virtual-class', 'class-recordings', 'reports', 'library']),
    ]);
  }
}

// -----------------------------------------------------------------------------
// Office staff, administrators and the Super Admin
// -----------------------------------------------------------------------------

class AdminDashboard extends StatelessWidget {
  const AdminDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final store = context.watch<DataStore>();
    final unread = context.watch<Notices>().unread;

    final users = store.list('users');
    final students = users.where((u) => u['role'] == 'STUDENT').length;
    final teachers = users.where((u) => u['role'] == 'TEACHER').length;
    final live = visibleClasses(store, session).where(isLive).toList();
    final challans = store.list('feeChallans');
    final toVerify = challans.where((c) => c['status'] == 'PENDING_VERIFICATION').length;
    final outstanding = challans.where((c) => c['status'] != 'PAID').fold<num>(0, (sum, c) => sum + numOf(c['netPayable']));
    final presentToday = store
        .list('attendance')
        .where((a) => a['date'] == today() && a['role'] == 'STUDENT' && (a['status'] == 'PRESENT' || a['status'] == 'LATE'))
        .map((a) => a['userId'])
        .toSet()
        .length;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (session.isSuperAdmin)
        Card(
          margin: const EdgeInsets.only(top: 12),
          color: brandGold.withValues(alpha: 0.16),
          child: const ListTile(
            leading: Icon(Icons.workspace_premium_rounded, color: Color(0xFFAA8637)),
            title: Text('Super Admin', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text('Every page and every campus is open to you.'),
          ),
        ),
      _LiveNow(classes: live),
      const SectionTitle('Institution today'),
      TileGrid(children: [
        if (session.can('students.view'))
          StatTile(
              icon: Icons.groups_rounded,
              value: '$students',
              label: 'Students',
              onTap: () => openRoute(context, 'students')),
        if (session.can('teachers.view'))
          StatTile(
              icon: Icons.school_rounded,
              value: '$teachers',
              label: 'Teachers',
              onTap: () => openRoute(context, 'teachers')),
        if (session.can('classes.view'))
          StatTile(
              icon: Icons.menu_book_rounded,
              value: '${store.list('classes').length}',
              label: 'Classes',
              onTap: () => openRoute(context, 'classes')),
        if (session.can('attendance.view'))
          StatTile(
              icon: Icons.fact_check_rounded,
              value: '$presentToday',
              label: 'Students present today',
              color: Colors.green,
              onTap: () => openRoute(context, 'attendance')),
        if (session.can('virtual_classes.view'))
          StatTile(
              icon: Icons.sensors_rounded,
              value: '${live.length}',
              label: 'Classes live now',
              color: live.isNotEmpty ? Colors.red : null,
              onTap: () => openRoute(context, 'virtual-class')),
        if (session.can('fees.challans.view')) ...[
          StatTile(
              icon: Icons.account_balance_wallet_rounded,
              value: money(outstanding),
              label: 'Fees outstanding',
              color: Colors.orange,
              onTap: () => openRoute(context, 'fees')),
          StatTile(
              icon: Icons.verified_rounded,
              value: '$toVerify',
              label: 'Payments to verify',
              color: toVerify > 0 ? Colors.orange : null,
              onTap: () => openRoute(context, 'fees')),
        ],
        StatTile(
            icon: Icons.notifications_rounded,
            value: '$unread',
            label: 'Unread notices',
            onTap: () => openRoute(context, 'notifications')),
      ]),
      const _Shortcuts(routes: ['admissions', 'users', 'roles', 'reports', 'timetable', 'exams', 'setup', 'class-recordings']),
    ]);
  }
}
