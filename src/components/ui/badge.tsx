import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "error" | "info" | "primary" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  error: "bg-error-bg text-error-text",
  info: "bg-info-bg text-info-text",
  primary: "bg-primary-subtle text-primary",
  neutral: "bg-surface-2 text-text-muted border border-border",
};

const dotClasses: Record<BadgeTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  primary: "bg-primary",
  neutral: "bg-text-subtle",
};

export function Badge({ tone = "neutral", dot = true, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[13px] font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("h-[7px] w-[7px] rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}
