import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../core/api/crm_mobile_api.dart';

/// Keeps the Home and Jobs screens on the same fresh CRM snapshot.
///
/// This is view state only. CRM remains the source of truth and all mutations
/// still go through the platform API.
class DashboardJobsFeed extends ChangeNotifier with WidgetsBindingObserver {
  DashboardJobsFeed({required this.api, required this.session}) {
    WidgetsBinding.instance.addObserver(this);
  }

  static const _refreshInterval = Duration(seconds: 12);

  final CrmMobileApi api;
  UserSession session;
  final List<CrmJob> _jobs = [];
  final Map<String, List<CrmJobExecution>> _jobSessions = {};
  final Map<String, Future<List<CrmJobExecution>>> _sessionRequests = {};
  final Map<String, CrmJob> _jobsBySourceId = {};
  final Set<String> _pendingClosureIds = {};
  final Set<String> _pendingCollectionIds = {};
  Timer? _timer;
  bool _isLoading = true;
  bool _isRefreshing = false;
  String? _error;
  var _sessionGeneration = 0;
  var _disposed = false;

  List<CrmJob> get jobs => List.unmodifiable(_jobs);
  CrmJob? jobFor(String sourceId) => _jobsBySourceId[sourceId];

  Future<List<CrmJobExecution>> jobSessions(
    String sourceId, {
    bool refresh = false,
  }) {
    final cached = _jobSessions[sourceId];
    if (cached != null && !refresh) return Future.value(cached);
    final generation = _sessionGeneration;
    final requestKey = '$generation:$sourceId';
    return _sessionRequests.putIfAbsent(requestKey, () async {
      try {
        final sessions = await api.enquiryJobSessions(
          accessToken: session.accessToken,
          enquiryId: sourceId,
        );
        if (!_disposed && generation == _sessionGeneration) {
          _jobSessions[sourceId] = sessions;
          final index = _jobs.indexWhere((job) => job.sourceId == sourceId);
          if (index >= 0) {
            final updated = _jobs[index].withJobs(sessions);
            _jobs[index] = updated;
            _jobsBySourceId[sourceId] = updated;
            notifyListeners();
          }
        }
        return sessions;
      } finally {
        _sessionRequests.remove(requestKey);
      }
    });
  }

  bool isClosurePending(String sourceId) =>
      _pendingClosureIds.contains(sourceId);
  bool isCollectionPending(String sourceId) =>
      _pendingCollectionIds.contains(sourceId);
  bool get isLoading => _isLoading;
  String? get error => _error;

  void updateClosurePending(String sourceId, bool pending) {
    final changed = pending
        ? _pendingClosureIds.add(sourceId)
        : _pendingClosureIds.remove(sourceId);
    if (changed) notifyListeners();
  }

  void start() {
    _startPolling();
    unawaited(refresh());
  }

