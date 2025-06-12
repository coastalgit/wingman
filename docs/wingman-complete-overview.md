# Wingman - AI-Assisted Development Prompt Manager

## Project Overview
Wingman is a Flutter desktop application for Windows designed to streamline AI-assisted development workflows. It provides a structured environment for managing context and prompts when working with AI coding tools like Claude Code and Cursor/VS Code, helping developers maintain context and prompt history while reducing cognitive load.

## Problem Solved
AI-assisted development tools require careful context management and prompt organization. Developers often struggle with:
- Repeatedly explaining project context to AI assistants
- Managing and reusing effective prompts
- Context switching between AI tools and project files
- Maintaining conversation history across development sessions
- Creating consistent file structures for AI tool integration

## Core Functionality

### Project Organization
- **Project Setup**: Select working directory and configure app-specific settings
- **Environment Configuration**: Choose which AI tools you're using (Cursor/VS Code, Claude Code)
- **Chat Sessions**: Organize work into named sessions (e.g., "fix ui theming", "add authentication")

### Context Management
- **Unified Context Files**: Create and maintain context that describes your project and current task
- **Template System**: Start with structured templates that include project overview, tech stack, and current focus
- **Cross-Tool Compatibility**: Automatically creates context files for each selected AI environment
- **Markdown Editor**: Edit context with live preview capabilities

### Prompt Management
- **Environment-Specific Prompts**: Separate prompt management for each AI tool
- **History Tracking**: Automatically archives all prompts with timestamps
- **Quick Access**: Browse and reload previous prompts
- **File Integration**: Saves prompts as files that AI tools can directly read

### Workflow Integration
- **File-Based Operation**: Creates standardized file structure in your project's `/docs` directory
- **Command Integration**: Provides clear instructions for using context and prompts with AI tools
- **Real-Time Updates**: Changes in Wingman immediately update the corresponding files

## File Structure Created
```
your-project/
├── wingman/
│   ├── wingcfg.json (configuration)
│   ├── history/ (timestamped prompt archives)
│   └── templates/ (context templates)
└── docs/
    ├── cc_context.md (Claude Code context)
    ├── cc_prompt.md (Claude Code prompt)
    ├── cr_context.md (Cursor context)
    └── cr_prompt.md (Cursor prompt)
```

## Integration with AI Tools

### Claude Code Integration
- Creates command aliases: `ccc` (context) and `ccp` (prompt)
- Provides step-by-step terminal setup instructions
- Converts Windows paths to WSL format for seamless operation

### Cursor/VS Code Integration
- File-based context and prompt management
- Compatible with VS Code's AI features and GitHub Copilot
- Supports project-wide context files

## Technical Implementation

### Architecture
- **Framework**: Flutter desktop application for Windows
- **State Management**: Riverpod for reactive state management
- **File Operations**: Direct file system access for reading/writing configuration and content files
- **UI Design**: ADHD-friendly interface with clear navigation and visual feedback

### Key Features
- **Dark Theme**: Optimized for extended coding sessions
- **Responsive Design**: Works alongside other development tools
- **Navigation System**: Clear breadcrumb navigation and back buttons
- **Error Handling**: Robust file operations with user feedback
- **Settings Persistence**: Remembers project configurations across sessions

## User Experience Design

### ADHD-Friendly Features
- **Reduced Context Switching**: Everything needed in one application
- **Visual Feedback**: Clear indicators for save states and processing
- **Structured Workflow**: Step-by-step guidance through setup and usage
- **Consistent Interface**: Predictable navigation and layout
- **Focus Management**: Organized tabs and clear sections

### Workflow Benefits
- **Quick Setup**: 5-step process from project selection to active development
- **Session Continuity**: Resume previous chat sessions with full context
- **Prompt Reuse**: Easily find and reuse successful prompts
- **Multi-Tool Support**: Work with multiple AI assistants simultaneously

## Business Value

### For Individual Developers
- **Increased Productivity**: Faster context establishment with AI tools
- **Better Organization**: Structured approach to AI-assisted development
- **Knowledge Retention**: Maintains history of effective prompts and contexts
- **Reduced Cognitive Load**: Less mental overhead in managing AI conversations

### For Development Teams
- **Standardization**: Consistent approach to AI tool usage across team members
- **Knowledge Sharing**: Shareable context templates and prompt libraries
- **Onboarding**: New team members can quickly understand project context
- **Best Practices**: Encourages structured interaction with AI tools

## Success Metrics
- **Hackathon Achievement**: 3rd place out of 100+ developers
- **Workflow Enhancement**: Demonstrably improved AI-assisted development efficiency
- **Practical Application**: Successfully used in real development scenarios
- **User Adoption**: Continuing use beyond initial development

## Technology Stack
- **Frontend**: Flutter 3.5.3 with Material Design 3
- **State Management**: Riverpod 2.4.0
- **File Operations**: Native Dart file I/O with path utilities
- **Platform**: Windows desktop with potential for cross-platform expansion
- **Dependencies**: Minimal external dependencies for stability and performance

## Extension Possibilities
- **Template Library**: Pre-built context templates for common project types
- **Cloud Sync**: Team collaboration and context sharing
- **Performance Analytics**: Track prompt effectiveness and AI interaction patterns
- **Additional AI Tools**: Support for more AI development assistants
- **Advanced Features**: Syntax highlighting, prompt templates, workflow automation

## Summary
Wingman bridges the gap between AI-assisted development tools and project management by providing a dedicated environment for context and prompt management. It transforms ad-hoc AI interactions into a structured, repeatable workflow that enhances developer productivity while maintaining organization and continuity across development sessions.

The application demonstrates the value of purpose-built tools for AI-enhanced workflows, showing measurable impact in real development scenarios and hackathon competition success.