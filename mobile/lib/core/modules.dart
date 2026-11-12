import 'package:flutter/material.dart';

import 'session.dart';

/// One page of the LMS. The list and the permissions that open each page mirror the web portal
/// (APP_NAV in js/app.js and MODULE_ACCESS in js/auth-rbac.js), so the app and the portal never disagree
/// about who sees what.
class LmsModule {
  const LmsModule(this.route, this.icon, this.staff, {this.teacher, this.student, this.needs = const [], this.native = false});

  /// The portal's route name (`index.html#ROUTE`)
  final String route;
  final IconData icon;
  final String staff;
  final String? teacher;
  final String? student;

  /// The page opens when the person holds any of these (empty: every signed-in user)
  final List<String> needs;

  /// Has its own screen in the app; the others open the portal's page inside the app
  final bool native;

  String label(Portal portal) => switch (portal) {
        Portal.staff => staff,
        Portal.teacher => teacher ?? staff,
        Portal.student => student ?? teacher ?? staff,
      };

  bool openFor(Session s) => s.isSuperAdmin || needs.isEmpty || s.canAny(needs);
}

class ModuleGroup {
  const ModuleGroup(this.staff, this.teacher, this.student, this.modules);

  final String staff;
  final String teacher;
  final String student;
  final List<LmsModule> modules;

  String title(Portal portal) => switch (portal) {
        Portal.staff => staff,
        Portal.teacher => teacher,
        Portal.student => student,
      };
}

const List<ModuleGroup> moduleGroups = [
  ModuleGroup('Academic & Attendance', 'Lessons & Exams', 'Classes & Work', [
    LmsModule('virtual-class', Icons.videocam_rounded, 'Online Classes', needs: ['virtual_classes.view'], native: true),
    LmsModule('timetable', Icons.calendar_month_rounded, 'Schedules & Timetable',
        teacher: 'Class Schedule', student: 'My Timetable', needs: ['timetable.view'], native: true),
    LmsModule('attendance', Icons.fact_check_rounded, 'Attendance Monitoring',
        teacher: 'Attendance', student: 'My Attendance', needs: ['attendance.view', 'attendance.self_checkin'], native: true),
    LmsModule('assignments', Icons.assignment_rounded, 'Assignments & Checking',
        teacher: 'Assignments & Grading', student: 'My Assignments', needs: ['assignments.view'], native: true),
    LmsModule('exams', Icons.workspace_premium_rounded, 'Exams & Wifaq Sanad',
        teacher: 'Exams & Marking', student: 'Exams & Results', needs: ['exams.view'], native: true),
    LmsModule('class-recordings', Icons.movie_rounded, 'Class Recordings', needs: ['recordings.view']),
  ]),
  ModuleGroup('Students & Faculty', 'Teaching & Students', 'My Academics', [
    LmsModule('students', Icons.groups_rounded, 'Students', teacher: 'My Students Roster', needs: ['students.view']),
    LmsModule('student-types', Icons.badge_rounded, 'Student Types & Permissions', needs: ['students.assign_group']),
    LmsModule('admissions', Icons.person_add_alt_1_rounded, 'Student Admissions', needs: ['admissions.view']),
    LmsModule('classes', Icons.menu_book_rounded, 'Classes & Curriculum',
        teacher: 'My Classes & Courses', student: 'My Classes & Courses', needs: ['classes.view']),
    LmsModule('teachers', Icons.school_rounded, 'Teachers',
        teacher: 'Faculty & My Profile', student: 'Faculty', needs: ['teachers.view']),
    LmsModule('teacher-types', Icons.manage_accounts_rounded, 'Teacher Types & Permissions', needs: ['teachers.assign_group']),
  ]),
  ModuleGroup('Reports & Finances', 'Resources & Notices', 'Resources & Alerts', [
    LmsModule('fees', Icons.receipt_long_rounded, 'Fees & Payments',
        student: 'My Fees & Payments', needs: ['fees.challans.view', 'fees.structures.view'], native: true),
    LmsModule('reports', Icons.insights_rounded, 'Executive Reports', teacher: 'Teacher Reports', student: 'Reports', needs: [
      'reports.academic',
      'reports.attendance',
      'reports.finance',
      'reports.admissions',
      'reports.library',
    ]),
    LmsModule('library', Icons.local_library_rounded, 'Maktaba Ashrafia', needs: ['library.catalog.view']),
    LmsModule('notifications', Icons.campaign_rounded, 'Broadcasts & Alerts',
        teacher: 'Notifications', student: 'Notifications', native: true),
  ]),
  ModuleGroup('Administration', 'Administration', 'Administration', [
    LmsModule('users', Icons.admin_panel_settings_rounded, 'Users', needs: ['users.view']),
    LmsModule('roles', Icons.verified_user_rounded, 'Roles & Permissions', needs: ['roles.view']),
    LmsModule('setup', Icons.tune_rounded, 'Institution Setup', needs: ['setup.view']),
    LmsModule('heritage', Icons.account_balance_rounded, 'Institutional Heritage', needs: ['heritage.view']),
    LmsModule('security', Icons.shield_rounded, 'Architecture & RBAC', needs: ['settings.architecture']),
  ]),
];

LmsModule? moduleFor(String route) {
  for (final g in moduleGroups) {
    for (final m in g.modules) {
      if (m.route == route) return m;
    }
  }
  return null;
}
