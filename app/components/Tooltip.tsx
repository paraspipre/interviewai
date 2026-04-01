"use client";
import React from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <span className="has-tooltip relative inline-block">
      {children}
      <span className="tooltip" role="tooltip">
        {content}
      </span>
    </span>
  );
};

export default Tooltip; 