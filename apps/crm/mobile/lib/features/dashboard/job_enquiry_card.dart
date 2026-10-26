import 'package:flutter/material.dart';

import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../../core/api/crm_mobile_api.dart';
import '../../core/platform/mobile_actions.dart';
import 'dashboard_list_page.dart';
import 'job_duration.dart';
import 'work_timestamp_format.dart';
import 'job_detail_page.dart';

class JobEnquiryCard extends StatefulWidget {
  const JobEnquiryCard({
    required this.api,
    required this.session,
    required this.enquiry,
    required this.job,
    required this.onJobChanged,
    this.capturePosition,
    this.onJobUpdated,
    this.closurePending = false,
    this.collectionPending = false,
    this.onClosurePendingChanged,
    this.loadJobSessions,
    super.key,
  });

  final CrmMobileApi api;
  final UserSession session;
  final DashboardListItem enquiry;
  final CrmJob job;
  final VoidCallback onJobChanged;
  final Future<Position> Function()? capturePosition;
  final ValueChanged<CrmJob>? onJobUpdated;
  final bool closurePending;
  final bool collectionPending;
  final ValueChanged<bool>? onClosurePendingChanged;
  final Future<List<CrmJobExecution>> Function(String sourceId)?
  loadJobSessions;

  @override
  State<JobEnquiryCard> createState() => _JobEnquiryCardState();
}

class _JobEnquiryCardState extends State<JobEnquiryCard> {
  late CrmJob _job = widget.job;
  Timer? _jobTimer;
  var _isSending = false;
  var _completionPending = false;
  var _loadingJobSessions = false;

  @override
  void initState() {
    super.initState();
    _syncJobTimer();
    if (!_job.hasJobSummary &&
        _job.jobs.isEmpty &&
        widget.loadJobSessions != null) {
      _loadingJobSessions = true;
      _loadJobSessions();
    }
  }

  Future<void> _loadJobSessions() async {
    final load = widget.loadJobSessions;
    if (load == null) return;
    try {
      final sessions = await load(_job.sourceId);
      if (!mounted || sessions.isEmpty) return;
      setState(() {
        _job = _job.withJobs(sessions);
        _syncJobTimer();
      });
    } on CrmMobileApiException {
      // The list stays usable when the optional timer lookup is unavailable.
    } finally {
      if (mounted) setState(() => _loadingJobSessions = false);
    }
  }