  Future<void> refresh() async {
    if (_isRefreshing) return;
    _isRefreshing = true;
    final generation = _sessionGeneration;
    var shouldNotify = _isLoading;
    try {
      final updated = await _loadEnquiries();
      if (generation != _sessionGeneration) return;
      // Older API responses need a refresh only for previously opened sessions.
      final tracked = updated.where(
        (job) => !job.hasJobSummary && _jobSessions.containsKey(job.sourceId),
      );
      for (final job in tracked) {
        await jobSessions(job.sourceId, refresh: true);
        if (generation != _sessionGeneration) return;
      }
      final pendingResults = await Future.wait([
        _loadPendingIds(
          () => api.pendingEnquiryClosureIds(session.accessToken),
        ),
        _loadPendingIds(
          () => api.pendingEnquiryCollectionIds(session.accessToken),
        ),
      ]);
      if (generation != _sessionGeneration) return;
      final pendingClosureIds = pendingResults[0];
      final pendingCollectionIds = pendingResults[1];
      final closureChanged = !_sameIds(_pendingClosureIds, pendingClosureIds);
      final collectionChanged = !_sameIds(
        _pendingCollectionIds,
        pendingCollectionIds,
      );
      if (pendingClosureIds != null) {
        _pendingClosureIds
          ..clear()
          ..addAll(pendingClosureIds);
      }
      if (pendingCollectionIds != null) {
        _pendingCollectionIds
          ..clear()
          ..addAll(pendingCollectionIds);
      }
      final merged = updated.map((job) {
        if (job.hasJobSummary) {
          _jobSessions.remove(job.sourceId);
          return job;
        }
        final sessions = _jobSessions[job.sourceId];
        return job.jobs.isEmpty && sessions != null
            ? job.withJobs(sessions)
            : job;
      }).toList();
      final changed =
          !_sameJobs(_jobs, merged) || closureChanged || collectionChanged;
      _jobs
        ..clear()
        ..addAll(merged);
      _jobsBySourceId
        ..clear()
        ..addEntries(_jobs.map((job) => MapEntry(job.sourceId, job)));
      _error = null;
      shouldNotify |= changed;
    } on Object catch (error) {
      if (generation != _sessionGeneration) return;
      final nextError = error is CrmMobileApiException
          ? error.message
          : 'Could not refresh live dashboard data.';
      shouldNotify |= _error != nextError;
      _error = nextError;
    } finally {
      if (generation == _sessionGeneration) {
        _isLoading = false;
        _isRefreshing = false;
        if (!_disposed && shouldNotify) notifyListeners();
      }
    }
  }

  void updateJob(CrmJob updated) {
    _jobSessions[updated.sourceId] = updated.jobs;
    final index = _jobs.indexWhere((job) => job.sourceId == updated.sourceId);
    if (index >= 0) {
      _jobs[index] = updated;
    } else if (updated.status.toLowerCase() != 'closed') {
      _jobs.add(updated);
    }
    _jobsBySourceId[updated.sourceId] = updated;
    notifyListeners();
  }

  void updateSession(UserSession updatedSession) {
    if (session.accessToken == updatedSession.accessToken) return;
    if (session.profile.email != updatedSession.profile.email) {
      _jobs.clear();
      _jobsBySourceId.clear();
      _jobSessions.clear();
      _pendingClosureIds.clear();
      _pendingCollectionIds.clear();
    }
    session = updatedSession;
    _sessionGeneration += 1;
    _isRefreshing = false;
    _isLoading = _jobs.isEmpty;
    unawaited(refresh());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startPolling();
      unawaited(refresh());
      return;
    }
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _startPolling() {
    _timer ??= Timer.periodic(_refreshInterval, (_) => unawaited(refresh()));
  }

  Future<List<CrmJob>> _loadEnquiries() async {
    return api.enquiries(
      accessToken: session.accessToken,
      scope: 'assigned',
      filter: 'active',
    );
  }

  Future<Set<String>?> _loadPendingIds(
    Future<Set<String>> Function() load,
  ) async {
    try {
      return await load();
    } on Exception {
      return null;
    }
  }

  bool _sameIds(Set<String> current, Set<String>? next) =>
      next == null ||
      (current.length == next.length && current.containsAll(next));

  bool _sameJobs(List<CrmJob> current, List<CrmJob> next) {
    if (current.length != next.length) return false;
    for (var index = 0; index < current.length; index++) {
      final oldJob = current[index];
      final newJob = next[index];
      if (oldJob.sourceId != newJob.sourceId ||
          oldJob.title != newJob.title ||
          oldJob.status != newJob.status ||
          oldJob.priority != newJob.priority ||
          oldJob.customer != newJob.customer ||
          oldJob.assignedTo != newJob.assignedTo ||
          oldJob.dueDate != newJob.dueDate ||
          oldJob.list != newJob.list ||
          oldJob.lastAction != newJob.lastAction ||
          oldJob.jobs.length != newJob.jobs.length)
        return false;
      for (var jobIndex = 0; jobIndex < oldJob.jobs.length; jobIndex++) {
        final before = oldJob.jobs[jobIndex];
        final after = newJob.jobs[jobIndex];
        if (before.name != after.name ||
            before.status != after.status ||
            before.startTime != after.startTime ||
            before.stopTime != after.stopTime)
          return false;
      }
    }
    return true;
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }
}
