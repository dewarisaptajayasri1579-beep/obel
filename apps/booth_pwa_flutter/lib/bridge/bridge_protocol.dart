/// Kontrak pesan antara PWA (JS) dan shell native ini.
///
/// JS -> Native, lewat JavaScript channel bernama [kBridgeChannelName]:
/// ```
/// ObelBridge.postMessage(JSON.stringify({
///   id: "string unik per request, dikirim balik apa adanya",
///   action: "gps.start | gps.stop | gps.status
///            | printer.list | printer.select | printer.status | printer.print
///            | camera.capture",
///   payload: { /* ...lihat masing-masing service... */ },
/// }))
/// ```
///
/// Native -> JS, dipanggil balik lewat runJavaScript setelah action selesai:
/// ```
/// window.ObelBridgeResult && window.ObelBridgeResult("id", {
///   ok: true, // atau false
///   data: "hasil, kalau ok",
///   error: "pesan error, kalau !ok",
/// })
/// ```
///
/// PWA WAJIB mendefinisikan `window.ObelBridgeResult` sebelum memanggil
/// action apa pun (misalnya sebagai resolver Promise yang di-keyed by id).
/// Shell ini sengaja tidak menaruh logic bisnis apa pun di sisi native —
/// hanya menjembatani ke kemampuan device yang tidak bisa diakses PWA murni
/// (GPS saat layar terkunci, printer thermal Bluetooth, kamera native).
const String kBridgeChannelName = 'ObelBridge';

class BridgeRequest {
  BridgeRequest({required this.id, required this.action, required this.payload});

  final String id;
  final String action;
  final Map<String, dynamic> payload;

  factory BridgeRequest.fromJson(Map<String, dynamic> json) {
    return BridgeRequest(
      id: json['id'] as String,
      action: json['action'] as String,
      payload: (json['payload'] as Map<String, dynamic>?) ?? const {},
    );
  }
}

class BridgeResponse {
  BridgeResponse.ok(this.id, this.data) : ok = true, error = null;
  BridgeResponse.fail(this.id, this.error) : ok = false, data = null;

  final String id;
  final bool ok;
  final Object? data;
  final String? error;

  Map<String, dynamic> toJson() => {
        'ok': ok,
        if (ok) 'data': data,
        if (!ok) 'error': error,
      };
}
