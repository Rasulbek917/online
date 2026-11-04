"""Seed a complete, realistic IT PARK ACADEMY demo environment.

The command is idempotent: it can be executed repeatedly without duplicating
records or media files. It refuses to run with DEBUG=False unless ``--force``
is provided, because demo credentials must never reach production.

Usage:
    python manage.py seed_demo
    python manage.py seed_demo --force
"""

from __future__ import annotations

import hashlib
import io
import random
import subprocess
import tempfile
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

from apps.analytics.models import (
    DailyAnalytics,
    Leaderboard,
    SystemSettings,
    Testimonial,
)
from apps.analytics.services import (
    award_points,
    compute_leaderboard,
    rebuild_daily_analytics,
)
from apps.certificates.models import Certificate
from apps.comments.models import Comment, CommentReply
from apps.courses.models import (
    Category,
    Course,
    CourseSection,
    Discount,
    Lesson,
    Video,
    VideoProgress,
)
from apps.courses.services import (
    course_progress,
    get_or_create_enrollment,
    ordered_lessons,
    refresh_course_stats,
)
from apps.payments.models import Payment
from apps.quizzes.models import AnswerOption, Question, Quiz, QuizAttempt
from apps.subscriptions.models import Subscription, activate_subscription
from apps.users.models import Profile, User

GOLD = (200, 162, 74)
NAVY = (11, 16, 32)
NAVY_SOFT = (19, 29, 56)
WHITE = (255, 255, 255)
MUTED = (170, 178, 197)

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
FONT_REGULAR = FONT_DIR / "DejaVuSans.ttf"
FONT_BOLD = FONT_DIR / "DejaVuSans-Bold.ttf"

VIDEO_SECONDS = 90

STUDENT_PASSWORD = "Student123!"
TEACHER_PASSWORD = "Teacher123!"
ADMIN_PASSWORD = "Admin123!"


def _font(size: int, bold: bool = False):
    path = FONT_BOLD if bold else FONT_REGULAR
    try:
        return ImageFont.truetype(str(path), size=size)
    except OSError:
        return ImageFont.load_default(size=size)


def _gradient(width: int, height: int, top: tuple, bottom: tuple) -> Image.Image:
    image = Image.new("RGB", (width, height), top)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3))
        draw.line([(0, y), (width, y)], fill=color)
    return image


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    words = str(text).split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _thumbnail(title: str, category: str, seed: str) -> bytes:
    width, height = 1280, 720
    palette = [
        ((10, 16, 32), (35, 49, 94)),
        ((14, 20, 38), (58, 42, 92)),
        ((8, 24, 32), (22, 72, 82)),
        ((24, 14, 30), (78, 39, 58)),
    ]
    index = int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(palette)
    top, bottom = palette[index]
    image = _gradient(width, height, top, bottom)
    draw = ImageDraw.Draw(image)

    # Decorative geometry
    draw.ellipse([width - 420, -160, width + 160, 420], fill=(255, 255, 255, 8))
    draw.ellipse([-180, height - 380, 360, height + 160], outline=GOLD, width=2)
    draw.rectangle([0, height - 10, width, height], fill=GOLD)

    draw.text((90, 96), "IT PARK ACADEMY", font=_font(34, bold=True), fill=GOLD)
    draw.text((90, 146), "PROFESSIONAL IT EDUCATION", font=_font(16), fill=MUTED)

    category_label = category.upper()
    label_font = _font(20, bold=True)
    label_width = int(draw.textlength(category_label, font=label_font)) + 44
    draw.rounded_rectangle([90, 220, 90 + label_width, 268], radius=24, fill=GOLD)
    draw.text((112, 231), category_label, font=label_font, fill=NAVY)

    title_font = _font(62, bold=True)
    lines = _wrap(draw, title, title_font, width - 220)
    y = 320
    for line in lines[:3]:
        draw.text((90, y), line, font=title_font, fill=WHITE)
        y += 78

    draw.text(
        (90, height - 92),
        "Amaliy darslar  ·  Testlar  ·  Sertifikat",
        font=_font(22),
        fill=MUTED,
    )
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=88, optimize=True)
    return buffer.getvalue()


