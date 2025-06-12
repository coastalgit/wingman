import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:wingman/models/prompt_model.dart';
import 'package:wingman/models/config_model.dart';
import 'package:wingman/providers/app-providers.dart';
import 'package:wingman/services/speech-service.dart';
import 'package:wingman/utils/constants.dart';
import 'package:wingman/utils/utils.dart';
import 'package:wingman/widgets/common_widgets.dart';

class PromptsTab extends ConsumerStatefulWidget {
  const PromptsTab({super.key});

  @override
  ConsumerState<PromptsTab> createState() => _PromptsTabState();
}

class _PromptsTabState extends ConsumerState<PromptsTab> with SingleTickerProviderStateMixin {
  final Map<DevelopmentEnvironment, TextEditingController> _promptControllers = {};
  late TabController _environmentTabController;
  bool _isLoading = false;
  bool _isListening = false;
  bool _showHistory = false;

  final SpeechService _speechService = SpeechService();

  @override
  void initState() {
    super.initState();
    _initializePromptControllers();
    _initializeSpeechService();
  }

  @override
  void dispose() {
    // Dispose all controllers
    for (final controller in _promptControllers.values) {
      controller.dispose();
    }
    _environmentTabController.dispose();
    super.dispose();
  }

  void _initializePromptControllers() {
    // Create controllers for each environment
    final environments = ref.read(selectedEnvironmentsProvider);

    for (final env in environments) {
      final controller = TextEditingController();
      _promptControllers[env] = controller;

      // Add listener to update provider when text changes
      controller.addListener(() {
        if (!_isLoading) {
          ref.read(promptContentProvider(env).notifier).state = controller.text;
        }
      });

      // Initialize with current provider value
      final currentContent = ref.read(promptContentProvider(env));
      if (currentContent.isNotEmpty) {
        controller.text = currentContent;
      }
    }

    // Initialize tab controller
    _environmentTabController = TabController(
      length: environments.length + 1, // +1 for history tab
      vsync: this,
    );

    _environmentTabController.addListener(() {
      // Set the selected prompt tab provider
      if (_environmentTabController.index < environments.length) {
        ref.read(selectedPromptTabProvider.notifier).state = environments[_environmentTabController.index];

        // Toggle history view
        setState(() {
          _showHistory = false;
        });
      } else {
        // Last tab is history
        setState(() {
          _showHistory = true;
        });
      }
    });

    // Load initial prompt content
    _loadPromptContent();
  }

  Future<void> _initializeSpeechService() async {
    await _speechService.initialize();
  }

  Future<void> _loadPromptContent() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final config = ref.read(configProvider);
      final environments = ref.read(selectedEnvironmentsProvider);

      if (config == null) {
        throw Exception('Configuration not found');
      }

      // Load existing prompts for each environment
      for (final env in environments) {
        final controller = _promptControllers[env];
        if (controller != null) {
          // First check if we have content in the provider
          final providerContent = ref.read(promptContentProvider(env));

          if (providerContent.isNotEmpty) {
            // Use content from provider (user may have edited it)
            controller.text = providerContent;
          } else {
            // Load from file if provider is empty
            final existingPrompt = await Prompt.loadActivePrompt(config, env);
            if (existingPrompt != null) {
              controller.text = existingPrompt;
              ref.read(promptContentProvider(env).notifier).state = existingPrompt;
            }
          }
        }
      }

