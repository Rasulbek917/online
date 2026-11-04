import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../api.dart';
import '../app_state.dart';
import '../l10n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'quiz_screen.dart';

class LessonScreen extends StatefulWidget {
  const LessonScreen({super.key, required this.lessonId, required this.courseSlug});

  final int lessonId;
  final String courseSlug;

  @override
  State<LessonScreen> createState() => _LessonScreenState();
}

class _LessonScreenState extends State<LessonScreen> {
  LessonDetail? _lesson;
  bool _loading = true;
  Object? _error;

  VideoPlayerController? _controller;
  VideoAsset? _video;
  Timer? _saveTimer;
  Timer? _uiTimer;
  Timer? _controlsTimer;
  bool _videoLoading = false;
  bool _completionSent = false;
  bool _showControls = true;
  bool _fullscreen = false;
  bool _openingQuiz = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    _uiTimer?.cancel();
    _controlsTimer?.cancel();
    _controller?.removeListener(_onVideoTick);
    unawaited(_saveProgress());
    _controller?.dispose();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  Future<void> _load({int? lessonId}) async {
    final state = context.read<AppState>();
    setState(() {
      _loading = true;
      _error = null;
    });
    _saveTimer?.cancel();
    _uiTimer?.cancel();
    await _controller?.dispose();
    _controller = null;
    _completionSent = false;
    try {
      final lesson = await state.api.lesson(lessonId ?? widget.lessonId);
      if (!mounted) return;
      setState(() {
        _lesson = lesson;
        _loading = false;
      });
      if (lesson.videos.isNotEmpty) {
        final primary = lesson.videos.firstWhere(
          (video) => video.isPrimary,
          orElse: () => lesson.videos.first,
        );
        await _initVideo(primary);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  String _streamUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    final state = context.read<AppState>();
    return '${state.api.baseUrl}$url';
  }

  Future<void> _initVideo(VideoAsset asset, {int? startAt}) async {
    final state = context.read<AppState>();
    final previousPosition = _controller?.value.position.inSeconds;
    setState(() {
      _video = asset;
      _videoLoading = true;
    });
    _controller?.removeListener(_onVideoTick);
    await _controller?.dispose();
    final controller = VideoPlayerController.networkUrl(Uri.parse(_streamUrl(asset.streamUrl)));
    _controller = controller;
    try {
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      await controller.setLooping(false);
      final resume = startAt ??
          previousPosition ??
          (_lesson?.progress.lastPosition ?? 0);
      if (resume > 0 && resume < controller.value.duration.inSeconds - 2) {
        await controller.seekTo(Duration(seconds: resume));
      }
      controller.addListener(_onVideoTick);
      setState(() => _videoLoading = false);
      _startSaveTimer();
      _scheduleControlsHide();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _videoLoading = false;
        _error = ApiException(0, state.lang == 'ru' ? 'Видео не удалось загрузить' : 'Videoni yuklab bo‘lmadi');
      });
    }
  }

