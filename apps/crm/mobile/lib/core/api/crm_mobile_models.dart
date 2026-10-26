import '../config/app_config.dart';

class CrmPage<T> {
  const CrmPage({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  final List<T> items;
  final int page;
  final int pageSize;
  final int total;

  int get pageCount => total == 0 ? 1 : (total + pageSize - 1) ~/ pageSize;
  bool get hasPrevious => page > 1;
  bool get hasNext => page < pageCount;
}

class ApiHealth {
  const ApiHealth({required this.isHealthy});

  final bool isHealthy;

  factory ApiHealth.fromJson(Map<String, dynamic> json) {
    return ApiHealth(isHealthy: json['status'] == 'ok');
  }
}

class UserSession {
  const UserSession({required this.accessToken, required this.profile});

  final String accessToken;
  final UserProfile profile;

  factory UserSession.fromJson(Map<String, dynamic> json) {
    return UserSession(
      accessToken: json['accessToken'] as String,
      profile: UserProfile.fromJson(json),
    );
  }
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as int? ?? 0,
        title: json['title'] as String? ?? AppConfig.brandName,
        body: json['body'] as String? ?? '',
        type: json['type'] as String? ?? '',
      );

  final int id;
  final String title;
  final String body;
  final String type;
}

class CrmCustomerReference {
  const CrmCustomerReference({required this.id, required this.name});

  factory CrmCustomerReference.fromJson(Map<String, dynamic> json) =>
      CrmCustomerReference(
        id: json['id']?.toString() ?? '',
        name: json['name'] as String? ?? '',
      );

  final String id;
  final String name;
}

class CrmPartyReference extends CrmCustomerReference {
  const CrmPartyReference({
    required super.id,
    required super.name,
    required this.type,
  });

  factory CrmPartyReference.fromJson(Map<String, dynamic> json) =>
      CrmPartyReference(
        id: json['id']?.toString() ?? '',
        name: json['name'] as String? ?? '',
        type: json['type'] as String? ?? 'Customer',
      );

  final String type;
}

class UserProfile {
  const UserProfile({
    required this.email,
    required this.name,
    required this.role,
  });

  final String email;
  final String name;
  final String role;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    final email = json['email'] as String? ?? '';
    final derivedRole = json['role'] as String? ?? 'user';
    return UserProfile(
      email: email,
      name: json['name'] as String? ?? email,
      role: derivedRole,
    );
  }
}

class CrmMobileApiException implements Exception {
  const CrmMobileApiException(this.message);

  final String message;
}

class ClosureRequest {
  const ClosureRequest({
    required this.id,
    required this.status,
    required this.requestedAt,
    this.reviewNote,
  });

  final int id;
  final String status;
  final String requestedAt;
  final String? reviewNote;

  factory ClosureRequest.fromJson(Map<String, dynamic> json) => ClosureRequest(
    id: json['id'] as int,
    status: json['status'] as String,
    requestedAt: json['requestedAt'] as String,
    reviewNote: json['reviewNote'] as String?,
  );
}

class CrmEnquiryLocation {
  const CrmEnquiryLocation({
    required this.id,
    required this.latitude,
    required this.longitude,
    required this.capturedAt,
    required this.createdBy,
    this.accuracyMeters,
  });

  final int id;
  final double latitude;
  final double longitude;
  final DateTime capturedAt;
  final String createdBy;
  final double? accuracyMeters;

  factory CrmEnquiryLocation.fromJson(Map<String, dynamic> json) =>
      CrmEnquiryLocation(
        id: (json['id'] as num).toInt(),
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        capturedAt: DateTime.parse(json['capturedAt'] as String),
        createdBy: json['createdBy'] as String? ?? '',
        accuracyMeters: (json['accuracyMeters'] as num?)?.toDouble(),
      );
}

class CrmCallEnquiryFormData {
  const CrmCallEnquiryFormData({
    required this.groups,
    required this.assignees,
    this.statuses = const [],
    this.priorities = const [],
  });

