import 'package:flutter/material.dart';

import '../../core/api/crm_mobile_api.dart';
import '../../core/platform/mobile_actions.dart';
import 'job_duration.dart';
import 'work_timestamp_format.dart';
import 'pin_location_text.dart';

class JobWorkFeed extends StatelessWidget {
  const JobWorkFeed({
    required this.job,
    required this.session,
    this.locations = const [],
    this.reports = const [],
    this.schedules = const [],
    this.selectedSection = 'comments',
    this.showSystemLogs = false,
    super.key,
  });

  final CrmJob job;
  final UserSession session;
  final List<CrmEnquiryLocation> locations;
  final List<Map<String, dynamic>> reports;
  final List<Map<String, dynamic>> schedules;
  final String selectedSection;
  final bool showSystemLogs;

  @override
  Widget build(BuildContext context) {
    final entries =
        _WorkFeedEntry.fromJob(job, session, locations, reports, schedules)
            .where(
              (entry) =>
                  entry.section == selectedSection &&
                  (showSystemLogs || !entry.isSystemLog),
            )
            .toList();
    if (entries.isEmpty) {
      return Center(child: Text(_emptySectionMessage(selectedSection)));
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 92),
      itemCount: entries.length,
      separatorBuilder: (context, index) =>
          const Divider(height: 1, indent: 44, color: Color(0xFFE5DFE7)),
      itemBuilder: (context, index) => _WorkFeedTile(entry: entries[index]),
    );
  }
}

class _WorkFeedEntry {
  const _WorkFeedEntry({
    required this.icon,
    this.title,
    required this.detail,
    required this.author,
    required this.createdAt,
    this.durationLabel,
    this.onTap,
    this.isSystemLog = false,
    required this.section,
  });

  final IconData icon;
  final String? title;
  final String detail;
  final String author;
  final DateTime createdAt;
  final String? durationLabel;
  final VoidCallback? onTap;
  final bool isSystemLog;
  final String section;

  static List<_WorkFeedEntry> fromJob(
    CrmJob job,
    UserSession session,
    List<CrmEnquiryLocation> locations,
    List<Map<String, dynamic>> reports,
    List<Map<String, dynamic>> schedules,
  ) {
    final entries = <_WorkFeedEntry>[
      ...reports.map((report) {
        final action = '${report['action'] ?? 'report'}'.toLowerCase();
        final section = switch (action) {
          'check-in' || 'check-out' => 'checkpoints',
          'charge' || 'collection' => 'charges',
          _ => 'actions',
        };
        return _WorkFeedEntry(
          icon: report['latitude'] == null && action != 'pin-location'
              ? Icons.task_alt
              : Icons.location_on_outlined,
          title: action == 'pin-location'
              ? 'Pin Location'
              : normalizeCrmText('${report['action']}').replaceAll('-', ' '),
          detail: [
            if (report['amount'] != null) 'Amount: ${report['amount']}',
            formatWorkTimestamps(normalizeCrmText('${report['body'] ?? ''}')),
            if (report['latitude'] != null)
              'GPS: ${report['latitude']}, ${report['longitude']} · ${report['accuracy_meters']} m',
          ].where((part) => part.isNotEmpty).join('\n'),
          author: _author('${report['created_by']}', session),
          createdAt: DateTime.parse('${report['created_at']}'),
          section: section,
          onTap: report['latitude'] == null
              ? null
              : () => MobileActions.location(
                  '${report['latitude']},${report['longitude']}',
                ),
        );
      }),
      ...job.comments.map(
        (comment) => _WorkFeedEntry(
          icon: Icons.chat_bubble_outline,
          title: null,
          detail: formatWorkTimestamps(comment.comment),
          author: _author(comment.createdByUserId, session),
          createdAt: comment.createdAt,
          isSystemLog: _isSystemWorkLog(comment.comment),
          section: 'comments',
        ),
      ),
      ...job.jobs.map(
        (execution) => _WorkFeedEntry(
          icon: execution.isRunning
              ? Icons.timer_outlined
              : Icons.assignment_turned_in_outlined,
          title: '${execution.name} · ${execution.status}',
          detail:
              '${execution.employee} · ${_jobTime(execution.startTime)}–${_jobTime(execution.stopTime)}',
          author: execution.employee,
          createdAt: execution.createdAt,
          durationLabel: formatJobDuration(execution),
          section: 'jobs',
        ),
      ),
      ...locations
          .where(
            (location) => !reports.any(
              (report) =>
                  report['action'] == 'pin-location' &&
                  '${report['body']}'.contains(
                    'q=${location.latitude.toStringAsFixed(7)},${location.longitude.toStringAsFixed(7)}',
                  ) &&
                  '${report['body']}'.contains(
                    location.capturedAt
                        .toUtc()
                        .toIso8601String()
                        .split('.')
                        .first,
                  ),
            ),
          )
          .map(
            (location) => _WorkFeedEntry(
              icon: Icons.location_on_outlined,
              title: 'Location logged',
              detail:
                  '${location.latitude.toStringAsFixed(6)}, ${location.longitude.toStringAsFixed(6)}'
                  '${location.accuracyMeters == null ? '' : ' · ±${location.accuracyMeters!.round()} m'}',
              author: _author(location.createdBy, session),
              createdAt: location.capturedAt,
              section: 'actions',
              onTap: () => MobileActions.location(
                '${location.latitude},${location.longitude}',
              ),
            ),
          ),
      ...job.activities
          .where(
            (activity) =>
                activity.action != 'pin-location' ||
                !reports.any(
                  (report) =>
                      report['action'] == 'pin-location' &&
                      '${report['body']}' == activity.details,
                ),
          )
          .map(
            (activity) => _WorkFeedEntry(
              icon: Icons.bolt_outlined,
              title: normalizeCrmText(activity.action),
              detail: normalizeCrmText(activity.details),
              author: _author(activity.createdBy, session),
              createdAt: activity.createdAt,
              section: 'actions',
            ),
          ),
      ...schedules.map((schedule) {
        final scheduledAt = DateTime.tryParse(
          '${schedule['scheduledAt'] ?? ''}',
        )?.toLocal();
        return _WorkFeedEntry(
          icon: Icons.calendar_month_outlined,
          title: normalizeCrmText(
            '${schedule['notes'] ?? 'Scheduled follow-up'}',
          ),
          detail: [
            if (scheduledAt != null)
              'Scheduled ${_scheduleDateTime(scheduledAt)}',
            if ('${schedule['status'] ?? ''}'.isNotEmpty)
              normalizeCrmText('${schedule['status']}'),
          ].where((part) => part.isNotEmpty).join(' · '),
          author: _author('${schedule['createdBy'] ?? ''}', session),
          createdAt:
              DateTime.tryParse('${schedule['createdAt'] ?? ''}') ??
              DateTime.now(),
          section: 'schedules',
        );
      }),
    ]..sort((left, right) => right.createdAt.compareTo(left.createdAt));
    return entries;
  }
}

