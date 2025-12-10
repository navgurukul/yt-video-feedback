import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-black uppercase tracking-wide border-4 border-foreground transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-brutal hover:translate-x-2 hover:translate-y-2 hover:shadow-brutal-sm hover:[box-shadow:6px_6px_0px_0px_rgba(13,13,13,1),0_0_40px_hsl(var(--primary)/0.9)] hover:bg-primary/90 active:translate-x-3 active:translate-y-3 active:shadow-none",
        secondary: "bg-secondary text-secondary-foreground shadow-brutal hover:translate-x-2 hover:translate-y-2 hover:shadow-brutal-sm hover:[box-shadow:6px_6px_0px_0px_rgba(13,13,13,1),0_0_40px_hsl(var(--secondary)/0.9)] hover:bg-secondary/90 active:translate-x-3 active:translate-y-3 active:shadow-none",
        outline: "bg-card text-foreground shadow-brutal hover:translate-x-2 hover:translate-y-2 hover:shadow-brutal-sm hover:[box-shadow:6px_6px_0px_0px_rgba(13,13,13,1),0_0_25px_rgba(13,13,13,0.4)] hover:bg-muted/50 active:translate-x-3 active:translate-y-3 active:shadow-none",
        ghost: "border-0 shadow-none hover:bg-muted hover:scale-105",
        destructive: "bg-destructive text-destructive-foreground shadow-brutal hover:translate-x-2 hover:translate-y-2 hover:shadow-brutal-sm hover:[box-shadow:6px_6px_0px_0px_rgba(13,13,13,1),0_0_30px_hsl(var(--destructive)/0.7)]",
      },
      size: {
        default: "h-12 px-6 py-3 text-sm",
        sm: "h-10 px-4 py-2 text-xs",
        lg: "h-14 px-8 py-4 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
