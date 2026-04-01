"use client";
import "regenerator-runtime/runtime";
import { useCallback, useContext, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import pdfToText from "react-pdftotext";
import { Context } from "./context/ChainContext";
import Link from "next/link";
import {
  HiSparkles, HiArrowRight, HiArrowDown,
} from "react-icons/hi2";
import {
  FiUpload, FiMic, FiBarChart2, FiZap,
  FiBriefcase, FiCode, FiUsers, FiAward,
} from "react-icons/fi";
import { FaGoogle } from "react-icons/fa";

// ─── Static data ──────────────────────────────────────────────────────────────

const INTERVIEW_TYPES = [
  { value: "technical", label: "Technical", icon: <FiCode /> },
  { value: "hr", label: "HR", icon: <FiUsers /> },
  { value: "behavioral", label: "Behavioral", icon: <FiAward /> },
  { value: "system_design", label: "System Design", icon: <FiZap /> },
  { value: "coding", label: "Coding", icon: <FiCode /> },
];

const STYLES = [
  { value: "friendly", label: "Friendly" },
  { value: "strict", label: "Strict" },
  { value: "technical", label: "Technical" },
  { value: "casual", label: "Casual" },
];

const FEATURES = [
  {
    icon: <HiSparkles />,
    color: "from-primary-500 to-violet-500",
    title: "Agentic AI Interviewer",
    desc: "LangGraph-powered agent dynamically adapts questions based on your answers, just like a real senior interviewer.",
  },
  {
    icon: <FiMic />,
    color: "from-accent-500 to-primary-500",
    title: "Natural Voice Input",
    desc: "Speak your answers. The AI listens, transcribes, and responds in real-time with intelligent follow-ups.",
  },
  {
    icon: <FiBarChart2 />,
    color: "from-violet-500 to-accent-500",
    title: "Deep Performance Analysis",
    desc: "Multi-agent analysis covers technical accuracy, communication quality, confidence, and gives actionable recommendations.",
  },
  {
    icon: <FiCode />,
    color: "from-primary-500 to-accent-500",
    title: "Live Code Editor",
    desc: "Write and submit code during coding interviews. The AI evaluates your approach and logic on the spot.",
  },
];

const STEPS = [
  { num: "01", title: "Upload Resume", desc: "Drop your PDF resume so the AI tailors questions to your actual experience." },
  { num: "02", title: "Choose Format", desc: "Select interview type (Technical, HR, Coding…) and interviewer style." },
  { num: "03", title: "Start Interview", desc: "Speak naturally. The Gemini-powered agent asks smart follow-up questions." },
  { num: "04", title: "Get Analysis", desc: "Receive a comprehensive report with scores, strengths, and action items." },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { setInterviewConfig, clearHistory } = useContext(Context);

  const [role, setRole] = useState("Software Engineer");
  const [interviewType, setInterviewType] = useState("technical");
  const [interviewerStyle, setInterviewerStyle] = useState("friendly");
  const [loading, setLoading] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeName, setResumeName] = useState("");
  const [error, setError] = useState("");

  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const text = await pdfToText(file);
      const userName = session?.user?.name || "Candidate";
      clearHistory();
      setInterviewConfig({ role, interviewType, interviewerStyle, resume: text, userName });
      // Persist config for interview page
      localStorage.setItem("interviewType", interviewType);
      localStorage.setItem("interviewConfig", JSON.stringify({ role, interviewType, interviewerStyle, resume: text, userName }));
      setResumeUploaded(true);
      setResumeName(file.name);
    } catch {
      setError("Could not read PDF. Please try another file.");
    } finally {
      setLoading(false);
    }
  };

  const startInterview = () => {
    if (!resumeUploaded) {
      setError("Please upload your resume first.");
      return;
    }
    router.push("/interview");
  };

  const isAuthenticated = status === "authenticated";

  return (
    <div className="bg-mesh">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 pt-10 pb-20 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-primary-500/10 blur-3xl pointer-events-none animate-float" />
        <div className="absolute bottom-20 right-1/4 w-64 h-64 rounded-full bg-accent-500/10 blur-3xl pointer-events-none animate-float" style={{ animationDelay: "2s" }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 badge badge-primary mb-6 animate-fadeInDown">
            <HiSparkles className="text-primary-500" />
            Powered by Gemini 2.0 + LangGraph
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-5 animate-fadeInUp">
            Interview Practice{" "}
            <span className="gradient-text">Reimagined</span>
            <br className="hidden sm:block" />
            with Agentic AI
          </h1>

          <p className="text-lg sm:text-xl text-[rgb(var(--fg-muted))] max-w-2xl mx-auto mb-8 animate-fadeInUp" style={{ animationDelay: "0.1s" }}>
            A Gemini-powered AI interviewer that adapts in real-time, asks intelligent follow-ups, and delivers comprehensive performance analysis — just like the real thing.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
            {isAuthenticated ? (
              <button onClick={scrollToForm} className="btn-primary text-base px-8 py-3">
                Start Interview <HiArrowDown />
              </button>
            ) : (
              <Link href="/auth/signin" className="btn-primary text-base px-8 py-3">
                <FaGoogle /> Get Started Free
              </Link>
            )}
            <Link href="/interview/analysis" className="btn-secondary text-base px-8 py-3">
              View Sample Analysis <HiArrowRight />
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mt-12 animate-fadeInUp" style={{ animationDelay: "0.3s" }}>
            {[
              { val: "10+", label: "Interview Types" },
              { val: "Gemini", label: "AI Model" },
              { val: "Real-time", label: "Feedback" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xl sm:text-2xl font-extrabold gradient-text">{s.val}</div>
                <div className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
              Everything You Need to <span className="gradient-text">Ace It</span>
            </h2>
            <p className="text-[rgb(var(--fg-muted))] text-lg max-w-xl mx-auto">
              Cutting-edge AI meets practical interview prep.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="card card-hover group"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white text-lg mb-4 shadow-glow group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-[rgba(var(--bg-secondary),0.6)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
              How It <span className="gradient-text">Works</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {STEPS.map((s, i) => (
              <div key={i} className="flex gap-4 card card-hover">
                <div className="text-3xl font-extrabold gradient-text flex-shrink-0 leading-none">{s.num}</div>
                <div>
                  <h3 className="font-bold text-base mb-1">{s.title}</h3>
                  <p className="text-sm text-[rgb(var(--fg-muted))] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Setup Form ────────────────────────────────────────────────── */}
      <section className="py-20 px-4" ref={formRef}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
              Start Your <span className="gradient-text">Interview</span>
            </h2>
            <p className="text-[rgb(var(--fg-muted))]">Configure and launch your personalized mock interview in seconds.</p>
          </div>

          {!isAuthenticated ? (
            <div className="card text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center mx-auto mb-4 shadow-glow">
                <HiSparkles className="text-white text-2xl" />
              </div>
              <h3 className="text-xl font-bold mb-2">Sign in to Continue</h3>
              <p className="text-[rgb(var(--fg-muted))] mb-6 text-sm">Create a free account to access all interview types and save your progress.</p>
              <Link href="/auth/signin" className="btn-primary px-8 py-3 text-base">
                <FaGoogle /> Continue with Google
              </Link>
            </div>
          ) : (
            <div className="glass-strong p-6 sm:p-8 space-y-6">
              {/* Role */}
              <div>
                <label className="block text-sm font-semibold mb-2">Target Role</label>
                <div className="flex items-center gap-2">
                  <FiBriefcase className="text-primary-500 flex-shrink-0" />
                  <input
                    className="input"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer, Data Scientist…"
                  />
                </div>
              </div>

              {/* Interview Type */}
              <div>
                <label className="block text-sm font-semibold mb-2">Interview Type</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {INTERVIEW_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setInterviewType(t.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all ${
                        interviewType === t.value
                          ? "border-primary-500 bg-primary-500/10 text-primary-500"
                          : "border-[rgba(var(--border),0.8)] text-[rgb(var(--fg-muted))] hover:border-primary-500/40"
                      }`}
                    >
                      <span className="text-base">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interviewer Style */}
              <div>
                <label className="block text-sm font-semibold mb-2">Interviewer Style</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setInterviewerStyle(s.value)}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                        interviewerStyle === s.value
                          ? "border-primary-500 bg-primary-500/10 text-primary-500"
                          : "border-[rgba(var(--border),0.8)] text-[rgb(var(--fg-muted))] hover:border-primary-500/40"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload / Start */}
              <div>
                <label className="block text-sm font-semibold mb-2">Resume (PDF)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {!resumeUploaded ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-full border-2 border-dashed border-[rgba(var(--primary),0.4)] rounded-xl py-8 flex flex-col items-center gap-2 hover:border-primary-500 hover:bg-primary-500/5 transition-all cursor-pointer"
                  >
                    {loading ? (
                      <span className="spinner" />
                    ) : (
                      <FiUpload className="text-2xl text-primary-500" />
                    )}
                    <span className="text-sm font-medium text-[rgb(var(--fg-muted))]">
                      {loading ? "Reading resume…" : "Click to upload your PDF resume"}
                    </span>
                    <span className="text-xs text-[rgb(var(--fg-muted))]">PDF only · Max 10 MB</span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-[rgba(var(--success),0.4)] bg-[rgba(var(--success),0.06)] p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[rgba(var(--success),0.15)] flex items-center justify-center">
                        <FiUpload className="text-[rgb(var(--success))]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{resumeName}</div>
                        <div className="text-xs text-[rgb(var(--fg-muted))]">Resume loaded successfully</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setResumeUploaded(false); setResumeName(""); }}
                      className="text-xs text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] underline"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={startInterview}
                disabled={!resumeUploaded || loading}
                className="btn-primary w-full justify-center py-3.5 text-base"
              >
                {loading ? <span className="spinner" /> : <FiZap />}
                {loading ? "Setting up…" : "Launch Interview"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-[rgba(var(--border),0.5)] py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[rgb(var(--fg-muted))]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center">
              <HiSparkles className="text-white text-xs" />
            </div>
            <span>InterviewAI &copy; {new Date().getFullYear()} · Built by Paras Pipre</span>
          </div>
          <div className="flex gap-6">
            <span className="badge badge-primary">Gemini 2.0 Flash</span>
            <span className="badge badge-primary">LangGraph</span>
            <span className="badge badge-primary">Next.js 14</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
