import 'dart:convert';
import 'dart:async';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'crm_mobile_models.dart';

export 'crm_mobile_models.dart';

class CrmMobileApi {
  CrmMobileApi(String baseUrl) : _baseUri = Uri.parse(baseUrl);

  final Uri _baseUri;
  final http.Client _client = http.Client();

  void close() => _client.close();

  String? get hostHeader => _resolveHostHeader(_baseUri);

  static String? _resolveHostHeader(Uri baseUri) {
    if (baseUri.host != '10.0.2.2') return null;
    final port = baseUri.hasPort ? ':${baseUri.port}' : '';
    return '127.0.0.1$port';
  }

  Future<ApiHealth> health() async {
    return ApiHealth.fromJson(await _request('/health'));
  }

  Future<UserSession> signIn({
    required String email,
    required String password,
    String? corporateId,
  }) async {
    final corp = (corporateId != null && corporateId.trim().isNotEmpty)
        ? corporateId.trim()
        : AppConfig.corporateId;
    final data = await _request(
      '/auth/login',
      body: {
        'desk': 'tenant',
        'email': email,
        'password': password,
        if (corp.isNotEmpty) 'corporateId': corp,
      },
      method: 'POST',
      requestBearerToken: true,
    );
    return UserSession.fromJson(data);
  }

  Future<UserProfile> session(String accessToken) async {
    return UserProfile.fromJson(
      await _request('/auth/session', accessToken: accessToken),
    );
  }

  Future<String> changePassword({
    required String accessToken,
    required UserProfile profile,
    required String password,
  }) async {
    final data = await _request(
      '/identity/profile',
      accessToken: accessToken,
      method: 'PUT',
      body: {
        'email': profile.email,
        'name': profile.name,
        'password': password,
      },
    ) as Map<String, dynamic>;
    return data['accessToken'] as String;
  }

  Future<List<CrmJob>> assignedJobs(String accessToken) async {
    final data = await _request(
      '/crm/enquiries',
      accessToken: accessToken,
      query: const {
        'scope': 'assigned',
        'filter': 'active',
        'page': '1',
        'pageSize': '100',
      },
    );
    if (data is! Map<String, dynamic> || data['items'] is! List) {
      throw const CrmMobileApiException('Unexpected jobs response.');
    }
    return (data['items'] as List)
        .whereType<Map<String, dynamic>>()
        .map(CrmJob.fromJson)
        .toList();
  }

