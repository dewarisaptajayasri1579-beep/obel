import 'dart:convert';
import 'dart:io';

import 'package:image_picker/image_picker.dart';

/// Kamera native dipakai (bukan `getUserMedia` di WebView) supaya konsisten
/// dengan alasan yang sama seperti GPS: kualitas & perilakunya tidak
/// bergantung ke lifecycle WebView. Dipakai a.l. untuk foto selfie
/// check-in/check-out (lihat CheckInDto.photoUrl di backend).
class CameraService {
  final _picker = ImagePicker();

  /// [source]: "camera" (default) atau "gallery".
  /// Return null kalau user membatalkan.
  Future<Map<String, dynamic>?> capture({String source = 'camera'}) async {
    final file = await _picker.pickImage(
      source: source == 'gallery' ? ImageSource.gallery : ImageSource.camera,
      imageQuality: 80,
      maxWidth: 1600,
    );
    if (file == null) return null;

    final bytes = await File(file.path).readAsBytes();
    return {
      'base64': base64Encode(bytes),
      'mimeType': 'image/jpeg',
      'fileName': file.name,
    };
  }
}
