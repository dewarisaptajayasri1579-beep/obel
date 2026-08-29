import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:booth_flutter/app_state.dart';
import 'package:booth_flutter/main.dart';

void main() {
  testWidgets('Smoke test navigates from Login to Home Dashboard', (WidgetTester tester) async {
    // Set typical mobile viewport size to prevent scroll constraints in tests
    tester.view.physicalSize = const Size(1080, 2240);
    tester.view.devicePixelRatio = 2.0;

    // Build our app and trigger a frame.
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AppState(),
        child: const ObbelBoothApp(),
      ),
    );

    // Verify we start on the Login screen by checking for key texts
    expect(find.text('Username'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('MASUK'), findsOneWidget);

    // Tap the 'MASUK' button to navigate to home
    await tester.tap(find.text('MASUK'));
    await tester.pumpAndSettle();

    // Verify navigation by finding home screen texts
    expect(find.text('Kak Rina 👋'), findsOneWidget);
    expect(find.text('SHIFT 1 AKTIF'), findsOneWidget);
  });
}
