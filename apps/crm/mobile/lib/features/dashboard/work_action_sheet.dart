import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/api/crm_mobile_api.dart';
import 'work_collection_dialog.dart';

Future<bool> showWorkActionSheet({
  required BuildContext context,
  required CrmMobileApi api,
  required UserSession session,
  List<CrmJob> enquiries = const [],
  int? taskId,
  String taskStatusId = '',
  String taskPhone = '',
  bool isJobRunning = false,
  DateTime? jobStartedAt,
  bool checkedIn = false,
  bool closurePending = false,
  bool closed = false,
  Future<Position> Function()? capturePosition,
  ValueChanged<CrmJob>? onEnquiryUpdated,
  Future<List<CrmJobExecution>> Function(String sourceId)? loadJobSessions,
  ValueChanged<bool>? onClosurePendingChanged,
  VoidCallback? onCollectionSaved,
}) async =>
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      isDismissible: true,
      enableDrag: true,
      useSafeArea: true,
      constraints: const BoxConstraints(maxWidth: 560),
      builder: (_) => WorkActionSheet(
        api: api,
        session: session,
        enquiries: enquiries,
        taskId: taskId,
        taskStatusId: taskStatusId,
        taskPhone: taskPhone,
        isJobRunning: isJobRunning,
        jobStartedAt: jobStartedAt,
        checkedIn: checkedIn,
        closurePending: closurePending,
        closed: closed,
        capturePosition: capturePosition,
        onEnquiryUpdated: onEnquiryUpdated,
        loadJobSessions: loadJobSessions,
        onClosurePendingChanged: onClosurePendingChanged,
        onCollectionSaved: onCollectionSaved,
      ),
    ) ??
    false;

class WorkActionSheet extends StatefulWidget {
  const WorkActionSheet({
    required this.api,
    required this.session,
    this.enquiries = const [],
    this.taskId,
    this.taskStatusId = '',
    this.taskPhone = '',
    this.isJobRunning = false,
    this.jobStartedAt,
    this.checkedIn = false,
    this.closurePending = false,
    this.closed = false,
    this.capturePosition,
    this.onEnquiryUpdated,
    this.loadJobSessions,
    this.onClosurePendingChanged,
    this.onCollectionSaved,
    super.key,
  });

  final CrmMobileApi api;
  final UserSession session;
  final List<CrmJob> enquiries;
  final int? taskId;
  final String taskStatusId;
  final String taskPhone;
  final bool isJobRunning;
  final DateTime? jobStartedAt;
  final bool checkedIn;
  final bool closurePending;
  final bool closed;
  final Future<Position> Function()? capturePosition;
  final ValueChanged<CrmJob>? onEnquiryUpdated;
  final Future<List<CrmJobExecution>> Function(String sourceId)?
  loadJobSessions;
  final ValueChanged<bool>? onClosurePendingChanged;
  final VoidCallback? onCollectionSaved;

  @override
  State<WorkActionSheet> createState() => _WorkActionSheetState();
}

class _WorkActionSheetState extends State<WorkActionSheet> {
  final _comment = TextEditingController();
  CrmJob? _enquiry;
  late bool _jobRunning;
  late bool _checkedIn = widget.checkedIn;
  late bool _closurePending = widget.closurePending;
  late final bool _closed = widget.closed;
  DateTime? _jobStartedAt;
  Timer? _timer;
  bool _busy = false;
  bool _loadingJobSessions = false;
  bool _changed = false;
  String? _error;
  Map<String, dynamic>? _retry;

  @override
  void initState() {
    super.initState();
    _enquiry = widget.enquiries.firstOrNull;
    _jobRunning =
        widget.isJobRunning ||
        (_enquiry?.jobs.any((job) => job.isRunning) ?? false);
    _jobStartedAt = widget.jobStartedAt ?? _runningEnquiryStart();
    _syncTimer();
    if (_enquiry != null && _enquiry!.jobs.isEmpty) {
      _loadingJobSessions = widget.loadJobSessions != null;
      unawaited(_loadSelectedJobSessions(_enquiry!));
    }
  }

