import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:wingman/providers/app-providers.dart';
import 'package:wingman/utils/constants.dart';
import 'package:wingman/widgets/common_widgets.dart';
import 'package:wingman/screens/tabs/context-tab.dart';
import 'package:wingman/screens/tabs/prompts-tab.dart';

class MainInterfaceScreen extends ConsumerStatefulWidget {
  const MainInterfaceScreen({super.key});

  @override
  ConsumerState<MainInterfaceScreen> createState() => _MainInterfaceScreenState();
}

class _MainInterfaceScreenState extends ConsumerState<MainInterfaceScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_handleTabChange);
  }

  @override
  void dispose() {
    _tabController.removeListener(_handleTabChange);
    _tabController.dispose();
    super.dispose();
  }

  void _handleTabChange() {
    // Force a rebuild when tab changes
    if (_tabController.indexIsChanging) {
      setState(() {});
    }
  }

  void _goToNewChat() {
    ref.read(currentScreenProvider.notifier).state = AppScreen.newChat;
  }

  void _startNewSession() {
    // Reset to project setup
    ref.read(currentScreenProvider.notifier).state = AppScreen.projectSetup;
  }

  @override
  Widget build(BuildContext context) {
    final appName = ref.watch(appNameProvider);
    final activeChat = ref.watch(activeChatProvider);
    final chatName = activeChat?.name ?? 'Unnamed Chat';

    return Scaffold(
      appBar: AppBar(
        title: Text('$appName - $chatName'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _goToNewChat,
          tooltip: 'New Chat',
        ),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'new_chat') {
                _goToNewChat();
              } else if (value == 'new_session') {
                _startNewSession();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem<String>(
                value: 'new_chat',
                child: Row(
                  children: [
                    Icon(Icons.chat),
                    SizedBox(width: 8),
                    Text('New Chat'),
                  ],
                ),
              ),
              const PopupMenuItem<String>(
                value: 'new_session',
                child: Row(
                  children: [
                    Icon(Icons.refresh),
                    SizedBox(width: 8),
                    Text('New Session'),
                  ],
                ),
              ),
            ],
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(
              icon: Icon(Icons.description),
              text: 'Context',
            ),
            Tab(
              icon: Icon(Icons.chat),
              text: 'Prompts',
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Breadcrumb navigation
            Padding(
              padding: const EdgeInsets.all(AppConstants.smallPadding),
              child: BreadcrumbNav(
                items: ['Project Setup', 'Environment Setup', 'Chat', chatName],
                onTaps: [
                  () => ref.read(currentScreenProvider.notifier).state = AppScreen.projectSetup,
                  () => ref.read(currentScreenProvider.notifier).state = AppScreen.environmentConfig,
                  _goToNewChat,
                  null,
                ],
              ),
            ),

            // Tab content
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: const [
                  ContextTab(),
                  PromptsTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
