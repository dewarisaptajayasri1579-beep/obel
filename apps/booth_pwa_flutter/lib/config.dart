/// URL PWA petugas yang dibuka di WebView. Override lewat:
///   flutter run --dart-define=PWA_URL=https://staging.obelcoffee.app/petugas
const String kPwaUrl = String.fromEnvironment(
  'PWA_URL',
  defaultValue: 'http://10.0.2.2:3000/petugas',
);