  @override
  void didUpdateWidget(covariant JobEnquiryCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.job != widget.job) {
      _job = widget.job;
      _syncJobTimer();
    }
  }

  @override
  void dispose() {
    _jobTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final enquiry = DashboardListItem.fromCrmJob(_job);
    final runningJob = _runningJob;
    final isRunning = runningJob != null;
    final isNew = !isRunning && _job.status.trim().toLowerCase() == 'new';
    final isCompletionPending = _completionPending || widget.closurePending;
    final messageStyle = Theme.of(context).textTheme.titleSmall
        ?.copyWith(fontWeight: FontWeight.w800, height: 1.2);
    final messageLineHeight = MediaQuery.textScalerOf(context)
        .scale(messageStyle?.fontSize ?? 14);
    return Card(
      margin: EdgeInsets.zero,
      color: isCompletionPending
          ? const Color(0xFFFFF7ED)
          : widget.collectionPending
          ? const Color(0xFFFBF6FE)
          : isRunning
          ? const Color(0xFFFBF6FE)
          : isNew
          ? const Color(0xFFF1F8FF)
          : Colors.white,
      elevation: 2,
      shadowColor: const Color(0x24140D1B),
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isCompletionPending
              ? const Color(0xFFF59E0B)
              : widget.collectionPending
              ? const Color(0xFFB67AD2)
              : isRunning
              ? const Color(0xFFB67AD2)
              : isNew
              ? const Color(0xFF8CCAF0)
              : const Color(0xFFE1DCE6),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: isNew && !widget.collectionPending
            ? (_isSending ? null : _openNewCall)
            : () => _openDetail(context, enquiry),
        child: Container(
          key: const ValueKey('enquiry-card-highlight'),
          decoration:
              isRunning ||
                  isNew ||
                  isCompletionPending ||
                  widget.collectionPending
              ? BoxDecoration(
                  border: Border(
                    left: BorderSide(
                      color: isCompletionPending
                          ? const Color(0xFFF59E0B)
                          : widget.collectionPending
                          ? const Color(0xFF8B3BA8)
                          : isRunning
                          ? const Color(0xFF8B3BA8)
                          : const Color(0xFF1596D2),
                      width: 4,
                    ),
                  ),
                  borderRadius: BorderRadius.circular(12),
                )
              : null,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 11, 10, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  key: const ValueKey('enquiry-card-header'),
                  width: double.infinity,
                  child: _JobCardHeader(
                    enquiry: enquiry,
                    onCall: () => _runContactAction('Call', MobileActions.call),
                    onWhatsApp: _openWhatsApp,
                    onMore: _runMoreAction,
                    runningJob: _runningJob,
                    isSending: _isSending || _loadingJobSessions,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  _customerDisplayName(enquiry),
                  key: const ValueKey('enquiry-card-customer'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: const Color(0xFF6E6872)),
                ),
                const SizedBox(height: 5),
                ConstrainedBox(
                  key: const ValueKey('enquiry-card-message-area'),
                  constraints: BoxConstraints(
                    minHeight: messageLineHeight * 2.4,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (isCompletionPending) ...[
                        const _CompletionPendingBadge(),
                        const SizedBox(height: 5),
                      ],
                      if (widget.collectionPending) ...[
                        const _CollectionPendingBadge(),
                        const SizedBox(height: 5),
                      ],
                      if (isNew &&
                          !isCompletionPending &&
                          !widget.collectionPending)
                        Align(
                          alignment: Alignment.centerLeft,
                          child: OutlinedButton.icon(
                            key: const ValueKey('enquiry-card-new-call'),
                            onPressed: _isSending ? null : _openNewCall,
                            icon: const Icon(
                              Icons.notifications_active_outlined,
                              size: 16,
                            ),
                            label: const Text('New call'),
                            style: OutlinedButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                              minimumSize: const Size(0, 32),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              foregroundColor: const Color(0xFF374151),
                              side: const BorderSide(color: Color(0xFFD1D5DB)),
                              shape: const StadiumBorder(),
                              textStyle: const TextStyle(fontSize: 12),
                            ),
                          ),
                        )
                      else
                        LayoutBuilder(
                          builder: (context, constraints) => SizedBox(
                            width: double.infinity,
                            child: Text(
                              _mobileMessageText(
                                enquiry.title,
                                constraints.maxWidth,
                              ),
                              key: const ValueKey('enquiry-card-message'),
                              maxLines: 2,
                              softWrap: true,
                              textWidthBasis: TextWidthBasis.parent,
                              overflow: TextOverflow.ellipsis,
                              style: messageStyle,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Created by - ${_creatorDisplayName(enquiry.createdBy)} · ${enquiry.createdDate} | ${enquiry.createdAgo}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF6D6870),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    if (runningJob != null) ...[
                      const SizedBox(width: 8),
                      _RunningClockBadge(execution: runningJob),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _mobileMessageText(String value, double availableWidth) {
    final message = value.trim();
    if (availableWidth > 420 ||
        message.length <= 35 ||
        message.contains('\n')) {
      return message;
    }
    final splitAt = message.lastIndexOf(' ', 38);
    if (splitAt < 24) return message;
    return '${message.substring(0, splitAt).trimRight()}\n'
        '${message.substring(splitAt + 1).trimLeft()}';
  }

  CrmJobExecution? get _runningJob =>
      _job.jobs.where((execution) => execution.isRunning).firstOrNull;

  Future<void> _openNewCall() async {
    await _performCardAction(() async {
      _job = await widget.api.openNewCall(
        accessToken: widget.session.accessToken,
        id: _job.sourceId,
      );
      widget.onJobUpdated?.call(_job);
      widget.onJobChanged();
      _showMessage('New call opened successfully.');
    });
  }

  void _syncJobTimer() {
    if (_runningJob == null) {
      _jobTimer?.cancel();
      _jobTimer = null;
      return;
    }
    _jobTimer ??= Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _toggleJob() async {
    final running = _runningJob;
    await _performCardAction(() async {
      _job = running == null
          ? await widget.api.startJob(
              accessToken: widget.session.accessToken,
              id: _job.sourceId,
            )
          : await widget.api.stopJob(
              accessToken: widget.session.accessToken,
              id: _job.sourceId,
              jobName: running.name,
            );
      _syncJobTimer();
      widget.onJobUpdated?.call(_job);
      widget.onJobChanged();
      _showMessage(running == null ? 'Job started.' : 'Job stopped.');
    });
  }

  Future<void> _markCompleted() async {
    if (_completionPending) {
      _showMessage('Completion is already waiting for approval.');
      return;
    }
    await _performCardAction(() async {
      await widget.api.requestClosure(
        accessToken: widget.session.accessToken,
        id: _job.sourceId,
      );
      if (!mounted) return;
      _setCompletionPending(true);
      widget.onJobChanged();
      _showMessage('Completion request sent for approval.');
    });
  }

  void _setCompletionPending(bool pending) {
    if (!mounted) return;
    setState(() => _completionPending = pending);
    widget.onClosurePendingChanged?.call(pending);
  }

  Future<void> _performCardAction(Future<void> Function() action) async {
    setState(() => _isSending = true);
    try {
      await action();
    } on CrmMobileApiException catch (error) {
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _openDetail(
    BuildContext context,
    DashboardListItem enquiry,
  ) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => JobDetailPage(
          api: widget.api,
          session: widget.session,
          enquiry: enquiry,
          initialJob: _job,
          onJobChanged: widget.onJobChanged,
          onJobUpdated: widget.onJobUpdated,
          onClosurePendingChanged: _setCompletionPending,
        ),
      ),
    );
    if (!mounted) return;
    try {
      final refreshed = await widget.api.job(
        widget.session.accessToken,
        _job.sourceId,
      );
      if (mounted) {
        setState(() => _job = refreshed);
        widget.onJobUpdated?.call(refreshed);
        widget.onJobChanged();
      }
    } on CrmMobileApiException {
      // The next list refresh will retry if the connection was interrupted.
    }
  }

  Future<void> _runContactAction(
    String action,
    Future<bool> Function(String mobile) launch,
  ) async {
    if (_job.mobile.trim().isEmpty) {
      _showUnavailable('$action number');
      return;
    }
    if (!await launch(_job.mobile)) _showUnavailable(action);
  }

  Future<void> _openWhatsApp() async {
    if (_job.mobile.trim().isEmpty) {
      _showUnavailable('WhatsApp number');
      return;
    }
    final opened = await MobileActions.whatsApp(_job.mobile);
    if (!opened) _showUnavailable('WhatsApp');
  }

  Future<void> _runMoreAction(_JobMoreAction action) async {
    switch (action) {
      case _JobMoreAction.pinLocation:
        await _pinLocation();
      case _JobMoreAction.toggleJob:
        await _toggleJob();
      case _JobMoreAction.markCompleted:
        await _markCompleted();
    }
  }

  Future<Position> _captureCurrentPosition() async {
    if (widget.capturePosition != null) return widget.capturePosition!();
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const CrmMobileApiException('Turn on device location.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw const CrmMobileApiException(
        'Allow location access to pin the current location.',
      );
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 20),
      ),
    );
  }

  Future<void> _pinLocation() async {
    await _performCardAction(() async {
      final position = await _captureCurrentPosition();
      if (!mounted) return;
      var details = _locationComment(position);
      final comment = await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Pin location'),
          content: SizedBox(
            width: 480,
            child: TextFormField(
              key: const ValueKey('pinned-location-details'),
              initialValue: details,
              autofocus: true,
              minLines: 5,
              maxLines: 8,
              onChanged: (value) => details = value,
              decoration: const InputDecoration(
                labelText: 'Location details',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              key: const ValueKey('submit-pinned-location'),
              onPressed: () => Navigator.pop(dialogContext, details.trim()),
              child: const Text('Submit'),
            ),
          ],
        ),
      );
      if (comment == null || comment.isEmpty) return;
      _job = await widget.api.addJobComment(
        accessToken: widget.session.accessToken,
        id: _job.sourceId,
        comment: comment,
      );
      widget.onJobChanged();
      widget.onJobUpdated?.call(_job);
      _showMessage('Pinned location saved in comments.');
    });
  }

  String _locationComment(Position position) {
    final timestamp = formatWorkDateTime(position.timestamp);
    return 'Pinned location\n'
        'Latitude: ${position.latitude.toStringAsFixed(6)}\n'
        'Longitude: ${position.longitude.toStringAsFixed(6)}\n'
        'Accuracy: ±${position.accuracy.round()} m\n'
        'Captured @ $timestamp\n'
        'Customer: ${_job.customer}\n'
        'Enquiry: ${_job.title}';
  }

  void _showUnavailable(String action) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$action is not available on this device.')),
    );
  }
}

