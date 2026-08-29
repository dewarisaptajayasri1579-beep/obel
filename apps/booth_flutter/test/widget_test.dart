import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:booth_flutter/api_client.dart';
import 'package:booth_flutter/app_state.dart';
import 'package:booth_flutter/main.dart';

/// Stand-in for the real Backend API so widget tests don't need a live
/// server. Only the calls exercised by the login → home flow are stubbed.
class FakeApiClient extends ApiClient {
  @override
  Future<Map<String, dynamic>> login(String username, String password) async {
    return {
      'accessToken': 'fake-token',
      'profile': {'fullName': 'Kak Rina'},
    };
  }

  @override
  Future<Map<String, dynamic>> getActiveShift(String token) async {
    return {
      'shiftSessionId': 'shift-1',
      'booth': {'name': 'Booth Gallery Pandanaran'},
      'shiftName': 'Shift 1',
      'scheduledStartAt': DateTime(2026, 1, 1, 8, 0).toIso8601String(),
      'scheduledEndAt': DateTime(2026, 1, 1, 16, 30).toIso8601String(),
    };
  }

  @override
  Future<List<dynamic>> getCatalog(String token) async => [];
}

void main() {
  testWidgets('Smoke test navigates from Login to Home Dashboard', (WidgetTester tester) async {
    // Set typical mobile viewport size to prevent scroll constraints in tests
    tester.view.physicalSize = const Size(1080, 2240);
    tester.view.devicePixelRatio = 2.0;

    // Build our app and trigger a frame.
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AppState(apiClient: FakeApiClient()),
        child: const ObbelBoothApp(),
      ),
    );

    // Verify we start on the Login screen by checking for key texts
    expect(find.text('Username'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('MASUK'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Masukkan username'), 'booth01');
    await tester.enterText(find.widgetWithText(TextField, 'Masukkan password'), 'obbel123');

    // Tap the 'MASUK' button to navigate to home
    await tester.tap(find.text('MASUK'));
    await tester.pumpAndSettle();

    // Verify navigation by finding home screen texts
    expect(find.text('Kak Rina 👋'), findsOneWidget);
    expect(find.text('SHIFT 1 AKTIF'), findsOneWidget);
  });
}
