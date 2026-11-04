class L {
  const L(this.lang);

  final String lang;

  bool get ru => lang == 'ru';

  String pick(String uz, String ruText) => ru ? ruText : uz;

  String get appName => 'IT PARK Academy';
  String get tagline => pick('Bilim — kelajak poydevori', 'Знания — фундамент будущего');
  String get login => pick('Kirish', 'Вход');
  String get register => pick("Ro‘yxatdan o‘tish", 'Регистрация');
  String get email => pick('Email', 'Email');
  String get password => pick('Parol', 'Пароль');
  String get confirmPassword => pick('Parolni tasdiqlang', 'Подтвердите пароль');
  String get firstName => pick('Ism', 'Имя');
  String get lastName => pick('Familiya', 'Фамилия');
  String get acceptTerms => pick('Foydalanish shartlariga roziman', 'Принимаю условия использования');
  String get noAccount => pick("Akkauntingiz yo‘qmi?", 'Нет аккаунта?');
  String get haveAccount => pick('Akkauntingiz bormi?', 'Уже есть аккаунт?');
  String get signIn => pick('Kirish', 'Войти');
  String get signUp => pick("Ro‘yxatdan o‘tish", 'Создать аккаунт');
  String get createAccount => pick('Akkaunt yaratish', 'Создать аккаунт');
  String get logout => pick('Chiqish', 'Выйти');
  String get logoutConfirm => pick('Hisobdan chiqmoqchimisiz?', 'Выйти из аккаунта?');
  String get logoutMessage => pick('Qayta kirish uchun email va parolingiz kerak bo‘ladi.', 'Для входа снова понадобятся email и пароль.');
  String get cancel => pick('Bekor qilish', 'Отмена');
  String get confirm => pick('Tasdiqlash', 'Подтвердить');
  String get catalog => pick('Katalog', 'Каталог');
  String get myLearning => pick("O‘qishim", 'Моё обучение');
  String get notifications => pick('Bildirishnomalar', 'Уведомления');
  String get profile => pick('Profil', 'Профиль');
  String get searchCourses => pick('Kurslarni qidirish', 'Поиск курсов');
  String get all => pick('Barchasi', 'Все');
  String get courses => pick('Kurslar', 'Курсы');
  String get lessons => pick('dars', 'уроков');
  String get students => pick("o‘quvchi", 'студентов');
  String get free => pick('Bepul', 'Бесплатно');
  String get sum => pick("so‘m", 'сум');
  String get month => pick('/oy', '/мес');
  String get continueLearning => pick('Davom etish', 'Продолжить');
  String get startLearning => pick("O‘rganishni boshlash", 'Начать обучение');
  String get enroll => pick("Kursga yozilish", 'Записаться на курс');
  String get subscribe => pick('Obuna bo‘lish', 'Оформить подписку');
  String get courseProgram => pick('Kurs dasturi', 'Программа курса');
  String get locked => pick('Yopiq', 'Закрыто');
  String get completed => pick('Tugallangan', 'Завершено');
  String get freePreview => pick('Bepul', 'Бесплатный');
  String get test => pick('Test', 'Тест');
  String get passed => pick('O‘tilgan', 'Пройден');
  String get notPassed => pick('O‘tilmagan', 'Не пройден');
  String get attempts => pick('urinish', 'попыток');
  String get startTest => pick('Testni boshlash', 'Начать тест');
  String get retake => pick('Qayta ishlash', 'Пройти заново');
  String get questions => pick('savol', 'вопросов');
  String get question => pick('Savol', 'Вопрос');
  String get submit => pick('Yuborish', 'Отправить');
  String get answerAll => pick('Barcha savollarga javob bering', 'Ответьте на все вопросы');
  String get testResult => pick('Test natijasi', 'Результат теста');
  String get correct => pick("To‘g‘ri", 'Верно');
  String get wrong => pick("Noto‘g‘ri", 'Неверно');
  String get score => pick('Ball', 'Баллы');
  String get passedMessage => pick("Tabriklaymiz! Testdan o‘tdingiz.", 'Поздравляем! Тест пройден.');
  String get failedMessage => pick("Testdan o‘tmadingiz. Mavzuni takrorlab, qayta urinib ko‘ring.", 'Тест не пройден. Повторите тему и попробуйте снова.');
  String get restartRequired => pick("Keyingi darsga o‘tish uchun testni qayta ishlang.", 'Чтобы перейти дальше, пройдите тест заново.');
  String get backToLesson => pick('Darsga qaytish', 'Вернуться к уроку');
  String get nextLesson => pick('Keyingi dars', 'Следующий урок');
  String get previousLesson => pick('Oldingi dars', 'Предыдущий урок');
  String get noCourses => pick('Kurslar topilmadi', 'Курсы не найдены');
  String get noLearning => pick("Hali kursga yozilmagansiz", 'Вы ещё не записаны на курсы');
  String get noNotifications => pick("Bildirishnomalar yo‘q", 'Уведомлений нет');
  String get markAllRead => pick("Hammasini o‘qilgan qilish", 'Прочитать все');
  String get retry => pick('Qayta urinish', 'Повторить');
  String get pay => pick('To‘lash', 'Оплатить');
  String get confirmed => pick('Tasdiqlangan', 'Подтверждён');
  String get loadError => pick('Ma’lumotni yuklab bo‘lmadi', 'Не удалось загрузить данные');
  String get language => pick('Til', 'Язык');
  String get theme => pick('Mavzu', 'Тема');
  String get dark => pick("Qorong‘i", 'Тёмная');
  String get light => pick('Yorug‘', 'Светлая');
  String get system => pick('Tizim', 'Системная');
  String get points => pick('Ballar', 'Баллы');
  String get rank => pick("O‘rin", 'Место');
  String get certificates => pick('Sertifikatlar', 'Сертификаты');
  String get inProgress => pick("Jarayonda", 'В процессе');
  String get enrolledCourses => pick("Yozilgan kurslar", 'Курсы');
  String get video => pick('Video', 'Видео');
  String get quality => pick('Sifat', 'Качество');
  String get speed => pick('Tezlik', 'Скорость');
  String get fullscreen => pick('To‘liq ekran', 'Полный экран');
  String get payment => pick("To‘lov", 'Оплата');
  String get selectProvider => pick("To‘lov usulini tanlang", 'Выберите способ оплаты');
  String get billingMonthly => pick('Oylik obuna', 'Месячная подписка');
  String get billingFull => pick('To‘liq kurs', 'Полный курс');
  String get paymentPending => pick("To‘lov brauzerda yakunlanadi. Yakunlagach, kursni qayta tekshiring.", 'Оплата завершается в браузере. После завершения проверьте курс снова.');
  String get sandboxConfirm => pick("Sandbox to‘lovni tasdiqlash", 'Подтвердить sandbox-платёж');
  String get paymentSuccess => pick("To‘lov muvaffaqiyatli. Kurs ochildi!", 'Оплата прошла успешно. Курс открыт!');
  String get paymentNotCompleted => pick("To‘lov hali tasdiqlanmagan.", 'Оплата ещё не подтверждена.');
  String get checkPayment => pick("To‘lovni tekshirish", 'Проверить оплату');
  String get openBrowser => pick('Brauzerda ochish', 'Открыть в браузере');
  String get aboutCourse => pick('Kurs haqida', 'О курсе');
  String get level => pick('Daraja', 'Уровень');
  String get languageLabel => pick('Til', 'Язык');
  String get duration => pick('Davomiylik', 'Длительность');
  String get minutes => pick('daqiqa', 'мин');
  String get rating => pick('Reyting', 'Рейтинг');
  String get participants => pick("Qatnashchilar", 'Участники');
  String get accessRequired => pick("Bu kursga kirish uchun obuna kerak.", 'Для доступа к этому курсу нужна подписка.');
  String get sessionExpired => pick("Sessiya tugadi. Qayta kiring.", 'Сессия истекла. Войдите снова.');
  String get beginner => pick('Boshlang‘ich', 'Начальный');
  String get intermediate => pick("O‘rta", 'Средний');
  String get advanced => pick('Yuqori', 'Продвинутый');
  String get emailNotVerified => pick("Email manzilingiz tasdiqlanmagan. Profil bo‘limida qayta yuborishingiz mumkin.", 'Email не подтверждён.');
  String get teacher => pick("O‘qituvchi", 'Преподаватель');
  String get student => pick("O‘quvchi", 'Студент');
  String get admin => pick('Administrator', 'Администратор');
  String get welcome => pick('Xush kelibsiz', 'Добро пожаловать');
  String get noVideo => pick('Bu darsda video mavjud emas', 'В этом уроке нет видео');
  String get chooseLesson => pick('Darsni tanlang', 'Выберите урок');
  String get quizLocked => pick("Avval videoni ko‘ring", 'Сначала посмотрите видео');
  String get search => pick('Qidirish', 'Поиск');
  String get close => pick('Yopish', 'Закрыть');
  String get today => pick('Bugun', 'Сегодня');
  String get yesterday => pick('Kecha', 'Вчера');
  String get progress => pick('Jarayon', 'Прогресс');
  String get certificate => pick('Sertifikat', 'Сертификат');
  String get verifyEmailSent => pick("Tasdiqlash xati yuborildi.", 'Письмо для подтверждения отправлено.');
  String get profileUpdated => pick('Profil yangilandi', 'Профиль обновлён');
  String get about => pick('Platforma haqida', 'О платформе');
  String get version => pick('Versiya', 'Версия');
  String get account => pick('Akkaunt', 'Аккаунт');
  String get notConfirmed => pick('Tasdiqlanmagan', 'Не подтверждён');
  String get resendVerification => pick('Tasdiqlash xatini qayta yuborish', 'Отправить письмо повторно');

  String greeting(String name) => ru ? 'Привет, $name' : 'Salom, $name';
  String lessonNumber(int order) => pick('${order + 1}-dars', 'Урок ${order + 1}');
  String answersCount(int total) => pick('$total ta savol', '$total вопросов');
  String outOf(int score, int total) => pick('$score / $total ball', '$score / $total баллов');
  String rankLabel(int rank) => pick('$rank-o‘rin', '$rank-е место');

  String levelLabel(String value) {
    switch (value) {
      case 'intermediate':
        return intermediate;
      case 'advanced':
        return advanced;
      default:
        return beginner;
    }
  }

  String courseLanguage(String value) {
    switch (value) {
      case 'ru':
        return 'Русский';
      case 'en':
        return 'English';
      default:
        return "O‘zbekcha";
    }
  }

  String roleLabel(String value) {
    switch (value) {
      case 'teacher':
        return teacher;
      case 'admin':
        return admin;
      default:
        return student;
    }
  }
}
