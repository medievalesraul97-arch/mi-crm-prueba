import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Botón cuadrado solo-icono (48x48). Recuerda pasar aria-label. */
  iconOnly?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active disabled:bg-surface-2 disabled:text-text-subtle disabled:border disabled:border-border",
  secondary:
    "bg-surface border border-border-strong text-text font-medium hover:bg-surface-2 disabled:bg-surface-2 disabled:text-text-subtle",
  ghost:
    "bg-transparent text-text-muted hover:bg-surface-2 disabled:text-text-subtle",
  destructive:
    "bg-error text-white hover:brightness-90 disabled:bg-surface-2 disabled:text-text-subtle",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      loading = false,
      iconOnly = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md text-[15px] font-semibold transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] disabled:cursor-not-allowed disabled:shadow-none",
          iconOnly ? "h-12 w-12" : "h-12 px-5",
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-vibe-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