  Future<void> _loadSelectedJobSessions(CrmJob selected) async {
    final load = widget.loadJobSessions;
    if (load == null) return;
    try {
      final sessions = await load(selected.sourceId);
      if (!mounted || _enquiry?.sourceId != selected.sourceId) return;
      setState(() {
        _enquiry = selected.withJobs(sessions);
        _jobRunning = sessions.any((job) => job.isRunning);
        _jobStartedAt = _runningEnquiryStart();
        _syncTimer();
      });
    } on CrmMobileApiException {
      // Action controls remain available if the optional timer lookup fails.
    } finally {
      if (mounted && _enquiry?.sourceId == selected.sourceId) {
        setState(() => _loadingJobSessions = false);
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _comment.dispose();
    super.dispose();
  }

  DateTime? _runningEnquiryStart() {
    final execution = _enquiry?.jobs.where((job) => job.isRunning).firstOrNull;
    if (execution == null) return null;
    final time = execution.startTime;
    final date = execution.date;
    if (time.contains('T')) return DateTime.tryParse(time)?.toLocal();
    final parsedDate = DateTime.tryParse(date ?? '');
    final match = RegExp(r'^(\d{1,2}):(\d{2})(?::(\d{2}))?').firstMatch(time);
    if (parsedDate == null || match == null)
      return execution.createdAt.toLocal();
    return DateTime(
      parsedDate.year,
      parsedDate.month,
      parsedDate.day,
      int.parse(match.group(1)!),
      int.parse(match.group(2)!),
      int.parse(match.group(3) ?? '0'),
    );
  }

  void _syncTimer() {
    if (!_jobRunning) {
      _timer?.cancel();
      _timer = null;
    } else {
      _jobStartedAt ??= DateTime.now();
      _timer ??= Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  Duration get _elapsed => _jobStartedAt == null
      ? Duration.zero
      : DateTime.now().difference(_jobStartedAt!);

  Future<Position> _position() async {
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
        'Allow location access to check in or out.',
      );
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 20),
      ),
    );
  }

