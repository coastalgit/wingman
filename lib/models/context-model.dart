import 'dart:io';
import 'package:path/path.dart' as path;
import 'config_model.dart';

/// Represents a context for an AI assistant
class Context {
  /// The actual content of the context
  final String content;
  
  /// The chat session this context belongs to
  final String chatName;

  Context({
    required this.content,
    required this.chatName,
  });

  /// Saves the context to all enabled environment context files
  Future<void> saveToContextFiles(WingmanConfig config) async {
    final docsDir = Directory(config.docsDirectory);
    if (!await docsDir.exists()) {
      await docsDir.create(recursive: true);
    }

    // Save to each enabled environment
    for (final environment in config.environments) {
      final fileName = environment.contextFilename;
      final filePath = path.join(config.docsDirectory, fileName);
      final file = File(filePath);
      
      await file.writeAsString(content);
    }
  }

  /// Loads the context from any available environment context file
  /// Since all environments should have the same context, we just need to find one
  static Future<String?> loadContext(WingmanConfig config) async {
    final docsDir = Directory(config.docsDirectory);
    if (!await docsDir.exists()) {
      return null;
    }

    // Try to load from any enabled environment
    for (final environment in config.environments) {
      final fileName = environment.contextFilename;
      final filePath = path.join(config.docsDirectory, fileName);
      final file = File(filePath);
      
      if (await file.exists()) {
        return await file.readAsString();
      }
    }
    
    return null;
  }

  /// Creates a default context template for a new project
  static String createDefaultTemplate(String appName, String chatName) {
    return '''# Context for AI Assistant - $appName

When I type the appropriate command in the terminal or chat, read this context file and apply it to our conversation.

## Project Context
This is a project named "$appName". I'm currently working on a task related to "$chatName".

## Project Overview
[Describe your project here]

## Technical Stack
[List the main technologies, frameworks, and libraries]

## Current Focus
I'm specifically working on "$chatName" which involves:
[Describe what you're trying to achieve]

## Working Constraints
[Add any special considerations or limitations]

''';
  }
}
