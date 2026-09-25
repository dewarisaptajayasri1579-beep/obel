import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../bridge/bridge_protocol.dart';
import '../bridge/web_bridge.dart';
import '../config.dart';

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

/// Link https yang harus dibuka app lain, bukan di dalam WebView — kalau
/// dibiarkan, WebView pindah ke halaman itu dan layar PWA (mis. struk kasir
/// setelah "Kirim WA") hilang begitu user kembali dari app tujuan.
const _hostEksternal = {'wa.me', 'api.whatsapp.com'};

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _gagalKonek = false;
  bool _mencobaLagi = false;
  bool _errorDiMuatIni = false;
  String? _urlGagal;

  @override
  void initState() {
    super.initState();
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFF7F9F6))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() {
            _loading = true;
            _errorDiMuatIni = false;
          }),
          // Layar gagal konek baru ditutup kalau muatan ini BENAR-BENAR
          // sukses — onPageFinished juga dipanggil untuk halaman error Chrome.
          onPageFinished: (_) => setState(() {
            _loading = false;
            _mencobaLagi = false;
            if (!_errorDiMuatIni) _gagalKonek = false;
          }),
          // SEMUA error halaman utama, bukan cuma tipe koneksi tertentu —
          // mis. ERR_EMPTY_RESPONSE / ERR_INTERNET_DISCONNECTED masuk tipe
          // `unknown` di Android. Error sub-resource (gambar, script) diabaikan.
          onWebResourceError: (error) {
            if (error.isForMainFrame == true) {
              setState(() {
                _errorDiMuatIni = true;
                _gagalKonek = true;
                _mencobaLagi = false;
                _urlGagal = error.url ?? _urlGagal;
              });
            }
          },
          // Skema selain http/https (whatsapp:, tel:, mailto:, intent:, dst —
          // mis. wa.me/?text=... redirect ke whatsapp://send?text=... di
          // context mobile) TIDAK bisa dirender WebView sama sekali
          // (net::ERR_UNKNOWN_URL_SCHEME, "Webpage not available"). Browser
          // biasa/Chrome tahu cara serahin ini ke app lain lewat App Links;
          // WebView polos TIDAK, harus diserahkan manual ke Android di sini.
          onNavigationRequest: (request) async {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.navigate;
            final webBiasa = uri.scheme == 'http' || uri.scheme == 'https';
            if (webBiasa && !_hostEksternal.contains(uri.host)) {
              return NavigationDecision.navigate;
            }
            await launchUrl(uri, mode: LaunchMode.externalApplication);
            return NavigationDecision.prevent;
          },
        ),
      );

    controller.addJavaScriptChannel(
      kBridgeChannelName,
      onMessageReceived: (message) => WebBridge(controller).onMessage(message.message),
    );

    // Tanpa ini, `navigator.mediaDevices.getUserMedia({video:true})` di PWA
    // (dipakai AttendanceCapture.tsx untuk selfie check-in/out) langsung
    // reject dengan "browser tidak mendukung akses kamera" — WebView Android
    // TIDAK auto-grant permission media seperti Chrome biasa, harus
    // di-approve eksplisit di sisi native tiap kali diminta.
    final platform = controller.platform;
    if (platform is AndroidWebViewController) {
      // Hanya kabulkan kamera — jangan blanket-grant microphone kalau suatu
      // saat PWA (tanpa sengaja atau lewat domain lain) memintanya juga.
      // grant() di sini cuma izin level WebView — izin runtime CAMERA Android
      // tetap harus diminta sendiri (sama seperti geolocation di bawah), kalau
      // tidak getUserMedia gagal diam-diam tanpa pernah muncul dialog izin.
      platform.setOnPlatformPermissionRequest((request) async {
        final onlyCamera = request.types.every(
          (type) => type == WebViewPermissionResourceType.camera,
        );
        if (!onlyCamera) {
          await request.deny();
          return;
        }
        final status = await Permission.camera.request();
        if (status.isGranted) {
          await request.grant();
        } else {
          await request.deny();
        }
      });
      // `navigator.geolocation` (dipakai AttendanceCapture.tsx untuk lokasi
      // check-in/out) punya prompt izin terpisah dari izin media di atas dan
      // dari izin lokasi OS — tanpa callback ini WebView Android menolak
      // semua request geolocation secara default, walau izin lokasi HP aktif.
      // Meng-allow prompt WebView saja TIDAK CUKUP kalau izin lokasi level OS
      // (Permission.locationWhenInUse) belum pernah diminta/di-grant untuk
      // app ini — getCurrentPosition akan tetap gagal diam-diam. Minta izin
      // OS dulu tepat di titik ini, baru jawab prompt WebView sesuai hasilnya
      // supaya PWA dapat PositionError yang jelas (bukan macet menunggu).
      platform.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (request) async {
          final status = await Permission.locationWhenInUse.request();
          return GeolocationPermissionsResponse(allow: status.isGranted, retain: status.isGranted);
        },
      );
      // `<input type="file">` (fallback "Pilih foto dari galeri" di
      // AttendanceCapture.tsx saat getUserMedia gagal/ditolak) butuh callback
      // ini juga — tanpanya WebView Android mengabaikan klik file-input
      // secara diam-diam, sama seperti geolocation di atas kalau tidak diisi.
      platform.setOnShowFileSelector((params) async {
        final picked = await ImagePicker().pickImage(
          source: ImageSource.gallery,
          imageQuality: 80,
          maxWidth: 1600,
        );
        if (picked == null) return <String>[];
        return ['file://${picked.path}'];
      });
    }

    controller.loadRequest(Uri.parse(kPwaUrl));
    _controller = controller;
  }

  Future<void> _cobaLagi() async {
    setState(() => _mencobaLagi = true);
    final url = _urlGagal ?? await _controller.currentUrl();
    await _controller.loadRequest(Uri.parse(url != null && url.startsWith('http') ? url : kPwaUrl));
  }

  @override
  Widget build(BuildContext context) {
    // Tanpa ini, tombol/gesture Back Android langsung menutup app, bukan
    // mundur ke halaman PWA sebelumnya.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (!_gagalKonek && await _controller.canGoBack()) {
          await _controller.goBack();
        } else {
          await SystemNavigator.pop();
        }
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_loading && !_gagalKonek) const Center(child: CircularProgressIndicator()),
              if (_gagalKonek) _LayarGagalKonek(mencobaLagi: _mencobaLagi, onCobaLagi: _cobaLagi),
            ],
          ),
        ),
      ),
    );
  }
}

class _LayarGagalKonek extends StatelessWidget {
  const _LayarGagalKonek({required this.mencobaLagi, required this.onCobaLagi});

  final bool mencobaLagi;
  final VoidCallback onCobaLagi;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFFF7F9F6),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 56, color: Color(0xFF64748B)),
              const SizedBox(height: 16),
              const Text(
                'Tidak bisa terhubung ke server',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Periksa koneksi internet HP, lalu coba lagi.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: mencobaLagi ? null : onCobaLagi,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0B5D34),
                  disabledBackgroundColor: const Color(0xFF0B5D34).withValues(alpha: 0.6),
                  disabledForegroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                ),
                child: mencobaLagi
                    ? const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          ),
                          SizedBox(width: 10),
                          Text('Menghubungkan...', style: TextStyle(fontWeight: FontWeight.w700)),
                        ],
                      )
                    : const Text('Coba Lagi', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