  Future<List<AppNotification>> notifications(String accessToken) async {
    final data = await _request('/notifications', accessToken: accessToken);
    if (data is! List) {
      throw const CrmMobileApiException('Unexpected notifications response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(AppNotification.fromJson)
        .toList();
  }

  Future<List<CrmJob>> enquiries({
    required String accessToken,
    String scope = 'all',
    String filter = 'all',
    String search = '',
    String? listInId,
    int page = 1,
    int pageSize = 100,
  }) async {
    final result = await enquiriesPage(
      accessToken: accessToken,
      scope: scope,
      filter: filter,
      search: search,
      listInId: listInId,
      page: page,
      pageSize: pageSize,
    );
    return result.items;
  }

  Future<CrmPage<CrmJob>> enquiriesPage({
    required String accessToken,
    String scope = 'all',
    String filter = 'all',
    String search = '',
    String? listInId,
    int page = 1,
    int pageSize = 100,
  }) async {
    final safePage = page < 1 ? 1 : page;
    final safePageSize = pageSize.clamp(1, 100).toInt();
    final query = <String, String>{
      'scope': scope,
      'filter': filter,
      'page': '$safePage',
      'pageSize': '$safePageSize',
      if (search.trim().isNotEmpty) 'search': search.trim(),
      if (listInId != null && listInId.isNotEmpty) 'listInId': listInId,
    };
    final data = await _request(
      '/crm/enquiries',
      accessToken: accessToken,
      query: query,
    );
    if (data is! Map<String, dynamic> || data['items'] is! List) {
      throw const CrmMobileApiException('Unexpected enquiries response.');
    }
    final items = (data['items'] as List)
        .whereType<Map<String, dynamic>>()
        .map(CrmJob.fromJson)
        .toList();
    return CrmPage<CrmJob>(
      items: items,
      page: (data['page'] as num?)?.toInt() ?? safePage,
      pageSize: (data['pageSize'] as num?)?.toInt() ?? safePageSize,
      total: (data['total'] as num?)?.toInt() ?? items.length,
    );
  }

  Future<List<CrmJobExecution>> enquiryJobSessions({
    required String accessToken,
    required String enquiryId,
  }) async {
    final data = await _request(
      '/crm/enquiries/${Uri.encodeComponent(enquiryId)}/jobs',
      accessToken: accessToken,
    );
    if (data is! List) {
      throw const CrmMobileApiException('Unexpected job timer response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(CrmJobExecution.fromJson)
        .toList();
  }

  Future<int> activitiesCount(String accessToken) async {
    final page = await activitiesPage(
      accessToken: accessToken,
      pageSize: 1,
      createdAfter: DateTime.now().subtract(const Duration(days: 7)).toUtc(),
    );
    return page.total;
  }

  Future<CrmPage<CrmActivityRecord>> activitiesPage({
    required String accessToken,
    int page = 1,
    int pageSize = 100,
    DateTime? createdAfter,
  }) async {
    final safePage = page < 1 ? 1 : page;
    final safePageSize = pageSize.clamp(1, 100).toInt();
    final query = <String, String>{
      'scope': 'mine',
      'page': '$safePage',
      'pageSize': '$safePageSize',
      if (createdAfter != null)
        'createdAfter': createdAfter.toUtc().toIso8601String(),
    };
    final data = await _request(
      '/crm/activities',
      accessToken: accessToken,
      query: query,
    );
    if (data is! Map<String, dynamic> || data['items'] is! List) {
      throw const CrmMobileApiException('Unexpected activities response.');
    }
    final items = (data['items'] as List)
        .whereType<Map<String, dynamic>>()
        .map(CrmActivityRecord.fromJson)
        .toList();
    return CrmPage(
      items: items,
      page: safePage,
      pageSize: safePageSize,
      total: (data['total'] as num?)?.toInt() ?? items.length,
    );
  }

  Future<List<CrmPartyReference>> partiesByMobile({
    required String accessToken,
    required String mobile,
  }) async {
    final data = await _request(
      '/crm/contacts',
      accessToken: accessToken,
      query: {'search': mobile},
    );
    if (data is! List) {
      throw const CrmMobileApiException('Unexpected contact lookup response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(CrmPartyReference.fromJson)
        .toList();
  }

  Future<List<Map<String, dynamic>>> workReports(
    String accessToken, {
    int? enquiryId,
    int? taskId,
  }) async {
    final data = await _request(
      '/crm/work-reports',
      accessToken: accessToken,
      query: {
        if (enquiryId != null) 'enquiryId': '$enquiryId',
        if (taskId != null) 'taskId': '$taskId',
      },
    );
    return (data as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> workCharges(
    String accessToken, {
    int? enquiryId,
    int? taskId,
    int page = 1,
  }) async {
    final data = await _request(
      '/crm/work-reports/history',
      accessToken: accessToken,
      query: {
        if (enquiryId != null) 'enquiryId': '$enquiryId',
        if (taskId != null) 'taskId': '$taskId',
        'filter': 'charges',
        'page': '$page',
        'pageSize': '100',
      },
    );
    return (data as Map).cast<String, dynamic>();
  }

  Future<List<Map<String, dynamic>>> enquirySchedules(
    String accessToken, {
    required int enquiryId,
  }) async {
    final data = await _request(
      '/crm/schedules',
      accessToken: accessToken,
      query: {
        'view': 'schedules',
        'sourceType': 'enquiry',
        'sourceId': '$enquiryId',
      },
    );
    if (data is! List) {
      throw const CrmMobileApiException('Unexpected schedules response.');
    }
    return data.whereType<Map<String, dynamic>>().toList();
  }

  Future<void> createSchedule({
    required String accessToken,
    required String notes,
    required String sourceType,
    required int sourceId,
    required DateTime scheduledAt,
  }) async {
    final timestamp = scheduledAt.toUtc().toIso8601String();
    await _request(
      '/crm/schedules',
      accessToken: accessToken,
      method: 'POST',
      body: {
        'notes': notes,
        'sourceType': sourceType,
        'sourceId': sourceId,
        'scheduledAt': timestamp,
      },
    );
  }

  Future<void> sendWorkReport(
    String accessToken,
    Map<String, dynamic> payload,
  ) async {
    await _request(
      '/crm/work-reports',
      accessToken: accessToken,
      method: 'POST',
      body: payload,
    );
  }

  Future<bool> workCheckpoint(
    String accessToken, {
    int? enquiryId,
    int? taskId,
  }) async {
    final result = await _request(
      '/crm/work-reports/checkpoint',
      accessToken: accessToken,
      query: {
        if (enquiryId != null) 'enquiryId': '$enquiryId',
        if (taskId != null) 'taskId': '$taskId',
      },
    ) as Map<String, dynamic>;
    return result['checkedIn'] == true;
  }

  Future<int> tasksCount(String accessToken) async {
    final data = await _request(
      '/crm/tasks',
      accessToken: accessToken,
      query: {'scope': 'mine', 'filter': 'active', 'pageSize': '1'},
    ) as Map<String, dynamic>;
    return (data['total'] as num).toInt();
  }

  Future<List<Map<String, dynamic>>> tasks(
    String accessToken, {
    String filter = "active",
    int page = 1,
    int pageSize = 100,
    String scope = 'mine',
  }) async {
    final result = await tasksPage(
      accessToken,
      filter: filter,
      page: page,
      pageSize: pageSize,
      scope: scope,
    );
    return result.items;
  }

  Future<CrmPage<Map<String, dynamic>>> tasksPage(
    String accessToken, {
    String filter = 'active',
    int page = 1,
    int pageSize = 100,
    String scope = 'mine',
  }) async {
    final safePage = page < 1 ? 1 : page;
    final safePageSize = pageSize.clamp(1, 100).toInt();
    final data = await _request(
      '/crm/tasks',
      accessToken: accessToken,
      query: {
        'scope': scope,
        'filter': filter,
        'page': '$safePage',
        'pageSize': '$safePageSize',
      },
    ) as Map<String, dynamic>;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    return CrmPage<Map<String, dynamic>>(
      items: items,
      page: (data['page'] as num?)?.toInt() ?? safePage,
      pageSize: (data['pageSize'] as num?)?.toInt() ?? safePageSize,
      total: (data['total'] as num?)?.toInt() ?? items.length,
    );
  }

  Future<Map<String, dynamic>> task(String accessToken, int id) async =>
      await _request('/crm/tasks/$id', accessToken: accessToken)
          as Map<String, dynamic>;

  Future<Map<String, dynamic>> taskOptions(String accessToken) async =>
      await _request('/crm/tasks/options', accessToken: accessToken)
          as Map<String, dynamic>;

  Future<Map<String, dynamic>> updateTaskProperties({
    required String accessToken,
    required int id,
    required int statusId,
  }) async => await _request(
    '/crm/tasks/$id/properties',
    accessToken: accessToken,
    method: 'PATCH',
    body: {'statusId': statusId},
  ) as Map<String, dynamic>;

  Future<Map<String, dynamic>> createTask(
    String accessToken,
    Map<String, dynamic> payload,
  ) async => await _request(
    '/crm/tasks',
    accessToken: accessToken,
    method: 'POST',
    body: payload,
  ) as Map<String, dynamic>;

  Future<List<Map<String, dynamic>>> taskComments(
    String accessToken,
    int id,
  ) async => (await _request(
    '/crm/tasks/$id/comments',
    accessToken: accessToken,
  ) as List).cast<Map<String, dynamic>>();

  Future<List<Map<String, dynamic>>> taskClosures(
    String accessToken,
    int id,
  ) async => (await _request(
    '/crm/tasks/$id/closure-requests',
    accessToken: accessToken,
  ) as List).cast<Map<String, dynamic>>();

  Future<List<Map<String, dynamic>>> taskJobs(String token, int id) async =>
      (await _request('/crm/tasks/$id/jobs', accessToken: token) as List)
          .cast<Map<String, dynamic>>();

  Future<void> addTaskComment(
    String accessToken,
    int id,
    String comment,
  ) async {
    await _request(
      '/crm/tasks/$id/comments',
      accessToken: accessToken,
      method: 'POST',
      body: {'body': comment, 'parentId': null},
    );
  }

  Future<void> startTaskJob(String token, int id) async {
    await _request(
      '/crm/tasks/$id/jobs/start',
      accessToken: token,
      method: 'POST',
      body: {},
    );
  }

  Future<void> stopTaskJob(String token, int id) async {
    await _request(
      '/crm/tasks/$id/jobs/stop',
      accessToken: token,
      method: 'POST',
      body: {},
    );
  }

  Future<void> requestTaskClosure(
    String accessToken,
    int id, {
    String reason = "Completed from mobile.",
  }) async {
    await _request(
      '/crm/tasks/$id/closure-requests',
      accessToken: accessToken,
      method: 'POST',
      body: {'reason': reason},
    );
  }

  Future<void> editDutyReport({
    required String accessToken,
    required int id,
    required String date,
    required String actions,
  }) async {
    await _request(
      '/crm/duty-reports/$id',
      accessToken: accessToken,
      method: 'PUT',
      body: {'performedDate': date, 'actions': actions},
    );
  }

  Future<CrmJob> job(String accessToken, String id) async {
    final data = await _request(
      '/crm/enquiries/${Uri.encodeComponent(id)}',
      accessToken: accessToken,
    );
    final record = data as Map<String, dynamic>;
    final related = await Future.wait([
      _request(
        '/crm/enquiries/${Uri.encodeComponent(id)}/comments',
        accessToken: accessToken,
      ),
      _request(
        '/crm/enquiries/${Uri.encodeComponent(id)}/jobs',
        accessToken: accessToken,
      ),
      _request(
        '/crm/enquiries/${Uri.encodeComponent(id)}/activity',
        accessToken: accessToken,
      ),
    ]);
    return CrmJob.fromJson({
      ...record,
      'messages': (related[0] as List).map((item) {
        final comment = item as Map<String, dynamic>;
        return {
          ...comment,
          'comment': comment['body'],
          'createdByUserId': comment['createdBy'],
        };
      }).toList(),
      'jobs': related[1],
      'activities': related[2],
    });
  }

  Future<List<CrmEnquiryLocation>> enquiryLocations({
    required String accessToken,
    required String enquiryId,
  }) async {
    final data = await _request(
      '/crm/enquiries/${Uri.encodeComponent(enquiryId)}/locations',
      accessToken: accessToken,
    );
    if (data is! Map<String, dynamic> || data['items'] is! List) {
      throw const CrmMobileApiException(
        'Unexpected enquiry locations response.',
      );
    }
    return (data['items'] as List)
        .whereType<Map<String, dynamic>>()
        .map(CrmEnquiryLocation.fromJson)
        .toList();
  }

  Future<CrmEnquiryLocation> logEnquiryLocation({
    required String accessToken,
    required String enquiryId,
    required double latitude,
    required double longitude,
    required double? accuracyMeters,
    required DateTime capturedAt,
  }) async {
    final data = await _request(
      '/crm/enquiries/${Uri.encodeComponent(enquiryId)}/locations',
      accessToken: accessToken,
      method: 'POST',
      body: {
        'latitude': latitude,
        'longitude': longitude,
        'accuracyMeters': accuracyMeters,
        'capturedAt': capturedAt.toUtc().toIso8601String(),
      },
    );
    return CrmEnquiryLocation.fromJson(data as Map<String, dynamic>);
  }

  Future<List<CrmMobileEnquiryMatch>> mobileEnquiries({
    required String accessToken,
    required String mobile,
  }) async {
    final data = await _request(
      '/crm/enquiries',
      accessToken: accessToken,
      query: {'mobile': mobile, 'page': '1', 'pageSize': '100'},
    );
    if (data is! Map<String, dynamic> || data['items'] is! List) {
      throw const CrmMobileApiException('Unexpected mobile enquiry response.');
    }
    return (data['items'] as List)
        .whereType<Map<String, dynamic>>()
        .map(CrmMobileEnquiryMatch.fromJson)
        .toList();
  }

  Future<CrmJob> addJobComment({
    required String accessToken,
    required String id,
    required String comment,
  }) async {
    await _request(
      '/crm/mobile/enquiries/${Uri.encodeComponent(id)}/comments',
      accessToken: accessToken,
      method: 'POST',
      body: {'body': comment, 'bodyFormat': 'plain', 'parentId': null},
    );
    return job(accessToken, id);
  }

  Future<CrmCallEnquiryFormData> callEnquiryFormData(String accessToken) async {
    final options = await _request(
      '/crm/enquiries/options',
      accessToken: accessToken,
    ) as Map<String, dynamic>;
    return CrmCallEnquiryFormData(
      groups: (options['lists'] as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => CrmCallEnquiryGroup(
              label: item['name'] as String,
              value: item['id'] as String,
            ),
          )
          .toList(),
      assignees: (options['users'] as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => CrmCallEnquiryAssignee(
              id: item['id'] as String,
              name: item['name'] as String,
            ),
          )
          .toList(),
      statuses: (options['statuses'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => CrmCallEnquiryStatus(
              id: item['id']?.toString() ?? '',
              name: item['name'] as String? ?? '',
              code: item['code'] as String? ?? '',
            ),
          )
          .toList(),
      priorities: (options['priorities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => CrmCallEnquiryPriority(
              id: item['id']?.toString() ?? '',
              name: item['name'] as String? ?? '',
              code: item['code'] as String? ?? '',
            ),
          )
          .toList(),
    );
  }

  Future<CrmJob> createCallEnquiry({
    required String accessToken,
    required String mobile,
    required String customerName,
    required String title,
    required String enquiryGroup,
    required String? assignedToUserId,
    required String message,
    required String direction,
    required int durationSeconds,
    required DateTime occurredAt,
  }) async {
    return createEnquiry(
      accessToken: accessToken,
      customer: customerName,
      mobile: mobile,
      title: title,
      enquiryGroup: enquiryGroup,
      assignedToUserId: assignedToUserId,
      message:
          '$message\n\n${direction.trim()} call · ${durationSeconds}s · ${occurredAt.toLocal()}',
    );
  }

  Future<CrmCallLog> syncDeviceCallLog({
    required String accessToken,
    required String sourceReference,
    required String type,
    required String from,
    required String to,
    required String status,
    required int duration,
    required DateTime occurredAt,
  }) async {
    final data = await _request(
      '/crm/mobile/call-logs',
      accessToken: accessToken,
      method: 'POST',
      body: {
        'type': type,
        'from': from,
        'to': to,
        'status': status,
        'duration': duration,
        'user': null,
        'sourceReference': sourceReference,
        'occurredAt': occurredAt.toUtc().toIso8601String(),
      },
    );
    return CrmCallLog.fromJson(data as Map<String, dynamic>);
  }

  Future<List<CrmCallLogComment>> callLogComments({
    required String accessToken,
    required String callLogName,
  }) async {
    final data = await _request(
      '/crm/call-logs/${Uri.encodeComponent(callLogName)}/comments',
      accessToken: accessToken,
    );
    if (data is! List) {
      throw const CrmMobileApiException(
        'Unexpected call log comments response.',
      );
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(CrmCallLogComment.fromJson)
        .toList();
  }

  Future<CrmCallLogComment> addCallLogComment({
    required String accessToken,
    required String callLogName,
    required String body,
  }) async {
    final data = await _request(
      '/crm/mobile/call-logs/${Uri.encodeComponent(callLogName)}/comments',
      accessToken: accessToken,
      method: 'POST',
      body: {'body': body},
    );
    return CrmCallLogComment.fromJson(data as Map<String, dynamic>);
  }

  Future<CrmJob> createEnquiry({
    required String accessToken,
    required String customer,
    required String mobile,
    required String title,
    required String enquiryGroup,
    required String? assignedToUserId,
    required String message,
    String? statusId,
    String? priorityId,
    String? dueDate,
  }) async {
    final options = await _request(
      '/crm/enquiries/options',
      accessToken: accessToken,
    ) as Map<String, dynamic>;
    final statuses = (options['statuses'] as List)
        .whereType<Map<String, dynamic>>();
    final priorities = (options['priorities'] as List)
        .whereType<Map<String, dynamic>>();
    final status = _requiredEnquiryOption(
      statuses,
      selectedId: statusId,
      defaultCode: 'new',
      label: 'New status',
    );
    final priority = _requiredEnquiryOption(
      priorities,
      selectedId: priorityId,
      defaultCode: 'normal',
      label: 'Normal priority',
    );
    final data = await _request(
      '/crm/enquiries',
      accessToken: accessToken,
      method: 'POST',
      body: {
        'title': title,
        'description': message,
        'contactId': int.tryParse(customer),
        'capturedName':
            customer.trim().isEmpty || int.tryParse(customer) != null
            ? null
            : customer.trim(),
        'capturedEmail': null,
        'capturedPhone': mobile.isEmpty ? null : mobile,
        'source': 'mobile',
        'sourceReference': null,
        'listInId': enquiryGroup,
        'statusId': status['id'],
        'priorityId': priority['id'],
        'assignedUserId': assignedToUserId,
        'enquiredAt': DateTime.now().toUtc().toIso8601String(),
        'dueDate': dueDate,
        'closedReason': null,
      },
    );
    return CrmJob.fromJson(data as Map<String, dynamic>);
  }

  Map<String, dynamic> _requiredEnquiryOption(
    Iterable<Map<String, dynamic>> options, {
    required String? selectedId,
    required String defaultCode,
    required String label,
  }) {
    final option = options.where((item) {
      if (selectedId != null) return item['id']?.toString() == selectedId;
      return (item['code'] as String? ?? '').toLowerCase() == defaultCode;
    }).firstOrNull;
    if (option == null) {
      throw CrmMobileApiException(
        '$label is not available. Refresh and try again.',
      );
    }
    return option;
  }

  Future<CrmJob> startJob({
    required String accessToken,
    required String id,
  }) async {
    await _request(
      '/crm/enquiries/${Uri.encodeComponent(id)}/jobs/start',
      accessToken: accessToken,
      method: 'POST',
      body: const {},
    );
    return job(accessToken, id);
  }

  Future<List<CrmDuty>> duties(String accessToken) async {
    final data = await _request('/crm/duties', accessToken: accessToken);
    final reportData = await _request(
      '/crm/duty-reports',
      accessToken: accessToken,
      query: const {'scope': 'own', 'page': '1', 'pageSize': '100'},
    );
    final reportsPage = reportData is Map<String, dynamic>
        ? reportData['items']
        : reportData;
    if (data is! List || reportsPage is! List)
      throw const CrmMobileApiException('Unexpected duties response.');
    final reports = reportsPage
        .whereType<Map<String, dynamic>>()
        .map(CrmDutyReport.fromJson)
        .toList();
    return data.whereType<Map<String, dynamic>>().map((item) {
      final id = item['id'] is int
          ? item['id'] as int
          : int.tryParse('${item['id']}') ?? -1;
      return CrmDuty.fromJson({
        ...item,
        'reports': reports
            .where((report) => report.assignmentId == id)
            .map((report) => report.toJson())
            .toList(),
      });
    }).toList();
  }

  Future<int> dutiesCount(String accessToken) async {
    final data = await _request('/crm/duties', accessToken: accessToken);
    if (data is! List) {
      throw const CrmMobileApiException('Unexpected duties response.');
    }
    return data.length;
  }

  Future<CrmDutyReport> reportDuty({
    required String accessToken,
    required int assignmentId,
    required String actions,
    required String result,
    required String issueDetails,
  }) async {
    final data = await _request(
      '/crm/duty-reports',
      accessToken: accessToken,
      method: 'POST',
      body: {
        'assignmentId': assignmentId,
        'performedDate': DateTime.now().toUtc().toIso8601String().substring(
          0,
          10,
        ),
        'actions': actions,
        'result': result,
        'issueDetails': issueDetails,
      },
    );
    return CrmDutyReport.fromJson(data as Map<String, dynamic>);
  }

  Future<CrmJob> stopJob({
    required String accessToken,
    required String id,
    required String jobName,
  }) async {
    await _request(
      '/crm/enquiries/${Uri.encodeComponent(id)}/jobs/${Uri.encodeComponent(jobName)}/stop',
      accessToken: accessToken,
      method: 'POST',
      body: const {},
    );
    return job(accessToken, id);
  }

  Future<CrmJob> openNewCall({
    required String accessToken,
    required String id,
  }) async {
    await _request(
      '/crm/enquiries/${Uri.encodeComponent(id)}/open-new-call',
      accessToken: accessToken,
      method: 'POST',
      body: const {},
    );
    return job(accessToken, id);
  }

  Future<CrmJob> updateProperties({
    required String accessToken,
    required String id,
    String? statusId,
    String? priorityId,
    String? listInId,
    String? assignedUserId,
    String? dueDate,
    String? closedReason,
  }) async {
    final payload = <String, dynamic>{};
    if (statusId != null) payload['statusId'] = statusId;
    if (priorityId != null) payload['priorityId'] = priorityId;
    if (listInId != null) payload['listInId'] = listInId;
    if (assignedUserId != null) payload['assignedUserId'] = assignedUserId;
    if (dueDate != null) payload['dueDate'] = dueDate;
    if (closedReason != null) payload['closedReason'] = closedReason;
    await _request(
      '/crm/enquiries/${Uri.encodeComponent(id)}/properties',
      accessToken: accessToken,
      method: 'PATCH',
      body: payload,
    );
    return job(accessToken, id);
  }

  Future<ClosureRequest?> latestClosureRequest({
    required String accessToken,
    required String id,
  }) async {
    final data = await _request(
      '/crm/enquiries/${Uri.encodeComponent(id)}/closure-requests/latest',
      accessToken: accessToken,
    );
    if (data is! Map<String, dynamic>) {
      throw const CrmMobileApiException('Unexpected closure request response.');
    }
    final item = data['item'];
    if (item == null) return null;
    if (item is! Map<String, dynamic>) {
      throw const CrmMobileApiException('Unexpected closure request response.');
    }
    return ClosureRequest.fromJson(item);
  }

  Future<Set<String>> pendingEnquiryClosureIds(String accessToken) async {
    final data = await _request(
      '/crm/enquiries/closure-requests/pending',
      accessToken: accessToken,
    );
    if (data is! Map<String, dynamic> || data['items'] is! List) {
      throw const CrmMobileApiException(
        'Unexpected pending completion response.',
      );
    }
    return (data['items'] as List)
        .whereType<num>()
        .map((id) => id.toInt().toString())
        .toSet();
  }

  Future<Set<String>> pendingEnquiryCollectionIds(String accessToken) async {
    final data = await _request(
      '/crm/work-reports/pending-collections',
      accessToken: accessToken,
    );
    if (data is! Map<String, dynamic> || data['items'] is! List) {
      throw const CrmMobileApiException(
        'Unexpected pending collection response.',
      );
    }
    return (data['items'] as List)
        .whereType<num>()
        .map((id) => id.toInt().toString())
        .toSet();
  }

  Future<ClosureRequest> requestClosure({
    required String accessToken,
    required String id,
    String note = '',
  }) async {
    final data = await _request(
      '/crm/enquiries/${Uri.encodeComponent(id)}/closure-requests',
      accessToken: accessToken,
      method: 'POST',
      body: {'note': note},
    );
    if (data is! Map<String, dynamic>) {
      throw const CrmMobileApiException('Unexpected closure request response.');
    }
    return ClosureRequest.fromJson(data);
  }

  Future<List<MessagingConversation>> conversations({
    required String accessToken,
    required String currentEmail,
  }) async {
    final data = await _request(
      '/chat/channels',
      accessToken: accessToken,
      query: const {'limit': '100'},
    );
    if (data is! List) {
      throw const CrmMobileApiException('Unexpected channels response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map((item) => MessagingConversation.fromJson(item, currentEmail))
        .toList();
  }

  Future<List<MessagingContact>> messagingContacts({
    required String accessToken,
    String search = '',
  }) async {
    final data = await _request(
      '/chat/users',
      accessToken: accessToken,
      query: {if (search.trim().isNotEmpty) 'search': search.trim()},
    );
    if (data is! List) {
      throw const CrmMobileApiException('Unexpected contacts response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(MessagingContact.fromJson)
        .toList();
  }

  Future<MessagingConversation> openDirectConversation({
    required String accessToken,
    required String currentEmail,
    required MessagingContact contact,
  }) async {
    try {
      final existingChannels = await conversations(
        accessToken: accessToken,
        currentEmail: currentEmail,
      );
      for (final conv in existingChannels) {
        if (conv.kind == 'dm' &&
            (conv.title.toLowerCase() == contact.name.toLowerCase() ||
                conv.title.toLowerCase() == contact.email.toLowerCase())) {
          return conv;
        }
      }
    } catch (_) {}

    final data = await _request(
      '/chat/channels',
      accessToken: accessToken,
      method: 'POST',
      body: {
        'name': contact.name.isNotEmpty ? contact.name : contact.email,
        'kind': 'dm',
        'members': [contact.email],
      },
    );
    return MessagingConversation.fromJson(
      data as Map<String, dynamic>,
      currentEmail,
    );
  }

  Future<List<MessagingMessage>> messages(
    String accessToken,
    dynamic conversationId,
  ) async {
    final channelUuid = conversationId.toString();
    final data = await _request(
      '/chat/messages',
      accessToken: accessToken,
      query: {'channelUuid': channelUuid, 'limit': '100'},
    );
    if (data is! List) {
      throw const CrmMobileApiException('Unexpected messages response.');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(MessagingMessage.fromJson)
        .toList();
  }

  Future<MessagingMessage> sendMessage({
    required String accessToken,
    required dynamic conversationId,
    required String content,
  }) async {
    final channelUuid = conversationId.toString();
    return MessagingMessage.fromJson(
      await _request(
        '/chat/messages',
        accessToken: accessToken,
        method: 'POST',
        body: {'channelUuid': channelUuid, 'body': content},
      ) as Map<String, dynamic>,
    );
  }

  Future<void> markConversationRead({
    required String accessToken,
    required dynamic conversationId,
    int? messageId,
  }) async {
    final channelUuid = conversationId.toString();
    await _request(
      '/chat/channels/$channelUuid/read',
      accessToken: accessToken,
      method: 'POST',
      body: {'messageId': ?messageId},
    );
  }

  Future<dynamic> _request(
    String path, {
    String? accessToken,
    Map<String, dynamic>? body,
    String method = 'GET',
    Map<String, String>? query,
    bool requestBearerToken = false,
  }) async {
    try {
      final request = http.Request(
        method,
        _baseUri.replace(path: '${_baseUri.path}$path', queryParameters: query),
      );
      request.headers['Accept'] = 'application/json';
      final host = hostHeader;
      if (host != null) request.headers['Host'] = host;
      if (requestBearerToken) {
        request.headers['x-auth-token-delivery'] = 'bearer';
      }
      if (accessToken != null) {
        request.headers['Authorization'] = 'Bearer $accessToken';
        request.headers['x-company-id'] = '1';
      }
      if (body != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(body);
      }
      final response = await _client
          .send(request)
          .timeout(
            const Duration(seconds: 30),
            onTimeout: () => throw const CrmMobileApiException(
              'The server did not respond. Check your connection and try again.',
            ),
          );
      final responseBytes = await response.stream.toBytes().timeout(
        const Duration(seconds: 30),
        onTimeout: () => throw const CrmMobileApiException(
          'The server response timed out. Try again.',
        ),
      );
      final dynamic decoded;
      try {
        decoded = jsonDecode(utf8.decode(responseBytes));
      } on FormatException {
        throw const CrmMobileApiException(
          'The server returned an invalid response. Try again.',
        );
      }
      if (decoded is! Map<String, dynamic>) {
        throw const CrmMobileApiException(
          'The server returned an invalid response. Try again.',
        );
      }
      final payload = decoded;
      if (payload['success'] != true || response.statusCode >= 400) {
        final error = payload['error'];
        final message = switch (error) {
          String msg => msg,
          Map<String, dynamic> err =>
            err['message'] as String? ?? 'Request failed.',
          _ => payload['message'] as String? ?? 'Request failed.',
        };
        throw CrmMobileApiException(message);
      }
      return payload['data'];
    } on CrmMobileApiException {
      rethrow;
    } on Exception {
      throw const CrmMobileApiException(
        'Could not connect to CRM. Check your connection and try again.',
      );
    }
  }
}
