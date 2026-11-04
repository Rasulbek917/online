import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../l10n.dart';
import '../theme.dart';
import '../widgets/common.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  bool _sendingVerification = false;

  Future<void> _logout() async {
    final l = L(context.read<AppState>().lang);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.logoutConfirm),
        content: Text(l.logoutMessage),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(l.logout)),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await context.read<AppState>().logout();
    }
  }

  Future<void> _resendVerification() async {
    final state = context.read<AppState>();
    final l = L(state.lang);
    setState(() => _sendingVerification = true);
    try {
      await state.api.post('/api/auth/resend-verification/');
      if (mounted) showAppSnack(context, l.verifyEmailSent);
    } catch (error) {
      if (mounted) showAppSnack(context, errorText(error, l), error: true);
    } finally {
      if (mounted) setState(() => _sendingVerification = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l = L(state.lang);
    final theme = Theme.of(context);
    final user = state.user;
    if (user == null) return const SizedBox.shrink();
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        children: [
          Text(l.profile, style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: appGradient,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
                  child: AppAvatar(url: user.avatar, name: user.fullName, size: 62),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        user.email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white24,
                              borderRadius: BorderRadius.circular(7),
                            ),
                            child: Text(
                              l.roleLabel(user.role),
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.bolt_rounded, color: Colors.amberAccent, size: 16),
                          const SizedBox(width: 2),
                          Text(
                            '${user.points}',
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (!user.isEmailVerified)
            Container(
              margin: const EdgeInsets.only(top: 14),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.warning.withValues(alpha: 0.35)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.mark_email_unread_outlined, color: AppColors.warning, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.emailNotVerified, style: const TextStyle(fontSize: 12.5, height: 1.4)),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 36,
                          child: OutlinedButton(
                            onPressed: _sendingVerification ? null : _resendVerification,
                            child: _sendingVerification
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : Text(l.resendVerification, style: const TextStyle(fontSize: 12)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 22),
          SectionHeading(title: l.language),
          _SettingsCard(
            children: [
              _OptionRow(
                icon: Icons.language_rounded,
                label: l.language,
                value: state.lang == 'ru' ? 'Русский' : "O‘zbekcha",
              ),
              const SizedBox(height: 6),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'uz', label: Text('UZ')),
                    ButtonSegment(value: 'ru', label: Text('RU')),
                  ],
                  selected: {state.lang},
                  onSelectionChanged: (value) => state.setLanguage(value.first),
                  showSelectedIcon: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SectionHeading(title: l.theme),
          _SettingsCard(
            children: [
              _OptionRow(
                icon: Icons.dark_mode_outlined,
                label: l.theme,
                value: state.themeMode == ThemeMode.dark
                    ? l.dark
                    : state.themeMode == ThemeMode.light
                        ? l.light
                        : l.system,
              ),
              const SizedBox(height: 6),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<ThemeMode>(
                  segments: [
                    ButtonSegment(value: ThemeMode.dark, label: Text(l.dark)),
                    ButtonSegment(value: ThemeMode.light, label: Text(l.light)),
                    ButtonSegment(value: ThemeMode.system, label: Text(l.system)),
                  ],
                  selected: {state.themeMode},
                  onSelectionChanged: (value) => state.setThemeMode(value.first),
                  showSelectedIcon: false,
                  style: const ButtonStyle(
                    visualDensity: VisualDensity.compact,
                    textStyle: WidgetStatePropertyAll(TextStyle(fontSize: 11)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SectionHeading(title: l.about),
          _SettingsCard(
            children: [
              _OptionRow(
                icon: Icons.school_outlined,
                label: l.appName,
                value: 'v1.0.0',
              ),
              const Divider(height: 1),
              _OptionRow(
                icon: Icons.verified_user_outlined,
                label: l.account,
                value: user.isEmailVerified ? l.confirmed : l.notConfirmed,
              ),
            ],
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout_rounded, color: AppColors.danger),
            label: Text(l.logout, style: const TextStyle(color: AppColors.danger)),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              '© 2026 IT PARK Academy',
              style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.4)),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(children: children),
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.55)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
