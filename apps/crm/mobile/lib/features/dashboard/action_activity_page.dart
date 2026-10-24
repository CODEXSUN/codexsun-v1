import 'package:flutter/material.dart';

import '../../core/api/crm_mobile_api.dart';
import 'action_quick_action_sheet.dart';
import 'dashboard_list_page.dart';
import 'dashboard_jobs_feed.dart';
import 'job_detail_page.dart';

class ActionActivityPage extends StatefulWidget {
  const ActionActivityPage({
    required this.api,
    required this.session,
    this.jobsFeed,
    super.key,
  });

  final CrmMobileApi api;
  final UserSession session;
  final DashboardJobsFeed? jobsFeed;

  @override
  State<ActionActivityPage> createState() => _ActionActivityPageState();
}

class _ActionActivityPageState extends State<ActionActivityPage> {
  var _page = 1;
  var _days = 7;
  var _openingActions = false;
  int? _openingEnquiryId;
  late Future<CrmPage<CrmActivityRecord>> _activities = _loadActivities();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Activities'),
        actions: [
          PopupMenuButton<int>(
            key: const ValueKey('activity-window-menu'),
            tooltip: 'Activity period',
            initialValue: _days,
            onSelected: _setWindow,
            itemBuilder: (context) => const [
              PopupMenuItem(value: 7, child: Text('Last 7 days')),
              PopupMenuItem(value: 30, child: Text('Last 30 days')),
            ],
            icon: const Icon(Icons.calendar_month_outlined),
          ),
          IconButton(
            tooltip: 'Refresh activities',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      floatingActionButton: _EmbossedActionButton(
        onPressed: _openingActions ? null : _openQuickActions,
      ),
      body: FutureBuilder<CrmPage<CrmActivityRecord>>(
        future: _activities,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Could not load live activities.'),
                  const SizedBox(height: 8),
                  FilledButton.tonalIcon(
                    onPressed: _reload,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Retry'),
                  ),
                ],
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final page = snapshot.data!;
          final actions = page.items.map(_LiveAction.fromRecord).toList();
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
              itemCount: actions.isEmpty ? 3 : actions.length + 3,
              separatorBuilder: (context, index) =>
                  SizedBox(height: index == 0 ? 14 : 8),
              itemBuilder: (context, index) {
                if (index == 0) return _ActionHeader(days: _days);
                if (index == 1)
                  return _ActionSummary(count: page.total, days: _days);
                if (actions.isEmpty && index == 2) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: Text('No activities in this period.')),
                  );
                }
                if (index == actions.length + 2) {
                  return _ActivityPager(
                    page: page,
                    onPrevious: () => _setPage(_page - 1),
                    onNext: () => _setPage(_page + 1),
                  );
                }
                final action = actions[index - 2];
                return _ActionCard(
                  action: action,
                  busy: _openingEnquiryId == action.enquiryId,
                  onTap: () => _openEnquiry(action.enquiryId),
                );
              },
            ),
          );
        },
      ),
    );
  }

  void _setPage(int page) => setState(() {
    _page = page;
    _activities = _loadActivities();
  });

  void _setWindow(int days) => setState(() {
    _days = days.clamp(7, 30).toInt();
    _page = 1;
    _activities = _loadActivities();
  });

  Future<CrmPage<CrmActivityRecord>> _loadActivities() =>
      widget.api.activitiesPage(
        accessToken: widget.session.accessToken,
        page: _page,
        createdAfter: DateTime.now().subtract(Duration(days: _days)).toUtc(),
      );

  Future<void> _refresh() async {
    final activities = _loadActivities();
    setState(() => _activities = activities);
    try {
      await activities;
    } catch (_) {
      // FutureBuilder renders the retry state for the failed request.
    }
  }

  void _reload() => setState(() => _activities = _loadActivities());

  Future<void> _openEnquiry(int enquiryId) async {
    if (enquiryId <= 0 || _openingEnquiryId != null) return;
    setState(() => _openingEnquiryId = enquiryId);
    try {
      final job = await widget.api.job(
        widget.session.accessToken,
        '$enquiryId',
      );
      if (!mounted) return;
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => JobDetailPage(
            api: widget.api,
            session: widget.session,
            enquiry: DashboardListItem.fromCrmJob(job),
            initialJob: job,
            onJobChanged: _reload,
            onJobUpdated: widget.jobsFeed?.updateJob,
          ),
        ),
      );
      if (mounted) _reload();
    } on CrmMobileApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(content: Text('Could not open activity actions.')),
          );
      }
    } finally {
      if (mounted) setState(() => _openingEnquiryId = null);
    }
  }

  Future<void> _openQuickActions() async {
    setState(() => _openingActions = true);
    try {
      final jobs = await widget.api.assignedJobs(widget.session.accessToken);
      if (!mounted) return;
      final changed = await showActionQuickActionSheet(
        context: context,
        api: widget.api,
        session: widget.session,
        jobs: jobs,
        onEnquiryUpdated: widget.jobsFeed?.updateJob,
        loadJobSessions:
            widget.jobsFeed?.jobSessions ??
            ((sourceId) => widget.api.enquiryJobSessions(
              accessToken: widget.session.accessToken,
              enquiryId: sourceId,
            )),
      );
      if (changed && mounted) {
        setState(() => _activities = _loadActivities());
      }
    } on CrmMobileApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _openingActions = false);
    }
  }
}

