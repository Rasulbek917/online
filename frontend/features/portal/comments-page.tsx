"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Pin, PinOff, Search, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/error-state";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useMyCourses } from "@/lib/queries";
import { usePortalComments } from "@/lib/portal";
import { formatDateTime, initials } from "@/lib/utils";
import type { Comment } from "@/lib/types";
import { PageHeading } from "@/features/dashboard/shared";
import { ConfirmDialog, LoadingTable, TableEmpty } from "./shared";

export function CommentsPage({ role }: { role: "teacher" | "admin" }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const courses = useMyCourses();
  const [courseSlug, setCourseSlug] = useState("all");
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [toDelete, setToDelete] = useState<Comment | null>(null);

  const comments = usePortalComments(role === "teacher" ? "teacher" : "all", courseSlug === "all" ? undefined : courseSlug);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal", "comments"] });

  const reply = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      apiRequest(`/api/comments/${id}/reply/`, { method: "POST", body: { body } }),
    onSuccess: () => {
      toast.success(t("portal.saved"));
      setReplyTo(null);
      setReplyBody("");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const pin = useMutation({
    mutationFn: (comment: Comment) => apiRequest(`/api/comments/${comment.id}/pin/`, { method: "POST", body: {} }),
    onSuccess: (_data, comment) => {
      toast.success(comment.is_pinned ? t("portal.unpin") : t("portal.pin"));
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const remove = useMutation({
    mutationFn: (comment: Comment) => apiRequest(`/api/comments/${comment.id}/`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("portal.deleted"));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const courseMap = useMemo(() => {
    const map = new Map<number, string>();
    (courses.data?.results ?? []).forEach((course) => map.set(course.id, course.title));
    return map;
  }, [courses.data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const items = comments.data?.results ?? [];
    if (!query) return items;
    return items.filter(
      (comment) =>
        comment.body.toLowerCase().includes(query) ||
        comment.user?.full_name?.toLowerCase().includes(query) ||
        comment.lesson_title?.toLowerCase().includes(query),
    );
  }, [comments.data, search]);

  if (comments.isError) {
    return (
      <ErrorState
        message={comments.error instanceof Error ? comments.error.message : undefined}
        onRetry={() => comments.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow={role === "teacher" ? t("teacher.title") : t("admin.title")}
        title={t("portal.comments")}
        subtitle={role === "teacher" ? t("teacher.comments") : t("admin.subtitle")}
      />

      <div className="surface mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_260px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("common.search")}
            className="pl-9"
          />
        </div>
        <Select value={courseSlug} onValueChange={setCourseSlug}>
          <SelectTrigger>
            <SelectValue placeholder={t("portal.chooseCourse")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("portal.allCourses")}</SelectItem>
            {(courses.data?.results ?? []).map((course) => (
              <SelectItem key={course.id} value={course.slug}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t("portal.student")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.comments")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.course")}</th>
                <th className="px-3 py-3 font-semibold">{t("portal.date")}</th>
                <th className="px-3 py-3 text-right font-semibold">{t("portal.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {comments.isLoading ? (
                <LoadingTable rows={5} columns={5} />
              ) : filtered.length ? (
                filtered.map((comment) => (
                  <tr key={comment.id} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex min-w-[160px] items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                          {initials(comment.user?.full_name)}
                        </span>
                        <div>
                          <p className="font-medium">{comment.user?.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">{t(`roles.${comment.user?.role}`)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-xl space-y-2">
                        {comment.lesson_title ? (
                          <p className="text-[11px] font-medium text-primary">{comment.lesson_title}</p>
                        ) : null}
                        <p className={comment.is_deleted ? "italic text-muted-foreground" : ""}>
                          {comment.is_deleted ? "—" : comment.body}
                        </p>
                        {comment.is_pinned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <Pin className="h-3 w-3" />
                            {t("portal.pin")}
                          </span>
                        ) : null}
                        {comment.replies?.length ? (
                          <ul className="space-y-1.5 border-l-2 border-border/70 pl-3">
                            {comment.replies.map((item) => (
                              <li key={item.id} className="text-xs">
                                <span className="font-medium">{item.user?.full_name}: </span>
                                <span className={item.is_deleted ? "italic text-muted-foreground" : ""}>
                                  {item.is_deleted ? "—" : item.body}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {replyTo === comment.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={replyBody}
                              onChange={(event) => setReplyBody(event.target.value)}
                              placeholder={t("portal.writeReply")}
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="gradient"
                                onClick={() => reply.mutate({ id: comment.id, body: replyBody })}
                                disabled={!replyBody.trim() || reply.isPending}
                              >
                                <Send className="h-4 w-4" />
                                {t("portal.reply")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReplyTo(null);
                                  setReplyBody("");
                                }}
                              >
                                {t("portal.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {courseMap.get(comment.course) || "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {formatDateTime(comment.created_at, lang)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!comment.is_deleted ? (
                          <>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              title={t("portal.reply")}
                              onClick={() => {
                                setReplyTo(replyTo === comment.id ? null : comment.id);
                                setReplyBody("");
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              title={comment.is_pinned ? t("portal.unpin") : t("portal.pin")}
                              onClick={() => pin.mutate(comment)}
                              disabled={pin.isPending}
                            >
                              {comment.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-destructive hover:text-destructive"
                              title={t("portal.deleteComment")}
                              onClick={() => setToDelete(comment)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">{t("portal.deleted")}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <TableEmpty colSpan={5}>{search ? t("common.noResults") : t("portal.noComments")}</TableEmpty>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("portal.deleteComment")}
        description={t("teacher.deleteConfirm")}
        confirmLabel={t("portal.delete")}
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </div>
  );
}
