# booth_pwa_flutter

Shell native Android yang membungkus PWA petugas booth (`apps/admin_web/src/app/petugas`) di dalam WebView, khusus menjembatani 3 kemampuan yang tidak bisa diandalkan dari browser murni:

1. **GPS** — tetap mengirim lokasi tiap 1 menit walau layar HP terkunci, lewat Android foreground service (`lib/location/`) yang independen dari lifecycle WebView/JS.
2. **Cetak struk thermal Bluetooth** — browser tidak reliable untuk Web Bluetooth ke printer thermal (`lib/printing/`, adaptasi dari `apps/booth_flutter/lib/printing/`).
3. **Kamera** — foto selfie check-in/check-out lewat native `image_picker`, bukan `getUserMedia` (`lib/camera/`).

Semua UI dan alur bisnis tetap di PWA. App ini **tidak** punya logic transaksi apa pun — murni jembatan device.

## Kontrak bridge (JS ↔ Native)

Lihat `lib/bridge/bridge_protocol.dart` untuk detail lengkap. Ringkas:

```js
// JS -> Native
ObelBridge.postMessage(JSON.stringify({ id, action, payload }));

// Native -> JS (PWA wajib definisikan ini)
window.ObelBridgeResult = function (id, { ok, data, error }) { ... };
```

Actions yang tersedia: `gps.start`, `gps.stop`, `gps.status`, `printer.list`, `printer.select`, `printer.status`, `printer.print`, `camera.capture`.

### `gps.start` payload

```json
{ "apiBaseUrl": "https://api.obelcoffee.com", "authToken": "<JWT>", "shiftId": "<uuid>" }
```

Endpoint `POST {apiBaseUrl}/shifts/{shiftId}/location-ping` (role `BOOTH_STAFF`, body `{ latitude, longitude, capturedAt? }`) — lihat `backend/src/modules/shifts/shifts.controller.ts`. Cuma menyimpan titik lokasi terakhir di `ShiftSession.lastLocation*` (overwrite, bukan histori), ditolak dengan `SHIFT_NOT_ACTIVE` kalau shift sudah ditutup.

## Jalankan

```bash
flutter pub get
flutter run --dart-define=PWA_URL=http://10.0.2.2:3000/petugas
```

`10.0.2.2` adalah alias `localhost` mesin host dari emulator Android. Ganti ke URL staging/produksi PWA saat build rilis.
