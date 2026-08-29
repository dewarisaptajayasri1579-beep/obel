import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app_state.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';

void main() {
  runApp(const OwnerApp());
}

class OwnerApp extends StatelessWidget {
  const OwnerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState(),
      child: MaterialApp(
        title: 'Obbel Owner',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorSchemeSeed: const Color(0xFF6F4E37),
          useMaterial3: true,
        ),
        home: Consumer<AppState>(
          builder: (context, state, _) {
            return state.isLoggedIn ? const MainShell() : const LoginScreen();
          },
        ),
      ),
    );
  }
}
