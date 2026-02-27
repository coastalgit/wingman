# Wingman

## Overview

Wingman is a Flutter Windows desktop application built during the April 2025 Aspire Hackathon. It serves as a prompt and context manager for AI-assisted coding tools (Claude Code CLI, Cursor IDE, Aider). The core workflow is: write/edit prompts and context in the Wingman GUI, which saves them as markdown files to disk, then use short shell aliases (e.g. `ccc`, `ccp`) in the terminal to pipe those files into the AI tool.

## Architecture

- **Framework**: Flutter 3.5.3, Windows desktop target
- **State Management**: Riverpod (StateProvider, FutureProvider, Family modifiers)
- **Persistence**: File-based JSON + markdown (no database)
- **Navigation**: Custom enum-based routing (`AppScreen` enum via provider)
- **UI**: Material Design 3, dark theme, tabbed interface

## Project Structure

```
lib/
├── main.dart                    # Entry point, screen routing
├── providers/app-providers.dart # All Riverpod providers
├── models/
│   ├── config_model.dart        # WingmanConfig, DevelopmentEnvironment enum
│   ├── chat-model.dart          # Chat session model
│   ├── prompt_model.dart        # Prompt model with history persistence
│   └── context-model.dart       # Context template system
├── screens/
│   ├── project-setup.dart       # Project directory selection
│   ├── environment-config-screen.dart  # AI tool selection
│   ├── new-chat-screen.dart     # Chat creation/history
│   ├── main-interface.dart      # Tabbed main UI
│   └── tabs/
│       ├── context-tab.dart     # Context editor with markdown preview
│       └── prompts-tab.dart     # Prompt editor with history & speech
├── services/
│   ├── file-service.dart        # File I/O
│   └── speech-service.dart      # Speech-to-text
├── widgets/
│   ├── common_widgets.dart      # Reusable components
│   ├── claude_code_assistant.dart  # Claude Code setup dialog
│   └── utils.dart               # Widget utilities
└── utils/
    ├── constants.dart           # App-wide constants & styling
    └── utils.dart               # Helpers (WSL path conversion etc.)
```

## Application Flow

```
ProjectSetupScreen → EnvironmentConfigScreen → NewChatScreen → MainInterfaceScreen
                                                                 ├── Context Tab
                                                                 └── Prompts Tab (per environment)
```

## File System Layout (per project)

When configured, Wingman creates:
```
project-root/
├── wingman/
│   ├── wingcfg.json       # Project config
│   ├── chats.json         # Chat sessions
│   ├── history/           # Prompt history (JSON per prompt)
│   └── templates/         # Future template support
└── docs/
    ├── cc_context.md      # Claude Code context
    ├── cc_prompt.md       # Claude Code active prompt
    ├── cr_context.md      # Cursor context
    └── cr_prompt.md       # Cursor active prompt
```

## Key Environment Aliases

- **Claude Code**: `ccc` = read context, `ccp` = read prompt
- **Cursor**: `crc` = read context, `crp` = read prompt

## Dependencies

Core: `flutter_riverpod`, `flutter_markdown`, `file_picker`, `path_provider`, `speech_to_text`, `shared_preferences`, `intl`

## Development Notes

- App was originally scaffolded with Claude assistance during the hackathon
- Speech-to-text uses Windows native speech recognition
- WSL path conversion is handled in utils for Claude Code CLI (which runs in WSL)
- Prompt IDs use millisecond-precision timestamps (`yyyyMMdd_HHmmss_SSS`)

## Future Direction

The app's core value (prompt/context management for Claude Code) may be better served by Claude Code's own extensibility mechanisms (plugins, MCP servers, slash commands) which have matured since the hackathon. Consider migrating functionality into those formats.

## /checkpoint

When the user says "/checkpoint" or asks to create a checkpoint, create a checkpoint file at `docs/checkpoints/YYYY-MM-DD-HHMM.md` containing:
1. **Session Summary** — what was discussed and decided this session
2. **Current State** — where we are in the brainstorm/design/build process
3. **Open Questions** — unresolved decisions or items pending input
4. **Next Steps** — what to do when resuming in a new chat
5. **Key Files Modified** — list of files created or changed this session
6. **Decisions Made** — concrete choices locked in (tech stack, architecture, scope, etc.)

The checkpoint must contain enough context for a fresh Claude Code session to continue seamlessly.
