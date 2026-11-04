from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ClickCompleteView,
    ClickPrepareView,
    HumoCallbackView,
    HumoPrepareView,
    PaymentViewSet,
    PaymeCallbackView,
    UzumCallbackView,
    UzcardCallbackView,
    UzcardPrepareView,
)

router = DefaultRouter()
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = [
    path("payments/click/prepare/", ClickPrepareView.as_view(), name="click-prepare"),
    path("payments/click/complete/", ClickCompleteView.as_view(), name="click-complete"),
    path("payments/payme/", PaymeCallbackView.as_view(), name="payme-callback"),
    path("payments/uzum/callback/", UzumCallbackView.as_view(), name="uzum-callback"),
    path("payments/humo/prepare/", HumoPrepareView.as_view(), name="humo-prepare"),
    path("payments/humo/callback/", HumoCallbackView.as_view(), name="humo-callback"),
    path("payments/uzcard/prepare/", UzcardPrepareView.as_view(), name="uzcard-prepare"),
    path("payments/uzcard/callback/", UzcardCallbackView.as_view(), name="uzcard-callback"),
    path("", include(router.urls)),
]
