import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as path;
import 'config_model.dart';

/// Represents a chat session for working with AI assistants
class Chat {
  /// Unique name identifier for the chat
  final String name;
  
  /// When the chat was created
  final DateTime createdAt;
  
  /// When the chat was last accessed
  DateTime lastAccessedAt;

  Chat({
    required this.name,
    required this.createdAt,
    required this.lastAccessedAt,
  });

  /// Creates a new chat with the current timestamp
  factory Chat.create({
    required String name,
  }) {
    final now = DateTime.now();
    
    return Chat(
      name: name,
      createdAt: now,
      lastAccessedAt: now,
    );
  }

  /// Updates the last accessed timestamp to now
  void markAccessed() {
    lastAccessedAt = DateTime.now();
  }

  /// Converts the chat to a JSON map
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'createdAt': createdAt.toIso8601String(),
      'lastAccessedAt': lastAccessedAt.toIso8601String(),
    };
  }

  /// Creates a chat from a JSON map
  factory Chat.fromJson(Map<String, dynamic> json) {
    return Chat(
      name: json['name'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      lastAccessedAt: DateTime.parse(json['lastAccessedAt'] as String),
    );
  }

  /// Saves the chat to the chats registry
  Future<void> saveChat(WingmanConfig config) async {
    final chatsFile = File(path.join(config.wingmanDirectory, 'chats.json'));
    
    List<Map<String, dynamic>> chats = [];
    
    // Load existing chats if the file exists
    if (await chatsFile.exists()) {
      final content = await chatsFile.readAsString();
      chats = List<Map<String, dynamic>>.from(jsonDecode(content));
    }
    
    // Update or add this chat
    final existingIndex = chats.indexWhere((c) => c['name'] == name);
    
    if (existingIndex >= 0) {
      chats[existingIndex] = toJson();
    } else {
      chats.add(toJson());
    }
    
    // Write back to file
    await chatsFile.writeAsString(jsonEncode(chats));
  }

  /// Loads all chats from the chats registry
  static Future<List<Chat>> loadChats(WingmanConfig config) async {
    final chatsFile = File(path.join(config.wingmanDirectory, 'chats.json'));
    
    if (!await chatsFile.exists()) {
      return [];
    }
    
    final content = await chatsFile.readAsString();
    final jsonList = List<Map<String, dynamic>>.from(jsonDecode(content));
    
    final chats = jsonList.map((json) => Chat.fromJson(json)).toList();
    
    // Sort by last accessed, newest first
    chats.sort((a, b) => b.lastAccessedAt.compareTo(a.lastAccessedAt));
    
    return chats;
  }
}
