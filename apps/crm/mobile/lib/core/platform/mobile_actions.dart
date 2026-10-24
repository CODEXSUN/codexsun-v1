import 'package:flutter/services.dart';

import '../config/app_config.dart';

class MobileActions {
  const MobileActions._();

  static final _channel = MethodChannel(
    '${AppConfig.nativeChannelPrefix}/mobile-actions',
  );

  static Future<bool> call(String mobile) =>
      _invoke('call', {'mobile': mobile});

  static Future<bool> sms(String mobile) => _invoke('sms', {'mobile': mobile});

  static Future<bool> whatsApp(String mobile) =>
      _invoke('whatsApp', {'mobile': mobile});

  static Future<bool> location(String query) =>
      _invoke('location', {'query': query});

  static Future<bool> scanDocument() => _invoke('scanDocument');

  static Future<bool> photo() => _invoke('photo');

  static Future<bool> openAppSettings() => _invoke('openAppSettings');

  static Future<bool> hasCallLogAccess() async =>
      await _channel.invokeMethod<bool>('hasCallLogAccess') ?? false;

  static Future<List<Map<String, dynamic>>> callLogs() =>
      _readCallLogs('callLogs');

  static Future<List<Map<String, dynamic>>> enquiryCallLogs() =>
      _readCallLogs('enquiryCallLogs');

  static Future<List<Map<String, dynamic>>> _readCallLogs(String method) async {
    final rows = await _channel.invokeListMethod<dynamic>(method) ?? [];
    return rows
        .whereType<Map<dynamic, dynamic>>()
        .map((row) => row.map((key, value) => MapEntry('$key', value)))
        .toList();
  }

  static Future<bool> _invoke(
    String method, [
    Map<String, String>? arguments,
  ]) async {
    return await _channel.invokeMethod<bool>(method, arguments) ?? false;
  }
}
