import 'dart:convert';
import 'dart:developer' as developer;

import 'package:share_plus/share_plus.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../camera/camera_service.dart';
import '../location/location_service.dart';
import '../printing/printer_bridge_service.dart';
import 'bridge_protocol.dart';

/// Titik pusat dispatch — daftar action baru cukup ditambah di [_handle],
/// tidak perlu nyentuh WebViewScreen. Lihat bridge_protocol.dart untuk
/// kontrak pesan JS<->Native.
class WebBridge {
  WebBridge(this._controller);

  final WebViewController _controller;
  final _printer = PrinterBridgeService();
  final _camera = CameraService();

  Future<void> onMessage(String rawMessage) async {
    late final BridgeRequest request;
    try {
      request = BridgeRequest.fromJson(jsonDecode(rawMessage) as Map<String, dynamic>);
    } catch (e) {
      developer.log('ObelBridge: pesan tidak valid: $rawMessage', error: e);
      return;
    }

    final response = await _handle(request);
    await _reply(response);
  }

  Future<BridgeResponse> _handle(BridgeRequest req) async {
    try {
      switch (req.action) {
        case 'gps.start':
          final ok = await LocationBridgeService.instance.start(
            apiBaseUrl: req.payload['apiBaseUrl'] as String,
            authToken: req.payload['authToken'] as String,
            shiftId: req.payload['shiftId'] as String,
            locationPath: (req.payload['locationPath'] as String?) ?? 'shifts/{shiftId}/location-ping',
            intervalSeconds: (req.payload['intervalSeconds'] as num?)?.toInt() ?? 60,
          );
          if (ok) return BridgeResponse.ok(req.id, {'tracking': true});
          // Bedakan "ditolak permanen" (butuh buka Settings manual, lihat
          // action gps.openSettings) dari sekadar ditolak (dialog masih akan
          // muncul lagi di percobaan berikutnya) — `.request()` yang dipakai
          // di atas TIDAK menampilkan dialog apapun kalau sudah permanen.
          final permanentlyDenied = await LocationBridgeService.instance.isPermanentlyDenied;
          return BridgeResponse.fail(
            req.id,
            permanentlyDenied
                ? 'Izin lokasi ditolak permanen — buka Pengaturan app untuk mengizinkan manual.'
                : 'Izin lokasi (termasuk "Izinkan selalu") ditolak.',
          );

        case 'gps.stop':
          await LocationBridgeService.instance.stop();
          return BridgeResponse.ok(req.id, {'tracking': false});

        case 'gps.openSettings':
          final opened = await LocationBridgeService.instance.openAppSettings();
          return BridgeResponse.ok(req.id, {'opened': opened});

        case 'gps.status':
          final tracking = await LocationBridgeService.instance.isTracking;
          return BridgeResponse.ok(req.id, {'tracking': tracking});

        case 'printer.list':
          final printers = await _printer.listPaired();
          // permissionPermanentlyDenied dikirim SEKALIAN (bukan cuma pas
          // gagal) supaya PWA bisa bedain "beneran belum ada printer
          // paired" dari "izin Bluetooth ditolak, list-nya nggak akan
          // pernah keisi tanpa buka Settings dulu" — dua kondisi itu
          // kelihatan SAMA PERSIS (list kosong) kalau cuma lihat array-nya.
          final permanentlyDenied = await _printer.isPermissionPermanentlyDenied;
          return BridgeResponse.ok(req.id, {'printers': printers, 'permissionPermanentlyDenied': permanentlyDenied});

        case 'printer.openSettings':
          final opened = await _printer.openAppSettings();
          return BridgeResponse.ok(req.id, {'opened': opened});

        case 'printer.select':
          await _printer.select(req.payload['name'] as String, req.payload['macAddress'] as String);
          return BridgeResponse.ok(req.id, {'selected': true});

        case 'printer.status':
          final status = await _printer.status();
          return BridgeResponse.ok(req.id, {'status': status});

        case 'printer.print':
          final success = await _printer.print(req.payload);
          return success
              ? BridgeResponse.ok(req.id, {'printed': true})
              : BridgeResponse.fail(req.id, 'Gagal cetak — cek printer sudah paired & menyala.');

        case 'camera.capture':
          final result = await _camera.capture(source: (req.payload['source'] as String?) ?? 'camera');
          return result == null
              ? BridgeResponse.fail(req.id, 'Dibatalkan user.')
              : BridgeResponse.ok(req.id, result);

        // WebView Android tidak bisa download `blob:` URL (<a download>) sama
        // sekali — PWA kirim isi file sebagai base64, dibagikan lewat share
        // sheet Android (Simpan ke Files/Drive, kirim WhatsApp, dst).
        case 'file.share':
          final fileName = req.payload['fileName'] as String;
          final bytes = base64Decode(req.payload['base64'] as String);
          final result = await SharePlus.instance.share(
            ShareParams(
              files: [XFile.fromData(bytes, mimeType: req.payload['mimeType'] as String?)],
              fileNameOverrides: [fileName],
            ),
          );
          return BridgeResponse.ok(req.id, {'status': result.status.name});

        default:
          return BridgeResponse.fail(req.id, 'Action tidak dikenal: ${req.action}');
      }
    } catch (e) {
      return BridgeResponse.fail(req.id, e.toString());
    }
  }

  Future<void> _reply(BridgeResponse response) async {
    final json = jsonEncode(response.toJson());
    // window.ObelBridgeResult wajib disediakan PWA — lihat kontrak di
    // bridge_protocol.dart.
    await _controller.runJavaScript(
      'window.ObelBridgeResult && window.ObelBridgeResult(${jsonEncode(response.id)}, $json);',
    );
  }
}
