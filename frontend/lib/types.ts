export type Role = "student" | "teacher" | "admin";
export type Lang = "uz" | "ru";

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

export interface Profile {
  bio: string;
  headline: string;
  language: Lang;
  theme: "dark" | "light" | "system";
  telegram_username: string;
  website: string;
  country: string;
  city: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: Role;
  avatar: string | null;
  is_email_verified: boolean;
  profile?: Profile;
  points?: number;
  created_at?: string;
}

export interface AdminUser extends User {
  is_active: boolean;
  is_staff: boolean;
  courses_count: number;
  enrollments_count: number;
  last_login: string | null;
  created_at: string;
  profile?: Profile;
}

export interface PublicUser {
  id: number;
  full_name: string;
  avatar: string | null;
  role: Role;
}

export interface Category {
  id: number;
  name_uz: string;
  name_ru: string;
  slug: string;
  description_uz: string;
  description_ru: string;
  icon: string;
  order: number;
  is_active: boolean;
  course_count: number;
}

export interface TeacherCard extends PublicUser {
  courses_count: number;
  students_count: number;
}

export interface Course {
  id: number;
  slug: string;
  title: string;
  title_uz: string;
  title_ru: string;
  short_description: string;
  short_description_uz: string;
  short_description_ru: string;
  thumbnail: string | null;
  category: Category;
  teacher: TeacherCard;
  level: "beginner" | "intermediate" | "advanced";
  language: "uz" | "ru";
  status: "draft" | "published" | "archived";
  is_free: boolean;
  price: string;
  old_price: string;
  monthly_price: string;
  effective_price: string;
  effective_monthly_price: string;
  discount_percent: number;
  discount_ends_at: string | null;
  rating_avg: string;
  rating_count: number;
  students_count: number;
  lessons_count: number;
  duration_minutes: number;
  is_featured: boolean;
  is_enrolled: boolean;
  has_access: boolean;
  progress_percent: number;
  published_at: string | null;
  created_at: string;
}

export interface QuizSummary {
  id: number;
  title_uz: string;
  title_ru: string;
  passing_score: number;
  total_questions: number;
  is_active?: boolean;
  passed: boolean;
  attempts: number;
}

export interface LessonSummary {
  id: number;
  title: string;
  title_uz: string;
  title_ru: string;
  order: number;
  duration_seconds: number;
  is_free_preview: boolean;
  is_completed: boolean;
  is_locked: boolean;
  has_video: boolean;
  quiz: QuizSummary | null;
}

export interface CourseSection {
  id: number;
  title: string;
  title_uz: string;
  title_ru: string;
  description: string;
  order: number;
  lessons_count: number;
  lessons: LessonSummary[];
}

export interface CourseProgress {
  total_lessons: number;
  completed_lessons: number;
  total_quizzes: number;
  completed_quizzes: number;
  percent: number;
  is_complete: boolean;
  next_lesson_id: number | null;
  last_lesson_id: number | null;
}

export interface Subscription {
  id: number;
  course: Course;
  status: "active" | "grace" | "expired" | "canceled";
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  grace_until: string;
  access_until: string;
  days_remaining: number;
  in_grace: boolean;
  canceled_at: string | null;
  created_at: string;
}

export interface CourseDetail extends Course {
  description: string;
  description_uz: string;
  description_ru: string;
  sections: CourseSection[];
  progress: CourseProgress | null;
  subscription: Subscription | null;
  first_lesson_id: number | null;
  certificate_id: string | null;
  meta_title: string;
  meta_description: string;
}

export interface Enrollment {
  id: number;
  course: Course;
  progress_percent: number;
  last_lesson: LessonSummary | null;
  next_lesson_id: number | null;
  certificate_id: string | null;
  is_active: boolean;
  completed_at: string | null;
  updated_at: string;
}

export interface ContinueLearning {
  course: Course;
  lesson_id: number;
  lesson_title_uz: string;
  lesson_title_ru: string;
  percent: number;
  is_complete: boolean;
  last_position: number;
  lesson_url: string | null;
  subscription_status: string | null;
  access_active: boolean;
}

