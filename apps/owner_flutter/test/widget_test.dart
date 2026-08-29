import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:owner_flutter/main.dart';

void main() {
  testWidgets('Owner app shows login screen when logged out', (WidgetTester tester) async {
    await tester.pumpWidget(const OwnerApp());

    expect(find.text('Obbel Owner'), findsWidgets);
    expect(find.widgetWithText(FilledButton, 'Masuk'), findsOneWidget);
  });
}