class _CompletionPendingBadge extends StatelessWidget {
  const _CompletionPendingBadge();

  @override
  Widget build(BuildContext context) => Container(
    key: const ValueKey('enquiry-card-completion-pending'),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF7ED),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFF59E0B)),
    ),
    child: const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.notifications_active_outlined,
          size: 16,
          color: Color(0xFFB45309),
        ),
        SizedBox(width: 6),
        Text(
          'Mark Completed',
          style: TextStyle(
            color: Color(0xFF92400E),
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _CollectionPendingBadge extends StatelessWidget {
  const _CollectionPendingBadge();

  @override
  Widget build(BuildContext context) => Container(
    key: const ValueKey('enquiry-card-collection-pending'),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0xFFF5EAFB),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFB67AD2)),
    ),
    child: const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.payments_outlined, size: 16, color: Color(0xFF7B2FA0)),
        SizedBox(width: 6),
        Text(
          'Collection pending',
          style: TextStyle(
            color: Color(0xFF682A82),
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _JobCardHeader extends StatelessWidget {
  const _JobCardHeader({
    required this.enquiry,
    required this.onCall,
    required this.onWhatsApp,
    required this.onMore,
    required this.runningJob,
    required this.isSending,
  });

  final DashboardListItem enquiry;
  final VoidCallback onCall;
  final VoidCallback onWhatsApp;
  final ValueChanged<_JobMoreAction> onMore;
  final CrmJobExecution? runningJob;
  final bool isSending;

  @override
  Widget build(BuildContext context) {
    final statusColors = _statusColors(_statusLabel(enquiry));
    return Row(
      children: [
        Expanded(
          child: Row(
            children: [
              Container(
                key: ValueKey(
                  'status-badge-${_statusLabel(enquiry).toLowerCase().replaceAll(' ', '-')}',
                ),
                padding: const EdgeInsets.fromLTRB(7, 5, 9, 5),
                decoration: BoxDecoration(
                  color: statusColors.background,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.adjust_rounded,
                      size: 15,
                      color: statusColors.text,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '#${enquiry.enquiryNumber}  ${_statusLabel(enquiry)}',
                      style: TextStyle(
                        color: statusColors.text,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                fit: FlexFit.loose,
                child: Text(
                  enquiry.list.toUpperCase(),
                  key: const ValueKey('enquiry-list-name'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ),
              const SizedBox(width: 5),
              Tooltip(
                message: 'Priority: ${_priorityLabel(enquiry.priority)}',
                child: Container(
                  key: ValueKey('priority-dot-${enquiry.priority.name}'),
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: _priorityColor(enquiry.priority),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 3),
        SizedBox(
          width: 36,
          height: 36,
          child: IconButton(
            key: const ValueKey('enquiry-card-call'),
            tooltip: 'Call customer',
            visualDensity: VisualDensity.compact,
            constraints: const BoxConstraints.tightFor(width: 36, height: 36),
            padding: EdgeInsets.zero,
            onPressed: onCall,
            icon: const Icon(Icons.call_rounded, size: 20),
          ),
        ),
        const SizedBox(width: 6),
        SizedBox(
          width: 36,
          height: 36,
          child: IconButton(
            key: const ValueKey('enquiry-card-whatsapp'),
            tooltip: 'WhatsApp customer',
            visualDensity: VisualDensity.compact,
            constraints: const BoxConstraints.tightFor(width: 36, height: 36),
            padding: EdgeInsets.zero,
            onPressed: onWhatsApp,
            icon: const _WhatsAppMark(),
          ),
        ),
        const SizedBox(width: 6),
        SizedBox(
          width: 36,
          height: 36,
          child: PopupMenuButton<_JobMoreAction>(
            key: const ValueKey('enquiry-card-more'),
            tooltip: 'More job actions',
            padding: EdgeInsets.zero,
            position: PopupMenuPosition.under,
            onSelected: onMore,
            itemBuilder: (context) => _JobMoreAction.values
                .where(
                  (action) =>
                      action != _JobMoreAction.markCompleted || !isSending,
                )
                .map(
                  (action) => PopupMenuItem(
                    enabled: !isSending,
                    value: action,
                    child: Row(
                      children: [
                        Icon(action.icon, size: 19),
                        const SizedBox(width: 10),
                        Text(action.label(runningJob != null)),
                        if (action == _JobMoreAction.toggleJob &&
                            runningJob != null) ...[
                          const SizedBox(width: 18),
                          _RunningTimerBadge(execution: runningJob!),
                        ],
                      ],
                    ),
                  ),
                )
                .toList(),
            child: Container(
              key: const ValueKey('enquiry-card-more-button'),
              height: 36,
              width: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFF1DDF5),
                shape: BoxShape.circle,
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x28000000),
                    blurRadius: 5,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: const Icon(Icons.add_rounded, color: Color(0xFF682A82)),
            ),
          ),
        ),
      ],
    );
  }
}

String _creatorDisplayName(String value) {
  final creator = value.trim();
  final localPart = creator.split('@').first;
  return localPart
      .split(RegExp(r'[._-]+'))
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

String _customerDisplayName(DashboardListItem enquiry) {
  final customer = enquiry.customer.trim();
  final mobile = enquiry.mobile.trim();
  final hasCustomerName =
      customer.isNotEmpty &&
      customer.toLowerCase() != 'customer' &&
      !RegExp(r'^\+?[\d\s().-]+$').hasMatch(customer);
  if (hasCustomerName) return customer;
  if (mobile.isNotEmpty) return mobile;
  return customer.toLowerCase() == 'customer' || customer.isEmpty
      ? '—'
      : customer;
}

class _StatusBadgeColors {
  const _StatusBadgeColors(this.background, this.text);

  final Color background;
  final Color text;
}

_StatusBadgeColors _statusColors(String label) {
  final code = label.trim().toLowerCase().replaceAll(RegExp(r'[ _]+'), '-');
  return switch (code) {
    'new' ||
    'reopen' => const _StatusBadgeColors(Color(0xFF2563EB), Colors.white),
    'open' || 'contacted' => const _StatusBadgeColors(
      Color(0xFF0EA5E9),
      Color(0xFF020617),
    ),
    'won' || 'qualified' => const _StatusBadgeColors(
      Color(0xFF10B981),
      Color(0xFF020617),
    ),
    'lost' => const _StatusBadgeColors(Color(0xFFDC2626), Colors.white),
    'hold-for-approval' || 'hold-for-job-out' => const _StatusBadgeColors(
      Color(0xFFF59E0B),
      Color(0xFF020617),
    ),
    'long-hold' => const _StatusBadgeColors(Color(0xFF7C3AED), Colors.white),
    'hold-for-spares' => const _StatusBadgeColors(
      Color(0xFFF97316),
      Color(0xFF020617),
    ),
    'escalation' => const _StatusBadgeColors(Color(0xFFE11D48), Colors.white),
    'unqualified' ||
    'closed' => const _StatusBadgeColors(Color(0xFF475569), Colors.white),
    _ => const _StatusBadgeColors(Color(0xFF475569), Colors.white),
  };
}

Color _priorityColor(JobPriority priority) => switch (priority) {
  JobPriority.low => const Color(0xFF0EA5E9),
  JobPriority.normal => const Color(0xFF14B8A6),
  JobPriority.high => const Color(0xFFF97316),
  JobPriority.urgent => const Color(0xFFF43F5E),
};

String _priorityLabel(JobPriority priority) => switch (priority) {
  JobPriority.low => 'Low',
  JobPriority.normal => 'Normal',
  JobPriority.high => 'High',
  JobPriority.urgent => 'Urgent',
};

class _WhatsAppMark extends StatelessWidget {
  const _WhatsAppMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 26,
      width: 26,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: Color(0xFF25D366),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Color(0x2625D366),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: const Icon(Icons.phone_rounded, color: Colors.white, size: 16),
    );
  }
}

enum _JobMoreAction {
  toggleJob(Icons.play_arrow_rounded),
  markCompleted(Icons.check_circle_outline_rounded),
  pinLocation(Icons.location_on_outlined);

  const _JobMoreAction(this.icon);

  final IconData icon;

  String label(bool isRunning) => switch (this) {
    pinLocation => 'Pin location',
    toggleJob => isRunning ? 'Stop Job' : 'Start Job',
    markCompleted => 'Mark Completed',
  };
}

class _RunningTimerBadge extends StatefulWidget {
  const _RunningTimerBadge({required this.execution});

  final CrmJobExecution execution;

  @override
  State<_RunningTimerBadge> createState() => _RunningTimerBadgeState();
}

class _RunningClockBadge extends StatelessWidget {
  const _RunningClockBadge({required this.execution});

  final CrmJobExecution execution;

  @override
  Widget build(BuildContext context) => Container(
    key: const ValueKey('enquiry-card-running-clock'),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: const Color(0xFF682A82),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.timer_outlined, size: 13, color: Colors.white),
        const SizedBox(width: 4),
        Text(
          formatJobDurationClock(execution),
          style: Theme.of(context).textTheme.labelSmall
              ?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
        ),
      ],
    ),
  );
}

class _RunningTimerBadgeState extends State<_RunningTimerBadge> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Container(
    key: const ValueKey('enquiry-card-running-timer'),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: const Color(0xFFF1DDF5),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      formatJobDuration(widget.execution),
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: const Color(0xFF682A82),
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

String _statusLabel(DashboardListItem enquiry) {
  if (enquiry.statusName.trim().isNotEmpty) return enquiry.statusName;
  return switch (enquiry.status) {
    JobStatus.open => 'Open',
    JobStatus.won => 'Won',
    JobStatus.lost => 'Lost',
  };
}
