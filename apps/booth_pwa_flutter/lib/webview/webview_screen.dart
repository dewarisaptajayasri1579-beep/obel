import 'package:flutter/material.dart';
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

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFF7F9F6))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) => setState(() => _loading = false),
          // Skema selain http/https (whatsapp:, tel:, mailto:, intent:, dst —
          // mis. wa.me/?text=... redirect ke whatsapp://send?text=... di
          // context mobile) TIDAK bisa dirender WebView sama sekali
          // (net::ERR_UNKNOWN_URL_SCHEME, "Webpage not available"). Browser
          // biasa/Chrome tahu cara serahin ini ke app lain lewat App Links;
          // WebView polos TIDAK, harus diserahkan manual ke Android di sini.
          onNavigationRequest: (request) async {
            final uri = Uri.tryParse(request.url);
            if (uri == null || uri.scheme == 'http' || uri.scheme == 'https') {
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
      platform.setOnPlatformPermissionRequest((request) {
        final onlyCamera = request.types.every(
          (type) => type == WebViewPermissionResourceType.camera,
        );
        if (onlyCamera) {
          request.grant();
        } else {
          request.deny();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_loading) const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
    );
  }
}
