import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:wingman/models/chat-model.dart';
import 'package:wingman/models/config_model.dart';
import 'package:wingman/providers/app-providers.dart';
import 'package:wingman/utils/constants.dart';
import 'package:wingman/utils/utils.dart';
import 'package:wingman/widgets/common_widgets.dart';
import 'package:wingman/widgets/claude_code_assistant.dart';

class NewChatScreen extends ConsumerStatefulWidget {
  const NewChatScreen({super.key});

  @override
  ConsumerState<NewChatScreen> createState() => _NewChatScreenState();
}

class _NewChatScreenState extends ConsumerState<NewChatScreen> {
  final _formKey = GlobalKey<FormState>();
  final _chatNameController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _chatNameController.text = ref.read(chatNameProvider);
  }

  @override
  void dispose() {
    _chatNameController.dispose();
    super.dispose();
  }

  void _goBack() {
    ref.read(currentScreenProvider.notifier).state = AppScreen.environmentConfig;
  }

  Future<void> _createChat() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final chatName = _chatNameController.text.trim();

      // Update provider
      ref.read(chatNameProvider.notifier).state = chatName;

      // Create chat
      final chat = Chat.create(name: chatName);

      // Get config
      final config = ref.read(configProvider);
      if (config == null) {
        throw Exception('Configuration not found');
      }

      // Update config with active chat
      final updatedConfig = config.copyWith(
        activeChatName: chatName,
      );

      // Save chat and config
      await chat.saveChat(updatedConfig);
      await updatedConfig.saveConfig();

      // Update providers
      ref.read(configProvider.notifier).state = updatedConfig;
      ref.read(activeChatProvider.notifier).state = chat;

      // Navigate to main interface
      ref.read(currentScreenProvider.notifier).state = AppScreen.mainInterface;
    } catch (e) {
      if (mounted) {
        Utils.showSnackBar(context, 'Error creating chat: $e');
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final chatsAsync = ref.watch(chatsProvider);
    final config = ref.watch(configProvider);

    return Scaffold(
      appBar: AppNavigationBar(
        title: 'New Chat',
        backLabel: 'Environment Setup',
        onBack: _goBack,
        actions: [
          // Claude Code Assistant button
          if (config != null && config.environments.contains(DevelopmentEnvironment.claudeCode))
            IconButton(
              icon: const Icon(Icons.code),
              onPressed: () => showClaudeCodeAssistant(context, config),
              tooltip: 'Claude Code Assistant',
            ),
        ],
      ),
      body: LoadingOverlay(
        isLoading: _isLoading,
        message: 'Creating chat...',
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppConstants.defaultPadding),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 800),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Breadcrumb navigation
                  BreadcrumbNav(
                    items: const ['Project Setup', 'Environment Setup', 'New Chat'],
                    onTaps: [
                      () => ref.read(currentScreenProvider.notifier).state = AppScreen.projectSetup,
                      _goBack,
                      null,
                    ],
                  ),
                  const SizedBox(height: 24),

                  const Text(
                    'Create a New Chat',
                    style: AppConstants.headingStyle,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Each chat organizes context and prompts for a specific task or feature. Give your chat a descriptive name that reflects what you\'re working on.',
                    style: AppConstants.bodyStyle,
                  ),
                  const SizedBox(height: 32),

                  // Chat creation form
                  AppCard(
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Chat Details',
                            style: AppConstants.subheadingStyle,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _chatNameController,
                            decoration: const InputDecoration(
                              labelText: 'Chat Name',
                              hintText: 'e.g., "Fix UI Theming" or "Add Authentication"',
                              border: OutlineInputBorder(),
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Please enter a chat name';
                              }
                              if (value.trim().length < 2) {
                                return 'Chat name must be at least 2 characters';
                              }
                              return null;
                            },
                            onChanged: (value) {
                              ref.read(chatNameProvider.notifier).state = value;
                            },
                          ),
                          const SizedBox(height: 24),
                          const Divider(),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Files will be created in the /docs directory',
                                style: TextStyle(
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                              PrimaryButton(
                                text: 'Create Chat',
                                onPressed: _createChat,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Claude Code Assistant Card
                  if (config != null && config.environments.contains(DevelopmentEnvironment.claudeCode)) ...[
                    const SizedBox(height: 32),
                    const SectionHeader(title: 'Tools & Utilities'),
                    AppCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.code, color: AppConstants.primaryColor),
                                const SizedBox(width: 8),
                                const Text(
                                  'Claude Code Assistant',
                                  style: AppConstants.subheadingStyle,
                                ),
                                const Spacer(),
                                SecondaryButton(
                                  text: 'Open',
                                  icon: Icons.launch,
                                  onPressed: () => showClaudeCodeAssistant(context, config),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Get step-by-step instructions for using Claude Code in WSL with copy-paste commands.',
                              style: AppConstants.bodyStyle,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],

                  // Previous chats
                  const SizedBox(height: 32),
                  const SectionHeader(title: 'Previous Chats'),

                  chatsAsync.when(
                    data: (chats) {
                      if (chats.isEmpty) {
                        return const AppCard(
                          child: Padding(
                            padding: EdgeInsets.all(16.0),
                            child: Center(
                              child: Text('No previous chats found'),
                            ),
                          ),
                        );
                      }

                      return Column(
                        children: chats.map((chat) {
                          return AppCard(
                            padding: const EdgeInsets.all(16),
                            onTap: () async {
                              setState(() {
                                _isLoading = true;
                              });

                              try {
                                // Update chat's last accessed time
                                chat.markAccessed();

                                // Get config
                                final config = ref.read(configProvider);
                                if (config == null) {
                                  throw Exception('Configuration not found');
                                }

                                // Update config with active chat
                                final updatedConfig = config.copyWith(
                                  activeChatName: chat.name,
                                );

                                // Save chat and config
                                await chat.saveChat(updatedConfig);
                                await updatedConfig.saveConfig();

                                // Update providers
                                ref.read(configProvider.notifier).state = updatedConfig;
                                ref.read(activeChatProvider.notifier).state = chat;

                                // Navigate to main interface
                                ref.read(currentScreenProvider.notifier).state = AppScreen.mainInterface;
                              } catch (e) {
                                if (mounted) {
                                  Utils.showSnackBar(context, 'Error opening chat: $e');
                                }
                              } finally {
                                setState(() {
                                  _isLoading = false;
                                });
                              }
                            },
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        chat.name,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Last accessed: ${Utils.formatDateTime(chat.lastAccessedAt)}',
                                        style: TextStyle(
                                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right),
                              ],
                            ),
                          );
                        }).toList(),
                      );
                    },
                    loading: () => const Center(
                      child: CircularProgressIndicator(),
                    ),
                    error: (error, stackTrace) => AppCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Center(
                          child: Text('Error loading chats: $error'),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