class _EmbossedActionButton extends StatelessWidget {
  const _EmbossedActionButton({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Color(0x33702A86),
            blurRadius: 8,
            offset: Offset(0, 4),
          ),
          BoxShadow(
            color: Color(0xCCFFFFFF),
            blurRadius: 3,
            offset: Offset(-2, -2),
          ),
        ],
      ),
      child: FloatingActionButton(
        tooltip: 'Add action or check in',
        onPressed: onPressed,
        elevation: 0,
        backgroundColor: const Color(0xFFF1DDF5),
        foregroundColor: const Color(0xFF682A82),
        child: const Icon(Icons.add_rounded, size: 30),
      ),
    );
  }
}

class _ActionHeader extends StatelessWidget {
  const _ActionHeader({required this.days});

  final int days;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Activities', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 3),
        Text(
          'Activity from the last $days days.',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: const Color(0xFF665E6C)),
        ),
        const SizedBox(height: 3),
        Text(
          '“Completed work at a glance.”',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: const Color(0xFF837B88),
            fontStyle: FontStyle.italic,
          ),
        ),
      ],
    );
  }
}

class _ActionSummary extends StatelessWidget {
  const _ActionSummary({required this.count, required this.days});

  final int count;
  final int days;

  @override
  Widget build(BuildContext context) {
    final summary = '$count actions performed in the last $days days.';
    return Text(
      summary,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: const Color(0xFF665E6C),
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.action,
    required this.onTap,
    this.busy = false,
  });

  final _LiveAction action;
  final VoidCallback onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      elevation: 1,
      shadowColor: const Color(0x160F0B14),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: busy ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
          child: Row(
            children: [
              const CircleAvatar(
                radius: 19,
                backgroundColor: Color(0xFFF0E2FA),
                foregroundColor: Color(0xFF662C90),
                child: Icon(Icons.bolt, size: 19),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      action.title,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      action.detail,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    action.time,
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  const SizedBox(height: 5),
                  const Icon(
                    Icons.check_circle,
                    color: Color(0xFF3C9975),
                    size: 16,
                  ),
                ],
              ),
              const SizedBox(width: 3),
              if (busy)
                const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                const Icon(Icons.chevron_right, color: Color(0xFF81788A)),
            ],
          ),
        ),
      ),
    );
  }
}

class _LiveAction {
  const _LiveAction({
    required this.enquiryId,
    required this.title,
    required this.detail,
    required this.time,
    required this.createdAt,
  });
  final int enquiryId;
  final String title;
  final String detail;
  final String time;
  final DateTime createdAt;

  factory _LiveAction.fromRecord(CrmActivityRecord record) => _LiveAction(
    enquiryId: record.enquiryId,
    title: '${record.action} · #${record.enquiryNumber}',
    detail: '${record.contact} · ${record.details}',
    time: _relativeTime(record.createdAt),
    createdAt: record.createdAt,
  );
}

class _ActivityPager extends StatelessWidget {
  const _ActivityPager({
    required this.page,
    required this.onPrevious,
    required this.onNext,
  });

  final CrmPage<CrmActivityRecord> page;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    if (page.total <= page.pageSize) return const SizedBox.shrink();
    return Row(
      children: [
        Text('${page.total} actions · Page ${page.page} of ${page.pageCount}'),
        const Spacer(),
        IconButton(
          tooltip: 'Previous page',
          onPressed: page.hasPrevious ? onPrevious : null,
          icon: const Icon(Icons.chevron_left),
        ),
        IconButton(
          tooltip: 'Next page',
          onPressed: page.hasNext ? onNext : null,
          icon: const Icon(Icons.chevron_right),
        ),
      ],
    );
  }
}

String _relativeTime(DateTime value) {
  final elapsed = DateTime.now().difference(value.toLocal());
  if (elapsed.inDays > 0) return '${elapsed.inDays}d ago';
  if (elapsed.inHours > 0) return '${elapsed.inHours}h ago';
  return '${elapsed.inMinutes.clamp(1, 59)}m ago';
}
