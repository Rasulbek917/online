from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    CourseViewSet,
    DiscountViewSet,
    EnrollmentViewSet,
    LessonViewSet,
    ProgressViewSet,
    PublicLearningView,
    SectionViewSet,
    VideoStreamView,
    VideoViewSet,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("courses", CourseViewSet, basename="course")
router.register("sections", SectionViewSet, basename="section")
router.register("lessons", LessonViewSet, basename="lesson")
router.register("videos", VideoViewSet, basename="video")
router.register("discounts", DiscountViewSet, basename="discount")
router.register("enrollments", EnrollmentViewSet, basename="enrollment")
router.register("progress", ProgressViewSet, basename="progress")

urlpatterns = [
    path("videos/<int:pk>/stream/", VideoStreamView.as_view(), name="video-stream"),
    path("free-courses/", PublicLearningView.as_view(), name="free-courses"),
    path("", include(router.urls)),
]
