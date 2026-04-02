"use client";
import { useContext, useEffect, useState } from "react";
import { Context } from "../../context/ChainContext";
import Link from "next/link";
import {
  FiDownload, FiHome, FiRefreshCw, FiCheck, FiAlertTriangle,
  FiTrendingUp, FiMessageSquare, FiCpu, FiAward,
} from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  problemSolvingScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  detailedFeedback: string;
  questionBreakdown: { question: string; answer: string; quality: string; score: number }[];
  hiringVerdict: "Strong Yes" | "Yes" | "Maybe" | "No";
  verdictReason: string;
}

// ─── Score ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({
  score,
  size = 96,
  strokeWidth = 9,
  color,
  label,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="score-circle-wrap">
        <svg width={size} height={size}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="rgba(var(--border),0.4)" strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s ease", transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
          />
        </svg>
        <div className="score-inner">
          <span className="text-lg font-extrabold leading-none" style={{ color }}>{score}</span>
          <span className="text-[10px] text-[rgb(var(--fg-muted))]">/100</span>
        </div>
      </div>
      <span className="text-[11px] font-semibold text-[rgb(var(--fg-muted))] text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Verdict badge ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: AnalysisResult["hiringVerdict"] }) {
  const cfg = {
    "Strong Yes": { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Strong Hire ✓✓" },
    "Yes": { color: "#6366f1", bg: "rgba(99,102,241,0.12)", label: "Hire ✓" },
    "Maybe": { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Maybe →" },
    "No": { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "No Hire ✗" },
  }[verdict] ?? { color: "#6366f1", bg: "rgba(99,102,241,0.12)", label: verdict };

  return (
    <span
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: `${cfg.color}40` }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Quality badge for Q&A breakdown ─────────────────────────────────────────

function QualityBadge({ q }: { q: string }) {
  const map: Record<string, string> = {
    excellent: "badge-success",
    good: "badge-primary",
    average: "badge-warning",
    poor: "badge-danger",
  };
  return <span className={`badge ${map[q] ?? "badge-primary"} capitalize`}>{q}</span>;
}

// ─── Emotion bar ──────────────────────────────────────────────────────────────

const EMOTION_COLORS: Record<string, string> = {
  happy: "#10b981",
  neutral: "#6366f1",
  surprised: "#f59e0b",
  fearful: "#ef4444",
  sad: "#64748b",
  angry: "#dc2626",
  disgusted: "#7c3aed",
};

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function AnalysisSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6 animate-pulse">
      <div className="card text-center py-10 space-y-4">
        <div className="skeleton h-8 w-64 mx-auto rounded-xl" />
        <div className="skeleton h-4 w-80 mx-auto rounded-xl" />
        <div className="flex justify-center gap-8 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton rounded-full" style={{ width: 100, height: 100 }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2].map((i) => <div key={i} className="card skeleton h-48" />)}
      </div>
      <div className="card skeleton h-40" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { conversationHistory, expressionsObject, interviewConfig, startTime, clearHistory } = useContext(Context);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "transcript" | "emotions">("overview");

  const duration = startTime ? Math.round((Date.now() - startTime) / 60000) : 0;

  // Fetch analysis from LangGraph agent
  useEffect(() => {
    if (analysis) return;

    // If no history, try to show a demo
    if (conversationHistory.length < 2) {
      setError("No interview data found. Complete an interview first.");
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/interview/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationHistory,
            expressionsData: expressionsObject,
            role: interviewConfig?.role || "Software Engineer",
            interviewType: interviewConfig?.interviewType || "technical",
            duration,
            resume: interviewConfig?.resume || "",
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Analysis failed");
        }

        const data: AnalysisResult = await res.json();
        setAnalysis(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Analysis failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Download report as text
  const downloadReport = () => {
    if (!analysis) return;
    const txt = `
INTERVIEW ANALYSIS REPORT
==========================
Role: ${interviewConfig?.role}
Type: ${interviewConfig?.interviewType}
Duration: ${duration} min
Date: ${new Date().toLocaleDateString()}

SCORES
------
Overall: ${analysis.overallScore}/100
Technical: ${analysis.technicalScore}/100
Communication: ${analysis.communicationScore}/100
Confidence: ${analysis.confidenceScore}/100
Problem Solving: ${analysis.problemSolvingScore}/100

VERDICT: ${analysis.hiringVerdict}
${analysis.verdictReason}

SUMMARY
-------
${analysis.summary}

DETAILED FEEDBACK
-----------------
${analysis.detailedFeedback}

STRENGTHS
---------
${analysis.strengths.map((s) => `• ${s}`).join("\n")}

AREAS TO IMPROVE
----------------
${analysis.improvements.map((i) => `• ${i}`).join("\n")}

RECOMMENDATIONS
---------------
${analysis.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}

TRANSCRIPT
----------
${conversationHistory.map((m) => `${m.role === "user" ? "YOU" : "AI"}: ${m.content}`).join("\n\n")}
    `.trim();

    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "interview_analysis.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="bg-mesh min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 badge badge-primary mb-4">
            <span className="spinner w-3 h-3" style={{ borderTopColor: "rgb(var(--primary))" }} />
            Analyzing with LangGraph AI…
          </div>
          <h1 className="text-3xl font-extrabold mb-2">
            Generating Your <span className="gradient-text">Analysis</span>
          </h1>
          <p className="text-[rgb(var(--fg-muted))]">Our multi-agent AI is evaluating your technical skills, communication, and confidence…</p>
        </div>
        <AnalysisSkeleton />
      </div>
    </div>
  );

  if (error) return (
    <div className="bg-mesh min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center py-10">
        <FiAlertTriangle className="text-4xl text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Analysis Failed</h2>
        <p className="text-[rgb(var(--fg-muted))] text-sm mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-primary px-6 py-2.5"><FiHome /> Start New</Link>
          <button onClick={() => { setError(""); setLoading(true); window.location.reload(); }} className="btn-secondary px-5 py-2.5">
            <FiRefreshCw /> Retry
          </button>
        </div>
      </div>
    </div>
  );

  if (!analysis) return null;

  const scoreColor = (s: number) =>
    s >= 80 ? "#10b981" : s >= 60 ? "#6366f1" : s >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="bg-mesh min-h-screen pb-16">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="card text-center py-8 gradient-border animate-fadeInDown">
          <div className="inline-flex items-center gap-2 badge badge-primary mb-4">
            <HiSparkles /> AI Analysis Complete
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">
            Your Interview <span className="gradient-text">Results</span>
          </h1>
          <p className="text-[rgb(var(--fg-muted))] mb-2 max-w-xl mx-auto text-sm leading-relaxed">
            {analysis.summary}
          </p>
          <div className="mt-3">
            <VerdictBadge verdict={analysis.hiringVerdict} />
            <p className="text-xs text-[rgb(var(--fg-muted))] mt-2">{analysis.verdictReason}</p>
          </div>
        </div>

        {/* ── Score rings ────────────────────────────────────────────── */}
        <div className="card animate-fadeInUp">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <FiAward className="text-primary-500" /> Performance Scores
          </h2>
          {/* Overall — full width centered row on all sizes */}
          <div className="flex justify-center mb-4">
            <ScoreRing score={analysis.overallScore} size={112} strokeWidth={11} color={scoreColor(analysis.overallScore)} label="Overall Score" />
          </div>
          {/* Other 4 scores — 2 cols on mobile, 4 on sm+ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
            <ScoreRing score={analysis.technicalScore} color={scoreColor(analysis.technicalScore)} label="Technical" />
            <ScoreRing score={analysis.communicationScore} color={scoreColor(analysis.communicationScore)} label="Communication" />
            <ScoreRing score={analysis.confidenceScore} color={scoreColor(analysis.confidenceScore)} label="Confidence" />
            <ScoreRing score={analysis.problemSolvingScore} color={scoreColor(analysis.problemSolvingScore)} label="Problem Solving" />
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-[rgba(var(--bg-secondary),0.6)] p-1 rounded-xl overflow-x-auto max-w-full">
          {(["overview", "transcript", "emotions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-[rgb(var(--bg-card))] text-[rgb(var(--primary))] shadow-sm"
                  : "text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview ───────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-5 animate-fadeIn">

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="card border border-[rgba(var(--success),0.25)]">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2 text-[rgb(var(--success))]">
                  <FiCheck /> Strengths
                </h3>
                <ul className="space-y-2.5">
                  {analysis.strengths.slice(0, 5).map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span className="w-5 h-5 rounded-full bg-[rgba(var(--success),0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiCheck className="text-[rgb(var(--success))] text-xs" />
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                  {analysis.strengths.length === 0 && (
                    <li className="text-sm text-[rgb(var(--fg-muted))] italic">Keep practicing to build strengths!</li>
                  )}
                </ul>
              </div>

              <div className="card border border-[rgba(var(--warning),0.25)]">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: "rgb(var(--warning))" }}>
                  <FiTrendingUp /> Areas to Improve
                </h3>
                <ul className="space-y-2.5">
                  {analysis.improvements.slice(0, 5).map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span className="w-5 h-5 rounded-full bg-[rgba(var(--warning),0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiTrendingUp className="text-xs" style={{ color: "rgb(var(--warning))" }} />
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Detailed feedback */}
            <div className="card">
              <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <FiMessageSquare className="text-primary-500" /> Detailed Feedback
              </h3>
              <p className="text-sm text-[rgb(var(--fg-muted))] leading-relaxed whitespace-pre-line">
                {analysis.detailedFeedback}
              </p>
            </div>

            {/* Recommendations */}
            <div className="card border border-[rgba(var(--primary),0.2)]">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <HiSparkles className="text-primary-500" /> Action Plan
              </h3>
              <ol className="space-y-3">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Q&A breakdown */}
            {analysis.questionBreakdown?.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                  <FiCpu className="text-primary-500" /> Question-by-Question Breakdown
                </h3>
                <div className="space-y-4">
                  {analysis.questionBreakdown.map((qa, i) => (
                    <div key={i} className="border border-[rgba(var(--border),0.6)] rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="text-sm font-semibold flex-1">{qa.question || `Question ${i + 1}`}</div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <QualityBadge q={qa.quality} />
                          <span className="text-xs font-bold" style={{ color: scoreColor(qa.score) }}>{qa.score}/100</span>
                        </div>
                      </div>
                      <p className="text-xs text-[rgb(var(--fg-muted))] line-clamp-3">{qa.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Transcript ─────────────────────────────────────────── */}
        {activeTab === "transcript" && (
          <div className="card animate-fadeIn space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <FiMessageSquare className="text-primary-500" /> Full Transcript
            </h3>
            {conversationHistory.length === 0 ? (
              <p className="text-sm text-[rgb(var(--fg-muted))] italic">No transcript available.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                {conversationHistory.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      msg.role === "assistant"
                        ? "bg-gradient-to-br from-primary-500 to-violet-500 text-white"
                        : "bg-gradient-to-br from-accent-500 to-primary-500 text-white"
                    }`}>
                      {msg.role === "assistant" ? "AI" : "Y"}
                    </div>
                    <div className={msg.role === "assistant" ? "chat-bubble-ai text-sm" : "chat-bubble-user text-sm"}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Emotions ───────────────────────────────────────────── */}
        {activeTab === "emotions" && (
          <div className="card animate-fadeIn">
            <h3 className="font-bold text-base mb-6 flex items-center gap-2">
              <HiSparkles className="text-primary-500" /> Emotion Profile
            </h3>
            <div className="space-y-4">
              {Object.entries(expressionsObject).map(([emotion, value]) => {
                const pct = Math.round((value as number) * 100);
                const color = EMOTION_COLORS[emotion] || "#6366f1";
                return (
                  <div key={emotion}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium capitalize">{emotion}</span>
                      <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="emotion-bar">
                      <div className="emotion-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 p-4 rounded-xl bg-[rgba(var(--primary),0.05)] border border-[rgba(var(--primary),0.15)]">
              <p className="text-xs text-[rgb(var(--fg-muted))] leading-relaxed">
                <strong className="text-[rgb(var(--primary))]">About Confidence Score:</strong> Your confidence score of{" "}
                <strong>{analysis?.confidenceScore ?? "—"}/100</strong> is derived from real-time facial expression analysis
                using face-api.js. High happiness and neutral expressions boost the score, while fear and anger reduce it.
              </p>
            </div>
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <button onClick={downloadReport} className="btn-secondary px-6 py-2.5">
            <FiDownload /> Download Report
          </button>
          <Link href="/" className="btn-primary px-6 py-2.5">
            <FiRefreshCw /> New Interview
          </Link>
          <Link href="/" onClick={clearHistory} className="btn-ghost px-5 py-2.5">
            <FiHome /> Home
          </Link>
        </div>

      </div>
    </div>
  );
}
