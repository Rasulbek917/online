from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from common.testing import force_login
from .models import EmailVerificationToken, PasswordResetToken, User


@override_settings(
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class AuthFlowTests(APITestCase):
    def setUp(self):
        cache.clear()

    def register(self, email="new.student@example.com", password="StrongPass123!"):
        return self.client.post(
            "/api/auth/register/",
            {
                "email": email,
                "password": password,
                "password_confirm": password,
                "first_name": "New",
                "last_name": "Student",
                "language": "uz",
                "accept_terms": True,
            },
            format="json",
        )

    def test_register_creates_user_sets_cookie_and_sends_verification(self):
        response = self.register()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn("access", response.data)
        self.assertIn(settings.AUTH_COOKIE_REFRESH, response.cookies)
        cookie = response.cookies[settings.AUTH_COOKIE_REFRESH]
        self.assertTrue(cookie["httponly"])
        user = User.objects.get(email="new.student@example.com")
        self.assertEqual(user.role, User.Role.STUDENT)
        self.assertTrue(user.profile.language == "uz")
        self.assertTrue(EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).exists())

    def test_register_rejects_duplicate_email(self):
        self.register()
        response = self.register()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.filter(email="new.student@example.com").count(), 1)

    def test_register_requires_terms(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "terms@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "first_name": "Terms",
                "accept_terms": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="terms@example.com").exists())

    def test_login_me_profile_and_logout(self):
        user = User.objects.create_user(
            email="login@example.com", password="StrongPass123!", first_name="Login"
        )
        response = self.client.post(
            "/api/auth/login/",
            {"email": "login@example.com", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn(settings.AUTH_COOKIE_REFRESH, response.cookies)
        access = response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        me = self.client.get("/api/auth/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["email"], user.email)

        patched = self.client.patch(
            "/api/auth/me/",
            {"theme": "light", "language": "ru", "headline": "QA engineer", "first_name": "Updated"},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Updated")
        self.assertEqual(user.profile.theme, "light")
        self.assertEqual(user.profile.language, "ru")
        self.assertEqual(user.profile.headline, "QA engineer")

        logout = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(logout.status_code, status.HTTP_200_OK)

    def test_login_rejects_invalid_password(self):
        User.objects.create_user(email="bad@example.com", password="StrongPass123!")
        response = self.client.post(
            "/api/auth/login/",
            {"email": "bad@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_uses_httponly_cookie_and_rotates(self):
        user = User.objects.create_user(email="refresh@example.com", password="StrongPass123!")
        login = self.client.post(
            "/api/auth/login/",
            {"email": "refresh@example.com", "password": "StrongPass123!"},
            format="json",
        )
        old_refresh = login.cookies[settings.AUTH_COOKIE_REFRESH].value
        response = self.client.post("/api/auth/refresh/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("access", response.data)
        self.assertIn(settings.AUTH_COOKIE_REFRESH, response.cookies)
        self.assertNotEqual(response.cookies[settings.AUTH_COOKIE_REFRESH].value, old_refresh)

    def test_refresh_without_cookie_is_unauthorized(self):
        response = self.client.post("/api/auth/refresh/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_email_verification_flow(self):
        user = User.objects.create_user(email="verify@example.com", password="StrongPass123!")
        self.assertFalse(user.is_email_verified)
        raw = EmailVerificationToken.issue(user)
        response = self.client.post("/api/auth/verify-email/", {"token": raw}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)

    def test_email_verification_rejects_reused_token(self):
        user = User.objects.create_user(email="verify2@example.com", password="StrongPass123!")
        raw = EmailVerificationToken.issue(user)
        self.client.post("/api/auth/verify-email/", {"token": raw}, format="json")
        response = self.client.post("/api/auth/verify-email/", {"token": raw}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_reset_flow(self):
        user = User.objects.create_user(email="reset@example.com", password="StrongPass123!")
        raw = PasswordResetToken.issue(user)
        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"token": raw, "password": "NewStrongPass456!", "password_confirm": "NewStrongPass456!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password("NewStrongPass456!"))

    def test_password_reset_request_does_not_leak_account_existence(self):
        response = self.client.post(
            "/api/auth/password-reset/", {"email": "missing@example.com"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_change_password(self):
        user = User.objects.create_user(email="change@example.com", password="StrongPass123!")
        force_login(self.client, user)
        response = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": "StrongPass123!",
                "new_password": "ChangedPass789!",
                "new_password_confirm": "ChangedPass789!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password("ChangedPass789!"))

    def test_change_password_rejects_wrong_current(self):
        user = User.objects.create_user(email="change2@example.com", password="StrongPass123!")
        force_login(self.client, user)
        response = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": "wrong",
                "new_password": "ChangedPass789!",
                "new_password_confirm": "ChangedPass789!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_requires_authentication(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_mobile_login_returns_refresh_in_body(self):
        User.objects.create_user(email="mobile@example.com", password="StrongPass123!")
        response = self.client.post(
            "/api/auth/login/",
            {"email": "mobile@example.com", "password": "StrongPass123!", "client": "mobile"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("refresh", response.data)

    def test_single_teacher_rule(self):
        from django.core.exceptions import ValidationError

        User.objects.create_user(
            email="teacher.one@example.com", password="StrongPass123!", role=User.Role.TEACHER
        )
        with self.assertRaises(ValidationError):
            User.objects.create_user(
                email="teacher.two@example.com", password="StrongPass123!", role=User.Role.TEACHER
            )

    def test_google_login_rejected_when_not_configured(self):
        with override_settings(GOOGLE_CLIENT_ID=""):
            response = self.client.post(
                "/api/auth/google/", {"credential": "fake-token"}, format="json"
            )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
