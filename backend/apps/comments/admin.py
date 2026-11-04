from django.contrib import admin

from .models import Comment, CommentReply


class ReplyInline(admin.TabularInline):
    model = CommentReply
    extra = 0


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("user", "course", "lesson", "is_pinned", "is_deleted", "created_at")
    list_filter = ("is_deleted", "is_pinned", "created_at")
    search_fields = ("user__email", "body", "course__title_uz")
    autocomplete_fields = ("course", "lesson", "user")
    inlines = [ReplyInline]


@admin.register(CommentReply)
class CommentReplyAdmin(admin.ModelAdmin):
    list_display = ("user", "comment", "is_deleted", "created_at")
    search_fields = ("user__email", "body")
    autocomplete_fields = ("comment", "user")
