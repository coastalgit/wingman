# Wingman - Basic Starter Test App

This is a basic test application to verify that your Flutter Windows desktop environment is set up correctly. It tests key functionality that will be needed for the full Wingman application.

## Setup Instructions

### 1. Prerequisites

Make sure you have the following installed:

- Flutter SDK (latest stable version)
- Windows 10 or higher
- Visual Studio 2019 or higher (with Desktop development with C++ workload)
- Git

### 2. Verify Flutter Setup for Windows

Run these commands to verify your setup:

```bash
flutter doctor
```

Ensure that the Windows desktop development is enabled:

```bash
flutter config --enable-windows-desktop
```

### 3. Create Project and Add Files

1. Create a new Flutter project:

```bash
flutter create --platforms=windows wingman
```

2. Replace the default `lib/main.dart` with the `main.dart` file provided.

3. Replace the default `pubspec.yaml` with the `pubspec.yaml` file provided.

4. Create the `.cursor` directory in the project root and add the Cursor project context file:

```bash
mkdir .cursor
# Add the cursor project file to this directory
```

### 4. Get Dependencies

Run:

```bash
flutter pub get
```

### 5. Run the App

```bash
flutter run -d windows
```

## What This Test App Verifies

1. **Windows Desktop Compilation**: Confirms Flutter can build and run Windows applications
2. **Riverpod State Management**: Tests basic Riverpod provider functionality
3. **File System Operations**: Tests reading and writing files to the local system
4. **Directory Selection**: Tests the file picker for directory selection
5. **UI Rendering**: Verifies the basic Material UI elements work correctly

## Next Steps

Once you've confirmed this test app runs correctly on your system, we can proceed with building the full Wingman application with all the specified features.