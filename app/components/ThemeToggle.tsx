"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        setDark(true);
        document.documentElement.classList.add("dark");
      } else {
        setDark(false);
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);
  const toggleDark = () => {
    setDark((d) => {
      const newDark = !d;
      if (newDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return newDark;
    });
  };
  return (
    <button
      onClick={toggleDark}
      className="btn-primary px-4 py-2 text-sm shadow-lg"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      type="button"
    >
      {dark ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
} 