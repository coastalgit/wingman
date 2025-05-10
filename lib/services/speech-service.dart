import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:speech_to_text/speech_recognition_result.dart';

/// Service for handling speech recognition (dictation)
class SpeechService {
  /// Singleton instance
  static final SpeechService _instance = SpeechService._internal();
  
  /// Speech recognition instance
  final SpeechToText _speech = SpeechToText();
  
  /// Whether speech recognition is available
  bool _speechAvailable = false;
  
  /// Whether speech recognition is currently active
  bool _isListening = false;
  
  /// Callback for when speech is recognized
  Function(String text)? _onResult;
  
  /// Callback for when speech recognition status changes
  Function(bool isListening)? _onStatusChange;

  /// Factory constructor
  factory SpeechService() {
    return _instance;
  }

  /// Private constructor
  SpeechService._internal();

  /// Whether speech recognition is available
  bool get isAvailable => _speechAvailable;
  
  /// Whether speech recognition is currently active
  bool get isListening => _isListening;

  /// Initialize speech recognition
  Future<bool> initialize() async {
    if (_speechAvailable) return true;
    
    try {
      _speechAvailable = await _speech.initialize(
        onStatus: (status) {
          if (status == 'done' || status == 'notListening') {
            _isListening = false;
            _onStatusChange?.call(false);
          }
        },
        onError: (error) {
          debugPrint('Speech recognition error: $error');
          _isListening = false;
          _onStatusChange?.call(false);
        },
      );
      return _speechAvailable;
    } catch (e) {
      debugPrint('Error initializing speech recognition: $e');
      _speechAvailable = false;
      return false;
    }
  }

  /// Start listening for speech
  Future<bool> startListening({
    required Function(String text) onResult,
    required Function(bool isListening) onStatusChange,
  }) async {
    if (!_speechAvailable) {
      final initialized = await initialize();
      if (!initialized) return false;
    }
    
    _onResult = onResult;
    _onStatusChange = onStatusChange;
    
    try {
      _isListening = await _speech.listen(
        onResult: _handleSpeechResult,
        listenFor: const Duration(seconds: 30),
        pauseFor: const Duration(seconds: 3),
        partialResults: true,
        localeId: 'en_US',
        cancelOnError: true,
        listenMode: ListenMode.confirmation,
      );
      
      _onStatusChange?.call(_isListening);
      return _isListening;
    } catch (e) {
      debugPrint('Error starting speech recognition: $e');
      _isListening = false;
      _onStatusChange?.call(false);
      return false;
    }
  }

  /// Stop listening for speech
  Future<void> stopListening() async {
    _speech.stop();
    _isListening = false;
    _onStatusChange?.call(false);
  }

  /// Handle speech recognition results
  void _handleSpeechResult(SpeechRecognitionResult result) {
    final String text = result.recognizedWords;
    _onResult?.call(text);
  }
}
