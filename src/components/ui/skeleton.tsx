import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-vibe-pulse rounded-md bg-surface-2", className)} />;
}
