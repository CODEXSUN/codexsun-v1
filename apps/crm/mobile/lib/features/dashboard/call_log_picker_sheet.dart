import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/platform/mobile_actions.dart';

class MobileCallLogPickerSheet extends StatefulWidget {
  const MobileCallLogPickerSheet({super.key});

  static Future<String?> show(BuildContext context) =>
      showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (_) => const MobileCallLogPickerSheet(),
      );

  @override
  State<MobileCallLogPickerSheet> createState() =>
      _MobileCallLogPickerSheetState();
}

class _MobileCallLogPickerSheetState extends State<MobileCallLogPickerSheet> {
  List<_DeviceCall>? _calls;
  String? _error;
  String _query = '';
  bool _hasAccess = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _checkAccess();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final availableHeight = MediaQuery.sizeOf(context).height - bottomInset;
    final heightFactor = bottomInset > 0 ? .92 : .78;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SizedBox(
        height: availableHeight * heightFactor,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Choose from call log',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              if (_hasAccess) ...[
                TextField(
                  key: const ValueKey('call-log-picker-search'),
                  onChanged: (value) => setState(() => _query = value.trim()),
                  decoration: const InputDecoration(
                    hintText: 'Search phone number',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              Expanded(child: _buildContent()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (!_hasAccess) return _buildPermissionPrompt();
    if (_error != null) return _buildError();

    final calls = (_calls ?? const <_DeviceCall>[])
        .where((call) => call.mobile.isNotEmpty)
        .where((call) => call.matches(_query))
        .toList();
    if (calls.isEmpty) {
      return Center(
        child: Text(
          _query.isEmpty
              ? 'No calls found on this device.'
              : 'No matching calls.',
        ),
      );
    }
    return ListView.separated(
      key: const ValueKey('call-log-picker-list'),
      itemCount: calls.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final call = calls[index];
        return ListTile(
          key: ValueKey(
            'call-log-picker-${call.timestamp.millisecondsSinceEpoch}-${call.number}',
          ),
          contentPadding: EdgeInsets.zero,
          leading: CircleAvatar(
            backgroundColor: call.color.withValues(alpha: .12),
            foregroundColor: call.color,
            child: Icon(call.icon, size: 20),
          ),
          title: Text(call.mobile),
          subtitle: Text('${call.direction} · ${call.timeLabel}'),
          onTap: () => Navigator.of(context).pop(call.mobile),
        );
      },
    );
  }

  Widget _buildPermissionPrompt() => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.manage_history_rounded, size: 38),
          const SizedBox(height: 12),
          const Text(
            'Allow access to choose a number from device call history. '
            'This picker reads phone numbers and call directions only; it does not read your contacts.',
            textAlign: TextAlign.center,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _requestAccess,
            icon: const Icon(Icons.lock_open_rounded),
            label: const Text('Allow call history access'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: MobileActions.openAppSettings,
              child: const Text('Open Android Settings'),
            ),
          ],
        ],
      ),
    ),
  );

  Widget _buildError() => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(_error!, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: _requestAccess,
          child: const Text('Try again'),
        ),
      ],
    ),
  );

  Future<void> _checkAccess() async {
    try {
      final hasAccess = await MobileActions.hasCallLogAccess();
      if (!mounted) return;
      if (!hasAccess) {
        setState(() {
          _hasAccess = false;
          _loading = false;
        });
        return;
      }
      await _loadCalls();
    } on PlatformException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = _friendlyError(error);
        _loading = false;
      });
    }
  }

  Future<void> _requestAccess() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    await _loadCalls();
  }

  Future<void> _loadCalls() async {
    try {
      final rows = await MobileActions.enquiryCallLogs();
      if (!mounted) return;
      setState(() {
        _calls = rows.map(_DeviceCall.fromPlatform).toList();
        _hasAccess = true;
        _loading = false;
      });
    } on PlatformException catch (error) {
      if (!mounted) return;
      setState(() {
        _hasAccess = false;
        _error = _friendlyError(error);
        _loading = false;
      });
    }
  }

  String _friendlyError(PlatformException error) => switch (error.code) {
    'unsupported_device' =>
      'This device does not provide telephone call history.',
    'restricted_permission' =>
      'Android blocked call history access for this installation.',
    'permission_denied' => 'Call history permission was not granted.',
    _ => 'Could not read call history. Check the app permission and try again.',
  };
}

class _DeviceCall {
  const _DeviceCall({
    required this.number,
    required this.type,
    required this.timestamp,
  });

  final String number;
  final int type;
  final DateTime timestamp;

  factory _DeviceCall.fromPlatform(Map<String, dynamic> row) => _DeviceCall(
    number: row['number'] as String? ?? '',
    type: (row['type'] as num?)?.toInt() ?? 0,
    timestamp: DateTime.fromMillisecondsSinceEpoch(
      (row['timestamp'] as num?)?.toInt() ?? 0,
    ).toLocal(),
  );

  String get mobile {
    final digits = number.replaceAll(RegExp(r'\D'), '');
    return digits.length <= 10 ? digits : digits.substring(digits.length - 10);
  }

  String get direction => switch (type) {
    1 => 'Incoming',
    2 => 'Dialled',
    3 => 'Missed',
    _ => 'Call',
  };

  Color get color => switch (type) {
    1 => const Color(0xFF2878D0),
    2 => const Color(0xFF15945D),
    3 => const Color(0xFFD64545),
    _ => const Color(0xFF716A78),
  };

  IconData get icon => switch (type) {
    1 => Icons.call_received_rounded,
    2 => Icons.call_made_rounded,
    3 => Icons.call_missed_rounded,
    _ => Icons.call_rounded,
  };

  String get timeLabel {
    final hour = timestamp.hour % 12 == 0 ? 12 : timestamp.hour % 12;
    final minute = timestamp.minute.toString().padLeft(2, '0');
    final period = timestamp.hour >= 12 ? 'pm' : 'am';
    return '$hour:$minute $period';
  }

  bool matches(String query) {
    if (query.isEmpty) return true;
    final normalized = query.toLowerCase();
    return number.toLowerCase().contains(normalized) ||
        mobile.contains(normalized) ||
        direction.toLowerCase().contains(normalized);
  }
}
