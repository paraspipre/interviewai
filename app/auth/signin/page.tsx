"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FiZap, FiMessageSquare, FiBarChart2, FiShield } from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";

const features = [
  { icon: <FiZap />, title: "Agentic AI Interviewer", desc: "Powered by Gemini + LangGraph for dynamic, context-aware conversations" },
  { icon: <FiMessageSquare />, title: "Voice + Code Input", desc: "Speak naturally or write code — just like a real interview" },
  { icon: <FiBarChart2 />, title: "Deep AI Analysis", desc: "Multi-dimensional feedback on technical skills, communication & confidence" },
  { icon: <FiShield />, title: "Private & Secure", desc: "Your data stays yours. No data sold or shared with third parties" },
];

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex bg-mesh">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-96 h-96 rounded-full bg-primary-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-80px] right-[-80px] w-80 h-80 rounded-full bg-accent-500/20 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center shadow-glow">
            <HiSparkles className="text-white text-lg" />
          </div>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100">InterviewAI</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight text-slate-800 dark:text-slate-100 mb-4">
              Ace Your Next{" "}
              <span className="gradient-text">Interview</span>
              <br />with Agentic AI
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-md">
              Practice with a Gemini-powered AI interviewer that adapts to your role, asks follow-ups, and gives you comprehensive feedback.
            </p>
          </div>

          {/* Feature list */}
          <div className="grid grid-cols-1 gap-4 max-w-md">
            {features.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 glass p-4 animate-fadeInUp"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center text-primary-500 text-base flex-shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <div className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{f.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-slate-400 relative z-10">
          Built with LangGraph + Gemini 2.0 Flash · Real-time facial analysis
        </p>
      </div>

      {/* Right panel — sign in form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-fadeInUp">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center shadow-glow">
              <HiSparkles className="text-white text-lg" />
            </div>
            <span className="text-xl font-bold">InterviewAI</span>
          </div>

          <div className="glass-strong p-8 sm:p-10">
            <div className="mb-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                Welcome back
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Sign in to start your AI-powered interview practice
              </p>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn-google mb-6"
              type="button"
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <FcGoogle className="text-2xl flex-shrink-0" />
              )}
              <span className="font-semibold">
                {loading ? "Signing in…" : "Continue with Google"}
              </span>
            </button>

            <div className="divider mb-6">or</div>

            {/* Email coming soon placeholder */}
            <div className="space-y-3 mb-6 opacity-50 pointer-events-none select-none">
              <input
                className="input"
                type="email"
                placeholder="Email address (coming soon)"
                disabled
              />
              <input
                className="input"
                type="password"
                placeholder="Password"
                disabled
              />
              <button className="btn-primary w-full justify-center" disabled>
                Sign In
              </button>
            </div>

            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              By signing in, you agree to our{" "}
              <span className="text-primary-500 cursor-pointer hover:underline">Terms of Service</span>{" "}
              and{" "}
              <span className="text-primary-500 cursor-pointer hover:underline">Privacy Policy</span>
            </p>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            New here?{" "}
            <span
              onClick={handleGoogleSignIn}
              className="text-primary-500 font-semibold cursor-pointer hover:underline"
            >
              Create an account with Google
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
