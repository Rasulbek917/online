import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../l10n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/common.dart';

class QuizScreen extends StatefulWidget {
  const QuizScreen({super.key, required this.quizId, this.quizTitle = ''});

  final int quizId;
  final String quizTitle;

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  QuizSession? _session;
  QuizResult? _result;
  bool _loading = true;
  bool _submitting = false;
  Object? _error;
  final Map<int, Set<int>> _selected = {};
  final Map<int, TextEditingController> _textControllers = {};

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    for (final controller in _textControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _start() async {
    final state = context.read<AppState>();
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
      _selected.clear();
    });
    try {
      final session = await state.api.startQuiz(widget.quizId);
      if (!mounted) return;
      for (final question in session.questions) {
        if (question.isText) {
          _textControllers.putIfAbsent(question.id, () => TextEditingController());
        }
      }
      setState(() {
        _session = session;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  bool _isAnswered(QuizQuestion question) {
    if (question.isText) {
      return (_textControllers[question.id]?.text ?? '').trim().isNotEmpty;
    }
    return (_selected[question.id] ?? const <int>{}).isNotEmpty;
  }

  Future<void> _submit() async {
    final session = _session;
    if (session == null) return;
    final l = L(context.read<AppState>().lang);
    final unanswered = session.questions.where((question) => !_isAnswered(question)).length;
    if (unanswered > 0) {
      showAppSnack(context, l.answerAll, error: true);
      return;
    }
    setState(() => _submitting = true);
    final answers = session.questions.map((question) {
      if (question.isText) {
        return {
          'question_id': question.id,
          'selected_options': <int>[],
          'text_answer': _textControllers[question.id]?.text.trim() ?? '',
        };
      }
      return {
        'question_id': question.id,
        'selected_options': (_selected[question.id] ?? const <int>{}).toList(),
        'text_answer': '',
      };
    }).toList();
    try {
      final result = await context.read<AppState>().api.submitQuiz(session.attemptId, answers);
      if (!mounted) return;
      setState(() {
        _result = result;
        _submitting = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      showAppSnack(context, errorText(error, L(context.read<AppState>().lang)), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l = L(state.lang);
    final session = _session;
    if (_loading) {
      return Scaffold(appBar: AppBar(title: Text(widget.quizTitle)), body: const LoadingView());
    }
    if (_error != null || session == null) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.quizTitle)),
        body: ErrorView(
          message: _error == null ? l.loadError : errorText(_error!, l),
          retryLabel: l.retry,
          onRetry: _start,
        ),
      );
    }
    if (_result != null) return _resultView(_result!, l);
    final answered = session.questions.where(_isAnswered).length;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.quizTitle.isEmpty ? l.test : widget.quizTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
            child: Column(
              children: [
                Row(
                  children: [
                    Text(
                      '${answered}/${session.questions.length}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                    const Spacer(),
                    Text(
                      '${l.score}: ${session.passingScore}/${session.questions.length}',
                      style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: session.questions.isEmpty ? 0 : answered / session.questions.length,
                    minHeight: 7,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
              itemCount: session.questions.length,
              separatorBuilder: (_, __) => const SizedBox(height: 14),
              itemBuilder: (context, index) {
                final question = session.questions[index];
                return _QuestionCard(
                  index: index,
                  question: question,
                  l: l,
                  selected: _selected[question.id] ?? <int>{},
                  textController: _textControllers[question.id],
                  onOptionTap: (optionId) {
                    setState(() {
                      final current = _selected.putIfAbsent(question.id, () => <int>{});
                      if (question.isMultiple) {
                        if (current.contains(optionId)) {
                          current.remove(optionId);
                        } else {
                          current.add(optionId);
                        }
                      } else {
                        current
                          ..clear()
                          ..add(optionId);
                      }
                    });
                  },
                  onTextChanged: () => setState(() {}),
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                    : Text(l.submit),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _resultView(QuizResult result, L l) {
    final theme = Theme.of(context);
    final passed = result.passed;
    final color = passed ? AppColors.success : AppColors.danger;
    return Scaffold(
      appBar: AppBar(title: Text(l.testResult), automaticallyImplyLeading: false),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 16),
          Container(
            width: 104,
            height: 104,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
              border: Border.all(color: color.withValues(alpha: 0.4), width: 2),
            ),
            child: Icon(
              passed ? Icons.emoji_events_rounded : Icons.replay_rounded,
              size: 54,
              color: color,
            ),
          ),
          const SizedBox(height: 22),
          Text(
            passed ? l.passed : l.notPassed,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: color),
          ),
          const SizedBox(height: 8),
          Text(
            passed ? l.passedMessage : result.restartRequired ? l.restartRequired : l.failedMessage,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, height: 1.5, color: theme.colorScheme.onSurface.withValues(alpha: 0.7)),
          ),
          const SizedBox(height: 26),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: theme.dividerColor),
            ),
            child: Column(
              children: [
                Text(
                  l.outOf(result.correctCount, result.totalQuestions),
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _ResultStat(
                        label: l.correct,
                        value: '${result.correctCount}',
                        color: AppColors.success,
                        icon: Icons.check_circle_outline,
                      ),
                    ),
                    Container(width: 1, height: 44, color: theme.dividerColor),
                    Expanded(
                      child: _ResultStat(
                        label: l.wrong,
                        value: '${result.wrongCount}',
                        color: AppColors.danger,
                        icon: Icons.cancel_outlined,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 26),
          FilledButton(
            onPressed: () => Navigator.pop(context, result),
            child: Text(passed ? l.continueLearning : l.backToLesson),
          ),
          if (!passed) ...[
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _start,
              child: Text(l.retake),
            ),
          ],
        ],
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.index,
    required this.question,
    required this.l,
    required this.selected,
    required this.onOptionTap,
    required this.onTextChanged,
    this.textController,
  });

  final int index;
  final QuizQuestion question;
  final L l;
  final Set<int> selected;
  final ValueChanged<int> onOptionTap;
  final VoidCallback onTextChanged;
  final TextEditingController? textController;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: appGradient,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(
                  '${index + 1}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  question.text,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.4),
                ),
              ),
            ],
          ),
          if (question.image != null) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: _buildImage(question.image!),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              BadgePill(
                label: question.isMultiple
                    ? l.pick('Bir nechta javob', 'Несколько ответов')
                    : question.isText
                        ? l.pick('Yozma javob', 'Письменный ответ')
                        : l.pick('Bitta javob', 'Один ответ'),
                color: AppColors.violet,
              ),
              const SizedBox(width: 8),
              Text(
                '${question.points} ${l.points.toLowerCase()}',
                style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (question.isText)
            TextField(
              controller: textController,
              maxLines: 3,
              onChanged: (_) => onTextChanged(),
              decoration: InputDecoration(hintText: l.pick('Javobingizni yozing', 'Напишите ответ')),
            )
          else
            ...question.options.map((option) {
              final isSelected = selected.contains(option.id);
              return GestureDetector(
                onTap: () => onOptionTap(option.id),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? AppColors.primary : theme.dividerColor,
                      width: isSelected ? 1.4 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        question.isMultiple
                            ? isSelected
                                ? Icons.check_box_rounded
                                : Icons.check_box_outline_blank_rounded
                            : isSelected
                                ? Icons.radio_button_checked_rounded
                                : Icons.radio_button_off_rounded,
                        size: 20,
                        color: isSelected
                            ? AppColors.primary
                            : theme.colorScheme.onSurface.withValues(alpha: 0.4),
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Text(option.text, style: const TextStyle(fontSize: 13.5))),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildImage(String image) {
    if (image.startsWith('data:image')) {
      try {
        final base64Part = image.split(',').last;
        return Image.memory(
          base64Decode(base64Part),
          fit: BoxFit.contain,
          height: 180,
          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
        );
      } catch (_) {
        return const SizedBox.shrink();
      }
    }
    return Image.network(
      image,
      fit: BoxFit.contain,
      height: 180,
      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
    );
  }
}

class _ResultStat extends StatelessWidget {
  const _ResultStat({required this.label, required this.value, required this.color, required this.icon});

  final String label;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}
