/// URL PWA petugas yang dibuka di WebView. Default ke server produksi supaya
/// `flutter run`/`flutter build apk` tanpa embel-embel apa pun langsung
/// kepakai betulan. Override kalau perlu ke dev lokal (emulator baca
/// `localhost` mesin host lewat alias `10.0.2.2`) atau staging:
///   flutter run --dart-define=PWA_URL=http://10.0.2.2:3000/petugas
const String kPwaUrl = String.fromEnvironment(
  'PWA_URL',
  defaultValue: 'https://admin-obel.apps.7smarts.id/petugas/login',
);
