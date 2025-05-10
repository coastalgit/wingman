import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as path;

/// Configuration model for the Wingman application.
/// Handles project-level settings and state.
class WingmanConfig {
  /// Name of the application being worked on
  final String appName;

  /// Root directory of the project
  final String projectDirectory;

  /// List of enabled development environments
  final List<DevelopmentEnvironment> environments;

  /// Currently active chat session name
  String? activeChatName;

  WingmanConfig({
    required this.appName,
    required this.projectDirectory,
    required this.environments,
    this.activeChatName,
  });

  /// Creates a default configuration with the given project directory
  factory WingmanConfig.defaultConfig(String projectDirectory) {
    return WingmanConfig(
      appName: 'New Project',
      projectDirectory: projectDirectory,
      environments: [DevelopmentEnvironment.cursor],
      activeChatName: null,
    );
  }

  /// Path to the docs directory within the project
  String get docsDirectory => path.join(projectDirectory, 'docs');

  /// Path to the wingman directory within the project
  String get wingmanDirectory => path.join(projectDirectory, 'wingman');

  /// Path to the history directory within the wingman directory
  String get historyDirectory => path.join(wingmanDirectory, 'history');

  /// Path to the templates directory within the wingman directory
  String get templatesDirectory => path.join(wingmanDirectory, 'templates');

  /// Path to the config file within the wingman directory
  String get configFilePath => path.join(wingmanDirectory, 'wingcfg.json');

  /// Converts the configuration to a JSON map
  Map<String, dynamic> toJson() {
    return {
      'appName': appName,
      'projectDirectory': projectDirectory,
      'environments': environments.map((e) => e.name).toList(),
      'activeChatName': activeChatName,
    };
  }

  /// Creates a configuration from a JSON map
  factory WingmanConfig.fromJson(Map<String, dynamic> json) {
    return WingmanConfig(
      appName: json['appName'] as String,
      projectDirectory: json['projectDirectory'] as String,
      environments: (json['environments'] as List)
          .map((e) => DevelopmentEnvironment.values.firstWhere(
                (env) => env.name == e,
                orElse: () => DevelopmentEnvironment.cursor,
              ))
          .toList(),
      activeChatName: json['activeChatName'] as String?,
    );
  }

  /// Saves the configuration to the config file
  Future<void> saveConfig() async {
    final configDir = Directory(wingmanDirectory);
    if (!await configDir.exists()) {
      await configDir.create(recursive: true);
    }

    final configFile = File(configFilePath);
    await configFile.writeAsString(jsonEncode(toJson()));
  }

  /// Loads the configuration from the config file
  static Future<WingmanConfig?> loadConfig(String projectDirectory) async {
    final configPath = path.join(projectDirectory, 'wingman', 'wingcfg.json');
    final configFile = File(configPath);

    if (await configFile.exists()) {
      final jsonString = await configFile.readAsString();
      final json = jsonDecode(jsonString) as Map<String, dynamic>;
      return WingmanConfig.fromJson(json);
    }

    return null;
  }

  /// Creates a new WingmanConfig with updated values
  WingmanConfig copyWith({
    String? appName,
    String? projectDirectory,
    List<DevelopmentEnvironment>? environments,
    String? activeChatName,
  }) {
    return WingmanConfig(
      appName: appName ?? this.appName,
      projectDirectory: projectDirectory ?? this.projectDirectory,
      environments: environments ?? this.environments,
      activeChatName: activeChatName ?? this.activeChatName,
    );
  }
}

/// Enum representing the different development environments
enum DevelopmentEnvironment {
  cursor,
  claudeCode,
  aider,
}

/// Extension to add helpful methods to the DevelopmentEnvironment enum
extension DevelopmentEnvironmentExtension on DevelopmentEnvironment {
  String get displayName {
    switch (this) {
      case DevelopmentEnvironment.cursor:
        return 'VS Code / Cursor';
      case DevelopmentEnvironment.claudeCode:
        return 'Claude Code';
      case DevelopmentEnvironment.aider:
        return 'Aider';
    }
  }

  String get description {
    switch (this) {
      case DevelopmentEnvironment.cursor:
        return 'IDE with AI code completion and chat';
      case DevelopmentEnvironment.claudeCode:
        return 'Command-line AI coding assistant';
      case DevelopmentEnvironment.aider:
        return 'Terminal-based AI pair programming (Coming Soon)';
    }
  }

  bool get isDisabled {
    return this == DevelopmentEnvironment.aider;
  }

  String get contextFilename {
    switch (this) {
      case DevelopmentEnvironment.cursor:
        return 'cr_context.md';
      case DevelopmentEnvironment.claudeCode:
        return 'cc_context.md';
      case DevelopmentEnvironment.aider:
        return 'ad_context.md';
    }
  }

  String get promptFilename {
    switch (this) {
      case DevelopmentEnvironment.cursor:
        return 'cr_prompt.md';
      case DevelopmentEnvironment.claudeCode:
        return 'cc_prompt.md';
      case DevelopmentEnvironment.aider:
        return 'ad_prompt.md';
    }
  }
}
