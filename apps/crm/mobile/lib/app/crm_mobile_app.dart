import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/api/crm_mobile_api.dart';
import '../core/auth/secure_session_store.dart';
import '../core/config/app_config.dart';
import '../core/update/app_update_service.dart';
import '../features/auth/login_page.dart';
import '../features/auth/change_password_dialog.dart';
import '../features/auth/pin_auth_pages.dart';
import '../features/dashboard/dashboard_page.dart';
import '../features/dashboard/admin_call_log_page.dart';
import '../features/dashboard/messages_sample_page.dart';
import 'app_footer_dock.dart';
import 'dashboard_navigation.dart';

class CrmMobileApp extends StatefulWidget {
  const CrmMobileApp({super.key});

  @override
  State<CrmMobileApp> createState() => _CrmMobileAppState();
}

class _CrmMobileAppState extends State<CrmMobileApp>
    with WidgetsBindingObserver {
  final _api = CrmMobileApi(AppConfig.apiUrl);
  final _updates = AppUpdateService();
  final _secureSession = SecureSessionStore();
  final _navigatorKey = GlobalKey<NavigatorState>();
  final _dashboardNavigation = DashboardNavigation();
  late final _routeObserver = _AppRouteObserver(() {
    if (mounted) setState(() {});
  });
  UserSession? _session;
  StoredSession? _storedSession;
  String _lastEmail = '';
  _AuthStage _stage = _AuthStage.loading;
  var _checkingForUpdate = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadLocalSession();
    _scheduleUpdateCheck();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _dashboardNavigation.dispose();
    _api.close();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused && _stage == _AuthStage.dashboard) {
      unawaited(_secureSession.touchActivity());
    }
    if (state == AppLifecycleState.resumed && _stage == _AuthStage.dashboard) {
      unawaited(_validateResumedSession());
    }
  }

  Future<void> _validateResumedSession() async {
    final stored = await _secureSession.readSession();
    if (stored == null || _stage != _AuthStage.dashboard) return;
    await _ensureValidServerSession(stored);
  }

  Future<void> _loadLocalSession() async {
    final hasPin = await _secureSession.hasPin();
    final stored = await _secureSession.readSession();
    final email = await _secureSession.lastEmail() ?? stored?.email ?? '';
    if (!mounted) return;
    if (hasPin) {
      setState(() {
        _lastEmail = email;
        _storedSession =
            stored ??
            StoredSession(
              accessToken: '',
              email: email,
              lastActivityAt: DateTime.now().toUtc(),
              biometricEnabled: false,
            );
        _stage = _AuthStage.unlock;
      });
      return;
    }
    setState(() {
      _lastEmail = email;
      _storedSession = null;
      _stage = _AuthStage.login;
    });
  }

  Future<void> _signedIn(
    UserSession session, {
    String? password,
    String? corporateId,
  }) async {
    await _secureSession.saveLogin(
      email: session.profile.email,
      accessToken: session.accessToken,
      profile: session.profile,
      corporateId: corporateId,
      password: password,
    );
    final hasPin = await _secureSession.hasPin();
    if (!mounted) return;
    setState(() {
      _session = session;
      _lastEmail = session.profile.email;
      _stage = hasPin ? _AuthStage.dashboard : _AuthStage.setupPin;
    });
    if (hasPin) _scheduleUpdateCheck();
  }

  Future<void> _savePin(String pin, bool useBiometric) async {
    await _secureSession.setPin(pin, useBiometric: useBiometric);
    if (!mounted) return;
    setState(() => _stage = _AuthStage.dashboard);
    _scheduleUpdateCheck();
  }

  Future<bool> _unlockWithPin(String pin) async {
    if (!await _secureSession.verifyPin(pin)) return false;
    return _restoreUnlockedSession();
  }

  Future<bool> _unlockWithBiometric() async {
    if (!await _secureSession.authenticateBiometric()) return false;
    return _restoreUnlockedSession();
  }

  Future<bool> _restoreUnlockedSession() async {
    final stored = _storedSession ?? await _secureSession.readSession();
    if (stored == null) return false;

    if (!mounted) return false;
    setState(() {
      _session = UserSession(
        accessToken: stored.accessToken,
        profile: stored.profile,
      );
      _stage = _AuthStage.dashboard;
    });

    await _secureSession.touchActivity();
    _scheduleUpdateCheck();
    unawaited(_ensureValidServerSession(stored));
    return true;
  }

  Future<void> _ensureValidServerSession(StoredSession stored) async {
    if (stored.accessToken.isNotEmpty) {
      try {
        final profile = await _api.session(stored.accessToken);
        if (!mounted || _stage != _AuthStage.dashboard) return;
        setState(() {
          _session = UserSession(
            accessToken: stored.accessToken,
            profile: profile,
          );
        });
        await _secureSession.saveProfile(profile);
        await _secureSession.touchActivity();
        return;
      } catch (_) {
        // Access token might be expired on the server; attempt silent renewal
      }
    }

    if (stored.savedPassword.isNotEmpty && stored.email.isNotEmpty) {
      try {
        final renewed = await _api.signIn(
          email: stored.email,
          password: stored.savedPassword,
          corporateId: stored.corporateId,
        );
        await _secureSession.saveLogin(
          email: renewed.profile.email,
          accessToken: renewed.accessToken,
          profile: renewed.profile,
          corporateId: stored.corporateId,
          password: stored.savedPassword,
        );
        if (!mounted || _stage != _AuthStage.dashboard) return;
        setState(() {
          _session = renewed;
        });
        await _secureSession.touchActivity();
      } catch (_) {
        // Network unavailable or server error; keep active cached session
      }
    }
  }

  void _usePasswordLogin() {
    setState(() {
      _stage = _AuthStage.login;
    });
  }

  Future<void> _signOut() async {
    await _secureSession.clearSession(forgetAccount: true);
    if (!mounted) return;
    setState(() {
      _session = null;
      _storedSession = null;
      _lastEmail = '';
      _stage = _AuthStage.login;
    });
  }

  Future<void> _resetPin() async {
    final session = _session;
    final navigatorContext = _navigatorKey.currentContext;
    if (session == null || navigatorContext == null) return;
    final confirmed = await showDialog<bool>(
      context: navigatorContext,
      builder: (context) => PasswordConfirmationDialog(
        onConfirm: (password) async {
          try {
            final renewed = await _api.signIn(
              email: session.profile.email,
              password: password,
            );
            await _secureSession.saveLogin(
              email: renewed.profile.email,
              accessToken: renewed.accessToken,
              profile: renewed.profile,
              password: password,
            );
            _session = renewed;
            return null;
          } on CrmMobileApiException catch (error) {
            return error.message;
          } catch (_) {
            return 'Could not verify your password.';
          }
        },
      ),
    );
    if (confirmed != true || !mounted) return;
    final biometricAvailable = await _secureSession.canUseBiometrics();
    if (!mounted) return;
    await _navigatorKey.currentState?.push<void>(
      MaterialPageRoute(
        builder: (context) => PinSetupPage(
          isReset: true,
          biometricAvailable: biometricAvailable,
          onComplete: (pin, useBiometric) async {
            await _secureSession.setPin(pin, useBiometric: useBiometric);
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ),
    );
  }

  Future<void> _changePassword() async {
    final session = _session;
    final navigatorContext = _navigatorKey.currentContext;
    if (session == null || navigatorContext == null) return;
    final value = await showDialog<PasswordChange>(
      context: navigatorContext,
      builder: (context) => const ChangePasswordDialog(),
    );
    if (value == null) return;
    try {
      final verified = await _api.signIn(
        email: session.profile.email,
        password: value.currentPassword,
      );
      final accessToken = await _api.changePassword(
        accessToken: verified.accessToken,
        profile: session.profile,
        password: value.newPassword,
      );
      await _secureSession.saveLogin(
        email: session.profile.email,
        accessToken: accessToken,
        profile: session.profile,
        password: value.newPassword,
      );
      if (!mounted || !navigatorContext.mounted) return;
      setState(() {
        _session = UserSession(
          accessToken: accessToken,
          profile: session.profile,
        );
      });
      ScaffoldMessenger.of(navigatorContext).showSnackBar(
        const SnackBar(content: Text('Password changed successfully.')),
      );
    } on CrmMobileApiException catch (error) {
      if (navigatorContext.mounted) {
        ScaffoldMessenger.of(navigatorContext)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  void _scheduleUpdateCheck() {
    if (AppConfig.releaseManifestUrl.isEmpty) return;
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkForUpdate());
  }

  Future<void> _checkForUpdate({bool reportCurrent = false}) async {
    if (AppConfig.releaseManifestUrl.isEmpty) {
      if (reportCurrent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('App updates are not configured.')),
        );
      }
      return;
    }
    if (_checkingForUpdate) return;
    _checkingForUpdate = true;
    try {
      final release = await _updates.checkForUpdate();
      final appContext = _navigatorKey.currentContext;
      if (!mounted || appContext == null || !appContext.mounted) return;
      if (release == null) {
        if (reportCurrent) {
          ScaffoldMessenger.of(appContext).showSnackBar(
            SnackBar(content: Text('${AppConfig.brandName} is up to date.')),
          );
        }
        return;
      }
      await showDialog<void>(
        context: appContext,
        barrierDismissible: !release.mandatory,
        builder: (context) => _AppUpdateDialog(
          release: release,
          onInstall: () => _installUpdate(release),
        ),
      );
    } on AppUpdateException catch (error) {
      final appContext = _navigatorKey.currentContext;
      if (reportCurrent &&
          mounted &&
          appContext != null &&
          appContext.mounted) {
        ScaffoldMessenger.of(appContext)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      _checkingForUpdate = false;
    }
  }

  Future<void> _installUpdate(AppRelease release) async {
    final appContext = _navigatorKey.currentContext;
    if (appContext == null) return;
    final messenger = ScaffoldMessenger.of(appContext);
    try {
      await _updates.downloadAndInstall(release);
    } on AppUpdatePermissionRequired {
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Allow ${AppConfig.brandName} to install updates, then choose Update again.',
          ),
        ),
      );
    } on AppUpdateException catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey,
      navigatorObservers: [_routeObserver],
      debugShowCheckedModeBanner: false,
      title: AppConfig.brandName,
      theme: ThemeData(
        colorScheme:
            ColorScheme.fromSeed(
              seedColor: _brandPurple,
              brightness: Brightness.light,
            ).copyWith(
              primary: _brandPurple,
              onPrimary: Colors.white,
              secondary: _brandPurple,
              onSecondary: Colors.white,
              surface: Colors.white,
              onSurface: const Color(0xFF241D2A),
              surfaceContainerLowest: Colors.white,
              surfaceContainerLow: Colors.white,
              surfaceContainer: Colors.white,
              surfaceContainerHigh: Colors.white,
              surfaceContainerHighest: Colors.white,
              outline: const Color(0xFFD8D2DE),
              outlineVariant: const Color(0xFFE8E4EB),
            ),
        scaffoldBackgroundColor: Colors.white,
        canvasColor: Colors.white,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF241D2A),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          systemOverlayStyle: SystemUiOverlayStyle(
            statusBarColor: Colors.white,
            statusBarIconBrightness: Brightness.dark,
            statusBarBrightness: Brightness.light,
            systemNavigationBarColor: Colors.white,
            systemNavigationBarIconBrightness: Brightness.dark,
            systemNavigationBarDividerColor: Colors.white,
          ),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          surfaceTintColor: Colors.transparent,
          elevation: 2,
          shadowColor: const Color(0x24140D1B),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFFE1DCE6)),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: _brandPurple,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
            minimumSize: const Size(44, 44),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: _brandPurple,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
            minimumSize: const Size(44, 44),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: _brandPurple,
            side: const BorderSide(color: _brandPurple),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
            minimumSize: const Size(44, 44),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(foregroundColor: _brandPurple),
        ),
        iconButtonTheme: IconButtonThemeData(
          style: IconButton.styleFrom(foregroundColor: _brandPurple),
        ),
        floatingActionButtonTheme: FloatingActionButtonThemeData(
          backgroundColor: _brandPurple,
          foregroundColor: Colors.white,
          elevation: 3,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        switchTheme: SwitchThemeData(
          thumbColor: const WidgetStatePropertyAll(Colors.white),
          trackColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? _brandPurple
                : const Color(0xFFE6E1EA),
          ),
          trackOutlineColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? _brandPurple
                : const Color(0xFFCEC8D4),
          ),
        ),
        progressIndicatorTheme: const ProgressIndicatorThemeData(
          color: _brandPurple,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFFD8D2DE)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFFD8D2DE)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _brandPurple, width: 1.5),
          ),
        ),
        dividerTheme: const DividerThemeData(color: Color(0xFFE8E4EB)),
        dialogTheme: const DialogThemeData(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
        ),
        useMaterial3: true,
      ),
      builder: (context, child) {
        return _AuthenticatedAppShell(
          navigation: _dashboardNavigation,
          navigatorKey: _navigatorKey,
          showDock: _stage == _AuthStage.dashboard,
          onDashboardCallLogs: _openDashboardCallLogs,
          onDashboardChat: _openDashboardChat,
          child: child ?? const SizedBox.shrink(),
        );
      },
      home: _buildHome(),
    );
  }

  Widget _buildHome() {
    switch (_stage) {
      case _AuthStage.loading:
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      case _AuthStage.login:
        return LoginPage(
          api: _api,
          initialEmail: _lastEmail,
          onSignedIn: _signedIn,
        );
      case _AuthStage.setupPin:
        return FutureBuilder<bool>(
          future: _secureSession.canUseBiometrics(),
          builder: (context, snapshot) => PinSetupPage(
            biometricAvailable: snapshot.data ?? false,
            onComplete: _savePin,
          ),
        );
      case _AuthStage.unlock:
        final stored = _storedSession!;
        return PinUnlockPage(
          email: stored.email.isNotEmpty ? stored.email : _lastEmail,
          biometricEnabled: stored.biometricEnabled,
          onPin: _unlockWithPin,
          onBiometric: _unlockWithBiometric,
          onUsePassword: _usePasswordLogin,
        );
      case _AuthStage.dashboard:
        return DashboardPage(
          api: _api,
          session: _session!,
          navigation: _dashboardNavigation,
          onResetPin: _resetPin,
          onChangePassword: _changePassword,
          onCheckForUpdate: () => _checkForUpdate(reportCurrent: true),
          onSignOut: _signOut,
          onReauthenticate: _usePasswordLogin,
        );
    }
  }

  Future<void> _openDashboardCallLogs() async {
    final session = _session;
    final navigator = _navigatorKey.currentState;
    if (session == null || navigator == null) return;
    await navigator.push<void>(
      MaterialPageRoute<void>(
        builder: (_) => AdminCallLogPage(api: _api, session: session),
      ),
    );
  }

  Future<void> _openDashboardChat() async {
    final session = _session;
    final navigator = _navigatorKey.currentState;
    if (session == null || navigator == null) return;
    navigator.popUntil((route) => route.isFirst);
    await navigator.push<void>(
      MaterialPageRoute<void>(
        builder: (_) => MessagesPage(api: _api, session: session),
      ),
    );
  }
}

