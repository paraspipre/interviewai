"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { HiSparkles } from "react-icons/hi2";
import { FiLogOut, FiUser, FiMoon, FiSun, FiMenu, FiX } from "react-icons/fi";
import Image from "next/image";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || (!saved && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[rgba(var(--border),0.5)] bg-[rgba(var(--bg),0.8)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center shadow-glow">
            <HiSparkles className="text-white text-sm" />
          </div>
          <span className="font-bold text-[15px] hidden sm:block">InterviewAI</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/interview" className="nav-link">Interview</Link>
          <Link href="/interview/analysis" className="nav-link">Analysis</Link>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleDark}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgba(var(--border),0.4)] transition-colors"
            aria-label="Toggle theme"
          >
            {dark ? <FiSun className="text-base" /> : <FiMoon className="text-base" />}
          </button>

          {/* Auth */}
          {status === "authenticated" && session?.user ? (
            <div className="flex items-center gap-2">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  width={32}
                  height={32}
                  className="rounded-full ring-2 ring-primary-500/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center">
                  <FiUser className="text-white text-sm" />
                </div>
              )}
              <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">
                {session.user.name?.split(" ")[0]}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                aria-label="Sign out"
              >
                <FiLogOut className="text-base" />
              </button>
            </div>
          ) : status === "unauthenticated" ? (
            <Link href="/auth/signin" className="btn-primary px-4 py-1.5 text-sm">
              Sign In
            </Link>
          ) : null}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgba(var(--border),0.4)]"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-[rgba(var(--border),0.5)] bg-[rgba(var(--bg-card),0.95)] backdrop-blur-xl px-4 py-3 flex flex-col gap-1 animate-fadeInDown">
          <Link href="/" className="nav-link block py-2" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/interview" className="nav-link block py-2" onClick={() => setMenuOpen(false)}>Interview</Link>
          <Link href="/interview/analysis" className="nav-link block py-2" onClick={() => setMenuOpen(false)}>Analysis</Link>
        </div>
      )}
    </nav>
  );
}
