import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:wingman/providers/app-providers.dart';
import 'package:wingman/screens/project-setup.dart';
import 'package:wingman/screens/environment-config-screen.dart';
import 'package:wingman/screens/new-chat-screen.dart';
import 'package:wingman/screens/main-interface.dart';
import 'package:wingman/utils/constants.dart';

void main() {
  runApp(
    const ProviderScope(
      child: WingmanApp(),
    ),
  );
}

class WingmanApp extends ConsumerWidget {
  const WingmanApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppConstants.primaryColor,
          brightness: Brightness.dark,
        ),
        brightness: Brightness.dark,
        useMaterial3: true,
        cardTheme: const CardTheme(
          elevation: 4,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 12,
            ),
          ),
        ),
      ),
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: AppConstants.primaryColor),
        useMaterial3: true,
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 12,
            ),
          ),
        ),
      ),
      home: const AppScreenSelector(),
    );
  }
}

class AppScreenSelector extends ConsumerWidget {
  const AppScreenSelector({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentScreen = ref.watch(currentScreenProvider);

    // Choose which screen to display based on current state
    switch (currentScreen) {
      case AppScreen.projectSetup:
        return const ProjectSetupScreen();
      case AppScreen.environmentConfig:
        return const EnvironmentConfigScreen();
      case AppScreen.newChat:
        return const NewChatScreen();
      case AppScreen.mainInterface:
        return const MainInterfaceScreen();
      default:
        return const ProjectSetupScreen(); // Default case to ensure a widget is always returned
    }
  }
}
