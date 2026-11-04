import logging

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.courses.models import Course, Enrollment
from apps.users.models import User
from common.permissions import IsTeacherOrAdmin
from .models import Broadcast, Notification, PushDevice, TelegramAccount
from .serializers import (
    BroadcastHistorySerializer,
    BroadcastSerializer,
    NotificationSerializer,
    PushDeviceSerializer,
    TelegramAccountSerializer,
)
from .services import notify_user, send_telegram_message

logger = logging.getLogger("apps.notifications")


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        if self.request.query_params.get("unread") in {"1", "true"}:
            qs = qs.filter(is_read=False)
        notification_type = self.request.query_params.get("type")
        if notification_type:
            qs = qs.filter(type=notification_type)
        return qs

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at", "updated_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        count = self.get_queryset().filter(is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({"updated": count})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"count": Notification.objects.filter(user=request.user, is_read=False).count()})

    @action(detail=False, methods=["post"], permission_classes=[IsTeacherOrAdmin])
    def broadcast(self, request):
        serializer = BroadcastSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if request.user.role == "teacher" and data["audience"] != "course":
            return Response(
                {"detail": "Teachers can only notify students of their own courses."}, status=403
            )
        users = User.objects.filter(is_active=True)
        if data["audience"] == "students":
            users = users.filter(role=User.Role.STUDENT)
        elif data["audience"] == "course":
            course = Course.objects.filter(slug=data["course_slug"]).first()
            if not course:
                return Response({"detail": "Course not found."}, status=404)
            if request.user.role == "teacher" and course.teacher_id != request.user.id:
                return Response({"detail": "You can only notify students of your own courses."}, status=403)
            users = users.filter(enrollments__course=course, enrollments__is_active=True).distinct()
        count = 0
        for user in users.iterator():
            notify_user(
                user,
                data["type"],
                data["title_uz"],
                data["title_ru"],
                data["message_uz"],
                data["message_ru"],
                data={"course_slug": data.get("course_slug", "")},
                telegram=data["telegram"],
                push=data["push"],
            )
            count += 1
        Broadcast.objects.create(
            created_by=request.user,
            type=data["type"],
            audience=data["audience"],
            course_slug=data.get("course_slug", ""),
            title_uz=data["title_uz"],
            title_ru=data["title_ru"],
            message_uz=data["message_uz"],
            message_ru=data["message_ru"],
            recipients_count=count,
            telegram=data["telegram"],
            push=data["push"],
        )
        return Response({"sent": count})

    @action(detail=False, methods=["get"], permission_classes=[IsTeacherOrAdmin])
    def broadcasts(self, request):
        queryset = Broadcast.objects.select_related("created_by")
        if request.user.role == "teacher":
            queryset = queryset.filter(created_by=request.user)
        page = self.paginate_queryset(queryset)
        serializer = BroadcastHistorySerializer(page, many=True)
        return self.get_paginated_response(serializer.data)


class TelegramAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        account = TelegramAccount.objects.filter(user=request.user).first()
        if not account:
            return Response({"is_linked": False, "deep_link": None, "login_deep_link": None})
        data = TelegramAccountSerializer(account).data
        data["deep_link"] = account.deep_link if not account.is_linked else None
        data["login_deep_link"] = account.login_deep_link if account.is_linked and account.login_token and (not account.login_token_used_at) else None
        return Response(data)

    def post(self, request):
        account, _ = TelegramAccount.objects.get_or_create(user=request.user)
        action = (request.data.get("action") or "link").lower()
        if action == "login" and account.is_linked:
            token = account.issue_login_token(minutes=5)
            return Response(
                {
                    "login_deep_link": account.login_deep_link,
                    "token": token,
                    "bot_username": settings.TELEGRAM_BOT_USERNAME,
                    "expires_in": 300,
                }
            )
        token = account.issue_link_token()
        return Response(
            {
                "deep_link": account.deep_link,
                "token": token,
                "expires": "Link is valid while this token remains active.",
                "bot_username": settings.TELEGRAM_BOT_USERNAME,
            }
        )

    def delete(self, request):
        account = TelegramAccount.objects.filter(user=request.user).first()
        if account:
            account.chat_id = None
            account.linked_at = None
            account.link_token = ""
            account.login_token = ""
            account.login_token_expires_at = None
            account.login_token_used_at = None
            account.save(update_fields=["chat_id", "linked_at", "link_token", "login_token", "login_token_expires_at", "login_token_used_at", "updated_at"])
        return Response({"detail": "Telegram account unlinked."})


class PushDeviceViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PushDeviceSerializer

    def get_queryset(self):
        return PushDevice.objects.filter(user=self.request.user, is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class TelegramWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "anon"

    def post(self, request):
        if settings.TELEGRAM_WEBHOOK_SECRET:
            if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != settings.TELEGRAM_WEBHOOK_SECRET:
                return Response({"detail": "Forbidden"}, status=403)
        if not settings.TELEGRAM_BOT_TOKEN:
            return Response({"ok": True})
        message = request.data.get("message") or request.data.get("edited_message") or {}
        chat = message.get("chat", {})
        chat_id = chat.get("id")
        text = (message.get("text") or "").strip()
        username = chat.get("username", "")
        if not chat_id:
            return Response({"ok": True})
        if text.startswith("/start"):
            parts = text.split(maxsplit=1)
            token = parts[1].strip() if len(parts) > 1 else ""
            if token.startswith("login_"):
                login_token = token.replace("login_", "", 1)
                account = (
                    TelegramAccount.objects.filter(login_token=login_token)
                    .select_related("user")
                    .first()
                )
                if not account or not account.is_linked or not account.chat_id:
                    send_telegram_message(
                        chat_id,
                        "Telegram orqali kirish uchun avval saytdagi profil bo'limida Telegram akkauntingizni bog'lang.",
                    )
                    return Response({"ok": True})
                if account.chat_id != int(chat_id) if str(chat_id).lstrip("-").isdigit() else account.chat_id != chat_id:
                    send_telegram_message(chat_id, "Bu login token faqat bog'langan Telegram akkauntingizga tegishli.")
                    return Response({"ok": True})
                from django.utils import timezone

                if not account.login_token_expires_at or account.login_token_expires_at < timezone.now():
                    send_telegram_message(chat_id, "Login token muddati tugagan. Saytdan qaytadan urinib ko'ring.")
                    return Response({"ok": True})
                if account.login_token_used_at:
                    send_telegram_message(chat_id, "Bu login token allaqachon ishlatilgan.")
                    return Response({"ok": True})
                from apps.users.serializers import issue_tokens_for_user
                from rest_framework.response import Response as DRFResponse

                account.login_token_used_at = timezone.now()
                account.save(update_fields=["login_token_used_at", "updated_at"])
                data = issue_tokens_for_user(account.user)
                send_telegram_message(
                    chat_id,
                    f"<b>IT PARK ACADEMY</b>\n\n{account.user.full_name}, tizimga muvaffaqiyatli kirildi.\n\nAccess token: {data['access'][:24]}...",
                )
                return Response({"ok": True})
            account = TelegramAccount.objects.filter(link_token=token).first() if token else None
            if not account:
                send_telegram_message(
                    chat_id,
                    "IT PARK ACADEMY botiga xush kelibsiz!\n\nAkkauntingizni bog'lash uchun saytdagi profil bo'limidan havola oling.",
                )
                return Response({"ok": True})
            if account.is_linked and account.chat_id != chat_id:
                send_telegram_message(chat_id, "This link token has already been used.")
                return Response({"ok": True})
            account.chat_id = int(chat_id) if str(chat_id).lstrip("-").isdigit() else chat_id
            account.username = username
            account.linked_at = timezone.now()
            account.link_token = ""
            account.notifications_enabled = True
            account.save()
            send_telegram_message(
                chat_id,
                f"<b>IT PARK ACADEMY</b>\n\n{account.user.full_name}, akkauntingiz muvaffaqiyatli bog'landi. "
                "Endi kurs, to'lov va sertifikat bildirishnomalarini shu yerda olasiz.",
            )
        elif text.startswith("/stop"):
            account = TelegramAccount.objects.filter(chat_id=chat_id).first()
            if account:
                account.notifications_enabled = False
                account.save(update_fields=["notifications_enabled", "updated_at"])
                send_telegram_message(chat_id, "Bildirishnomalar o'chirildi. Qayta yoqish uchun /start yuboring.")
        return Response({"ok": True})
