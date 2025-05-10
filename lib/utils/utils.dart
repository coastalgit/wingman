import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Utility functions for the application
class Utils {
  /// Format a DateTime as a readable string
  static String formatDateTime(DateTime dateTime) {
    return DateFormat('MMM d, yyyy h:mm a').format(dateTime);
  }

  /// Format a DateTime as a date string
  static String formatDate(DateTime dateTime) {
    return DateFormat('MMM d, yyyy').format(dateTime);
  }

  /// Format a DateTime as a time string
  static String formatTime(DateTime dateTime) {
    return DateFormat('h:mm a').format(dateTime);
  }

  /// Format a DateTime as a file-friendly string (for filenames)
  static String formatDateTimeForFile(DateTime dateTime) {
    return DateFormat('yyyyMMdd_HHmmss').format(dateTime);
  }

  /// Show a snackbar with the given message
  static void showSnackBar(BuildContext context, String message) {
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8.0),
        ),
        margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 16.0),
      ),
    );
  }

  /// Truncate a string to a maximum length
  static String truncateString(String str, int maxLength) {
    if (str.length <= maxLength) return str;
    return '${str.substring(0, maxLength)}...';
  }

  /// Get the first line of a string
  static String getFirstLine(String str) {
    final lines = str.split('\n');
    if (lines.isEmpty) return '';
    return lines.first.trim();
  }

  /// Check if a string is a valid directory path
  static bool isValidDirectoryPath(String path) {
    // Simple validation - can be expanded as needed
    if (path.isEmpty) return false;
    if (path.length < 3) return false; // Minimum path length (e.g., "C:\")

    // Add more validation as needed
    return true;
  }

  /// Convert a Windows path to WSL path format
  /// e.g. C:\Users\user -> /mnt/c/Users/user
  static String convertToWslPath(String windowsPath) {
    if (windowsPath.isEmpty) return '';

    // Extract drive letter
    if (windowsPath.length < 2 || windowsPath[1] != ':') {
      return windowsPath; // Not a Windows path with drive letter
    }

    String driveLetter = windowsPath[0].toLowerCase();
    String restOfPath = windowsPath.substring(2).replaceAll('\\', '/');

    // Construct WSL path
    return '/mnt/$driveLetter$restOfPath';
  }

  /// Check if a string is a valid app name
  static bool isValidAppName(String name) {
    if (name.isEmpty) return false;
    if (name.length < 2) return false;
    if (name.length > 50) return false;

    // More validation can be added as needed
    return true;
  }

  /// Check if a string is a valid chat name
  static bool isValidChatName(String name) {
    if (name.isEmpty) return false;
    if (name.length < 2) return false;
    if (name.length > 50) return false;

    // More validation can be added as needed
    return true;
  }
}
