import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:path/path.dart' as path;
import 'package:wingman/models/config_model.dart';
import 'package:wingman/utils/constants.dart';
import 'package:wingman/utils/utils.dart';
import 'package:wingman/widgets/common_widgets.dart';

/// Shows a dialog with Claude Code quick start instructions
Future<void> showClaudeCodeAssistant(BuildContext context, WingmanConfig config) {
  return showDialog<void>(
    context: context,
    builder: (context) => ClaudeCodeAssistantDialog(config: config),
  );
}

class ClaudeCodeAssistantDialog extends ConsumerStatefulWidget {
  final WingmanConfig config;

  const ClaudeCodeAssistantDialog({
    super.key,
    required this.config,
  });

  @override
  ConsumerState<ClaudeCodeAssistantDialog> createState() => _ClaudeCodeAssistantDialogState();
}

class _ClaudeCodeAssistantDialogState extends ConsumerState<ClaudeCodeAssistantDialog> with TickerProviderStateMixin {
  late TabController _tabController;
  final _claudeMdController = TextEditingController();
  bool _isPreviewMode = true; // Default to preview as requested
  bool _isLoading = false;
  bool _claudeMdExists = false;
  String _claudeMdContent = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _claudeMdController.addListener(_onTextChanged);
    _checkClaudeMdFile();
  }

  void _onTextChanged() {
    // Update content when text changes for real-time preview
    setState(() {});
  }

  @override
  void dispose() {
    _tabController.dispose();
    _claudeMdController.removeListener(_onTextChanged);
    _claudeMdController.dispose();
    super.dispose();
  }

  Future<void> _checkClaudeMdFile() async {
    final claudeMdPath = path.join(widget.config.projectDirectory, 'CLAUDE.md');
    final file = File(claudeMdPath);
    
    final exists = file.existsSync();
    String content = '';
    
    if (exists) {
      try {
        content = await file.readAsString();
      } catch (e) {
        content = '';
      }
    }
    
    if (mounted) {
      setState(() {
        _claudeMdExists = exists;
        _claudeMdContent = content;
        _claudeMdController.text = content;
      });
    }
  }

  Future<void> _saveClaudeFile() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final claudeMdPath = path.join(widget.config.projectDirectory, 'CLAUDE.md');
      final file = File(claudeMdPath);
      
      await file.writeAsString(_claudeMdController.text);
      
      setState(() {
        _claudeMdExists = true;
        _claudeMdContent = _claudeMdController.text;
      });

      if (mounted) {
        Utils.showSnackBar(context, 'CLAUDE.md saved successfully');
      }
    } catch (e) {
      if (mounted) {
        Utils.showSnackBar(context, 'Error saving CLAUDE.md: $e');
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Convert the project directory to WSL format
    final wslPath = Utils.convertToWslPath(widget.config.projectDirectory);

    return Dialog(
      insetPadding: const EdgeInsets.all(16.0),
      child: Container(
        constraints: const BoxConstraints(
          maxWidth: 900,
          maxHeight: 800,
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  const Icon(Icons.code, size: 24),
                  const SizedBox(width: 8),
                  const Text(
                    'Claude Code Assistant',
                    style: AppConstants.headingStyle,
                  ),
                  const SizedBox(width: 16),
                  // CLAUDE.md status indicator
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _claudeMdExists ? Colors.green : Colors.orange,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _claudeMdExists ? Icons.check_circle : Icons.warning,
                          size: 16,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _claudeMdExists ? 'CLAUDE.md exists' : 'CLAUDE.md missing',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                    tooltip: 'Close',
                  ),
                ],
              ),
            ),
            // Tab bar
            TabBar(
              controller: _tabController,
              tabs: const [
                Tab(text: 'Quick Start Guide'),
                Tab(text: 'CLAUDE.md Editor'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // Quick Start Guide Tab
                  _buildQuickStartTab(wslPath),
                  // CLAUDE.md Editor Tab
                  _buildClaudeMdTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickStartTab(String wslPath) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Ready to start coding with Claude Code for your project: ',
            style: AppConstants.bodyStyle,
          ),
          Text(
            widget.config.appName,
            style: AppConstants.bodyStyle.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 24),

          // Step 1
          _buildStep(
            '1',
            'Open WSL Terminal',
            'Open your Windows Terminal and start a WSL session',
          ),
          const SizedBox(height: 16),
          // Step 2
          _buildStep(
            '2',
            'Navigate to Project',
            'Change to your project directory in WSL',
          ),
          const SizedBox(height: 8),
          CopyableCodeBlock(
            code: 'cd $wslPath',
          ),
          const SizedBox(height: 16),

          // Step 3
          _buildStep(
            '3',
            'Define Command Aliases',
            'Set up shortcuts for accessing context and prompt files',
          ),
          const SizedBox(height: 8),
          CopyableCodeBlock(
            code:
                'When I type \'ccc\', read the context file and process it as context\nalias ccc="cat $wslPath/docs/cc_context.md"\n\n When I type \'ccp\', read the prompt file and process it as instructions\nalias ccp="cat $wslPath/docs/cc_prompt.md"',
          ),
          const SizedBox(height: 8),
          const Text(
            '• These alias definitions tell the terminal what the commands ccc and ccp mean\n'
            '• The aliases only persist for your current terminal session\n'
            '• Claude will remember your context throughout the session after using ccc',
            style: AppConstants.bodyStyle,
          ),
          const SizedBox(height: 16),
          // Step 4
          _buildStep(
            '4',
            'Initialize Claude Code (Optional)',
            'Create a CLAUDE.md file for project-wide context',
          ),
          const SizedBox(height: 8),
          const CopyableCodeBlock(
            code: 'claude /init',
          ),
          const SizedBox(height: 8),
          const Text(
            '• Creates a CLAUDE.md file that Claude Code automatically reads\n'
            '• This provides project-wide context that persists across sessions\n'
            '• Only needed once per project - skip this step if CLAUDE.md already exists',
            style: AppConstants.bodyStyle,
          ),
          const SizedBox(height: 16),

          // Step 5
          _buildStep(
            '5',
            'Start Claude Code',
            'Launch the Claude Code CLI tool',
          ),
          const SizedBox(height: 8),
          const CopyableCodeBlock(
            code: 'claude',
          ),
          const SizedBox(height: 16),
          // Step 6
          _buildStep(
            '6',
            'Use Your Context File',
            'Send your context file to Claude',
          ),
          const SizedBox(height: 8),
          const CopyableCodeBlock(
            code: 'ccc',
          ),
          const SizedBox(height: 8),
          const Text(
            '• ccc reads your context file (cc_context.md) and sends it to Claude\n'
            '• This gives Claude the background information about your project',
            style: AppConstants.bodyStyle,
          ),
          const SizedBox(height: 16),

          // Step 7
          _buildStep(
            '7',
            'Send Your Prompt',
            'Send your prompt file to Claude',
          ),
          const SizedBox(height: 8),
          const CopyableCodeBlock(
            code: 'ccp',
          ),
          const SizedBox(height: 8),
          const Text(
            '• ccp reads your prompt file (cc_prompt.md) and sends it to Claude\n'
            '• Each time you update your prompt in Wingman, use this command to send it',
            style: AppConstants.bodyStyle,
          ),
          const SizedBox(height: 24),

          // Workflow Tips
          const Text(
            'Workflow Tips',
            style: AppConstants.subheadingStyle,
          ),
          const SizedBox(height: 8),
          const Text(
            '• CLAUDE.md: Project-wide context (automatic) - use "/init" once per project\n'
            '• Use "ccc" once at the beginning of your session for chat-specific context\n'
            '• Use "ccp" each time you want to send a new prompt\n'
            '• Wingman automatically updates the context and prompt files\n'
            '• You can modify these files directly in the Wingman interface\n'
            '• Type "exit" to end your Claude Code session',
            style: AppConstants.bodyStyle,
          ),
        ],
      ),
    );
  }

  Widget _buildClaudeMdTab() {
    return LoadingOverlay(
      isLoading: _isLoading,
      message: 'Saving CLAUDE.md...',
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Instructions
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'CLAUDE.md Editor',
                    style: AppConstants.subheadingStyle,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _claudeMdExists 
                      ? 'Your CLAUDE.md file contains project-wide context that Claude Code automatically reads.'
                      : 'Create a CLAUDE.md file to provide project-wide context that Claude Code will automatically read.',
                    style: AppConstants.bodyStyle,
                  ),
                  if (!_claudeMdExists) ...[
                    const SizedBox(height: 8),
                    const Text(
                      'Tip: You can also create this file by running "claude /init" in your terminal.',
                      style: TextStyle(fontStyle: FontStyle.italic),
                    ),
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
                  text: 'Save CLAUDE.md',
                  onPressed: _saveClaudeFile,
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
                        data: _claudeMdController.text.isEmpty 
                          ? '# ${widget.config.appName}\n\n*No content yet. Switch to Edit mode to add content.*'
                          : _claudeMdController.text,
                        padding: const EdgeInsets.all(AppConstants.defaultPadding),
                        styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                          h1: Theme.of(context).textTheme.headlineMedium,
                          h2: Theme.of(context).textTheme.titleLarge,
                          h3: Theme.of(context).textTheme.titleMedium,
                          p: Theme.of(context).textTheme.bodyMedium,
                        ),
                      )
                    : TextField(
                        controller: _claudeMdController,
                        maxLines: null,
                        expands: true,
                        textAlignVertical: TextAlignVertical.top,
                        decoration: InputDecoration(
                          border: const OutlineInputBorder(
                            borderRadius: BorderRadius.zero,
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.all(AppConstants.defaultPadding),
                          hintText: _claudeMdExists 
                            ? 'Edit your CLAUDE.md content here...'
                            : 'Create your CLAUDE.md content here...\n\nTip: Include project overview, technical stack, coding conventions, and any important context Claude should know about your project.',
                          alignLabelWithHint: true,
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

  Widget _buildStep(String stepNumber, String title, String description) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: Colors.blue,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  stepNumber,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: AppConstants.subheadingStyle,
            ),
          ],
        ),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.only(left: 32),
          child: Text(
            description,
            style: AppConstants.bodyStyle,
          ),
        ),
      ],
    );
  }
}
