import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/api/crm_mobile_api.dart';
import 'dashboard_list_page.dart';
import 'dashboard_jobs_feed.dart';
import 'job_enquiry_card.dart';
import 'job_duration.dart';

class MyEnquiriesPage extends StatefulWidget {
  const MyEnquiriesPage({
    required this.api,
    required this.session,
    this.onSignOut,
    this.embedded = false,
    this.capturePosition,
    this.onJobUpdated,
    this.jobsFeed,
    super.key,
  });

  final CrmMobileApi api;
  final UserSession session;
  final VoidCallback? onSignOut;
  final bool embedded;
  final Future<Position> Function()? capturePosition;
  final ValueChanged<CrmJob>? onJobUpdated;
  final DashboardJobsFeed? jobsFeed;

  @override
  State<MyEnquiriesPage> createState() => MyEnquiriesPageState();
}

class MyEnquiriesPageState extends State<MyEnquiriesPage> {
  final _searchController = TextEditingController();
  late Future<CrmPage<CrmJob>> _enquiries;
  late Future<CrmCallEnquiryFormData> _formData;
  var _listFilter = '';
  var _statusFilter = '';
  var _searchQuery = '';
  var _page = 1;
  Timer? _searchDebounce;
  List<CrmJob> _feedSnapshot = [];

  @override
  void initState() {
    super.initState();
    _enquiries = _load();
    _formData = _loadFormData();
    _feedSnapshot = widget.jobsFeed?.jobs ?? [];
    widget.jobsFeed?.addListener(_refreshChangedRecords);
  }

