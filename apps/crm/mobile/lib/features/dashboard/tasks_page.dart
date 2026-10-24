import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/crm_mobile_api.dart';
import 'task_detail_page.dart';
import 'task_enquiry_card.dart';
import 'work_action_sheet.dart';

class TasksPage extends StatefulWidget {
  const TasksPage({required this.api, required this.session, super.key});
  final CrmMobileApi api;
  final UserSession session;
  @override
  State<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends State<TasksPage> with WidgetsBindingObserver {
  List<Map<String, dynamic>> _items = [];
  var _page = 1;
  var _total = 0;
  var _pageCount = 1;
  String? _error;
  Timer? _timer;
  bool _includeClosed = false;
  bool _loading = false;
  bool _initialLoad = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _startPolling();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (_loading) return;
    _loading = true;
    try {
      final result = await widget.api.tasksPage(
        widget.session.accessToken,
        filter: _includeClosed ? "all" : "active",
        page: _page,
        pageSize: 100,
      );
      if (mounted)
        setState(() {
          _items = result.items;
          _page = result.page;
          _total = result.total;
          _pageCount = result.pageCount;
          _error = null;
        });
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      _loading = false;
      if (mounted && _initialLoad) setState(() => _initialLoad = false);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startPolling();
      _load();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _startPolling() {
    _timer ??= Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  void _pausePolling() {
    _timer?.cancel();
    _timer = null;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Tasks'),
      actions: [
        IconButton(
          tooltip: _includeClosed ? 'Show active tasks' : 'Show all tasks',
          onPressed: () {
            setState(() {
              _includeClosed = !_includeClosed;
              _page = 1;
            });
            _load();
          },
          icon: Icon(
            _includeClosed ? Icons.filter_alt : Icons.filter_alt_outlined,
          ),
        ),
        IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
      ],
    ),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (_initialLoad && _items.isEmpty)
            const SizedBox(
              height: 240,
              child: Center(child: CircularProgressIndicator()),
            ),
          if (_error != null)
            ListTile(
              leading: const Icon(Icons.cloud_off_outlined),
              title: const Text('Could not load tasks.'),
              subtitle: Text(_error!),
              trailing: IconButton(
                tooltip: 'Retry',
                onPressed: _load,
                icon: const Icon(Icons.refresh_rounded),
              ),
            ),
          if (!_initialLoad && _items.isEmpty && _error == null)
            const ListTile(title: Text('No active tasks.')),
          ..._items.map(
            (row) => Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
              child: TaskEnquiryCard(
                task: row,
                runningJobStartedAt: row['runningJobStartedAt'] as String?,
                onOpen: () => _openTask(row),
                onActions: () => _openActions(row),
              ),
            ),
          ),
          if (_total > 100)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  Text('$_total tasks · Page $_page of $_pageCount'),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Previous page',
                    onPressed: _page > 1
                        ? () {
                            setState(() => _page--);
                            _load();
                          }
                        : null,
                    icon: const Icon(Icons.chevron_left),
                  ),
                  IconButton(
                    tooltip: 'Next page',
                    onPressed: _page < _pageCount
                        ? () {
                            setState(() => _page++);
                            _load();
                          }
                        : null,
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ),
        ],
      ),
    ),
  );

  Future<void> _openTask(Map<String, dynamic> row) async {
    _pausePolling();
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => TaskDetailPage(
          api: widget.api,
          session: widget.session,
          id: row['id'] as int,
        ),
      ),
    );
    if (mounted) await _load();
    _startPolling();
  }

  Future<void> _openActions(Map<String, dynamic> row) async {
    final id = row['id'] as int;
    try {
      final values = await Future.wait<Object?>([
        widget.api.taskJobs(widget.session.accessToken, id),
        widget.api.workCheckpoint(widget.session.accessToken, taskId: id),
        widget.api.taskClosures(widget.session.accessToken, id),
      ]);
      if (!mounted) return;
      final jobs = values[0] as List<Map<String, dynamic>>;
      final closures = values[2] as List<Map<String, dynamic>>;
      final running = jobs.where((job) => job['stoppedAt'] == null).firstOrNull;
      final rawStartedAt = running?['startedAt']?.toString();
      final result = await showWorkActionSheet(
        context: context,
        api: widget.api,
        session: widget.session,
        taskId: id,
        taskStatusId: '${row['statusId'] ?? ''}',
        taskPhone: '${row['contactPhone'] ?? ''}',
        isJobRunning: running != null,
        jobStartedAt: rawStartedAt == null
            ? null
            : DateTime.tryParse(rawStartedAt.replaceFirst(' ', 'T'))?.toLocal(),
        checkedIn: values[1] as bool,
        closurePending: closures.any((item) => item['status'] == 'pending'),
        closed: row['status'] == 'closed',
      );
      if (result && mounted) await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not load task actions: $error')),
        );
      }
    }
  }
}
