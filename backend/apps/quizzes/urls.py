from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import QuizAttemptViewSet, QuizViewSet

router = DefaultRouter()
router.register("quizzes", QuizViewSet, basename="quiz")
router.register("quiz-attempts", QuizAttemptViewSet, basename="quiz-attempt")

urlpatterns = [path("", include(router.urls))]
