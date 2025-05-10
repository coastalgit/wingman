import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as path;

import 'package:wingman/models/config_model.dart';
import 'package:wingman/providers/app-providers.dart';
import 'package:wingman/services/file-service.dart';
import 'package:wingman/utils/constants.dart';
import 'package:wingman/utils/utils.dart';
import 'package:wingman/widgets/common_widgets.dart';

class ProjectSetupScreen extends ConsumerStatefulWidget {
  const ProjectSetupScreen({super.key});

  @override
  ConsumerState<ProjectSetupScreen> createState() => _ProjectSetupScreenState();
}

class _ProjectSetupScreenState extends ConsumerState<ProjectSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _appNameController = TextEditingController();

  String? _selectedDirectory;
  bool _directoryError = false;
  bool _isLoading = false;
  bool _hasExistingConfig = false;
  WingmanConfig? _existingConfig;

  @override
  void initState() {
    super.initState();
    _appNameController.text = ref.read(appNameProvider);
  }

  @override
  void dispose() {
    _appNameController.dispose();
    super.dispose();
  }

  Future<void> _selectDirectory() async {
    setState(() {
      _isLoading = true;
      _directoryError = false;
    });

    try {
      final selectedDir = await FilePicker.platform.getDirectoryPath(
        dialogTitle: 'Select Project Directory',
      );

      if (selectedDir != null) {
        final isValidRepo = await FileService.isValidRepository(selectedDir);
        final hasConfig = await FileService.hasExistingConfig(selectedDir);

        if (isValidRepo) {
          setState(() {
            _selectedDirectory = selectedDir;
            _directoryError = false;
            _hasExistingConfig = hasConfig;
          });

          if (hasConfig) {
            final config = await WingmanConfig.loadConfig(selectedDir);
            if (config != null) {
              setState(() {
                _existingConfig = config;
                _appNameController.text = config.appName;
              });
              ref.read(appNameProvider.notifier).state = config.appName;
              ref.read(selectedEnvironmentsProvider.notifier).state = config.environments;
            }
          } else {
            // Use directory name as default app name
            final dirName = path.basename(selectedDir);
            setState(() {
              _appNameController.text = dirName;
            });
            ref.read(appNameProvider.notifier).state = dirName;
          }
        } else {
          setState(() {
            _selectedDirectory = selectedDir;
            _directoryError = true;
          });
        }
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _continueWithExisting() async {
    if (_existingConfig == null) return;

    setState(() {
      _isLoading = true;
    });

    try {
      // Set up config provider with existing config
      ref.read(configProvider.notifier).state = _existingConfig;

      // Set up environments
      ref.read(selectedEnvironmentsProvider.notifier).state = _existingConfig!.environments;

      // Navigate to next screen
      ref.read(currentScreenProvider.notifier).state = AppScreen.environmentConfig;
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _createNewConfig() async {
    if (_selectedDirectory == null || !_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final appName = _appNameController.text.trim();

      // Update providers
      ref.read(appNameProvider.notifier).state = appName;

      // Create config
      final config = WingmanConfig(
        appName: appName,
        projectDirectory: _selectedDirectory!,
        environments: ref.read(selectedEnvironmentsProvider),
        activeChatName: null,
      );

      // Set up project structure
      await FileService.setupProjectStructure(config);
      await FileService.createDefaultContextTemplate(config);
      await config.saveConfig();

      // Update config provider
      ref.read(configProvider.notifier).state = config;

      // Navigate to next screen
      ref.read(currentScreenProvider.notifier).state = AppScreen.environmentConfig;
    } catch (e) {
      if (mounted) {
        Utils.showSnackBar(context, 'Error setting up project: $e');
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Project Setup'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SafeArea(
        child: LoadingOverlay(
          isLoading: _isLoading,
          message: 'Setting up project...',
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppConstants.defaultPadding),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 800),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Logo image
                    const SizedBox(height: 20),
                    Image.asset(
                      'assets/icons/android-chrome-192x192.png',
                      width: 120,
                      height: 120,
                    ),
                    const SizedBox(height: 25),
                    const Text(
                      'Wingman is a utility to help manage your prompting experience \nfor AI coding tools, both for the IDE and CLI',
                      style: TextStyle(
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                        color: Color.fromARGB(255, 10, 142, 230),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Select Project Directory',
                      style: AppConstants.headingStyle,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Choose the root directory of your project.\nWingman will store configuration files in this directory.',
                      style: AppConstants.bodyStyle,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),

                    // Directory selection
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Project Directory',
                            style: AppConstants.subheadingStyle,
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    border: Border.all(
                                      color: _directoryError ? Colors.red : Theme.of(context).colorScheme.outline,
                                    ),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    _selectedDirectory ?? 'No directory selected',
                                    style: TextStyle(
                                      color: _selectedDirectory == null
                                          ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                          : _directoryError
                                              ? Colors.red
                                              : Theme.of(context).colorScheme.onSurface,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              ElevatedButton.icon(
                                icon: const Icon(Icons.folder_open),
                                label: const Text('Select Directory'),
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                                  //backgroundColor: Theme.of(context).colorScheme.primary,
                                ),
                                onPressed: _selectDirectory,
                              ),
                            ],
                          ),
                          if (_directoryError) ...[
                            const SizedBox(height: 8),
                            const Text(
                              'You cannot use a root directory (like C:\\ or D:\\). Please select a subdirectory instead.',
                              style: TextStyle(color: Colors.red),
                            ),
                          ],
                          if (_hasExistingConfig && _existingConfig != null) ...[
                            const SizedBox(height: 24),
                            const Divider(),
                            const SizedBox(height: 16),
                            Text(
                              'Existing Configuration Found',
                              style: AppConstants.subheadingStyle.copyWith(
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Found existing Wingman configuration for "${_existingConfig!.appName}"',
                            ),
                            const SizedBox(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                ElevatedButton(
                                  onPressed: () {
                                    setState(() {
                                      _hasExistingConfig = false;
                                      _existingConfig = null;
                                    });
                                  },
                                  style: ElevatedButton.styleFrom(
                                    side: BorderSide(
                                      color: Theme.of(context).colorScheme.outline,
                                      width: 1.0,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(4), // Set the radius here
                                    ),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                                  ),
                                  child: const Text('Reset'),
                                ),
                                // OutlinedButton(
                                //   onPressed: () {
                                //     setState(() {
                                //       _hasExistingConfig = false;
                                //       _existingConfig = null;
                                //     });
                                //   },
                                //   style: OutlinedButton.styleFrom(
                                //     padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                                //   ),
                                //   child: const Text('Reset'),
                                // ),
                                const SizedBox(width: 16),
                                ElevatedButton(
                                  onPressed: _continueWithExisting,
                                  child: const Text('Continue with Existing'),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),

                    if (!_hasExistingConfig && _selectedDirectory != null && !_directoryError) ...[
                      const SizedBox(height: 32),

                      // Project details form
                      AppCard(
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Project Details',
                                style: AppConstants.subheadingStyle,
                              ),
                              const SizedBox(height: 16),
                              TextFormField(
                                controller: _appNameController,
                                decoration: const InputDecoration(
                                  labelText: 'Application Name',
                                  hintText: 'Enter your project name',
                                  border: OutlineInputBorder(),
                                ),
                                validator: (value) {
                                  if (value == null || value.trim().isEmpty) {
                                    return 'Please enter an application name';
                                  }
                                  if (value.trim().length < 2) {
                                    return 'Application name must be at least 2 characters';
                                  }
                                  return null;
                                },
                                onChanged: (value) {
                                  ref.read(appNameProvider.notifier).state = value;
                                },
                              ),
                              const SizedBox(height: 24),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  ElevatedButton(
                                    onPressed: _createNewConfig,
                                    child: const Text('Continue'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