  final List<CrmCallEnquiryGroup> groups;
  final List<CrmCallEnquiryAssignee> assignees;
  final List<CrmCallEnquiryStatus> statuses;
  final List<CrmCallEnquiryPriority> priorities;
}

class CrmCallEnquiryStatus {
  const CrmCallEnquiryStatus({
    required this.id,
    required this.name,
    required this.code,
  });

  final String id;
  final String name;
  final String code;
}

class CrmCallEnquiryPriority {
  const CrmCallEnquiryPriority({
    required this.id,
    required this.name,
    required this.code,
  });

  final String id;
  final String name;
  final String code;
}

class CrmCallEnquiryGroup {
  const CrmCallEnquiryGroup({required this.label, required this.value});

  final String label;
  final String value;

  factory CrmCallEnquiryGroup.fromJson(Map<String, dynamic> json) =>
      CrmCallEnquiryGroup(
        label: json['label'] as String? ?? '',
        value: json['value'] as String? ?? '',
      );
}

class CrmCallEnquiryAssignee {
  const CrmCallEnquiryAssignee({required this.id, required this.name});

  final String id;
  final String name;

  factory CrmCallEnquiryAssignee.fromJson(Map<String, dynamic> json) =>
      CrmCallEnquiryAssignee(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );
}

class CrmMobileEnquiryMatch {
  const CrmMobileEnquiryMatch({
    required this.enquiryId,
    required this.number,
    required this.title,
    required this.status,
    required this.createdAt,
  });

  final String enquiryId;
  final int number;
  final String title;
  final String status;
  final DateTime createdAt;

  factory CrmMobileEnquiryMatch.fromJson(Map<String, dynamic> json) =>
      CrmMobileEnquiryMatch(
        enquiryId: json['id']?.toString() ?? '',
        number: int.tryParse((json['enquiryNo'] ?? json['id']).toString()) ?? 0,
        title: normalizeCrmText(json['title'] as String? ?? 'Untitled enquiry'),
        status: json['status'] as String? ?? 'Open',
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
      );
}

class CrmCallLog {
  const CrmCallLog({required this.name});

  final String name;

  factory CrmCallLog.fromJson(Map<String, dynamic> json) =>
      CrmCallLog(name: json['name'] as String? ?? '');
}

class CrmCallLogComment {
  const CrmCallLogComment({
    required this.id,
    required this.body,
    required this.createdAt,
    required this.createdBy,
  });

  final int id;
  final String body;
  final DateTime createdAt;
  final String createdBy;

  factory CrmCallLogComment.fromJson(Map<String, dynamic> json) =>
      CrmCallLogComment(
        id: (json['id'] as num?)?.toInt() ?? 0,
        body: normalizeCrmText(json['body'] as String? ?? ''),
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
        createdBy: json['createdBy'] as String? ?? '',
      );
}

class CrmJob {
  const CrmJob({
    required this.id,
    required this.sourceId,
    required this.number,
    required this.title,
    required this.customer,
    this.mobile = '',
    this.assignedTo = '',
    required this.list,
    required this.dueDate,
    required this.createdBy,
    required this.createdAt,
    required this.lastAction,
    required this.status,
    required this.priority,
    this.statusId = '',
    this.priorityId = '',
    this.listInId = '',
    required this.comments,
    required this.jobs,
    required this.activities,
    this.hasJobSummary = false,
  });

  final int id;
  final String sourceId;
  final String number;
  final String title;
  final String customer;
  final String mobile;
  final String assignedTo;
  final String list;
  final String dueDate;
  final String createdBy;
  final DateTime createdAt;
  final String lastAction;
  final String status;
  final String priority;
  final String statusId;
  final String priorityId;
  final String listInId;
  final List<CrmComment> comments;
  final List<CrmJobExecution> jobs;
  final List<CrmActivity> activities;
  final bool hasJobSummary;

  CrmJob withJobs(List<CrmJobExecution> updatedJobs) => CrmJob(
    id: id,
    sourceId: sourceId,
    number: number,
    title: title,
    customer: customer,
    mobile: mobile,
    assignedTo: assignedTo,
    list: list,
    dueDate: dueDate,
    createdBy: createdBy,
    createdAt: createdAt,
    lastAction: lastAction,
    status: status,
    priority: priority,
    statusId: statusId,
    priorityId: priorityId,
    listInId: listInId,
    comments: comments,
    jobs: updatedJobs,
    activities: activities,
    hasJobSummary: hasJobSummary,
  );

