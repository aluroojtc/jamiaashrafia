import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/store.dart';

const Color brandTeal = Color(0xFF124855);
const Color brandTealDark = Color(0xFF0A333D);
const Color brandGold = Color(0xFFC0A264);

void showMessage(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? Theme.of(context).colorScheme.error : null,
      behavior: SnackBarBehavior.floating,
    ));
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.icon, required this.value, required this.label, this.color, this.onTap});

  final IconData icon;
  final String value;
  final String label;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tint = color ?? scheme.primary;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: tint, size: 26),
              const SizedBox(height: 10),
              Text(value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
              Text(label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Two tiles per row on phones, more on tablets
class TileGrid extends StatelessWidget {
  const TileGrid({super.key, required this.children, this.aspect = 1.35});

  final List<Widget> children;
  final double aspect;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return GridView.count(
      crossAxisCount: width >= 900 ? 4 : (width >= 600 ? 3 : 2),
      childAspectRatio: aspect,
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: children,
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.text, {super.key, this.color});

  final String text;
  final Color? color;

  /// Colours for the statuses LMS records carry
  static Color colorFor(String status) {
    switch (status.toUpperCase()) {
      case 'PRESENT':
      case 'PAID':
      case 'LIVE':
      case 'ACTIVE':
      case 'PASSED':
      case 'GRADED':
      case 'SUBMITTED':
      case 'OPEN':
        return const Color(0xFF1B7F4B);
      case 'ABSENT':
      case 'OVERDUE':
      case 'REJECTED':
      case 'FAILED':
      case 'MISSING':
        return const Color(0xFFB3261E);
      case 'LATE':
      case 'PENDING':
      case 'UNPAID':
      case 'UPCOMING':
      case 'PENDING_VERIFICATION':
      case 'DUE':
        return const Color(0xFFA15C00);
      default:
        return const Color(0xFF55606A);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = color ?? colorFor(text);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(text.replaceAll('_', ' '),
          style: TextStyle(color: c, fontSize: 11.5, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.text});

  final IconData icon;
  final String title;
  final String? text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48, color: scheme.outline),
          const SizedBox(height: 12),
          Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
          if (text != null) ...[
            const SizedBox(height: 6),
            Text(text!, textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
          ],
        ],
      ),
    );
  }
}

/// A page whose content comes from the record store: pull to refresh, a first-load spinner, and a banner
/// when the last refresh failed.
class StorePage extends StatelessWidget {
  const StorePage({super.key, required this.title, required this.builder, this.actions, this.floatingActionButton});

  final String title;
  final List<Widget> Function(BuildContext context, DataStore store) builder;
  final List<Widget>? actions;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    final store = context.watch<DataStore>();
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      floatingActionButton: floatingActionButton,
      body: !store.loaded && store.loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => store.refresh(),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  if (store.error != null) StoreErrorBanner(message: store.error!),
                  ...builder(context, store),
                ],
              ),
            ),
    );
  }
}

class StoreErrorBanner extends StatelessWidget {
  const StoreErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.errorContainer,
      child: ListTile(
        leading: Icon(Icons.cloud_off_rounded, color: scheme.onErrorContainer),
        title: Text(message, style: TextStyle(color: scheme.onErrorContainer)),
        subtitle: Text('Pull down to try again.', style: TextStyle(color: scheme.onErrorContainer)),
      ),
    );
  }
}

class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    if (value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
