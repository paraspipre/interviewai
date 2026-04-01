"use client";
import React from "react";

const Spinner: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span className={`spinner ${className}`.trim()} aria-label="Loading" />
);

export default Spinner; 