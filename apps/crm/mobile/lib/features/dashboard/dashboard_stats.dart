import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/crm_mobile_api.dart';
import 'tasks_page.dart';

class DashboardStats extends StatefulWidget {
  const DashboardStats({
    required this.api,
    required this.session,
    required this.jobCount,
    required this.onOpenList,
    this.assignmentCount = 0,
    super.key,
  });
  final CrmMobileApi api;
  final UserSession session;
  final int jobCount;
  final int assignmentCount;
  final ValueChanged<int> onOpenList;
  @override
  State<DashboardStats> createState() => _DashboardStatsState();
}

class _DashboardStatsState extends State<DashboardStats>
    with WidgetsBindingObserver {
  final Map<String, int> _counts = {};
  final Set<String> _errors = {};
  Timer? _timer;
  bool _loading = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
    _startPolling();
  }

  @override
  void didUpdateWidget(covariant DashboardStats oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.accessToken != widget.session.accessToken) {
      _counts.clear();
      _refresh();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startPolling();
      _refresh();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _startPolling() {
    _timer ??= Timer.periodic(const Duration(seconds: 20), (_) => _refresh());
  }

  Future<void> _refresh() async {
    if (_loading) return;
    _loading = true;
    final token = widget.session.accessToken;
    await Future.wait([
      _load('Tasks', () => widget.api.tasksCount(token), token),
      _loadDutyCount(token),
    ]);
    _loading = false;
  }

  Future<void> _loadDutyCount(String token) async {
    try {
      final count = await widget.api.dutiesCount(token);
      if (!mounted || token != widget.session.accessToken) return;
      setState(() {
        _counts['Duty'] = count;
        _errors.remove('Duty');
      });
    } catch (_) {
      if (mounted && token == widget.session.accessToken) {
        setState(() => _errors.add('Duty'));
      }
    }
  }

  Future<void> _load(
    String label,
    Future<int> Function() request,
    String token,
  ) async {
    try {
      final value = await request();
      if (!mounted || token != widget.session.accessToken) return;
      setState(() {
        _counts[label] = value;
        _errors.remove(label);
      });
    } catch (_) {
      if (mounted && token == widget.session.accessToken)
        setState(() => _errors.add(label));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  Widget _card(
    String label,
    IconData icon,
    VoidCallback open, {
    int? count,
    int badge = 0,
    String? caption,
  }) => _StatCard(
    icon: icon,
    label: label,
    value: count != null
        ? '$count'
        : _counts.containsKey(label)
        ? '${_counts[label]}'
        : _errors.contains(label)
        ? 'Unavailable'
        : '…',
    onTap: open,
    badgeCount: badge,
    caption: caption,
  );
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final width = (constraints.maxWidth - 24) / 3;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          _card(
            'Jobs',
            Icons.assignment_outlined,
            () => widget.onOpenList(1),
            count: widget.jobCount,
            badge: widget.assignmentCount,
          ),
          _card('Tasks', Icons.task_alt, () async {
            await Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) =>
                    TasksPage(api: widget.api, session: widget.session),
              ),
            );
            _refresh();
          }),
          _card(
            'Duty',
            Icons.calendar_month_outlined,
            () => widget.onOpenList(2),
          ),
        ].map((card) => SizedBox(width: width, child: card)).toList(),
      );
    },
  );
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
    this.badgeCount = 0,
    this.caption,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;
  final int badgeCount;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      button: true,
      label: 'Open $label list${caption == null ? '' : ', $caption'}',
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Ink(
          height: 96,
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE1DCE6)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1A140D1B),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 17, color: theme.colorScheme.primary),
                  const Spacer(),
                  if (badgeCount > 0) Badge.count(count: badgeCount),
                ],
              ),
              const Spacer(),
              Text(value, style: theme.textTheme.titleMedium),
              Text(label, style: theme.textTheme.labelMedium),
              if (caption != null)
                Text(
                  caption!,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
