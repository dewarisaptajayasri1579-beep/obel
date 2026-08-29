import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app_state.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/inbound_screen.dart';
import 'screens/checkout_screen.dart';
import 'theme.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => AppState(),
      child: const ObbelBoothApp(),
    ),
  );
}

class ObbelBoothApp extends StatelessWidget {
  const ObbelBoothApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Obbel Petugas Booth',
      theme: ObbelTheme.lightTheme,
      debugShowCheckedModeBanner: false,
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const MainShell(),
        '/inbound': (context) => const InboundScreen(),
        '/checkout': (context) => const CheckoutScreen(),
      },
    );
  }
}