export interface StreamVideo {
  id: number;
  quality: string;
  duration_seconds: number;
  is_primary: boolean;
  stream_url: string;
}

export interface QuizStudent {
  id: number;
  title: string;
  description: string;
  passing_score: number;
  total_questions: number;
  attempts_count: number;
  best_score: number;
  passed: boolean;
  in_progress_attempt_id: number | null;
  is_active: boolean;
}

export interface LessonDetail {
  id: number;
  title: string;
  title_uz: string;
  title_ru: string;
  description: string;
  order: number;
  duration_seconds: number;
  is_free_preview: boolean;
  videos: StreamVideo[];
  quiz: (QuizStudent & { passed: boolean; in_progress_attempt_id: number | null }) | null;
  course: { id: number; slug: string; title_uz: string; title_ru: string };
  progress: { watched_seconds: number; last_position: number; duration: number; completed: boolean };
  next_lesson_id: number | null;
  previous_lesson_id: number | null;
  is_completed: boolean;
}

export interface AttemptQuestion {
  id: number;
  type: "single" | "multiple" | "image" | "text";
  text: string;
  image: string | null;
  points: number;
  options: { id: number; text: string }[];
}

export interface QuizAttemptSummary {
  id: number;
  quiz: QuizStudent;
  user: PublicUser;
  lesson_id: number;
  course_slug: string;
  attempt_number: number;
  started_at: string;
  completed_at: string | null;
  score: number;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  passed: boolean;
  restart_required: boolean;
}

export interface QuizAnswerResult {
  question_id: number;
  selected_options: number[];
  text_answer: string;
  is_correct: boolean;
  points_awarded: number;
  correct_option_ids: number[];
  explanation: string;
}

export interface QuizAttemptDetail extends QuizAttemptSummary {
  answers: QuizAnswerResult[];
  progress?: { percent: number; is_complete: boolean; next_lesson_id: number | null };
}

export interface QuizStartResponse {
  attempt: QuizAttemptSummary;
  quiz: QuizStudent;
  questions: AttemptQuestion[];
  resumed: boolean;
  answers_required: number;
  passing_score: number;
}

export interface Payment {
  id: number;
  course: Course;
  provider: "click" | "payme" | "uzum" | "sandbox" | "manual";
  provider_label: string;
  billing_period: "monthly" | "full";
  billing_period_label: string;
  amount: string;
  currency: string;
  status: "pending" | "processing" | "success" | "failed" | "canceled" | "refunded";
  checkout_url: string;
  failure_reason: string;
  paid_at: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
  provider_transaction_id?: string;
}

export interface Certificate {
  id: number;
  certificate_id: string;
  course: Course;
  student_name: string;
  teacher_name: string;
  issued_at: string;
  revoked: boolean;
  revoked_reason: string;
  pdf_file: string | null;
  verify_url: string;
  download_url: string;
}

export interface CertificateVerification {
  certificate_id: string;
  valid: boolean;
  student_name: string;
  course_title_uz: string;
  course_title_ru: string;
  teacher_name: string;
  issued_at: string;
  revoked: boolean;
  revoked_reason: string;
  verify_url: string;
  verifications_count: number;
}