bool _isSystemWorkLog(String value) => RegExp(
  r'^(?:Job started by\b|Job\s+#\S+\s+stopped\.?$)',
  caseSensitive: false,
).hasMatch(value.trim());

String _emptySectionMessage(String section) => switch (section) {
  'comments' => 'No comments yet.',
  'actions' => 'No actions recorded yet.',
  'checkpoints' => 'No check in or out records yet.',
  'jobs' => 'No jobs recorded yet.',
  'charges' => 'No charges recorded yet.',
  'schedules' => 'No schedules yet.',
  _ => 'No records found.',
};

class _WorkFeedTile extends StatelessWidget {
  const _WorkFeedTile({required this.entry});

  final _WorkFeedEntry entry;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 17,
            backgroundColor: const Color(0xFFF0E2FA),
            foregroundColor: const Color(0xFF662C90),
            child: Icon(entry.icon, size: 17),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (entry.title != null)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          entry.title!,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      if (entry.onTap != null) ...[
                        const SizedBox(width: 4),
                        const Icon(
                          Icons.open_in_new,
                          size: 14,
                          color: Color(0xFF662C90),
                        ),
                      ],
                      if (entry.durationLabel case final duration?) ...[
                        const SizedBox(width: 8),
                        _DurationBadge(label: duration),
                      ],
                    ],
                  ),
                if (entry.title != null) const SizedBox(height: 3),
                PinLocationText(entry.detail),
                const SizedBox(height: 5),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    '${entry.author} · ${_relativeTime(entry.createdAt)}',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (entry.onTap != null) {
      return InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: entry.onTap,
        child: content,
      );
    }
    return content;
  }
}

class _DurationBadge extends StatelessWidget {
  const _DurationBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFE7D3F7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFB77BDD)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        child: Text(
          label,
          style: const TextStyle(
            color: Color(0xFF582177),
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

String _author(String value, UserSession session) {
  if (value.toLowerCase() == session.profile.email.toLowerCase()) {
    return session.profile.name;
  }
  final localPart = value.split('@').first.replaceAll(RegExp(r'[._-]+'), ' ');
  return localPart
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

String _jobTime(String? value) {
  if (value == null || value.isEmpty) return 'Running';
  return value.length >= 8 ? value.substring(0, 8) : value;
}

String _scheduleDateTime(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  return '$day/$month/${value.year} $hour:$minute';
}

String _relativeTime(DateTime value) {
  final difference = DateTime.now().difference(value.toLocal());
  if (difference.inDays > 0) {
    final hours = difference.inHours.remainder(24);
    return hours == 0
        ? '${difference.inDays}d'
        : '${difference.inDays}d ${hours}h';
  }
  if (difference.inHours > 0) {
    final minutes = difference.inMinutes.remainder(60);
    return minutes == 0
        ? '${difference.inHours}h'
        : '${difference.inHours}h ${minutes}m';
  }
  if (difference.inMinutes > 0) return '${difference.inMinutes}m';
  return 'Now';
}
