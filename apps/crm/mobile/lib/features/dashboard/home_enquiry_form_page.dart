import 'package:flutter/material.dart';

import '../../app/app_footer_dock.dart';
import '../../app/dashboard_navigation.dart';
import '../../core/api/crm_mobile_api.dart';
import 'call_log_picker_sheet.dart';
import 'inline_select_field.dart';

class HomeEnquiryFormPage extends StatefulWidget {
  const HomeEnquiryFormPage({
    required this.api,
    required this.session,
    this.initialCustomer = '',
    this.initialMobile = '',
    this.initialMessage = '',
    super.key,
  });

  final CrmMobileApi api;
  final UserSession session;
  final String initialCustomer;
  final String initialMobile;
  final String initialMessage;

  @override
  State<HomeEnquiryFormPage> createState() => _HomeEnquiryFormPageState();
}

class _HomeEnquiryFormPageState extends State<HomeEnquiryFormPage> {
  final _customer = TextEditingController();
  final _mobile = TextEditingController();
  final _message = TextEditingController();
  final _mobileFocus = FocusNode();
  final _messageFocus = FocusNode();
  late Future<CrmCallEnquiryFormData> _formData;
  String? _group;
  String? _assignee;
  String? _customerId;
  String? _statusId;
  String? _priorityId;
  String? _matchedPartyName;
  var _isSaving = false;
  var _focusRequested = false;

  @override
  void initState() {
    super.initState();
    _customer.text = widget.initialCustomer;
    _mobile.text = widget.initialMobile;
    _message.text = widget.initialMessage;
    _formData = _loadFormData();
  }

