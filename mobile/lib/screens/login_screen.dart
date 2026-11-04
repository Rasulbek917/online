import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../l10n.dart';
import '../theme.dart';
import '../widgets/common.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _confirm = TextEditingController();

  bool _register = false;
  bool _obscure = true;
  bool _acceptTerms = false;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _firstName.dispose();
    _lastName.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l = L(context.read<AppState>().lang);
    if (!_formKey.currentState!.validate()) return;
    if (_register && !_acceptTerms) {
      showAppSnack(context, l.acceptTerms, error: true);
      return;
    }
    setState(() => _busy = true);
    final state = context.read<AppState>();
    try {
      if (_register) {
        await state.register(
          email: _email.text,
          password: _password.text,
          firstName: _firstName.text,
          lastName: _lastName.text,
          acceptTerms: _acceptTerms,
        );
        if (mounted) showAppSnack(context, l.verifyEmailSent);
      } else {
        await state.login(_email.text, _password.text);
      }
    } catch (error) {
      if (mounted) showAppSnack(context, errorText(error, l), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l = L(state.lang);
    final theme = Theme.of(context);
    return Scaffold(
      body: Stack(
        children: [
          Positioned(
            top: -120,
            right: -80,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [AppColors.violet.withValues(alpha: 0.28), Colors.transparent]),
              ),
            ),
          ),
          Positioned(
            bottom: -140,
            left: -100,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [AppColors.primary.withValues(alpha: 0.22), Colors.transparent]),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: Container(
                            width: 82,
                            height: 82,
                            decoration: const BoxDecoration(gradient: appGradient, shape: BoxShape.circle),
                            child: const Icon(Icons.school_rounded, color: Colors.white, size: 40),
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Center(
                          child: Text('IT PARK Academy', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
                        ),
                        const SizedBox(height: 6),
                        Center(
                          child: Text(
                            l.tagline,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                          ),
                        ),
                        const SizedBox(height: 28),
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.surface.withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: theme.dividerColor),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  _ModeButton(
                                    label: l.login,
                                    selected: !_register,
                                    onTap: () => setState(() => _register = false),
                                  ),
                                  const SizedBox(width: 8),
                                  _ModeButton(
                                    label: l.register,
                                    selected: _register,
                                    onTap: () => setState(() => _register = true),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),
                              if (_register) ...[
                                Row(
                                  children: [
                                    Expanded(
                                      child: TextFormField(
                                        controller: _firstName,
                                        textInputAction: TextInputAction.next,
                                        decoration: InputDecoration(labelText: l.firstName),
                                        validator: (value) =>
                                            (value ?? '').trim().isEmpty ? l.firstName : null,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: TextFormField(
                                        controller: _lastName,
                                        textInputAction: TextInputAction.next,
                                        decoration: InputDecoration(labelText: l.lastName),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 14),
                              ],
                              TextFormField(
                                controller: _email,
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                autofillHints: const [AutofillHints.email],
                                decoration: InputDecoration(
                                  labelText: l.email,
                                  prefixIcon: const Icon(Icons.alternate_email, size: 20),
                                ),
                                validator: (value) {
                                  final text = (value ?? '').trim();
                                  if (text.isEmpty) return l.email;
                                  final valid = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(text);
                                  return valid ? null : l.email;
                                },
                              ),
                              const SizedBox(height: 14),
                              TextFormField(
                                controller: _password,
                                obscureText: _obscure,
                                textInputAction: _register ? TextInputAction.next : TextInputAction.done,
                                autofillHints: [_register ? AutofillHints.newPassword : AutofillHints.password],
                                onFieldSubmitted: (_) {
                                  if (!_register) _submit();
                                },
                                decoration: InputDecoration(
                                  labelText: l.password,
                                  prefixIcon: const Icon(Icons.lock_outline, size: 20),
                                  suffixIcon: IconButton(
                                    onPressed: () => setState(() => _obscure = !_obscure),
                                    icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                                  ),
                                ),
                                validator: (value) {
                                  final text = value ?? '';
                                  if (text.isEmpty) return l.password;
                                  if (_register && text.length < 8) return l.password;
                                  return null;
                                },
                              ),
                              if (_register) ...[
                                const SizedBox(height: 14),
                                TextFormField(
                                  controller: _confirm,
                                  obscureText: _obscure,
                                  decoration: InputDecoration(
                                    labelText: l.confirmPassword,
                                    prefixIcon: const Icon(Icons.lock_reset_outlined, size: 20),
                                  ),
                                  validator: (value) =>
                                      value != _password.text ? l.confirmPassword : null,
                                ),
                                const SizedBox(height: 6),
                                CheckboxListTile(
                                  value: _acceptTerms,
                                  onChanged: (value) => setState(() => _acceptTerms = value ?? false),
                                  title: Text(l.acceptTerms, style: const TextStyle(fontSize: 13)),
                                  controlAffinity: ListTileControlAffinity.leading,
                                  contentPadding: EdgeInsets.zero,
                                  dense: true,
                                ),
                              ],
                              const SizedBox(height: 20),
                              FilledButton(
                                onPressed: _busy ? null : _submit,
                                child: _busy
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                                      )
                                    : Text(_register ? l.createAccount : l.signIn),
                              ),
                              const SizedBox(height: 12),
                              Center(
                                child: Text(
                                  _register ? l.haveAccount : l.noAccount,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: theme.colorScheme.onSurface.withValues(alpha: 0.65),
                                  ),
                                ),
                              ),
                              TextButton(
                                onPressed: _busy ? null : () => setState(() => _register = !_register),
                                child: Text(_register ? l.login : l.register),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 22),
                        Center(
                          child: Text(
                            '© 2026 IT PARK Academy',
                            style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.4)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  const _ModeButton({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 11),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: selected ? appGradient : null,
            color: selected ? null : theme.colorScheme.onSurface.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : theme.colorScheme.onSurface.withValues(alpha: 0.7),
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}
