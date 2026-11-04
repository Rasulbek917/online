import hashlib
import logging
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.courses.models import Course
from common.permissions import IsAdminRole, IsTeacherOrAdmin
from common.utils import get_client_ip
from .models import Payment
from .serializers import CheckoutSerializer, PaymentAdminSerializer, PaymentSerializer
from .services import (
    create_payment,
    log_webhook,
    mark_payment_failed,
    mark_payment_processing,
    mark_payment_success,
    provider_configured,
)
from .models import PaymentCallback

logger = logging.getLogger("apps.payments")


class PaymentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PaymentSerializer
    throttle_scope = "payment"

    def get_queryset(self):
        user = self.request.user
        qs = Payment.objects.select_related("course", "course__teacher", "course__category", "user")
        if user.role == "admin" or user.is_superuser:
            return qs
        if user.role == "teacher":
            return qs.filter(course__teacher=user)
        return qs.filter(user=user)

    def get_serializer_class(self):
        if self.action in {"admin_list", "mark_paid"} or self.request.user.role in {"admin", "teacher"}:
            return PaymentAdminSerializer
        return PaymentSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return response

    @action(detail=False, methods=["post"], throttle_classes=[ScopedRateThrottle], throttle_scope="payment")
    def checkout(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = Course.objects.filter(
            slug=serializer.validated_data["course_slug"], status=Course.Status.PUBLISHED
        ).first()
        if not course:
            raise ValidationError({"course_slug": "Course not found or not published."})
        if course.is_free:
            raise ValidationError({"course_slug": "This course is free. Start learning instead."})
        payment = create_payment(
            request.user,
            course,
            serializer.validated_data["provider"],
            serializer.validated_data["billing_period"],
        )
        return Response(
            {
                "payment": PaymentSerializer(payment, context={"request": request}).data,
                "checkout_url": payment.checkout_url,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAdminRole])
    def mark_paid(self, request, pk=None):
        payment = self.get_object()
        if payment.status == Payment.Status.SUCCESS:
            return Response({"detail": "Payment already successful.", "payment": self.get_serializer(payment).data})
        transaction_id = request.data.get("provider_transaction_id") or f"manual-{payment.id}-{int(timezone.now().timestamp())}"
        payment, changed = mark_payment_success(
            payment.id,
            transaction_id,
            provider=payment.provider,
            payload={"verified_by": request.user.email, "manual": True},
        )
        return Response({"detail": "Payment verified and subscription activated.", "payment": self.get_serializer(payment).data})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def sandbox_confirm(self, request, pk=None):
        payment = self.get_object()
        if payment.user_id != request.user.id and request.user.role != "admin":
            raise PermissionDenied("Not your payment.")
        if payment.provider != Payment.Provider.SANDBOX:
            raise ValidationError("This is not a sandbox payment.")
        if not provider_configured(Payment.Provider.SANDBOX):
            raise ValidationError("Sandbox payments are disabled.")
        payment, changed = mark_payment_success(
            payment.id,
            f"sandbox-{payment.id}",
            provider=Payment.Provider.SANDBOX,
            payload={"sandbox": True, "confirmed_by": request.user.email},
        )
        return Response(
            {
                "detail": "Sandbox payment verified by the backend.",
                "payment": self.get_serializer(payment).data,
            }
        )

    @action(detail=False, methods=["get"])
    def methods(self, request):
        from .services import enabled_providers

        return Response({"providers": enabled_providers()})


def _record_callback(provider, payload, headers, ip, payment=None, external_id="", verified=False, error=""):
    try:
        phash = PaymentCallback.hash_payload(payload)
        cb, created = PaymentCallback.objects.get_or_create(
            provider=provider,
            payload_hash=phash,
            defaults={
                "external_transaction_id": str(external_id or "")[:128],
                "payment": payment,
                "received_at": timezone.now(),
                "processed": verified and not error,
            },
        )
        if not created and cb.processed:
            return cb, True
        if not cb.payment and payment:
            cb.payment = payment
        cb.external_transaction_id = str(external_id or cb.external_transaction_id)[:128]
        if verified and not error:
            cb.processed = True
        cb.save()
        log_webhook(provider, payload, headers, ip, verified=verified, payment=payment or cb.payment, error=error)
        return cb, (not created and cb.processed)
    except Exception:
        log_webhook(provider, payload, headers, ip, verified=verified, payment=payment, error=error)
        return None, False


class ClickPrepareView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment"
    authentication_classes = []

    def post(self, request):
        data = request.data
        cfg = settings.PAYMENT_SETTINGS
        required = ["click_trans_id", "service_id", "sign_time", "sign_string", "action", "merchant_trans_id", "amount"]
        if any(field not in data for field in required):
            return Response({"error": -2, "error_note": "Missing parameter"})
        raw = (
            f"{data['click_trans_id']}{cfg['CLICK_SERVICE_ID']}{cfg['CLICK_SECRET_KEY']}"
            f"{data['merchant_trans_id']}{data['amount']}{data['action']}{data['sign_time']}"
        )
        expected = hashlib.md5(raw.encode()).hexdigest()
        if expected != str(data["sign_string"]).lower():
            _record_callback("click", data, request.headers, get_client_ip(request), external_id=data.get("click_trans_id"), error="bad signature")
            return Response({"error": -1, "error_note": "SIGN CHECK FAILED"})
        if str(data["service_id"]) != str(cfg["CLICK_SERVICE_ID"]):
            return Response({"error": -2, "error_note": "Invalid service"})
        payment = Payment.objects.filter(pk=data["merchant_trans_id"], provider=Payment.Provider.CLICK).first()
        if not payment:
            _record_callback("click", data, request.headers, get_client_ip(request), external_id=data.get("click_trans_id"), error="order not found")
            return Response({"error": -5, "error_note": "Order not found"})
        try:
            sent_amount = Decimal(str(data["amount"]))
        except InvalidOperation:
            _record_callback("click", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("click_trans_id"), error="invalid amount")
            return Response({"error": -2, "error_note": "Invalid amount"})
        if sent_amount != payment.amount:
            _record_callback("click", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("click_trans_id"), verified=True, error="amount mismatch")
            return Response({"error": -6, "error_note": "Incorrect amount"})
        cb, duplicate = _record_callback("click", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("click_trans_id"), verified=True)
        if duplicate:
            return Response(
                {
                    "click_trans_id": data["click_trans_id"],
                    "merchant_trans_id": str(payment.id),
                    "merchant_prepare_id": payment.id,
                    "error": 0,
                    "error_note": "Already processed",
                }
            )
        if payment.status == Payment.Status.SUCCESS:
            return Response(
                {
                    "click_trans_id": data["click_trans_id"],
                    "merchant_trans_id": str(payment.id),
                    "merchant_prepare_id": payment.id,
                    "error": 0,
                    "error_note": "Already paid",
                }
            )
        mark_payment_processing(payment.id, data["click_trans_id"], {"prepare": data})
        return Response(
            {
                "click_trans_id": data["click_trans_id"],
                "merchant_trans_id": str(payment.id),
                "merchant_prepare_id": payment.id,
                "error": 0,
                "error_note": "Success",
            }
        )


class ClickCompleteView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment"
    authentication_classes = []

    def post(self, request):
        data = request.data
        cfg = settings.PAYMENT_SETTINGS
        required = ["click_trans_id", "service_id", "sign_time", "sign_string", "action", "merchant_trans_id", "amount"]
        if any(field not in data for field in required):
            return Response({"error": -2, "error_note": "Missing parameter"})
        raw = (
            f"{data['click_trans_id']}{cfg['CLICK_SERVICE_ID']}{cfg['CLICK_SECRET_KEY']}"
            f"{data['merchant_trans_id']}{data['amount']}{data['action']}{data['sign_time']}"
        )
        if hashlib.md5(raw.encode()).hexdigest() != str(data["sign_string"]).lower():
            _record_callback("click", data, request.headers, get_client_ip(request), external_id=data.get("click_trans_id"), error="bad signature")
            return Response({"error": -1, "error_note": "SIGN CHECK FAILED"})
        payment = Payment.objects.filter(pk=data["merchant_trans_id"], provider=Payment.Provider.CLICK).first()
        if not payment:
            _record_callback("click", data, request.headers, get_client_ip(request), external_id=data.get("click_trans_id"), error="order not found")
            return Response({"error": -5, "error_note": "Order not found"})
        if payment.provider_transaction_id and str(payment.provider_transaction_id) != str(data["click_trans_id"]):
            _record_callback("click", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("click_trans_id"), verified=True, error="transaction mismatch")
            return Response({"error": -8, "error_note": "Transaction not found"})
        cb, duplicate = _record_callback("click", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("click_trans_id"), verified=True)
        if duplicate and payment.status == Payment.Status.SUCCESS:
            return Response(
                {
                    "click_trans_id": data["click_trans_id"],
                    "merchant_trans_id": str(payment.id),
                    "merchant_confirm_id": payment.id,
                    "error": 0,
                    "error_note": "Already confirmed",
                }
            )
        if str(data.get("error", 0)) not in {"0", "0.0"}:
            mark_payment_failed(payment.id, data.get("error_note", "Click declined"), data["click_trans_id"], data)
            return Response({"error": 0, "error_note": "Saved failure"})
        try:
            if Decimal(str(data["amount"])) != payment.amount:
                _record_callback("click", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("click_trans_id"), verified=True, error="amount mismatch")
                return Response({"error": -6, "error_note": "Incorrect amount"})
            payment, _ = mark_payment_success(
                payment.id,
                data["click_trans_id"],
                provider=Payment.Provider.CLICK,
                payload={"complete": data},
                expected_amount=payment.amount,
            )
        except ValidationError as exc:
            _record_callback("click", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("click_trans_id"), verified=True, error=str(exc))
            return Response({"error": -8, "error_note": "Could not complete"})
        return Response(
            {
                "click_trans_id": data["click_trans_id"],
                "merchant_trans_id": str(payment.id),
                "merchant_confirm_id": payment.id,
                "error": 0,
                "error_note": "Success",
            }
        )


def payme_error(request_id, code, message, data=None):
    return Response(
        {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": code,
                "message": message,
                "data": data or message,
            },
        }
    )