  @override
  void didUpdateWidget(covariant MyEnquiriesPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.jobsFeed != widget.jobsFeed) {
      oldWidget.jobsFeed?.removeListener(_refreshChangedRecords);
      _feedSnapshot = widget.jobsFeed?.jobs ?? [];
      widget.jobsFeed?.addListener(_refreshChangedRecords);
    }
  }

  void _refreshChangedRecords() {
    final next = widget.jobsFeed?.jobs ?? [];
    final changed =
        next.length != _feedSnapshot.length ||
        next.indexed.any((entry) {
          final before = _feedSnapshot[entry.$1];
          final after = entry.$2;
          return before.sourceId != after.sourceId ||
              before.status != after.status ||
              before.priority != after.priority ||
              before.list != after.list ||
              before.assignedTo != after.assignedTo ||
              before.dueDate != after.dueDate ||
              before.title != after.title;
        });
    _feedSnapshot = next;
    if (mounted && changed) {
      final enquiries = _load();
      setState(() {
        _enquiries = enquiries;
      });
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    widget.jobsFeed?.removeListener(_refreshChangedRecords);
    _searchController.dispose();
    super.dispose();
  }

  Widget _buildListFilterButton() => FutureBuilder<CrmCallEnquiryFormData>(
    future: _formData,
    builder: (context, snapshot) => PopupMenuButton<String>(
      tooltip: 'Filter lists',
      enabled: snapshot.hasData,
      icon: Icon(
        _listFilter.isEmpty
            ? Icons.filter_list_rounded
            : Icons.filter_alt_rounded,
      ),
      onSelected: (value) => setState(() {
        _listFilter = value;
        _page = 1;
        _enquiries = _load();
      }),
      itemBuilder: (context) => [
        const PopupMenuItem(value: '', child: Text('All lists')),
        ...?snapshot.data?.groups.map(
          (group) =>
              PopupMenuItem(value: group.value, child: Text(group.label)),
        ),
      ],
    ),
  );

  Widget _buildStatusFilterButton() => FutureBuilder<CrmCallEnquiryFormData>(
    future: _formData,
    builder: (context, snapshot) => PopupMenuButton<String>(
      tooltip: 'Filter status',
      enabled:
          snapshot.hasData && (snapshot.data?.statuses.isNotEmpty ?? false),
      icon: Icon(_statusFilter.isEmpty ? Icons.flag_outlined : Icons.flag),
      onSelected: (value) => setState(() {
        _statusFilter = value;
        _page = 1;
        _enquiries = _load();
      }),
      itemBuilder: (context) => [
        const PopupMenuItem(value: '', child: Text('All statuses')),
        ...?snapshot.data?.statuses.map(
          (st) => PopupMenuItem(value: st.name, child: Text(st.name)),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final jobsFeed = widget.jobsFeed;
    final content = jobsFeed == null
        ? _buildContent()
        : ListenableBuilder(
            listenable: jobsFeed,
            builder: (context, _) => _buildContent(),
          );

    if (widget.embedded) {
      return content;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Jobs'),
        actions: [
          _buildListFilterButton(),
          _buildStatusFilterButton(),
          if (widget.onSignOut != null)
            PopupMenuButton<String>(
              tooltip: 'Account options',
              onSelected: (value) {
                if (value == 'sign-out') widget.onSignOut?.call();
              },
              itemBuilder: (context) => [
                PopupMenuItem<String>(
                  enabled: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.session.profile.name),
                      Text(
                        widget.session.profile.email,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(value: 'sign-out', child: Text('Sign out')),
              ],
            ),
        ],
      ),
      body: content,
    );
  }

  Widget _buildContent() => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search title, customer, phone...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchDebounce?.cancel();
                            _searchController.clear();
                            setState(() {
                              _searchQuery = '';
                              _page = 1;
                              _enquiries = _load();
                            });
                          },
                        )
                      : null,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFFDDD8E0)),
                  ),
                ),
                onChanged: (value) {
                  _searchDebounce?.cancel();
                  setState(() {
                    _searchQuery = value.trim();
                    _page = 1;
                  });
                  _searchDebounce = Timer(
                    const Duration(milliseconds: 300),
                    () {
                      if (!mounted) return;
                      setState(() {
                        _enquiries = _load();
                      });
                    },
                  );
                },
                onSubmitted: (value) {
                  _searchDebounce?.cancel();
                  setState(() {
                    _searchQuery = value.trim();
                    _page = 1;
                    _enquiries = _load();
                  });
                },
              ),
            ),
            if (widget.embedded) ...[
              const SizedBox(width: 4),
              _buildListFilterButton(),
              _buildStatusFilterButton(),
            ],
          ],
        ),
      ),
      Expanded(
        child: FutureBuilder<CrmPage<CrmJob>>(
          future: _enquiries,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done &&
                !snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) return _LoadError(onRetry: refresh);
            final result =
                snapshot.data ??
                const CrmPage<CrmJob>(
                  items: [],
                  page: 1,
                  pageSize: 100,
                  total: 0,
                );
            final allEnquiries = result.items
                .map(
                  (enquiry) =>
                      widget.jobsFeed?.jobFor(enquiry.sourceId) ?? enquiry,
                )
                .toList();
            final enquiries = sortRunningJobsFirst(_filter(allEnquiries));
            if (enquiries.isEmpty && result.total == 0) {
              return Center(
                child: Text(
                  allEnquiries.isEmpty
                      ? 'No jobs found.'
                      : 'No jobs are in this list.',
                ),
              );
            }
            return RefreshIndicator(
              onRefresh: refresh,
              child: ListView.builder(
                padding: EdgeInsets.fromLTRB(
                  16,
                  6,
                  16,
                  widget.embedded ? 84 : 28,
                ),
                itemCount: enquiries.isEmpty
                    ? 1
                    : enquiries.length + (result.total > 100 ? 1 : 0),
                itemBuilder: (context, index) {
                  if (enquiries.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(child: Text('No jobs are in this list.')),
                    );
                  }
                  if (index == enquiries.length) {
                    return _CrmPageControls(
                      page: result.page,
                      pageCount: result.pageCount,
                      total: result.total,
                      label: 'jobs',
                      onPrevious: result.hasPrevious
                          ? () => _changePage(result.page - 1)
                          : null,
                      onNext: result.hasNext
                          ? () => _changePage(result.page + 1)
                          : null,
                    );
                  }
                  final cardJob = enquiries[index];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: JobEnquiryCard(
                      key: ValueKey(cardJob.sourceId),
                      api: widget.api,
                      session: widget.session,
                      enquiry: DashboardListItem.fromCrmJob(cardJob),
                      job: cardJob,
                      onJobChanged: refresh,
                      capturePosition: widget.capturePosition,
                      onJobUpdated: widget.onJobUpdated,
                      closurePending:
                          widget.jobsFeed?.isClosurePending(cardJob.sourceId) ??
                          false,
                      collectionPending:
                          widget.jobsFeed?.isCollectionPending(
                            cardJob.sourceId,
                          ) ??
                          false,
                      onClosurePendingChanged: (pending) => widget.jobsFeed
                          ?.updateClosurePending(cardJob.sourceId, pending),
                      loadJobSessions:
                          widget.jobsFeed?.jobSessions ??
                          ((sourceId) => widget.api.enquiryJobSessions(
                            accessToken: widget.session.accessToken,
                            enquiryId: sourceId,
                          )),
                    ),
                  );
                },
              ),
            );
          },
        ),
      ),
    ],
  );

  Future<CrmPage<CrmJob>> _load() async {
    final token = widget.session.accessToken;
    final listId = _listFilter.isNotEmpty ? _listFilter : null;
    try {
      return await widget.api.enquiriesPage(
        accessToken: token,
        scope: 'assigned',
        filter: 'active',
        search: _searchQuery,
        listInId: listId,
        page: _page,
        pageSize: 100,
      );
    } on CrmMobileApiException {
      final items = await widget.api.assignedJobs(token);
      return CrmPage(items: items, page: 1, pageSize: 100, total: items.length);
    }
  }

  Future<CrmCallEnquiryFormData> _loadFormData() =>
      widget.api.callEnquiryFormData(widget.session.accessToken);

  Future<void> refresh() => _refresh();

  Future<void> _refresh() async {
    final enquiries = _load();
    setState(() {
      _enquiries = enquiries;
    });
    await enquiries;
    await widget.jobsFeed?.refresh();
  }

  void _changePage(int page) {
    setState(() {
      _page = page;
      _enquiries = _load();
    });
  }

  List<CrmJob> _filter(List<CrmJob> enquiries) {
    var filtered = enquiries;
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      filtered = filtered.where((enquiry) {
        return enquiry.title.toLowerCase().contains(q) ||
            enquiry.customer.toLowerCase().contains(q) ||
            enquiry.mobile.toLowerCase().contains(q) ||
            enquiry.number.contains(q);
      }).toList();
    }
    if (_listFilter.isNotEmpty) {
      filtered = filtered
          .where(
            (enquiry) =>
                enquiry.list.trim().toLowerCase() ==
                    _listFilter.toLowerCase() ||
                enquiry.listInId == _listFilter,
          )
          .toList();
    }
    if (_statusFilter.isNotEmpty) {
      filtered = filtered
          .where(
            (enquiry) =>
                enquiry.status.trim().toLowerCase() ==
                _statusFilter.toLowerCase(),
          )
          .toList();
    }
    return filtered;
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: FilledButton.tonal(
      onPressed: onRetry,
      child: const Text('Could not load your jobs. Retry'),
    ),
  );
}

class _CrmPageControls extends StatelessWidget {
  const _CrmPageControls({
    required this.page,
    required this.pageCount,
    required this.total,
    required this.label,
    required this.onPrevious,
    required this.onNext,
  });

  final int page;
  final int pageCount;
  final int total;
  final String label;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      children: [
        Expanded(child: Text('$total $label · Page $page of $pageCount')),
        IconButton(
          tooltip: 'Previous page',
          onPressed: onPrevious,
          icon: const Icon(Icons.chevron_left),
        ),
        IconButton(
          tooltip: 'Next page',
          onPressed: onNext,
          icon: const Icon(Icons.chevron_right),
        ),
      ],
    ),
  );
}
