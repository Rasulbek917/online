from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.analytics.views import health_check, public_stats, public_testimonials

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", health_check, name="health"),
    path("api/stats/", public_stats, name="public-stats"),
    path("api/testimonials/", public_testimonials, name="public-testimonials"),
    path("api/auth/", include("apps.users.auth_urls")),
    path("api/users/", include("apps.users.urls")),
    path("api/", include("apps.courses.urls")),
    path("api/", include("apps.quizzes.urls")),
    path("api/", include("apps.payments.urls")),
    path("api/", include("apps.subscriptions.urls")),
    path("api/", include("apps.certificates.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.comments.urls")),
    path("api/", include("apps.analytics.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "IT PARK ACADEMY Administration"
admin.site.site_title = "IT PARK ACADEMY"
admin.site.index_title = "Platform management"
