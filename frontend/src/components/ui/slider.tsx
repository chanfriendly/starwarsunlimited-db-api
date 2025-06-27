// frontend/src/components/ui/slider.tsx
"use client"

import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number[];
  onValueChange?: (value: number[]) => void;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, min = 0, max = 100, step = 1, value, onValueChange, ...props }, ref) => {

    const handleChange = (index: number, newValue: number) => {
      const updatedValues = [...(value || [min, max])]; // Use prop value or default
      updatedValues[index] = Math.max(min, Math.min(max, newValue));
      
      // Prevent crossing
      if (index === 0) {
        updatedValues[0] = Math.min(updatedValues[0], updatedValues[1]);
      } else {
        updatedValues[1] = Math.max(updatedValues[0], updatedValues[1]);
      }
      
      onValueChange?.(updatedValues);
    };

    // Calculate thumb positions as percentages for CSS positioning
    const getPosition = (val: number) => {
      return ((val - min) / (max - min)) * 100;
    };

    const currentValues = value || [min, max]; // Use prop value or default

    return (
      <div 
        ref={ref}
        className={cn(
          "relative flex w-full h-10 touch-none select-none items-center",
          className
        )}
        {...props}
      >
        <div className="relative h-2 w-full rounded-full bg-gray-800">
          {/* Selected range */}
          <div 
            className="absolute h-full bg-purple-600 rounded-full" 
            style={{
              left: `${getPosition(currentValues[0])}%`,
              width: `${getPosition(currentValues[1]) - getPosition(currentValues[0])}%`
            }}
          />
          
          {/* Thumbs inputs (invisible but handle interactions) */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentValues[0]} // Control the left thumb
            onChange={(e) => handleChange(0, Number(e.target.value))}
            className="absolute w-full h-full opacity-0 cursor-pointer z-10"
            style={{
              pointerEvents: "auto",
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentValues[1]} // Control the right thumb
            onChange={(e) => handleChange(1, Number(e.target.value))}
            className="absolute w-full h-full opacity-0 cursor-pointer z-10"
            style={{
              pointerEvents: "auto",
            }}
          />
          
          {/* Thumb visuals */}
          {[0, 1].map((index) => (
            <div
              key={`thumb-${index}`}
              className="absolute h-5 w-5 rounded-full bg-white border-2 border-purple-600 shadow-md"
              style={{
                left: `calc(${getPosition(currentValues[index])}% - 10px)`,
                top: "-6px"
              }}
            />
          ))}
        </div>
      </div>
    );
  }
);

Slider.displayName = "Slider";