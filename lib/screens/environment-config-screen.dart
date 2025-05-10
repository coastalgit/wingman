import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:wingman/models/config_model.dart';
import 'package:wingman/providers/app-providers.dart';

class EnvironmentConfigScreen extends ConsumerStatefulWidget {
  const EnvironmentConfigScreen({super.key});

  @override
  ConsumerState<EnvironmentConfigScreen> createState() => _EnvironmentConfigScreenState();
}

class _EnvironmentConfigScreenState extends ConsumerState<EnvironmentConfigScreen> {
  final bool _isLoading = false;
  late List<DevelopmentEnvironment> _selectedEnvironments;

  @override
  void initState() {
    super.initState();
    _selectedEnvironments = ref.read(selectedEnvironmentsProvider);
  }

  void _toggleEnvironment(DevelopmentEnvironment env) {
    setState(() {
      if (_selectedEnvironments.contains(env)) {
        _selectedEnvironments.remove(env);
      } else {
        _selectedEnvironments.add(env);
      }
    });
  }

  void _saveAndContinue() {
    ref.read(selectedEnvironmentsProvider.notifier).state = _selectedEnvironments;
    ref.read(currentScreenProvider.notifier).state = AppScreen.newChat;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Environment Configuration'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            ref.read(currentScreenProvider.notifier).state = AppScreen.projectSetup;
          },
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Select Your Development Environments',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Wingman will help you manage prompts and context for the selected AI-assisted development environments.',
                  style: TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Integrated Development Environments',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 16),
                        CheckboxListTile(
                          title: const Text('Cursor'),
                          subtitle: const Text('AI-native code editor'),
                          value: _selectedEnvironments.contains(DevelopmentEnvironment.cursor),
                          onChanged: (_) => _toggleEnvironment(DevelopmentEnvironment.cursor),
                          controlAffinity: ListTileControlAffinity.leading,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Command-Line Tools',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 16),
                        CheckboxListTile(
                          title: const Text('Claude Code'),
                          subtitle: const Text('Anthropic\'s Claude assistant for coding'),
                          value: _selectedEnvironments.contains(DevelopmentEnvironment.claudeCode),
                          onChanged: (_) => _toggleEnvironment(DevelopmentEnvironment.claudeCode),
                          controlAffinity: ListTileControlAffinity.leading,
                        ),
                        const Divider(),
                        const CheckboxListTile(
                          title: Text('Aider'),
                          subtitle: Text('Command-line AI pair programming tool (Disabled)'),
                          value: false,
                          onChanged: null,
                          controlAffinity: ListTileControlAffinity.leading,
                          enabled: false,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                const Text(
                  'Note: You must have the selected environments installed separately. Wingman does not install these tools.',
                  style: TextStyle(fontStyle: FontStyle.italic),
                ),
                const SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    ElevatedButton(
                      onPressed: _selectedEnvironments.isNotEmpty ? _saveAndContinue : null,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Continue'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
