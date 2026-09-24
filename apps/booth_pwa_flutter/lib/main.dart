import 'package:flutter/material.dart';

import 'webview/webview_screen.dart';

void main() {
  runApp(const BoothPwaApp());
}

/// Shell native untuk PWA petugas booth (apps/admin_web/src/app/petugas).
/// Satu-satunya alasan app Flutter ini ada — bukan untuk UI transaksi —
/// adalah menjembatani 3 kemampuan yang tidak bisa diandalkan dari browser
/// murni: GPS yang tetap jalan saat layar terkunci, printer thermal
/// Bluetooth, dan kamera native. Lihat lib/bridge/bridge_protocol.dart.
class BoothPwaApp extends StatelessWidget {
  const BoothPwaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Obbel Petugas',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2F6B4F))),
      home: const WebViewScreen(),
    );
  }
}
