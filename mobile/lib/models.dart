String _str(dynamic value, [String fallback = '']) {
  if (value == null) return fallback;
  return value.toString();
}

int _int(dynamic value, [int fallback = 0]) {
  if (value == null) return fallback;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString()) ?? fallback;
}

double _double(dynamic value, [double fallback = 0]) {
  if (value == null) return fallback;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? fallback;
}

bool _bool(dynamic value, [bool fallback = false]) {
  if (value == null) return fallback;
  if (value is bool) return value;
  return value.toString() == 'true';
}

String localized(Map<String, dynamic> json, String key, String lang) {
  final suffix = lang == 'ru' ? '_ru' : '_uz';
  final localizedValue = json['$key$suffix'];
  if (localizedValue != null && localizedValue.toString().isNotEmpty) {
    return localizedValue.toString();
  }
  return _str(json[key]);
}

class AppUser {
  AppUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    required this.points,
    required this.language,
    required this.theme,
    this.firstName = '',
    this.lastName = '',
    this.phone = '',
    this.avatar,
    this.isEmailVerified = false,
  });

  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final String fullName;
  final String role;
  final String phone;
  final String? avatar;
  final bool isEmailVerified;
  final int points;
  final String language;
  final String theme;

  bool get isTeacher => role == 'teacher';
  bool get isAdmin => role == 'admin';
  bool get isStaff => isTeacher || isAdmin;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    final profile = json['profile'] is Map ? Map<String, dynamic>.from(json['profile'] as Map) : <String, dynamic>{};
    return AppUser(
      id: _int(json['id']),
      email: _str(json['email']),
      firstName: _str(json['first_name']),
      lastName: _str(json['last_name']),
      fullName: _str(json['full_name'], _str(json['email'])),
      role: _str(json['role'], 'student'),
      phone: _str(json['phone']),
      avatar: (json['avatar'] as String?)?.isNotEmpty == true ? json['avatar'] as String : null,
      isEmailVerified: _bool(json['is_email_verified']),
      points: _int(json['points']),
      language: _str(profile['language'], 'uz'),
      theme: _str(profile['theme'], 'dark'),
    );
  }
}

class Category {
  Category({required this.id, required this.name, required this.slug});

  final int id;
  final String name;
  final String slug;

  factory Category.fromJson(Map<String, dynamic> json, String lang) {
    return Category(
      id: _int(json['id']),
      name: localized(json, 'name', lang),
      slug: _str(json['slug']),
    );
  }
}

class TeacherBrief {
  TeacherBrief({required this.id, required this.fullName, this.avatar});

  final int id;
  final String fullName;
  final String? avatar;

  factory TeacherBrief.fromJson(Map<String, dynamic> json) {
    return TeacherBrief(
      id: _int(json['id']),
      fullName: _str(json['full_name']),
      avatar: (json['avatar'] as String?)?.isNotEmpty == true ? json['avatar'] as String : null,
    );
  }
}

class QuizSummary {
  QuizSummary({
    required this.id,
    required this.title,
    required this.passingScore,
    required this.totalQuestions,
    required this.isActive,
    required this.passed,
    required this.attempts,
  });

  final int id;
  final String title;
  final int passingScore;
  final int totalQuestions;
  final bool isActive;
  final bool passed;
  final int attempts;

  factory QuizSummary.fromJson(Map<String, dynamic> json, String lang) {
    return QuizSummary(
      id: _int(json['id']),
      title: localized(json, 'title', lang),
      passingScore: _int(json['passing_score'], 7),
      totalQuestions: _int(json['total_questions'], 10),
      isActive: _bool(json['is_active'], true),
      passed: _bool(json['passed']),
      attempts: _int(json['attempts']),
    );
  }
}

class LessonSummary {
  LessonSummary({
    required this.id,
    required this.title,
    required this.order,
    required this.durationSeconds,
    required this.isFreePreview,
    required this.isCompleted,
    required this.isLocked,
    required this.hasVideo,
    this.quiz,
  });

  final int id;
  final String title;
  final int order;
  final int durationSeconds;
  final bool isFreePreview;
  final bool isCompleted;
  final bool isLocked;
  final bool hasVideo;
  final QuizSummary? quiz;

