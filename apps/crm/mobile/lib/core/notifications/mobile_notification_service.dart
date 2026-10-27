import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../api/crm_mobile_api.dart';
import '../config/app_config.dart';

class MobileNotificationService extends ChangeNotifier {
  MobileNotificationService({required this.api, required this.session});

  final CrmMobileApi api;
  UserSession session;
  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();
  final Set<int> _knownNotificationIds = {};
  Timer? _poller;
  var _assignmentCount = 0;

  int get assignmentCount => _assignmentCount;

  void updateSession(UserSession updatedSession) {
    if (session.accessToken == updatedSession.accessToken) return;
    session = updatedSession;
    unawaited(_refresh(isInitial: true));
  }

  Future<void> start() async {
    await _initialize();
    await _refresh(isInitial: true);
    _poller = Timer.periodic(
      const Duration(seconds: 20),
      (_) => unawaited(_refresh()),
    );
  }

  Future<void> showChatAlert(int unreadCount) => _show(
    id: 90001,
    title: 'New chat message',
    body: unreadCount == 1
        ? 'You have one unread message.'
        : 'You have $unreadCount unread messages.',
  );

  Future<void> _initialize() async {
    const android = AndroidInitializationSettings('ic_launcher');
    await _notifications.initialize(
      settings: const InitializationSettings(android: android),
    );
    final androidPlugin = _notifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await androidPlugin?.requestNotificationsPermission();
  }

  Future<void> _refresh({bool isInitial = false}) async {
    try {
      final items = await api.notifications(session.accessToken);
      final assignments = items
          .where((item) => item.type == 'assignment')
          .toList();
      if (_assignmentCount != assignments.length) {
        _assignmentCount = assignments.length;
        notifyListeners();
      }
      for (final item in items) {
        if (!_knownNotificationIds.add(item.id) || isInitial) continue;
        await _show(id: item.id, title: item.title, body: item.body);
      }
    } on Exception {
      // Preserve the last confirmed state until the API reconnects.
    }
  }

  Future<void> _show({
    required int id,
    required String title,
    required String body,
  }) {
    return _notifications.show(
      id: id,
      title: title,
      body: body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          'crm_activity',
          '${AppConfig.brandName} activity',
          channelDescription: 'Job assignments and chat messages.',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _poller?.cancel();
    super.dispose();
  }
}
