from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class Comment(TimeStampedModel):
    course = models.ForeignKey("courses.Course", on_delete=models.CASCADE, related_name="comments")
    lesson = models.ForeignKey(
        "courses.Lesson", on_delete=models.CASCADE, null=True, blank=True, related_name="comments"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    body = models.TextField(max_length=4000)
    is_pinned = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False, db_index=True)
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderated_comments",
    )

    class Meta:
        ordering = ["-is_pinned", "-created_at"]
        indexes = [
            models.Index(fields=["course", "lesson", "is_deleted"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"{self.user_id}: {self.body[:60]}"


class CommentReply(TimeStampedModel):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="replies")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comment_replies"
    )
    body = models.TextField(max_length=4000)
    is_deleted = models.BooleanField(default=False, db_index=True)
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderated_replies",
    )

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["comment", "is_deleted"])]

    def __str__(self):
        return f"Reply by {self.user_id} on {self.comment_id}"
