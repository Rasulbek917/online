import 'package:flutter/material.dart';

import 'api.dart';
import 'models.dart';

enum AuthStatus { loading, authenticated, guest }

class AppState extends ChangeNotifier {
  AppState(this.api) {
    api.onSessionExpired = _handleExpiredSession;
  }

  final ApiClient api;

  AuthStatus status = AuthStatus.loading;
  AppUser? user;
  String lang = 'uz';
  ThemeMode themeMode = ThemeMode.dark;
  int unreadCount = 0;
  String? lastError;

  bool get isAuthenticated => status == AuthStatus.authenticated && user != null;

  Future<void> init() async {
    await api.loadLocalPreferences();
    lang = api.lang;
    final storedTheme = await api.readTheme();
    themeMode = _themeFromString(storedTheme);
    if (api.hasStoredSession) {
      final restored = await api.restoreSession();
      if (restored) {
        try {
          user = await api.me();
          status = AuthStatus.authenticated;
          _refreshUnreadSilently();
          notifyListeners();
          return;
        } catch (_) {
          await api.clearSession();
        }
      }
    }
    status = AuthStatus.guest;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final data = await api.login(email, password);
    final rawUser = data['user'];
    if (rawUser is Map) {
      user = AppUser.fromJson(Map<String, dynamic>.from(rawUser));
    } else {
      user = await api.me();
    }
    status = AuthStatus.authenticated;
    lastError = null;
    notifyListeners();
    _refreshUnreadSilently();
  }

  Future<void> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required bool acceptTerms,
  }) async {
    final data = await api.register(
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
      acceptTerms: acceptTerms,
    );
    final rawUser = data['user'];
    if (rawUser is Map) {
      user = AppUser.fromJson(Map<String, dynamic>.from(rawUser));
    } else {
      user = await api.me();
    }
    status = AuthStatus.authenticated;
    lastError = null;
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    user = null;
    unreadCount = 0;
    status = AuthStatus.guest;
    notifyListeners();
  }

  Future<void> refreshUser() async {
    if (!isAuthenticated) return;
    try {
      user = await api.me();
      notifyListeners();
    } catch (_) {
      // Keep the current profile when the network is unavailable.
    }
  }

  Future<void> setLanguage(String value) async {
    if (value == lang) return;
    lang = value;
    await api.setLanguage(value);
    notifyListeners();
    if (isAuthenticated) {
      try {
        await api.patch('/api/auth/me/', body: {'language': value});
      } catch (_) {
        // Local preference still applies; sync retries on next change.
      }
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    themeMode = mode;
    final value = _themeToString(mode);
    await api.writeTheme(value);
    notifyListeners();
    if (isAuthenticated) {
      try {
        await api.patch('/api/auth/me/', body: {'theme': value});
      } catch (_) {
        // Local preference still applies.
      }
    }
  }

  Future<void> refreshUnread() async {
    if (!isAuthenticated) return;
    try {
      unreadCount = await api.unreadCount();
      notifyListeners();
    } catch (_) {
      // Badge failures are non-fatal.
    }
  }

  Future<void> markNotificationRead(int id) async {
    await api.markNotificationRead(id);
    if (unreadCount > 0) unreadCount -= 1;
    notifyListeners();
  }

  Future<void> markAllNotificationsRead() async {
    await api.markAllNotificationsRead();
    unreadCount = 0;
    notifyListeners();
  }

  void _handleExpiredSession() {
    user = null;
    unreadCount = 0;
    status = AuthStatus.guest;
    lastError = lang == 'ru' ? 'Сессия истекла. Войдите снова.' : 'Sessiya tugadi. Qayta kiring.';
    notifyListeners();
  }

  void _refreshUnreadSilently() {
    refreshUnread();
  }

  ThemeMode _themeFromString(String value) {
    switch (value) {
      case 'light':
        return ThemeMode.light;
      case 'system':
        return ThemeMode.system;
      default:
        return ThemeMode.dark;
    }
  }

  String _themeToString(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return 'light';
      case ThemeMode.system:
        return 'system';
      case ThemeMode.dark:
        return 'dark';
    }
  }
}