  factory LessonSummary.fromJson(Map<String, dynamic> json, String lang) {
    final quizJson = json['quiz'];
    return LessonSummary(
      id: _int(json['id']),
      title: localized(json, 'title', lang),
      order: _int(json['order']),
      durationSeconds: _int(json['duration_seconds']),
      isFreePreview: _bool(json['is_free_preview']),
      isCompleted: _bool(json['is_completed']),
      isLocked: _bool(json['is_locked']),
      hasVideo: _bool(json['has_video']),
      quiz: quizJson is Map ? QuizSummary.fromJson(Map<String, dynamic>.from(quizJson), lang) : null,
    );
  }
}

class Section {
  Section({
    required this.id,
    required this.title,
    required this.order,
    required this.lessons,
  });

  final int id;
  final String title;
  final int order;
  final List<LessonSummary> lessons;

  factory Section.fromJson(Map<String, dynamic> json, String lang) {
    final rawLessons = (json['lessons'] as List?) ?? const [];
    return Section(
      id: _int(json['id']),
      title: localized(json, 'title', lang),
      order: _int(json['order']),
      lessons: rawLessons
          .whereType<Map>()
          .map((item) => LessonSummary.fromJson(Map<String, dynamic>.from(item), lang))
          .toList(),
    );
  }
}

class Course {
  Course({
    required this.id,
    required this.slug,
    required this.title,
    required this.shortDescription,
    required this.description,
    required this.thumbnail,
    required this.level,
    required this.language,
    required this.isFree,
    required this.price,
    required this.effectiveMonthlyPrice,
    required this.discountPercent,
    required this.ratingAvg,
    required this.studentsCount,
    required this.lessonsCount,
    required this.durationMinutes,
    required this.isEnrolled,
    required this.hasAccess,
    required this.progressPercent,
    required this.sections,
    this.category,
    this.teacher,
    this.firstLessonId,
  });

  final int id;
  final String slug;
  final String title;
  final String shortDescription;
  final String description;
  final String? thumbnail;
  final String level;
  final String language;
  final bool isFree;
  final double price;
  final double effectiveMonthlyPrice;
  final int discountPercent;
  final double ratingAvg;
  final int studentsCount;
  final int lessonsCount;
  final int durationMinutes;
  final bool isEnrolled;
  final bool hasAccess;
  final int progressPercent;
  final List<Section> sections;
  final Category? category;
  final TeacherBrief? teacher;
  final int? firstLessonId;

  factory Course.fromJson(Map<String, dynamic> json, String lang) {
    final rawSections = (json['sections'] as List?) ?? const [];
    final categoryJson = json['category'];
    final teacherJson = json['teacher'];
    return Course(
      id: _int(json['id']),
      slug: _str(json['slug']),
      title: localized(json, 'title', lang),
      shortDescription: localized(json, 'short_description', lang),
      description: localized(json, 'description', lang),
      thumbnail: (json['thumbnail'] as String?)?.isNotEmpty == true ? json['thumbnail'] as String : null,
      level: _str(json['level'], 'beginner'),
      language: _str(json['language'], 'uz'),
      isFree: _bool(json['is_free']),
      price: _double(json['price']),
      effectiveMonthlyPrice: _double(json['effective_monthly_price']),
      discountPercent: _int(json['discount_percent']),
      ratingAvg: _double(json['rating_avg']),
      studentsCount: _int(json['students_count']),
      lessonsCount: _int(json['lessons_count']),
      durationMinutes: _int(json['duration_minutes']),
      isEnrolled: _bool(json['is_enrolled']),
      hasAccess: _bool(json['has_access']),
      progressPercent: _int(json['progress_percent']),
      sections: rawSections
          .whereType<Map>()
          .map((item) => Section.fromJson(Map<String, dynamic>.from(item), lang))
          .toList(),
      category: categoryJson is Map
          ? Category.fromJson(Map<String, dynamic>.from(categoryJson), lang)
          : null,
      teacher: teacherJson is Map ? TeacherBrief.fromJson(Map<String, dynamic>.from(teacherJson)) : null,
      firstLessonId: json['first_lesson_id'] == null ? null : _int(json['first_lesson_id']),
    );
  }
}

