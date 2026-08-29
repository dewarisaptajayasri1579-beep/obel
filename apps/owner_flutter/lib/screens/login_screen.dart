import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController(text: 'owner');
  final _passwordController = TextEditingController(text: 'obbel123');

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.storefront, size: 64, color: Color(0xFF6F4E37)),
                const SizedBox(height: 12),
                Text('Obbel Owner', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 4),
                const Text('Ringkasan bisnis untuk pemilik'),
                const SizedBox(height: 32),
                TextField(
                  controller: _usernameController,
                  decoration: const InputDecoration(labelText: 'Username', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 24),
                if (state.error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(state.error!, style: const TextStyle(color: Colors.red)),
                  ),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: state.loading
                        ? null
                        : () => state.login(_usernameController.text.trim(), _passwordController.text),
                    child: state.loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Masuk'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
