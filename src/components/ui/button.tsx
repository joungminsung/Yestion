import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded font-medium transition-colors",
          "disabled:opacity-50 disabled:pointer-events-none",
          variant === "primary" && "bg-[#2383e2] text-white hover:bg-[#0b6ec5]",
          variant === "secondary" && "bg-notion-bg-hover text-notion-text-primary hover:bg-notion-bg-active",
          variant === "ghost" && "hover:bg-notion-bg-hover text-notion-text-secondary",
          size === "sm" && "px-2 py-1 text-xs",
          size === "md" && "px-3 py-1.5 text-sm",
          size === "lg" && "px-4 py-2 text-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