  Future<bool> _run(
    Future<void> Function() operation, {
    bool closeOnSuccess = false,
  }) async {
    if (_busy) return false;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await operation();
      _changed = true;
      if (closeOnSuccess && mounted) Navigator.pop(context, true);
      return true;
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error is CrmMobileApiException
              ? error.message
              : '$error',
        );
      }
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _addComment() async {
    final body = _comment.text.trim();
    if (body.isEmpty) {
      setState(() => _error = 'Enter a comment.');
      return false;
    }
    return _run(() async {
      if (widget.taskId != null) {
        await widget.api.addTaskComment(
          widget.session.accessToken,
          widget.taskId!,
          body,
        );
      } else {
        await widget.api.addJobComment(
          accessToken: widget.session.accessToken,
          id: _enquiry!.sourceId,
          comment: body,
        );
      }
      _comment.clear();
    });
  }

  Future<void> _openCommentComposer() async {
    final body = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => const _CommentComposerSheet(),
    );
    if (!mounted || body == null || body.trim().isEmpty) return;
    _comment.text = body.trim();
    if (await _addComment() && mounted) {
      Navigator.pop(context, _changed);
    }
  }

  Future<void> _toggleJob() async {
    await _run(() async {
      if (_jobRunning) {
        if (widget.taskId != null) {
          await widget.api.stopTaskJob(
            widget.session.accessToken,
            widget.taskId!,
          );
        } else {
          final running = _enquiry!.jobs
              .where((job) => job.isRunning)
              .firstOrNull;
          if (running == null)
            throw const CrmMobileApiException('Running job was not found.');
          _enquiry = await widget.api.stopJob(
            accessToken: widget.session.accessToken,
            id: _enquiry!.sourceId,
            jobName: running.name,
          );
        }
        setState(() => _jobRunning = false);
      } else {
        if (widget.taskId != null) {
          await widget.api.startTaskJob(
            widget.session.accessToken,
            widget.taskId!,
          );
        } else {
          _enquiry = await widget.api.startJob(
            accessToken: widget.session.accessToken,
            id: _enquiry!.sourceId,
          );
        }
        setState(() {
          _jobRunning = true;
          _jobStartedAt = DateTime.now();
        });
      }
      _syncTimer();
      if (widget.taskId == null && _enquiry != null) {
        widget.onEnquiryUpdated?.call(_enquiry!);
      }
    }, closeOnSuccess: true);
  }

  Future<void> _toggleCheckIn() async {
    final action = _checkedIn ? 'check-out' : 'check-in';
    if (_retry?['action'] != action) _retry = null;
    if (_retry == null) {
      setState(() {
        _busy = true;
        _error = null;
      });
      try {
        final position = await _position();
        if (!mounted) return;
        _retry = {
          'enquiryId': widget.taskId == null ? _enquiry!.id : null,
          'taskId': widget.taskId,
          'action': action,
          'body': '',
          'amount': null,
          'requestId':
              'mobile-${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(0x7fffffff)}',
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracyMeters': position.accuracy,
          'capturedAt': position.timestamp.toUtc().toIso8601String(),
        };
      } catch (error) {
        if (mounted) {
          setState(
            () => _error = error is CrmMobileApiException
                ? error.message
                : '$error',
          );
        }
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }
    if (!mounted || _retry == null) return;

    final retry = _retry!;
    final body = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _CheckInComposerSheet(
        title: action == 'check-in' ? 'Check in' : 'Check out',
        latitude: retry['latitude'] as num,
        longitude: retry['longitude'] as num,
        accuracyMeters: retry['accuracyMeters'] as num,
        initialValue: '${retry['body'] ?? ''}',
      ),
    );
    if (!mounted || body == null) return;
    if (body != retry['body']) {
      retry['body'] = body;
      retry['requestId'] =
          'mobile-${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(0x7fffffff)}';
    }

    await _run(() async {
      await widget.api.sendWorkReport(widget.session.accessToken, _retry!);
      setState(() => _checkedIn = !_checkedIn);
      _retry = null;
    }, closeOnSuccess: true);
  }

  Future<void> _requestClosure() async {
    await _run(() async {
      if (widget.taskId != null) {
        await widget.api.requestTaskClosure(
          widget.session.accessToken,
          widget.taskId!,
          reason: 'Closure requested from mobile.',
        );
      } else {
        await widget.api.requestClosure(
          accessToken: widget.session.accessToken,
          id: _enquiry!.sourceId,
          note: '',
        );
      }
      setState(() => _closurePending = true);
      widget.onClosurePendingChanged?.call(true);
    }, closeOnSuccess: true);
  }

  Future<void> _openScheduleComposer() async {
    final draft = await showModalBottomSheet<_ScheduleDraft>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => const _ScheduleComposerSheet(),
    );
    if (!mounted || draft == null) return;
    await _run(
      () => widget.api.createSchedule(
        accessToken: widget.session.accessToken,
        notes: draft.notes,
        sourceType: widget.taskId == null ? 'enquiry' : 'task',
        sourceId: widget.taskId ?? _enquiry!.id,
        scheduledAt: draft.scheduledAt,
      ),
      closeOnSuccess: true,
    );
  }

  Future<void> _collectCharge() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final history = await widget.api.workCharges(
        widget.session.accessToken,
        enquiryId: widget.taskId == null ? _enquiry!.id : null,
        taskId: widget.taskId,
      );
      if (!mounted) return;
      final amounts = history['amounts'] as Map<String, dynamic>;
      final charged = _chargeAmount(amounts['charges']);
      final collected = _chargeAmount(amounts['collections']);
      final outstanding = max(0.0, charged - collected).toDouble();
      if (outstanding <= 0) {
        setState(() => _error = 'No charges are awaiting collection.');
        return;
      }
      setState(() => _busy = false);
      final saved = await showDialog<bool>(
        context: context,
        builder: (_) => WorkCollectionDialog(
          api: widget.api,
          session: widget.session,
          enquiryId: widget.taskId == null ? _enquiry!.id : null,
          taskId: widget.taskId,
          outstanding: outstanding,
        ),
      );
      if (saved == true && mounted) {
        widget.onCollectionSaved?.call();
        Navigator.pop(context, true);
      }
    } on CrmMobileApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted)
        setState(() => _error = 'Could not load charges. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openStageChooser() async {
    try {
      final options = await _loadStages();
      if (!mounted) return;
      if (options.isEmpty) {
        setState(() => _error = 'No stages are available.');
        return;
      }
      final current = options
          .where((option) => option.id == _currentStageId)
          .firstOrNull;
      final selected = await showModalBottomSheet<_StageOption>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (_) => _StageChooserSheet(options: options, current: current),
      );
      if (!mounted || selected == null) return;
      await _run(() async {
        if (widget.taskId != null) {
          final statusId = int.tryParse(selected.id);
          if (statusId == null) {
            throw const CrmMobileApiException('The selected stage is invalid.');
          }
          await widget.api.updateTaskProperties(
            accessToken: widget.session.accessToken,
            id: widget.taskId!,
            statusId: statusId,
          );
        } else {
          _enquiry = await widget.api.updateProperties(
            accessToken: widget.session.accessToken,
            id: _enquiry!.sourceId,
            statusId: selected.id,
          );
          widget.onEnquiryUpdated?.call(_enquiry!);
        }
      }, closeOnSuccess: true);
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error is CrmMobileApiException
              ? error.message
              : '$error',
        );
      }
    }
  }

  Future<List<_StageOption>> _loadStages() async {
    if (widget.taskId != null) {
      final response = await widget.api.taskOptions(widget.session.accessToken);
      return (response['statuses'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (status) => _StageOption(
              id: status['id']?.toString() ?? '',
              name: '${status['name'] ?? ''}'.trim(),
              code: '${status['code'] ?? ''}'.trim(),
            ),
          )
          .where(
            (option) =>
                option.id.isNotEmpty &&
                option.name.isNotEmpty &&
                !option.isExcluded,
          )
          .toList();
    }
    final formData = await widget.api.callEnquiryFormData(
      widget.session.accessToken,
    );
    return formData.statuses
        .map(
          (status) =>
              _StageOption(id: status.id, name: status.name, code: status.code),
        )
        .where(
          (option) =>
              option.id.isNotEmpty &&
              option.name.isNotEmpty &&
              !option.isExcluded,
        )
        .toList();
  }

  String get _currentStageId {
    if (widget.taskId != null) return widget.taskStatusId;
    return _enquiry?.statusId ?? '';
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          4,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 16,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * .84,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Actions', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 16),
                if (widget.enquiries.length > 1) ...[
                  DropdownButtonFormField<CrmJob>(
                    initialValue: _enquiry,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Enquiry'),
                    items: widget.enquiries
                        .map(
                          (job) => DropdownMenuItem(
                            value: job,
                            child: Text(
                              '#${job.number} · ${job.title}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: _busy
                        ? null
                        : (job) {
                            if (job == null) return;
                            setState(() {
                              _enquiry = job;
                              _loadingJobSessions =
                                  job.jobs.isEmpty &&
                                  widget.loadJobSessions != null;
                              _jobRunning = job.jobs.any(
                                (execution) => execution.isRunning,
                              );
                              _jobStartedAt = _runningEnquiryStart();
                              _syncTimer();
                            });
                            if (job.jobs.isEmpty) {
                              unawaited(_loadSelectedJobSessions(job));
                            }
                          },
                  ),
                  const SizedBox(height: 12),
                ],
                _WorkActionMenuItem(
                  key: const ValueKey('work-action-comment'),
                  icon: Icons.chat_bubble_outline,
                  title: 'Comment',
                  onTap: _busy ? null : _openCommentComposer,
                ),
                _WorkActionMenuItem(
                  icon: _checkedIn ? Icons.logout : Icons.login,
                  title: _checkedIn ? 'Check out' : 'Check in',
                  onTap: _busy || _closed ? null : _toggleCheckIn,
                ),
                _WorkActionMenuItem(
                  icon: _jobRunning ? Icons.stop : Icons.play_arrow,
                  title: _jobRunning ? 'Stop Job' : 'Start Job',
                  trailing: _jobRunning
                      ? _RunningTimerBadge(duration: _elapsed)
                      : null,
                  onTap: _busy || _loadingJobSessions || _closed
                      ? null
                      : _toggleJob,
                ),
                if (!_closed)
                  _WorkActionMenuItem(
                    icon: Icons.notifications_active_outlined,
                    title: _closurePending
                        ? 'Completion pending'
                        : 'Mark Complete',
                    onTap: _busy || _closurePending ? null : _requestClosure,
                  ),
                _WorkActionMenuItem(
                  key: const ValueKey('work-action-collect-charge'),
                  icon: Icons.payments_outlined,
                  title: 'Collect charge',
                  accent: true,
                  onTap: _busy || (widget.taskId == null && _enquiry == null)
                      ? null
                      : _collectCharge,
                ),
                _WorkActionMenuItem(
                  key: const ValueKey('work-action-schedule'),
                  icon: Icons.event_outlined,
                  title: 'Schedule',
                  onTap: _busy ? null : _openScheduleComposer,
                ),
                _WorkActionMenuItem(
                  key: const ValueKey('work-action-change-stage'),
                  icon: Icons.stacked_bar_chart_outlined,
                  title: 'Change Stage',
                  onTap: _busy ? null : _openStageChooser,
                ),
                if (_checkedIn) ...[
                  const SizedBox(height: 8),
                  const _ActionStatus(
                    icon: Icons.location_on_outlined,
                    text: 'Checked in',
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _WorkActionMenuItem extends StatelessWidget {
  const _WorkActionMenuItem({
    required this.icon,
    required this.title,
    this.trailing,
    this.accent = false,
    required this.onTap,
    super.key,
  });

  final IconData icon;
  final String title;
  final Widget? trailing;
  final bool accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: accent
        ? const EdgeInsets.symmetric(horizontal: 10)
        : EdgeInsets.zero,
    tileColor: accent ? const Color(0xFFF3E8FA) : null,
    shape: accent
        ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))
        : null,
    leading: Icon(
      icon,
      color: accent ? const Color(0xFF682A82) : const Color(0xFF5F5266),
    ),
    title: Text(
      title,
      style: accent
          ? const TextStyle(
              color: Color(0xFF682A82),
              fontWeight: FontWeight.w700,
            )
          : null,
    ),
    trailing: trailing,
    onTap: onTap,
  );
}

class _RunningTimerBadge extends StatelessWidget {
  const _RunningTimerBadge({required this.duration});

  final Duration duration;

  @override
  Widget build(BuildContext context) => Container(
    key: const ValueKey('work-action-running-timer'),
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0xFFF1E4F8),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.timer_outlined, size: 14),
        const SizedBox(width: 4),
        Text(_durationLabel(duration)),
      ],
    ),
  );
}

