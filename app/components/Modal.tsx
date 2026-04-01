"use client";
import React, { useEffect, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode | string;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, icon, className = "" }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div
        className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-label="Close modal"
        tabIndex={-1}
      />
      <div
        ref={modalRef}
        className={`bg-white/10 dark:bg-[#232336]/90 backdrop-blur-2xl border border-[#2d2d3a] shadow-2xl rounded-2xl p-4 sm:p-8 max-w-md w-[95%] text-gray-100 relative animate-fadeIn ${className}`.trim()}
        role="dialog"
        aria-modal="true"
      >
        {(title || icon) && (
          <div className="flex items-center gap-2 mb-2">
            {icon && <span className="text-2xl">{icon}</span>}
            {title && <span className="font-semibold text-lg text-gray-200">{title}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default Modal; 