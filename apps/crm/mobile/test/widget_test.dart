import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

import 'package:codexsun_crm_mobile/core/api/crm_mobile_api.dart';
import 'package:codexsun_crm_mobile/core/auth/secure_session_store.dart';
import 'package:codexsun_crm_mobile/core/config/app_config.dart';
import 'package:codexsun_crm_mobile/core/update/app_update_service.dart';
import 'package:codexsun_crm_mobile/app/app_footer_dock.dart';
import 'package:codexsun_crm_mobile/app/dashboard_navigation.dart';
import 'package:codexsun_crm_mobile/features/auth/login_page.dart';
import 'package:codexsun_crm_mobile/features/auth/pin_auth_pages.dart';
import 'package:codexsun_crm_mobile/features/dashboard/dashboard_list_page.dart';
import 'package:codexsun_crm_mobile/features/dashboard/dashboard_jobs_feed.dart';
import 'package:codexsun_crm_mobile/features/dashboard/dashboard_home.dart';
import 'package:codexsun_crm_mobile/features/dashboard/dashboard_page.dart';
import 'package:codexsun_crm_mobile/features/dashboard/admin_call_log_page.dart';
import 'package:codexsun_crm_mobile/features/dashboard/call_log_notes_page.dart';
import 'package:codexsun_crm_mobile/features/dashboard/job_detail_page.dart';
import 'package:codexsun_crm_mobile/features/dashboard/job_enquiry_card.dart';
import 'package:codexsun_crm_mobile/features/dashboard/job_duration.dart';
import 'package:codexsun_crm_mobile/features/dashboard/job_work_feed.dart';
import 'package:codexsun_crm_mobile/features/dashboard/work_timestamp_format.dart';
import 'package:codexsun_crm_mobile/features/dashboard/messages_sample_page.dart';
import 'package:codexsun_crm_mobile/features/dashboard/my_enquiries_page.dart';
import 'package:codexsun_crm_mobile/features/dashboard/home_enquiry_form_page.dart';
import 'package:codexsun_crm_mobile/features/dashboard/task_form_page.dart';
import 'package:codexsun_crm_mobile/features/dashboard/tasks_page.dart';

