import 'dart:io';
import 'package:path/path.dart' as path;
import '../models/config_model.dart';

/// Service for handling file system operations
class FileService {
  /// Creates necessary directory structure for a new project
  static Future<void> setupProjectStructure(WingmanConfig config) async {
    // Create wingman directory
    final wingmanDir = Directory(config.wingmanDirectory);
    if (!await wingmanDir.exists()) {
      await wingmanDir.create(recursive: true);
    }

    // Create history directory
    final historyDir = Directory(config.historyDirectory);
    if (!await historyDir.exists()) {
      await historyDir.create(recursive: true);
    }

    // Create templates directory
    final templatesDir = Directory(config.templatesDirectory);
    if (!await templatesDir.exists()) {
      await templatesDir.create(recursive: true);
    }

    // Create docs directory
    final docsDir = Directory(config.docsDirectory);
    if (!await docsDir.exists()) {
      await docsDir.create(recursive: true);
    }
  }

  /// Creates a default context template file
  static Future<void> createDefaultContextTemplate(WingmanConfig config) async {
    final templateDir = Directory(config.templatesDirectory);
    if (!await templateDir.exists()) {
      await templateDir.create(recursive: true);
    }

    final templatePath = path.join(config.templatesDirectory, 'context_template.md');
    final templateFile = File(templatePath);

    if (!await templateFile.exists()) {
      const defaultTemplate = '''# Context for AI Assistant - [PROJECT_NAME]

When I type the appropriate command in the terminal or chat, read this context file and apply it to our conversation.

## Project Context
This is a project named "[PROJECT_NAME]". I'm currently working on a task related to "[CHAT_NAME]".

## Project Overview
[Describe your project here]

## Technical Stack
[List the main technologies, frameworks, and libraries]

## Current Focus
I'm specifically working on "[CHAT_NAME]" which involves:
[Describe what you're trying to achieve]

## Working Constraints
[Add any special considerations or limitations]
''';

      await templateFile.writeAsString(defaultTemplate);
    }
  }

  /// Checks if a directory exists and is valid (not a root directory)
  static Future<bool> isValidRepository(String directory) async {
    final dir = Directory(directory);
    if (!await dir.exists()) {
      return false;
    }

    // Only validate that it's not a root directory
    // For Windows: C:\, D:\, etc.
    // For macOS/Linux: /
    final dirPath = dir.path;
    if (Platform.isWindows) {
      // Check if it's a Windows root directory like "C:\" or "D:\"
      final rootPattern = RegExp(r'^[A-Za-z]:\\$');
      if (rootPattern.hasMatch(dirPath)) {
        return false;
      }
    } else {
      // Check if it's the root directory "/"
      if (dirPath == '/') {
        return false;
      }
    }

    return true;
  }

  /// Checks if a wingman configuration exists in the given directory
  static Future<bool> hasExistingConfig(String directory) async {
    final configPath = path.join(directory, 'wingman', 'wingcfg.json');
    final configFile = File(configPath);

    return await configFile.exists();
  }

  /// Gets all prompt files from a project's docs directory
  static Future<List<File>> getPromptFiles(WingmanConfig config) async {
    final docsDir = Directory(config.docsDirectory);
    if (!await docsDir.exists()) {
      return [];
    }

    final List<File> promptFiles = [];

    await for (final entity in docsDir.list()) {
      if (entity is File && entity.path.endsWith('_prompt.md')) {
        promptFiles.add(entity);
      }
    }

    return promptFiles;
  }

  /// Gets all context files from a project's docs directory
  static Future<List<File>> getContextFiles(WingmanConfig config) async {
    final docsDir = Directory(config.docsDirectory);
    if (!await docsDir.exists()) {
      return [];
    }

    final List<File> contextFiles = [];

    await for (final entity in docsDir.list()) {
      if (entity is File && entity.path.endsWith('_context.md')) {
        contextFiles.add(entity);
      }
    }

    return contextFiles;
  }
}
