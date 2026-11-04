import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../l10n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'course_detail_screen.dart';

class CatalogTab extends StatefulWidget {
  const CatalogTab({super.key});

  @override
  State<CatalogTab> createState() => _CatalogTabState();
}

class _CatalogTabState extends State<CatalogTab> {
  final _searchController = TextEditingController();
  List<Course> _courses = const [];
  bool _loading = true;
  Object? _error;
  int? _categoryId;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final courses = await state.api.courses();
      if (!mounted) return;
      setState(() {
        _courses = courses;
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

  List<Category> get _categories {
    final map = <int, Category>{};
    for (final course in _courses) {
      final category = course.category;
      if (category != null) map[category.id] = category;
    }
    final list = map.values.toList()..sort((a, b) => a.name.compareTo(b.name));
    return list;
  }

  List<Course> get _filtered {
    final query = _query.trim().toLowerCase();
    return _courses.where((course) {
      if (_categoryId != null && course.category?.id != _categoryId) return false;
      if (query.isEmpty) return true;
      return course.title.toLowerCase().contains(query) ||
          course.shortDescription.toLowerCase().contains(query) ||
          (course.category?.name.toLowerCase().contains(query) ?? false) ||
          (course.teacher?.fullName.toLowerCase().contains(query) ?? false);
    }).toList();
  }

  void _openCourse(Course course) {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => CourseDetailScreen(slug: course.slug)))
        .then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l = L(state.lang);
    final theme = Theme.of(context);
    final filtered = _filtered;
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l.greeting(state.user?.firstName ?? ''),
                            style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            l.tagline,
                            style: TextStyle(
                              fontSize: 13,
                              color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.warning.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.bolt_rounded, color: AppColors.warning, size: 18),
                          const SizedBox(width: 4),
                          Text(
                            '${state.user?.points ?? 0}',
                            style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.warning),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                child: TextField(
                  controller: _searchController,
                  onChanged: (value) => setState(() => _query = value),
                  decoration: InputDecoration(
                    hintText: l.searchCourses,
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _query.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _query = '');
                            },
                          ),
                  ),
                ),
              ),
            ),
            if (!_loading && _error == null)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 54,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 6),
                    children: [
                      _CategoryChip(
                        label: l.all,
                        selected: _categoryId == null,
                        onTap: () => setState(() => _categoryId = null),
                      ),
                      ..._categories.map(
                        (category) => _CategoryChip(
                          label: category.name,
                          selected: _categoryId == category.id,
                          onTap: () => setState(() => _categoryId = category.id),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (_loading)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: LoadingView(),
                ),
              )
            else if (_error != null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: ErrorView(
                  message: errorText(_error!, l),
                  retryLabel: l.retry,
                  onRetry: _load,
                ),
              )
            else if (filtered.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: EmptyState(icon: Icons.search_off_rounded, title: l.noCourses),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                sliver: SliverList.separated(
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final course = filtered[index];
                    return CourseCard(course: course, l: l, onTap: () => _openCourse(course));
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: selected ? appGradient : null,
            color: selected ? null : theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: selected ? Colors.transparent : theme.dividerColor),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : theme.colorScheme.onSurface.withValues(alpha: 0.75),
            ),
          ),
        ),
      ),
    );
  }
}
