"use client";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className = "", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`btn-primary ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = "Button";

export default Button; 