  @override
  void dispose() {
    _customer.dispose();
    _mobile.dispose();
    _message.dispose();
    _mobileFocus.dispose();
    _messageFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('New enquiry'),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: FilledButton(
            onPressed: _isSaving ? null : _save,
            style: FilledButton.styleFrom(
              minimumSize: const Size(84, 42),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              backgroundColor: crmDockIconColor,
              foregroundColor: Colors.white,
              disabledBackgroundColor: crmDockIconColor.withValues(alpha: .65),
              disabledForegroundColor: Colors.white.withValues(alpha: .8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: _isSaving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ),
      ],
    ),
    bottomNavigationBar: _buildBottomDock(context),
    body: FutureBuilder<CrmCallEnquiryFormData>(
      future: _formData,
      builder: (context, snapshot) {
        if (snapshot.hasError) return _FormError(onRetry: _reload);
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final formData = snapshot.data!;
        _group ??= formData.groups.firstOrNull?.value;
        _statusId ??= _preferredStatus(formData.statuses, 'new')?.id;
        _priorityId ??= _preferredPriority(formData.priorities, 'normal')?.id;
        _focusMessage();
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
          children: [
            TextField(
              key: const ValueKey('enquiry-mobile'),
              controller: _mobile,
              focusNode: _mobileFocus,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              onChanged: _clearMatchedParty,
              decoration: InputDecoration(
                labelText: 'Mobile number',
                counterText: '',
                helperText: 'Use the 10-digit customer mobile number.',
                suffixIcon: IconButton(
                  key: const ValueKey('choose-enquiry-call-log'),
                  tooltip: 'Choose from call log',
                  onPressed: _chooseCallLogNumber,
                  icon: const Icon(Icons.phone_in_talk_outlined),
                ),
              ),
            ),
            if (_matchedPartyName case final name?) ...[
              const SizedBox(height: 6),
              _MatchedPartyLabel(
                key: const ValueKey('matched-enquiry-contact'),
                name: name,
              ),
            ],
            const SizedBox(height: 14),
            TextField(
              key: const ValueKey('enquiry-customer-name'),
              controller: _customer,
              textCapitalization: TextCapitalization.words,
              onChanged: (_) => setState(() {
                _customerId = null;
                _matchedPartyName = null;
              }),
              decoration: InputDecoration(
                labelText: 'Customer name (optional)',
                suffixIcon: IconButton(
                  tooltip: 'Find contact for this phone number',
                  onPressed: _lookupContact,
                  icon: const Icon(Icons.person_search_outlined),
                ),
              ),
            ),
            const SizedBox(height: 16),
            InlineSelectField(
              label: 'List',
              value: _group,
              options: formData.groups
                  .map(
                    (group) => InlineSelectOption(
                      value: group.value,
                      label: group.label,
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() => _group = value),
            ),
            const SizedBox(height: 16),
            InlineSelectField(
              label: 'Allocated',
              value: _assignee,
              options: [
                const InlineSelectOption(label: 'Not allocated', value: null),
                ...formData.assignees.map(
                  (assignee) => InlineSelectOption(
                    label: assignee.name,
                    value: assignee.id,
                  ),
                ),
              ],
              onChanged: (value) => setState(() => _assignee = value),
            ),
            const SizedBox(height: 16),
            TextField(
              key: const ValueKey('enquiry-message'),
              controller: _message,
              focusNode: _messageFocus,
              minLines: 5,
              maxLines: 8,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
                labelText: 'Enquiry message',
              ),
            ),
          ],
        );
      },
    ),
  );

  Future<CrmCallEnquiryFormData> _loadFormData() =>
      widget.api.callEnquiryFormData(widget.session.accessToken);

  static CrmCallEnquiryStatus? _preferredStatus(
    List<CrmCallEnquiryStatus> statuses,
    String code,
  ) =>
      statuses.where((status) => status.code.toLowerCase() == code).firstOrNull;

  static CrmCallEnquiryPriority? _preferredPriority(
    List<CrmCallEnquiryPriority> priorities,
    String code,
  ) => priorities
      .where((priority) => priority.code.toLowerCase() == code)
      .firstOrNull;

  void _reload() => setState(() {
    _focusRequested = false;
    _formData = _loadFormData();
  });

  void _focusMessage() {
    if (_focusRequested) return;
    _focusRequested = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.initialMobile.trim().isEmpty) {
        _mobileFocus.requestFocus();
      } else {
        _messageFocus.requestFocus();
      }
    });
  }

  Future<void> _save() async {
    final message = _message.text.trim();
    final customer = _customer.text.trim();
    final mobile = _mobile.text.replaceAll(RegExp(r'\D'), '');
    if (message.isEmpty || _group == null || _group!.isEmpty) {
      _showMessage('Add an enquiry message and choose a list.');
      return;
    }
    if (mobile.isNotEmpty && mobile.length != 10) {
      _showMessage('Enter a 10-digit mobile number.');
      return;
    }
    setState(() => _isSaving = true);
    try {
      final job = await widget.api.createEnquiry(
        accessToken: widget.session.accessToken,
        customer: _customerId ?? customer,
        mobile: mobile,
        title: _titleFromMessage(message),
        enquiryGroup: _group!,
        assignedToUserId: _assignee,
        message: message,
        statusId: _statusId,
        priorityId: _priorityId,
      );
      if (mounted) Navigator.pop(context, job);
    } on CrmMobileApiException catch (error) {
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Widget? _buildBottomDock(BuildContext context) {
    final dock = DashboardDockScope.maybeOf(context);
    if (dock == null ||
        dock.dockIsGlobal ||
        MediaQuery.viewInsetsOf(context).bottom > 0) {
      return null;
    }
    return SafeArea(
      top: false,
      child: AppFooterDock(
        selectedIndex: dock.navigation.selectedIndex,
        dashboardMode: false,
        jobBadgeCount: dock.navigation.jobBadgeCount,
        onDashboardCallLogs: dock.onDashboardCallLogs,
        onDestinationSelected: dock.onDestinationSelected,
      ),
    );
  }

  void _clearMatchedParty(String _) {
    if (_customerId == null && _matchedPartyName == null) return;
    setState(() {
      _customerId = null;
      _matchedPartyName = null;
    });
  }

  Future<void> _chooseCallLogNumber() async {
    final mobile = await MobileCallLogPickerSheet.show(context);
    if (!mounted || mobile == null) return;
    _clearMatchedParty(mobile);
    setState(() {
      _mobile.value = TextEditingValue(
        text: mobile,
        selection: TextSelection.collapsed(offset: mobile.length),
      );
    });
    _mobileFocus.unfocus();
  }

  Future<void> _lookupContact() async {
    final mobile = _mobile.text.replaceAll(RegExp(r'\D'), '');
    if (mobile.length != 10) {
      _showMessage('Enter the 10-digit phone number to search.');
      return;
    }
    final lookup = _findParties(mobile);
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: FutureBuilder<List<_PartyLookup>>(
          future: lookup,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const SizedBox(
                height: 152,
                child: Center(child: CircularProgressIndicator()),
              );
            }
            if (snapshot.hasError) {
              final error = snapshot.error;
              return SizedBox(
                height: 152,
                child: Center(
                  child: Text(
                    error is CrmMobileApiException
                        ? error.message
                        : 'Could not check this contact.',
                  ),
                ),
              );
            }
            final parties = snapshot.data ?? [];
            if (parties.isEmpty) {
              return SizedBox(
                height: 152,
                child: Center(child: Text('No contact found for $mobile.')),
              );
            }
            var selectedPartyId = _customerId;
            return StatefulBuilder(
              builder: (context, setSheetState) {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: ListView(
                        shrinkWrap: true,
                        children: parties.map((party) {
                          final selected = selectedPartyId == party.id;
                          return Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 3,
                            ),
                            child: Material(
                              color: selected
                                  ? Theme.of(context)
                                        .colorScheme
                                        .primaryContainer
                                        .withValues(alpha: 0.55)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                              child: ListTile(
                                key: ValueKey('contact-option-${party.id}'),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: BorderSide(
                                    color: selected
                                        ? Theme.of(context).colorScheme.primary
                                        : Theme.of(context)
                                              .colorScheme
                                              .outlineVariant,
                                  ),
                                ),
                                onTap: () => setSheetState(
                                  () => selectedPartyId = party.id,
                                ),
                                contentPadding: const EdgeInsets.fromLTRB(
                                  16,
                                  8,
                                  16,
                                  8,
                                ),
                                leading: Icon(
                                  party.type == 'Customer'
                                      ? Icons.person_outline_rounded
                                      : Icons.local_shipping_outlined,
                                ),
                                title: Text(party.name),
                                subtitle: Text(
                                  '${party.type} found for $mobile',
                                ),
                                trailing: selected
                                    ? Icon(
                                        Icons.check_circle_rounded,
                                        key: const ValueKey(
                                          'selected-contact-check',
                                        ),
                                        color: Theme.of(context)
                                            .colorScheme
                                            .primary,
                                      )
                                    : null,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      child: SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          key: const ValueKey('use-selected-contact'),
                          onPressed: selectedPartyId == null
                              ? null
                              : () {
                                  final party = parties.firstWhere(
                                    (item) => item.id == selectedPartyId,
                                  );
                                  setState(() {
                                    _matchedPartyName = party.name;
                                    _customer.text = party.name;
                                    _customerId = party.id;
                                  });
                                  Navigator.pop(sheetContext);
                                },
                          child: const Text('Use contact'),
                        ),
                      ),
                    ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }

  Future<List<_PartyLookup>> _findParties(String mobile) async {
    final parties = await widget.api.partiesByMobile(
      accessToken: widget.session.accessToken,
      mobile: mobile,
    );
    return parties
        .map(
          (party) =>
              _PartyLookup(name: party.name, id: party.id, type: party.type),
        )
        .toList();
  }

  void _showMessage(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
}

class _PartyLookup {
  const _PartyLookup({
    required this.name,
    required this.id,
    required this.type,
  });

  final String name;
  final String id;
  final String type;
}

class _MatchedPartyLabel extends StatelessWidget {
  const _MatchedPartyLabel({required this.name, super.key});

  final String name;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(
        Icons.check_circle_outline_rounded,
        color: Color(0xFF23824E),
        size: 16,
      ),
      const SizedBox(width: 6),
      Expanded(
        child: Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: const Color(0xFF23824E),
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    ],
  );
}

class _FormError extends StatelessWidget {
  const _FormError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: FilledButton.tonal(
      onPressed: onRetry,
      child: const Text('Could not load enquiry options. Retry'),
    ),
  );
}

String _titleFromMessage(String message) {
  final normalized = message.replaceAll(RegExp(r'\s+'), ' ').trim();
  const limit = 44;
  if (normalized.length <= limit) return normalized;
  return '${normalized.substring(0, limit - 1).trimRight()}…';
}