void main() {
  test(
    'tenant identity and email prefixes do not imply an administrator role',
    () {
      expect(
        UserProfile.fromJson({
          'email': 'admin@example.test',
          'userType': 'tenant',
        }).role,
        'user',
      );
      expect(
        UserProfile.fromJson({
          'email': 'field@example.test',
          'userType': 'tenant',
          'role': 'user',
        }).role,
        'user',
      );
      expect(
        UserProfile.fromJson({'email': 'admin@example.test', 'role': 'admin'})
            .role,
        'admin',
      );
    },
  );
  test('uses the local development host for Android emulator API calls', () {
    expect(AppConfig.apiUrl, 'http://10.0.2.2:7010');
    expect(CrmMobileApi('http://10.0.2.2:7010').hostHeader, '127.0.0.1:7010');
    expect(CrmMobileApi('https://crm.example.com').hostHeader, isNull);
  });

  test('resets the session after ten inactive days', () {
    final store = SecureSessionStore();
    final current = StoredSession(
      accessToken: 'token',
      email: 'user@example.com',
      lastActivityAt: DateTime.now().toUtc().subtract(const Duration(days: 9)),
      biometricEnabled: false,
    );
    final expired = StoredSession(
      accessToken: 'token',
      email: 'user@example.com',
      lastActivityAt: DateTime.now().toUtc().subtract(const Duration(days: 11)),
      biometricEnabled: false,
    );

    expect(store.isActive(current), isTrue);
    expect(store.isActive(expired), isFalse);
  });

  test('compares app update versions safely', () {
    expect(isNewerVersion('1.0.2', '1.0.1'), isTrue);
    expect(isNewerVersion('1.0.1', '1.0.1'), isFalse);
    expect(isNewerVersion('1.0.0', '1.0.1'), isFalse);
  });

  test('rejects an HTML update response without crashing', () {
    expect(
      () => AppRelease.fromJson({'versionName': '<!doctype html>'}),
      throwsA(isA<AppUpdateException>()),
    );
  });

  test('uses the other member as a direct conversation title', () {
    final conversation = MessagingConversation.fromJson({
      'id': 44,
      'members': [
        {'email': 'vijay@example.com', 'userName': 'Vijay'},
        {'email': 'meera@example.com', 'userName': 'Meera'},
      ],
      'updatedAt': '2026-09-02T10:00:00.000Z',
    }, 'vijay@example.com');

    expect(conversation.title, 'Meera');
  });

  test('converts rich-text comments to readable mobile text', () {
    final comment = CrmComment.fromJson({
      'id': 'message-1',
      'comment':
          '<p>Test &amp; verify</p><p>Second&nbsp;line<br>Done &#x2713;</p>',
      'createdAt': '2026-08-03T11:42:00.000Z',
      'createdByUserId': 'vijay@example.com',
    });

    expect(comment.comment, 'Test & verify\nSecond line\nDone ✓');
  });

  test('maps enquiry location coordinates and capture time', () {
    final location = CrmEnquiryLocation.fromJson({
      'id': 5,
      'latitude': 13.0827,
      'longitude': 80.2707,
      'accuracyMeters': 8.5,
      'capturedAt': '2026-10-14T12:00:00.000Z',
      'createdBy': 'worker@example.com',
    });

    expect(location.latitude, 13.0827);
    expect(location.longitude, 80.2707);
    expect(location.accuracyMeters, 8.5);
    expect(location.capturedAt.toUtc(), DateTime.utc(2026, 10, 14, 12));
  });

  test('maps CRM job executions and enquiry activities', () {
    final job = CrmJob.fromJson({
      'id': 762,
      'messages': <Object>[],
      'jobs': [
        {
          'name': 'JOBEXE3',
          'employee': 'HR-EMP-00001',
          'createdAt': '2026-08-03T09:17:45.000Z',
          'startTime': '14:47:45',
          'stopTime': '14:48:12',
          'hours': 0.01,
          'employeeCostPerHour': 0,
          'totalCost': 0,
          'status': 'Completed',
        },
      ],
      'activities': [
        {
          'uuid': 'activity-1',
          'action': 'changed',
          'details': 'Vijay changed Status',
          'createdAt': '2026-08-03T09:18:12.000Z',
        },
      ],
    });

    expect(job.jobs.single.name, 'JOBEXE3');
    expect(job.jobs.single.status, 'Completed');
    expect(job.activities.single.details, 'Vijay changed Status');
  });

  test('maps CODEXSUN CRM enquiry records and work jobs', () {
    final enquiry = CrmJob.fromJson({
      'id': '35',
      'enquiryNo': '1807',
      'title': 'Core replacement',
      'description': 'Discuss the replacement options.',
      'capturedName': 'Acme Ltd',
      'capturedPhone': '9876543210',
      'listIn': 'Accounts',
      'dueDate': '2026-10-30',
      'createdBy': 'Maya',
      'createdByName': 'Maya K',
      'createdAt': '2026-10-12T08:15:00.000Z',
      'status': 'new',
      'statusName': 'New',
      'priority': 'normal',
      'priorityName': 'Normal',
      'assignedToName': 'Ravi',
      'messages': [
        {
          'id': '4',
          'body': 'Called customer',
          'createdBy': 'Maya',
          'createdAt': '2026-10-12T09:00:00.000Z',
        },
      ],
      'jobs': [
        {
          'id': '9',
          'employee': 'Ravi',
          'startAt': '2026-10-12T09:30:00.000Z',
          'stopAt': null,
          'durationSeconds': 300,
          'ratePerHour': 100,
          'totalCost': 8.33,
          'status': 'running',
          'createdAt': '2026-10-12T09:30:00.000Z',
        },
      ],
      'activities': [],
    });

    expect(enquiry.number, '1807');
    expect(enquiry.createdBy, 'Maya K');
    expect(enquiry.customer, 'Acme Ltd');
    expect(enquiry.assignedTo, 'Ravi');
    expect(enquiry.comments.single.comment, 'Called customer');
    expect(enquiry.jobs.single.isRunning, isTrue);
    expect(enquiry.jobs.single.hours, closeTo(5 / 60, 0.0001));
  });

  test('normalizes escaped Frappe rich text for enquiry and comment display', () {
    const frappeText =
        '&lt;div class=&quot;ql-editor read-mode&quot;&gt;&lt;p&gt;Ledger issue &lt;/p&gt;&lt;/div&gt;';
    expect(normalizeCrmText(frappeText), 'Ledger issue');

    final enquiry = CrmJob.fromJson({
      'id': '35',
      'title': frappeText,
      'messages': [
        {
          'id': '1',
          'body': frappeText,
          'createdAt': '2026-10-12T09:00:00.000Z',
        },
      ],
      'jobs': [],
      'activities': [],
    });
    expect(enquiry.title, 'Ledger issue');
    expect(enquiry.comments.single.comment, 'Ledger issue');
  });

  test('maps live SOP duties and reporting for mobile', () {
    final duty = CrmDuty.fromJson({
      'department': 'Stores - TMR',
      'frequency': 'Daily',
      'id': 42,
      'itemTitle': 'Opening Checklist',
      'instructions': '<p>Check the counter.</p>',
      'sopTitle': 'Store Opening',
    });

    expect(duty.assignmentId, 42);
    expect(duty.sopName, 'Store Opening · Opening Checklist');
    expect(duty.steps, 'Check the counter.');
  });

  test('formats job duration from actual recorded times', () {
    CrmJobExecution execution({
      required String start,
      String? stop,
      double hours = 0,
    }) => CrmJobExecution(
      name: 'JOBEXE1',
      employee: 'HR-EMP-00001',
      createdAt: DateTime(2026, 8, 30),
      date: '2026-08-30',
      startTime: start,
      stopTime: stop,
      hours: hours,
      employeeCostPerHour: 0,
      totalCost: 0,
      status: stop == null ? 'Running' : 'Completed',
    );

    expect(
      formatJobDuration(execution(start: '09:43:38', stop: '09:43:47')),
      '9 sec',
    );
    expect(
      formatJobDuration(execution(start: '09:43:38', stop: '09:45:12')),
      '1 min',
    );
    expect(
      formatJobDuration(execution(start: '09:43:38', stop: '10:45:12')),
      '1 hr 1 min',
    );
    expect(
      formatJobDuration(
        execution(start: '09:43:38'),
        now: DateTime(2026, 8, 30, 9, 43, 48),
      ),
      '10 sec',
    );
    final isoStart = DateTime.parse('2026-08-30T09:43:38Z');
    expect(
      formatJobDuration(
        execution(start: '2026-08-30T09:43:38Z'),
        now: isoStart.toLocal().add(const Duration(seconds: 10)),
      ),
      '10 sec',
    );
    expect(
      formatJobDuration(execution(start: '', stop: null, hours: 0.5)),
      'Running',
    );
    expect(
      formatJobDurationClock(
        execution(start: '09:43:38'),
        now: DateTime(2026, 8, 30, 9, 43, 48),
      ),
      '00:10',
    );
    final now = DateTime.now();
    CrmJobExecution runningFor(String name, int seconds) => CrmJobExecution(
      name: name,
      employee: 'HR-EMP-00001',
      createdAt: now,
      date: null,
      startTime: now
          .subtract(Duration(seconds: seconds))
          .toUtc()
          .toIso8601String(),
      stopTime: null,
      hours: 0,
      employeeCostPerHour: 0,
      totalCost: 0,
      status: 'Running',
    );
    final shortest = _testCrmJob.withJobs([runningFor('shortest', 10)]);
    final longest = _testCrmJob.withJobs([runningFor('longest', 90)]);
    final sorted = sortRunningJobsFirst([
      longest,
      _testCrmJob.withJobs(const []),
      shortest,
    ]);
    expect(sorted.first.jobs.single.name, 'longest');
    expect(sorted[1].jobs.single.name, 'shortest');
    expect(sorted.last.jobs, isEmpty);
  });

  testWidgets('shows the CRM sign-in screen', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoginPage(
          api: CrmMobileApi('http://127.0.0.1:7010'),
          onSignedIn: (session, {corporateId, password}) {},
        ),
      ),
    );

    expect(find.text('Welcome'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('unlocks automatically after four PIN digits', (
    WidgetTester tester,
  ) async {
    String? submittedPin;
    await tester.pumpWidget(
      MaterialApp(
        home: PinUnlockPage(
          email: 'vijay@example.com',
          biometricEnabled: false,
          onPin: (pin) async {
            submittedPin = pin;
            return true;
          },
          onBiometric: () async => false,
          onUsePassword: () {},
        ),
      ),
    );

    final pinInput = tester.widget<TextField>(find.byType(TextField));
    expect(pinInput.autofocus, isTrue);

    await tester.enterText(find.byType(TextField), '12345');
    await tester.pump();

    expect(submittedPin, '1234');
    expect(find.text('•'), findsNWidgets(4));
  });

  testWidgets('sets a PIN automatically after both four-digit entries', (
    WidgetTester tester,
  ) async {
    String? savedPin;
    await tester.pumpWidget(
      MaterialApp(
        home: PinSetupPage(
          biometricAvailable: false,
          onComplete: (pin, _) async => savedPin = pin,
        ),
      ),
    );

    final inputs = find.byType(TextField);
    expect(inputs, findsNWidgets(2));
    expect(tester.widget<TextField>(inputs.first).autofocus, isTrue);

    await tester.enterText(inputs.first, '2468');
    await tester.pump();
    await tester.enterText(inputs.last, '2468');
    await tester.pump();

    expect(savedPin, '2468');
  });

  testWidgets('shows the dashboard dock destinations', (
    WidgetTester tester,
  ) async {
    final navigation = DashboardNavigation();
    var dashboardCallLogsOpened = 0;
    var dashboardChatOpened = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Stack(
          children: [
            DashboardPage(
              api: _FakeCrmMobileApi(),
              session: const UserSession(
                accessToken: 'test-token',
                profile: UserProfile(
                  name: 'Vijay Anand',
                  email: 'vijay@example.com',
                  role: 'admin',
                ),
              ),
              navigation: navigation,
              onSignOut: () {},
              enableLiveNotifications: false,
            ),
            AnimatedBuilder(
              animation: navigation,
              builder: (context, _) => Align(
                alignment: Alignment.bottomCenter,
                child: AppFooterDock(
                  selectedIndex: navigation.selectedIndex,
                  dashboardMode: navigation.selectedIndex == 0,
                  onDashboardCallLogs: () => dashboardCallLogsOpened++,
                  onDashboardChat: () => dashboardChatOpened++,
                  onDestinationSelected: navigation.selectDockDestination,
                ),
              ),
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Jobs'), findsOneWidget);
    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Enquiries'), findsNothing);
    expect(find.text('Menu'), findsOneWidget);
    expect(find.text('Duty'), findsOneWidget);
    expect(find.text('Tasks'), findsOneWidget);
    expect(find.text('Call logs'), findsOneWidget);
    expect(find.text('Activities'), findsNothing);
    expect(find.text('Reports'), findsNothing);
    expect(find.byIcon(Icons.forum_outlined), findsOneWidget);
    expect(find.byTooltip('Notifications'), findsNothing);
    expect(find.text('3'), findsOneWidget);

    await tester.tap(find.text('Call logs'));
    expect(dashboardCallLogsOpened, 1);

    await tester.tap(find.text('Chat'));
    expect(dashboardChatOpened, 1);

    await tester.tap(find.text('Menu'));
    await tester.pumpAndSettle();
    expect(find.text('Duty'), findsOneWidget);
    expect(
      find.ancestor(of: find.text('Tasks'), matching: find.byType(ListTile)),
      findsNothing,
    );
    expect(find.text('Call logs'), findsNWidgets(2));
    expect(find.text('Activities'), findsOneWidget);
    expect(find.text('Reports'), findsOneWidget);
    Navigator.of(tester.element(find.text('Activities').last)).pop();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Account options'));
    await tester.pumpAndSettle();
    expect(find.text('Account'), findsOneWidget);
    expect(find.text('vijay@example.com'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
    Navigator.of(tester.element(find.text('Account'))).pop();
    await tester.pumpAndSettle();

    expect(dashboardChatOpened, 1);
  });

  testWidgets('show page keeps comments in actions without a reply composer', (
    WidgetTester tester,
  ) async {
    final fakeApi = _FakeCrmMobileApi();
    fakeApi._job = CrmJob(
      id: _testCrmJob.id,
      sourceId: _testCrmJob.sourceId,
      number: _testCrmJob.number,
      title: _testCrmJob.title,
      customer: _testCrmJob.customer,
      list: _testCrmJob.list,
      dueDate: _testCrmJob.dueDate,
      createdBy: _testCrmJob.createdBy,
      createdAt: _testCrmJob.createdAt,
      lastAction: _testCrmJob.lastAction,
      status: _testCrmJob.status,
      priority: _testCrmJob.priority,
      comments: [
        CrmComment(
          id: 'system-start',
          comment: 'Job started by Vijay Anand.',
          createdAt: DateTime(2026, 10, 22),
          createdByUserId: 'vijay@example.com',
        ),
      ],
      jobs: const [],
      activities: const [],
    );
    await tester.pumpWidget(
      MaterialApp(
        home: JobDetailPage(
          api: fakeApi,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
          initialJob: fakeApi._job,
          capturePosition: () async => Position(
            latitude: 13.0827,
            longitude: 80.2707,
            timestamp: DateTime(2026, 10, 14),
            accuracy: 8.5,
            altitude: 0,
            altitudeAccuracy: 0,
            heading: 0,
            headingAccuracy: 0,
            speed: 0,
            speedAccuracy: 0,
          ),
          enquiry: const DashboardListItem(
            enquiryNumber: '762',
            title: 'ROG Asus Adopter 240W',
            customer: 'Vee Cee Exports',
            list: 'Spares',
            assignedTo: 'Vijay Anand',
            dueDate: '03 Aug',
            createdBy: 'Vijay Anand',
            createdAgo: '3 days ago',
            lastAction: 'Awaiting customer confirmation',
          ),
        ),
      ),
    );

    expect(find.text('#762  Open'), findsOneWidget);
    expect(find.text('Comments'), findsNothing);
    expect(find.text('Jobs'), findsNothing);
    expect(find.text('Activity'), findsNothing);
    expect(find.text('Write a comment only'), findsNothing);
    expect(find.byTooltip('Send reply'), findsNothing);
    expect(
      tester.widget<Scaffold>(find.byType(Scaffold)).bottomNavigationBar,
      isNull,
    );
    await tester.tap(find.byKey(const ValueKey('show-page-section-menu')));
    await tester.pumpAndSettle();
    for (final section in [
      'Comments',
      'Action',
      'Check in / out',
      'Jobs',
      'Charges',
      'Schedules',
    ]) {
      expect(find.text(section), findsOneWidget);
    }
    expect(find.text('Show system logs'), findsNothing);
    await tester.tap(find.text('Jobs'));
    await tester.pumpAndSettle();
    expect(find.text('No jobs recorded yet.'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('show-page-section-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Comments'));
    await tester.pumpAndSettle();
    expect(find.text('Job started by Vijay Anand.'), findsNothing);

    expect(find.text('Job started by Vijay Anand.'), findsNothing);

    await tester.tap(find.byTooltip('Add action'));
    await tester.pumpAndSettle();
    expect(find.text('Report actions'), findsNothing);
    expect(find.text('Log location'), findsNothing);
    expect(find.text('Charges'), findsNothing);
    expect(find.text('Collected Rs.'), findsNothing);
    expect(find.text('Write a comment…'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('work-action-comment')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('work-action-comment-input')),
      'Mobile action comment',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('work-action-comment-submit')));
    await tester.pumpAndSettle();
    expect(fakeApi.postedComments, contains('Mobile action comment'));
    expect(find.text('Actions'), findsNothing);
    await tester.tap(find.byTooltip('Add action'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Check in'));
    await tester.pumpAndSettle();
    expect(find.text('Captured location'), findsOneWidget);
    expect(find.text('GPS: 13.0827, 80.2707'), findsOneWidget);
    expect(fakeApi.checkpointCheckedIn, isFalse);
    await tester.tap(find.byKey(const ValueKey('work-action-check-in-submit')));
    await tester.pumpAndSettle();
    expect(find.text('Actions'), findsNothing);
    expect(fakeApi.checkpointCheckedIn, isTrue);
    await tester.tap(find.byTooltip('Add action'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mark Complete'));
    await tester.pumpAndSettle();
    expect(
      find.text('Completion sent. Waiting for web approval.'),
      findsOneWidget,
    );
    expect(fakeApi.loggedLocations, isEmpty);
  });

  testWidgets('show feed hides system job comments unless requested', (
    WidgetTester tester,
  ) async {
    final job = CrmJob.fromJson({
      'id': '762',
      'enquiryNo': '762',
      'title': 'Work feed filter test',
      'messages': [
        {
          'id': 'system-start',
          'comment': 'Job started by Vijay Anand.',
          'createdAt': '2026-10-22T10:00:00.000Z',
          'createdByUserId': 'vijay@example.com',
        },
        {
          'id': 'system-stop',
          'comment': 'Job #3 stopped.',
          'createdAt': '2026-10-22T10:01:00.000Z',
          'createdByUserId': 'vijay@example.com',
        },
        {
          'id': 'customer-note',
          'comment': 'Customer confirmed the visit.',
          'createdAt': '2026-10-22T10:02:00.000Z',
          'createdByUserId': 'vijay@example.com',
        },
      ],
    });
    const session = UserSession(
      accessToken: 'test-token',
      profile: UserProfile(
        email: 'vijay@example.com',
        name: 'Vijay Anand',
        role: 'user',
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: JobWorkFeed(job: job, session: session),
        ),
      ),
    );
    expect(find.text('Customer confirmed the visit.'), findsOneWidget);
    expect(find.text('Job started by Vijay Anand.'), findsNothing);
    expect(find.text('Job #3 stopped.'), findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: JobWorkFeed(job: job, session: session, showSystemLogs: true),
        ),
      ),
    );
    expect(find.text('Job started by Vijay Anand.'), findsOneWidget);
    expect(find.text('Job #3 stopped.'), findsOneWidget);
  });

  testWidgets('show feed formats job and checkpoint timestamps on mobile', (
    WidgetTester tester,
  ) async {
    final job = CrmJob.fromJson({
      'id': '7',
      'enquiryNo': '7',
      'title': 'Timestamp format test',
      'messages': [
        {
          'id': 'job-completed',
          'comment':
              'Job #7 completed\n'
              'Started @ 2026-10-22T08:49:17.000Z\n'
              'Completed @ 2026-10-22T08:49:26.125Z\n'
              'Duration: 00:00:09',
          'createdAt': '2026-10-22T08:49:26.125Z',
          'createdByUserId': 'vijay@example.com',
        },
      ],
    });
    const session = UserSession(
      accessToken: 'test-token',
      profile: UserProfile(
        email: 'vijay@example.com',
        name: 'Vijay Anand',
        role: 'user',
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: JobWorkFeed(job: job, session: session, showSystemLogs: true),
        ),
      ),
    );

    expect(
      find.textContaining(
        'Started @ ${formatWorkDateTime(DateTime.parse('2026-10-22T08:49:17Z'))}',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('2026-10-22T08:49:17'), findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: JobWorkFeed(
            job: job,
            session: session,
            selectedSection: 'checkpoints',
            reports: [
              {
                'action': 'check-in',
                'body':
                    'Captured: Thu Oct 22 2026 14:12:30 GMT+0530 '
                    '(India Standard Time)',
                'created_by': 'vijay@example.com',
                'created_at': '2026-10-22T08:42:30.000Z',
              },
            ],
          ),
        ),
      ),
    );
    expect(
      find.textContaining(
        'Captured: ${formatWorkDateTime(DateTime(2026, 10, 22, 14, 12, 30))}',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('India Standard Time'), findsNothing);
  });

  testWidgets('starts and stops jobs immediately and shows system comments', (
    WidgetTester tester,
  ) async {
    final api = _FakeCrmMobileApi();
    CrmJob? latestJob;
    await tester.pumpWidget(
      MaterialApp(
        home: JobDetailPage(
          api: api,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
          initialJob: _testCrmJob,
          onJobUpdated: (job) => latestJob = job,
          enquiry: const DashboardListItem(
            enquiryNumber: '762',
            title: 'ROG Asus Adopter 240W',
            customer: 'Vee Cee Exports',
            list: 'Spares',
            assignedTo: 'Vijay Anand',
            dueDate: '03 Aug',
            createdBy: 'Vijay Anand',
            createdAgo: '3 days ago',
            lastAction: 'Awaiting customer confirmation',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Add action'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start Job'));
    await tester.pumpAndSettle();

    expect(api.startJobCalls, 1);
    expect(latestJob?.jobs.any((job) => job.isRunning), isTrue);
    expect(find.text('Job started by Vijay Anand.'), findsNothing);

    await tester.tap(find.byTooltip('Add action'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Stop Job'));
    await tester.pumpAndSettle();

    expect(api.stopJobCalls, 1);
    expect(latestJob?.jobs.any((job) => job.isRunning), isFalse);
    expect(find.text('Job #762 stopped.'), findsNothing);
  });

  testWidgets('enquiry card actions align evenly and creator shows as a name', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    final api = _FakeCrmMobileApi();
    final job = CrmJob(
      id: 1,
      sourceId: '1',
      number: '1',
      title: 'QUOTED 1. Acer One 15 AO15-41M-G2 (UN.37DSI…)',
      customer: 'Customer',
      mobile: '9876543210',
      list: 'Accounts',
      dueDate: '',
      createdBy: 'vijay.anand@tenant.com',
      createdAt: DateTime(2026, 10, 22),
      lastAction: '',
      status: 'New',
      priority: 'High',
      comments: const [],
      jobs: const [],
      activities: const [],
    );
    api._job = job;
    final enquiry = DashboardListItem.fromCrmJob(job);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: JobEnquiryCard(
            api: api,
            session: const UserSession(
              accessToken: 'test-token',
              profile: UserProfile(
                email: 'vijay@example.com',
                name: 'Vijay Anand',
                role: 'user',
              ),
            ),
            enquiry: enquiry,
            job: job,
            onJobChanged: () {},
            capturePosition: () async => Position(
              latitude: 13.0827,
              longitude: 80.2707,
              timestamp: DateTime(2026, 10, 22, 10, 30),
              accuracy: 8.5,
              altitude: 0,
              altitudeAccuracy: 0,
              heading: 0,
              headingAccuracy: 0,
              speed: 0,
              speedAccuracy: 0,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Start'), findsNothing);
    expect(find.text('Stop'), findsNothing);
    final statusBadge = tester.widget<Container>(
      find.byKey(const ValueKey('status-badge-new')),
    );
    expect(
      (statusBadge.decoration! as BoxDecoration).color,
      const Color(0xFF2563EB),
    );
    expect(find.byKey(const ValueKey('enquiry-card-new-call')), findsOneWidget);
    expect(find.byKey(const ValueKey('enquiry-card-message')), findsNothing);
    expect(
      tester.widget<Card>(find.byType(Card).first).color,
      const Color(0xFFF1F8FF),
    );
    final highlight = tester.widget<Container>(
      find.byKey(const ValueKey('enquiry-card-highlight')),
    );
    expect(
      ((highlight.decoration! as BoxDecoration).border! as Border).left.color,
      const Color(0xFF1596D2),
    );
    final priorityDot = tester.widget<Container>(
      find.byKey(const ValueKey('priority-dot-high')),
    );
    expect(
      (priorityDot.decoration! as BoxDecoration).color,
      const Color(0xFFF97316),
    );
    final listCenter = tester.getCenter(
      find.byKey(const ValueKey('enquiry-list-name')),
    );
    final listRect = tester.getRect(
      find.byKey(const ValueKey('enquiry-list-name')),
    );
    final priorityRect = tester.getRect(
      find.byKey(const ValueKey('priority-dot-high')),
    );
    final priorityCenter = tester.getCenter(
      find.byKey(const ValueKey('priority-dot-high')),
    );
    final callCenter = tester.getCenter(
      find.byKey(const ValueKey('enquiry-card-call')),
    );
    final whatsappCenter = tester.getCenter(
      find.byKey(const ValueKey('enquiry-card-whatsapp')),
    );
    final moreCenter = tester.getCenter(
      find.byKey(const ValueKey('enquiry-card-more-button')),
    );
    expect(priorityCenter.dx, greaterThan(listCenter.dx));
    expect(priorityRect.left - listRect.right, lessThan(12));
    expect(callCenter.dx, greaterThan(priorityCenter.dx));
    expect(whatsappCenter.dx, greaterThan(callCenter.dx));
    expect(moreCenter.dx, greaterThan(whatsappCenter.dx));
    final callRect = tester.getRect(
      find.byKey(const ValueKey('enquiry-card-call')),
    );
    final whatsappRect = tester.getRect(
      find.byKey(const ValueKey('enquiry-card-whatsapp')),
    );
    final moreRect = tester.getRect(
      find.byKey(const ValueKey('enquiry-card-more-button')),
    );
    final cardRect = tester.getRect(find.byType(Card));
    expect(callRect.size, const Size(36, 36));
    expect(whatsappRect.size, callRect.size);
    expect(moreRect.size, callRect.size);
    expect(whatsappRect.left - callRect.right, 6);
    expect(moreRect.left - whatsappRect.right, 6);
    expect(cardRect.right - moreRect.right, lessThan(15));
    expect(find.textContaining('Created by - Vijay Anand'), findsOneWidget);
    final customer = tester.widget<Text>(
      find.byKey(const ValueKey('enquiry-card-customer')),
    );
    expect(customer.data, '9876543210');
    expect(customer.maxLines, 1);
    expect(
      tester
          .getSize(find.byKey(const ValueKey('enquiry-card-new-call')))
          .height,
      greaterThan(25),
    );
    expect(
      tester
          .getSize(find.byKey(const ValueKey('enquiry-card-message-area')))
          .height,
      greaterThanOrEqualTo(30),
    );
    expect(
      tester.getTopLeft(find.byKey(const ValueKey('enquiry-card-customer'))).dy,
      lessThan(
        tester
            .getTopLeft(find.byKey(const ValueKey('enquiry-card-new-call')))
            .dy,
      ),
    );
    expect(callCenter.dy, closeTo(listCenter.dy, 2));
    expect(whatsappCenter.dy, closeTo(listCenter.dy, 2));
    expect(moreCenter.dy, closeTo(listCenter.dy, 2));

    await tester.tap(find.byKey(const ValueKey('enquiry-card-more')));
    await tester.pumpAndSettle();
    expect(find.text('Pin location'), findsOneWidget);
    expect(find.text('Start Job'), findsOneWidget);
    expect(find.text('Mark Completed'), findsOneWidget);
    expect(find.text('Scan document'), findsNothing);
    expect(find.text('Photo'), findsNothing);

    await tester.tap(find.text('Pin location'));
    await tester.pumpAndSettle();
    final locationInput = tester.widget<TextFormField>(
      find.byKey(const ValueKey('pinned-location-details')),
    );
    expect(locationInput.initialValue, contains('Latitude: 13.082700'));
    expect(locationInput.initialValue, contains('Longitude: 80.270700'));
    expect(
      api.postedComments.where(
        (comment) => comment.startsWith('Pinned location'),
      ),
      isEmpty,
    );
    await tester.tap(find.byKey(const ValueKey('submit-pinned-location')));
    await tester.pumpAndSettle();
    expect(api.postedComments.last, contains('Pinned location'));
    expect(api.postedComments.last, contains('Accuracy: ±9 m'));

    await tester.tap(find.byKey(const ValueKey('enquiry-card-more')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start Job'));
    await tester.pumpAndSettle();
    expect(api.startJobCalls, 1);

    await tester.tap(find.byKey(const ValueKey('enquiry-card-more')));
    await tester.pumpAndSettle();
    expect(find.text('Stop Job'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('enquiry-card-running-timer')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('enquiry-card-running-clock')),
      findsOneWidget,
    );
    expect(find.textContaining(RegExp(r'^\d{2}:\d{2}$')), findsOneWidget);
    final runningCard = tester.widget<Card>(find.byType(Card).first);
    expect(runningCard.color, const Color(0xFFFBF6FE));
    await tester.tap(find.text('Stop Job'));
    await tester.pumpAndSettle();
    expect(api.stopJobCalls, 1);

    await tester.tap(find.byKey(const ValueKey('enquiry-card-more')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mark Completed'));
    await tester.pumpAndSettle();
    expect(api._closureRequest?.status, 'pending');
    expect(find.text('Completion request sent for approval.'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('enquiry-card-completion-pending')),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.notifications_active_outlined), findsOneWidget);
    expect(find.text('Mark Completed'), findsOneWidget);
    final pendingCard = tester.widget<Card>(find.byType(Card).first);
    expect(pendingCard.color, const Color(0xFFFFF7ED));
    final pendingHighlight = tester.widget<Container>(
      find.byKey(const ValueKey('enquiry-card-highlight')),
    );
    final pendingDecoration = pendingHighlight.decoration! as BoxDecoration;
    final pendingBorder = pendingDecoration.border! as Border;
    expect(pendingBorder.left.color, const Color(0xFFF59E0B));

    await tester.tap(find.byKey(const ValueKey('enquiry-card-customer')));
    await tester.pumpAndSettle();
    expect(api._job.status, 'open');
    expect(find.byKey(const ValueKey('enquiry-card-new-call')), findsNothing);
    expect(find.text('New call opened successfully.'), findsOneWidget);
    expect(find.textContaining('QUOTED 1. Acer One 15'), findsOneWidget);
  });

  testWidgets('shows the live Messages loading state', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MessagesPage(
          api: CrmMobileApi('http://127.0.0.1:7010'),
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              name: 'Vijay Anand',
              email: 'vijay@example.com',
              role: 'admin',
            ),
          ),
        ),
      ),
    );

    expect(find.text('Messages'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('hides system work conversations from Messages', (
    WidgetTester tester,
  ) async {
    final api = _FakeCrmMobileApi()
      ..mockConversations = [
        MessagingConversation(
          id: 1,
          uuid: 'work-enquiry',
          title: 'Enquiry: Sample job',
          preview: 'admin: Enquiry #3 · comment-added',
          updatedAt: DateTime(2026, 10, 22),
          unreadCount: 1,
          kind: 'group',
        ),
        MessagingConversation(
          id: 4,
          uuid: 'work-duty',
          title: 'Duty: duty daily',
          preview: 'admin: Duty #1 · duty daily',
          updatedAt: DateTime(2026, 10, 22),
          unreadCount: 1,
          kind: 'group',
        ),
        MessagingConversation(
          id: 5,
          uuid: 'work-task',
          title: 'Task: Follow up',
          preview: 'admin: Task #4 · assigned',
          updatedAt: DateTime(2026, 10, 22),
          unreadCount: 1,
          kind: 'group',
        ),
        MessagingConversation(
          id: 2,
          uuid: 'person-chat',
          title: 'Arunesh',
          preview: 'admin: hi',
          updatedAt: DateTime(2026, 10, 22),
          unreadCount: 0,
          kind: 'dm',
        ),
        MessagingConversation(
          id: 3,
          uuid: 'team-chat',
          title: 'Service team',
          preview: 'See you tomorrow',
          updatedAt: DateTime(2026, 10, 22),
          unreadCount: 0,
          kind: 'group',
        ),
      ];
    await tester.pumpWidget(
      MaterialApp(
        home: MessagesPage(
          api: api,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              name: 'Vijay Anand',
              email: 'vijay@example.com',
              role: 'admin',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Enquiry: Sample job'), findsNothing);
    expect(find.text('Duty: duty daily'), findsNothing);
    expect(find.text('Task: Follow up'), findsNothing);
    expect(find.text('Arunesh'), findsOneWidget);
    expect(find.text('Service team'), findsOneWidget);
  });

  testWidgets('filters enquiries by search query in MyEnquiriesPage', (
    WidgetTester tester,
  ) async {
    final fakeApi = _FakeCrmMobileApi();
    await tester.pumpWidget(
      MaterialApp(
        home: MyEnquiriesPage(
          api: fakeApi,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(fakeApi.requestedEnquiryScope, 'assigned');
    expect(fakeApi.requestedEnquiryFilter, 'active');
    expect(find.text('ROG Asus Adopter 240W'), findsOneWidget);

    final searchField = find.byType(TextField);
    expect(searchField, findsOneWidget);

    await tester.enterText(searchField, 'Dell');
    await tester.pumpAndSettle();
    expect(find.text('ROG Asus Adopter 240W'), findsNothing);
    expect(find.text('No jobs are in this list.'), findsOneWidget);

    await tester.enterText(searchField, 'ROG');
    await tester.pumpAndSettle();
    expect(find.text('ROG Asus Adopter 240W'), findsOneWidget);
  });

  testWidgets(
    'shows native enquiry pagination only when more than 100 rows exist',
    (WidgetTester tester) async {
      final fakeApi = _FakeCrmMobileApi()..enquiryTotal = 250;
      await tester.pumpWidget(
        MaterialApp(
          home: MyEnquiriesPage(
            api: fakeApi,
            session: const UserSession(
              accessToken: 'test-token',
              profile: UserProfile(
                email: 'vijay@example.com',
                name: 'Vijay Anand',
                role: 'user',
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('250 jobs · Page 1 of 3'), findsOneWidget);
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      expect(fakeApi.requestedEnquiryPages, [1, 2]);
      expect(find.text('250 jobs · Page 2 of 3'), findsOneWidget);
    },
  );

  testWidgets('creates a task with the live status and priority selections', (
    WidgetTester tester,
  ) async {
    final fakeApi = _FakeCrmMobileApi();
    await tester.pumpWidget(
      MaterialApp(
        home: TaskFormPage(
          api: fakeApi,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).first, 'Follow up');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(fakeApi.createdTaskPayload?['priorityId'], 2);
    expect(fakeApi.createdTaskPayload?['statusId'], 1);
    expect(fakeApi.createdTaskPayload?['title'], 'Follow up');
  });

  testWidgets('Tasks use enquiry cards and open the shared task action sheet', (
    WidgetTester tester,
  ) async {
    final api = _FakeTaskMobileApi();
    await tester.pumpWidget(
      MaterialApp(
        home: TasksPage(
          api: api,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(Card), findsOneWidget);
    expect(find.text('Follow up with customer'), findsOneWidget);
    expect(find.text('#42  New'), findsOneWidget);
    await tester.tap(find.text('Follow up with customer'));
    await tester.pumpAndSettle();

    expect(find.text('Task #42'), findsOneWidget);
    expect(find.text('Customer asked for a call back.'), findsOneWidget);
    await tester.tap(find.byTooltip('Add action'));
    await tester.pumpAndSettle();
    expect(find.text('Comment'), findsOneWidget);
    expect(find.text('Check in'), findsOneWidget);
    expect(find.text('Start Job'), findsOneWidget);
    expect(find.text('Mark Complete'), findsOneWidget);
  });

  testWidgets('active task job timer appears in list and task show header', (
    WidgetTester tester,
  ) async {
    final api = _FakeTaskMobileApi()..runningTaskJob = true;
    await tester.pumpWidget(
      MaterialApp(
        home: TasksPage(
          api: api,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    expect(
      find.byKey(const ValueKey('task-card-running-clock')),
      findsOneWidget,
    );
    await tester.tap(find.text('Follow up with customer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    expect(
      find.byKey(const ValueKey('task-detail-heading-divider')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('task-detail-running-clock')),
      findsOneWidget,
    );
  });

  testWidgets('creates an enquiry with customer and selected option fields', (
    WidgetTester tester,
  ) async {
    final fakeApi = _FakeCrmMobileApi();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeEnquiryFormPage(
          api: fakeApi,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final saveButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Save'),
    );
    expect(saveButton.style?.minimumSize?.resolve({}), const Size(84, 42));
    expect(saveButton.style?.backgroundColor?.resolve({}), crmDockIconColor);
    expect(saveButton.style?.foregroundColor?.resolve({}), Colors.white);

    await tester.enterText(
      find.byKey(const ValueKey('enquiry-mobile')),
      '9655227767',
    );
    await tester.enterText(
      find.byKey(const ValueKey('enquiry-customer-name')),
      'Sundar',
    );
    await tester.enterText(
      find.byKey(const ValueKey('enquiry-message')),
      'Repair request',
    );
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(fakeApi.createdEnquiryPayload?['customer'], 'Sundar');
    expect(fakeApi.createdEnquiryPayload?['mobile'], '9655227767');
    expect(fakeApi.createdEnquiryPayload?['enquiryGroup'], '7');
    expect(fakeApi.createdEnquiryPayload?['statusId'], 'st-new');
    expect(fakeApi.createdEnquiryPayload?['priorityId'], 'pr-1');
  });

  testWidgets('contact lookup selects the full row and shows a checkmark', (
    WidgetTester tester,
  ) async {
    final fakeApi = _FakeCrmMobileApi();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeEnquiryFormPage(
          api: fakeApi,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('enquiry-mobile')),
      '9655227738',
    );
    await tester.tap(find.byTooltip('Find contact for this phone number'));
    await tester.pumpAndSettle();

    final contactRow = find.byKey(const ValueKey('contact-option-customer-1'));
    expect(contactRow, findsOneWidget);
    expect(find.byKey(const ValueKey('selected-contact-check')), findsNothing);
    await tester.tap(
      find.descendant(of: contactRow, matching: find.text('Sundar')),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('selected-contact-check')),
      findsOneWidget,
    );
    expect(find.text('Use contact'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('use-selected-contact')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('matched-enquiry-contact')),
      findsOneWidget,
    );
  });

  testWidgets('enquiry selectors search options in floating popovers', (
    WidgetTester tester,
  ) async {
    final fakeApi = _FakeCrmMobileApi();
    await tester.pumpWidget(
      MaterialApp(
        home: HomeEnquiryFormPage(
          api: fakeApi,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final messageField = find.byKey(const ValueKey('enquiry-message'));
    final messageTopBefore = tester.getTopLeft(messageField).dy;
    final listField = find.byKey(const ValueKey('inline-select-List'));
    await tester.tap(listField);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('inline-search-List')),
      'serv',
    );
    await tester.pumpAndSettle();
    final listOption = find.byKey(const ValueKey('inline-option-List-0'));
    expect(find.text('Services'), findsOneWidget);
    expect(find.text('office'), findsNothing);
    expect(tester.getTopLeft(messageField).dy, closeTo(messageTopBefore, .5));
    expect(
      tester.getTopLeft(listOption).dy,
      greaterThan(tester.getBottomLeft(listField).dy),
    );
    await tester.tap(listOption);
    await tester.pumpAndSettle();
    expect(find.text('Services'), findsOneWidget);

    final allocatedField = find.byKey(
      const ValueKey('inline-select-Allocated'),
    );
    await tester.tap(allocatedField);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('inline-search-Allocated')),
      'tenant',
    );
    await tester.pumpAndSettle();
    final unallocatedOption = find.byKey(
      const ValueKey('inline-option-Allocated-0'),
    );
    expect(unallocatedOption, findsOneWidget);
    expect(
      find.descendant(
        of: unallocatedOption,
        matching: find.text('Not allocated'),
      ),
      findsNothing,
    );
    expect(
      find.descendant(of: unallocatedOption, matching: find.text('tenant')),
      findsOneWidget,
    );
    expect(
      tester.getTopLeft(unallocatedOption).dy,
      greaterThan(tester.getBottomLeft(allocatedField).dy),
    );
    expect(tester.getTopLeft(messageField).dy, closeTo(messageTopBefore, .5));
  });

  testWidgets(
    'creates a mobile enquiry without customer details using Normal and New defaults',
    (WidgetTester tester) async {
      final fakeApi = _FakeCrmMobileApi();
      final navigation = DashboardNavigation();
      await tester.pumpWidget(
        MaterialApp(
          home: DashboardDockScope(
            navigation: navigation,
            onDestinationSelected: navigation.selectDockDestination,
            child: HomeEnquiryFormPage(
              api: fakeApi,
              session: const UserSession(
                accessToken: 'test-token',
                profile: UserProfile(
                  email: 'vijay@example.com',
                  name: 'Vijay Anand',
                  role: 'user',
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Customer name (optional)'), findsOneWidget);
      expect(find.text('Priority'), findsNothing);
      expect(find.text('Status'), findsNothing);
      expect(find.text('Due date'), findsNothing);
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Enquiries'), findsOneWidget);
      expect(find.text('Duty'), findsOneWidget);
      expect(find.text('Menu'), findsOneWidget);

      await tester.enterText(
        find.byKey(const ValueKey('enquiry-message')),
        'Enquiry without a known customer',
      );
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      expect(fakeApi.createdEnquiryPayload?['customer'], '');
      expect(fakeApi.createdEnquiryPayload?['mobile'], '');
      expect(fakeApi.createdEnquiryPayload?['statusId'], 'st-new');
      expect(fakeApi.createdEnquiryPayload?['priorityId'], 'pr-1');
    },
  );

  testWidgets('keeps call-log enquiry creation administrator-only', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: CallLogNotesPage(
          api: _FakeCrmMobileApi(),
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'user@example.com',
              name: 'Mobile User',
              role: 'user',
            ),
          ),
          entry: CallLogEntry(
            name: 'Customer',
            number: '9655227767',
            type: 1,
            timestamp: DateTime(2026, 10, 19),
            durationSeconds: 30,
          ),
          callLogName: 'CL-1',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('Create enquiry'), findsNothing);
    expect(find.text('Write a comment only'), findsOneWidget);
    expect(find.byIcon(Icons.send_rounded), findsOneWidget);
    expect(find.byTooltip('Submit comment'), findsOneWidget);
    expect(find.text('Comment'), findsNothing);
    final commentField = tester.widget<TextField>(find.byType(TextField));
    expect(commentField.minLines, 2);
    expect(commentField.maxLines, 2);
  });

  testWidgets('loads only assigned enquiries for the home dashboard', (
    WidgetTester tester,
  ) async {
    final fakeApi = _FakeCrmMobileApi();
    final session = const UserSession(
      accessToken: 'test-token',
      profile: UserProfile(
        email: 'vijay@example.com',
        name: 'Vijay Anand',
        role: 'user',
      ),
    );
    final feed = DashboardJobsFeed(api: fakeApi, session: session);

    await feed.refresh();

    expect(fakeApi.requestedEnquiryScope, 'assigned');
    expect(fakeApi.requestedEnquiryFilter, 'active');
    expect(feed.jobs.single.sourceId, _testCrmJob.sourceId);
    final running = await fakeApi.startJob(
      accessToken: session.accessToken,
      id: _testCrmJob.sourceId,
    );
    feed.updateJob(running);
    await feed.refresh();
    expect(feed.jobs.single.jobs.single.isRunning, isTrue);
    feed.dispose();
  });

  testWidgets('enquiry cards show Stop Job and elapsed time from shared feed', (
    WidgetTester tester,
  ) async {
    final api = _FakeCrmMobileApi();
    final session = const UserSession(
      accessToken: 'test-token',
      profile: UserProfile(
        email: 'vijay@example.com',
        name: 'Vijay Anand',
        role: 'user',
      ),
    );
    await api.startJob(
      accessToken: session.accessToken,
      id: _testCrmJob.sourceId,
    );
    final feed = DashboardJobsFeed(api: api, session: session);
    await feed.refresh();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MyEnquiriesPage(
            api: api,
            session: session,
            embedded: true,
            jobsFeed: feed,
            onJobUpdated: feed.updateJob,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('enquiry-card-more')));
    await tester.pumpAndSettle();
    expect(find.text('Stop Job'), findsOneWidget);
    expect(find.text('Start Job'), findsNothing);
    expect(
      find.byKey(const ValueKey('enquiry-card-running-timer')),
      findsOneWidget,
    );
    feed.dispose();
  });

  testWidgets('Jobs list initializes completion pending from the API', (
    WidgetTester tester,
  ) async {
    final api = _FakeCrmMobileApi();
    final session = const UserSession(
      accessToken: 'test-token',
      profile: UserProfile(
        email: 'vijay@example.com',
        name: 'Vijay Anand',
        role: 'user',
      ),
    );
    final feed = DashboardJobsFeed(api: api, session: session);
    api.pendingClosureIds.add(_testCrmJob.sourceId);
    await feed.refresh();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MyEnquiriesPage(
            api: api,
            session: session,
            embedded: true,
            jobsFeed: feed,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('enquiry-card-completion-pending')),
      findsOneWidget,
    );
    expect(find.text('Mark Completed'), findsOneWidget);
    expect(find.byIcon(Icons.notifications_active_outlined), findsOneWidget);
    feed.dispose();
  });

  testWidgets('Jobs list highlights outstanding collection in purple', (
    WidgetTester tester,
  ) async {
    final api = _FakeCrmMobileApi();
    const session = UserSession(
      accessToken: 'test-token',
      profile: UserProfile(
        email: 'vijay@example.com',
        name: 'Vijay Anand',
        role: 'user',
      ),
    );
    final feed = DashboardJobsFeed(api: api, session: session);
    api.pendingCollectionIds.add(_testCrmJob.sourceId);
    await feed.refresh();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MyEnquiriesPage(
            api: api,
            session: session,
            embedded: true,
            jobsFeed: feed,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Collection pending'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('enquiry-card-collection-pending')),
      findsOneWidget,
    );
    expect(
      tester.widget<Card>(find.byType(Card).first).color,
      const Color(0xFFFBF6FE),
    );
    final highlight = tester.widget<Container>(
      find.byKey(const ValueKey('enquiry-card-highlight')),
    );
    final cardBorder =
        (highlight.decoration! as BoxDecoration).border! as Border;
    expect(cardBorder.left.color, const Color(0xFF8B3BA8));
    feed.dispose();
  });

  testWidgets('dashboard running-job card shows elapsed time and stops job', (
    WidgetTester tester,
  ) async {
    final api = _FakeCrmMobileApi();
    final session = const UserSession(
      accessToken: 'test-token',
      profile: UserProfile(
        email: 'vijay@example.com',
        name: 'Vijay Anand',
        role: 'user',
      ),
    );
    final running = await api.startJob(
      accessToken: session.accessToken,
      id: _testCrmJob.sourceId,
    );
    final feed = DashboardJobsFeed(api: api, session: session)
      ..updateJob(running);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DashboardHome(
            api: api,
            session: session,
            jobsFeed: feed,
            onOpenList: (_) {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Job running'), findsOneWidget);
    expect(find.textContaining(' sec'), findsOneWidget);
    await tester.tap(find.text('Stop Job'));
    await tester.pumpAndSettle();
    expect(api.stopJobCalls, 1);
    expect(find.text('Job running'), findsNothing);
    feed.dispose();
  });

  testWidgets('refreshes dashboard enquiries after the session is renewed', (
    WidgetTester tester,
  ) async {
    final fakeApi = _FakeCrmMobileApi();
    final session = const UserSession(
      accessToken: 'old-token',
      profile: UserProfile(
        email: 'vijay@example.com',
        name: 'Vijay Anand',
        role: 'user',
      ),
    );
    final feed = DashboardJobsFeed(api: fakeApi, session: session);
    await feed.refresh();

    feed.updateSession(
      const UserSession(
        accessToken: 'renewed-token',
        profile: UserProfile(
          email: 'vijay@example.com',
          name: 'Vijay Anand',
          role: 'user',
        ),
      ),
    );
    await tester.runAsync(() async {
      await Future<void>.delayed(Duration.zero);
    });

    expect(fakeApi.lastEnquiriesAccessToken, 'renewed-token');
    expect(feed.error, isNull);
    feed.dispose();
  });

  testWidgets('supports open call and dynamic status update in JobDetailPage', (
    WidgetTester tester,
  ) async {
    final fakeApi = _FakeCrmMobileApi();
    final newJob = CrmJob(
      id: 762,
      sourceId: '762',
      number: '762',
      title: 'ROG Asus Adopter 240W',
      customer: 'Vee Cee Exports',
      list: 'Spares',
      dueDate: '03 Aug',
      createdBy: 'Vijay Anand',
      createdAt: DateTime(2026, 8, 3),
      lastAction: 'Pending review',
      status: 'New',
      priority: 'normal',
      comments: const [],
      jobs: const [],
      activities: const [],
    );
    fakeApi._job = newJob;

    await tester.pumpWidget(
      MaterialApp(
        home: JobDetailPage(
          api: fakeApi,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
          initialJob: newJob,
          enquiry: const DashboardListItem(
            enquiryNumber: '762',
            title: 'ROG Asus Adopter 240W',
            customer: 'Vee Cee Exports',
            list: 'Spares',
            assignedTo: 'Vijay Anand',
            dueDate: '03 Aug',
            createdBy: 'Vijay Anand',
            createdAgo: '3 days ago',
            lastAction: 'Pending review',
            statusName: 'New',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Open call'), findsOneWidget);
    await tester.tap(find.text('#762  New'));
    await tester.pumpAndSettle();
    expect(find.text('Change Status'), findsOneWidget);
    Navigator.of(tester.element(find.text('Change Status'))).pop();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Open call'));
    await tester.pumpAndSettle();

    expect(find.text('New call opened successfully.'), findsOneWidget);
    expect(find.text('Open call'), findsNothing);
    expect(find.text('#762  Open'), findsOneWidget);

    await tester.tap(find.text('#762  Open'));
    await tester.pumpAndSettle();

    expect(find.text('Change Status'), findsOneWidget);
    expect(find.text('In Progress'), findsOneWidget);

    await tester.tap(find.text('In Progress'));
    await tester.pumpAndSettle();

    expect(find.text('Status updated to In Progress.'), findsOneWidget);
    expect(find.text('#762  In Progress'), findsOneWidget);
  });

  testWidgets('job detail remains available when schedules fail to refresh', (
    WidgetTester tester,
  ) async {
    final api = _FakeCrmMobileApi()..failEnquirySchedules = true;
    await tester.pumpWidget(
      MaterialApp(
        home: JobDetailPage(
          api: api,
          session: const UserSession(
            accessToken: 'test-token',
            profile: UserProfile(
              email: 'vijay@example.com',
              name: 'Vijay Anand',
              role: 'user',
            ),
          ),
          initialJob: _testCrmJob,
          enquiry: const DashboardListItem(
            enquiryNumber: '762',
            title: 'ROG Asus Adopter 240W',
            customer: 'Vee Cee Exports',
            list: 'Spares',
            assignedTo: 'Vijay Anand',
            dueDate: '03 Aug',
            createdBy: 'Vijay Anand',
            createdAgo: '3 days ago',
            lastAction: 'Awaiting customer confirmation',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('#762  Open'), findsOneWidget);
    expect(find.text('ROG Asus Adopter 240W'), findsOneWidget);
    expect(
      find.text('Some job details could not be refreshed. Retry shortly.'),
      findsOneWidget,
    );
  });

  for (final decision in ['approved', 'rejected']) {
    testWidgets('refreshes mobile after web closure $decision', (tester) async {
      final api = _FakeCrmMobileApi();
      await tester.pumpWidget(
        MaterialApp(
          home: JobDetailPage(
            api: api,
            session: const UserSession(
              accessToken: 'test-token',
              profile: UserProfile(
                email: 'vijay@example.com',
                name: 'Vijay',
                role: 'user',
              ),
            ),
            initialJob: _testCrmJob,
            enquiry: const DashboardListItem(
              enquiryNumber: '762',
              title: 'Closure refresh test',
              customer: 'Customer',
              list: '',
              assignedTo: '',
              dueDate: '',
              createdBy: 'Vijay',
              createdAgo: '',
              lastAction: '',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Add action'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mark Complete'));
      await tester.pumpAndSettle();
      expect(
        find.text('Completion sent. Waiting for web approval.'),
        findsOneWidget,
      );
      api._closureRequest = ClosureRequest(
        id: 91,
        status: decision,
        requestedAt: DateTime.now().toIso8601String(),
        reviewNote: decision == 'rejected' ? 'More work required' : null,
      );
      if (decision == 'approved') {
        final old = api._job;
        api._job = CrmJob(
          id: old.id,
          sourceId: old.sourceId,
          number: old.number,
          title: old.title,
          customer: old.customer,
          list: old.list,
          dueDate: old.dueDate,
          createdBy: old.createdBy,
          createdAt: old.createdAt,
          lastAction: old.lastAction,
          status: 'Closed',
          priority: old.priority,
          comments: old.comments,
          jobs: old.jobs,
          activities: old.activities,
        );
      }
      await tester.pump(const Duration(seconds: 16));
      await tester.pumpAndSettle();
      expect(
        find.text('Completion sent. Waiting for web approval.'),
        findsNothing,
      );
      if (decision == 'approved') {
        expect(find.text('#762  Closed'), findsOneWidget);
      } else {
        expect(
          find.text('Closure request rejected: More work required'),
          findsOneWidget,
        );
      }
      await tester.tap(find.byTooltip('Add action'));
      await tester.pumpAndSettle();
      expect(
        find.text('Mark Complete'),
        decision == 'approved' ? findsNothing : findsOneWidget,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    });
  }
}

final _testCrmJob = CrmJob(
  id: 762,
  sourceId: '762',
  number: '762',
  title: 'ROG Asus Adopter 240W',
  customer: 'Vee Cee Exports',
  list: 'Spares',
  dueDate: '03 Aug',
  createdBy: 'Vijay Anand',
  createdAt: DateTime(2026, 8, 3),
  lastAction: 'Awaiting customer confirmation',
  status: 'open',
  priority: 'normal',
  comments: const [],
  jobs: const [],
  activities: const [],
);

class _FakeCrmMobileApi extends CrmMobileApi {
  _FakeCrmMobileApi() : super('http://127.0.0.1:7010');

  @override
  Future<int> tasksCount(String accessToken) async => 3;

  @override
  Future<List<CrmPartyReference>> partiesByMobile({
    required String accessToken,
    required String mobile,
  }) async => const [
    CrmPartyReference(id: 'customer-1', name: 'Sundar', type: 'Customer'),
  ];

  @override
  Future<List<MessagingConversation>> conversations({
    required String accessToken,
    required String currentEmail,
  }) async => mockConversations;

  List<MessagingConversation> mockConversations = [];

  CrmJob _job = _testCrmJob;
  ClosureRequest? _closureRequest;
  final Set<String> pendingClosureIds = {};
  final Set<String> pendingCollectionIds = {};
  final List<String> postedComments = [];
  var startJobCalls = 0;
  var stopJobCalls = 0;
  String? requestedEnquiryScope;
  String? requestedEnquiryFilter;
  String? lastEnquiriesAccessToken;
  int enquiryTotal = 1;
  final List<int> requestedEnquiryPages = [];
  Map<String, dynamic>? createdTaskPayload;
  Map<String, dynamic>? createdEnquiryPayload;

  @override
  Future<Map<String, dynamic>> taskOptions(String accessToken) async => {
    'lists': [
      {'id': 7, 'name': 'Accounts'},
    ],
    'priorities': [
      {'id': 2, 'name': 'Normal', 'code': 'normal'},
    ],
    'statuses': [
      {'id': 1, 'name': 'New', 'code': 'new'},
    ],
    'users': [
      {'id': 3, 'name': 'Vijay Anand', 'email': 'vijay@example.com'},
    ],
    'capabilities': {'create': true},
  };

  @override
  Future<Map<String, dynamic>> createTask(
    String accessToken,
    Map<String, dynamic> payload,
  ) async {
    createdTaskPayload = payload;
    return payload;
  }

  @override
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
    createdEnquiryPayload = {
      'customer': customer,
      'mobile': mobile,
      'title': title,
      'enquiryGroup': enquiryGroup,
      'assignedToUserId': assignedToUserId,
      'message': message,
      'statusId': statusId,
      'priorityId': priorityId,
      'dueDate': dueDate,
    };
    return _job;
  }

  @override
  Future<List<CrmJob>> assignedJobs(String accessToken) async => [_job];

  @override
  Future<Set<String>> pendingEnquiryClosureIds(String accessToken) async =>
      pendingClosureIds;

  @override
  Future<Set<String>> pendingEnquiryCollectionIds(String accessToken) async =>
      pendingCollectionIds;

  @override
  @override
  Future<List<CrmDuty>> duties(String accessToken) async => [];

  @override
  Future<int> dutiesCount(String accessToken) async => 0;

  @override
  Future<List<CrmJobExecution>> enquiryJobSessions({
    required String accessToken,
    required String enquiryId,
  }) async => _job.jobs;

  @override
  Future<int> activitiesCount(String accessToken) async => 0;

  @override
  Future<List<CrmJob>> enquiries({
    required String accessToken,
    String scope = 'all',
    String filter = 'all',
    String search = '',
    String? listInId,
    int page = 1,
    int pageSize = 100,
  }) async {
    requestedEnquiryScope = scope;
    requestedEnquiryFilter = filter;
    lastEnquiriesAccessToken = accessToken;
    return [_job];
  }

  @override
  Future<CrmPage<CrmJob>> enquiriesPage({
    required String accessToken,
    String scope = 'all',
    String filter = 'all',
    String search = '',
    String? listInId,
    int page = 1,
    int pageSize = 100,
  }) async {
    requestedEnquiryScope = scope;
    requestedEnquiryFilter = filter;
    requestedEnquiryPages.add(page);
    return CrmPage(
      items: [_job],
      page: page,
      pageSize: pageSize,
      total: enquiryTotal,
    );
  }

  @override
  Future<CrmJob> openNewCall({
    required String accessToken,
    required String id,
  }) async {
    _job = CrmJob(
      id: _job.id,
      sourceId: _job.sourceId,
      number: _job.number,
      title: _job.title,
      customer: _job.customer,
      list: _job.list,
      dueDate: _job.dueDate,
      createdBy: _job.createdBy,
      createdAt: _job.createdAt,
      lastAction: 'New call opened',
      status: 'open',
      priority: _job.priority,
      comments: _job.comments,
      jobs: _job.jobs,
      activities: _job.activities,
    );
    return _job;
  }

  @override
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
    if (statusId != null) {
      final statuses = const [
        CrmCallEnquiryStatus(id: 'st-1', name: 'Open', code: 'OPEN'),
        CrmCallEnquiryStatus(
          id: 'st-2',
          name: 'In Progress',
          code: 'IN_PROGRESS',
        ),
        CrmCallEnquiryStatus(id: 'st-3', name: 'Won', code: 'WON'),
      ];
      final match = statuses.where((s) => s.id == statusId).firstOrNull;
      if (match != null) {
        _job = CrmJob(
          id: _job.id,
          sourceId: _job.sourceId,
          number: _job.number,
          title: _job.title,
          customer: _job.customer,
          list: _job.list,
          dueDate: _job.dueDate,
          createdBy: _job.createdBy,
          createdAt: _job.createdAt,
          lastAction: _job.lastAction,
          status: match.name,
          priority: _job.priority,
          statusId: match.id,
          priorityId: _job.priorityId,
          listInId: _job.listInId,
          comments: _job.comments,
          jobs: _job.jobs,
          activities: _job.activities,
        );
      }
    }
    return _job;
  }

  @override
  Future<CrmCallEnquiryFormData> callEnquiryFormData(
    String accessToken,
  ) async => const CrmCallEnquiryFormData(
    groups: [
      CrmCallEnquiryGroup(label: 'Accounts', value: '7'),
      CrmCallEnquiryGroup(label: 'office', value: '8'),
      CrmCallEnquiryGroup(label: 'Stores', value: '9'),
      CrmCallEnquiryGroup(label: 'Services', value: '10'),
    ],
    assignees: [
      CrmCallEnquiryAssignee(id: '3', name: 'Vijay Anand'),
      CrmCallEnquiryAssignee(id: '4', name: 'tenant'),
    ],
    statuses: [
      CrmCallEnquiryStatus(id: 'st-new', name: 'New', code: 'new'),
      CrmCallEnquiryStatus(id: 'st-1', name: 'Open', code: 'OPEN'),
      CrmCallEnquiryStatus(
        id: 'st-2',
        name: 'In Progress',
        code: 'IN_PROGRESS',
      ),
      CrmCallEnquiryStatus(id: 'st-3', name: 'Won', code: 'WON'),
    ],
    priorities: [
      CrmCallEnquiryPriority(id: 'pr-1', name: 'Normal', code: 'NORMAL'),
      CrmCallEnquiryPriority(id: 'pr-2', name: 'High', code: 'HIGH'),
    ],
  );

  @override
  Future<List<CrmCallLogComment>> callLogComments({
    required String accessToken,
    required String callLogName,
  }) async => [];

  @override
  Future<CrmJob> job(String accessToken, String id) async => _job;

  @override
  Future<CrmJob> startJob({
    required String accessToken,
    required String id,
  }) async {
    startJobCalls++;
    const comment = 'Job started by Vijay Anand.';
    postedComments.add(comment);
    final execution = CrmJobExecution(
      name: 'JOB-1',
      employee: 'Vijay Anand',
      createdAt: DateTime.now(),
      date: null,
      startTime: DateTime.now().toIso8601String(),
      stopTime: null,
      hours: 0,
      employeeCostPerHour: 0,
      totalCost: 0,
      status: 'Running',
    );
    _job = _copyJob(
      comments: [..._job.comments, _systemComment(comment)],
      jobs: [..._job.jobs, execution],
      lastAction: comment,
    );
    return _job;
  }

  @override
  Future<CrmJob> stopJob({
    required String accessToken,
    required String id,
    required String jobName,
  }) async {
    stopJobCalls++;
    final comment = 'Job #762 stopped.';
    postedComments.add(comment);
    final jobs = _job.jobs
        .map(
          (job) => job.name == jobName
              ? CrmJobExecution(
                  name: job.name,
                  employee: job.employee,
                  createdAt: job.createdAt,
                  date: job.date,
                  startTime: job.startTime,
                  stopTime: DateTime.now().toIso8601String(),
                  hours: job.hours,
                  employeeCostPerHour: job.employeeCostPerHour,
                  totalCost: job.totalCost,
                  status: 'Completed',
                )
              : job,
        )
        .toList();
    _job = _copyJob(
      comments: [..._job.comments, _systemComment(comment)],
      jobs: jobs,
      lastAction: comment,
    );
    return _job;
  }

  CrmComment _systemComment(String text) => CrmComment(
    id: 'comment-${postedComments.length}',
    comment: text,
    createdAt: DateTime.now(),
    createdByUserId: 'vijay@example.com',
  );

  CrmJob _copyJob({
    required List<CrmComment> comments,
    required List<CrmJobExecution> jobs,
    required String lastAction,
  }) => CrmJob(
    id: _job.id,
    sourceId: _job.sourceId,
    number: _job.number,
    title: _job.title,
    customer: _job.customer,
    mobile: _job.mobile,
    assignedTo: _job.assignedTo,
    list: _job.list,
    dueDate: _job.dueDate,
    createdBy: _job.createdBy,
    createdAt: _job.createdAt,
    lastAction: lastAction,
    status: _job.status,
    priority: _job.priority,
    statusId: _job.statusId,
    priorityId: _job.priorityId,
    listInId: _job.listInId,
    comments: comments,
    jobs: jobs,
    activities: _job.activities,
  );

  final workUpdates = <Map<String, dynamic>>[];
  bool checkpointCheckedIn = false;
  bool failEnquirySchedules = false;

  @override
  Future<bool> workCheckpoint(
    String accessToken, {
    int? enquiryId,
    int? taskId,
  }) async => checkpointCheckedIn;

  @override
  Future<List<Map<String, dynamic>>> workReports(
    String accessToken, {
    int? enquiryId,
    int? taskId,
  }) async => workUpdates;

  @override
  Future<List<Map<String, dynamic>>> enquirySchedules(
    String accessToken, {
    required int enquiryId,
  }) async {
    if (failEnquirySchedules) {
      throw const CrmMobileApiException('schedule endpoint unavailable');
    }
    return [];
  }

  @override
  Future<void> sendWorkReport(
    String accessToken,
    Map<String, dynamic> payload,
  ) async {
    checkpointCheckedIn = payload['action'] == 'check-in';
    workUpdates.add({
      ...payload,
      'created_by': 'vijay@example.com',
      'created_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  var loggedLocations = <CrmEnquiryLocation>[];

  @override
  Future<List<CrmEnquiryLocation>> enquiryLocations({
    required String accessToken,
    required String enquiryId,
  }) async => loggedLocations;

  @override
  Future<CrmEnquiryLocation> logEnquiryLocation({
    required String accessToken,
    required String enquiryId,
    required double latitude,
    required double longitude,
    required double? accuracyMeters,
    required DateTime capturedAt,
  }) async {
    final item = CrmEnquiryLocation(
      id: 9 + loggedLocations.length,
      latitude: latitude,
      longitude: longitude,
      capturedAt: capturedAt,
      createdBy: 'vijay@example.com',
      accuracyMeters: accuracyMeters,
    );
    loggedLocations.add(item);
    return item;
  }

  @override
  Future<ClosureRequest?> latestClosureRequest({
    required String accessToken,
    required String id,
  }) async => _closureRequest;

  @override
  Future<ClosureRequest> requestClosure({
    required String accessToken,
    required String id,
    String note = '',
  }) async {
    _closureRequest = ClosureRequest(
      id: 91,
      status: 'pending',
      requestedAt: DateTime.now().toIso8601String(),
    );
    return _closureRequest!;
  }

  @override
  Future<CrmJob> addJobComment({
    required String accessToken,
    required String id,
    required String comment,
  }) async {
    postedComments.add(comment);
    _job = CrmJob(
      id: _job.id,
      sourceId: _job.sourceId,
      number: _job.number,
      title: _job.title,
      customer: _job.customer,
      list: _job.list,
      dueDate: _job.dueDate,
      createdBy: _job.createdBy,
      createdAt: _job.createdAt,
      lastAction: comment,
      status: _job.status,
      priority: _job.priority,
      comments: [
        ..._job.comments,
        CrmComment(
          id: 'new-comment',
          comment: comment,
          createdAt: DateTime.now(),
          createdByUserId: 'vijay@example.com',
        ),
      ],
      jobs: _job.jobs,
      activities: _job.activities,
    );
    return _job;
  }
}

class _FakeTaskMobileApi extends _FakeCrmMobileApi {
  bool runningTaskJob = false;
  static final _task = <String, dynamic>{
    'id': 42,
    'uuid': 'task-42',
    'title': 'Follow up with customer',
    'description': 'Confirm the delivery address before calling.',
    'contactName': 'Sundar',
    'contactPhone': '9655227766',
    'listIn': 'Office',
    'status': 'open',
    'statusName': 'New',
    'priority': 'normal',
    'priorityName': 'Normal',
    'dueDate': '2026-10-30',
    'createdBy': 'vijay@example.com',
    'creatorName': 'Vijay Anand',
    'createdAt': '2026-10-22T10:00:00.000Z',
    'closurePending': false,
  };

  @override
  Future<CrmPage<Map<String, dynamic>>> tasksPage(
    String accessToken, {
    String filter = 'active',
    int page = 1,
    int pageSize = 100,
    String scope = 'mine',
  }) async => CrmPage(
    items: [
      if (runningTaskJob)
        {
          ..._task,
          'runningJobStartedAt': DateTime.now()
              .subtract(const Duration(seconds: 35))
              .toIso8601String(),
        }
      else
        _task,
    ],
    page: page,
    pageSize: pageSize,
    total: 1,
  );

  @override
  Future<Map<String, dynamic>> task(String accessToken, int id) async =>
      runningTaskJob
      ? {
          ..._task,
          'runningJobStartedAt': DateTime.now()
              .subtract(const Duration(seconds: 35))
              .toIso8601String(),
        }
      : _task;

  @override
  Future<List<Map<String, dynamic>>> taskComments(
    String accessToken,
    int id,
  ) async => [
    {
      'body': 'Customer asked for a call back.',
      'createdBy': 'vijay@example.com',
      'createdAt': '2026-10-22T10:00:00.000Z',
    },
  ];

  @override
  Future<List<Map<String, dynamic>>> taskClosures(
    String accessToken,
    int id,
  ) async => [];

  @override
  Future<List<Map<String, dynamic>>> taskJobs(String token, int id) async =>
      runningTaskJob
      ? [
          {
            'id': 5,
            'startedAt': DateTime.now()
                .subtract(const Duration(seconds: 35))
                .toIso8601String(),
            'stoppedAt': null,
          },
        ]
      : [];

  @override
  Future<List<Map<String, dynamic>>> workReports(
    String accessToken, {
    int? enquiryId,
    int? taskId,
  }) async => [];

  @override
  Future<bool> workCheckpoint(
    String accessToken, {
    int? enquiryId,
    int? taskId,
  }) async => false;
}