  void _startSaveTimer() {
    _saveTimer?.cancel();
    _saveTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      final controller = _controller;
      if (controller != null && controller.value.isInitialized && controller.value.isPlaying) {
        unawaited(_saveProgress());
      }
    });
    _uiTimer?.cancel();
    _uiTimer = Timer.periodic(const Duration(milliseconds: 500), (_) {
      final controller = _controller;
      if (mounted && controller != null && controller.value.isInitialized && controller.value.isPlaying) {
        setState(() {});
      }
    });
  }

  void _onVideoTick() {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    final value = controller.value;
    if (!_completionSent &&
        value.duration.inSeconds > 0 &&
        (value.position.inSeconds >= value.duration.inSeconds - 2 ||
            value.position.inSeconds / value.duration.inSeconds >= 0.92)) {
      _completionSent = true;
      unawaited(_saveProgress(completed: true));
      if (mounted) setState(() {});
      _scheduleControlsHide();
    }
  }

  Future<void> _saveProgress({bool completed = false}) async {
    final lesson = _lesson;
    final controller = _controller;
    final video = _video;
    if (lesson == null || controller == null || video == null || !controller.value.isInitialized) return;
    final position = controller.value.position.inSeconds;
    if (position <= 0 && !completed) return;
    try {
      await context.read<AppState>().api.saveProgress(
            lessonId: lesson.id,
            videoId: video.id,
            watchedSeconds: position,
            duration: controller.value.duration.inSeconds,
            completed: completed || _completionSent,
          );
    } catch (_) {
      // Progress retries automatically on the next tick.
    }
  }

  void _scheduleControlsHide() {
    _controlsTimer?.cancel();
    if (!(_controller?.value.isPlaying ?? false)) {
      setState(() => _showControls = true);
      return;
    }
    _controlsTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => _showControls = false);
    });
  }

  void _togglePlay() {
    final controller = _controller;
    if (controller == null) return;
    if (controller.value.isPlaying) {
      controller.pause();
      unawaited(_saveProgress());
      setState(() => _showControls = true);
      _controlsTimer?.cancel();
    } else {
      controller.play();
      setState(() => _showControls = true);
      _scheduleControlsHide();
    }
  }

  Future<void> _toggleFullscreen() async {
    setState(() => _fullscreen = !_fullscreen);
    if (_fullscreen) {
      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
  }

  Future<void> _openQuiz(QuizSummary quiz) async {
    if (_openingQuiz) return;
    setState(() => _openingQuiz = true);
    final controller = _controller;
    if (controller?.value.isPlaying ?? false) {
      await controller!.pause();
    }
    unawaited(_saveProgress());
    try {
      final result = await Navigator.of(context).push<QuizResult>(
        MaterialPageRoute(builder: (_) => QuizScreen(quizId: quiz.id, quizTitle: quiz.title)),
      );
      if (!mounted || result == null) return;
      await _load(lessonId: _lesson?.id);
      if (!mounted) return;
      if (result.passed && result.nextLessonId != null) {
        final next = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(L(context.read<AppState>().lang).passed),
            content: Text(L(context.read<AppState>().lang).passedMessage),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: Text(L(context.read<AppState>().lang).close)),
              FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(L(context.read<AppState>().lang).nextLesson)),
            ],
          ),
        );
        if (next == true && mounted && result.nextLessonId != null) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => LessonScreen(
                lessonId: result.nextLessonId!,
                courseSlug: widget.courseSlug,
              ),
            ),
          );
        }
      } else if (!result.passed) {
        showAppSnack(context, L(context.read<AppState>().lang).failedMessage, error: true);
      }
    } catch (error) {
      if (mounted) showAppSnack(context, errorText(error, L(context.read<AppState>().lang)), error: true);
    } finally {
      if (mounted) setState(() => _openingQuiz = false);
    }
  }

  void _openVolume() {
    final controller = _controller;
    if (controller == null) return;
    var volume = controller.value.volume;
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Icon(Icons.volume_up_rounded),
                  Expanded(
                    child: Slider(
                      value: volume,
                      onChanged: (value) {
                        controller.setVolume(value);
                        setSheetState(() => volume = value);
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openLessonById(int id) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => LessonScreen(lessonId: id, courseSlug: widget.courseSlug)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l = L(state.lang);
    final lesson = _lesson;
    if (_loading) {
      return Scaffold(appBar: AppBar(), body: const LoadingView());
    }
    if (lesson == null || _error != null) {
      return Scaffold(
        appBar: AppBar(),
        body: ErrorView(
          message: _error == null ? l.loadError : errorText(_error!, l),
          retryLabel: l.retry,
          onRetry: _load,
        ),
      );
    }
    if (_fullscreen) {
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) _toggleFullscreen();
        },
        child: Scaffold(
          backgroundColor: Colors.black,
          body: SafeArea(
            child: Center(
              child: AspectRatio(
                aspectRatio: _controller?.value.aspectRatio ?? 16 / 9,
                child: _videoStack(lesson, l, fullscreen: true),
              ),
            ),
          ),
        ),
      );
    }
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.lessonNumber(lesson.order), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            Text(
              lesson.courseTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        actions: [
          if (lesson.quiz != null)
            IconButton(
              tooltip: l.test,
              onPressed: _openingQuiz ? null : () => _openQuiz(lesson.quiz!),
              icon: const Icon(Icons.quiz_outlined),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 28),
        children: [
          Container(
            color: Colors.black,
            child: AspectRatio(
              aspectRatio: _controller?.value.aspectRatio ?? 16 / 9,
              child: _videoStack(lesson, l, fullscreen: false),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(lesson.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                    ),
                    if (lesson.isCompleted)
                      const BadgePill(label: '100%', color: AppColors.success),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    if (lesson.durationSeconds > 0)
                      BadgePill(label: formatDuration(lesson.durationSeconds, l)),
                    if (lesson.isFreePreview) BadgePill(label: l.freePreview, color: AppColors.success),
                    if (lesson.quiz != null)
                      BadgePill(
                        label: lesson.quiz!.passed ? l.passed : l.test,
                        color: lesson.quiz!.passed ? AppColors.success : AppColors.violet,
                      ),
                  ],
                ),
                if (lesson.description.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    lesson.description,
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.55,
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.8),
                    ),
                  ),
                ],
                const SizedBox(height: 22),
                if (lesson.quiz != null) _quizCard(lesson.quiz!, l, theme),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: lesson.previousLessonId == null
                            ? null
                            : () => _openLessonById(lesson.previousLessonId!),
                        icon: const Icon(Icons.chevron_left),
                        label: Text(l.previousLesson, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: lesson.nextLessonId == null
                            ? null
                            : () => _openLessonById(lesson.nextLessonId!),
                        icon: const Icon(Icons.chevron_right),
                        label: Text(l.nextLesson, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _quizCard(QuizSummary quiz, L l, ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.violet.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.quiz_outlined, color: AppColors.violet),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(quiz.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 3),
                    Text(
                      '${quiz.totalQuestions} ${l.questions} · ${quiz.attempts} ${l.attempts}',
                      style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            quiz.passed
                ? l.passedMessage
                : _completionSent || (_lesson?.isCompleted ?? false)
                    ? l.startTest
                    : l.quizLocked,
            style: TextStyle(fontSize: 12.5, color: theme.colorScheme.onSurface.withValues(alpha: 0.65)),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _openingQuiz || !quiz.isActive ? null : () => _openQuiz(quiz),
            icon: Icon(quiz.passed ? Icons.replay_rounded : Icons.play_arrow_rounded, size: 20),
            label: Text(quiz.passed ? l.retake : quiz.attempts > 0 ? l.retry : l.startTest),
          ),
        ],
      ),
    );
  }

  Widget _videoStack(LessonDetail lesson, L l, {required bool fullscreen}) {
    if (lesson.videos.isEmpty) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.videocam_off_outlined, color: Colors.white54, size: 40),
            const SizedBox(height: 8),
            Text(l.noVideo, style: const TextStyle(color: Colors.white54, fontSize: 13)),
          ],
        ),
      );
    }
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: _videoLoading
            ? const CircularProgressIndicator(color: Colors.white)
            : const Icon(Icons.play_circle_outline, color: Colors.white54, size: 48),
      );
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        Center(
          child: AspectRatio(
            aspectRatio: controller.value.aspectRatio,
            child: VideoPlayer(controller),
          ),
        ),
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            setState(() => _showControls = !_showControls);
            if (_showControls) _scheduleControlsHide();
          },
          child: AnimatedOpacity(
            opacity: _showControls ? 1 : 0,
            duration: const Duration(milliseconds: 180),
            child: IgnorePointer(
              ignoring: !_showControls,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.black45, Colors.transparent, Colors.black54],
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: fullscreen ? _toggleFullscreen : () => Navigator.pop(context),
                          icon: Icon(fullscreen ? Icons.fullscreen_exit : Icons.arrow_back, color: Colors.white),
                        ),
                        Expanded(
                          child: Text(
                            lesson.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                          ),
                        ),
                        if (lesson.videos.length > 1)
                          PopupMenuButton<VideoAsset>(
                            tooltip: l.quality,
                            color: const Color(0xFF111B33),
                            icon: const Icon(Icons.hd_outlined, color: Colors.white),
                            onSelected: (asset) {
                              final position = controller.value.position.inSeconds;
                              _initVideo(asset, startAt: position);
                            },
                            itemBuilder: (context) => lesson.videos
                                .map(
                                  (asset) => PopupMenuItem(
                                    value: asset,
                                    child: Text(
                                      asset.quality.toUpperCase(),
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: asset.id == _video?.id ? FontWeight.w800 : FontWeight.w400,
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        PopupMenuButton<double>(
                          tooltip: l.speed,
                          color: const Color(0xFF111B33),
                          icon: const Icon(Icons.speed_rounded, color: Colors.white),
                          onSelected: controller.setPlaybackSpeed,
                          itemBuilder: (context) => const [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
                              .map(
                                (speed) => PopupMenuItem(
                                  value: speed,
                                  child: Text('${speed == speed.roundToDouble() ? speed.toInt() : speed}x', style: const TextStyle(color: Colors.white)),
                                ),
                              )
                              .toList(),
                        ),
                        IconButton(
                          onPressed: _openVolume,
                          icon: const Icon(Icons.volume_up_rounded, color: Colors.white),
                        ),
                        IconButton(
                          onPressed: _toggleFullscreen,
                          icon: Icon(fullscreen ? Icons.fullscreen_exit : Icons.fullscreen, color: Colors.white),
                        ),
                      ],
                    ),
                    const Spacer(),
                    IconButton(
                      iconSize: 58,
                      onPressed: _togglePlay,
                      icon: Icon(
                        controller.value.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
                        color: Colors.white,
                      ),
                    ),
                    const Spacer(),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Column(
                        children: [
                          SliderTheme(
                            data: SliderTheme.of(context).copyWith(
                              trackHeight: 3,
                              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                              overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                              activeTrackColor: AppColors.primary,
                              inactiveTrackColor: Colors.white30,
                              thumbColor: Colors.white,
                            ),
                            child: Slider(
                              min: 0,
                              max: controller.value.duration.inMilliseconds <= 0
                                  ? 1
                                  : controller.value.duration.inMilliseconds.toDouble(),
                              value: controller.value.duration.inMilliseconds <= 0
                                  ? 0
                                  : controller.value.position.inMilliseconds
                                      .toDouble()
                                      .clamp(0, controller.value.duration.inMilliseconds.toDouble()),
                              onChanged: (value) {
                                controller.seekTo(Duration(milliseconds: value.round()));
                                setState(() {});
                              },
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
                            child: Row(
                              children: [
                                Text(
                                  _formatTime(controller.value.position),
                                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                                ),
                                const Spacer(),
                                Text(
                                  _formatTime(controller.value.duration),
                                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  String _formatTime(Duration value) {
    final minutes = value.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}
