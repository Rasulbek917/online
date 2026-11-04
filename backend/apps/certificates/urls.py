from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CertificateVerifyView, CertificateViewSet

router = DefaultRouter()
router.register("certificates", CertificateViewSet, basename="certificate")

urlpatterns = [
    path("certificates/verify/<str:certificate_id>/", CertificateVerifyView.as_view(), name="certificate-verify"),
    path("", include(router.urls)),
]
