import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../l10n.dart';
import 'catalog_tab.dart';
import 'learning_tab.dart';
import 'notifications_tab.dart';
import 'profile_tab.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AppState>().refreshUnread();
    });
  }

  void _select(int index) {
    setState(() => _index = index);
    if (index == 2) {
      context.read<AppState>().refreshUnread();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l = L(state.lang);
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          const CatalogTab(),
          LearningTab(onBrowse: () => _select(0)),
          const NotificationsTab(),
          const ProfileTab(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _select,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.explore_outlined),
            selectedIcon: const Icon(Icons.explore_rounded),
            label: l.catalog,
          ),
          NavigationDestination(
            icon: const Icon(Icons.menu_book_outlined),
            selectedIcon: const Icon(Icons.menu_book_rounded),
            label: l.myLearning,
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: state.unreadCount > 0,
              label: Text('${state.unreadCount}'),
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: state.unreadCount > 0,
              label: Text('${state.unreadCount}'),
              child: const Icon(Icons.notifications_rounded),
            ),
            label: l.notifications,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline_rounded),
            selectedIcon: const Icon(Icons.person_rounded),
            label: l.profile,
          ),
        ],
      ),
    );
  }
}