class PaymeCallbackView(APIView):
    """Payme Merchant API (JSON-RPC). Docs: https://developer.payme.uz"""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment"
    authentication_classes = []
    http_method_names = ["post"]

    def post(self, request):
        import base64

        cfg = settings.PAYMENT_SETTINGS
        auth = request.headers.get("Authorization", "")
        expected = "Basic " + base64.b64encode(f"Paycom:{cfg['PAYME_SECRET_KEY']}".encode()).decode()
        if not cfg["PAYME_SECRET_KEY"] or auth != expected:
            _record_callback("payme", request.data, request.headers, get_client_ip(request), external_id=(request.data.get("params") or {}).get("id"), error="bad auth")
            return payme_error(request.data.get("id"), -32504, "Authorization failed")
        payload = request.data
        method = payload.get("method")
        params = payload.get("params", {})
        request_id = payload.get("id")
        handler = {
            "CheckPerformTransaction": self.check_perform,
            "CreateTransaction": self.create_transaction,
            "PerformTransaction": self.perform_transaction,
            "CancelTransaction": self.cancel_transaction,
            "CheckTransaction": self.check_transaction,
            "GetStatement": self.get_statement,
        }.get(method)
        if not handler:
            return payme_error(request_id, -32601, "Method not found")
        try:
            result = handler(params)
            if isinstance(result, Response):
                return result
            return Response({"jsonrpc": "2.0", "id": request_id, "result": result})
        except ValidationError as exc:
            return payme_error(request_id, -31050, str(exc.detail))

    @staticmethod
    def _payment(params):
        account = params.get("account", {})
        order_id = account.get("order_id") or account.get("orderId")
        if not order_id:
            raise ValidationError("order_id is required")
        return Payment.objects.filter(pk=order_id, provider=Payment.Provider.PAYME).select_related("course").first()

    @staticmethod
    def _amount_matches(payment, amount_tiyin):
        try:
            return Decimal(str(payment.amount)) * 100 == Decimal(str(amount_tiyin))
        except InvalidOperation:
            return False

    def check_perform(self, params):
        payment = self._payment(params)
        if not payment:
            return payme_error(None, -31050, "Order not found")
        if payment.status in {Payment.Status.CANCELED, Payment.Status.REFUNDED}:
            return payme_error(None, -31051, "Order canceled")
        if not self._amount_matches(payment, params.get("amount")):
            return payme_error(None, -31001, "Incorrect amount")
        return {"allow": True}

    def create_transaction(self, params):
        payment = self._payment(params)
        if not payment:
            return payme_error(None, -31050, "Order not found")
        transaction_id = params.get("id")
        if not transaction_id:
            return payme_error(None, -31050, "Transaction id required")
        if not self._amount_matches(payment, params.get("amount")):
            return payme_error(None, -31001, "Incorrect amount")
        existing = Payment.objects.filter(provider_transaction_id=transaction_id, provider=Payment.Provider.PAYME).first()
        if existing:
            if existing.id != payment.id:
                return payme_error(None, -31008, "Transaction already exists")
            return {
                "create_time": int(existing.created_at.timestamp() * 1000),
                "transaction": transaction_id,
                "state": 1 if existing.status != Payment.Status.SUCCESS else 2,
            }
        if payment.status not in {Payment.Status.PENDING, Payment.Status.PROCESSING}:
            return payme_error(None, -31008, "Order cannot be paid")
        cb, duplicate = _record_callback("payme", {"method": "CreateTransaction", "params": params}, {}, get_client_ip(self.request), payment=payment, external_id=transaction_id, verified=True)
        if duplicate and payment.status == Payment.Status.PROCESSING:
            return {
                "create_time": int(payment.updated_at.timestamp() * 1000),
                "transaction": transaction_id,
                "state": 1,
            }
        payment = mark_payment_processing(payment.id, transaction_id, {"payme_create": params})
        return {
            "create_time": int(payment.updated_at.timestamp() * 1000),
            "transaction": transaction_id,
            "state": 1,
        }

    def perform_transaction(self, params):
        transaction_id = params.get("id")
        payment = Payment.objects.filter(
            provider_transaction_id=transaction_id, provider=Payment.Provider.PAYME
        ).first()
        if not payment:
            return payme_error(None, -31003, "Transaction not found")
        if payment.status == Payment.Status.SUCCESS:
            return {
                "transaction": transaction_id,
                "perform_time": int((payment.paid_at or payment.updated_at).timestamp() * 1000),
                "state": 2,
            }
        cb, duplicate = _record_callback("payme", {"method": "PerformTransaction", "params": params}, {}, get_client_ip(self.request), payment=payment, external_id=transaction_id, verified=True)
        if duplicate:
            payment.refresh_from_db()
            return {
                "transaction": transaction_id,
                "perform_time": int((payment.paid_at or payment.updated_at).timestamp() * 1000),
                "state": 2 if payment.status == Payment.Status.SUCCESS else 1,
            }
        payment, _ = mark_payment_success(
            payment.id,
            transaction_id,
            provider=Payment.Provider.PAYME,
            payload={"payme_perform": params},
            expected_amount=payment.amount,
        )
        return {
            "transaction": transaction_id,
            "perform_time": int(payment.paid_at.timestamp() * 1000),
            "state": 2,
        }

    def cancel_transaction(self, params):
        from django.utils import timezone

        transaction_id = params.get("id")
        payment = Payment.objects.filter(
            provider_transaction_id=transaction_id, provider=Payment.Provider.PAYME
        ).first()
        if not payment:
            return payme_error(None, -31003, "Transaction not found")
        state = -2 if payment.status == Payment.Status.SUCCESS else -1
        if payment.status not in {Payment.Status.REFUNDED, Payment.Status.CANCELED}:
            payment.status = Payment.Status.REFUNDED if state == -2 else Payment.Status.CANCELED
            payment.save(update_fields=["status", "updated_at"])
        _record_callback("payme", {"method": "CancelTransaction", "params": params}, {}, get_client_ip(self.request), payment=payment, external_id=transaction_id, verified=True)
        return {
            "transaction": transaction_id,
            "cancel_time": int(timezone.now().timestamp() * 1000),
            "state": state,
        }

    def check_transaction(self, params):
        transaction_id = params.get("id")
        payment = Payment.objects.filter(
            provider_transaction_id=transaction_id, provider=Payment.Provider.PAYME
        ).first()
        if not payment:
            return payme_error(None, -31003, "Transaction not found")
        state = 2 if payment.status == Payment.Status.SUCCESS else (1 if payment.status == Payment.Status.PROCESSING else -1)
        return {
            "create_time": int(payment.created_at.timestamp() * 1000),
            "perform_time": int(payment.paid_at.timestamp() * 1000) if payment.paid_at else 0,
            "cancel_time": 0,
            "transaction": transaction_id,
            "state": state,
            "reason": None if state >= 0 else 1,
        }

    def get_statement(self, params):
        from django.utils import timezone
        from datetime import datetime

        start = datetime.fromtimestamp(params.get("from", 0) / 1000, tz=timezone.utc)
        end = datetime.fromtimestamp(params.get("to", timezone.now().timestamp() * 1000) / 1000, tz=timezone.utc)
        payments = Payment.objects.filter(
            provider=Payment.Provider.PAYME,
            created_at__gte=start,
            created_at__lte=end,
            provider_transaction_id__isnull=False,
        )
        return {
            "transactions": [
                {
                    "id": payment.provider_transaction_id,
                    "time": int(payment.created_at.timestamp() * 1000),
                    "amount": int(payment.amount * 100),
                    "account": {"order_id": str(payment.id)},
                    "create_time": int(payment.created_at.timestamp() * 1000),
                    "perform_time": int(payment.paid_at.timestamp() * 1000) if payment.paid_at else 0,
                    "cancel_time": 0,
                    "transaction": payment.provider_transaction_id,
                    "state": 2 if payment.status == Payment.Status.SUCCESS else 1,
                    "reason": None,
                }
                for payment in payments
            ]
        }


