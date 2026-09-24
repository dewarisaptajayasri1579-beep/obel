import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:permission_handler/permission_handler.dart';

import '../attendance_capture.dart' show captureCurrentLocation;
import '../printing/bluetooth_receipt_printer.dart';
import '../printing/receipt.dart';
import 'printer_settings_screen.dart';

/// Override via `--dart-define=PWA_BASE_URL=http://192.168.x.x:3000` saat
/// testing lokal. Sama pola dengan API_BASE_URL di api_client.dart (lama).
const _pwaBaseUrlOverride = String.fromEnvironment('PWA_BASE_URL');
const _defaultPwaBaseUrl = 'https://obel-admin.apps.7smarts.id';

/// Shell permanen booth_flutter — seluruh UI/logic bisnis (login, check-in/
/// check-out, kasir, stok, riwayat, setting) dipakai LANGSUNG dari PWA "Web
/// Petugas Booth" (apps/admin_web/src/app/petugas/*) lewat WebView, bukan
/// ditulis ulang di Dart. Dart cuma menjembatani 3 hal yang web nggak bisa
/// akses penuh: GPS (lewat permission callback WebView), kamera (idem), dan
/// printer thermal Bluetooth (lewat JS->Dart bridge, Web Bluetooth belum
/// didukung Android WebView). Lihat plan "booth_flutter jadi WebView shell".
class PwaShellScreen extends StatefulWidget {
  const PwaShellScreen({super.key});

  @override
  State<PwaShellScreen> createState() => _PwaShellScreenState();
}

class _PwaShellScreenState extends State<PwaShellScreen> {
  static String get _baseUrl =>
      _pwaBaseUrlOverride.isNotEmpty ? _pwaBaseUrlOverride : _defaultPwaBaseUrl;

  InAppWebViewController? _controller;

  Future<bool> _onWillPop() async {
    final controller = _controller;
    if (controller != null && await controller.canGoBack()) {
      controller.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (!shouldPop || !context.mounted) return;
        Navigator.of(context).maybePop();
      },
      child: Scaffold(
        body: SafeArea(
          child: InAppWebView(
            // /petugas (root), bukan /petugas/login langsung — halaman ini
            // dibungkus RequirePetugasAuth yang otomatis redirect ke login
            // kalau belum ada sesi, atau lanjut ke Beranda kalau sudah.
            initialUrlRequest: URLRequest(url: WebUri('$_baseUrl/petugas')),
            initialSettings: InAppWebViewSettings(
              javaScriptEnabled: true,
              geolocationEnabled: true,
              mediaPlaybackRequiresUserGesture: false,
              // PWA-nya nggak selalu declare warna teks eksplisit di semua
              // input, ngandelin default browser/CSS var. WebView Android
              // auto-dark-theme ("algorithmic darkening") bisa nge-invert
              // itu jadi nggak kebaca — matiin di sini (bukan di PWA) karena
              // ini spesifik ke cara kita nge-embed, bukan bug PWA-nya.
              algorithmicDarkeningAllowed: false,
            ),
            onWebViewCreated: (controller) {
              _controller = controller;

              // Cetak struk lewat printer thermal Bluetooth — dipanggil dari
              // kasir/page.tsx (lihat handleCetakNota di PWA) begitu
              // window.flutter_inappwebview terdeteksi ada.
              controller.addJavaScriptHandler(
                handlerName: 'printReceipt',
                callback: (args) async {
                  try {
                    final raw = args.first as Map<Object?, Object?>;
                    final data = raw.map(
                      (key, value) => MapEntry(key.toString(), value),
                    );
                    final receipt = Receipt(
                      boothName: data['boothName'] as String? ?? '-',
                      saleNo: data['saleNo'] as String? ?? '-',
                      time: DateTime.now(),
                      staffName: data['staffName'] as String?,
                      paymentMethod: data['paymentMethod'] as String? ?? '-',
                      total: (data['total'] as num?)?.toInt() ?? 0,
                      items: (data['items'] as List<dynamic>? ?? [])
                          .map(
                            (raw) => ReceiptItem(
                              name: (raw as Map)['name'] as String,
                              qty: raw['qty'] as int,
                              price: (raw['price'] as num).toInt(),
                            ),
                          )
                          .toList(),
                    );
                    final ok = await BluetoothReceiptPrinter().printReceipt(
                      receipt,
                    );
                    return {'ok': ok};
                  } catch (e) {
                    return {'ok': false, 'error': e.toString()};
                  }
                },
              );

              // Pairing Bluetooth OS-level — PWA nggak bisa lakuin ini
              // sendiri, dipanggil dari setting/page.tsx.
              controller.addJavaScriptHandler(
                handlerName: 'openPrinterSettings',
                callback: (_) async {
                  if (!mounted) return {'ok': false};
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const PrinterSettingsScreen(),
                    ),
                  );
                  return {'ok': true};
                },
              );
            },
            onGeolocationPermissionsShowPrompt: (controller, origin) async {
              try {
                await captureCurrentLocation();
                return GeolocationPermissionShowPromptResponse(
                  origin: origin,
                  allow: true,
                  retain: true,
                );
              } catch (_) {
                return GeolocationPermissionShowPromptResponse(
                  origin: origin,
                  allow: false,
                  retain: false,
                );
              }
            },
            onPermissionRequest: (controller, request) async {
              final wantsCamera = request.resources.contains(
                PermissionResourceType.CAMERA,
              );
              if (wantsCamera) {
                final status = await Permission.camera.request();
                if (!status.isGranted) {
                  return PermissionResponse(
                    resources: request.resources,
                    action: PermissionResponseAction.DENY,
                  );
                }
              }
              return PermissionResponse(
                resources: request.resources,
                action: PermissionResponseAction.GRANT,
              );
            },
          ),
        ),
      ),
    );
  }
}
