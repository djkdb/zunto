import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold tracking-wide",
  {
    variants: {
      variant: {
        default: "border-night-600 bg-night-700 text-ink-dim",
        accent: "border-accent/40 bg-accent/15 text-accent-soft",
        a: "border-stance-a/40 bg-stance-a/15 text-stance-a",
        b: "border-stance-b/40 bg-stance-b/15 text-stance-b",
        good: "border-good/40 bg-good/15 text-good",
        warn: "border-warn/40 bg-warn/15 text-warn",
        danger: "border-danger/40 bg-danger/15 text-danger",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export const Badge = ({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
export { badgeVariants };
