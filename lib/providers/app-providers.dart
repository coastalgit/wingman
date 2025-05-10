import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wingman/models/chat-model.dart';
import 'package:wingman/models/context-model.dart';
import '../models/config_model.dart';
import '../models/prompt_model.dart';

/// Current application state for navigation
enum AppScreen {
  projectSetup,
  environmentConfig,
  newChat,
  mainInterface,
}

/// Provider for the current screen
final currentScreenProvider = StateProvider<AppScreen>((ref) => AppScreen.projectSetup);

/// Provider for the project configuration
final configProvider = StateProvider<WingmanConfig?>((ref) => null);

/// Provider for the entered app name during setup
final appNameProvider = StateProvider<String>((ref) => 'New Project');

/// Provider for the selected environments
final selectedEnvironmentsProvider = StateProvider<List<DevelopmentEnvironment>>((ref) => [
      DevelopmentEnvironment.cursor,
    ]);

/// Provider for the entered chat name
final chatNameProvider = StateProvider<String>((ref) => '');

/// Provider for the list of chats
final chatsProvider = FutureProvider<List<Chat>>((ref) async {
  final config = ref.watch(configProvider);
  if (config == null) {
    return [];
  }

  return await Chat.loadChats(config);
});

/// Provider for the active chat
final activeChatProvider = StateProvider<Chat?>((ref) => null);

/// Provider for the editor contents (context)
final contextContentProvider = StateProvider<String>((ref) {
  final config = ref.watch(configProvider);
  final activeChat = ref.watch(activeChatProvider);

  if (config != null && activeChat != null) {
    return Context.createDefaultTemplate(config.appName, activeChat.name);
  }

  return '';
});

/// Provider for whether the context is loading
final isContextLoadingProvider = StateProvider<bool>((ref) => false);

/// Provider for the active prompt contents
final promptContentProvider = StateProvider.family<String, DevelopmentEnvironment>((ref, env) => '');

/// Provider for whether the prompt is loading
final isPromptLoadingProvider = StateProvider<bool>((ref) => false);

/// Provider for the selected environment tab on the prompts screen
final selectedPromptTabProvider = StateProvider<DevelopmentEnvironment?>((ref) {
  final environments = ref.watch(selectedEnvironmentsProvider);
  if (environments.isEmpty) {
    return null;
  }
  return environments.first;
});

/// Provider for the prompt history
final promptHistoryProvider = FutureProvider.family<List<Prompt>, DevelopmentEnvironment?>((ref, environment) async {
  final config = ref.watch(configProvider);
  final activeChat = ref.watch(activeChatProvider);

  if (config == null || activeChat == null) {
    return [];
  }

  return await Prompt.loadHistory(
    config,
    chatName: activeChat.name,
    environment: environment,
  );
});

/// Provider for status messages
final statusMessageProvider = StateProvider<String>((ref) => '');

/// Provider for currently processing operations (loading indicator)
final isProcessingProvider = StateProvider<bool>((ref) => false);
