import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../core/format.dart';
import '../core/modules.dart';
import '../core/notices.dart';
import '../core/session.dart';
import '../core/store.dart';
import '../widgets/common.dart';
import 'auth_screens.dart';
import 'dashboards.dart';
import 'live_classes_screen.dart';
import 'module_screens.dart';
import 'portal_web_screen.dart';

/// Opens a page of the LMS: its own screen where the app has one, otherwise the portal's page inside the app.
/// Asked again here, although the menu only lists pages the person may open.
void openModule(BuildContext context, LmsModule module) {
  final session = context.read<Session>();
  if (!module.openFor(session)) {
    showMessage(context, 'This page is not part of your role.', error: true);
    return;
  }
  final title = module.label(session.portal);
  final Widget screen = !module.native
      ? PortalWebScreen(route: module.route, title: title)
      : switch (module.route) {
          'virtual-class' => const LiveClassesScreen(),
          'timetable' => const TimetableScreen(),
          'attendance' => const AttendanceScreen(),
          'assignments' => const AssignmentsScreen(),
          'exams' => const ExamsScreen(),
          'fees' => const FeesScreen(),
          'notifications' => const NotificationsScreen(),
          _ => PortalWebScreen(route: module.route, title: title),
        };
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
}

void openRoute(BuildContext context, String route) {
  final module = moduleFor(route);
  if (module != null) openModule(context, module);
}

/// The signed-in app: the dashboard of the person's role, online classes, notifications and the menu
/// of every page their role opens.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<Notices>().load());
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final unread = context.watch<Notices>().unread;
    final hasClasses = session.can('virtual_classes.view');

    final pages = <Widget>[
      const DashboardPage(),
      if (hasClasses) const LiveClassesScreen(),
      const NotificationsScreen(),
      const MenuPage(),
    ];
    final destinations = <NavigationDestination>[
      const NavigationDestination(
          icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
      if (hasClasses)
        const NavigationDestination(
            icon: Icon(Icons.videocam_outlined), selectedIcon: Icon(Icons.videocam_rounded), label: 'Classes'),
      NavigationDestination(
        icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_outlined)),
        selectedIcon: const Icon(Icons.notifications_rounded),
        label: 'Notices',
      ),
      const NavigationDestination(icon: Icon(Icons.apps_outlined), selectedIcon: Icon(Icons.apps_rounded), label: 'Menu'),
    ];
    final index = _tab.clamp(0, pages.length - 1);

    return Scaffold(
      body: Column(children: [
        if (session.preview != null) const _PreviewBanner(),
        Expanded(child: IndexedStack(index: index, children: pages)),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: destinations,
      ),
    );
  }
}

/// A Super Admin who started "preview as a role" on the portal sees that role here too, read-only
class _PreviewBanner extends StatelessWidget {
  const _PreviewBanner();

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return Material(
      color: const Color(0xFF7C2D12),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Row(children: [
            const Icon(Icons.visibility_rounded, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text('Previewing ${session.roleNames}. Read-only: nothing is saved.',
                  style: const TextStyle(color: Colors.white, fontSize: 13)),
            ),
            TextButton(
              onPressed: () async {
                final store = context.read<DataStore>();
                try {
                  await session.api.delete('/api/preview');
                  await session.refresh();
                  await store.refresh(full: true);
                } catch (_) {
                  if (context.mounted) showMessage(context, 'The preview could not be left. Try again.', error: true);
                }
              },
              child: const Text('Leave', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Every page the person's role opens, grouped as on the portal's sidebar, plus their account
class MenuPage extends StatelessWidget {
  const MenuPage({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Menu')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
        children: [
          Card(
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              leading: CircleAvatar(
                radius: 24,
                backgroundColor: scheme.primary,
                foregroundColor: scheme.onPrimary,
                child: Text(initials(session.name), style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              title: Text(session.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              subtitle: Text(session.roleNames),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProfileScreen())),
            ),
          ),
          for (final group in moduleGroups)
            if (group.modules.any((m) => m.openFor(session))) ...[
              SectionTitle(group.title(session.portal)),
              Card(
                child: Column(children: [
                  for (final m in group.modules.where((m) => m.openFor(session)))
                    ListTile(
                      leading: Icon(m.icon, color: scheme.primary),
                      title: Text(m.label(session.portal)),
                      trailing: Icon(m.native ? Icons.chevron_right_rounded : Icons.open_in_new_rounded,
                          size: m.native ? 24 : 18, color: scheme.outline),
                      onTap: () => openModule(context, m),
                    ),
                ]),
              ),
            ],
          const SectionTitle('Portal'),
          Card(
            child: ListTile(
              leading: Icon(Icons.language_rounded, color: scheme.primary),
              title: const Text('Open the full web portal'),
              subtitle: Text(AppConfig.host),
              trailing: Icon(Icons.open_in_new_rounded, size: 18, color: scheme.outline),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const PortalWebScreen(route: 'dashboard', title: 'Jamia Ashrafia LMS'))),
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _signOut(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sign out')),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    context.read<Notices>().clear();
    await context.read<Session>().signOut();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final store = context.watch<DataStore>();
    final u = session.user;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('My account')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: scheme.primary,
                      foregroundColor: scheme.onPrimary,
                      child: Text(initials(session.name),
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(session.name,
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                        if (str(u['urduName']).isNotEmpty) Text(str(u['urduName']), textDirection: TextDirection.rtl),
                        const SizedBox(height: 4),
                        Wrap(spacing: 6, runSpacing: 4, children: [
                          if (session.isSuperAdmin) const StatusChip('Super Admin', color: Color(0xFFAA8637)),
                          for (final r in session.roles)
                            if (!session.isSuperAdmin) StatusChip(str(r['name']), color: scheme.primary),
                        ]),
                      ]),
                    ),
                  ]),
                  const Divider(height: 28),
                  InfoRow('Roll No', str(u['rollNo'])),
                  InfoRow('Username', str(u['username'])),
                  InfoRow('Email', str(u['email'])),
                  InfoRow('Phone', str(u['phone'])),
                  InfoRow('Class', className(store, u['classId'])),
                  InfoRow('Designation', str(u['designation'])),
                  InfoRow('Access', switch (session.portal) {
                    Portal.staff => session.isSuperAdmin ? 'Everything (Super Admin)' : 'Whole institution',
                    Portal.teacher => 'Classes you teach',
                    Portal.student => 'Your own records',
                  }),
                  InfoRow('Campuses', session.isSuperAdmin || session.allCampuses ? 'All campuses' : '${session.campusIds.length}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: Column(children: [
              ListTile(
                leading: const Icon(Icons.lock_reset_rounded),
                title: const Text('Change password'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () =>
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChangePasswordScreen())),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.privacy_tip_outlined),
                title: const Text('Privacy policy'),
                trailing: Icon(Icons.open_in_new_rounded, size: 18, color: scheme.outline),
                onTap: () => launchUrl(AppConfig.privacyPolicy, mode: LaunchMode.externalApplication),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(Icons.logout_rounded, color: scheme.error),
                title: Text('Sign out', style: TextStyle(color: scheme.error)),
                onTap: () => _signOut(context),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text('${AppConfig.appName} • ${AppConfig.host}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
          ),
        ],
      ),
    );
  }
}