class _CommentComposerSheet extends StatefulWidget {
  const _CommentComposerSheet();

  @override
  State<_CommentComposerSheet> createState() => _CommentComposerSheetState();
}

class _CommentComposerSheetState extends State<_CommentComposerSheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      8,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 20,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Comment', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 14),
        TextField(
          key: const ValueKey('work-action-comment-input'),
          controller: _controller,
          autofocus: true,
          minLines: 4,
          maxLines: 7,
          onChanged: (_) => setState(() {}),
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            hintText: 'Write a comment…',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 14),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            key: const ValueKey('work-action-comment-submit'),
            onPressed: _controller.text.trim().isEmpty
                ? null
                : () => Navigator.of(context).pop(_controller.text.trim()),
            icon: const Icon(Icons.send_outlined),
            label: const Text('Submit'),
          ),
        ),
      ],
    ),
  );
}

class _ScheduleDraft {
  const _ScheduleDraft({required this.notes, required this.scheduledAt});

  final String notes;
  final DateTime scheduledAt;
}

class _ScheduleComposerSheet extends StatefulWidget {
  const _ScheduleComposerSheet();

  @override
  State<_ScheduleComposerSheet> createState() => _ScheduleComposerSheetState();
}

class _ScheduleComposerSheetState extends State<_ScheduleComposerSheet> {
  final _formKey = GlobalKey<FormState>();
  final _notes = TextEditingController();
  DateTime _scheduledAt = _defaultScheduleTime();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _scheduledAt,
      firstDate: DateUtils.dateOnly(DateTime.now()),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (date != null && mounted) {
      setState(
        () => _scheduledAt = DateTime(
          date.year,
          date.month,
          date.day,
          _scheduledAt.hour,
          _scheduledAt.minute,
        ),
      );
    }
  }

  Future<void> _selectTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_scheduledAt),
    );
    if (time != null && mounted) {
      setState(
        () => _scheduledAt = DateTime(
          _scheduledAt.year,
          _scheduledAt.month,
          _scheduledAt.day,
          time.hour,
          time.minute,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      8,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 20,
    ),
    child: SingleChildScrollView(
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Schedule', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              key: const ValueKey('work-action-schedule-date'),
              onPressed: _selectDate,
              icon: const Icon(Icons.calendar_today_outlined),
              label: Text('Date · ${_scheduleDateLabel(_scheduledAt)}'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              key: const ValueKey('work-action-schedule-time'),
              onPressed: _selectTime,
              icon: const Icon(Icons.access_time_outlined),
              label: Text('Time · ${_scheduleTimeLabel(_scheduledAt)}'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const ValueKey('work-action-schedule-notes'),
              controller: _notes,
              textCapitalization: TextCapitalization.sentences,
              minLines: 2,
              maxLines: 4,
              maxLength: 10000,
              decoration: const InputDecoration(
                labelText: 'Notes *',
                border: OutlineInputBorder(),
              ),
              validator: (value) => value == null || value.trim().isEmpty
                  ? 'Enter schedule notes.'
                  : null,
            ),
            const SizedBox(height: 14),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                key: const ValueKey('work-action-schedule-submit'),
                onPressed: () {
                  if (!_formKey.currentState!.validate()) return;
                  Navigator.of(context).pop(
                    _ScheduleDraft(
                      notes: _notes.text.trim(),
                      scheduledAt: _scheduledAt,
                    ),
                  );
                },
                icon: const Icon(Icons.send_outlined),
                label: const Text('Submit'),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _StageOption {
  const _StageOption({required this.id, required this.name, this.code = ''});

  final String id;
  final String name;
  final String code;

  bool get isExcluded =>
      _normalizedStageKey(name) == 'closed' ||
      _normalizedStageKey(name) == 'reopen' ||
      _normalizedStageKey(code) == 'closed' ||
      _normalizedStageKey(code) == 'reopen';
}

String _normalizedStageKey(String value) =>
    value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

Color _stageStatusColor(String value) => switch (_normalizedStageKey(value)) {
  'new' || 'reopen' => const Color(0xFF2563EB),
  'open' || 'contacted' => const Color(0xFF0EA5E9),
  'won' || 'qualified' => const Color(0xFF10B981),
  'lost' || 'unqualified' => const Color(0xFFDC2626),
  'holdforapproval' || 'holdforjobout' => const Color(0xFFF59E0B),
  'longhold' => const Color(0xFF7C3AED),
  'holdforspares' => const Color(0xFFF97316),
  'escalation' => const Color(0xFFE11D48),
  _ => const Color(0xFF475569),
};

class _StageChooserSheet extends StatefulWidget {
  const _StageChooserSheet({required this.options, this.current});

  final List<_StageOption> options;
  final _StageOption? current;

  @override
  State<_StageChooserSheet> createState() => _StageChooserSheetState();
}

class _StageChooserSheetState extends State<_StageChooserSheet> {
  final ScrollController _optionsScrollController = ScrollController();
  _StageOption? _selected;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selected = widget.current;
  }

  @override
  void dispose() {
    _optionsScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    key: const ValueKey('work-action-stage-sheet'),
    height: MediaQuery.sizeOf(context).height * .72,
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        8,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.max,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Change Stage', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 14),
          Autocomplete<_StageOption>(
            initialValue: TextEditingValue(text: _selected?.name ?? ''),
            displayStringForOption: (option) => option.name,
            optionsBuilder: (value) {
              final query = value.text.trim().toLowerCase();
              final selectedName = _selected?.name.trim().toLowerCase();
              final showAll =
                  query.isEmpty ||
                  (selectedName != null && query == selectedName);
              return widget.options.where(
                (option) =>
                    showAll || option.name.toLowerCase().contains(query),
              );
            },
            onSelected: (option) => setState(() {
              _selected = option;
              _error = null;
            }),
            fieldViewBuilder: (context, controller, focusNode, onSubmitted) =>
                TextField(
                  key: const ValueKey('work-action-stage-lookup'),
                  controller: controller,
                  focusNode: focusNode,
                  onChanged: (_) => setState(() {
                    _selected = null;
                    _error = null;
                  }),
                  decoration: const InputDecoration(
                    labelText: 'Status',
                    hintText: 'Search stages',
                    suffixIcon: Icon(Icons.arrow_drop_down_rounded),
                    border: OutlineInputBorder(),
                  ),
                ),
            optionsViewBuilder: (context, onSelected, options) => Align(
              alignment: Alignment.topLeft,
              child: Material(
                elevation: 5,
                borderRadius: BorderRadius.circular(10),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(context).height * .42,
                  ),
                  child: SizedBox(
                    width: MediaQuery.sizeOf(context).width - 40,
                    child: Scrollbar(
                      controller: _optionsScrollController,
                      thumbVisibility: true,
                      trackVisibility: true,
                      interactive: true,
                      child: ListView(
                        controller: _optionsScrollController,
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        children: options
                            .map(
                              (option) => ListTile(
                                key: ValueKey(
                                  'work-action-stage-option-${option.id}',
                                ),
                                leading: Icon(
                                  Icons.check_circle_outline_rounded,
                                  key: ValueKey(
                                    'work-action-stage-color-${option.id}',
                                  ),
                                  color: _stageStatusColor(option.code),
                                ),
                                title: Text(option.name),
                                trailing: _selected?.id == option.id
                                    ? Icon(
                                        Icons.check_rounded,
                                        key: ValueKey(
                                          'work-action-stage-selected-${option.id}',
                                        ),
                                        color: _stageStatusColor(option.code),
                                      )
                                    : null,
                                onTap: () => onSelected(option),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              key: const ValueKey('work-action-stage-submit'),
              onPressed: _selected == null
                  ? () => setState(
                      () => _error = 'Select a status from the list.',
                    )
                  : () => Navigator.of(context).pop(_selected),
              icon: const Icon(Icons.send_outlined),
              label: const Text('Submit'),
            ),
          ),
        ],
      ),
    ),
  );
}

class _CheckInComposerSheet extends StatefulWidget {
  const _CheckInComposerSheet({
    required this.title,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    required this.initialValue,
  });

  final String title;
  final num latitude;
  final num longitude;
  final num accuracyMeters;
  final String initialValue;

  @override
  State<_CheckInComposerSheet> createState() => _CheckInComposerSheetState();
}

class _CheckInComposerSheetState extends State<_CheckInComposerSheet> {
  late final _controller = TextEditingController(text: widget.initialValue);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      8,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 20,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 14),
        Container(
          key: const ValueKey('work-action-captured-location'),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_outlined),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Captured location'),
                    const SizedBox(height: 4),
                    SelectableText(
                      'GPS: ${widget.latitude}, ${widget.longitude}',
                      key: const ValueKey('work-action-location-coordinates'),
                    ),
                    Text(
                      'Accuracy: ${widget.accuracyMeters.toStringAsFixed(1)} m',
                      key: const ValueKey('work-action-location-accuracy'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          key: const ValueKey('work-action-check-in-input'),
          controller: _controller,
          autofocus: true,
          minLines: 3,
          maxLines: 6,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            hintText: 'Add a note (optional)',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 14),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            key: const ValueKey('work-action-check-in-submit'),
            onPressed: () => Navigator.of(context).pop(_controller.text.trim()),
            icon: const Icon(Icons.send_outlined),
            label: const Text('Submit'),
          ),
        ),
      ],
    ),
  );
}

class _ActionStatus extends StatelessWidget {
  const _ActionStatus({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(10),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [Icon(icon, size: 17), const SizedBox(width: 7), Text(text)],
    ),
  );
}

String _durationLabel(Duration duration) {
  final seconds = duration.inSeconds < 0 ? 0 : duration.inSeconds;
  final hours = seconds ~/ 3600;
  final minutes = seconds % 3600 ~/ 60;
  final remainder = seconds % 60;
  return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
}

String _scheduleDateLabel(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}-'
    '${value.month.toString().padLeft(2, '0')}-'
    '${(value.year % 100).toString().padLeft(2, '0')}';

String _scheduleTimeLabel(DateTime value) =>
    '${value.hour.toString().padLeft(2, '0')}:'
    '${value.minute.toString().padLeft(2, '0')}';

DateTime _defaultScheduleTime() {
  final date = DateTime.now().add(const Duration(hours: 1));
  return DateTime(date.year, date.month, date.day, date.hour, date.minute);
}

double _chargeAmount(Object? value) =>
    value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
