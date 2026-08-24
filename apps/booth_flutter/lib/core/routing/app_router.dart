import 'package:go_router/go_router.dart';

import '../../features/auth/login_screen.dart';
import '../../features/auth/splash_screen.dart';
import '../../features/home/root_shell.dart';
import '../../features/pos/cart_screen.dart';
import '../../features/pos/sale_success_screen.dart';
import '../../features/shift/closing_count_screen.dart';
import '../../features/stock_in/receive_stock_screen.dart';

final appRouter = GoRouter(
  initialLocation: '/splash',
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/root',
      builder: (context, state) => const RootShell(),
    ),
    GoRoute(
      path: '/receive-stock',
      builder: (context, state) => const ReceiveStockScreen(),
    ),
    GoRoute(
      path: '/cart',
      builder: (context, state) => const CartScreen(),
    ),
    GoRoute(
      path: '/sale-success',
      builder: (context, state) {
        final total = state.extra as int? ?? 0;
        return SaleSuccessScreen(total: total);
      },
    ),
    GoRoute(
      path: '/closing-count',
      builder: (context, state) => const ClosingCountScreen(),
    ),
  ],
);