class UzumCallbackView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment"
    authentication_classes = []
    http_method_names = ["post"]

    def post(self, request):
        cfg = settings.PAYMENT_SETTINGS
        token = request.headers.get("Authorization", "")
        provided = token.replace("Bearer ", "").strip() or request.headers.get("X-Api-Key", "") or request.headers.get("X-Api-Token", "")
        expected = cfg.get("UZUM_API_KEY") or cfg.get("UZUM_SECRET_KEY")
        if not expected or provided != expected:
            _record_callback("uzum", request.data, request.headers, get_client_ip(request), error="bad auth")
            return Response({"status": "DENIED", "message": "Invalid API key"}, status=status.HTTP_401_UNAUTHORIZED)
        data = request.data
        order_id = data.get("orderId") or data.get("order_id") or data.get("merchant_trans_id")
        transaction_id = data.get("transId") or data.get("transactionId") or data.get("trans_id") or data.get("payment_id")
        payment = Payment.objects.filter(pk=order_id, provider=Payment.Provider.UZUM).first()
        if not payment:
            _record_callback("uzum", data, request.headers, get_client_ip(request), external_id=transaction_id, error="order not found")
            return Response({"status": "FAILED", "message": "Order not found"}, status=404)
        cb, duplicate = _record_callback("uzum", data, request.headers, get_client_ip(request), payment=payment, external_id=transaction_id, verified=True)
        if duplicate and payment.status == Payment.Status.SUCCESS:
            return Response({"status": "OK", "orderId": str(payment.id)})
        state = str(data.get("status", "")).upper()
        if state in {"SUCCESS", "PAID", "COMPLETED", "CONFIRMED", "OK"}:
            amount = data.get("amount")
            if amount is not None:
                try:
                    sent = Decimal(str(amount))
                    if sent not in {payment.amount, payment.amount * 100}:
                        _record_callback("uzum", data, request.headers, get_client_ip(request), payment=payment, external_id=transaction_id, verified=True, error="amount mismatch")
                        return Response({"status": "FAILED", "message": "Amount mismatch"}, status=400)
                except InvalidOperation:
                    _record_callback("uzum", data, request.headers, get_client_ip(request), payment=payment, external_id=transaction_id, verified=True, error="invalid amount")
                    return Response({"status": "FAILED", "message": "Invalid amount"}, status=400)
            payment, _ = mark_payment_success(
                payment.id,
                transaction_id or f"uzum-{payment.id}",
                provider=Payment.Provider.UZUM,
                payload=data,
                expected_amount=payment.amount,
            )
            return Response({"status": "OK", "orderId": str(payment.id)})
        mark_payment_failed(payment.id, data.get("message") or state, transaction_id, data)
        return Response({"status": "OK", "orderId": str(payment.id)})


