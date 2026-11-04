import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../app_state.dart';
import '../l10n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'lesson_screen.dart';

class CourseDetailScreen extends StatefulWidget {
  const CourseDetailScreen({super.key, required this.slug});

  final String slug;

  @override
  State<CourseDetailScreen> createState() => _CourseDetailScreenState();
}

class _CourseDetailScreenState extends State<CourseDetailScreen> {
  Course? _course;
  bool _loading = true;
  bool _busy = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    setState(() {
      _loading = _course == null;
      _error = null;
    });
    try {
      final course = await state.api.courseDetail(widget.slug);
      if (!mounted) return;
      setState(() {
        _course = course;
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

  Future<void> _openLesson(int lessonId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LessonScreen(lessonId: lessonId, courseSlug: widget.slug),
      ),
    );
    _load();
  }

  Future<void> _startLearning() async {
    final course = _course;
    if (course == null) return;
    final state = context.read<AppState>();
    final l = L(state.lang);
    if (!course.hasAccess && !course.isFree) {
      await _openCheckout();
      return;
    }
    setState(() => _busy = true);
    try {
      if (!course.isEnrolled) {
        await state.api.enroll(course.slug);
      }
      final lessonId = await state.api.learn(course.slug);
      if (!mounted) return;
      await _openLesson(lessonId);
    } catch (error) {
      if (mounted) showAppSnack(context, errorText(error, l), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openCheckout() async {
    final course = _course;
    if (course == null) return;
    final state = context.read<AppState>();
    final l = L(state.lang);
    final paid = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _CheckoutSheet(course: course, api: state.api, l: l),
    );
    if (!mounted) return;
    if (paid == true) {
      showAppSnack(context, l.paymentSuccess);
      await _load();
      if (mounted && (_course?.hasAccess ?? false)) {
        await _startLearning();
      }
    } else if (paid == false) {
      showAppSnack(context, l.paymentPending);
      await _load();
    }
  }

  void _handleLessonTap(LessonSummary lesson) {
    final l = L(context.read<AppState>().lang);
    if (lesson.isLocked) {
      showAppSnack(context, l.accessRequired, error: true);
      return;
    }
    _openLesson(lesson.id);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l = L(state.lang);
    final theme = Theme.of(context);
    final course = _course;
    if (_loading) {
      return Scaffold(appBar: AppBar(), body: const LoadingView());
    }
    if (course == null || _error != null) {
      return Scaffold(
        appBar: AppBar(),
        body: ErrorView(
          message: _error == null ? l.loadError : errorText(_error!, l),
          retryLabel: l.retry,
          onRetry: _load,
        ),
      );
    }
    final hasAccess = course.hasAccess || course.isFree || course.isEnrolled;
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            stretch: true,
            leading: Padding(
              padding: const EdgeInsets.all(8),
              child: CircleAvatar(
                backgroundColor: Colors.black45,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  if (course.thumbnail != null)
                    Image.network(course.thumbnail!, fit: BoxFit.cover)
                  else
                    const DecoratedBox(decoration: BoxDecoration(gradient: appGradient)),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Color(0xE6050913)],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 18,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (course.category != null)
                          BadgePill(label: course.category!.name, color: AppColors.violet),
                        const SizedBox(height: 8),
                        Text(
                          course.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          course.teacher?.fullName ?? 'IT PARK Academy',
                          style: const TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                Row(
                  children: [
                    _MetaItem(icon: Icons.star_rounded, value: course.ratingAvg.toStringAsFixed(1), color: AppColors.warning),
                    _MetaItem(icon: Icons.people_outline, value: formatNumber(course.studentsCount)),
                    _MetaItem(icon: Icons.play_lesson_outlined, value: '${course.lessonsCount}'),
                    _MetaItem(icon: Icons.schedule, value: '${course.durationMinutes} ${l.minutes}'),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    BadgePill(label: l.levelLabel(course.level)),
                    BadgePill(label: l.courseLanguage(course.language), color: AppColors.violet),
                    if (course.discountPercent > 0)
                      BadgePill(label: '-${course.discountPercent}%', color: AppColors.success),
                    if (course.isFree) BadgePill(label: l.free, color: AppColors.success),
                  ],
                ),
                if (course.isEnrolled) ...[
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Text(l.progress, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                      const Spacer(),
                      Text('${course.progressPercent}%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: (course.progressPercent / 100).clamp(0, 1),
                      minHeight: 8,
                    ),
                  ),
                ],
                if (course.description.isNotEmpty) ...[
                  const SizedBox(height: 22),
                  SectionHeading(title: l.aboutCourse),
                  Text(
                    course.description,
                    style: TextStyle(fontSize: 14, height: 1.55, color: theme.colorScheme.onSurface.withValues(alpha: 0.8)),
                  ),
                ],
                if (!course.isFree) ...[
                  const SizedBox(height: 22),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: theme.dividerColor),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                formatMoney(course.effectiveMonthlyPrice, l),
                                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.primary),
                              ),
                              Text(
                                l.billingMonthly,
                                style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                              ),
                            ],
                          ),
                        ),
                        if (course.discountPercent > 0)
                          Text(
                            formatMoney(course.price, l),
                            style: TextStyle(
                              fontSize: 13,
                              decoration: TextDecoration.lineThrough,
                              color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 22),
                SectionHeading(
                  title: l.courseProgram,
                  trailing: Text(
                    '${course.sections.length} · ${course.lessonsCount} ${l.lessons}',
                    style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.55)),
                  ),
                ),
                if (course.sections.isEmpty)
                  EmptyState(icon: Icons.playlist_remove_rounded, title: l.noCourses)
                else
                  ...course.sections.map(
                    (section) => Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: theme.dividerColor),
                      ),
                      child: Theme(
                        data: theme.copyWith(dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          initiallyExpanded: true,
                          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
                          childrenPadding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
                          title: Text(section.title, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
                          subtitle: Text(
                            '${section.lessons.length} ${l.lessons}',
                            style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.55)),
                          ),
                          children: section.lessons
                              .map((lesson) => _LessonTile(
                                    lesson: lesson,
                                    l: l,
                                    onTap: () => _handleLessonTap(lesson),
                                  ))
                              .toList(),
                        ),
                      ),
                    ),
                  ),
              ]),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            border: Border(top: BorderSide(color: theme.dividerColor)),
          ),
          child: FilledButton(
            onPressed: _busy ? null : (hasAccess ? _startLearning : _openCheckout),
            child: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                : Text(
                    course.isEnrolled || course.hasAccess
                        ? l.continueLearning
                        : course.isFree
                            ? l.enroll
                            : l.subscribe,
                  ),
          ),
        ),
      ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.icon, required this.value, this.color});

  final IconData icon;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 17, color: color ?? AppColors.primary),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _LessonTile extends StatelessWidget {
  const _LessonTile({required this.lesson, required this.l, required this.onTap});

  final LessonSummary lesson;
  final L l;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: lesson.isLocked
                    ? theme.colorScheme.onSurface.withValues(alpha: 0.06)
                    : AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                lesson.isLocked
                    ? Icons.lock_outline
                    : lesson.isCompleted
                        ? Icons.check_rounded
                        : Icons.play_arrow_rounded,
                size: 19,
                color: lesson.isLocked
                    ? theme.colorScheme.onSurface.withValues(alpha: 0.4)
                    : lesson.isCompleted
                        ? AppColors.success
                        : AppColors.primary,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lesson.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: lesson.isLocked ? theme.colorScheme.onSurface.withValues(alpha: 0.5) : null,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      if (lesson.durationSeconds > 0)
                        Text(
                          formatDuration(lesson.durationSeconds, l),
                          style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                        ),
                      if (lesson.isFreePreview) ...[
                        const SizedBox(width: 8),
                        BadgePill(label: l.freePreview, color: AppColors.success),
                      ],
                      if (lesson.quiz != null) ...[
                        const SizedBox(width: 8),
                        Icon(Icons.quiz_outlined, size: 13, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                        const SizedBox(width: 2),
                        Text(
                          lesson.quiz!.passed ? l.passed : l.test,
                          style: TextStyle(
                            fontSize: 11,
                            color: lesson.quiz!.passed ? AppColors.success : theme.colorScheme.onSurface.withValues(alpha: 0.5),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CheckoutSheet extends StatefulWidget {
  const _CheckoutSheet({required this.course, required this.api, required this.l});

  final Course course;
  final ApiClient api;
  final L l;

  @override
  State<_CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<_CheckoutSheet> {
  List<PaymentProvider> _providers = const [];
  String? _provider;
  String _billing = 'monthly';
  bool _loading = true;
  bool _busy = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _loadProviders();
  }

  Future<void> _loadProviders() async {
    try {
      final providers = await widget.api.paymentProviders();
      if (!mounted) return;
      final enabled = providers.where((provider) => provider.enabled).toList();
      setState(() {
        _providers = enabled;
        _provider = enabled.isEmpty ? null : enabled.first.id;
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

  Future<void> _pay() async {
    final provider = _provider;
    if (provider == null) return;
    final l = widget.l;
    setState(() => _busy = true);
    try {
      final checkout = await widget.api.checkout(
        courseSlug: widget.course.slug,
        provider: provider,
        billingPeriod: _billing,
      );
      if (!mounted) return;
      if (provider == 'sandbox') {
        await widget.api.sandboxConfirm(checkout.paymentId);
        if (!mounted) return;
        Navigator.pop(context, true);
        return;
      }
      final url = checkout.checkoutUrl;
      if (url.isEmpty) {
        throw ApiException(500, l.paymentPending);
      }
      final launched = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!mounted) return;
      if (!launched) {
        showAppSnack(context, l.paymentPending, error: true);
      }
      Navigator.pop(context, false);
    } catch (error) {
      if (mounted) showAppSnack(context, errorText(error, l), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l = widget.l;
    final monthly = widget.course.effectiveMonthlyPrice;
    final full = widget.course.price;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(l.payment, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            widget.course.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _BillingOption(
                  label: l.billingMonthly,
                  price: monthly,
                  selected: _billing == 'monthly',
                  l: l,
                  onTap: () => setState(() => _billing = 'monthly'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _BillingOption(
                  label: l.billingFull,
                  price: full,
                  selected: _billing == 'full',
                  l: l,
                  onTap: () => setState(() => _billing = 'full'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(l.selectProvider, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          if (_loading)
            const Padding(padding: EdgeInsets.all(16), child: LoadingView())
          else if (_error != null)
            ErrorView(message: errorText(_error!, l), retryLabel: l.retry, onRetry: _loadProviders)
          else if (_providers.isEmpty)
            Text(l.paymentPending, style: TextStyle(color: theme.colorScheme.onSurface.withValues(alpha: 0.6)))
          else
            ..._providers.map(
              (provider) => RadioListTile<String>(
                value: provider.id,
                groupValue: _provider,
                onChanged: (value) => setState(() => _provider = value),
                contentPadding: EdgeInsets.zero,
                title: Text(provider.label),
                subtitle: provider.id == 'sandbox'
                    ? Text('Sandbox', style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)))
                    : null,
              ),
            ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy || _provider == null ? null : _pay,
            child: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                : Text(l.pay),
          ),
        ],
      ),
    );
  }
}

class _BillingOption extends StatelessWidget {
  const _BillingOption({
    required this.label,
    required this.price,
    required this.selected,
    required this.l,
    required this.onTap,
  });

  final String label;
  final double price;
  final bool selected;
  final L l;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withValues(alpha: 0.1) : theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.primary : theme.dividerColor,
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(
              formatMoney(price, l),
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: selected ? AppColors.primary : theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
