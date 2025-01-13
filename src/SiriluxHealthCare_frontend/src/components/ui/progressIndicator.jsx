import React from "react";
import { cn } from "@/lib/utils";

const ProgressIndicator = ({ className, style, indicatorClassName, value }) => {
  return (
    <div
      className={cn(
        "h-full w-full flex-1 transition-all",
        className,
        indicatorClassName
      )}
      style={{ ...style, transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  );
};

export default ProgressIndicator;
