import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as path;

// Basic state providers for testing Riverpod
final messageProvider = StateProvider<String>((ref) => "No message yet");
final selectedDirectoryProvider = StateProvider<String?>((ref) => null);

void main() {
  runApp(
    const ProviderScope(
      child: WingmanApp(),
    ),
  );
}

class WingmanApp extends StatelessWidget {
  const WingmanApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Wingman - Test App',
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
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
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
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
      home: const TestScreen(),
    );
  }
}

class TestScreen extends ConsumerWidget {
  const TestScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final message = ref.watch(messageProvider);
    final selectedDirectory = ref.watch(selectedDirectoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Wingman - Environment Test'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      const Text(
                        'This is a basic test app to verify your Flutter Windows desktop environment.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 16),
                      ),
                      const SizedBox(height: 32),
                      
                      // Test directory browser - Moved to the top
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Directory Browser Test',
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        border: Border.all(
                                          color: Theme.of(context).colorScheme.outline,
                                          width: 1,
                                        ),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        selectedDirectory ?? 'No directory selected',
                                        style: TextStyle(
                                          color: selectedDirectory == null
                                              ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                              : Theme.of(context).colorScheme.onSurface,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  ElevatedButton(
                                    onPressed: () async {
                                      String? selectedDir = await FilePicker.platform.getDirectoryPath(
                                        dialogTitle: 'Select a directory',
                                      );

                                      if (selectedDir != null) {
                                        ref.read(selectedDirectoryProvider.notifier).state = selectedDir;
                                        ref.read(messageProvider.notifier).state = 'Selected directory: $selectedDir';
                                      } else {
                                        ref.read(messageProvider.notifier).state = 'No directory selected';
                                      }
                                    },
                                    child: const Text('Select Directory'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Test file operations section
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'File System Operations Test',
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 16),
                              Wrap(
                                spacing: 16.0,
                                runSpacing: 16.0,
                                alignment: WrapAlignment.start,
                                children: [
                                  ElevatedButton(
                                    onPressed: selectedDirectory == null
                                        ? null
                                        : () async {
                                            final testFile = File(path.join(selectedDirectory, 'wingman_test.txt'));
                                            await testFile.writeAsString('Test file created at ${DateTime.now()}');
                                            ref.read(messageProvider.notifier).state = 'File created at: ${testFile.path}';
                                          },
                                    child: const Text('Create Test File'),
                                  ),
                                  ElevatedButton(
                                    onPressed: selectedDirectory == null
                                        ? null
                                        : () async {
                                            final testFile = File(path.join(selectedDirectory, 'wingman_test.txt'));
                                            if (await testFile.exists()) {
                                              final content = await testFile.readAsString();
                                              ref.read(messageProvider.notifier).state = 'File content: $content';
                                            } else {
                                              ref.read(messageProvider.notifier).state =
                                                  'Test file does not exist yet. Create it first.';
                                            }
                                          },
                                    child: const Text('Read Test File'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Test text input
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Text Input Test',
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 16),
                              TextField(
                                decoration: const InputDecoration(
                                  border: OutlineInputBorder(),
                                  labelText: 'Type something to test input',
                                ),
                                onChanged: (value) {
                                  ref.read(messageProvider.notifier).state = 'Typed: $value';
                                },
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Message display section
                      const SizedBox(height: 32),
                      Card(
                        color: Theme.of(context).colorScheme.primaryContainer,
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            children: [
                              const Text(
                                'Status Message:',
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 8),
                              Text(message, textAlign: TextAlign.center),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