class VideoAsset {
  VideoAsset({
    required this.id,
    required this.quality,
    required this.durationSeconds,
    required this.isPrimary,
    required this.streamUrl,
  });

  final int id;
  final String quality;
  final int durationSeconds;
  final bool isPrimary;
  final String streamUrl;

  factory VideoAsset.fromJson(Map<String, dynamic> json) {
    return VideoAsset(
      id: _int(json['id']),
      quality: _str(json['quality'], 'auto'),
      durationSeconds: _int(json['duration_seconds']),
      isPrimary: _bool(json['is_primary']),
      streamUrl: _str(json['stream_url']),
    );
  }
}

class LessonProgress {
  LessonProgress({
    required this.watchedSeconds,
    required this.lastPosition,
    required this.duration,
    required this.completed,
  });

  final int watchedSeconds;
  final int lastPosition;
  final int duration;
  final bool completed;

  factory LessonProgress.fromJson(Map<String, dynamic> json) {
    return LessonProgress(
      watchedSeconds: _int(json['watched_seconds']),
      lastPosition: _int(json['last_position']),
      duration: _int(json['duration']),
      completed: _bool(json['completed']),
    );
  }
}

class LessonDetail {
  LessonDetail({
    required this.id,
    required this.title,
    required this.description,
    required this.order,
    required this.durationSeconds,
    required this.isFreePreview,
    required this.videos,
    required this.isCompleted,
    required this.progress,
    required this.courseSlug,
    required this.courseTitle,
    this.quiz,
    this.nextLessonId,
    this.previousLessonId,
  });

  final int id;
  final String title;
  final String description;
  final int order;
  final int durationSeconds;
  final bool isFreePreview;
  final List<VideoAsset> videos;
  final bool isCompleted;
  final LessonProgress progress;
  final String courseSlug;
  final String courseTitle;
  final QuizSummary? quiz;
  final int? nextLessonId;
  final int? previousLessonId;

  factory LessonDetail.fromJson(Map<String, dynamic> json, String lang) {
    final rawVideos = (json['videos'] as List?) ?? const [];
    final quizJson = json['quiz'];
    final courseJson = json['course'];
    final progressJson = json['progress'];
    return LessonDetail(
      id: _int(json['id']),
      title: localized(json, 'title', lang),
      description: localized(json, 'description', lang),
      order: _int(json['order']),
      durationSeconds: _int(json['duration_seconds']),
      isFreePreview: _bool(json['is_free_preview']),
      videos: rawVideos
          .whereType<Map>()
          .map((item) => VideoAsset.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      isCompleted: _bool(json['is_completed']),
      progress: progressJson is Map
          ? LessonProgress.fromJson(Map<String, dynamic>.from(progressJson))
          : LessonProgress(watchedSeconds: 0, lastPosition: 0, duration: 0, completed: false),
      courseSlug: courseJson is Map ? _str(courseJson['slug']) : '',
      courseTitle: courseJson is Map ? localized(Map<String, dynamic>.from(courseJson), 'title', lang) : '',
      quiz: quizJson is Map ? QuizSummary.fromJson(Map<String, dynamic>.from(quizJson), lang) : null,
      nextLessonId: json['next_lesson_id'] == null ? null : _int(json['next_lesson_id']),
      previousLessonId: json['previous_lesson_id'] == null ? null : _int(json['previous_lesson_id']),
    );
  }
}

class QuizOption {
  QuizOption({required this.id, required this.text});

  final int id;
  final String text;

  factory QuizOption.fromJson(Map<String, dynamic> json) {
    return QuizOption(id: _int(json['id']), text: _str(json['text']));
  }
}

class QuizQuestion {
  QuizQuestion({
    required this.id,
    required this.type,
    required this.text,
    required this.image,
    required this.points,
    required this.options,
  });

  final int id;
  final String type;
  final String text;
  final String? image;
  final int points;
  final List<QuizOption> options;