const _brandPurple = Color(0xFF662C90);

enum _AuthStage { loading, login, setupPin, unlock, dashboard }

class _AuthenticatedAppShell extends StatelessWidget {
  const _AuthenticatedAppShell({
    required this.navigation,
    required this.navigatorKey,
    required this.showDock,
    required this.onDashboardCallLogs,
    required this.onDashboardChat,
    required this.child,
  });

  final DashboardNavigation navigation;
  final GlobalKey<NavigatorState> navigatorKey;
  final bool showDock;
  final Future<void> Function() onDashboardCallLogs;
  final Future<void> Function() onDashboardChat;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final content = showDock
        ? AnimatedBuilder(
            animation: navigation,
            builder: (context, _) {
              final keyboardIsVisible =
                  MediaQuery.viewInsetsOf(context).bottom > 0;
              final dockIsVisible = !keyboardIsVisible;
              return Stack(
                children: [
                  Padding(
                    padding: EdgeInsets.only(bottom: dockIsVisible ? 82 : 0),
                    child: child,
                  ),
                  if (dockIsVisible)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: SafeArea(
                        top: false,
                        child: AppFooterDock(
                          selectedIndex: navigation.selectedIndex,
                          dashboardMode: navigation.selectedIndex == 0,
                          jobBadgeCount: navigation.jobBadgeCount,
                          onDashboardCallLogs: () =>
                              unawaited(onDashboardCallLogs()),
                          onDashboardChat: () => unawaited(onDashboardChat()),
                          onDestinationSelected: _selectDockDestination,
                        ),
                      ),
                    ),
                ],
              );
            },
          )
        : child;
    return DashboardDockScope(
      navigation: navigation,
      onDestinationSelected: _selectDockDestination,
      onDashboardCallLogs: () => unawaited(onDashboardCallLogs()),
      dockIsGlobal: true,
      child: content,
    );
  }

  void _selectDockDestination(int index) {
    if (index == 3) {
      navigation.selectDockDestination(index);
      return;
    }
    navigatorKey.currentState?.popUntil((route) => route.isFirst);
    navigation.selectDockDestination(index);
  }
}

class _AppUpdateDialog extends StatelessWidget {
  const _AppUpdateDialog({required this.release, required this.onInstall});

  final AppRelease release;
  final Future<void> Function() onInstall;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: const Icon(Icons.system_update_alt_rounded),
      title: Text('${AppConfig.brandName} ${release.versionName} is ready'),
      content: Text(
        release.notes.isEmpty
            ? 'Download the latest version now?'
            : release.notes,
      ),
      actions: [
        if (!release.mandatory)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Later'),
          ),
        FilledButton(
          onPressed: () async {
            await onInstall();
          },
          child: const Text('Update'),
        ),
      ],
    );
  }
}

class _AppRouteObserver extends NavigatorObserver {
  _AppRouteObserver(this.onRouteChanged);
  final VoidCallback onRouteChanged;

  void _schedule() {
    WidgetsBinding.instance.addPostFrameCallback((_) => onRouteChanged());
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _schedule();

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _schedule();

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _schedule();

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) =>
      _schedule();
}
