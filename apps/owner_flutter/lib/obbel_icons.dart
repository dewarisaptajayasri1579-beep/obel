import 'package:flutter/material.dart';

class ObbelIconPainter extends CustomPainter {
  final String iconType; // 'box_open', 'home', 'register', 'box_closed', 'badge', 'warning', 'document', 'cup'
  final Color color;

  const ObbelIconPainter({
    required this.iconType,
    required this.color,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final double w = size.width;
    final double h = size.height;

    switch (iconType) {
      case 'box_open':
        // Menggambar Isometric 3D Box Terbuka (Stok Masuk)
        // Flaps atas
        final pathFlaps = Path()
          ..moveTo(w * 0.5, h * 0.1)
          ..lineTo(w * 0.8, h * 0.25)
          ..lineTo(w * 0.5, h * 0.4)
          ..lineTo(w * 0.2, h * 0.25)
          ..close();
        canvas.drawPath(pathFlaps, paint);

        // Badan box bawah
        final pathSides = Path()
          ..moveTo(w * 0.2, h * 0.25)
          ..lineTo(w * 0.2, h * 0.75)
          ..lineTo(w * 0.5, h * 0.95)
          ..lineTo(w * 0.8, h * 0.75)
          ..lineTo(w * 0.8, h * 0.25);
        canvas.drawPath(pathSides, paint);

        // Garis tengah box
        final pathCenter = Path()
          ..moveTo(w * 0.5, h * 0.4)
          ..lineTo(w * 0.5, h * 0.95);
        canvas.drawPath(pathCenter, paint);

        // Flaps terbuka di kiri-kanan
        final pathLeftFlap = Path()
          ..moveTo(w * 0.2, h * 0.25)
          ..lineTo(w * 0.05, h * 0.15);
        final pathRightFlap = Path()
          ..moveTo(w * 0.8, h * 0.25)
          ..lineTo(w * 0.95, h * 0.15);
        canvas.drawPath(pathLeftFlap, paint);
        canvas.drawPath(pathRightFlap, paint);
        break;

      case 'home':
        // Minimalist home outline
        final path = Path()
          ..moveTo(w * 0.15, h * 0.85)
          ..lineTo(w * 0.15, h * 0.45)
          ..lineTo(w * 0.5, h * 0.15)
          ..lineTo(w * 0.85, h * 0.45)
          ..lineTo(w * 0.85, h * 0.85)
          ..close();
        canvas.drawPath(path, paint);
        // Door
        final door = Path()
          ..moveTo(w * 0.4, h * 0.85)
          ..lineTo(w * 0.4, h * 0.55)
          ..lineTo(w * 0.6, h * 0.55)
          ..lineTo(w * 0.6, h * 0.85);
        canvas.drawPath(door, paint);
        break;

      case 'register':
        // Cash Register outline
        final base = Path()
          ..moveTo(w * 0.15, h * 0.8)
          ..lineTo(w * 0.85, h * 0.8)
          ..lineTo(w * 0.8, h * 0.45)
          ..lineTo(w * 0.20, h * 0.45)
          ..close();
        canvas.drawPath(base, paint);
        // Screen top
        final screen = Path()
          ..moveTo(w * 0.35, h * 0.45)
          ..lineTo(w * 0.35, h * 0.2)
          ..lineTo(w * 0.65, h * 0.2)
          ..lineTo(w * 0.65, h * 0.45);
        canvas.drawPath(screen, paint);
        // Register slots
        canvas.drawLine(Offset(w * 0.3, h * 0.6), Offset(w * 0.7, h * 0.6), paint);
        canvas.drawLine(Offset(w * 0.3, h * 0.7), Offset(w * 0.7, h * 0.7), paint);
        break;

      case 'box_closed':
        // Isometric 3D Box Tertutup
        final top = Path()
          ..moveTo(w * 0.5, h * 0.15)
          ..lineTo(w * 0.85, h * 0.3)
          ..lineTo(w * 0.5, h * 0.48)
          ..lineTo(w * 0.15, h * 0.3)
          ..close();
        canvas.drawPath(top, paint);

        final sides = Path()
          ..moveTo(w * 0.15, h * 0.3)
          ..lineTo(w * 0.15, h * 0.75)
          ..lineTo(w * 0.5, h * 0.92)
          ..lineTo(w * 0.85, h * 0.75)
          ..lineTo(w * 0.85, h * 0.3);
        canvas.drawPath(sides, paint);

        canvas.drawLine(Offset(w * 0.5, h * 0.48), Offset(w * 0.5, h * 0.92), paint);
        break;

      case 'badge':
        // Badge with coin symbol / Shift active
        final circle = Path()
          ..addOval(Rect.fromCircle(center: Offset(w * 0.5, h * 0.45), radius: w * 0.32));
        canvas.drawPath(circle, paint);

        final dollar = Path()
          ..moveTo(w * 0.5, h * 0.25)
          ..lineTo(w * 0.5, h * 0.65);
        canvas.drawPath(dollar, paint);

        final coinCurve = Path()
          ..moveTo(w * 0.6, h * 0.35)
          ..quadraticBezierTo(w * 0.4, h * 0.35, w * 0.4, h * 0.45)
          ..quadraticBezierTo(w * 0.6, h * 0.45, w * 0.6, h * 0.55)
          ..quadraticBezierTo(w * 0.4, h * 0.55, w * 0.4, h * 0.58);
        canvas.drawPath(coinCurve, paint);

        // Ribbon bawah
        final ribbon = Path()
          ..moveTo(w * 0.3, h * 0.7)
          ..lineTo(w * 0.2, h * 0.95)
          ..lineTo(w * 0.45, h * 0.82)
          ..lineTo(w * 0.5, h * 0.75)
          ..lineTo(w * 0.55, h * 0.82)
          ..lineTo(w * 0.8, h * 0.95)
          ..lineTo(w * 0.7, h * 0.7);
        canvas.drawPath(ribbon, paint);
        break;

      case 'warning':
        // Warn Triangle
        final path = Path()
          ..moveTo(w * 0.5, h * 0.1)
          ..lineTo(w * 0.9, h * 0.85)
          ..lineTo(w * 0.1, h * 0.85)
          ..close();
        canvas.drawPath(path, paint);
        // Exclamation mark
        final exc = Paint()
          ..color = color
          ..style = PaintingStyle.fill;
        canvas.drawRect(Rect.fromLTWH(w * 0.47, h * 0.35, w * 0.06, h * 0.25), exc);
        canvas.drawCircle(Offset(w * 0.5, h * 0.72), w * 0.045, exc);
        break;

      case 'document':
        // Document / Receipt sheet
        final path = Path()
          ..moveTo(w * 0.2, h * 0.15)
          ..lineTo(w * 0.65, h * 0.15)
          ..lineTo(w * 0.8, h * 0.3)
          ..lineTo(w * 0.8, h * 0.85)
          ..lineTo(w * 0.2, h * 0.85)
          ..close();
        canvas.drawPath(path, paint);
        // Corner flap
        final corner = Path()
          ..moveTo(w * 0.65, h * 0.15)
          ..lineTo(w * 0.65, h * 0.3)
          ..lineTo(w * 0.8, h * 0.3);
        canvas.drawPath(corner, paint);
        // Lines inside document
        canvas.drawLine(Offset(w * 0.35, h * 0.45), Offset(w * 0.65, h * 0.45), paint);
        canvas.drawLine(Offset(w * 0.35, h * 0.58), Offset(w * 0.65, h * 0.58), paint);
        canvas.drawLine(Offset(w * 0.35, h * 0.7), Offset(w * 0.55, h * 0.7), paint);
        break;

      case 'document_code':
        // Document with code tags inside
        final path = Path()
          ..moveTo(w * 0.2, h * 0.15)
          ..lineTo(w * 0.65, h * 0.15)
          ..lineTo(w * 0.8, h * 0.3)
          ..lineTo(w * 0.8, h * 0.85)
          ..lineTo(w * 0.2, h * 0.85)
          ..close();
        canvas.drawPath(path, paint);
        // Corner flap
        final corner = Path()
          ..moveTo(w * 0.65, h * 0.15)
          ..lineTo(w * 0.65, h * 0.3)
          ..lineTo(w * 0.8, h * 0.3);
        canvas.drawPath(corner, paint);
        // XML tags inside document code
        final tagLeft = Path()
          ..moveTo(w * 0.4, h * 0.5)
          ..lineTo(w * 0.3, h * 0.6)
          ..lineTo(w * 0.4, h * 0.7);
        final tagRight = Path()
          ..moveTo(w * 0.6, h * 0.5)
          ..lineTo(w * 0.7, h * 0.6)
          ..lineTo(w * 0.6, h * 0.7);
        canvas.drawPath(tagLeft, paint);
        canvas.drawPath(tagRight, paint);
        canvas.drawLine(Offset(w * 0.52, h * 0.48), Offset(w * 0.46, h * 0.72), paint);
        break;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