  bool get isMultiple => type == 'multiple';
  bool get isText => type == 'text';

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    final rawOptions = (json['options'] as List?) ?? const [];
    final image = json['image'] ?? json['image_url'];
    return QuizQuestion(
      id: _int(json['id']),
      type: _str(json['type'], 'single'),
      text: _str(json['text']),
      image: image is String && image.isNotEmpty ? image : null,
      points: _int(json['points'], 1),
      options: rawOptions
          .whereType<Map>()
          .map((item) => QuizOption.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
    );
  }
}

class QuizSession {
  QuizSession({
    required this.attemptId,
    required this.quizTitle,
    required this.passingScore,
    required this.questions,
    required this.resumed,
    required this.answersRequired,
  });

  final int attemptId;
  final String quizTitle;
  final int passingScore;
  final List<QuizQuestion> questions;
  final bool resumed;
  final int answersRequired;

  factory QuizSession.fromJson(Map<String, dynamic> json, String lang) {
    final attemptJson = json['attempt'];
    final quizJson = json['quiz'];
    final rawQuestions = (json['questions'] as List?) ?? const [];
    return QuizSession(
      attemptId: attemptJson is Map ? _int(attemptJson['id']) : 0,
      quizTitle: quizJson is Map ? localized(Map<String, dynamic>.from(quizJson), 'title', lang) : '',
      passingScore: _int(json['passing_score'], 7),
      questions: rawQuestions
          .whereType<Map>()
          .map((item) => QuizQuestion.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      resumed: _bool(json['resumed']),
      answersRequired: _int(json['answers_required'], rawQuestions.length),
    );
  }
}

class QuizResult {
  QuizResult({
    required this.attemptId,
    required this.score,
    required this.correctCount,
    required this.wrongCount,
    required this.totalQuestions,
    required this.passed,
    required this.restartRequired,
    required this.progressPercent,
    this.nextLessonId,
  });

  final int attemptId;
  final double score;
  final int correctCount;
  final int wrongCount;
  final int totalQuestions;
  final bool passed;
  final bool restartRequired;
  final int progressPercent;
  final int? nextLessonId;

  factory QuizResult.fromJson(Map<String, dynamic> json) {
    final progressJson = json['progress'];
    final progress = progressJson is Map ? Map<String, dynamic>.from(progressJson) : <String, dynamic>{};
    return QuizResult(
      attemptId: _int(json['id']),
      score: _double(json['score']),
      correctCount: _int(json['correct_count']),
      wrongCount: _int(json['wrong_count']),
      totalQuestions: _int(json['total_questions']),
      passed: _bool(json['passed']),
      restartRequired: _bool(json['restart_required']),
      progressPercent: _int(progress['percent']),
      nextLessonId: progress['next_lesson_id'] == null ? null : _int(progress['next_lesson_id']),
    );
  }
}

class NotificationItem {
  NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  final int id;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime? createdAt;

  factory NotificationItem.fromJson(Map<String, dynamic> json, String lang) {
    return NotificationItem(
      id: _int(json['id']),
      type: _str(json['type'], 'system'),
      title: localized(json, 'title', lang),
      message: localized(json, 'message', lang),
      isRead: _bool(json['is_read']),
      createdAt: DateTime.tryParse(_str(json['created_at'])),
    );
  }
}

class EnrollmentItem {
  EnrollmentItem({
    required this.id,
    required this.course,
    required this.progressPercent,
    required this.isActive,
    this.nextLessonId,
    this.certificateId,
  });

  final int id;
  final Course? course;
  final int progressPercent;
  final bool isActive;
  final int? nextLessonId;
  final int? certificateId;

  factory EnrollmentItem.fromJson(Map<String, dynamic> json, String lang) {
    final courseJson = json['course'];
    return EnrollmentItem(
      id: _int(json['id']),
      course: courseJson is Map ? Course.fromJson(Map<String, dynamic>.from(courseJson), lang) : null,
      progressPercent: _int(json['progress_percent']),
      isActive: _bool(json['is_active'], true),
      nextLessonId: json['next_lesson_id'] == null ? null : _int(json['next_lesson_id']),
      certificateId: json['certificate_id'] == null ? null : _int(json['certificate_id']),
    );
  }
}

class CertificateItem {
  CertificateItem({
    required this.id,
    required this.serial,
    required this.courseTitle,
    required this.issuedAt,
    required this.isRevoked,
  });

