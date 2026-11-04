"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { mediaUrl } from "@/lib/api";
import { cn, initials } from "@/lib/utils";

interface UserAvatarProps {
  name?: string;
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({ name, src, className, fallbackClassName }: UserAvatarProps) {
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={mediaUrl(src) || undefined} alt={name || "User"} /> : null}
      <AvatarFallback className={fallbackClassName}>{initials(name || "IP")}</AvatarFallback>
    </Avatar>
  );
}

export function UserIdentity({
  name,
  subtitle,
  src,
  className,
  avatarClassName,
}: {
  name: string;
  subtitle?: string;
  src?: string | null;
  className?: string;
  avatarClassName?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <UserAvatar name={name} src={src} className={cn("h-9 w-9", avatarClassName)} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
