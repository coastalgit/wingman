import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as path;
import 'package:intl/intl.dart';
import 'config_model.dart';

/// Represents a prompt for an AI assistant
class Prompt {
  /// Unique identifier for the prompt (timestamp-based)
  final String id;

  /// The actual content of the prompt
  final String content;

  /// When the prompt was created
  final DateTime timestamp;

  /// The chat session this prompt belongs to
  final String chatName;

  /// The environment this prompt is for
  final DevelopmentEnvironment environment;

  Prompt({
    required this.id,
    required this.content,
    required this.timestamp,
    required this.chatName,
    required this.environment,
  });

  /// Creates a new prompt with the current timestamp
  factory Prompt.create({
    required String content,
    required String chatName,
    required DevelopmentEnvironment environment,
  }) {
    final now = DateTime.now();
    final formatter = DateFormat('yyyyMMdd_HHmm');
    final id = formatter.format(now);

    return Prompt(
      id: id,
      content: content,
      timestamp: now,
      chatName: chatName,
      environment: environment,
    );
  }

  /// Converts the prompt to a JSON map
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
      'chatName': chatName,
      'environment': environment.name,
    };
  }

  /// Creates a prompt from a JSON map
  factory Prompt.fromJson(Map<String, dynamic> json) {
    return Prompt(
      id: json['id'] as String,
      content: json['content'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      chatName: json['chatName'] as String,
      environment: DevelopmentEnvironment.values.firstWhere(
        (env) => env.name == json['environment'],
        orElse: () => DevelopmentEnvironment.cursor,
      ),
    );
  }

  /// Generates a display title for the prompt based on first line
  String get displayTitle {
    final firstLine = content.split('\n').first.trim();
    if (firstLine.isEmpty) return 'Empty Prompt';

    // Limit to 50 chars for display
    if (firstLine.length > 50) {
      return '${firstLine.substring(0, 47)}...';
    }
    return firstLine;
  }

  /// Formatted timestamp for display
  String get formattedTimestamp {
    return DateFormat('MMM d, yyyy h:mm a').format(timestamp);
  }

  /// Saves the prompt to the history directory
  Future<void> saveToHistory(WingmanConfig config) async {
    final dir = Directory(config.historyDirectory);
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }

    final fileName = '${id}_${environment.name}.json';
    final filePath = path.join(config.historyDirectory, fileName);
    final file = File(filePath);

    await file.writeAsString(jsonEncode(toJson()));
  }

  /// Saves the prompt to the active prompt file
  Future<void> saveToActiveFile(WingmanConfig config) async {
    final docsDir = Directory(config.docsDirectory);
    if (!await docsDir.exists()) {
      await docsDir.create(recursive: true);
    }

    final fileName = environment.promptFilename;
    final filePath = path.join(config.docsDirectory, fileName);
    final file = File(filePath);

    await file.writeAsString(content);
  }

  /// Loads prompts from the history directory for a specific chat
  static Future<List<Prompt>> loadHistory(
    WingmanConfig config, {
    String? chatName,
    DevelopmentEnvironment? environment,
  }) async {
    final dir = Directory(config.historyDirectory);
    if (!await dir.exists()) {
      return [];
    }

    final List<Prompt> prompts = [];

    await for (final entity in dir.list()) {
      if (entity is File && entity.path.endsWith('.json')) {
        try {
          final content = await entity.readAsString();
          final json = jsonDecode(content) as Map<String, dynamic>;
          final prompt = Prompt.fromJson(json);

          // Filter by chat name if provided
          if (chatName != null && prompt.chatName != chatName) {
            continue;
          }

          // Filter by environment if provided
          if (environment != null && prompt.environment != environment) {
            continue;
          }

          prompts.add(prompt);
        } catch (e) {
          // Skip invalid files
          continue;
        }
      }
    }

    // Sort by timestamp, newest first
    prompts.sort((a, b) => b.timestamp.compareTo(a.timestamp));

    return prompts;
  }

  /// Loads the active prompt file for a specific environment
  static Future<String?> loadActivePrompt(
    WingmanConfig config,
    DevelopmentEnvironment environment,
  ) async {
    final fileName = environment.promptFilename;
    final filePath = path.join(config.docsDirectory, fileName);
    final file = File(filePath);

    if (await file.exists()) {
      return await file.readAsString();
    }

    return null;
  }
}
