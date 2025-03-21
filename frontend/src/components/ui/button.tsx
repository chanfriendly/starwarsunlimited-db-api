import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    variant?:
        | "default"
        | "destructive"
        | "outline"
        | "secondary"
        | "ghost"
        | "link";
    size?: "default" | "sm" | "lg" | "icon";  // Add the size prop here
}

const Button = React.forwardRef<
    HTMLButtonElement,
    ButtonProps
>(({ className, children, asChild = false, variant, size, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
        <Comp
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                variant === "default" &&
                "bg-primary text-primary-foreground hover:bg-primary/90",
                variant === "destructive" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                variant === "outline" &&
                "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
                variant === "secondary" &&
                "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
                variant === "link" && "underline-offset-4 hover:underline text-primary",
                size === "default" && "px-4 py-2",
                size === "sm" && "px-3 py-1.5 text-sm",
                size === "lg" && "px-6 py-3 text-lg",
                size === "icon" && "h-9 w-9",
                className
            )}
            ref={ref}
            {...props}
        >
            {children}
        </Comp>
    );
});
Button.displayName = "Button";

export { Button };