class HumoPrepareView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment"
    authentication_classes = []
    http_method_names = ["post"]

    def post(self, request):
        cfg = settings.PAYMENT_SETTINGS
        data = request.data
        required = ["merchant_id", "service_id", "order_id", "amount", "sign_string", "sign_time"]
        if not cfg.get("HUMO_MERCHANT_ID") or not cfg.get("HUMO_SECRET_KEY"):
            _record_callback("humo", data, request.headers, get_client_ip(request), error="not configured")
            return Response({"error": -1, "error_note": "HUMO is not configured"}, status=503)
        if any(field not in data for field in required):
            return Response({"error": -2, "error_note": "Missing parameter"})
        raw = f"{cfg['HUMO_SECRET_KEY']}{data.get('merchant_id')}{data.get('service_id')}{data.get('order_id')}{data.get('amount')}{data.get('sign_time')}"
        if hashlib.md5(raw.encode()).hexdigest() != str(data.get("sign_string")).lower():
            _record_callback("humo", data, request.headers, get_client_ip(request), external_id=data.get("order_id"), error="bad signature")
            return Response({"error": -1, "error_note": "SIGN CHECK FAILED"})
        payment = Payment.objects.filter(pk=data.get("order_id"), provider=Payment.Provider.HUMO).first()
        if not payment:
            _record_callback("humo", data, request.headers, get_client_ip(request), external_id=data.get("order_id"), error="order not found")
            return Response({"error": -5, "error_note": "Order not found"})
        try:
            if Decimal(str(data.get("amount"))) != payment.amount:
                _record_callback("humo", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("order_id"), verified=True, error="amount mismatch")
                return Response({"error": -6, "error_note": "Incorrect amount"})
        except InvalidOperation:
            return Response({"error": -2, "error_note": "Invalid amount"})
        cb, duplicate = _record_callback("humo", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("order_id"), verified=True)
        if duplicate:
            return Response({"error": 0, "error_note": "Already processed", "order_id": str(payment.id)})
        if payment.status == Payment.Status.SUCCESS:
            return Response({"error": 0, "error_note": "Already paid", "order_id": str(payment.id)})
        mark_payment_processing(payment.id, data.get("order_id"), {"humo_prepare": data})
        return Response({"error": 0, "error_note": "Success", "order_id": str(payment.id)})


