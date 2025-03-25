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
    // Initialize state with defaultValue
    const [values, setValues] = useState<number[]>(defaultValue);

    // Update internal state when defaultValue prop changes
    useEffect(() => {
      if (defaultValue[0] !== values[0] || defaultValue[1] !== values[1]) {
        setValues([...defaultValue]);
      }
    }, [defaultValue, values]);

    const handleChange = (index: number, newValue: number) => {
      const updatedValues = [...values];
      // Ensure the value is within the min/max range
      updatedValues[index] = Math.max(min, Math.min(max, newValue));
      
      // Ensure values don't cross each other (prevent min > max)
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

    // Calculate thumb positions as percentages for CSS positioning
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
          
          {/* Thumbs inputs (invisible but handle interactions) */}
          {[0, 1].map((index) => (
            <input
              key={index}
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[index]}
              onChange={(e) => handleChange(index, Number(e.target.value))}
              className={cn(
                "absolute w-full h-2 opacity-0 cursor-pointer z-10",
                "appearance-none"
              )}
              style={{
                pointerEvents: "auto"
              }}
            />
          ))}
          
          {/* Thumb visuals */}
          {[0, 1].map((index) => (
            <div
              key={`thumb-${index}`}
              className="absolute h-5 w-5 rounded-full bg-white border-2 border-purple-600 shadow-md"
              style={{
                left: `calc(${getPosition(values[index])}% - 10px)`,
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