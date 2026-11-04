"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Pin, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn, formatRelative, getErrorMessage } from "@/lib/utils";
import type { Comment, CommentReply, Paginated } from "@/lib/types";

interface CommentSectionProps {
  courseSlug: string;
  lessonId?: number;
  compact?: boolean;
}

export function CommentSection({ courseSlug, lessonId, compact }: CommentSectionProps) {
  const { t, lang } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);

  const commentsKey = ["comments", courseSlug, lessonId ?? null];

  const comments = useQuery({
    queryKey: commentsKey,
    queryFn: () =>
      apiRequest<Paginated<Comment>>("/api/comments/", {
        auth: false,
        query: { course_slug: courseSlug, lesson_id: lessonId, page_size: compact ? 6 : 50 },
      }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: commentsKey });
  };

  const createComment = useMutation({
    mutationFn: () =>
      apiRequest<Comment>("/api/comments/", {
        method: "POST",
        body: { course_slug: courseSlug, lesson_id: lessonId, body },
      }),
    onSuccess: () => {
      setBody("");
      invalidate();
      toast.success(t("toast.commentAdded"));
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const reply = useMutation({
    mutationFn: (commentId: number) =>
      apiRequest<CommentReply>(`/api/comments/${commentId}/reply/`, {
        method: "POST",
        body: { body: replyBody },
      }),
    onSuccess: () => {
      setReplyBody("");
      setReplyTo(null);
      invalidate();
      toast.success(t("toast.replyAdded"));
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const remove = useMutation({
    mutationFn: (commentId: number) => apiRequest(`/api/comments/${commentId}/`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
      toast.success(t("toast.deleted"));
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const pin = useMutation({
    mutationFn: (commentId: number) =>
      apiRequest(`/api/comments/${commentId}/pin/`, { method: "POST" }),
    onSuccess: () => invalidate(),
  });

  const items = comments.data?.results ?? [];

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{t("comments.title")}</h2>
        {comments.data ? (
          <Badge variant="muted" className="ml-1">
            {comments.data.count}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t("comments.subtitle")}</p>

      {isAuthenticated ? (
        <div className="flex gap-3">
          <UserAvatar name={user?.full_name} src={user?.avatar} className="mt-1 h-9 w-9" />
          <div className="flex-1 space-y-2">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("comments.placeholder")}
              className="min-h-[90px]"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="gradient"
                disabled={!body.trim() || createComment.isPending}
                onClick={() => createComment.mutate()}
              >
                <Send className="h-3.5 w-3.5" />
                {createComment.isPending ? t("common.saving") : t("comments.send")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("comments.loginToComment")}</p>
          <Button asChild size="sm" variant="outline">
            <Link href={`/login?next=/courses/${courseSlug}`}>{t("nav.login")}</Link>
          </Button>
        </div>
      )}

      {comments.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((index) => (
            <div key={index} className="surface h-24 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t("comments.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              lang={lang}
              userId={user?.id}
              isStaff={user?.role === "teacher" || user?.role === "admin"}
              replyOpen={replyTo === comment.id}
              replyBody={replyBody}
              onReplyBody={setReplyBody}
              onToggleReply={() => {
                setReplyTo(replyTo === comment.id ? null : comment.id);
                setReplyBody("");
              }}
              onReply={() => reply.mutate(comment.id)}
              replying={reply.isPending}
              onPin={() => pin.mutate(comment.id)}
              onDelete={() => setDeleteTarget(comment)}
            />
          ))}
        </div>
      )}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("comments.delete")}</DialogTitle>
            <DialogDescription>{t("comments.deleteConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CommentItem({
  comment,
  lang,
  userId,
  isStaff,
  replyOpen,
  replyBody,
  onReplyBody,
  onToggleReply,
  onReply,
  replying,
  onPin,
  onDelete,
}: {
  comment: Comment;
  lang: "uz" | "ru";
  userId?: number;
  isStaff: boolean;
  replyOpen: boolean;
  replyBody: string;
  onReplyBody: (value: string) => void;
  onToggleReply: () => void;
  onReply: () => void;
  replying: boolean;
  onPin: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <article
      className={cn(
        "surface p-4",
        comment.is_pinned && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3">
        <UserAvatar name={comment.user.full_name} src={comment.user.avatar} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{comment.user.full_name}</span>
            {comment.user.role !== "student" && (
              <Badge variant="default" className="gap-1 px-1.5 py-0 text-[10px]">
                <ShieldCheck className="h-3 w-3" />
                {t("comments.teacher")}
              </Badge>
            )}
            {comment.is_pinned && (
              <Badge variant="gold" className="gap-1 px-1.5 py-0 text-[10px]">
                <Pin className="h-3 w-3" />
                {t("comments.pinned")}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">
              {formatRelative(comment.created_at, lang)}
            </span>
          </div>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {comment.is_deleted ? <span className="italic text-muted-foreground">—</span> : comment.body}
          </p>

          {!comment.is_deleted && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <button onClick={onToggleReply} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                <MessageSquare className="h-3 w-3" /> {t("comments.reply")}
              </button>
              {(isStaff || comment.can_moderate) && (
                <button onClick={onPin} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                  <Pin className="h-3 w-3" /> {t("comments.pinned")}
                </button>
              )}
              {comment.can_moderate && (
                <button onClick={onDelete} className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" /> {t("common.delete")}
                </button>
              )}
            </div>
          )}

          {comment.replies.length > 0 && (
            <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
              {comment.replies
                .filter((replyItem) => !replyItem.is_deleted)
                .map((replyItem) => (
                  <div key={replyItem.id} className="flex items-start gap-2.5">
                    <UserAvatar
                      name={replyItem.user.full_name}
                      src={replyItem.user.avatar}
                      className="h-7 w-7"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold">{replyItem.user.full_name}</span>
                        {replyItem.user.role !== "student" && (
                          <Badge variant="default" className="px-1.5 py-0 text-[9px]">
                            {t("comments.teacher")}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelative(replyItem.created_at, lang)}
                        </span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-line text-sm text-foreground/90">{replyItem.body}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {replyOpen && (
            <div className="mt-3 space-y-2">
              <Textarea
                value={replyBody}
                onChange={(event) => onReplyBody(event.target.value)}
                placeholder={t("comments.replyPlaceholder")}
                className="min-h-[70px] text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onToggleReply}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" disabled={!replyBody.trim() || replying} onClick={onReply}>
                  {t("comments.reply")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