class HumoCallbackView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment"
    authentication_classes = []
    http_method_names = ["post"]

    def post(self, request):
        cfg = settings.PAYMENT_SETTINGS
        data = request.data
        if not cfg.get("HUMO_MERCHANT_ID") or not cfg.get("HUMO_SECRET_KEY"):
            _record_callback("humo", data, request.headers, get_client_ip(request), error="not configured")
            return Response({"error": -1, "error_note": "HUMO is not configured"}, status=503)
        required = ["merchant_id", "order_id", "amount", "sign_string", "sign_time", "status"]
        if any(field not in data for field in required):
            return Response({"error": -2, "error_note": "Missing parameter"})
        raw = f"{cfg['HUMO_SECRET_KEY']}{data.get('merchant_id')}{data.get('order_id')}{data.get('amount')}{data.get('status')}{data.get('sign_time')}"
        if hashlib.md5(raw.encode()).hexdigest() != str(data.get("sign_string")).lower():
            _record_callback("humo", data, request.headers, get_client_ip(request), external_id=data.get("order_id"), error="bad signature")
            return Response({"error": -1, "error_note": "SIGN CHECK FAILED"})
        payment = Payment.objects.filter(pk=data.get("order_id"), provider=Payment.Provider.HUMO).first()
        if not payment:
            _record_callback("humo", data, request.headers, get_client_ip(request), external_id=data.get("order_id"), error="order not found")
            return Response({"error": -5, "error_note": "Order not found"})
        cb, duplicate = _record_callback("humo", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("order_id"), verified=True)
        if duplicate and payment.status == Payment.Status.SUCCESS:
            return Response({"error": 0, "error_note": "Already confirmed", "order_id": str(payment.id)})
        if str(data.get("status")).upper() in {"SUCCESS", "PAID", "COMPLETED", "OK"}:
            try:
                if Decimal(str(data.get("amount"))) != payment.amount:
                    return Response({"error": -6, "error_note": "Incorrect amount"})
                payment, _ = mark_payment_success(
                    payment.id,
                    data.get("transaction_id") or data.get("order_id"),
                    provider=Payment.Provider.HUMO,
                    payload=data,
                    expected_amount=payment.amount,
                )
            except ValidationError as exc:
                _record_callback("humo", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("order_id"), verified=True, error=str(exc))
                return Response({"error": -8, "error_note": "Could not complete"})
            return Response({"error": 0, "error_note": "Success", "order_id": str(payment.id)})
        mark_payment_failed(payment.id, data.get("error_note") or "HUMO declined", data.get("transaction_id"), data)
        return Response({"error": 0, "error_note": "Saved failure", "order_id": str(payment.id)})


