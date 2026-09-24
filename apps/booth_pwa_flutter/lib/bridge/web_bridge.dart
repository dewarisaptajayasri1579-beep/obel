import 'dart:convert';
import 'dart:developer' as developer;

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
          );
          return ok
              ? BridgeResponse.ok(req.id, {'tracking': true})
              : BridgeResponse.fail(req.id, 'Izin lokasi (termasuk "Izinkan selalu") ditolak.');

        case 'gps.stop':
          await LocationBridgeService.instance.stop();
          return BridgeResponse.ok(req.id, {'tracking': false});

        case 'gps.status':
          final tracking = await LocationBridgeService.instance.isTracking;
          return BridgeResponse.ok(req.id, {'tracking': tracking});

        case 'printer.list':
          final printers = await _printer.listPaired();
          return BridgeResponse.ok(req.id, {'printers': printers});

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
