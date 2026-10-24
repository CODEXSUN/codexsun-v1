import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/crm_mobile_api.dart';
import '../../core/config/app_config.dart';
import '../../core/presentation/app_brand_logo.dart';
import '../../core/notifications/mobile_notification_service.dart';
import '../../app/dashboard_navigation.dart';
import 'action_activity_page.dart';
import 'admin_call_log_page.dart';
import 'dashboard_home.dart';
import 'dashboard_jobs_feed.dart';
import 'dashboard_list_page.dart';
import 'duty_page.dart';
import 'my_enquiries_page.dart';
import 'home_enquiry_form_page.dart';
import 'my_reports_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({
    super.key,
    required this.api,
    required this.session,
    required this.navigation,
    required this.onSignOut,
    this.onReauthenticate,
    this.onResetPin,
    this.onCheckForUpdate,
    this.onChangePassword,
    this.enableLiveNotifications = true,
  });

  final CrmMobileApi api;
  final UserSession session;
  final DashboardNavigation navigation;
  final VoidCallback onSignOut;
  final VoidCallback? onReauthenticate;
  final Future<void> Function()? onResetPin;
  final Future<void> Function()? onCheckForUpdate;
  final Future<void> Function()? onChangePassword;
  final bool enableLiveNotifications;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  var _homeRefreshKey = 0;
  final _myEnquiriesKey = GlobalKey<MyEnquiriesPageState>();
  late final MobileNotificationService _mobileNotifications;
  late final DashboardJobsFeed _jobsFeed;

  @override
  void initState() {
    super.initState();
    _mobileNotifications = MobileNotificationService(
      api: widget.api,
      session: widget.session,
    );
    _jobsFeed = DashboardJobsFeed(api: widget.api, session: widget.session)
      ..start();
    widget.navigation.addListener(_onNavigationChanged);
    _mobileNotifications.addListener(_updateBadges);
    if (widget.enableLiveNotifications) {
      unawaited(_mobileNotifications.start());
    }
  }

  @override
  void dispose() {
    widget.navigation.removeListener(_onNavigationChanged);
    _mobileNotifications.removeListener(_updateBadges);
    _mobileNotifications.dispose();
    _jobsFeed.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant DashboardPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.accessToken == widget.session.accessToken) return;
    _jobsFeed.updateSession(widget.session);
    _mobileNotifications.updateSession(widget.session);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _mobileNotifications,
      builder: (context, _) => Scaffold(
        appBar: AppBar(
          toolbarHeight: 56,
          titleSpacing: 20,
          title: Row(
            children: [
              const AppBrandLogo(height: 28, width: 34),
              const SizedBox(width: 9),
              Text(AppConfig.brandName),
              if (_selectedIndex == 1 || _selectedIndex == 2) ...[
                const SizedBox(width: 12),
                Container(height: 28, width: 1, color: const Color(0xFFD7D1DA)),
                const SizedBox(width: 12),
                Text(
                  _selectedIndex == 1 ? 'Jobs' : 'Duty',
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
              ],
            ],
          ),
          actions: switch (_selectedIndex) {
            0 => [
              PopupMenuButton<_HomeMenuAction>(
                tooltip: 'Account options',
                icon: const Icon(Icons.more_vert_rounded),
                onSelected: _handleHomeMenuAction,
                itemBuilder: (context) => [
                  PopupMenuItem<_HomeMenuAction>(
                    enabled: false,
                    child: _AccountMenuHeader(profile: widget.session.profile),
                  ),
                  const PopupMenuDivider(),
                  PopupMenuItem(
                    value: _HomeMenuAction.resetPin,
                    child: const _HomeMenuItem(
                      icon: Icons.pin_outlined,
                      label: 'Reset PIN',
                    ),
                  ),
                  PopupMenuItem(
                    value: _HomeMenuAction.changePassword,
                    child: const _HomeMenuItem(
                      icon: Icons.lock_reset_outlined,
                      label: 'Change password',
                    ),
                  ),
                  const PopupMenuDivider(),
                  PopupMenuItem<_HomeMenuAction>(
                    enabled: false,
                    child: _CurrentVersionMenuItem(
                      version: AppConfig.appVersion,
                    ),
                  ),
                  PopupMenuItem(
                    value: _HomeMenuAction.checkForUpdates,
                    child: const _HomeMenuItem(
                      icon: Icons.system_update_alt_rounded,
                      label: 'Check for updates',
                    ),
                  ),
                  const PopupMenuDivider(),
                  PopupMenuItem(
                    value: _HomeMenuAction.signOut,
                    child: const _HomeMenuItem(
                      icon: Icons.logout,
                      label: 'Sign out',
                    ),
                  ),
                ],
              ),
            ],
            1 => const [],
            _ => const [],
          },
        ),
        body: SafeArea(top: false, child: _buildBody()),
      ),
    );
  }

  int get _selectedIndex => widget.navigation.selectedIndex;

  Widget _buildBody() {
    if (_selectedIndex == 0) {
      return DashboardHome(
        key: ValueKey(_homeRefreshKey),
        api: widget.api,
        session: widget.session,
        jobsFeed: _jobsFeed,
        assignmentCount: _mobileNotifications.assignmentCount,
        onOpenList: _selectDestination,
        onReauthenticate: widget.onReauthenticate,
      );
    }
    if (_selectedIndex == 1) {
      return MyEnquiriesPage(
        key: _myEnquiriesKey,
        api: widget.api,
        session: widget.session,
        embedded: true,
        onJobUpdated: _jobsFeed.updateJob,
        jobsFeed: _jobsFeed,
      );
    }
    if (_selectedIndex == 2) {
      return DutyPage(api: widget.api, session: widget.session);
    }
    return DashboardListPage(
      api: widget.api,
      session: widget.session,
      jobsFeed: _jobsFeed,
      section: dashboardListSections[_selectedIndex],
    );
  }

  void _onNavigationChanged() {
    if (!mounted) return;
    setState(() {});
    if (widget.navigation.takeMenuRequest()) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showMenu();
      });
    }
  }

  void _updateBadges() => widget.navigation.updateBadges(
    jobs: _mobileNotifications.assignmentCount,
  );

  void _selectDestination(int index) => widget.navigation.selectContent(index);

  Future<void> _openCallLogs() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) =>
            AdminCallLogPage(api: widget.api, session: widget.session),
      ),
    );
  }

  Future<void> _openActions() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => ActionActivityPage(
          api: widget.api,
          session: widget.session,
          jobsFeed: _jobsFeed,
        ),
      ),
    );
  }

  Future<void> _openReports() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) =>
            MyReportsPage(api: widget.api, session: widget.session),
      ),
    );
  }

  Future<void> _openNewEnquiryFromTab() async {
    final created = await Navigator.of(context).push<CrmJob>(
      MaterialPageRoute(
        builder: (context) =>
            HomeEnquiryFormPage(api: widget.api, session: widget.session),
      ),
    );
    if (created != null && mounted) {
      await _myEnquiriesKey.currentState?.refresh();
      await _jobsFeed.refresh();
      setState(() => _homeRefreshKey += 1);
    }
  }

  void _handleHomeMenuAction(_HomeMenuAction action) {
    if (action == _HomeMenuAction.signOut) {
      widget.onSignOut();
      return;
    }
    final task = switch (action) {
      _HomeMenuAction.resetPin => widget.onResetPin,
      _HomeMenuAction.changePassword => widget.onChangePassword,
      _HomeMenuAction.checkForUpdates => widget.onCheckForUpdate,
      _HomeMenuAction.signOut => null,
    };
    if (task != null) unawaited(task());
  }

  void _showMenu() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 6, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.note_add_outlined),
                  title: const Text('New enquiry'),
                  onTap: () {
                    Navigator.pop(context);
                    _openNewEnquiryFromTab();
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.call_outlined),
                  title: const Text('Call logs'),
                  subtitle: const Text(
                    'Your device call history and CRM notes.',
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    _openCallLogs();
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.bolt_outlined),
                  title: const Text('Activities'),
                  subtitle: const Text(
                    'Your enquiry activity from the last 7 days.',
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    _openActions();
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.description_outlined),
                  title: const Text('Reports'),
                  subtitle: const Text(
                    'Review reports from your assigned duties.',
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    _openReports();
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

enum _HomeMenuAction { resetPin, changePassword, checkForUpdates, signOut }

class _HomeMenuItem extends StatelessWidget {
  const _HomeMenuItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 20),
      const SizedBox(width: 12),
      Expanded(child: Text(label, overflow: TextOverflow.ellipsis)),
    ],
  );
}

class _AccountMenuHeader extends StatelessWidget {
  const _AccountMenuHeader({required this.profile});

  final UserProfile profile;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text('Account', style: Theme.of(context).textTheme.labelLarge),
      const SizedBox(height: 4),
      Text(profile.name, style: Theme.of(context).textTheme.titleSmall),
      Text(profile.email, style: Theme.of(context).textTheme.bodySmall),
    ],
  );
}

class _CurrentVersionMenuItem extends StatelessWidget {
  const _CurrentVersionMenuItem({required this.version});

  final String version;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(Icons.info_outline_rounded, size: 20),
      const SizedBox(width: 12),
      Expanded(child: Text('Current version $version')),
    ],
  );
}