def _avatar(name: str, seed: str) -> bytes:
    size = 320
    palette = [
        ((31, 41, 75), (78, 104, 190)),
        ((54, 32, 64), (140, 74, 128)),
        ((20, 60, 60), (44, 132, 116)),
        ((66, 42, 22), (158, 104, 42)),
    ]
    index = int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(palette)
    top, bottom = palette[index]
    image = _gradient(size, size, top, bottom)
    draw = ImageDraw.Draw(image)
    initials = "".join(part[0] for part in name.split()[:2]).upper() or "IP"
    font = _font(120, bold=True)
    bbox = draw.textbbox((0, 0), initials, font=font)
    x = (size - (bbox[2] - bbox[0])) / 2 - bbox[0]
    y = (size - (bbox[3] - bbox[1])) / 2 - bbox[1]
    draw.text((x, y), initials, font=font, fill=WHITE)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def _video_frame(title: str, category: str) -> bytes:
    width, height = 640, 360
    image = _gradient(width, height, (10, 16, 32), (30, 44, 86))
    draw = ImageDraw.Draw(image)
    draw.rectangle([0, height - 6, width, height], fill=GOLD)
    draw.text((40, 42), "IT PARK ACADEMY", font=_font(18, bold=True), fill=GOLD)
    draw.text((40, 70), category.upper(), font=_font(12), fill=MUTED)
    title_font = _font(30, bold=True)
    lines = _wrap(draw, title, title_font, width - 80)
    y = 150
    for line in lines[:3]:
        draw.text((40, y), line, font=title_font, fill=WHITE)
        y += 40
    draw.text((40, height - 46), "Demo lesson · IT PARK ACADEMY", font=_font(12), fill=MUTED)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _render_video(frame_png: bytes) -> bytes:
    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory() as tmp:
        frame_path = Path(tmp) / "frame.png"
        output_path = Path(tmp) / "lesson.mp4"
        frame_path.write_bytes(frame_png)
        command = [
            ffmpeg,
            "-y",
            "-loop",
            "1",
            "-i",
            str(frame_path),
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-t",
            str(VIDEO_SECONDS),
            "-r",
            "12",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-tune",
            "stillimage",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "48k",
            "-movflags",
            "+faststart",
            "-shortest",
            str(output_path),
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            raise CommandError(f"ffmpeg failed: {result.stderr[-800:]}")
        return output_path.read_bytes()


# ---------------------------------------------------------------------------
# Content blueprints
# ---------------------------------------------------------------------------

CATEGORIES = [
    ("Dasturlash", "Программирование", "code", "Dasturlash asoslari va algoritmlar", "Основы программирования и алгоритмы"),
    ("Frontend", "Фронтенд", "layout", "Web interfeyslar yaratish", "Создание веб-интерфейсов"),
    ("Backend", "Бэкенд", "server", "Server va API dasturlash", "Серверная разработка и API"),
    ("Mobil dasturlash", "Мобильная разработка", "smartphone", "Android va iOS ilovalar", "Приложения для Android и iOS"),
    ("Ma'lumotlar bazasi", "Базы данных", "database", "Ma'lumotlar bilan professional ishlash", "Профессиональная работа с данными"),
    ("Sun'iy intellekt", "Искусственный интеллект", "brain", "Machine learning va AI", "Машинное обучение и ИИ"),
    ("Dizayn", "Дизайн", "palette", "UI/UX va product dizayn", "UI/UX и продуктовый дизайн"),
    ("Kiberxavfsizlik", "Кибербезопасность", "shield", "Tizimlar va ma'lumotlar xavfsizligi", "Безопасность систем и данных"),
    ("DevOps", "DevOps", "cloud", "CI/CD, konteynerlar va infratuzilma", "CI/CD, контейнеры и инфраструктура"),
]


COURSES = [
    {
        "title": ("Python asoslari", "Основы Python"),
        "category": "dasturlash",
        "level": "beginner",
        "free": False,
        "price": 2490000,
        "monthly": 299000,
        "featured": True,
        "short": (
            "Noldan Python o'rganing: sintaksis, ma'lumot turlari va amaliy loyihalar.",
            "Изучите Python с нуля: синтаксис, типы данных и практические проекты.",
        ),
        "description": (
            "Kurs Python tilini noldan boshlab o'rgatadi. Har bir dars amaliy kod yozish, "
            "mustaqil topshiriq va nazorat testidan iborat. Kurs yakunida siz mustaqil "
            "ravishda kichik dasturlar va avtomatlashtirish skriptlari yoza olasiz.",
            "Курс обучает Python с нуля. Каждый урок включает практическое программирование, "
            "самостоятельное задание и тест. В конце вы сможете писать небольшие программы "
            "и скрипты автоматизации.",
        ),
        "sections": [
            (
                ("Kirish va muhit", "Введение и среда"),
                [
                    ("Python nima?", "Что такое Python?"),
                    ("O'rnatish va VS Code", "Установка и VS Code"),
                    ("Birinchi dastur", "Первая программа"),
                ],
            ),
            (
                ("Asosiy tushunchalar", "Основные концепции"),
                [
                    ("O'zgaruvchilar va turlar", "Переменные и типы"),
                    ("Shartlar va sikllar", "Условия и циклы"),
                    ("Funksiyalar", "Функции"),
                ],
            ),
        ],
    },
    {
        "title": ("JavaScript va React", "JavaScript и React"),
        "category": "frontend",
        "level": "intermediate",
        "free": False,
        "price": 2990000,
        "monthly": 349000,
        "featured": True,
        "short": (
            "Zamonaviy web interfeyslar: JavaScript, React, hooklar va real loyiha.",
            "Современные веб-интерфейсы: JavaScript, React, хуки и реальный проект.",
        ),
        "description": (
            "Kurs JavaScript asoslaridan boshlanib, React bilan komponentli arxitekturaga "
            "o'tadi. State, props, hooklar, routing va API bilan ishlash amaliy loyihada "
            "mustahkamlanadi.",
            "Курс начинается с основ JavaScript и переходит к компонентной архитектуре React. "
            "State, props, хуки, роутинг и работа с API закрепляются в практическом проекте.",
        ),
        "sections": [
            (
                ("JavaScript asoslari", "Основы JavaScript"),
                [
                    ("O'zgaruvchilar va scope", "Переменные и scope"),
                    ("Massivlar va obyektlar", "Массивы и объекты"),
                    ("DOM va eventlar", "DOM и события"),
                ],
            ),
            (
                ("React kirish", "Введение в React"),
                [
                    ("Komponentlar va JSX", "Компоненты и JSX"),
                    ("State va props", "State и props"),
                    ("Hooklar amaliyotda", "Хуки на практике"),
                ],
            ),
        ],
    },
    {
        "title": ("Django REST API", "Django REST API"),
        "category": "backend",
        "level": "intermediate",
        "free": False,
        "price": 3490000,
        "monthly": 399000,
        "featured": True,
        "short": (
            "Django va DRF bilan ishonchli, xavfsiz va hujjatlashtirilgan API quring.",
            "Создавайте надёжные, безопасные и документированные API на Django и DRF.",
        ),
        "description": (
            "Kurs Django loyihasini sozlashdan boshlab, modellar, migratsiyalar, serializerlar, "
            "ViewSetlar, JWT autentifikatsiya va testlarga qadar to'liq backend yo'lini qamrab oladi.",
            "Курс охватывает полный путь backend-разработчика: настройка проекта Django, модели, "
            "миграции, сериализаторы, ViewSet, JWT-аутентификация и тесты.",
        ),
        "sections": [
            (
                ("Django asoslari", "Основы Django"),
                [
                    ("Loyiha va app", "Проект и приложение"),
                    ("Modellar va migratsiyalar", "Модели и миграции"),
                    ("Admin panel", "Админ-панель"),
                ],
            ),
            (
                ("REST API", "REST API"),
                [
                    ("Serializerlar", "Сериализаторы"),
                    ("ViewSet va router", "ViewSet и router"),
                    ("Autentifikatsiya va JWT", "Аутентификация и JWT"),
                ],
            ),
        ],
    },
    {
        "title": ("Flutter mobil dasturlash", "Мобильная разработка на Flutter"),
        "category": "mobil-dasturlash",
        "level": "beginner",
        "free": False,
        "price": 2990000,
        "monthly": 349000,
        "featured": False,
        "short": (
            "Bitta kod bazasidan Android va iOS uchun native ilova yarating.",
            "Создавайте нативные приложения для Android и iOS из одной кодовой базы.",
        ),
        "description": (
            "Kurs Dart tili, Flutter widgetlari, layout, navigatsiya va REST API bilan ishlashni "
            "o'rgatadi. Yakunda real API'ga ulangan mobil ilova yaratasiz.",
            "Курс обучает языку Dart, widget-ам Flutter, layout, навигации и работе с REST API. "
            "В конце вы создадите мобильное приложение, подключённое к реальному API.",
        ),
        "sections": [
            (
                ("Dart tili", "Язык Dart"),
                [
                    ("Dart asoslari", "Основы Dart"),
                    ("OOP tushunchalari", "Концепции ООП"),
                    ("Asinxron kod", "Асинхронный код"),
                ],
            ),
            (
                ("Flutter UI", "Flutter UI"),
                [
                    ("Widget tushunchasi", "Понятие widget"),
                    ("Layout va navigatsiya", "Layout и навигация"),
                    ("API bilan ishlash", "Работа с API"),
                ],
            ),
        ],
    },
    {
        "title": ("PostgreSQL ma'lumotlar bazasi", "Базы данных PostgreSQL"),
        "category": "malumotlar-bazasi",
        "level": "intermediate",
        "free": False,
        "price": 1990000,
        "monthly": 249000,
        "featured": False,
        "short": (
            "SQL so'rovlari, indekslar, tranzaksiyalar va so'rovlarni optimallashtirish.",
            "SQL-запросы, индексы, транзакции и оптимизация запросов.",
        ),
        "description": (
            "Kurs relatsion ma'lumotlar bazalari bilan ishlashni chuqur o'rgatadi: jadvallar, "
            "SELECT/JOIN so'rovlari, indekslar, tranzaksiyalar va ishlashni optimallashtirish.",
            "Курс глубоко обучает работе с реляционными базами: таблицы, запросы SELECT/JOIN, "
            "индексы, транзакции и оптимизация производительности.",
        ),
        "sections": [
            (
                ("SQL asoslari", "Основы SQL"),
                [
                    ("Jadvallar va turlar", "Таблицы и типы"),
                    ("SELECT so'rovlari", "Запросы SELECT"),
                    ("JOIN turlari", "Виды JOIN"),
                ],
            ),
            (
                ("Ilg'or mavzular", "Продвинутые темы"),
                [
                    ("Indekslar", "Индексы"),
                    ("Tranzaksiyalar", "Транзакции"),
                    ("Optimizatsiya", "Оптимизация"),
                ],
            ),
        ],
    },
    {
        "title": ("Sun'iy intellekt asoslari", "Основы искусственного интеллекта"),
        "category": "suniy-intellekt",
        "level": "advanced",
        "free": False,
        "price": 3990000,
        "monthly": 449000,
        "featured": True,
        "short": (
            "Machine learning, neyron tarmoqlar va NLP bo'yicha amaliy kurs.",
            "Практический курс по машинному обучению, нейросетям и NLP.",
        ),
        "description": (
            "Kurs AI asoslaridan boshlab chiziqli regressiya, neyron tarmoqlar, NLP va model "
            "baholashgacha bo'lgan yo'lni qamrab oladi. Har bir mavzu Python amaliyoti bilan "
            "mustahkamlanadi.",
            "Курс охватывает путь от основ ИИ до линейной регрессии, нейросетей, NLP и оценки "
            "моделей. Каждая тема закрепляется практикой на Python.",
        ),
        "sections": [
            (
                ("Kirish", "Введение"),
                [
                    ("AI tushunchasi", "Понятие ИИ"),
                    ("Ma'lumotlar bilan ishlash", "Работа с данными"),
                    ("Chiziqli regressiya", "Линейная регрессия"),
                ],
            ),
            (
                ("Amaliyot", "Практика"),
                [
                    ("Neyron tarmoqlar", "Нейронные сети"),
                    ("NLP asoslari", "Основы NLP"),
                    ("Modelni baholash", "Оценка модели"),
                ],
            ),
        ],
    },
    {
        "title": ("UI/UX dizayn", "UI/UX дизайн"),
        "category": "dizayn",
        "level": "beginner",
        "free": False,
        "price": 2490000,
        "monthly": 299000,
        "featured": False,
        "short": (
            "Figma'da zamonaviy interfeys va foydalanuvchi tajribasini loyihalash.",
            "Проектирование современных интерфейсов и пользовательского опыта в Figma.",
        ),
        "description": (
            "Kurs dizayn tafakkuridan boshlab rang, tipografiya, kompozitsiya, Figma, prototiplash "
            "va design system yaratishgacha bo'lgan amaliy ko'nikmalarni beradi.",
            "Курс даёт практические навыки от дизайн-мышления до цвета, типографики, композиции, "
            "Figma, прототипирования и создания design system.",
        ),
        "sections": [
            (
                ("Dizayn asoslari", "Основы дизайна"),
                [
                    ("Dizayn tafakkuri", "Дизайн-мышление"),
                    ("Rang va tipografiya", "Цвет и типографика"),
                    ("Kompozitsiya", "Композиция"),
                ],
            ),
            (
                ("Figma", "Figma"),
                [
                    ("Figma interfeysi", "Интерфейс Figma"),
                    ("Prototiplash", "Прототипирование"),
                    ("Design system", "Design system"),
                ],
            ),
        ],
    },
    {
        "title": ("Kiberxavfsizlik asoslari", "Основы кибербезопасности"),
        "category": "kiberxavfsizlik",
        "level": "advanced",
        "free": True,
        "price": 0,
        "monthly": 0,
        "featured": False,
        "short": (
            "Bepul kirish kursi: parollar, tarmoq xavfsizligi va web zaifliklari.",
            "Бесплатный вводный курс: пароли, сетевая безопасность и веб-уязвимости.",
        ),
        "description": (
            "Bepul kursda kiberxavfsizlik asoslari, autentifikatsiya, tarmoq himoyasi, web "
            "zaifliklari, shifrlash va incidentga javob berish amaliyotlari o'rgatiladi.",
            "Бесплатный курс по основам кибербезопасности, аутентификации, защите сети, "
            "веб-уязвимостям, шифрованию и реагированию на инциденты.",
        ),
        "sections": [
            (
                ("Asoslar", "Основы"),
                [
                    ("Xavfsizlik tushunchasi", "Понятие безопасности"),
                    ("Parol va autentifikatsiya", "Пароли и аутентификация"),
                    ("Tarmoq xavfsizligi", "Сетевая безопасность"),
                ],
            ),
            (
                ("Amaliyot", "Практика"),
                [
                    ("Web zaifliklari", "Веб-уязвимости"),
                    ("Shifrlash", "Шифрование"),
                    ("Incidentga javob", "Реагирование на инциденты"),
                ],
            ),
        ],
    },
]


def F(q_uz, q_ru, correct_uz, correct_ru, w1_uz, w1_ru, w2_uz, w2_ru, w3_uz, w3_ru, exp_uz="", exp_ru=""):
    return {
        "q": (q_uz, q_ru),
        "correct": (correct_uz, correct_ru),
        "wrong": [(w1_uz, w1_ru), (w2_uz, w2_ru), (w3_uz, w3_ru)],
        "explanation": (exp_uz or correct_uz, exp_ru or correct_ru),
    }


QUIZ_BANK = {
    "python-asoslari": [
        F("Python qanday til hisoblanadi?", "Каким языком является Python?", "Talqin qilinadigan (interpreted)", "Интерпретируемый", "Kompilyatsiya qilinadigan", "Компилируемый", "Belgilash tili", "Язык разметки", "Mashina tili", "Машинный язык"),
        F("Ro'yxat (list) qanday qavslar bilan yoziladi?", "Какими скобками записывается список (list)?", "Kvadrat qavslar [ ]", "Квадратные скобки [ ]", "Dumaloq qavslar ( )", "Круглые скобки ( )", "Jingalak qavslar { }", "Фигурные скобки { }", "Burchakli qavslar < >", "Угловые скобки < >"),
        F("len() funksiyasi nima qaytaradi?", "Что возвращает функция len()?", "Elementlar sonini", "Количество элементов", "Oxirgi elementni", "Последний элемент", "Birinchi elementni", "Первый элемент", "Turi nomini", "Имя типа"),
        F("Siklni erta to'xtatish uchun qaysi operator ishlatiladi?", "Какой оператор прерывает цикл досрочно?", "break", "break", "continue", "continue", "pass", "pass", "return", "return"),
        F("Funksiya qaysi kalit so'z bilan e'lon qilinadi?", "Каким ключевым словом объявляется функция?", "def", "def", "func", "func", "function", "function", "lambda", "lambda"),
        F("Python'da bir qatorli izoh qaysi belgi bilan boshlanadi?", "Каким символом начинается однострочный комментарий в Python?", "#", "#", "//", "//", "/*", "/*", "--", "--"),
        F("True va False qaysi ma'lumot turiga kiradi?", "К какому типу данных относятся True и False?", "bool", "bool", "int", "int", "str", "str", "float", "float"),
        F("Faylni ochish uchun qaysi funksiya ishlatiladi?", "Какая функция используется для открытия файла?", "open()", "open()", "file()", "file()", "read()", "read()", "load()", "load()"),
        F("pip nima uchun ishlatiladi?", "Для чего используется pip?", "Python paketlarini o'rnatish uchun", "Для установки пакетов Python", "Kodni formatlash uchun", "Для форматирования кода", "Serverni ishga tushirish uchun", "Для запуска сервера", "Bazaga ulanish uchun", "Для подключения к базе"),
        F("JSON bilan ishlash uchun Python'da qaysi standart modul bor?", "Какой стандартный модуль Python работает с JSON?", "json", "json", "csv", "csv", "http", "http", "socket", "socket"),
    ],
    "javascript-va-react": [
        F("JavaScript'da o'zgaruvchi e'lon qilish kalit so'zlari qaysilar?", "Какие ключевые слова объявляют переменные в JavaScript?", "let va const", "let и const", "def va var", "def и var", "int va string", "int и string", "public va private", "public и private"),
        F("React komponenti nima?", "Что такое компонент React?", "Interfeysning qayta ishlatiladigan qismi", "Переиспользуемая часть интерфейса", "Ma'lumotlar bazasi jadvali", "Таблица базы данных", "Server konfiguratsiyasi", "Конфигурация сервера", "CSS fayli", "CSS-файл"),
        F("JSX nima?", "Что такое JSX?", "JavaScript ichidagi HTMLga o'xshash sintaksis", "HTML-подобный синтаксис внутри JavaScript", "Yangi ma'lumot turi", "Новый тип данных", "CSS preprocessor", "CSS-препроцессор", "Test freymvorki", "Тестовый фреймворк"),
        F("useState nimani qaytaradi?", "Что возвращает useState?", "Holat va uni yangilovchi funksiya", "Состояние и функцию его обновления", "Faqat son", "Только число", "Router obyekti", "Объект router", "Promise", "Promise"),
        F("Ro'yxatni render qilishda qaysi prop majburiy tavsiya etiladi?", "Какой prop рекомендуется при рендере списка?", "key", "key", "id", "id", "name", "name", "ref", "ref"),
        F("useEffect nima uchun ishlatiladi?", "Для чего используется useEffect?", "Yon effektlar uchun", "Для побочных эффектов", "Stillar uchun", "Для стилей", "Marshrutlash uchun", "Для маршрутизации", "Formani validatsiya qilish uchun", "Для валидации формы"),
        F("=== operatori nimani tekshiradi?", "Что проверяет оператор ===?", "Qiymat va turni", "Значение и тип", "Faqat qiymatni", "Только значение", "Faqat uzunlikni", "Только длину", "Xotira manzilini", "Адрес памяти"),
        F("React Router nima uchun ishlatiladi?", "Для чего используется React Router?", "Sahifalar orasida navigatsiya uchun", "Для навигации между страницами", "API so'rovlari uchun", "Для API-запросов", "Test yozish uchun", "Для написания тестов", "Baza bilan ishlash uchun", "Для работы с базой"),
        F("Props nima?", "Что такое props?", "Ota komponentdan uzatiladigan ma'lumot", "Данные, передаваемые от родительского компонента", "Global o'zgaruvchi", "Глобальная переменная", "CSS klassi", "CSS-класс", "Server funksiyasi", "Серверная функция"),
        F("Massiv oxiriga element qo'shish metodi qaysi?", "Какой метод добавляет элемент в конец массива?", "push()", "push()", "pop()", "pop()", "shift()", "shift()", "slice()", "slice()"),
    ],
    "django-rest-api": [
        F("Django loyihasi qaysi buyruq bilan yaratiladi?", "Какой командой создаётся проект Django?", "django-admin startproject", "django-admin startproject", "django-admin newproject", "django-admin newproject", "python manage.py startproject", "python manage.py startproject", "django create project", "django create project"),
        F("Migratsiyalarni qo'llash buyrug'i qaysi?", "Какая команда применяет миграции?", "python manage.py migrate", "python manage.py migrate", "python manage.py makemigrations", "python manage.py makemigrations", "python manage.py collectstatic", "python manage.py collectstatic", "python manage.py runserver", "python manage.py runserver"),
        F("Model qaysi sinfdan meros oladi?", "От какого класса наследуется модель?", "models.Model", "models.Model", "models.Base", "models.Base", "models.Table", "models.Table", "models.Record", "models.Record"),
        F("Serializer asosan nima qiladi?", "Что в основном делает сериализатор?", "Obyektni JSONga aylantiradi va validatsiya qiladi", "Преобразует объект в JSON и валидирует", "HTML sahifa yaratadi", "Создаёт HTML-страницу", "Migratsiya yozadi", "Пишет миграции", "Serverni ishga tushiradi", "Запускает сервер"),
        F("DRF'da ViewSetni marshrutlash uchun nima ishlatiladi?", "Что используется для маршрутизации ViewSet в DRF?", "Router", "Router", "Template", "Template", "Middleware", "Middleware", "Signal", "Signal"),
        F("JWT token odatda nimani saqlaydi?", "Что обычно хранит JWT-токен?", "Foydalanuvchi identifikatori va claimlarni", "Идентификатор пользователя и claims", "Parolni ochiq holda", "Пароль в открытом виде", "Ma'lumotlar bazasini", "Базу данных", "Statik fayllarni", "Статические файлы"),
        F("Barcha yozuvlarni olish uchun ORM ifodasi qaysi?", "Какое ORM-выражение получает все записи?", "Model.objects.all()", "Model.objects.all()", "Model.all()", "Model.all()", "Model.objects.get()", "Model.objects.get()", "Model.filter()", "Model.filter()"),
        F("ForeignKey nimani bog'laydi?", "Что связывает ForeignKey?", "Ikki model o'rtasidagi bog'lanishni", "Связь между двумя моделями", "Ikki viewni", "Два view", "Ikki templateni", "Два шаблона", "Ikki tokenni", "Два токена"),
        F("Django admin panel odatda qaysi URL'da joylashadi?", "По какому URL обычно доступна админ-панель Django?", "/admin/", "/admin/", "/panel/", "/panel/", "/dashboard/", "/dashboard/", "/manage/", "/manage/"),
        F("STATIC_ROOT nima uchun kerak?", "Для чего нужен STATIC_ROOT?", "Statik fayllarni yig'ish uchun", "Для сбора статических файлов", "Media fayllar uchun", "Для media-файлов", "Migratsiyalar uchun", "Для миграций", "Loglar uchun", "Для логов"),
    ],
    "flutter-mobil-dasturlash": [
        F("Flutter qaysi til bilan ishlaydi?", "С каким языком работает Flutter?", "Dart", "Dart", "Java", "Java", "Kotlin", "Kotlin", "Swift", "Swift"),
        F("Flutter'da UI elementi qanday nomlanadi?", "Как называется элемент UI во Flutter?", "Widget", "Widget", "View", "View", "Component", "Component", "Element", "Element"),
        F("StatelessWidget qachon ishlatiladi?", "Когда используется StatelessWidget?", "Holati o'zgarmaydigan UI uchun", "Для UI без изменяемого состояния", "Faqat animatsiya uchun", "Только для анимации", "Faqat API uchun", "Только для API", "Faqat bazaga yozish uchun", "Только для записи в базу"),
        F("StatefulWidget holatni qayerda saqlaydi?", "Где StatefulWidget хранит состояние?", "State obyektida", "В объекте State", "main.dart faylida", "В файле main.dart", "pubspec.yaml ichida", "Внутри pubspec.yaml", "Widget konstruktorida", "В конструкторе Widget"),
        F("Elementlarni vertikal joylashtirish uchun qaysi widget ishlatiladi?", "Какой widget располагает элементы вертикально?", "Column", "Column", "Row", "Row", "Stack", "Stack", "Wrap", "Wrap"),
        F("Sahifalar o'rtasida o'tish uchun nima ishlatiladi?", "Что используется для перехода между экранами?", "Navigator", "Navigator", "Router", "Router", "Builder", "Builder", "Scaffold", "Scaffold"),
        F("HTTP so'rovlar uchun qaysi paket keng qo'llaniladi?", "Какой пакет часто используется для HTTP-запросов?", "http", "http", "dio_http_only", "dio_http_only", "webview", "webview", "sqlite", "sqlite"),
        F("Hot reload nima beradi?", "Что даёт hot reload?", "Kod o'zgarishini tez ko'rish imkonini", "Быстрый просмотр изменений кода", "APK'ni avtomatik yuklashni", "Автозагрузку APK", "Bazani tozalashni", "Очистку базы", "Testlarni o'chirishni", "Отключение тестов"),
        F("FutureBuilder nima uchun ishlatiladi?", "Для чего используется FutureBuilder?", "Asinxron ma'lumotni UI'da ko'rsatish uchun", "Для отображения асинхронных данных", "Faylni shifrlash uchun", "Для шифрования файла", "Rangni o'zgartirish uchun", "Для изменения цвета", "APK yig'ish uchun", "Для сборки APK"),
        F("Flutter loyihasini ishga tushirish buyrug'i qaysi?", "Какая команда запускает проект Flutter?", "flutter run", "flutter run", "flutter build", "flutter build", "dart start", "dart start", "flutter start", "flutter start"),
    ],
    "postgresql-malumotlar-bazasi": [
        F("PostgreSQL qanday turdagi ma'lumotlar bazasi?", "Каким типом СУБД является PostgreSQL?", "Relatsion", "Реляционная", "Hujjatga asoslangan", "Документная", "Graf", "Графовая", "Kalit-qiymat", "Ключ-значение"),
        F("Jadval yaratish uchun qaysi buyruq ishlatiladi?", "Какая команда создаёт таблицу?", "CREATE TABLE", "CREATE TABLE", "MAKE TABLE", "MAKE TABLE", "NEW TABLE", "NEW TABLE", "ADD TABLE", "ADD TABLE"),
        F("Ma'lumot olish uchun qaysi buyruq ishlatiladi?", "Какая команда извлекает данные?", "SELECT", "SELECT", "GET", "GET", "FETCH", "FETCH", "SHOW", "SHOW"),
        F("Yozuvlarni shart bo'yicha filtrlash uchun nima ishlatiladi?", "Что используется для фильтрации записей?", "WHERE", "WHERE", "FILTER", "FILTER", "HAVING", "HAVING", "ORDER", "ORDER"),
        F("Jadvallarni birlashtirish uchun qaysi operator ishlatiladi?", "Какой оператор объединяет таблицы?", "JOIN", "JOIN", "MERGE", "MERGE", "LINK", "LINK", "COMBINE", "COMBINE"),
        F("Indeks nima qiladi?", "Что делает индекс?", "Qidiruvni tezlashtiradi", "Ускоряет поиск", "Jadvalni o'chiradi", "Удаляет таблицу", "Ma'lumotni shifrlaydi", "Шифрует данные", "Foydalanuvchi yaratadi", "Создаёт пользователя"),
        F("Tranzaksiyani yakunlash uchun qaysi buyruq ishlatiladi?", "Какая команда завершает транзакцию?", "COMMIT", "COMMIT", "END", "END", "STOP", "STOP", "CLOSE", "CLOSE"),
        F("PRIMARY KEY nima?", "Что такое PRIMARY KEY?", "Yozuvni noyob identifikatsiya qiluvchi kalit", "Ключ, уникально идентифицирующий запись", "Jadval nomi", "Имя таблицы", "Fayl yo'li", "Путь к файлу", "Indeks turi", "Тип индекса"),
        F("NULL qiymati nimani bildiradi?", "Что означает значение NULL?", "Qiymat yo'qligini", "Отсутствие значения", "Nolni", "Ноль", "Bo'sh satrni", "Пустую строку", "False qiymatni", "Значение False"),
        F("LIMIT nima qiladi?", "Что делает LIMIT?", "Natijalar sonini cheklaydi", "Ограничивает количество результатов", "Jadvalni qulflaydi", "Блокирует таблицу", "Ustun qo'shadi", "Добавляет столбец", "Bazani yaratadi", "Создаёт базу"),
    ],
    "suniy-intellekt-asoslari": [
        F("Sun'iy intellekt nima?", "Что такое искусственный интеллект?", "Mashinalar orqali aqlli vazifalarni bajarish", "Выполнение интеллектуальных задач машинами", "Faqat robotlar yasash", "Только создание роботов", "Ma'lumotlar bazasi turi", "Тип базы данных", "Operatsion tizim", "Операционная система"),
        F("Supervised learning nima?", "Что такое supervised learning?", "Belgilangan (labeled) ma'lumotlar bilan o'qitish", "Обучение на размеченных данных", "Belgilanmagan ma'lumot bilan o'qitish", "Обучение без меток", "Faqat test qilish", "Только тестирование", "Ma'lumot yig'ish", "Сбор данных"),
        F("Chiziqli regressiya nimani bashorat qiladi?", "Что предсказывает линейная регрессия?", "Uzluksiz son qiymatni", "Непрерывное числовое значение", "Faqat klassni", "Только класс", "Matnni", "Текст", "Rasmni", "Изображение"),
        F("Overfitting nima?", "Что такое переобучение (overfitting)?", "Model o'quv ma'lumotiga haddan tashqari moslashishi", "Чрезмерная подстройка модели под обучающие данные", "Model juda tez ishlashi", "Слишком быстрая работа модели", "Ma'lumot yo'qligi", "Отсутствие данных", "Grafik xatosi", "Ошибка графика"),
        F("Neyron tarmoqning asosiy elementi nima?", "Что является основным элементом нейросети?", "Neyron (qatlam)", "Нейрон (слой)", "Jadval", "Таблица", "Fayl", "Файл", "Router", "Router"),
        F("NLP qaysi soha bilan ishlaydi?", "С какой областью работает NLP?", "Tabiiy til bilan", "С естественным языком", "Rasmlar bilan", "С изображениями", "Tovush bilan", "Со звуком", "Tarmoq bilan", "С сетью"),
        F("Trening va test to'plamlari nima uchun ajratiladi?", "Зачем разделяют train и test наборы?", "Modelni xolis baholash uchun", "Для объективной оценки модели", "Faylni kichraytirish uchun", "Для уменьшения файла", "Kodni tezlashtirish uchun", "Для ускорения кода", "Rangni tanlash uchun", "Для выбора цвета"),
        F("Accuracy nimani o'lchaydi?", "Что измеряет accuracy?", "To'g'ri bashoratlar ulushini", "Долю правильных предсказаний", "Model hajmini", "Размер модели", "O'qitish vaqtini", "Время обучения", "Xotira sarfini", "Расход памяти"),
        F("Gradient descent nima qiladi?", "Что делает градиентный спуск?", "Xatoni kamaytirish uchun parametrlarni yangilaydi", "Обновляет параметры для уменьшения ошибки", "Ma'lumotni o'chiradi", "Удаляет данные", "Grafik chizadi", "Рисует график", "Serverni ishga tushiradi", "Запускает сервер"),
        F("Feature nima?", "Что такое признак (feature)?", "Modelga kiruvchi belgi", "Входной признак модели", "Chiqish natijasi", "Выходной результат", "Xatolik turi", "Тип ошибки", "Kutubxona nomi", "Имя библиотеки"),
    ],
    "uiux-dizayn": [
        F("UX nimani anglatadi?", "Что означает UX?", "Foydalanuvchi tajribasi", "Пользовательский опыт", "Universal XML", "Universal XML", "User Extension", "User Extension", "Unique Experience", "Unique Experience"),
        F("UI nima?", "Что такое UI?", "Foydalanuvchi interfeysi", "Пользовательский интерфейс", "Ichki indeks", "Внутренний индекс", "Internet uzeli", "Интернет-узел", "Unit interval", "Unit interval"),
        F("Kontrast nima uchun muhim?", "Почему важен контраст?", "Matn o'qilishini yaxshilash uchun", "Для улучшения читаемости текста", "Faylni kichraytirish uchun", "Для уменьшения файла", "Ranglar sonini kamaytirish uchun", "Для уменьшения числа цветов", "Animatsiyani tezlashtirish uchun", "Для ускорения анимации"),
        F("Figma nima?", "Что такое Figma?", "Dizayn va prototiplash vositasi", "Инструмент дизайна и прототипирования", "Ma'lumotlar bazasi", "База данных", "Dasturlash tili", "Язык программирования", "Server", "Сервер"),
        F("Prototip nima?", "Что такое прототип?", "Interaktiv maket", "Интерактивный макет", "Yakuniy mahsulot", "Финальный продукт", "Server konfiguratsiyasi", "Конфигурация сервера", "Test hisoboti", "Отчёт тестов"),
        F("Design system nima?", "Что такое design system?", "Qayta ishlatiladigan komponent va qoidalar to'plami", "Набор переиспользуемых компонентов и правил", "Faqat ranglar ro'yxati", "Только список цветов", "Faqat shrift fayli", "Только файл шрифта", "Server arxitekturasi", "Архитектура сервера"),
        F("Tipografiya nimani boshqaradi?", "Что регулирует типографика?", "Shrift va matn ko'rinishini", "Шрифт и внешний вид текста", "Rasm sifatini", "Качество изображения", "Tarmoq tezligini", "Скорость сети", "Fayl hajmini", "Размер файла"),
        F("User flow nima?", "Что такое user flow?", "Foydalanuvchi harakatlari ketma-ketligi", "Последовательность действий пользователя", "Ranglar palitrasi", "Палитра цветов", "Komponentlar soni", "Количество компонентов", "Shrift o'lchami", "Размер шрифта"),
        F("Accessibility nimani ta'minlaydi?", "Что обеспечивает accessibility?", "Barcha foydalanuvchilar uchun qulaylik", "Удобство для всех пользователей", "Faqat tezlikni", "Только скорость", "Faqat xavfsizlikni", "Только безопасность", "Faqat dizaynni", "Только дизайн"),
        F("Grid nima?", "Что такое grid?", "Joylashuv tizimi", "Система сетки", "Rang turi", "Тип цвета", "Animatsiya", "Анимация", "Shrift turi", "Тип шрифта"),
    ],
    "kiberxavfsizlik-asoslari": [
        F("Kiberxavfsizlik nima?", "Что такое кибербезопасность?", "Tizim va ma'lumotlarni himoya qilish", "Защита систем и данных", "Faqat antivirus o'rnatish", "Только установка антивируса", "Faqat parol yaratish", "Только создание пароля", "Faqat tarmoq qurish", "Только построение сети"),
        F("Kuchli parol qanday bo'lishi kerak?", "Каким должен быть надёжный пароль?", "Uzun va turli belgilardan tuzilgan", "Длинным и из разных символов", "Faqat ism", "Только имя", "Faqat raqamlar", "Только цифры", "12345678", "12345678"),
        F("2FA nima?", "Что такое 2FA?", "Ikki bosqichli autentifikatsiya", "Двухфакторная аутентификация", "Ikki fayl arxivi", "Архив из двух файлов", "Ikki tarmoq", "Две сети", "Ikki parol fayli", "Файл с двумя паролями"),
        F("Phishing nima?", "Что такое фишинг?", "Aldash orqali maxfiy ma'lumot olish", "Получение секретных данных обманом", "Tarmoqni tezlashtirish", "Ускорение сети", "Faylni shifrlash", "Шифрование файла", "Serverni yangilash", "Обновление сервера"),
        F("Shifrlash nima qiladi?", "Что делает шифрование?", "Ma'lumotni ruxsatsiz o'qilmaydigan qiladi", "Делает данные недоступными для чтения без разрешения", "Faylni o'chiradi", "Удаляет файл", "Tarmoqni to'xtatadi", "Останавливает сеть", "Parolni o'zgartiradi", "Меняет пароль"),
        F("Firewall nima?", "Что такое firewall?", "Tarmoq trafigini filtrlash tizimi", "Система фильтрации сетевого трафика", "Ma'lumotlar bazasi", "База данных", "Dasturlash tili", "Язык программирования", "Brauzer", "Браузер"),
        F("SQL injection qanday oldini olinadi?", "Как предотвратить SQL-инъекцию?", "Parametrlangan so'rovlar orqali", "С помощью параметризованных запросов", "Parolni qisqartirish orqali", "Сокращением пароля", "Faylni o'chirish orqali", "Удалением файла", "Keshni tozalash orqali", "Очисткой кэша"),
        F("HTTPS nimani ta'minlaydi?", "Что обеспечивает HTTPS?", "Shifrlangan aloqa", "Зашифрованное соединение", "Tezroq internet", "Более быстрый интернет", "Fayl saqlash", "Хранение файлов", "Avtomatik zaxira", "Автоматический бэкап"),
        F("VPN nima?", "Что такое VPN?", "Xavfsiz shifrlangan tunnel", "Безопасный зашифрованный туннель", "Yangi brauzer", "Новый браузер", "Antivirus dasturi", "Антивирус", "Ma'lumotlar bazasi", "База данных"),
        F("Zaiflik (vulnerability) nima?", "Что такое уязвимость?", "Himoyadagi kamchilik", "Недостаток в защите", "Dastur tezligi", "Скорость программы", "Ma'lumot hajmi", "Объём данных", "Dizayn uslubi", "Стиль дизайна"),
    ],
}


STUDENTS = [
    ("student@itparkacademy.uz", "Rasulbek", "Tursunov", "uz", "Toshkent", "Frontend dasturchi bo'lish yo'lida"),
    ("aziz@itparkacademy.uz", "Aziz", "Karimov", "uz", "Samarqand", "Python va backend dasturlash"),
    ("malika@itparkacademy.uz", "Malika", "Yusupova", "ru", "Toshkent", "Product dizayner"),
    ("jasur@itparkacademy.uz", "Jasur", "Rahimov", "uz", "Buxoro", "Mobil ilovalar yarataman"),
    ("nilufar@itparkacademy.uz", "Nilufar", "Saidova", "ru", "Toshkent", "Sun'iy intellektga qiziqaman"),
    ("sardor@itparkacademy.uz", "Sardor", "Alimov", "uz", "Namangan", "Backend va xavfsizlik"),
]


COMMENTS = [
    ("student@itparkacademy.uz", "python-asoslari", "Darslar juda tushunarli. Ayniqsa amaliy topshiriqlar foydali bo'ldi.", True),
    ("aziz@itparkacademy.uz", "python-asoslari", "Funksiyalar bo'limini yana bir bor ko'rib chiqdim, endi ancha tushunarli.", False),
    ("student@itparkacademy.uz", "javascript-va-react", "JSX sintaksisi haqidagi dars ajoyib. React'ga o'tish osonlashdi.", False),
    ("malika@itparkacademy.uz", "uiux-dizayn", "Figma bo'yicha amaliy maslahatlar juda ko'p. Rahmat!", False),
    ("jasur@itparkacademy.uz", "flutter-mobil-dasturlash", "Layout bo'limi mobil ilova uchun juda muhim ekan.", False),
    ("nilufar@itparkacademy.uz", "suniy-intellekt-asoslari", "Overfitting mavzusi sodda tilda tushuntirilgani yoqdi.", False),
]

REPLIES = [
    ("student@itparkacademy.uz", "python-asoslari", "Darslar juda tushunarli. Ayniqsa amaliy topshiriqlar foydali bo'ldi.", "Rahmat! Keyingi darsda loyiha ustida ishlaymiz."),
    ("malika@itparkacademy.uz", "uiux-dizayn", "Figma bo'yicha amaliy maslahatlar juda ko'p. Rahmat!", "Figma'da design system yaratishni ham albatta ko'ring."),
]

TESTIMONIALS = [
    ("Rasulbek Tursunov", "student@itparkacademy.uz", "javascript-va-react", "Frontend dasturchi", "Frontend-разработчик", "Kursdan so'ng haqiqiy loyihada ishlay boshladim. Amaliy yondashuv juda kuchli.", "После курса я начал работать над реальным проектом. Практический подход очень сильный.", 5),
    ("Malika Yusupova", "malika@itparkacademy.uz", "uiux-dizayn", "Product dizayner", "Продуктовый дизайнер", "Figma va design system bo'yicha bilimlarim ishda darhol qo'l keldi.", "Знания Figma и design system сразу пригодились в работе.", 5),
    ("Aziz Karimov", "aziz@itparkacademy.uz", "python-asoslari", "Backend dasturchi", "Backend-разработчик", "Python kursi juda tizimli. Har bir mavzu amaliyot bilan mustahkamlanadi.", "Курс Python очень системный. Каждая тема закрепляется практикой.", 4),
    ("Jasur Rahimov", "jasur@itparkacademy.uz", "flutter-mobil-dasturlash", "Mobil dasturchi", "Мобильный разработчик", "Flutter bilan birinchi ilovamni yozdim. Mentorlar savollarga tez javob beradi.", "Я написал первое приложение на Flutter. Менторы быстро отвечают на вопросы.", 5),
    ("Nilufar Saidova", "nilufar@itparkacademy.uz", "suniy-intellekt-asoslari", "Data analitik", "Дата-аналитик", "AI kursi murakkab mavzularni sodda tilda tushuntiradi.", "Курс AI объясняет сложные темы простым языком.", 5),
    ("Sardor Alimov", "sardor@itparkacademy.uz", "django-rest-api", "Backend dasturchi", "Backend-разработчик", "JWT va xavfsizlik bo'yicha bilimlar real loyihada juda foydali bo'ldi.", "Знания JWT и безопасности очень пригодились в реальном проекте.", 5),
]


class Command(BaseCommand):
    help = "Seed IT PARK ACADEMY with demo users, courses, videos, quizzes and analytics."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow seeding when DEBUG=False (never use on real production data).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refusing to seed with DEBUG=False. Pass --force only for a disposable environment."
            )

        self.stdout.write(self.style.MIGRATE_HEADING("IT PARK ACADEMY demo seed"))
        settings_obj = self.seed_settings()
        admin, teacher, students = self.seed_users()
        categories = self.seed_categories()
        courses = self.seed_courses(categories, teacher)
        self.seed_comments_and_testimonials(courses, teacher, students)
        self.seed_learning_activity(courses, students)
        self.seed_notifications(students)
        self.seed_analytics(courses)
        self.seed_stats(courses, settings_obj)
        self.print_summary(admin, teacher, students, courses)

    # ------------------------------------------------------------------
    # Settings / users
    # ------------------------------------------------------------------
    def seed_settings(self):
        obj = SystemSettings.load()
        obj.site_name = "IT PARK ACADEMY"
        obj.support_email = "support@itparkacademy.uz"
        obj.support_phone = "+998 71 200 00 00"
        obj.telegram_url = "https://t.me/itparkacademy"
        obj.instagram_url = "https://instagram.com/itparkacademy"
        obj.youtube_url = "https://youtube.com/@itparkacademy"
        obj.default_language = "uz"
        obj.grace_period_days = 3
        obj.subscription_period_days = 30
        obj.quiz_passing_score = 7
        obj.certificate_enabled = True
        obj.maintenance_mode = False
        obj.announcement = (
            "Yangi o'quv semestriga qabul boshlandi. Barcha kurslarga 20% gacha chegirma!"
            " | Начался набор на новый семестр. Скидки до 20% на все курсы!"
        )
        obj.save()
        self.stdout.write("  ✓ System settings")
        return obj

    def _ensure_user(self, email, password, role, first_name, last_name, **extra):
        user = User.objects.filter(email=email).first()
        if user is None:
            if role == User.Role.ADMIN:
                user = User.objects.create_superuser(
                    email=email, password=password, first_name=first_name, last_name=last_name, **extra
                )
            else:
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    role=role,
                    first_name=first_name,
                    last_name=last_name,
                    **extra,
                )
        if not user.check_password(password):
            user.set_password(password)
            user.save(update_fields=["password"])
        updated = []
        if user.first_name != first_name:
            user.first_name = first_name
            updated.append("first_name")
        if user.last_name != last_name:
            user.last_name = last_name
            updated.append("last_name")
        if not user.is_email_verified:
            user.is_email_verified = True
            user.email_verified_at = timezone.now()
            updated.append("is_email_verified")
            updated.append("email_verified_at")
        if updated:
            user.save(update_fields=updated)
        return user

    def seed_users(self):
        admin = self._ensure_user(
            "admin@itparkacademy.uz",
            ADMIN_PASSWORD,
            User.Role.ADMIN,
            "IT PARK",
            "Administrator",
            is_staff=True,
            is_superuser=True,
        )
        admin.role = User.Role.ADMIN
        admin.is_staff = True
        admin.is_superuser = True
        admin.is_email_verified = True
        admin.save()

        teacher = User.objects.filter(email="teacher@itparkacademy.uz").first()
        if teacher is None:
            existing_teacher = User.objects.filter(role=User.Role.TEACHER, is_active=True).first()
            if existing_teacher is not None:
                teacher = existing_teacher
            else:
                teacher = User.objects.create_user(
                    email="teacher@itparkacademy.uz",
                    password=TEACHER_PASSWORD,
                    role=User.Role.TEACHER,
                    first_name="Bekzod",
                    last_name="Nazarov",
                    is_email_verified=True,
                    email_verified_at=timezone.now(),
                )
        elif not teacher.check_password(TEACHER_PASSWORD):
            teacher.set_password(TEACHER_PASSWORD)
            teacher.save(update_fields=["password"])

        if teacher.role != User.Role.TEACHER:
            teacher.role = User.Role.TEACHER
            teacher.save(update_fields=["role"])
        if not teacher.is_email_verified:
            teacher.is_email_verified = True
            teacher.email_verified_at = timezone.now()
            teacher.save(update_fields=["is_email_verified", "email_verified_at"])

        teacher_profile = Profile.objects.get_or_create(user=teacher)[0]
        teacher_profile.headline = "Senior Full-Stack Instructor · IT PARK ACADEMY"
        teacher_profile.bio = (
            "8 yillik dasturlash tajribasi. Python, Django, React va Flutter bo'yicha amaliy kurslar muallifi."
            " | 8 лет опыта разработки. Автор практических курсов по Python, Django, React и Flutter."
        )
        teacher_profile.city = "Toshkent"
        teacher_profile.language = Profile.Language.UZ
        teacher_profile.save()
        self._assign_avatar(teacher, "Bekzod Nazarov", "teacher")

        student_objs = []
        for email, first, last, language, city, headline in STUDENTS:
            user = self._ensure_user(
                email,
                STUDENT_PASSWORD,
                User.Role.STUDENT,
                first,
                last,
                is_email_verified=True,
                email_verified_at=timezone.now(),
            )
            profile = Profile.objects.get_or_create(user=user)[0]
            profile.language = language
            profile.city = city
            profile.headline = headline
            profile.theme = Profile.Theme.DARK
            profile.save()
            self._assign_avatar(user, f"{first} {last}", email)
            student_objs.append(user)

        self.stdout.write(
            f"  ✓ Users: 1 admin, 1 teacher, {len(student_objs)} students"
        )
        return admin, teacher, student_objs

    def _assign_avatar(self, user, name, seed):
        if user.avatar:
            return
        user.avatar.save(
            f"{seed}.jpg", ContentFile(_avatar(name, seed)), save=True
        )

    # ------------------------------------------------------------------
    # Catalog
    # ------------------------------------------------------------------
    def seed_categories(self):
        categories = {}
        for order, (name_uz, name_ru, icon, desc_uz, desc_ru) in enumerate(CATEGORIES):
            slug = (
                name_uz.lower()
                .replace("'", "")
                .replace(" ", "-")
            )
            category, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name_uz": name_uz,
                    "name_ru": name_ru,
                    "icon": icon,
                    "description_uz": desc_uz,
                    "description_ru": desc_ru,
                    "order": order,
                    "is_active": True,
                },
            )
            categories[slug] = category
        self.stdout.write(f"  ✓ Categories: {len(categories)}")
        return categories

    def seed_courses(self, categories, teacher):
        courses = {}
        category_titles = {
            slug: (category.name_uz, category.name_ru)
            for slug, category in categories.items()
        }
        for index, blueprint in enumerate(COURSES):
            title_uz, title_ru = blueprint["title"]
            slug = (
                title_uz.lower()
                .replace("'", "")
                .replace(" ", "-")
                .replace("/", "")
            )
            category = categories[blueprint["category"]]
            short_uz, short_ru = blueprint["short"]
            desc_uz, desc_ru = blueprint["description"]
            course, created = Course.objects.update_or_create(
                slug=slug,
                defaults={
                    "teacher": teacher,
                    "category": category,
                    "title_uz": title_uz,
                    "title_ru": title_ru,
                    "short_description_uz": short_uz,
                    "short_description_ru": short_ru,
                    "description_uz": desc_uz,
                    "description_ru": desc_ru,
                    "level": blueprint["level"],
                    "language": "uz",
                    "status": Course.Status.PUBLISHED,
                    "is_free": blueprint["free"],
                    "price": Decimal(blueprint["price"]),
                    "monthly_price": Decimal(blueprint["monthly"]),
                    "is_featured": blueprint["featured"],
                    "meta_title": f"{title_uz} | IT PARK ACADEMY",
                    "meta_description": short_uz[:300],
                },
            )
            if created or not course.published_at:
                course.published_at = timezone.now() - timedelta(days=60 - index * 4)
                course.save(update_fields=["published_at"])
            if not course.thumbnail:
                course.thumbnail.save(
                    f"{slug}.jpg",
                    ContentFile(_thumbnail(title_uz, category.name_uz, slug)),
                    save=True,
                )

            video_bytes = None
            frame_png = None

            lesson_counter = 0
            for section_index, (section_title, lessons) in enumerate(blueprint["sections"]):
                section_title_uz, section_title_ru = section_title
                section, _ = CourseSection.objects.update_or_create(
                    course=course,
                    order=section_index,
                    defaults={
                        "title_uz": section_title_uz,
                        "title_ru": section_title_ru,
                        "description": f"{section_title_uz} bo'limi amaliy darslardan iborat.",
                    },
                )
                for lesson_index, (lesson_title, lesson_title_ru) in enumerate(lessons):
                    is_preview = lesson_counter == 0
                    lesson, _ = Lesson.objects.update_or_create(
                        section=section,
                        order=lesson_index,
                        defaults={
                            "title_uz": lesson_title,
                            "title_ru": lesson_title_ru,
                            "description_uz": (
                                f"{lesson_title} mavzusi bo'yicha nazariya va amaliy mashqlar."
                            ),
                            "description_ru": (
                                f"Теория и практические задания по теме «{lesson_title_ru}»."
                            ),
                            "duration_seconds": VIDEO_SECONDS,
                            "is_free_preview": is_preview or blueprint["free"],
                        },
                    )
                    video, _ = Video.objects.get_or_create(
                        lesson=lesson,
                        quality=Video.Quality.Q720,
                        defaults={
                            "title": lesson_title,
                            "duration_seconds": VIDEO_SECONDS,
                            "is_primary": True,
                            "processing_status": "ready",
                        },
                    )
                    if not video.file:
                        if video_bytes is None:
                            if frame_png is None:
                                frame_png = _video_frame(
                                    title_uz,
                                    category_titles[blueprint["category"]][0],
                                )
                            video_bytes = _render_video(frame_png)
                        video.file.save(
                            f"{slug}-{lesson.id}.mp4",
                            ContentFile(video_bytes),
                            save=True,
                        )
                    else:
                        video.title = lesson_title
                        video.duration_seconds = VIDEO_SECONDS
                        video.save(update_fields=["title", "duration_seconds"])
                    self.seed_quiz(lesson, slug, lesson_counter, section_title_uz, title_uz)
                    lesson_counter += 1

            refresh_course_stats(course)
            courses[slug] = course

        self.apply_discounts(courses)
        self.stdout.write(
            f"  ✓ Courses: {len(courses)} published, "
            f"{Lesson.objects.filter(section__course__in=courses.values()).count()} lessons"
        )
        return courses

    def seed_quiz(self, lesson, course_slug, lesson_index, section_title, course_title):
        quiz, _ = Quiz.objects.update_or_create(
            lesson=lesson,
            defaults={
                "title_uz": f"{lesson.title_uz} — nazorat testi",
                "title_ru": f"{lesson.title_ru} — контрольный тест",
                "description_uz": "10 savoldan iborat test. O'tish uchun kamida 7 ta to'g'ri javob kerak.",
                "description_ru": "Тест из 10 вопросов. Для прохождения нужно минимум 7 правильных ответов.",
                "passing_score": 7,
                "total_questions": 10,
                "randomize_questions": True,
                "randomize_options": True,
                "is_active": True,
            },
        )
        if quiz.questions.count() == 10:
            return quiz

        quiz.questions.all().delete()
        bank = QUIZ_BANK[course_slug]
        rng = random.Random(f"{course_slug}-{lesson_index}")
        rotated = bank[lesson_index % len(bank):] + bank[: lesson_index % len(bank)]
        facts = rotated[:8]

        generated = [
            {
                "q": (
                    f"«{lesson.title_uz}» darsi qaysi kurs tarkibiga kiradi?",
                    f"В состав какого курса входит урок «{lesson.title_ru}»?",
                ),
                "correct": (course_title, course_title),
                "wrong": [
                    ("Kiberxavfsizlik asoslari", "Основы кибербезопасности"),
                    ("UI/UX dizayn", "UI/UX дизайн"),
                    ("PostgreSQL ma'lumotlar bazasi", "Базы данных PostgreSQL"),
                ],
                "explanation": (course_title, course_title),
            },
            {
                "q": (
                    f"«{lesson.title_uz}» darsini muvaffaqiyatli yakunlagach nima ochiladi?",
                    f"Что открывается после успешного завершения урока «{lesson.title_ru}»?",
                ),
                "correct": ("Keyingi dars", "Следующий урок"),
                "wrong": [
                    ("Barcha kurslar bir vaqtda", "Все курсы одновременно"),
                    ("To'lov avtomatik bekor qilinadi", "Оплата автоматически отменяется"),
                    ("Hisob butunlay o'chiriladi", "Аккаунт полностью удаляется"),
                ],
                "explanation": ("Keyingi dars", "Следующий урок"),
            },
        ]
        questions = generated + facts

        for order, fact in enumerate(questions):
            q_uz, q_ru = fact["q"]
            question = Question.objects.create(
                quiz=quiz,
                type=Question.Type.SINGLE,
                text_uz=q_uz,
                text_ru=q_ru,
                explanation_uz=fact["explanation"][0],
                explanation_ru=fact["explanation"][1],
                order=order,
                points=1,
            )
            correct_uz, correct_ru = fact["correct"]
            options = [(correct_uz, correct_ru, True)]
            for wrong_uz, wrong_ru in fact["wrong"]:
                options.append((wrong_uz, wrong_ru, False))
            rng.shuffle(options)
            for option_order, (text_uz, text_ru, is_correct) in enumerate(options):
                AnswerOption.objects.create(
                    question=question,
                    text_uz=text_uz,
                    text_ru=text_ru,
                    is_correct=is_correct,
                    order=option_order,
                )
        return quiz

    def apply_discounts(self, courses):
        now = timezone.now()
        plans = {
            "javascript-va-react": 15,
            "suniy-intellekt-asoslari": 20,
        }
        for slug, percentage in plans.items():
            course = courses.get(slug)
            if not course:
                continue
            Discount.objects.filter(course=course, is_active=True).delete()
            Discount.objects.create(
                course=course,
                percentage=percentage,
                starts_at=now - timedelta(days=2),
                ends_at=now + timedelta(days=12),
                is_active=True,
            )
        self.stdout.write("  ✓ Active discounts: 2 courses")

    # ------------------------------------------------------------------
    # Community content
    # ------------------------------------------------------------------
    def seed_comments_and_testimonials(self, courses, teacher, students):
        users = {user.email: user for user in students}
        for email, course_slug, body, pinned in COMMENTS:
            course = courses.get(course_slug)
            user = users.get(email)
            if not course or not user:
                continue
            comment = Comment.objects.filter(course=course, user=user, body=body).first()
            if comment is None:
                comment = Comment.objects.create(
                    course=course,
                    user=user,
                    body=body,
                    is_pinned=pinned,
                )
            else:
                comment.is_pinned = pinned
                comment.is_deleted = False
                comment.save(update_fields=["is_pinned", "is_deleted", "updated_at"])

        for email, course_slug, body, reply_body in REPLIES:
            course = courses.get(course_slug)
            user = users.get(email)
            if not course or not user:
                continue
            comment = Comment.objects.filter(course=course, user=user, body=body).first()
            if not comment:
                continue
            CommentReply.objects.get_or_create(
                comment=comment,
                user=teacher,
                body=reply_body,
            )

        for name, email, course_slug, role_uz, role_ru, quote_uz, quote_ru, rating in TESTIMONIALS:
            Testimonial.objects.update_or_create(
                name=name,
                defaults={
                    "user": users.get(email),
                    "course": courses.get(course_slug),
                    "role_uz": role_uz,
                    "role_ru": role_ru,
                    "quote_uz": quote_uz,
                    "quote_ru": quote_ru,
                    "rating": rating,
                    "is_approved": True,
                    "is_featured": True,
                },
            )

        for course in courses.values():
            ratings = list(
                Testimonial.objects.filter(course=course, is_approved=True).values_list(
                    "rating", flat=True
                )
            )
            if ratings:
                course.rating_avg = round(sum(ratings) / len(ratings), 2)
                course.rating_count = len(ratings)
                course.save(update_fields=["rating_avg", "rating_count"])
        self.stdout.write("  ✓ Comments, replies and testimonials")

    # ------------------------------------------------------------------
    # Subscriptions, payments, progress
    # ------------------------------------------------------------------
    def _successful_payment(self, user, course, days_ago=5):
        amount = course.effective_monthly_price or course.price
        if amount <= 0:
            return None
        transaction_id = f"seed-{course.slug}-{user.id}"
        payment, created = Payment.objects.get_or_create(
            provider_transaction_id=transaction_id,
            defaults={
                "user": user,
                "course": course,
                "provider": Payment.Provider.SANDBOX,
                "billing_period": Payment.BillingPeriod.MONTHLY,
                "amount": amount,
                "currency": "UZS",
                "status": Payment.Status.SUCCESS,
                "paid_at": timezone.now() - timedelta(days=days_ago),
                "provider_payload": {
                    "seeded": True,
                    "note": "Demo sandbox transaction generated by seed_demo.",
                },
            },
        )
        if not created:
            payment.status = Payment.Status.SUCCESS
            payment.paid_at = timezone.now() - timedelta(days=days_ago)
            payment.amount = amount
            payment.save(update_fields=["status", "paid_at", "amount", "updated_at"])
        return payment

    def _subscribe(self, user, course, days_ago=5):
        payment = self._successful_payment(user, course, days_ago)
        subscription = activate_subscription(user, course)
        now = timezone.now()
        subscription.started_at = now - timedelta(days=days_ago)
        subscription.current_period_start = now - timedelta(days=days_ago)
        subscription.current_period_end = now + timedelta(days=30 - days_ago)
        subscription.grace_until = subscription.current_period_end + timedelta(days=3)
        subscription.status = Subscription.Status.ACTIVE
        subscription.save()
        if payment is not None and payment.subscription_id != subscription.id:
            payment.subscription = subscription
            payment.save(update_fields=["subscription", "updated_at"])
        return subscription

    def _complete_lessons(self, user, course, count):
        lessons = ordered_lessons(course)
        selected = lessons[: max(0, min(count, len(lessons)))]
        for lesson in selected:
            video = lesson.videos.filter(is_primary=True).first() or lesson.videos.first()
            progress, _ = VideoProgress.objects.get_or_create(user=user, lesson=lesson)
            progress.video = video
            progress.watched_seconds = VIDEO_SECONDS
            progress.last_position = VIDEO_SECONDS
            progress.duration = VIDEO_SECONDS
            progress.completed = True
            progress.completed_at = progress.completed_at or timezone.now() - timedelta(days=2)
            progress.save()

            quiz = Quiz.objects.filter(lesson=lesson, is_active=True).first()
            if not quiz:
                continue
            attempt = QuizAttempt.objects.filter(
                user=user, quiz=quiz, passed=True
            ).order_by("-created_at").first()
            if attempt is None:
                questions = list(quiz.questions.all())
                attempt_number = QuizAttempt.objects.filter(user=user, quiz=quiz).count() + 1
                attempt = QuizAttempt.objects.create(
                    user=user,
                    quiz=quiz,
                    attempt_number=attempt_number,
                    started_at=timezone.now() - timedelta(minutes=25),
                    completed_at=timezone.now() - timedelta(minutes=10),
                    score=len(questions),
                    total_questions=len(questions),
                    correct_count=len(questions),
                    wrong_count=0,
                    passed=True,
                    restart_required=False,
                    snapshot={
                        "questions": [question.id for question in questions],
                        "options": {
                            str(question.id): list(
                                question.options.values_list("id", flat=True)
                            )
                            for question in questions
                        },
                    },
                )
            award_points(
                user,
                10,
                "quiz_passed",
                reference=f"quiz-attempt:{attempt.id}",
            )

        enrollment = get_or_create_enrollment(user, course)
        if selected:
            enrollment.last_lesson = selected[-1]
            enrollment.save(update_fields=["last_lesson", "updated_at"])
        return course_progress(user, course)

    def seed_learning_activity(self, courses, students):
        by_email = {user.email: user for user in students}
        plans = {
            "student@itparkacademy.uz": [
                ("python-asoslari", 6, 5),
                ("javascript-va-react", 3, 2),
            ],
            "aziz@itparkacademy.uz": [
                ("python-asoslari", 4, 8),
                ("postgresql-malumotlar-bazasi", 2, 3),
            ],
            "malika@itparkacademy.uz": [
                ("javascript-va-react", 6, 6),
                ("uiux-dizayn", 2, 2),
            ],
            "jasur@itparkacademy.uz": [
                ("flutter-mobil-dasturlash", 3, 4),
            ],
            "nilufar@itparkacademy.uz": [
                ("suniy-intellekt-asoslari", 2, 3),
                ("kiberxavfsizlik-asoslari", 6, 7),
            ],
            "sardor@itparkacademy.uz": [
                ("django-rest-api", 5, 6),
                ("python-asoslari", 2, 4),
            ],
        }

        for email, entries in plans.items():
            user = by_email.get(email)
            if not user:
                continue
            for slug, lessons_to_complete, days_ago in entries:
                course = courses.get(slug)
                if not course:
                    continue
                if course.is_free:
                    get_or_create_enrollment(user, course)
                else:
                    self._subscribe(user, course, days_ago=days_ago)
                self._complete_lessons(user, course, lessons_to_complete)

        # A free-course enrollment for the main demo student as well.
        main_student = by_email.get("student@itparkacademy.uz")
        free_course = courses.get("kiberxavfsizlik-asoslari")
        if main_student and free_course:
            get_or_create_enrollment(main_student, free_course)

        # Realistic failed / pending attempts for the payment dashboard.
        sardor = by_email.get("sardor@itparkacademy.uz")
        uiux = courses.get("uiux-dizayn")
        if sardor and uiux:
            Payment.objects.get_or_create(
                provider_transaction_id=f"seed-failed-{uiux.slug}-{sardor.id}",
                defaults={
                    "user": sardor,
                    "course": uiux,
                    "provider": Payment.Provider.CLICK,
                    "billing_period": Payment.BillingPeriod.MONTHLY,
                    "amount": uiux.effective_monthly_price,
                    "currency": "UZS",
                    "status": Payment.Status.FAILED,
                    "failure_reason": "Insufficient funds (sandbox test record)",
                    "provider_payload": {"seeded": True},
                },
            )
        jasur = by_email.get("jasur@itparkacademy.uz")
        ai = courses.get("suniy-intellekt-asoslari")
        if jasur and ai:
            Payment.objects.get_or_create(
                provider_transaction_id=f"seed-pending-{ai.slug}-{jasur.id}",
                defaults={
                    "user": jasur,
                    "course": ai,
                    "provider": Payment.Provider.PAYME,
                    "billing_period": Payment.BillingPeriod.MONTHLY,
                    "amount": ai.effective_monthly_price,
                    "currency": "UZS",
                    "status": Payment.Status.PENDING,
                    "provider_payload": {"seeded": True},
                },
            )

        certificates = Certificate.objects.count()
        subscriptions = Subscription.objects.count()
        payments = Payment.objects.count()
        self.stdout.write(
            f"  ✓ Activity: {subscriptions} subscriptions, {payments} payments, "
            f"{certificates} certificates"
        )

    # ------------------------------------------------------------------
    # Notifications / analytics
    # ------------------------------------------------------------------
    def seed_notifications(self, students):
        from apps.notifications.models import Notification

        for user in students:
            if Notification.objects.filter(user=user, type=Notification.Type.REGISTRATION).exists():
                continue
            Notification.objects.create(
                user=user,
                type=Notification.Type.REGISTRATION,
                title_uz="IT PARK ACADEMY'ga xush kelibsiz!",
                title_ru="Добро пожаловать в IT PARK ACADEMY!",
                message_uz=(
                    "Profilingiz tayyor. Kurslar katalogidan o'zingizga mos yo'nalishni tanlang."
                ),
                message_ru=(
                    "Ваш профиль готов. Выберите подходящее направление в каталоге курсов."
                ),
                data={"action": "browse_courses"},
            )
        self.stdout.write(f"  ✓ Welcome notifications: {len(students)}")

    def seed_analytics(self, courses):
        today = timezone.localdate()
        for offset in range(14):
            rebuild_daily_analytics(today - timedelta(days=offset))
        for period in Leaderboard.Period.values:
            compute_leaderboard(period)
        self.stdout.write("  ✓ Daily analytics (14 days) and leaderboards")

    def seed_stats(self, courses, settings_obj):
        for course in courses.values():
            refresh_course_stats(course)
        self.stdout.write("  ✓ Course counters refreshed")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    def print_summary(self, admin, teacher, students, courses):
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Demo environment is ready."))
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Sign in credentials"))
        self.stdout.write(f"  Admin    {admin.email} / {ADMIN_PASSWORD}")
        self.stdout.write(f"  Teacher  {teacher.email} / {TEACHER_PASSWORD}")
        self.stdout.write(f"  Student  student@itparkacademy.uz / {STUDENT_PASSWORD}")
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Catalog"))
        for course in courses.values():
            price = "Bepul / Бесплатно" if course.is_free else f"{course.monthly_price:,.0f} UZS/oy".replace(",", " ")
            self.stdout.write(
                f"  • {course.title_uz} [{course.level}] — {price}, "
                f"{course.lessons_count} lessons"
            )
        self.stdout.write("")
        self.stdout.write(
            "  API: http://localhost:8000/api/  ·  Swagger: http://localhost:8000/api/docs/"
        )
        self.stdout.write(
            f"  Certificates: {Certificate.objects.count()} issued  ·  "
            f"Subscriptions: {Subscription.objects.count()}  ·  "
            f"Payments: {Payment.objects.count()}"
        )
        self.stdout.write("")
