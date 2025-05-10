# Wingman - AI Prompt Management Tool

## Project Description
Wingman is a Flutter desktop application for Windows that helps developers manage prompts and context when working with AI coding tools like Claude Code and Cursor. It streamlines the workflow of saving, retrieving, and organizing prompts and context files used in AI-assisted development.

## Project Type
- Flutter desktop application targeting Windows
- Using Riverpod for state management
- Speech-to-text integration for dictation

## Key Features
- Working directory selection and configuration
- Environment selection (Cursor, Claude Code)
- Context management with templates
- Prompt creation with dictation support
- Prompt history and retrieval
- File management for context and prompts

## Core Files
- `main.dart`: Application entry point
- `models/`: Data models for configuration, prompts, etc.
- `providers/`: Riverpod providers for state management
- `screens/`: UI screens for different application stages
- `services/`: File I/O and speech recognition services
- `widgets/`: Reusable UI components

## Development Guidelines
- Follow Flutter best practices
- Use Riverpod for state management
- Implement MVVM-like architecture
- Focus on clear, readable code
- Add comments for complex logic
- Create unit tests for critical functionality

## Implementation Details
- Windows native file system access
- Windows Speech Recognition API integration
- Markdown editor for context
- Responsive UI with clear navigation
- JSON-based configuration storage

## User Experience Goals
- ADHD-friendly interface
- Clear navigation with breadcrumbs
- Visual feedback on actions
- Minimize context switching
- Intuitive file management

## Technical Requirements
- Flutter 3.x'
- Windows 10 or higher
- Support for text-to-speech via platform APIs
- Markdown parsing and rendering
- File system access for reading/writing
