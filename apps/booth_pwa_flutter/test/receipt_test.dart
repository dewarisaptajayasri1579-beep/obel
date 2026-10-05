import 'package:booth_pwa_flutter/printing/receipt.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('formatRupiah follows the UI convention', () {
    expect(formatRupiah(0), 'Rp0');
    expect(formatRupiah(500), 'Rp500');
    expect(formatRupiah(24000), 'Rp24.000');
    expect(formatRupiah(24560000), 'Rp24.560.000');
    expect(formatRupiah(-1000), '-Rp1.000');
  });

  test('formatWaktuStruk renders Asia/Jakarta time regardless of the phone time zone', () {
    expect(formatWaktuStruk(DateTime.utc(2026, 8, 23, 8, 40)), '23 Agu 2026, 15.40');
    // 17.30 UTC = 00.30 WIB keesokan harinya.
    expect(formatWaktuStruk(DateTime.parse('2026-09-30T17:30:00.000Z')), '1 Okt 2026, 00.30');
  });

  test('discount is derived from the items and the paid total', () {
    Receipt struk(int total) => Receipt.fromJson({
          'boothName': 'BOOTH 001',
          'saleNo': 'OBL-000001',
          'time': '2026-10-05T03:00:00.000Z',
          'items': [
            {'name': 'Kopsu', 'qty': 2, 'price': 12000},
            {'name': 'Original', 'qty': 1, 'price': 10000},
          ],
          'total': total,
          'paymentMethod': 'Tunai',
        });

    expect(struk(29000).subtotal, 34000);
    expect(struk(29000).discount, 5000);
    expect(struk(34000).discount, 0);
  });
}
