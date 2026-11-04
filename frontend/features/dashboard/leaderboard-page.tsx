"use client";

import { useState } from "react";
import { Crown, Medal, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useI18n } from "@/lib/i18n";
import { useLeaderboard } from "@/lib/queries";
import { cn, formatNumber } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/types";
import { PageHeading } from "./shared";

type LeaderboardType = "overall" | "points" | "courses" | "quizzes";
type Period = "all" | "month" | "week";

export function LeaderboardPage() {
  const { t } = useI18n();
  const [type, setType] = useState<LeaderboardType>("overall");
  const [period, setPeriod] = useState<Period>("all");
  const leaderboard = useLeaderboard(type, period);

  if (leaderboard.isError) {
    return <ErrorState onRetry={() => leaderboard.refetch()} />;
  }

  const results = leaderboard.data?.results ?? [];
  const top = results.slice(0, 3);
  const rest = results.slice(3);
  const me = leaderboard.data?.me;

  return (
    <div>
      <PageHeading
        eyebrow={t("dashboard.learning")}
        title={t("leaderboard.title")}
        subtitle={t("leaderboard.subtitle")}
        actions={
          <div className="w-[160px]">
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("leaderboard.allTime")}</SelectItem>
                <SelectItem value="month">{t("leaderboard.month")}</SelectItem>
                <SelectItem value="week">{t("leaderboard.week")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <Tabs value={type} onValueChange={(value) => setType(value as LeaderboardType)}>
        <TabsList className="mb-5">
          <TabsTrigger value="overall">{t("leaderboard.overall")}</TabsTrigger>
          <TabsTrigger value="points">{t("leaderboard.points")}</TabsTrigger>
          <TabsTrigger value="courses">{t("leaderboard.courses")}</TabsTrigger>
          <TabsTrigger value="quizzes">{t("leaderboard.quizzes")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {me ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
              #{me.rank}
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{t("leaderboard.yourRank")}</p>
              <p className="text-sm font-semibold">{t("leaderboard.you")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Metric label={t("leaderboard.pointsLabel")} value={formatNumber(me.points)} />
            <Metric label={t("leaderboard.coursesLabel")} value={formatNumber(me.completed_courses)} />
            <Metric label={t("leaderboard.accuracy")} value={`${Math.round(me.quiz_accuracy)}%`} />
          </div>
        </div>
      ) : null}

      {leaderboard.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState icon={Trophy} title={t("leaderboard.empty")} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {top.map((entry) => (
              <PodiumCard key={entry.user.id} entry={entry} />
            ))}
          </div>

          <section className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{t("leaderboard.title")}</h2>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {t("leaderboard.total", { n: leaderboard.data?.total_students ?? results.length })}
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t("leaderboard.rank")}</TableHead>
                  <TableHead>{t("leaderboard.student")}</TableHead>
                  <TableHead className="text-right">{t("leaderboard.pointsLabel")}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    {t("leaderboard.coursesLabel")}
                  </TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    {t("leaderboard.accuracy")}
                  </TableHead>
                  <TableHead className="text-right">{t("leaderboard.score")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rest.map((entry) => (
                  <TableRow key={entry.user.id} className={cn(entry.is_me && "bg-primary/5")}>
                    <TableCell className="font-semibold text-muted-foreground">#{entry.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={entry.user.full_name} src={entry.user.avatar} className="h-8 w-8" />
                        <span className="truncate text-sm font-medium">{entry.user.full_name}</span>
                        {entry.is_me ? (
                          <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                            {t("leaderboard.you")}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatNumber(entry.points)}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      {formatNumber(entry.completed_courses)}
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      {Math.round(entry.quiz_accuracy)}%
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatNumber(entry.score)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      )}
    </div>
  );
}

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const { t } = useI18n();
  const styles = {
    1: { icon: Crown, ring: "border-gold/50 bg-gold/10", iconClass: "text-gold" },
    2: { icon: Medal, ring: "border-slate-400/40 bg-slate-400/10", iconClass: "text-slate-400" },
    3: { icon: Medal, ring: "border-amber-700/40 bg-amber-700/10", iconClass: "text-amber-700" },
  } as const;
  const style = styles[entry.rank as 1 | 2 | 3] ?? styles[3];
  const Icon = style.icon;

  return (
    <div className={cn("surface flex items-center gap-3 border p-4", style.ring)}>
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-background/60", style.iconClass)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">#{entry.rank}</span>
          {entry.is_me ? (
            <Badge variant="default" className="px-1.5 py-0 text-[10px]">
              {t("leaderboard.you")}
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-sm font-semibold">{entry.user.full_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatNumber(entry.points)} {t("leaderboard.pointsLabel").toLowerCase()}
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