class UzcardPrepareView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment"
    authentication_classes = []
    http_method_names = ["post"]

    def post(self, request):
        cfg = settings.PAYMENT_SETTINGS
        data = request.data
        if not cfg.get("UZCARD_MERCHANT_ID") or not cfg.get("UZCARD_SECRET_KEY"):
            _record_callback("uzcard", data, request.headers, get_client_ip(request), error="not configured")
            return Response({"error": -1, "error_note": "UZCARD is not configured"}, status=503)
        required = ["merchant_id", "order_id", "amount", "sign_string", "sign_time"]
        if any(field not in data for field in required):
            return Response({"error": -2, "error_note": "Missing parameter"})
        raw = f"{cfg['UZCARD_SECRET_KEY']}{data.get('merchant_id')}{data.get('order_id')}{data.get('amount')}{data.get('sign_time')}"
        if hashlib.md5(raw.encode()).hexdigest() != str(data.get("sign_string")).lower():
            _record_callback("uzcard", data, request.headers, get_client_ip(request), external_id=data.get("order_id"), error="bad signature")
            return Response({"error": -1, "error_note": "SIGN CHECK FAILED"})
        payment = Payment.objects.filter(pk=data.get("order_id"), provider=Payment.Provider.UZCARD).first()
        if not payment:
            _record_callback("uzcard", data, request.headers, get_client_ip(request), external_id=data.get("order_id"), error="order not found")
            return Response({"error": -5, "error_note": "Order not found"})
        try:
            if Decimal(str(data.get("amount"))) != payment.amount:
                _record_callback("uzcard", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("order_id"), verified=True, error="amount mismatch")
                return Response({"error": -6, "error_note": "Incorrect amount"})
        except InvalidOperation:
            return Response({"error": -2, "error_note": "Invalid amount"})
        cb, duplicate = _record_callback("uzcard", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("order_id"), verified=True)
        if duplicate:
            return Response({"error": 0, "error_note": "Already processed", "order_id": str(payment.id)})
        if payment.status == Payment.Status.SUCCESS:
            return Response({"error": 0, "error_note": "Already paid", "order_id": str(payment.id)})
        mark_payment_processing(payment.id, data.get("order_id"), {"uzcard_prepare": data})
        return Response({"error": 0, "error_note": "Success", "order_id": str(payment.id)})


