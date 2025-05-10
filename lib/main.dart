import 'package:wingman/providers/app-providers.dart';
import 'package:wingman/screens/environment-config-screen.dart';
import 'package:wingman/screens/main-interface.dart';
import 'package:wingman/screens/new-chat-screen.dart';
import 'package:wingman/screens/project-setup.dart';
import 'package:wingman/utils/constants.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:io';
import 'package:window_size/window_size.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Set minimum window size and default size
  if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
    setWindowTitle('Wingman');
    // Set minimum size to ensure UI elements have enough space
    setWindowMinSize(const Size(820, 820));
    // Allow the window to be maximized, but don't set a specific maximum size
    setWindowMaxSize(Size.infinite);

    // Set initial window size to approximately 1/4 width and 1/2 height of a typical screen
    getCurrentScreen().then((screen) {
      if (screen != null) {
        final screenWidth = screen.visibleFrame.width;
        final screenHeight = screen.visibleFrame.height;
        setWindowFrame(
          Rect.fromLTWH(
            screenWidth / 4, // Position at 1/4 of screen width from left
            screenHeight / 4, // Position at 1/4 of screen height from top
            screenWidth * 0.25, // 25% of screen width (1/4)
            screenHeight * 0.5, // 50% of screen height (1/2)
          ),
        );
      }
    });
  }

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
      title: "Wingman",
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
