import 'package:booth_pwa_flutter/printing/print_line.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a styled line sent by the web', () {
    final line = PrintLine.fromJson({'text': 'OBBEL', 'align': 'center', 'bold': true, 'size': 2});
    expect(line.text, 'OBBEL');
    expect(line.align, PrintAlign.center);
    expect(line.bold, isTrue);
    expect(line.size, 2);
  });

  test('missing or unknown style falls back to a plain left-aligned line', () {
    final line = PrintLine.fromJson({'text': 'Original', 'align': 'diagonal', 'size': 9});
    expect(line.align, PrintAlign.left);
    expect(line.bold, isFalse);
    expect(line.size, 1);
    expect(PrintLine.fromJson({'text': 'x'}).align, PrintAlign.left);
  });

  test('right alignment and a list of lines', () {
    final lines = PrintLine.listFromJson([
      {'text': 'a', 'align': 'right'},
      {'text': 'b'},
    ]);
    expect(lines.map((l) => l.text), ['a', 'b']);
    expect(lines.first.align, PrintAlign.right);
  });

  test('rejects a payload that is not a list instead of printing nothing silently', () {
    expect(() => PrintLine.listFromJson(null), throwsFormatException);
    expect(() => PrintLine.listFromJson({'lines': []}), throwsFormatException);
  });
}