class UzcardCallbackView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment"
    authentication_classes = []
    http_method_names = ["post"]

    def post(self, request):
        cfg = settings.PAYMENT_SETTINGS
        data = request.data
        if not cfg.get("UZCARD_MERCHANT_ID") or not cfg.get("UZCARD_SECRET_KEY"):
            _record_callback("uzcard", data, request.headers, get_client_ip(request), error="not configured")
            return Response({"error": -1, "error_note": "UZCARD is not configured"}, status=503)
        required = ["merchant_id", "order_id", "amount", "sign_string", "sign_time", "status"]
        if any(field not in data for field in required):
            return Response({"error": -2, "error_note": "Missing parameter"})
        raw = f"{cfg['UZCARD_SECRET_KEY']}{data.get('merchant_id')}{data.get('order_id')}{data.get('amount')}{data.get('status')}{data.get('sign_time')}"
        if hashlib.md5(raw.encode()).hexdigest() != str(data.get("sign_string")).lower():
            _record_callback("uzcard", data, request.headers, get_client_ip(request), external_id=data.get("order_id"), error="bad signature")
            return Response({"error": -1, "error_note": "SIGN CHECK FAILED"})
        payment = Payment.objects.filter(pk=data.get("order_id"), provider=Payment.Provider.UZCARD).first()
        if not payment:
            _record_callback("uzcard", data, request.headers, get_client_ip(request), external_id=data.get("order_id"), error="order not found")
            return Response({"error": -5, "error_note": "Order not found"})
        cb, duplicate = _record_callback("uzcard", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("order_id"), verified=True)
        if duplicate and payment.status == Payment.Status.SUCCESS:
            return Response({"error": 0, "error_note": "Already confirmed", "order_id": str(payment.id)})
        if str(data.get("status")).upper() in {"SUCCESS", "PAID", "COMPLETED", "OK"}:
            try:
                if Decimal(str(data.get("amount"))) != payment.amount:
                    return Response({"error": -6, "error_note": "Incorrect amount"})
                payment, _ = mark_payment_success(
                    payment.id,
                    data.get("transaction_id") or data.get("order_id"),
                    provider=Payment.Provider.UZCARD,
                    payload=data,
                    expected_amount=payment.amount,
                )
            except ValidationError as exc:
                _record_callback("uzcard", data, request.headers, get_client_ip(request), payment=payment, external_id=data.get("order_id"), verified=True, error=str(exc))
                return Response({"error": -8, "error_note": "Could not complete"})
            return Response({"error": 0, "error_note": "Success", "order_id": str(payment.id)})
        mark_payment_failed(payment.id, data.get("error_note") or "UZCARD declined", data.get("transaction_id"), data)
        return Response({"error": 0, "error_note": "Saved failure", "order_id": str(payment.id)})