  factory CrmJob.fromJson(Map<String, dynamic> json) {
    final comments = (json['messages'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final schedule = (json['schedules'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final sourceId = (json['id'] ?? json['uuid'] ?? '').toString();
    final customerName =
        json['contactName'] as String? ??
        json['capturedName'] as String? ??
        json['customerName'] as String? ??
        '';
    return CrmJob(
      id: int.tryParse(sourceId) ?? 0,
      sourceId: sourceId,
      number: (json['enquiryNo'] ?? sourceId).toString().replaceAll(
        RegExp(r'[^0-9]'),
        '',
      ),
      title: normalizeCrmText(json['title'] as String? ?? 'Untitled enquiry'),
      customer: normalizeCrmText(
        customerName.isNotEmpty
            ? customerName
            : json['customer'] as String? ?? 'Customer',
      ),
      mobile:
          json['capturedPhone'] as String? ?? json['mobile'] as String? ?? '',
      assignedTo: normalizeCrmText(
        json['assignedToName'] as String? ??
            _assignedToName(json['assignedTo']),
      ),
      list: normalizeCrmText(
        json['listIn'] as String? ??
            json['enquiryGroup'] as String? ??
            'General',
      ),
      dueDate: _dateLabel(
        json['dueDate'] as String? ??
            (schedule.isEmpty
                ? null
                : schedule.first['scheduledOn'] as String?),
      ),
      createdBy: normalizeCrmText(
        json['createdByName'] as String? ??
            (json['createdBy'] is Map<String, dynamic>
                ? (json['createdBy'] as Map<String, dynamic>)['name']
                          as String? ??
                      AppConfig.brandName
                : json['createdBy'] as String? ?? AppConfig.brandName),
      ),
      createdAt:
          DateTime.tryParse(
            json['createdAt'] as String? ?? json['enquiredAt'] as String? ?? '',
          ) ??
          DateTime.now(),
      lastAction: normalizeCrmText(
        comments.isEmpty
            ? (json['description'] as String? ?? 'No recent activity')
            : comments.last['comment'] as String? ??
                  comments.last['body'] as String? ??
                  'No recent activity',
      ),
      status:
          json['statusName'] as String? ?? json['status'] as String? ?? 'open',
      priority:
          json['priorityName'] as String? ??
          json['priority'] as String? ??
          'normal',
      statusId: json['statusId']?.toString() ?? '',
      priorityId: json['priorityId']?.toString() ?? '',
      listInId: json['listInId']?.toString() ?? '',
      comments: comments.map(CrmComment.fromJson).toList(),
      hasJobSummary: json.containsKey('runningJobId'),
      jobs:
          (json['jobs'] as List? ??
                  (json['runningJobId'] == null
                      ? []
                      : [
                          {
                            'id': json['runningJobId'],
                            'startAt': json['runningJobStartedAt'],
                            'createdAt': json['runningJobStartedAt'],
                            'status': 'running',
                          },
                        ]))
              .whereType<Map<String, dynamic>>()
              .map(CrmJobExecution.fromJson)
              .toList(),
      activities: (json['activities'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(CrmActivity.fromJson)
          .toList(),
    );
  }
}

class CrmDuty {
  const CrmDuty({
    required this.assignmentId,
    required this.department,
    required this.frequency,
    required this.index,
    required this.reports,
    required this.sopItem,
    required this.sopName,
    required this.steps,
  });

  final String department;
  final int assignmentId;
  final String frequency;
  final int index;
  final List<CrmDutyReport> reports;
  final String sopItem;
  final String sopName;
  final String steps;

  factory CrmDuty.fromJson(Map<String, dynamic> json) => CrmDuty(
    assignmentId: json['id'] is int
        ? json['id'] as int
        : int.tryParse(json['sopItem'] as String? ?? '') ?? 0,
    department: normalizeCrmText(json['department'] as String? ?? ''),
    frequency: json['frequency'] as String? ?? 'Daily',
    index: json['index'] as int? ?? 0,
    reports: (json['reports'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CrmDutyReport.fromJson)
        .toList(),
    sopItem: (json['sopItemId'] ?? json['sopItem'] ?? '').toString(),
    sopName: normalizeCrmText(
      json['itemTitle'] is String
          ? '${json['sopTitle'] ?? 'SOP'} · ${json['itemTitle']}'
          : json['sopName'] as String? ?? '',
    ),
    steps: normalizeCrmText(
      json['instructions'] as String? ?? json['steps'] as String? ?? '',
    ),
  );
}

class CrmDutyReport {
  const CrmDutyReport({
    required this.actions,
    required this.createdAt,
    required this.date,
    required this.name,
    required this.assignmentId,
  });

  final String actions;
  final DateTime createdAt;
  final String date;
  final String name;
  final int assignmentId;

  Map<String, dynamic> toJson() => {
    'actions': actions,
    'createdAt': createdAt.toIso8601String(),
    'date': date,
    'name': name,
    'assignmentId': assignmentId,
  };

  factory CrmDutyReport.fromJson(Map<String, dynamic> json) => CrmDutyReport(
    actions: normalizeCrmText(json['actions'] as String? ?? ''),
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    date: json['performedDate'] as String? ?? json['date'] as String? ?? '',
    name: normalizeCrmText((json['name'] ?? json['id'] ?? '').toString()),
    assignmentId: json['assignmentId'] is int
        ? json['assignmentId'] as int
        : int.tryParse('${json['assignmentId']}') ?? -1,
  );
}

String _assignedToName(Object? value) {
  if (value is! Map<String, dynamic>) return '';
  return value['title'] as String? ?? value['name'] as String? ?? '';
}

class CrmJobExecution {
  const CrmJobExecution({
    required this.name,
    required this.employee,
    required this.createdAt,
    required this.date,
    required this.startTime,
    required this.stopTime,
    required this.hours,
    required this.employeeCostPerHour,
    required this.totalCost,
    required this.status,
  });

  final String name;
  final String employee;
  final DateTime createdAt;
  final String? date;
  final String startTime;
  final String? stopTime;
  final double hours;
  final double employeeCostPerHour;
  final double totalCost;
  final String status;

  bool get isRunning => status == 'Running';

  factory CrmJobExecution.fromJson(
    Map<String, dynamic> json,
  ) => CrmJobExecution(
    name: json['id']?.toString() ?? json['name'] as String? ?? '',
    employee: json['employee'] as String? ?? '',
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    date: json['date'] as String? ?? json['startAt'] as String?,
    startTime: json['startTime'] as String? ?? json['startAt'] as String? ?? '',
    stopTime: json['stopTime'] as String? ?? json['stopAt'] as String?,
    hours: json['hours'] is num
        ? (json['hours'] as num).toDouble()
        : ((json['durationSeconds'] as num? ?? 0).toDouble() / 3600),
    employeeCostPerHour:
        (json['employeeCostPerHour'] as num? ??
                json['ratePerHour'] as num? ??
                0)
            .toDouble(),
    totalCost: (json['totalCost'] as num? ?? 0).toDouble(),
    status: (json['status'] as String? ?? 'Running').toLowerCase() == 'running'
        ? 'Running'
        : (json['status'] as String? ?? 'Completed'),
  );
}

class CrmActivity {
  const CrmActivity({
    required this.id,
    required this.action,
    required this.details,
    required this.createdAt,
    required this.createdBy,
  });

  final String id;
  final String action;
  final String details;
  final DateTime createdAt;
  final String createdBy;

  factory CrmActivity.fromJson(Map<String, dynamic> json) => CrmActivity(
    id: json['uuid']?.toString() ?? json['id']?.toString() ?? '',
    action: json['action'] as String? ?? 'updated',
    details: normalizeCrmText(json['details'] as String? ?? ''),
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    createdBy: json['createdBy'] as String? ?? '',
  );
}

class CrmActivityRecord {
  const CrmActivityRecord({
    required this.id,
    required this.enquiryId,
    required this.enquiryNumber,
    required this.contact,
    required this.action,
    required this.details,
    required this.actor,
    required this.createdAt,
  });

  final int id;
  final int enquiryId;
  final int enquiryNumber;
  final String contact;
  final String action;
  final String details;
  final String actor;
  final DateTime createdAt;

  factory CrmActivityRecord.fromJson(Map<String, dynamic> json) =>
      CrmActivityRecord(
        id: (json['id'] as num?)?.toInt() ?? 0,
        enquiryId: (json['enquiryId'] as num?)?.toInt() ?? 0,
        enquiryNumber: (json['enquiryNo'] as num?)?.toInt() ?? 0,
        contact: normalizeCrmText(json['contact'] as String? ?? '—'),
        action: normalizeCrmText(json['action'] as String? ?? 'updated'),
        details: normalizeCrmText(json['details'] as String? ?? ''),
        actor: json['actor'] as String? ?? '',
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.now(),
      );
}

class CrmComment {
  const CrmComment({
    required this.id,
    required this.comment,
    required this.createdAt,
    required this.createdByUserId,
  });

  final String id;
  final String comment;
  final DateTime createdAt;
  final String createdByUserId;

  factory CrmComment.fromJson(Map<String, dynamic> json) => CrmComment(
    id: json['id']?.toString() ?? '',
    comment: normalizeCrmText(
      json['comment'] as String? ?? json['body'] as String? ?? '',
    ),
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    createdByUserId:
        json['createdByUserId'] as String? ??
        json['createdBy'] as String? ??
        AppConfig.brandName,
  );
}

String normalizeCrmText(String value) {
  var text = _decodeHtmlEntities(value)
      .replaceAll(
        RegExp(
          r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>',
          caseSensitive: false,
          dotAll: true,
        ),
        '',
      )
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</(?:div|li|p)>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<li\b[^>]*>', caseSensitive: false), '• ')
      .replaceAll(RegExp(r'<[^>]+>'), '');

  return text
      .split('\n')
      .map((line) => line.replaceAll(RegExp(r'[ \t]+'), ' ').trim())
      .where((line) => line.isNotEmpty)
      .join('\n')
      .trim();
}

String _decodeHtmlEntities(String value) {
  const entities = {
    'amp': '&',
    'apos': "'",
    'nbsp': ' ',
    'quot': '"',
    'lt': '<',
    'gt': '>',
    'ndash': '–',
    'mdash': '—',
    'lsquo': '‘',
    'rsquo': '’',
    'ldquo': '“',
    'rdquo': '”',
    'copy': '©',
    'reg': '®',
    'trade': '™',
  };
  var text = value;
  // Frappe may store rich text escaped once or twice. Decode before stripping
  // tags so encoded Quill wrappers cannot leak into mobile labels or history.
  for (var pass = 0; pass < 2; pass++) {
    text = text.replaceAllMapped(
      RegExp(r'&(#(?:x[0-9a-fA-F]+|\d+)|[a-zA-Z][a-zA-Z0-9]+);'),
      (match) {
        final entity = match.group(1)!;
        if (!entity.startsWith('#')) return entities[entity] ?? match[0]!;
        final hexadecimal =
            entity.length > 1 &&
            entity.substring(1).toLowerCase().startsWith('x');
        final digits = entity.substring(hexadecimal ? 2 : 1);
        final codePoint = int.tryParse(digits, radix: hexadecimal ? 16 : 10);
        if (codePoint == null ||
            codePoint <= 0 ||
            codePoint > 0x10FFFF ||
            (codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
          return '';
        }
        return String.fromCharCode(codePoint);
      },
    );
  }
  return text;
}

class MessagingConversation {
  const MessagingConversation({
    required this.id,
    required this.uuid,
    required this.title,
    required this.preview,
    required this.updatedAt,
    required this.unreadCount,
    this.kind = 'channel',
  });

  final int id;
  final String uuid;
  final String title;
  final String preview;
  final DateTime updatedAt;
  final int unreadCount;
  final String kind;

  String get channelIdentifier => uuid.isNotEmpty ? uuid : '$id';

  factory MessagingConversation.fromJson(
    Map<String, dynamic> json,
    String currentEmail,
  ) {
    final last = json['lastMessage'] as Map<String, dynamic>?;
    final members = (json['members'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final id = json['id'] is int
        ? json['id'] as int
        : (int.tryParse('${json['id']}') ?? 0);
    final uuid = json['uuid'] as String? ?? (id > 0 ? '$id' : '');
    final name = json['name'] as String? ?? json['title'] as String?;
    final title = (name != null && name.isNotEmpty)
        ? name
        : (members.isEmpty
              ? 'Conversation'
              : _otherMemberName(members, currentEmail));
    final preview =
        json['lastMessagePreview'] as String? ??
        last?['content'] as String? ??
        last?['body'] as String? ??
        'No messages yet';
    final updatedAt =
        DateTime.tryParse(
          json['lastMessageAt'] as String? ??
              json['updatedAt'] as String? ??
              '',
        ) ??
        DateTime.now();
    final unreadCount = json['unreadCount'] as int? ?? 0;
    final kind = json['kind'] as String? ?? 'channel';

    return MessagingConversation(
      id: id,
      uuid: uuid,
      title: title,
      preview: preview,
      updatedAt: updatedAt,
      unreadCount: unreadCount,
      kind: kind,
    );
  }
}

class MessagingContact {
  const MessagingContact({
    required this.id,
    required this.name,
    required this.email,
  });

  final int id;
  final String name;
  final String email;

  factory MessagingContact.fromJson(Map<String, dynamic> json) {
    final email = json['email'] as String? ?? '';
    final rawId = json['id'];
    final id = rawId is int
        ? rawId
        : (int.tryParse('$rawId') ?? email.hashCode.abs());
    return MessagingContact(
      id: id,
      name: json['name'] as String? ?? 'CRM user',
      email: email,
    );
  }
}

class MessagingMessage {
  const MessagingMessage({
    required this.id,
    required this.uuid,
    required this.channelUuid,
    required this.senderName,
    required this.senderEmail,
    required this.content,
    required this.createdAt,
    required this.status,
  });

  final int id;
  final String uuid;
  final String channelUuid;
  final String senderName;
  final String senderEmail;
  final String content;
  final DateTime createdAt;
  final String status;

  factory MessagingMessage.fromJson(Map<String, dynamic> json) {
    final senderEmail =
        (json['senderEmail'] ?? json['sender_email'] ?? '') as String;
    final senderName =
        json['senderName'] as String? ??
        (senderEmail.isNotEmpty ? senderEmail.split('@').first : 'User');
    final content = (json['body'] ?? json['content'] ?? '') as String;
    final rawId = json['id'];
    final id = rawId is int ? rawId : (int.tryParse('$rawId') ?? 0);
    final uuid = json['uuid'] as String? ?? (id > 0 ? '$id' : '');
    final channelUuid =
        (json['channelUuid'] ?? json['channel_uuid'] ?? '') as String;

    return MessagingMessage(
      id: id,
      uuid: uuid,
      channelUuid: channelUuid,
      senderName: senderName,
      senderEmail: senderEmail,
      content: content,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      status: json['status'] as String? ?? 'active',
    );
  }
}

String _dateLabel(String? value) {
  if (value == null || value.isEmpty) return 'Not scheduled';
  final date = DateTime.tryParse(value);
  if (date == null) return value;
  return '${date.day.toString().padLeft(2, '0')} ${_months[date.month - 1]}';
}

String _otherMemberName(
  List<Map<String, dynamic>> members,
  String currentEmail,
) {
  final member = members.cast<Map<String, dynamic>?>().firstWhere(
    (item) =>
        item?['email']?.toString().toLowerCase() != currentEmail.toLowerCase(),
    orElse: () => members.isEmpty ? null : members.first,
  );
  return member?['userName'] as String? ?? 'Conversation';
}

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