  final int id;
  final String serial;
  final String courseTitle;
  final DateTime? issuedAt;
  final bool isRevoked;

  factory CertificateItem.fromJson(Map<String, dynamic> json, String lang) {
    final courseJson = json['course'];
    return CertificateItem(
      id: _int(json['id']),
      serial: _str(json['serial']),
      courseTitle: courseJson is Map ? localized(Map<String, dynamic>.from(courseJson), 'title', lang) : '',
      issuedAt: DateTime.tryParse(_str(json['issued_at'])),
      isRevoked: _bool(json['is_revoked']),
    );
  }
}

class DashboardSummary {
  DashboardSummary({
    required this.enrolledCourses,
    required this.completedCourses,
    required this.inProgressCourses,
    required this.certificates,
    required this.points,
    required this.rank,
    required this.unreadNotifications,
  });

  final int enrolledCourses;
  final int completedCourses;
  final int inProgressCourses;
  final int certificates;
  final int points;
  final int rank;
  final int unreadNotifications;

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    return DashboardSummary(
      enrolledCourses: _int(json['enrolled_courses']),
      completedCourses: _int(json['completed_courses']),
      inProgressCourses: _int(json['in_progress_courses']),
      certificates: _int(json['certificates']),
      points: _int(json['points']),
      rank: _int(json['rank']),
      unreadNotifications: _int(json['unread_notifications']),
    );
  }
}

class DashboardData {
  DashboardData({
    required this.summary,
    required this.enrollments,
    required this.certificates,
  });

  final DashboardSummary summary;
  final List<EnrollmentItem> enrollments;
  final List<CertificateItem> certificates;

  factory DashboardData.fromJson(Map<String, dynamic> json, String lang) {
    final summaryJson = json['summary'];
    final rawEnrollments = (json['enrollments'] as List?) ?? const [];
    final rawCertificates = (json['certificates'] as List?) ?? const [];
    return DashboardData(
      summary: summaryJson is Map
          ? DashboardSummary.fromJson(Map<String, dynamic>.from(summaryJson))
          : DashboardSummary(
              enrolledCourses: 0,
              completedCourses: 0,
              inProgressCourses: 0,
              certificates: 0,
              points: 0,
              rank: 0,
              unreadNotifications: 0,
            ),
      enrollments: rawEnrollments
          .whereType<Map>()
          .map((item) => EnrollmentItem.fromJson(Map<String, dynamic>.from(item), lang))
          .toList(),
      certificates: rawCertificates
          .whereType<Map>()
          .map((item) => CertificateItem.fromJson(Map<String, dynamic>.from(item), lang))
          .toList(),
    );
  }
}

class PaymentProvider {
  PaymentProvider({required this.id, required this.label, required this.enabled});

  final String id;
  final String label;
  final bool enabled;

  factory PaymentProvider.fromJson(Map<String, dynamic> json) {
    return PaymentProvider(
      id: _str(json['id']),
      label: _str(json['label'], _str(json['id'])),
      enabled: _bool(json['enabled']),
    );
  }
}

class CheckoutResult {
  CheckoutResult({
    required this.paymentId,
    required this.checkoutUrl,
    required this.status,
    required this.amount,
  });

  final int paymentId;
  final String checkoutUrl;
  final String status;
  final double amount;

  factory CheckoutResult.fromJson(Map<String, dynamic> json) {
    final paymentJson = json['payment'];
    final payment = paymentJson is Map ? Map<String, dynamic>.from(paymentJson) : <String, dynamic>{};
    return CheckoutResult(
      paymentId: _int(payment['id']),
      checkoutUrl: _str(payment['checkout_url']).isNotEmpty
          ? _str(payment['checkout_url'])
          : _str(json['checkout_url']),
      status: _str(payment['status'], 'pending'),
      amount: _double(payment['amount']),
    );
  }
}

class Paginated<T> {
  Paginated({required this.results, required this.count, required this.hasNext});

  final List<T> results;
  final int count;
  final bool hasNext;
}