export interface AppNotification {
  id: number;
  type: string;
  title_uz: string;
  title_ru: string;
  message_uz: string;
  message_ru: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Broadcast {
  id: number;
  created_by_email: string | null;
  type: string;
  audience: "all" | "students" | "course";
  course_slug: string;
  title_uz: string;
  title_ru: string;
  message_uz: string;
  message_ru: string;
  recipients_count: number;
  telegram: boolean;
  push: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user: PublicUser;
  points: number;
  completed_courses: number;
  quiz_accuracy: number;
  score: number;
  is_me: boolean;
}

export interface LeaderboardResponse {
  type: "overall" | "points" | "courses" | "quizzes";
  period: "all" | "month" | "week";
  results: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  total_students: number;
}

export interface CommentReply {
  id: number;
  user: PublicUser;
  body: string;
  is_deleted: boolean;
  is_owner: boolean;
  can_moderate: boolean;
  created_at: string;
}

export interface Comment {
  id: number;
  course: number;
  lesson: number | null;
  lesson_title: string | null;
  user: PublicUser;
  body: string;
  is_pinned: boolean;
  is_deleted: boolean;
  is_owner: boolean;
  can_moderate: boolean;
  replies_count: number;
  replies: CommentReply[];
  created_at: string;
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatar: string | null;
  order: number;
}

export interface PublicStats {
  students: number;
  courses: number;
  lessons: number;
  certificates: number;
  categories: number;
  average_rating: number;
}

export interface PublicSettings {
  site_name: string;
  support_email: string;
  support_phone: string;
  telegram_url: string;
  instagram_url: string;
  youtube_url: string;
  default_language: Lang;
  grace_period_days: number;
  quiz_passing_score: number;
  announcement: string;
  maintenance_mode: boolean;
  payment_providers: { id: string; label: string; enabled: boolean }[];
  google_client_id?: string;
}

export interface StudentDashboard {
  summary: {
    enrolled_courses: number;
    completed_courses: number;
    in_progress_courses: number;
    certificates: number;
    points: number;
    rank: number | null;
    unread_notifications: number;
  };
  enrollments: Enrollment[];
  certificates: Certificate[];
  quiz_attempts: QuizAttemptSummary[];
  payments: Payment[];
}

export interface SeriesPoint {
  date: string;
  revenue: number;
  enrollments: number;
  new_students: number;
}

export interface TeacherAnalytics {
  summary: {
    courses: number;
    published_courses: number;
    students: number;
    revenue: number;
    revenue_in_range: number;
    completion_rate: number;
    quiz_success_rate: number;
  };
  series: SeriesPoint[];
  courses: {
    course: Course;
    students: number;
    completed: number;
    revenue: number;
    avg_progress: number;
  }[];
  recent_payments: Payment[];
}

export interface AdminAnalytics {
  summary: {
    total_students: number;
    active_subscriptions: number;
    total_courses: number;
    published_courses: number;
    total_revenue: number;
    monthly_revenue: number;
    failed_payments: number;
    completion_rate: number;
    quiz_success_rate: number;
    total_enrollments?: number;
    certificates?: number;
  };
  series: SeriesPoint[];
  providers: { provider: string; count: number; total: number }[];
  top_courses: Course[];
  recent_payments: Payment[];
  recent_users: AdminUser[];
}

export interface AuditLog {
  id: number;
  user_email: string | null;
  action: string;
  model_name: string;
  object_id: string;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SystemSettings extends PublicSettings {
  default_language: Lang;
  grace_period_days: number;
  subscription_period_days: number;
  quiz_passing_score: number;
  certificate_enabled: boolean;
  click_enabled: boolean;
  payme_enabled: boolean;
  uzum_enabled: boolean;
  announcement: string;
}

export interface QuizManage {
  id: number;
  lesson: number;
  course_slug: string;
  lesson_title_uz: string;
  lesson_title_ru: string;
  title_uz: string;
  title_ru: string;
  description_uz: string;
  description_ru: string;
  passing_score: number;
  total_questions: number;
  randomize_questions: boolean;
  randomize_options: boolean;
  is_active: boolean;
  questions_count: number;
  attempts_count: number;
  pass_rate: number;
  questions?: ManageQuestion[];
  created_at: string;
  updated_at: string;
}

export interface ManageQuestion {
  id?: number;
  type: "single" | "multiple" | "image" | "text";
  text_uz: string;
  text_ru: string;
  image?: File | string | null;
  explanation_uz: string;
  explanation_ru: string;
  accepted_answers: string[];
  order?: number;
  points: number;
  options: {
    id?: number;
    text_uz: string;
    text_ru: string;
    is_correct: boolean;
    order?: number;
  }[];
}

export interface Discount {
  id: number;
  course: number;
  course_title: string;
  course_title_ru: string;
  percentage: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_current: boolean;
  created_at: string;
}

export interface MockLessonRow extends LessonSummary {
  section_id: number;
  section_title: string;
  course_slug: string;
}

export interface TelegramAccount {
  username?: string;
  linked_at?: string;
  notifications_enabled?: boolean;
  is_linked: boolean;
  bot_username?: string;
  deep_link?: string | null;
}
