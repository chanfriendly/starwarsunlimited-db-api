// src/components/ui/checkbox.tsx
"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, onCheckedChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(e.target.checked);
      }
    };

    return (
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          ref={ref}
          className={cn(
            "h-4 w-4 rounded-sm border border-gray-700 bg-transparent",
            "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
            "checked:bg-purple-600 checked:border-transparent",
            className
          )}
          onChange={handleChange}
          {...props}
        />
        {label && (
          <label
            htmlFor={props.id}
            className="text-sm text-gray-300 cursor-pointer"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";