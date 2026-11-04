import hashlib

from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.payments.models import Payment
from apps.payments.services import mark_payment_success
from apps.subscriptions.models import Subscription
from common.testing import create_category, create_course, create_user, force_login

CLICK_CONFIG = {
    "CLICK_SERVICE_ID": "12345",
    "CLICK_MERCHANT_ID": "67890",
    "CLICK_SECRET_KEY": "secret-key",
    "CLICK_CHECKOUT_URL": "https://my.click.uz/services/pay",
    "PAYME_MERCHANT_ID": "payme-merchant",
    "PAYME_SECRET_KEY": "payme-secret",
    "PAYME_CHECKOUT_URL": "https://checkout.paycom.uz",
    "UZUM_API_KEY": "uzum-key",
    "UZUM_SERVICE_ID": "uzum-service",
    "UZUM_CHECKOUT_URL": "https://checkout.uzum.uz",
}


@override_settings(
    DEBUG=True,
    PAYMENT_SETTINGS=CLICK_CONFIG,
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class PaymentFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.teacher = create_user("teacher@pay.uz", role="teacher")
        self.student = create_user("student@pay.uz")
        self.category = create_category()
        self.course = create_course(
            self.teacher,
            self.category,
            slug="paid-course",
            title="Paid Course",
            monthly_price=100000,
            price=1000000,
        )
        force_login(self.client, self.student)

    def checkout(self, provider="sandbox", billing="monthly", slug="paid-course"):
        return self.client.post(
            "/api/payments/checkout/",
            {"course_slug": slug, "provider": provider, "billing_period": billing},
            format="json",
        )

    def test_sandbox_checkout_creates_pending_payment(self):
        response = self.checkout()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        payment = Payment.objects.get(pk=response.data["payment"]["id"])
        self.assertEqual(payment.status, Payment.Status.PENDING)
        self.assertEqual(payment.amount, 100000)
        self.assertEqual(payment.provider, Payment.Provider.SANDBOX)
        self.assertIn("/checkout/sandbox/", response.data["checkout_url"])

    def test_sandbox_confirm_activates_subscription_idempotently(self):
        checkout = self.checkout()
        payment_id = checkout.data["payment"]["id"]
        first = self.client.post(f"/api/payments/{payment_id}/sandbox_confirm/", {}, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        payment = Payment.objects.get(pk=payment_id)
        self.assertEqual(payment.status, Payment.Status.SUCCESS)
        self.assertIsNotNone(payment.paid_at)
        subscription = Subscription.objects.get(user=self.student, course=self.course)
        self.assertEqual(subscription.status, Subscription.Status.ACTIVE)
        self.assertTrue(subscription.is_access_active)

        from apps.analytics.models import PointsTransaction

        points = PointsTransaction.objects.filter(
            user=self.student, reason="course_payment"
        ).count()
        self.assertEqual(points, 1)

        second = self.client.post(f"/api/payments/{payment_id}/sandbox_confirm/", {}, format="json")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Subscription.objects.filter(user=self.student, course=self.course).count(), 1)
        self.assertEqual(
            PointsTransaction.objects.filter(user=self.student, reason="course_payment").count(), 1
        )

    def test_full_course_purchase_uses_full_price_and_long_period(self):
        response = self.checkout(billing="full")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        payment_id = response.data["payment"]["id"]
        payment = Payment.objects.get(pk=payment_id)
        self.assertEqual(payment.amount, 1000000)
        self.client.post(f"/api/payments/{payment_id}/sandbox_confirm/", {}, format="json")
        subscription = Subscription.objects.get(user=self.student, course=self.course)
        days = (subscription.current_period_end - subscription.current_period_start).days
        self.assertGreaterEqual(days, 300)

    def test_free_course_cannot_be_purchased(self):
        free_course = create_course(
            self.teacher,
            self.category,
            slug="free-paid",
            title="Free",
            is_free=True,
            price=0,
            monthly_price=0,
        )
        response = self.checkout(slug=free_course.slug)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unconfigured_provider_is_rejected(self):
        with override_settings(PAYMENT_SETTINGS={**CLICK_CONFIG, "CLICK_SECRET_KEY": ""}):
            response = self.checkout(provider="click")
        # The checkout endpoint reads provider configuration at call time for Click.
        self.assertIn(response.status_code, {status.HTTP_400_BAD_REQUEST})

    def test_service_level_success_is_idempotent(self):
        payment = Payment.objects.create(
            user=self.student,
            course=self.course,
            provider=Payment.Provider.SANDBOX,
            amount=100000,
        )
        first, changed = mark_payment_success(payment.id, "tx-1", provider="sandbox")
        self.assertTrue(changed)
        second, changed_again = mark_payment_success(payment.id, "tx-1", provider="sandbox")
        self.assertFalse(changed_again)
        self.assertEqual(first.id, second.id)
        self.assertEqual(Subscription.objects.count(), 1)

    def test_service_rejects_provider_mismatch(self):
        from rest_framework.exceptions import ValidationError

        payment = Payment.objects.create(
            user=self.student,
            course=self.course,
            provider=Payment.Provider.SANDBOX,
            amount=100000,
        )
        with self.assertRaises(ValidationError):
            mark_payment_success(payment.id, "tx-2", provider="click")

    def test_click_prepare_rejects_bad_signature(self):
        payment = Payment.objects.create(
            user=self.student,
            course=self.course,
            provider=Payment.Provider.CLICK,
            amount=100000,
        )
        response = self.client.post(
            "/api/payments/click/prepare/",
            {
                "click_trans_id": "111",
                "service_id": "12345",
                "sign_time": "2026-01-01 10:00:00",
                "sign_string": "bad",
                "action": "0",
                "merchant_trans_id": str(payment.id),
                "amount": "100000",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["error"], -1)

    @override_settings(PAYMENT_SETTINGS=CLICK_CONFIG)
    def test_click_prepare_accepts_valid_signature(self):
        payment = Payment.objects.create(
            user=self.student,
            course=self.course,
            provider=Payment.Provider.CLICK,
            amount=100000,
        )
        click_trans_id = "111"
        service_id = "12345"
        sign_time = "2026-01-01 10:00:00"
        amount = "100000"
        raw = f"{click_trans_id}{service_id}secret-key{payment.id}{amount}0{sign_time}"
        sign = hashlib.md5(raw.encode()).hexdigest()
        response = self.client.post(
            "/api/payments/click/prepare/",
            {
                "click_trans_id": click_trans_id,
                "service_id": service_id,
                "sign_time": sign_time,
                "sign_string": sign,
                "action": "0",
                "merchant_trans_id": str(payment.id),
                "amount": amount,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["error"], 0)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PROCESSING)

    def test_click_prepare_rejects_amount_mismatch(self):
        payment = Payment.objects.create(
            user=self.student,
            course=self.course,
            provider=Payment.Provider.CLICK,
            amount=100000,
        )
        click_trans_id = "222"
        service_id = "12345"
        sign_time = "2026-01-01 10:00:00"
        amount = "5"
        raw = f"{click_trans_id}{service_id}secret-key{payment.id}{amount}0{sign_time}"
        sign = hashlib.md5(raw.encode()).hexdigest()
        response = self.client.post(
            "/api/payments/click/prepare/",
            {
                "click_trans_id": click_trans_id,
                "service_id": service_id,
                "sign_time": sign_time,
                "sign_string": sign,
                "action": "0",
                "merchant_trans_id": str(payment.id),
                "amount": amount,
            },
            format="json",
        )
        self.assertEqual(response.data["error"], -6)

    def test_payme_rejects_missing_authorization(self):
        response = self.client.post(
            "/api/payments/payme/",
            {"jsonrpc": "2.0", "id": 1, "method": "CheckPerformTransaction", "params": {}},
            format="json",
            HTTP_AUTHORIZATION="Basic invalid",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["error"]["code"], -32504)

    def test_payment_list_is_scoped_to_owner(self):
        other = create_user("other@pay.uz")
        Payment.objects.create(
            user=other,
            course=self.course,
            provider=Payment.Provider.SANDBOX,
            amount=100000,
        )
        mine = Payment.objects.create(
            user=self.student,
            course=self.course,
            provider=Payment.Provider.SANDBOX,
            amount=100000,
        )
        response = self.client.get("/api/payments/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data["results"]]
        self.assertIn(mine.id, ids)
        self.assertEqual(len(ids), 1)
