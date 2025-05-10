import 'package:flutter/material.dart';

/// Application-wide constants
class AppConstants {
  // App info
  static const String appName = 'Wingman';
  static const String appVersion = '0.1.0';
  
  // UI Constants
  static const double defaultPadding = 16.0;
  static const double largePadding = 24.0;
  static const double smallPadding = 8.0;
  static const double cardElevation = 4.0;
  static const double borderRadius = 8.0;
  
  // Animation durations
  static const Duration defaultAnimationDuration = Duration(milliseconds: 250);
  static const Duration longAnimationDuration = Duration(milliseconds: 500);
  
  // Text styles
  static const TextStyle headingStyle = TextStyle(
    fontSize: 24.0,
    fontWeight: FontWeight.bold,
  );
  
  static const TextStyle subheadingStyle = TextStyle(
    fontSize: 18.0,
    fontWeight: FontWeight.w500,
  );
  
  static const TextStyle bodyStyle = TextStyle(
    fontSize: 14.0,
  );
  
  // Colors
  static const Color primaryColor = Color(0xFF3498DB);
  static const Color secondaryColor = Color(0xFF2C3E50);
  static const Color accentColor = Color(0xFFE74C3C);
  static const Color backgroundColor = Color(0xFF2C3E50);
  
  // Command shortcuts
  static const String cursorContextCommand = 'CRC';
  static const String cursorPromptCommand = 'CRP';
  static const String claudeCodeContextCommand = 'CCC';
  static const String claudeCodePromptCommand = 'CCP';
  
  // File paths
  static const String defaultTemplatesDir = 'templates';
  static const String defaultHistoryDir = 'history';
  static const String defaultDocsDir = 'docs';
  
  // Default template content
  static const String defaultContextTemplate = '''# Context for AI Assistant

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
}
