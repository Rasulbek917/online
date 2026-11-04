from celery import shared_task


@shared_task
def rebuild_daily_analytics():
    from datetime import timedelta

    from django.utils import timezone

    from .services import rebuild_daily_analytics as rebuild_for_date

    today = timezone.localdate()
    rebuild_for_date(today)
    for i in range(1, 31):
        rebuild_for_date(today - timedelta(days=i))
    return "done"


@shared_task
def compute_leaderboard_all():
    from .services import compute_leaderboard

    for period in ["all", "month", "week"]:
        compute_leaderboard(period)
    return "done"
