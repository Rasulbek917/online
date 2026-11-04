import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../l10n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'course_detail_screen.dart';
import 'lesson_screen.dart';

class LearningTab extends StatefulWidget {
  const LearningTab({super.key, this.onBrowse});

  final VoidCallback? onBrowse;

  @override
  State<LearningTab> createState() => _LearningTabState();
}

class _LearningTabState extends State<LearningTab> {
  DashboardData? _dashboard;
  List<EnrollmentItem> _enrollments = const [];
  bool _loading = true;
  Object? _error;
  int? _busyCourse;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    setState(() {
      _loading = _dashboard == null;
      _error = null;
    });
    try {
      final results = await Future.wait([
        state.api.dashboard(),
        state.api.enrollments(),
      ]);
      if (!mounted) return;
      setState(() {
        _dashboard = results[0] as DashboardData;
        _enrollments = results[1] as List<EnrollmentItem>;
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

  Future<void> _continue(EnrollmentItem item) async {
    final slug = item.course?.slug;
    if (slug == null || slug.isEmpty) return;
    setState(() => _busyCourse = item.id);
    final state = context.read<AppState>();
    final l = L(state.lang);
    try {
      final lessonId = await state.api.learn(slug);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => LessonScreen(lessonId: lessonId, courseSlug: slug),
        ),
      );
      _load();
    } catch (error) {
      if (mounted) showAppSnack(context, errorText(error, l), error: true);
    } finally {
      if (mounted) setState(() => _busyCourse = null);
    }
  }

  Future<void> _openCourse(EnrollmentItem item) async {
    final slug = item.course?.slug;
    if (slug == null || slug.isEmpty) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => CourseDetailScreen(slug: slug)));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l = L(state.lang);
    final theme = Theme.of(context);
    final summary = _dashboard?.summary;
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const LoadingView()
            : _error != null && _dashboard == null
                ? ErrorView(message: errorText(_error!, l), retryLabel: l.retry, onRetry: _load)
                : ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                    children: [
                      Text(l.myLearning, style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 16),
                      if (summary != null)
                        GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 2,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 1.62,
                          children: [
                            StatTile(
                              icon: Icons.menu_book_rounded,
                              label: l.enrolledCourses,
                              value: '${summary.enrolledCourses}',
                            ),
                            StatTile(
                              icon: Icons.timelapse_rounded,
                              label: l.inProgress,
                              value: '${summary.inProgressCourses}',
                              color: AppColors.warning,
                            ),
                            StatTile(
                              icon: Icons.workspace_premium_rounded,
                              label: l.certificates,
                              value: '${summary.certificates}',
                              color: AppColors.violet,
                            ),
                            StatTile(
                              icon: Icons.leaderboard_rounded,
                              label: l.rank,
                              value: summary.rank > 0 ? '#${summary.rank}' : '—',
                              color: AppColors.success,
                            ),
                          ],
                        ),
                      const SizedBox(height: 22),
                      SectionHeading(title: l.courses),
                      if (_enrollments.isEmpty)
                        EmptyState(
                          icon: Icons.auto_stories_outlined,
                          title: l.noLearning,
                          action: widget.onBrowse == null
                              ? null
                              : FilledButton(onPressed: widget.onBrowse, child: Text(l.catalog)),
                        )
                      else
                        ..._enrollments.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _EnrollmentCard(
                              item: item,
                              l: l,
                              busy: _busyCourse == item.id,
                              onTap: () => _openCourse(item),
                              onContinue: () => _continue(item),
                            ),
                          ),
                        ),
                      if (_dashboard != null && _dashboard!.certificates.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        SectionHeading(title: l.certificates),
                        ..._dashboard!.certificates.map(
                          (certificate) => Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: theme.colorScheme.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: theme.dividerColor),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 42,
                                  height: 42,
                                  decoration: BoxDecoration(
                                    color: AppColors.warning.withValues(alpha: 0.15),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.workspace_premium_rounded, color: AppColors.warning),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(certificate.courseTitle, style: const TextStyle(fontWeight: FontWeight.w700)),
                                      const SizedBox(height: 3),
                                      Text(
                                        '${certificate.serial} · ${formatDate(certificate.issuedAt, l)}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (certificate.isRevoked)
                                  BadgePill(label: l.locked, color: AppColors.danger)
                                else
                                  const Icon(Icons.verified_rounded, color: AppColors.success, size: 20),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
      ),
    );
  }
}

class _EnrollmentCard extends StatelessWidget {
  const _EnrollmentCard({
    required this.item,
    required this.l,
    required this.busy,
    required this.onTap,
    required this.onContinue,
  });

  final EnrollmentItem item;
  final L l;
  final bool busy;
  final VoidCallback onTap;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final course = item.course;
    if (course == null) return const SizedBox.shrink();
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(14),
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
                AppThumbnail(url: course.thumbnail, width: 74, height: 62, radius: 12),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        course.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, height: 1.25),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        '${item.progressPercent}% · ${course.lessonsCount} ${l.lessons}',
                        style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: (item.progressPercent / 100).clamp(0, 1),
                minHeight: 7,
                backgroundColor: theme.colorScheme.onSurface.withValues(alpha: 0.08),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 42,
              child: FilledButton(
                onPressed: busy ? null : onContinue,
                child: busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.play_arrow_rounded, size: 20),
                          const SizedBox(width: 6),
                          Text(l.continueLearning),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
