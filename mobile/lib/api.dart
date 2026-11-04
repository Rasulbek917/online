import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class ApiException implements Exception {
  ApiException(this.statusCode, this.message, {this.code, this.detail});

  final int statusCode;
  final String message;
  final String? code;
  final Map<String, dynamic>? detail;

  bool get isUnauthorized => statusCode == 401;
  bool get isPaymentRequired => statusCode == 402;
  bool get isNotFound => statusCode == 404;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({String? baseUrl})
      : baseUrl = (baseUrl ?? const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:8000'))
            .replaceAll(RegExp(r'/+$'), '');

  final String baseUrl;
  String lang = 'uz';

  String? _accessToken;
  String? _refreshToken;
  Future<bool>? _refreshFuture;
  void Function()? onSessionExpired;

  static const _refreshKey = 'ipa_mobile_refresh';
  static const _langKey = 'ipa_mobile_lang';
  static const _themeKey = 'ipa_mobile_theme';

  bool get hasStoredSession => (_refreshToken ?? '').isNotEmpty;

  Future<void> loadLocalPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    _refreshToken = prefs.getString(_refreshKey);
    lang = prefs.getString(_langKey) ?? 'uz';
  }

  Future<void> setLanguage(String value) async {
    lang = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_langKey, value);
  }

  Future<String> readTheme() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_themeKey) ?? 'dark';
  }

  Future<void> writeTheme(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, value);
  }

  Future<void> _persistRefresh(String? token) async {
    _refreshToken = token;
    final prefs = await SharedPreferences.getInstance();
    if (token == null || token.isEmpty) {
      await prefs.remove(_refreshKey);
    } else {
      await prefs.setString(_refreshKey, token);
    }
  }

  Future<void> clearSession() async {
    _accessToken = null;
    await _persistRefresh(null);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final data = await post('/api/auth/login/', body: {
      'email': email.trim(),
      'password': password,
      'client': 'mobile',
    }, authenticated: false, retryOnUnauthorized: false);
    await _applyAuthPayload(data as Map<String, dynamic>);
    return data;
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required bool acceptTerms,
  }) async {
    final data = await post('/api/auth/register/', body: {
      'email': email.trim(),
      'password': password,
      'password_confirm': password,
      'first_name': firstName.trim(),
      'last_name': lastName.trim(),
      'language': lang,
      'accept_terms': acceptTerms,
      'client': 'mobile',
    }, authenticated: false, retryOnUnauthorized: false);
    await _applyAuthPayload(data as Map<String, dynamic>);
    return data;
  }

  Future<void> _applyAuthPayload(Map<String, dynamic> data) async {
    _accessToken = data['access'] as String?;
    final refresh = data['refresh'] as String?;
    if (refresh != null && refresh.isNotEmpty) {
      await _persistRefresh(refresh);
    }
  }

  Future<bool> restoreSession() async {
    if (!hasStoredSession) return false;
    return refreshAccessToken();
  }

  Future<bool> refreshAccessToken() async {
    final pending = _refreshFuture;
    if (pending != null) return pending;
    final future = _doRefresh();
    _refreshFuture = future;
    try {
      return await future;
    } finally {
      _refreshFuture = null;
    }
  }

  Future<bool> _doRefresh() async {
    final token = _refreshToken;
    if (token == null || token.isEmpty) return false;
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/api/auth/refresh/'),
            headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
            body: jsonEncode({'refresh': token, 'client': 'mobile'}),
          )
          .timeout(const Duration(seconds: 20));
      final decoded = _decode(response);
      if (response.statusCode >= 200 && response.statusCode < 300 && decoded is Map) {
        _accessToken = decoded['access'] as String?;
        final rotated = decoded['refresh'] as String?;
        await _persistRefresh(rotated ?? token);
        return _accessToken != null;
      }
    } catch (_) {
      // Network failures fall through to a signed-out state.
    }
    _accessToken = null;
    final hadSession = hasStoredSession;
    await _persistRefresh(null);
    if (hadSession) onSessionExpired?.call();
    return false;
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) {
    return _send('GET', path, query: query);
  }

  Future<dynamic> post(String path, {Object? body, bool authenticated = true, bool retryOnUnauthorized = true}) {
    return _send('POST', path, body: body, authenticated: authenticated, retryOnUnauthorized: retryOnUnauthorized);
  }

  Future<dynamic> patch(String path, {Object? body}) {
    return _send('PATCH', path, body: body);
  }

  Future<void> logout() async {
    final token = _refreshToken;
    try {
      await post('/api/auth/logout/', body: token == null ? null : {'refresh': token});
    } catch (_) {
      // Local sign-out must succeed even when the server is unreachable.
    }
    await clearSession();
  }

  Future<AppUser> me() async {
    final data = await get('/api/auth/me/');
    return AppUser.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<List<Course>> courses({String? search, int? categoryId, int pageSize = 60}) async {
    final query = <String, String>{
      'page_size': '$pageSize',
      'ordering': 'published_at',
      if ((search ?? '').trim().isNotEmpty) 'search': search!.trim(),
      if (categoryId != null && categoryId > 0) 'category': '$categoryId',
    };
    final data = await get('/api/courses/', query: query);
    final list = _results(data);
    return list.map((item) => Course.fromJson(item, lang)).toList();
  }

  Future<Course> courseDetail(String slug) async {
    final data = await get('/api/courses/$slug/');
    return Course.fromJson(Map<String, dynamic>.from(data as Map), lang);
  }

  Future<Map<String, dynamic>> enroll(String slug) async {
    final data = await post('/api/courses/$slug/enroll/');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<int> learn(String slug) async {
    final data = await post('/api/courses/$slug/learn/');
    final map = Map<String, dynamic>.from(data as Map);
    final id = map['lesson_id'];
    if (id == null) throw ApiException(500, 'Dars topilmadi');
    return int.parse(id.toString());
  }

  Future<LessonDetail> lesson(int lessonId) async {
    final data = await get('/api/lessons/$lessonId/student/');
    return LessonDetail.fromJson(Map<String, dynamic>.from(data as Map), lang);
  }

  Future<void> saveProgress({
    required int lessonId,
    required int videoId,
    required int watchedSeconds,
    required int duration,
    required bool completed,
  }) async {
    await post('/api/lessons/$lessonId/progress/', body: {
      'video_id': videoId,
      'watched_seconds': watchedSeconds,
      'duration': duration,
      'completed': completed,
    });
  }

  Future<QuizSession> startQuiz(int quizId) async {
    final data = await post('/api/quizzes/$quizId/start/');
    return QuizSession.fromJson(Map<String, dynamic>.from(data as Map), lang);
  }

  Future<QuizResult> submitQuiz(int attemptId, List<Map<String, dynamic>> answers) async {
    final data = await post('/api/quiz-attempts/$attemptId/submit/', body: {'answers': answers});
    return QuizResult.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<DashboardData> dashboard() async {
    final data = await get('/api/analytics/dashboard/');
    return DashboardData.fromJson(Map<String, dynamic>.from(data as Map), lang);
  }

  Future<List<EnrollmentItem>> enrollments() async {
    final data = await get('/api/enrollments/', query: {'page_size': '100'});
    return _results(data).map((item) => EnrollmentItem.fromJson(item, lang)).toList();
  }

  Future<List<NotificationItem>> notifications() async {
    final data = await get('/api/notifications/', query: {'page_size': '100'});
    return _results(data).map((item) => NotificationItem.fromJson(item, lang)).toList();
  }

  Future<int> unreadCount() async {
    final data = await get('/api/notifications/unread-count/');
    final map = Map<String, dynamic>.from(data as Map);
    return int.tryParse('${map['count']}') ?? 0;
  }

  Future<void> markNotificationRead(int id) async {
    await post('/api/notifications/$id/read/');
  }

  Future<void> markAllNotificationsRead() async {
    await post('/api/notifications/read-all/');
  }

  Future<List<PaymentProvider>> paymentProviders() async {
    final data = await get('/api/payments/methods/');
    final map = Map<String, dynamic>.from(data as Map);
    final providers = (map['providers'] as List?) ?? const [];
    return providers
        .whereType<Map>()
        .map((item) => PaymentProvider.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<CheckoutResult> checkout({
    required String courseSlug,
    required String provider,
    required String billingPeriod,
  }) async {
    final data = await post('/api/payments/checkout/', body: {
      'course_slug': courseSlug,
      'provider': provider,
      'billing_period': billingPeriod,
    });
    return CheckoutResult.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<Map<String, dynamic>> sandboxConfirm(int paymentId) async {
    final data = await post('/api/payments/$paymentId/sandbox_confirm/');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
    bool authenticated = true,
    bool retryOnUnauthorized = true,
  }) async {
    final params = <String, String>{
      if (method == 'GET') 'lang': lang,
      ...?query,
    };
    var uri = Uri.parse('$baseUrl$path');
    if (params.isNotEmpty) uri = uri.replace(queryParameters: params);

    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (authenticated && _accessToken != null) headers['Authorization'] = 'Bearer $_accessToken';

    http.Response response;
    try {
      switch (method) {
        case 'GET':
          response = await http.get(uri, headers: headers).timeout(const Duration(seconds: 25));
          break;
        case 'POST':
          response = await http.post(uri, headers: headers, body: body == null ? null : jsonEncode(body)).timeout(const Duration(seconds: 30));
          break;
        case 'PATCH':
          response = await http.patch(uri, headers: headers, body: body == null ? null : jsonEncode(body)).timeout(const Duration(seconds: 30));
          break;
        default:
          throw ApiException(0, 'Unsupported method');
      }
    } on TimeoutException {
      throw ApiException(0, lang == 'ru' ? 'Сервер не отвечает. Попробуйте снова.' : 'Server javob bermadi. Qayta urinib ko‘ring.');
    } catch (_) {
      throw ApiException(0, lang == 'ru' ? 'Проверьте интернет-соединение.' : 'Internet aloqasini tekshiring.');
    }

    if (response.statusCode == 401 && authenticated && retryOnUnauthorized && hasStoredSession) {
      final refreshed = await refreshAccessToken();
      if (refreshed) {
        return _send(method, path, body: body, query: query, authenticated: authenticated, retryOnUnauthorized: false);
      }
      throw ApiException(401, lang == 'ru' ? 'Сессия истекла. Войдите снова.' : 'Sessiya tugadi. Qayta kiring.', code: 'unauthorized');
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return _decode(response);
    }
    throw _errorFrom(response);
  }

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      var utf8Body = utf8.decode(response.bodyBytes);
      if (!baseUrl.contains('localhost') && !baseUrl.contains('127.0.0.1')) {
        utf8Body = utf8Body
            .replaceAll('http://localhost:8000', baseUrl)
            .replaceAll('http://127.0.0.1:8000', baseUrl);
      }
      return jsonDecode(utf8Body);
    } catch (_) {
      return response.body;
    }
  }

  ApiException _errorFrom(http.Response response) {
    String message = lang == 'ru' ? 'Ошибка сервера' : 'Server xatosi';
    String? code;
    Map<String, dynamic>? detail;
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is Map) {
        final error = decoded['error'];
        if (error is Map) {
          code = error['code']?.toString();
          if (error['message'] != null) message = error['message'].toString();
          final rawDetail = error['detail'];
          if (rawDetail is Map) {
            detail = Map<String, dynamic>.from(rawDetail);
            final messages = <String>[];
            rawDetail.forEach((key, value) {
              final text = value is List ? value.join(' ') : '$value';
              if (key == 'detail' || key == 'non_field_errors') {
                messages.add(text);
              } else {
                messages.add('$key: $text');
              }
            });
            if (messages.isNotEmpty) message = messages.join('\n');
          } else if (rawDetail != null) {
            message = rawDetail.toString();
          }
        } else if (decoded['detail'] != null) {
          message = decoded['detail'].toString();
        }
      }
    } catch (_) {
      if (response.statusCode == 404) {
        message = lang == 'ru' ? 'Не найдено' : 'Topilmadi';
      }
    }
    return ApiException(response.statusCode, message, code: code, detail: detail);
  }

  List<Map<String, dynamic>> _results(dynamic data) {
    final list = data is Map ? data['results'] : data;
    if (list is! List) return const [];
    return list.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList();
  }
}
