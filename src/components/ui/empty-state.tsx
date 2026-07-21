import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-text-muted">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-semibold text-text">{title}</p>
      {description && <p className="text-[13px] text-text-muted">{description}</p>}
      {action}
    </div>
  );
}
