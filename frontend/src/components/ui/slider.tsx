// frontend/src/components/ui/slider.tsx
"use client"

import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, min = 0, max = 100, step = 1, defaultValue = [0, 100], onValueChange, ...props }, ref) => {
    const [values, setValues] = useState<number[]>(defaultValue);

    useEffect(() => {
      if (defaultValue !== values) {
        setValues(defaultValue);
      }
    }, [defaultValue]);

    const handleChange = (index: number, newValue: number) => {
      const updatedValues = [...values];
      updatedValues[index] = Math.max(min, Math.min(max, newValue));
      
      // Ensure values don't cross
      if (index === 0 && updatedValues[0] > updatedValues[1]) {
        updatedValues[0] = updatedValues[1];
      } else if (index === 1 && updatedValues[1] < updatedValues[0]) {
        updatedValues[1] = updatedValues[0];
      }
      
      setValues(updatedValues);
      
      if (onValueChange) {
        onValueChange(updatedValues);
      }
    };

    // Calculate thumb positions as percentages
    const getPosition = (value: number) => {
      return ((value - min) / (max - min)) * 100;
    };

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
              left: `${getPosition(values[0])}%`,
              width: `${getPosition(values[1]) - getPosition(values[0])}%`
            }}
          />
          
          {/* Thumbs */}
          {values.map((value, index) => (
            <input
              key={index}
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => handleChange(index, Number(e.target.value))}
              className={cn(
                "absolute w-full h-2 opacity-0 cursor-pointer",
                "appearance-none"
              )}
              style={{
                pointerEvents: "auto"
              }}
            />
          ))}
          
          {/* Thumb visuals */}
          {values.map((value, index) => (
            <div
              key={`thumb-${index}`}
              className="absolute h-5 w-5 rounded-full bg-white border-2 border-purple-600 shadow-md"
              style={{
                left: `calc(${getPosition(value)}% - 10px)`,
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