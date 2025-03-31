// frontend/src/components/ui/alert.tsx
import React from "react";

// Simple utility to combine class names
const cn = (...classes: (string | undefined)[]) => {
  return classes.filter(Boolean).join(" ");
};

type AlertProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "destructive";
};

export function Alert({ 
  children, 
  className, 
  variant = "default" 
}: AlertProps) {
  const variantClasses = {
    default: "bg-gray-800 border-gray-700 text-gray-200",
    destructive: "bg-red-900/30 border-red-800 text-red-300"
  };

  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border p-4",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

type AlertTitleProps = {
  children: React.ReactNode;
  className?: string;
};

export function AlertTitle({ 
  children, 
  className 
}: AlertTitleProps) {
  return (
    <h5
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    >
      {children}
    </h5>
  );
}

type AlertDescriptionProps = {
  children: React.ReactNode;
  className?: string;
};

export function AlertDescription({ 
  children, 
  className 
}: AlertDescriptionProps) {
  return (
    <div
      className={cn("text-sm", className)}
    >
      {children}
    </div>
  );
}