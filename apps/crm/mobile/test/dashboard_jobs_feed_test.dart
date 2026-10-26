import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:codexsun_crm_mobile/core/api/crm_mobile_api.dart';
import 'package:codexsun_crm_mobile/features/dashboard/dashboard_jobs_feed.dart';
import 'package:codexsun_crm_mobile/features/dashboard/my_enquiries_page.dart';

class FeedApi extends CrmMobileApi {
  FeedApi() : super('http://localhost');
  var running = true;
  var sessionReads = 0;
  var summaries = false;
  var visible = true;
  @override
  Future<List<CrmJob>> enquiries({
    required String accessToken,
    String scope = 'all',
    String filter = 'all',
    String search = '',
    String? listInId,
    int page = 1,
    int pageSize = 100,
  }) async => visible
      ? [
          CrmJob.fromJson({
            'id': '1',
            'title': 'Local job',
            'status': 'open',
            if (summaries) 'runningJobId': running ? 1 : null,
            if (summaries)
              'runningJobStartedAt': running ? '2026-10-26T06:00:00Z' : null,
          }),
        ]
      : [];
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
    final items = await enquiries(accessToken: accessToken);
    return CrmPage(
      items: items,
      page: page,
      pageSize: pageSize,
      total: items.length,
    );
  }

  @override
  Future<CrmCallEnquiryFormData> callEnquiryFormData(String token) async =>
      const CrmCallEnquiryFormData(groups: [], assignees: []);
  @override
  Future<Set<String>> pendingEnquiryClosureIds(String token) async => {};
  @override
  Future<Set<String>> pendingEnquiryCollectionIds(String token) async => {};
  @override
  Future<List<CrmJobExecution>> enquiryJobSessions({
    required String accessToken,
    required String enquiryId,
  }) async {
    sessionReads++;
    return [
      CrmJobExecution.fromJson({
        'id': '1',
        'status': running ? 'running' : 'completed',
        'startAt': '2026-10-26T06:00:00Z',
        'stopAt': running ? null : '2026-10-26T06:01:00Z',
      }),
    ];
  }
}

class SearchApi extends FeedApi {
  final searches = <String>[];

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
    searches.add(search);
    return CrmPage(
      items: [
        CrmJob.fromJson({
          'id': search.isEmpty ? '1' : '2000',
          'title': search.isEmpty
              ? 'First page record'
              : 'Remote matching record',
          'status': 'open',
          'runningJobId': null,
        }),
      ],
      page: 1,
      pageSize: 100,
      total: search.isEmpty ? 3000 : 1,
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('typing searches all enquiry pages without pressing Enter', (
    tester,
  ) async {
    final api = SearchApi();
    const session = UserSession(
      accessToken: 'test',
      profile: UserProfile(
        email: 'local@example.invalid',
        name: 'Local',
        role: 'user',
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: MyEnquiriesPage(api: api, session: session),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('First page record'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Remote matching');
    await tester.pump(const Duration(milliseconds: 301));
    await tester.pumpAndSettle();
    expect(api.searches.last, 'Remote matching');
    expect(find.text('Remote matching record'), findsOneWidget);
    expect(find.textContaining('3000 jobs'), findsNothing);
  });
  testWidgets('closure refresh removes a record from the visible mobile list', (
    tester,
  ) async {
    final api = FeedApi()
      ..summaries = true
      ..running = false;
    const session = UserSession(
      accessToken: 'test',
      profile: UserProfile(
        email: 'local@example.invalid',
        name: 'Local',
        role: 'user',
      ),
    );
    final feed = DashboardJobsFeed(api: api, session: session);
    addTearDown(feed.dispose);
    await feed.refresh();
    await tester.pumpWidget(
      MaterialApp(
        home: MyEnquiriesPage(api: api, session: session, jobsFeed: feed),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Local job'), findsOneWidget);
    api.visible = false;
    await feed.refresh();
    await tester.pumpAndSettle();
    expect(find.text('Local job'), findsNothing);
    expect(find.text('No jobs found.'), findsOneWidget);
  });
  test(
    'list summaries refresh running timers without session requests',
    () async {
      final api = FeedApi()..summaries = true;
      final feed = DashboardJobsFeed(
        api: api,
        session: const UserSession(
          accessToken: 'test',
          profile: UserProfile(
            email: 'local@example.invalid',
            name: 'Local',
            role: 'user',
          ),
        ),
      );
      addTearDown(feed.dispose);
      await feed.refresh();
      expect(feed.jobFor('1')!.jobs.single.name, '1');
      expect(feed.jobFor('1')!.jobs.single.isRunning, isTrue);
      api.running = false;
      await feed.refresh();
      expect(feed.jobFor('1')!.jobs, isEmpty);
      expect(api.sessionReads, 0);
    },
  );
  test(
    'web stop refreshes an opened mobile timer without fetching every card',
    () async {
      final api = FeedApi();
      final feed = DashboardJobsFeed(
        api: api,
        session: const UserSession(
          accessToken: 'local-test',
          profile: UserProfile(
            email: 'local@example.invalid',
            name: 'Local',
            role: 'user',
          ),
        ),
      );
      addTearDown(feed.dispose);
      await feed.refresh();
      expect(api.sessionReads, 0);
      await feed.jobSessions('1');
      expect(feed.jobFor('1')!.jobs.single.isRunning, isTrue);
      api.running = false;
      await feed.refresh();
      expect(api.sessionReads, 2);
      expect(feed.jobFor('1')!.jobs.single.isRunning, isFalse);
      expect(feed.jobFor('1')!.jobs.single.stopTime, isNotNull);
    },
  );
}
