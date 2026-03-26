import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded px-3 py-2 text-sm outline-none",
          "border transition-colors",
          "focus:border-[#2383e2] focus:ring-1 focus:ring-[#2383e2]",
          className
        )}
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
          fontFamily: "var(--notion-font-family)",
        }}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
