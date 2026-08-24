"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white shadow-[0_10px_30px_-8px_var(--color-accent)] hover:bg-accent-soft",
        secondary:
          "bg-night-700 text-ink border border-night-600 hover:bg-night-600",
        ghost: "text-ink-dim hover:bg-night-800 hover:text-ink",
        outline:
          "border border-night-500 text-ink hover:border-accent hover:text-accent bg-transparent",
        danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
        good: "bg-good/15 text-good border border-good/30 hover:bg-good/25",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-12 px-5 text-[0.95rem]",
        lg: "h-14 px-6 text-base",
        xl: "h-16 px-7 text-lg",
        icon: "h-11 w-11",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
export { buttonVariants };