      // Set initially selected tab
      if (environments.isNotEmpty) {
        ref.read(selectedPromptTabProvider.notifier).state = environments.first;
      }
    } catch (e) {
      if (mounted) {
        Utils.showSnackBar(context, 'Error loading prompts: $e');
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _savePrompt(DevelopmentEnvironment environment) async {
    final config = ref.read(configProvider);
    final activeChat = ref.read(activeChatProvider);
    final controller = _promptControllers[environment];

    if (config == null || activeChat == null || controller == null) {
      Utils.showSnackBar(context, 'Configuration, active chat, or controller not found');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final promptContent = controller.text;

      // Create prompt model
      final prompt = Prompt.create(
        content: promptContent,
        chatName: activeChat.name,
        environment: environment,
      );

      // Save to history
      await prompt.saveToHistory(config);

      // Save to active prompt file
      await prompt.saveToActiveFile(config);

      // Update provider
      ref.read(promptContentProvider(environment).notifier).state = promptContent;

      // Refresh history
      ref.invalidate(promptHistoryProvider(environment));

      if (mounted) {
        Utils.showSnackBar(context, 'Prompt saved successfully');
      }
    } catch (e) {
      if (mounted) {
        Utils.showSnackBar(context, 'Error saving prompt: $e');
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _createNewPrompt(DevelopmentEnvironment environment) async {
    final config = ref.read(configProvider);
    final activeChat = ref.read(activeChatProvider);
    final controller = _promptControllers[environment];

    if (config == null || activeChat == null || controller == null) {
      Utils.showSnackBar(context, 'Configuration, active chat, or controller not found');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final promptContent = controller.text;

      // Skip if empty
      if (promptContent.trim().isEmpty) {
        return;
      }

      // Create prompt model
      final prompt = Prompt.create(
        content: promptContent,
        chatName: activeChat.name,
        environment: environment,
      );

      // Save to history
      await prompt.saveToHistory(config);

      // Save to active prompt file
      await prompt.saveToActiveFile(config);

      // Update provider
      ref.read(promptContentProvider(environment).notifier).state = promptContent;

      // Refresh history
      ref.invalidate(promptHistoryProvider(environment));

      // Clear the text area after saving
      controller.clear();
      ref.read(promptContentProvider(environment).notifier).state = '';

      if (mounted) {
        Utils.showSnackBar(context, 'New prompt created and editor cleared');
      }
    } catch (e) {
      if (mounted) {
        Utils.showSnackBar(context, 'Error creating prompt: $e');
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _toggleDictation(DevelopmentEnvironment environment) async {
    final controller = _promptControllers[environment];
    if (controller == null) return;

    if (_isListening) {
      await _speechService.stopListening();
      setState(() {
        _isListening = false;
      });
      return;
    }

    // Start listening
    bool success = await _speechService.startListening(
      onResult: (text) {
        // Get cursor position
        final cursorPos = controller.selection.baseOffset;
        final currentText = controller.text;

        // Insert at cursor position or append
        if (cursorPos >= 0) {
          final beforeCursor = currentText.substring(0, cursorPos);
          final afterCursor = cursorPos < currentText.length ? currentText.substring(cursorPos) : '';

          controller.text = beforeCursor + text + afterCursor;
          controller.selection = TextSelection.fromPosition(
            TextPosition(offset: (beforeCursor + text).length),
          );
        } else {
          // Just append to the end
          controller.text = currentText + (currentText.isEmpty ? '' : ' ') + text;
        }

        // Update provider
        ref.read(promptContentProvider(environment).notifier).state = controller.text;
      },
      onStatusChange: (isListening) {
        setState(() {
          _isListening = isListening;
        });
      },
    );

    setState(() {
      _isListening = success;
    });

    if (!success && mounted) {
      Utils.showSnackBar(
        context,
        'Failed to start speech recognition. Make sure your microphone is working.',
      );
    }
  }

  Future<void> _loadPromptFromHistory(Prompt prompt) async {
    final controller = _promptControllers[prompt.environment];
    if (controller != null) {
      controller.text = prompt.content;
      ref.read(promptContentProvider(prompt.environment).notifier).state = prompt.content;

      // Switch to the appropriate tab
      final environments = ref.read(selectedEnvironmentsProvider);
      final index = environments.indexOf(prompt.environment);
      if (index >= 0) {
        _environmentTabController.animateTo(index);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final environments = ref.watch(selectedEnvironmentsProvider);

    if (environments.isEmpty) {
      return const Center(
        child: Text('No environments configured. Please go back and select at least one environment.'),
      );
    }

    return LoadingOverlay(
      isLoading: _isLoading,
      message: 'Loading prompts...',
      child: Column(
        children: [
          // Environment tabs
          TabBar(
            controller: _environmentTabController,
            tabAlignment: TabAlignment.center,
            isScrollable: true,
            tabs: [
              ...environments.map((env) => Tab(
                    text: env.displayName,
                    icon: const Icon(Icons.chat),
                  )),
              const Tab(
                text: 'History',
                icon: Icon(Icons.history),
              ),
            ],
          ),

          // Tab content
          Expanded(
            child: TabBarView(
              controller: _environmentTabController,
              children: [
                ...environments.map((env) => _buildPromptEditor(env)),
                _buildHistoryTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPromptEditor(DevelopmentEnvironment environment) {
    final controller = _promptControllers[environment] ?? TextEditingController();

    String command;
    switch (environment) {
      case DevelopmentEnvironment.cursor:
        command = AppConstants.cursorPromptCommand;
        break;
      case DevelopmentEnvironment.claudeCode:
        command = AppConstants.claudeCodePromptCommand;
        break;
      default:
        command = 'Unknown';
    }

    return Padding(
      padding: const EdgeInsets.all(AppConstants.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Toolbar
          Row(
            children: [
              // New Prompt button
              ElevatedButton.icon(
                onPressed: () => _createNewPrompt(environment),
                style: ElevatedButton.styleFrom(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 24,
                  ),
                ),
                icon: const Icon(Icons.save_as),
                label: const Text('New Prompt'),
              ),

              const Spacer(),

              // Dictation button
              if (_speechService.isAvailable)
                DictationButton(
                  isListening: _isListening,
                  onPressed: () => _toggleDictation(environment),
                ),

              const SizedBox(width: 8),

              // Save button
              PrimaryButton(
                text: 'Save',
                icon: Icons.save,
                onPressed: () => _savePrompt(environment),
              ),
            ],
          ),

          // Command instruction
          Padding(
            padding: const EdgeInsets.only(top: 16.0, bottom: 2.0, left: 4.0),
            child: Row(
              children: [
                const Text('After saving, type '),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    command,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                const Text(' in your tool to use this prompt.'),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Editor
          Expanded(
            child: AppCard(
              padding: EdgeInsets.zero,
              child: TextField(
                controller: controller,
                maxLines: null,
                expands: true,
                textAlignVertical: TextAlignVertical.top, // Align text to top
                decoration: const InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.zero,
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: EdgeInsets.all(AppConstants.defaultPadding),
                  hintText: 'Enter your prompt here...',
                  alignLabelWithHint: true, // Helps align hint text to top as well
                ),
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryTab() {
    final selectedEnv = ref.watch(selectedPromptTabProvider);

    return Padding(
      padding: const EdgeInsets.all(AppConstants.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Filtering options
          Row(
            children: [
              const Text('Filter by: '),
              const SizedBox(width: 8),
              DropdownButton<DevelopmentEnvironment?>(
                value: selectedEnv,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                ),
                underline: Container(
                  height: 2,
                  color: Theme.of(context).colorScheme.primary,
                ),
                items: [
                  const DropdownMenuItem<DevelopmentEnvironment?>(
                    value: null,
                    child: Text('All Environments'),
                  ),
                  ...ref.watch(selectedEnvironmentsProvider).map(
                        (env) => DropdownMenuItem<DevelopmentEnvironment?>(
                          value: env,
                          child: Text(env.displayName),
                        ),
                      ),
                ],
                onChanged: (value) {
                  ref.read(selectedPromptTabProvider.notifier).state = value;
                },
              ),
            ],
          ),

          const SizedBox(height: 16),

          // History list
          Expanded(
            child: Consumer(
              builder: (context, ref, child) {
                final promptsAsync = ref.watch(promptHistoryProvider(selectedEnv));

                return promptsAsync.when(
                  data: (prompts) {
                    if (prompts.isEmpty) {
                      return const Center(
                        child: Text('No prompt history found'),
                      );
                    }

                    return ListView.builder(
                      itemCount: prompts.length,
                      itemBuilder: (context, index) {
                        final prompt = prompts[index];

                        return AppCard(
                          //margin: const EdgeInsets.only(bottom: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          prompt.displayTitle,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 16,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            Text(
                                              prompt.formattedTimestamp,
                                              style: TextStyle(
                                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                                                fontSize: 12,
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 6,
                                                vertical: 2,
                                              ),
                                              decoration: BoxDecoration(
                                                color: Theme.of(context).colorScheme.secondaryContainer,
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                prompt.environment.displayName,
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: Theme.of(context).colorScheme.onSecondaryContainer,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: () => _loadPromptFromHistory(prompt),
                                    style: ElevatedButton.styleFrom(
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 32,
                                        vertical: 24,
                                      ),
                                    ),
                                    child: const Text('Load'),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              const Divider(),
                              const SizedBox(height: 8),
                              Text(
                                prompt.content,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    );
                  },
                  loading: () => const Center(
                    child: CircularProgressIndicator(),
                  ),
                  error: (error, stackTrace) => Center(
                    child: Text('Error loading history: $error'),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
