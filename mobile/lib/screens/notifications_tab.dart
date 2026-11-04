import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../l10n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/common.dart';

class NotificationsTab extends StatefulWidget {
  const NotificationsTab({super.key});

  @override
  State<NotificationsTab> createState() => _NotificationsTabState();
}

class _NotificationsTabState extends State<NotificationsTab> {
  List<NotificationItem> _items = const [];
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    setState(() {
      _loading = _items.isEmpty;
      _error = null;
    });
    try {
      final items = await state.api.notifications();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
      state.refreshUnread();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _open(NotificationItem item) async {
    final state = context.read<AppState>();
    if (!item.isRead) {
      try {
        await state.markNotificationRead(item.id);
        if (!mounted) return;
        setState(() {
          _items = _items
              .map((entry) => entry.id == item.id
                  ? NotificationItem(
                      id: entry.id,
                      type: entry.type,
                      title: entry.title,
                      message: entry.message,
                      isRead: true,
                      createdAt: entry.createdAt,
                    )
                  : entry)
              .toList();
        });
      } catch (error) {
        if (mounted) showAppSnack(context, errorText(error, L(state.lang)), error: true);
      }
    }
    if (!mounted) return;
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item.title),
        content: Text(item.message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(L(state.lang).close),
          ),
        ],
      ),
    );
  }

  Future<void> _readAll() async {
    final state = context.read<AppState>();
    try {
      await state.markAllNotificationsRead();
      if (!mounted) return;
      setState(() {
        _items = _items
            .map((entry) => NotificationItem(
                  id: entry.id,
                  type: entry.type,
                  title: entry.title,
                  message: entry.message,
                  isRead: true,
                  createdAt: entry.createdAt,
                ))
            .toList();
      });
    } catch (error) {
      if (mounted) showAppSnack(context, errorText(error, L(state.lang)), error: true);
    }
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'payment':
        return Icons.payments_outlined;
      case 'certificate':
        return Icons.workspace_premium_outlined;
      case 'quiz':
      case 'quiz_result':
        return Icons.quiz_outlined;
      case 'enrollment':
        return Icons.menu_book_outlined;
      case 'subscription':
        return Icons.card_membership_outlined;
      case 'comment':
        return Icons.forum_outlined;
      default:
        return Icons.notifications_none_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l = L(state.lang);
    final theme = Theme.of(context);
    final hasUnread = _items.any((item) => !item.isRead);
    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(l.notifications, style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
                ),
                if (hasUnread)
                  TextButton(
                    onPressed: _readAll,
                    child: Text(l.markAllRead, style: const TextStyle(fontSize: 12)),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const LoadingView()
                  : _error != null
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(
                              height: 420,
                              child: ErrorView(
                                message: errorText(_error!, l),
                                retryLabel: l.retry,
                                onRetry: _load,
                              ),
                            ),
                          ],
                        )
                      : _items.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                SizedBox(
                                  height: 420,
                                  child: EmptyState(
                                    icon: Icons.notifications_off_outlined,
                                    title: l.noNotifications,
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                              itemCount: _items.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                final item = _items[index];
                                return InkWell(
                                  onTap: () => _open(item),
                                  borderRadius: BorderRadius.circular(16),
                                  child: Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: item.isRead
                                          ? theme.colorScheme.surface
                                          : AppColors.primary.withValues(alpha: 0.09),
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: item.isRead
                                            ? theme.dividerColor
                                            : AppColors.primary.withValues(alpha: 0.35),
                                      ),
                                    ),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          width: 42,
                                          height: 42,
                                          decoration: BoxDecoration(
                                            color: AppColors.primary.withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Icon(_iconFor(item.type), color: AppColors.primary, size: 21),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(
                                                      item.title,
                                                      style: TextStyle(
                                                        fontWeight: item.isRead ? FontWeight.w600 : FontWeight.w800,
                                                        fontSize: 14,
                                                      ),
                                                    ),
                                                  ),
                                                  if (!item.isRead)
                                                    Container(
                                                      width: 8,
                                                      height: 8,
                                                      decoration: const BoxDecoration(
                                                        color: AppColors.primary,
                                                        shape: BoxShape.circle,
                                                      ),
                                                    ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                item.message,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  height: 1.35,
                                                  color: theme.colorScheme.onSurface.withValues(alpha: 0.65),
                                                ),
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                formatDate(item.createdAt, l),
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  color: theme.colorScheme.onSurface.withValues(alpha: 0.45),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }
}
