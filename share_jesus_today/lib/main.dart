import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
// TODO: After running `flutter gen-l10n`, uncomment the following line
// import 'package:flutter_gen/gen_l10n/app_localizations.dart';

import 'package:share_jesus_today/src/models/video_model.dart';
import 'package:share_jesus_today/src/screens/about_screen.dart';
import 'package:share_jesus_today/src/screens/camera_screen.dart';
import 'package:share_jesus_today/src/screens/contact_screen.dart';
import 'package:share_jesus_today/src/screens/home_screen.dart';
import 'package:share_jesus_today/src/screens/login_screen.dart';
import 'package:share_jesus_today/src/screens/menu_screen.dart';
import 'package:share_jesus_today/src/screens/profile_screen.dart';
import 'package:share_jesus_today/src/screens/signup_screen.dart';
import 'package:share_jesus_today/src/screens/terms_screen.dart';
import 'package:share_jesus_today/src/screens/video_player_screen.dart';
import 'package:share_jesus_today/src/screens/video_trimmer_screen.dart';
import 'package:share_jesus_today/src/app_shell.dart';
import 'package:share_jesus_today/src/services/auth_service.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (context) => AuthService(),
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);

    final router = GoRouter(
      initialLocation: '/',
      refreshListenable: authService,
      redirect: (BuildContext context, GoRouterState state) {
        final bool loggedIn = authService.isAuthenticated;
        final nonAuthRoutes = ['/login', '/signup'];
        final isAuthenticating = nonAuthRoutes.contains(state.uri.toString());

        if (!loggedIn && !isAuthenticating) {
          return '/login';
        }

        if (loggedIn && isAuthenticating) {
          return '/';
        }

        return null;
      },
      routes: [
        ShellRoute(
          builder: (context, state, child) {
            return AppShell(child: child);
          },
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => const HomeScreen(),
              routes: [
                GoRoute(
                  path: 'video/:id',
                  builder: (context, state) {
                    final video = state.extra as Video;
                    return VideoPlayerScreen(video: video);
                  },
                ),
              ],
            ),
            GoRoute(
              path: '/menu',
              builder: (context, state) => const MenuScreen(),
            ),
          ],
        ),
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/signup',
          builder: (context, state) => const SignupScreen(),
        ),
        GoRoute(
          path: '/camera',
          builder: (context, state) => const CameraScreen(),
        ),
        GoRoute(
          path: '/trimmer',
          builder: (context, state) {
            final videoPath = state.extra as String;
            return VideoTrimmerScreen(videoPath: videoPath);
          },
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
        GoRoute(
          path: '/about',
          builder: (context, state) => const AboutScreen(),
        ),
        GoRoute(
          path: '/contact',
          builder: (context, state) => const ContactScreen(),
        ),
        GoRoute(
          path: '/terms',
          builder: (context, state) => const TermsScreen(),
        ),
      ],
    );

    return MaterialApp.router(
      routerConfig: router,
      title: 'Share Jesus Today',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      debugShowCheckedModeBanner: false,
      // TODO: After running `flutter gen-l10n`, add `AppLocalizations.delegate` to this list.
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en', ''), // English, no country code
        Locale('es', ''), // Spanish, no country code
      ],
    );
  }
}
