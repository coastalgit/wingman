import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wingman/models/config_model.dart';
import 'package:wingman/utils/constants.dart';
import 'package:wingman/utils/utils.dart';
import 'package:wingman/widgets/common_widgets.dart';

/// Shows a dialog with Claude Code quick start instructions
void showClaudeCodeAssistant(BuildContext context, WingmanConfig config) {
  showDialog(
    context: context,
    builder: (context) => ClaudeCodeAssistantDialog(config: config),
  );
}

class ClaudeCodeAssistantDialog extends ConsumerWidget {
  final WingmanConfig config;

  const ClaudeCodeAssistantDialog({
    super.key,
    required this.config,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Convert the project directory to WSL format
    final wslPath = Utils.convertToWslPath(config.projectDirectory);

    return Dialog(
      insetPadding: const EdgeInsets.all(16.0),
      child: Container(
        constraints: const BoxConstraints(
          maxWidth: 800,
          maxHeight: 700,
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
                    'Claude Code Quick Start',
                    style: AppConstants.headingStyle,
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
            const Divider(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Ready to start coding with Claude Code for your project: ',
                      style: AppConstants.bodyStyle,
                    ),
                    Text(
                      config.appName,
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
                      'Start Claude Code',
                      'Launch the Claude Code CLI tool',
                    ),
                    const SizedBox(height: 8),
                    const CopyableCodeBlock(
                      code: 'claude-code',
                    ),
                    const SizedBox(height: 16),
                    // Step 5
                    _buildStep(
                      '5',
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

                    // Step 6
                    _buildStep(
                      '6',
                      'Send Your Prompt',
                      'Send your prompt file to Claude',
                    ),
                    const SizedBox(height: 8),
                    const CopyableCodeBlock(
                      code: 'ccp',
                    ),                    const SizedBox(height: 8),
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
                      '• Use "ccc" once at the beginning of your session\n'
                      '• Use "ccp" each time you want to send a new prompt\n'
                      '• Wingman automatically updates the context and prompt files\n'
                      '• You can modify these files directly in the Wingman interface\n'
                      '• Type "exit" to end your Claude Code session',
                      style: AppConstants.bodyStyle,
                    ),
                  ],
                ),
              ),
            ),
            const Divider(),
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Close'),
                  ),
                ],
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
