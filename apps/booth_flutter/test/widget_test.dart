import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:booth_flutter/app/app.dart';

void main() {
  testWidgets('App boots and shows splash screen', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: ObbelBoothApp()),
    );

    expect(find.text('Obbel Coffee & Milk'), findsOneWidget);

    // Biarkan timer splash screen selesai sebelum test berakhir.
    await tester.pump(const Duration(milliseconds: 950));
    await tester.pumpAndSettle();
  });
}
