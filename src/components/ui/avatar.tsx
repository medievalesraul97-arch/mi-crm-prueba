import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  variant?: "primary" | "neutral";
  className?: string;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function Avatar({ name, variant = "primary", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        variant === "primary"
          ? "bg-primary-subtle text-primary"
          : "bg-surface-2 text-text-muted",
        className,
      )}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}
