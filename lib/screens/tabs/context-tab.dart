import 'package:wingman/models/config_model.dart';
import 'package:wingman/utils/constants.dart';
import 'package:wingman/widgets/common_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:wingman/providers/app-providers.dart';
import 'package:wingman/utils/utils.dart';
import 'package:wingman/models/context-model.dart';

class ContextTab extends ConsumerStatefulWidget {
  const ContextTab({super.key});

  @override
  ConsumerState<ContextTab> createState() => _ContextTabState();
}

class _ContextTabState extends ConsumerState<ContextTab> {
  final _contextController = TextEditingController();
  bool _isPreviewMode = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _contextController.addListener(_onTextChanged);
    // Load context after the widget is built
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadContext();
    });
  }

  @override
  void dispose() {
    _contextController.removeListener(_onTextChanged);
    _contextController.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    if (!_isLoading) {
      // Prevent updating provider during loading
      ref.read(contextContentProvider.notifier).state = _contextController.text;
    }
  }

  Future<void> _loadContext() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final config = ref.read(configProvider);
      final activeChat = ref.read(activeChatProvider);

      if (config == null || activeChat == null) {
        throw Exception('Configuration or active chat not found');
      }

      // Use the computed context based on the active chat
      // This will use saved context if available, or default template if not
      final computedContext = ref.read(computedContextProvider);
      
      _contextController.text = computedContext;
      ref.read(contextContentProvider.notifier).state = computedContext;
      
    } catch (e) {
      if (mounted) {
        Utils.showSnackBar(context, 'Error loading context: $e');
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _saveContext() async {
    final config = ref.read(configProvider);
    final activeChat = ref.read(activeChatProvider);

    if (config == null || activeChat == null) {
      Utils.showSnackBar(context, 'Configuration or active chat not found');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final contextContent = _contextController.text;

      // Create context model
      final contextModel = Context(
        content: contextContent,
        chatName: activeChat.name,
      );

      // Save to all environment context files
      await contextModel.saveToContextFiles(config);

      // Update the chat with the new context
      activeChat.context = contextContent;
      await activeChat.saveChat(config);

      // Update the active chat provider with the updated chat
      ref.read(activeChatProvider.notifier).state = activeChat;
      
      // Refresh the chats provider to reload the data
      ref.invalidate(chatsProvider);

      // Update provider
      ref.read(contextContentProvider.notifier).state = contextContent;

      if (mounted) {
        Utils.showSnackBar(context, 'Context saved successfully');
      }
    } catch (e) {
      if (mounted) {
        Utils.showSnackBar(context, 'Error saving context: $e');
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(configProvider);
    final environments = ref.watch(selectedEnvironmentsProvider);
    
    // Listen for changes in computed context and update the text controller
    ref.listen<String>(computedContextProvider, (previous, next) {
      if (previous != next && !_isLoading) {
        _contextController.text = next;
        ref.read(contextContentProvider.notifier).state = next;
      }
    });

    return LoadingOverlay(
      isLoading: _isLoading,
      message: 'Loading context...',
      child: Padding(
        padding: const EdgeInsets.all(AppConstants.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Instructions
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Context Editor',
                    style: AppConstants.subheadingStyle,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'The context tells AI assistants about your project and current task. It will be used when you type the context command in your AI tool.',
                  ),
                  const SizedBox(height: 16),

                  // Environment instructions
                  if (environments.isNotEmpty) ...[
                    const Divider(),
                    const SizedBox(height: 8),
                    const Text(
                      'To use your context:',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    ...environments.map((env) {
                      String command;
                      switch (env) {
                        case DevelopmentEnvironment.cursor:
                          command = AppConstants.cursorContextCommand;
                          break;
                        case DevelopmentEnvironment.claudeCode:
                          command = AppConstants.claudeCodeContextCommand;
                          break;
                        default:
                          command = 'Unknown';
                      }

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 4.0),
                        child: Row(
                          children: [
                            Text('• For ${env.displayName}: Type '),
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
                          ],
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Editor toolbar
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Edit/Preview toggle
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment<bool>(
                      value: false,
                      label: Text('Edit'),
                      icon: Icon(Icons.edit),
                    ),
                    ButtonSegment<bool>(
                      value: true,
                      label: Text('Preview'),
                      icon: Icon(Icons.visibility),
                    ),
                  ],
                  selected: {_isPreviewMode},
                  onSelectionChanged: (selected) {
                    setState(() {
                      _isPreviewMode = selected.first;
                    });
                  },
                ),

                // Save button
                PrimaryButton(
                  text: 'Save Context',
                  onPressed: _saveContext,
                  icon: Icons.save,
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Editor area
            Expanded(
              child: AppCard(
                padding: EdgeInsets.zero,
                child: _isPreviewMode
                    ? Markdown(
                        data: _contextController.text,
                        padding: const EdgeInsets.all(AppConstants.defaultPadding),
                        styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                          h1: Theme.of(context).textTheme.headlineMedium,
                          h2: Theme.of(context).textTheme.titleLarge,
                          h3: Theme.of(context).textTheme.titleMedium,
                          p: Theme.of(context).textTheme.bodyMedium,
                        ),
                      )
                    : TextField(
                        controller: _contextController,
                        maxLines: null,
                        expands: true,
                        textAlignVertical: TextAlignVertical.top, // Align text to top
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.zero,
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: EdgeInsets.all(AppConstants.defaultPadding),
                          hintText: 'Enter your context here...',
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
      ),
    );
  }
}
