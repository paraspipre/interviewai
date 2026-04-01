"use client";
import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode | string;
  className?: string;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, title, icon, className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`card card-hover ${className}`.trim()}
      {...props}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-2">
          {icon && <span className="text-2xl">{icon}</span>}
          {title && <span className="font-semibold text-lg text-gray-200">{title}</span>}
        </div>
      )}
      {children}
    </div>
  )
);
Card.displayName = "Card";

export default Card; 