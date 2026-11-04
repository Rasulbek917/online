from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PublicUserViewSet, UserViewSet

router = DefaultRouter()
router.register("", UserViewSet, basename="user")

urlpatterns = [
    path("public/<int:pk>/", PublicUserViewSet.as_view({"get": "retrieve"}), name="public-user"),
    path("", include(router.urls)),
]
