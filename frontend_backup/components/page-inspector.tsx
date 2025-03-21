"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

/**
 * PageInspector - A component to help identify layout issues
 * 
 * This adds outline borders to all elements to help visualize the DOM structure
 * and provides information about the viewport and element sizes
 */
export function PageInspector() {
  const [active, setActive] = useState(false);
  const [viewportInfo, setViewportInfo] = useState({
    width: 0,
    height: 0,
    scrollWidth: 0,
    scrollHeight: 0,
  });

  // Update viewport information
  useEffect(() => {
    if (!active) return;

    const updateViewportInfo = () => {
      setViewportInfo({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      });
    };

    updateViewportInfo();
    window.addEventListener("resize", updateViewportInfo);
    
    return () => {
      window.removeEventListener("resize", updateViewportInfo);
    };
  }, [active]);

  // Toggle inspector mode
  const toggleInspector = () => {
    if (active) {
      // Remove inspector styles
      document.getElementById("inspector-styles")?.remove();
    } else {
      // Add inspector styles
      const style = document.createElement("style");
      style.id = "inspector-styles";
      style.textContent = `
        * {
          outline: 1px solid rgba(255, 0, 0, 0.2) !important;
        }
        
        div, section, main, nav {
          outline: 1px solid rgba(0, 0, 255, 0.2) !important;
        }
        
        header, footer {
          outline: 1px solid rgba(0, 255, 0, 0.2) !important;
        }
        
        .inspector-panel * {
          outline: none !important;
        }
        
        .overflow-indicator {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 4px;
          background: rgba(255, 0, 0, 0.7);
          color: white;
          text-align: center;
          font-size: 12px;
          z-index: 10000;
        }
      `;
      document.head.appendChild(style);

      // Check for horizontal overflow
      if (document.documentElement.scrollWidth > window.innerWidth) {
        const indicator = document.createElement("div");
        indicator.className = "overflow-indicator";
        indicator.innerText = "⚠️ Horizontal overflow detected! Check element widths.";
        document.body.appendChild(indicator);
      }
    }
    
    setActive(!active);
  };

  if (!active && typeof window !== "undefined") {
    // Just render the button when inactive
    return (
      <div className="fixed bottom-4 right-4 z-[9999]">
        <Button onClick={toggleInspector} variant="outline" size="sm">
          Inspect Layout
        </Button>
      </div>
    );
  }

  return (
    <div className="inspector-panel fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      <div className="bg-black/75 p-3 rounded-lg border border-gray-700 text-white text-xs w-56">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">Layout Inspector</h3>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={toggleInspector}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Viewport:</span>
            <span>{viewportInfo.width} × {viewportInfo.height}px</span>
          </div>
          <div className="flex justify-between">
            <span>Document:</span>
            <span>{viewportInfo.scrollWidth} × {viewportInfo.scrollHeight}px</span>
          </div>
          <div className="flex justify-between">
            <span>Horizontal Overflow:</span>
            <span className={viewportInfo.scrollWidth > viewportInfo.width ? "text-red-400" : "text-green-400"}>
              {viewportInfo.scrollWidth > viewportInfo.width ? "Yes" : "No"}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-700">
          <p className="text-gray-400 text-[10px]">
            Red: All elements<br />
            Blue: Layout containers<br />
            Green: Header/Footer
          </p>
        </div>
      </div>
      
      <Button variant="destructive" size="sm" onClick={toggleInspector}>
        Turn Off Inspector
      </Button>
    </div>
  );
}

export default PageInspector;
