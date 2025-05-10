# Claude Code Assistant Feature - Implementation Guide for Copilot

Create a Claude Code Assistant feature with the following specifications:

## UI Component

Create a modal dialog accessible from the New Chat screen that shows step-by-step instructions for using Claude Code in WSL.

## Dialog Content

````markdown
# Claude Code Quick Start

Ready to start coding with Claude Code for your project: **[PROJECT_NAME]**

## Step 1: Open WSL Terminal

Open your Windows Terminal and start a WSL session

## Step 2: Navigate to Project

```bash
cd [WSL_CONVERTED_PATH]
```
````

## Step 3: Define Command Aliases

```bash
alias ccc="cat docs/cc_context.md"
alias ccp="cat docs/cc_prompt.md"
```

**Commands explained:**

- These alias definitions tell the terminal what the commands `ccc` and `ccp` mean
- The aliases only persist for your current terminal session
- Claude will remember your context throughout the session after using `ccc`

## Step 4: Start Claude Code

```bash
claude-code
```

## Step 5: Use Your Context File

```bash
ccc
```

**Commands explained:**

- `ccc` reads your context file (cc_context.md) and sends it to Claude
- This gives Claude the background information about your project

## Step 6: Send Your Prompt

```bash
ccp
```

**Commands explained:**

- `ccp` reads your prompt file (cc_prompt.md) and sends it to Claude
- Each time you update your prompt in Wingman, use this command to send it

## Workflow Tips

- Use "ccc" once at the beginning of your session
- Use "ccp" each time you want to send a new prompt
- Wingman automatically updates the context and prompt files
- You can modify these files directly in the Wingman interface
- Type "exit" to end your Claude Code session

```

## Implementation Requirements
1. Add a "Claude Code Assistant" button to the New Chat screen (preferably in the top-right action area)
2. Create a modal dialog that displays when this button is clicked
3. Implement path conversion from Windows to WSL format (C:\path → /mnt/c/path)
4. Add copy buttons next to each code block that copy the command to clipboard
5. Replace [PROJECT_NAME] with the current app name from state
6. Replace [WSL_CONVERTED_PATH] with the converted project directory path
7. Style code blocks with monospace font and distinguishable background
8. Implement copy functionality that shows visual feedback when clicked
9. Make dialog scrollable if content exceeds screen height
10. Add a close/dismiss button at the bottom of the dialog

## Technical Details
1. Use the app_providers.configProvider to access project directory and app name
2. Implement a utility function that converts Windows paths to WSL format
3. Create a modal dialog using showDialog or showModalBottomSheet
4. Use SelectableText or similar widget to enable text selection
5. Implement clipboard functionality with Clipboard.setData
6. Style with card elevation, padding, and clear section headers
7. Make the dialog responsive to different window sizes

## Placement
Add the "Claude Code Assistant" button on the New Chat screen near the "Create Chat" button, or as an action in the app bar.
```
