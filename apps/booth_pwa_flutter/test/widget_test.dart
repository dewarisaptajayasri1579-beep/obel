import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:booth_pwa_flutter/main.dart';

void main() {
  testWidgets('BoothPwaApp builds without throwing', (WidgetTester tester) async {
    await tester.pumpWidget(const BoothPwaApp());
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
