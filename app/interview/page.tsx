"use client";
import "regenerator-runtime/runtime";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import * as faceapi from "face-api.js";
import { Context } from "../context/ChainContext";
import type { InterviewConfig, ExpressionsData } from "../context/ChainContext";
import {
  FiMic, FiMicOff, FiRefreshCw, FiLogOut, FiCode,
  FiVolume2, FiVolumeX, FiUser, FiCpu, FiClock, FiChevronUp,
} from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatBubble {
  role: "user" | "assistant";
  content: string;
  id: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    interviewConfig: ctxConfig,
    setInterviewConfig,
    conversationHistory,
    addMessage,
    clearHistory,
    questionCount,
    setQuestionCount,
    expressionsObject,
    setExpressionsObject,
    startTime,
    setStartTime,
  } = useContext(Context);

  // Load config from localStorage fallback
  const interviewConfig: InterviewConfig | null = useMemo(() => {
    if (ctxConfig) return ctxConfig;
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("interviewConfig");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed as InterviewConfig;
      } catch { return null; }
    }
    return null;
  }, [ctxConfig]);

  // Chat display state
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [thinking, setThinking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [qCount, setQCount] = useState(0);

  // Video / face detection
  const videoRef = useRef<HTMLVideoElement>(null!);
  const streamRef = useRef<MediaStream | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const msgIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const spokenUpToRef = useRef(0);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef("");

  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const dimensions = useMemo(() => ({ width: 480, height: 360 }), []);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!startTime) setStartTime(Date.now());
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - (startTime || Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, setStartTime]);

  // ── Video ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: dimensions })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setVideoReady(true);
      })
      .catch(() => setVideoReady(false));
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [dimensions]);

  // ── Load face-api models ───────────────────────────────────────────────────
  useEffect(() => {
    const loadModels = async () => {
      try {
        const url = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(url),
          faceapi.nets.faceExpressionNet.loadFromUri(url),
        ]);
      } catch (e) {
        console.warn("Face models not loaded:", e);
      }
    };
    loadModels();
  }, []);

  // ── Face detection loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoReady) return;
    const interval = setInterval(async () => {
      try {
        if (!videoRef.current) return;
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();
        if (detection) {
          const e = detection.expressions as unknown as ExpressionsData;
          setExpressionsObject({
            angry: (expressionsObject.angry + e.angry) / 2,
            disgusted: (expressionsObject.disgusted + e.disgusted) / 2,
            fearful: (expressionsObject.fearful + e.fearful) / 2,
            happy: (expressionsObject.happy + e.happy) / 2,
            neutral: (expressionsObject.neutral + e.neutral) / 2,
            sad: (expressionsObject.sad + e.sad) / 2,
            surprised: (expressionsObject.surprised + e.surprised) / 2,
          });
        }
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [videoReady, expressionsObject, setExpressionsObject]);

  // ── Scroll chat to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // ── Speak text ────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (muted || !text) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const cleaned = text.replace(/[*#_`]/g, "").trim();
    const utt = new SpeechSynthesisUtterance(cleaned);
    utt.rate = 1.05;
    utt.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(utt);
  }, [muted]);

  // ── Send message to LangGraph API ──────────────────────────────────────────
  const sendToAI = useCallback(async (userText: string) => {
    if (!userText.trim() || thinking) return;

    const userMsg: ChatBubble = { role: "user", content: userText + (code ? `\n\nCode:\n${code}` : ""), id: ++msgIdRef.current };
    setMessages((prev) => [...prev, userMsg]);
    addMessage("user", userMsg.content);

    setThinking(true);
    spokenUpToRef.current = 0;

    try {
      const config = interviewConfig;
      const res = await fetch("/api/interview/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          conversationHistory,
          resume: config?.resume || "",
          role: config?.role || "Software Engineer",
          interviewType: config?.interviewType || "technical",
          interviewerStyle: config?.interviewerStyle || "friendly",
          userName: config?.userName || session?.user?.name || "Candidate",
          questionCount: qCount,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.hint || err.error || "API error");
      }

      const data = await res.json();
      const aiMsg: ChatBubble = { role: "assistant", content: data.response, id: ++msgIdRef.current };
      setMessages((prev) => [...prev, aiMsg]);
      addMessage("assistant", data.response);
      setQCount(data.questionCount);
      setQuestionCount(data.questionCount);
      if (data.feedback) setFeedback(data.feedback);

      speak(data.response);

      if (data.shouldEnd) {
        setTimeout(() => setInterviewEnded(true), 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      const errMsg: ChatBubble = {
        role: "assistant",
        content: `⚠️ ${msg}`,
        id: ++msgIdRef.current,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setThinking(false);
      resetTranscript();
      lastTranscriptRef.current = "";
      SpeechRecognition.startListening({ continuous: true });
    }
  }, [thinking, code, conversationHistory, interviewConfig, session, qCount, addMessage, setQuestionCount, speak, resetTranscript]);

  // ── Auto-send on speech pause ──────────────────────────────────────────────
  useEffect(() => {
    if (!listening) return;
    if (!transcript || transcript === lastTranscriptRef.current) return;

    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      if (transcript.trim().length > 3) {
        lastTranscriptRef.current = transcript;
        sendToAI(transcript);
      }
    }, 1400);

    return () => { if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current); };
  }, [transcript, listening, sendToAI]);

  // ── Start interview greeting ───────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) return;
    // Trigger first greeting from AI
    sendToAI("Hello, I'm ready to start the interview.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mic toggle ────────────────────────────────────────────────────────────
  const handleMicClick = () => {
    if (listening) {
      SpeechRecognition.stopListening();
      if (transcript.trim().length > 3) sendToAI(transcript);
    } else {
      SpeechRecognition.startListening({ continuous: true });
    }
  };

  // ── Mute/unmute ───────────────────────────────────────────────────────────
  const handleMute = () => {
    setMuted((m) => {
      if (!m) speechSynthesis?.cancel();
      return !m;
    });
  };

  // ── End interview ─────────────────────────────────────────────────────────
  const endInterview = () => {
    SpeechRecognition.stopListening();
    speechSynthesis?.cancel();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearInterval(undefined);
    router.push("/interview/analysis");
  };

  // ── Dominant emotion ──────────────────────────────────────────────────────
  const dominantEmotion = useMemo(() => {
    const entries = Object.entries(expressionsObject) as [string, number][];
    if (!entries.length) return null;
    const [emotion, val] = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
    return val > 0.1 ? emotion : null;
  }, [expressionsObject]);

  const emotionEmoji: Record<string, string> = {
    happy: "😊", neutral: "😐", sad: "😔", angry: "😤",
    surprised: "😲", fearful: "😨", disgusted: "😒",
  };

  const MAX_Q = 10;

  return (
    <div className="min-h-screen bg-mesh flex flex-col">

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-40 bg-[rgba(var(--bg),0.85)] backdrop-blur-xl border-b border-[rgba(var(--border),0.5)] px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Left: config info */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="badge badge-primary capitalize">{interviewConfig?.interviewType || "Interview"}</span>
            <span className="text-sm font-medium truncate max-w-[160px]">{interviewConfig?.role || "Software Engineer"}</span>
          </div>

          {/* Center: progress */}
          <div className="flex items-center gap-3 flex-1 max-w-xs mx-auto">
            <div className="text-xs text-[rgb(var(--fg-muted))] whitespace-nowrap">Q {Math.min(qCount, MAX_Q)}/{MAX_Q}</div>
            <div className="progress-bar flex-1">
              <div className="progress-fill" style={{ width: `${Math.min((qCount / MAX_Q) * 100, 100)}%` }} />
            </div>
          </div>

          {/* Right: timer + controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-[rgb(var(--fg-muted))]">
              <FiClock className="text-xs" />
              <span className="font-mono text-xs">{formatDuration(elapsedSec)}</span>
            </div>
            <button
              onClick={handleMute}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgba(var(--border),0.4)] transition-colors"
              aria-label={muted ? "Unmute" : "Mute AI"}
            >
              {muted ? <FiVolumeX className="text-sm" /> : <FiVolume2 className="text-sm" />}
            </button>
            <button
              onClick={endInterview}
              className="btn-danger text-xs px-3 py-1.5"
            >
              <FiLogOut className="text-xs" /> End
            </button>
          </div>
        </div>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 flex gap-4 min-h-0">

        {/* ── Left sidebar: webcam + info ──────────────────────────── */}
        <div className="hidden lg:flex flex-col gap-3 w-60 flex-shrink-0">

          {/* Webcam */}
          <div className="card p-3">
            <div className="relative rounded-xl overflow-hidden bg-[rgba(var(--bg-secondary),0.8)] aspect-video">
              {videoReady ? (
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <FiUser className="text-3xl text-[rgb(var(--fg-muted))]" />
                  <span className="text-xs text-[rgb(var(--fg-muted))]">Camera off</span>
                </div>
              )}
              {listening && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </div>
              )}
            </div>
            <div className="mt-2 text-center">
              <div className="text-xs font-medium">{interviewConfig?.userName || session?.user?.name || "You"}</div>
              {dominantEmotion && (
                <div className="text-xs text-[rgb(var(--fg-muted))] mt-0.5 capitalize">
                  {emotionEmoji[dominantEmotion]} {dominantEmotion}
                </div>
              )}
            </div>
          </div>

          {/* Interview info */}
          <div className="card p-4 text-xs space-y-2">
            <div className="font-semibold text-sm mb-3 gradient-text">Session Info</div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--fg-muted))]">Role</span>
              <span className="font-medium text-right max-w-[100px] truncate">{interviewConfig?.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--fg-muted))]">Type</span>
              <span className="font-medium capitalize">{interviewConfig?.interviewType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--fg-muted))]">Style</span>
              <span className="font-medium capitalize">{interviewConfig?.interviewerStyle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--fg-muted))]">Duration</span>
              <span className="font-mono font-medium">{formatDuration(elapsedSec)}</span>
            </div>
          </div>

          {/* Tips */}
          {showTips && (
            <div className="card p-4 text-xs space-y-2 border border-[rgba(var(--primary),0.2)]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm gradient-text">Tips</span>
                <button onClick={() => setShowTips(false)} className="text-[rgb(var(--fg-muted))] text-xs hover:text-[rgb(var(--fg))]">✕</button>
              </div>
              <ul className="space-y-1.5 text-[rgb(var(--fg-muted))]">
                <li>🗣️ Speak clearly and pause when done</li>
                <li>🎯 One concept per answer</li>
                <li>⭐ Use STAR method for behavioral</li>
                <li>🔄 Click Reset if mis-transcribed</li>
              </ul>
            </div>
          )}

          {/* Feedback nudge */}
          {feedback && (
            <div className="card p-3 border border-[rgba(var(--accent),0.3)] bg-[rgba(var(--accent),0.05)] text-xs animate-fadeIn">
              <div className="font-semibold text-[rgb(var(--accent))] mb-1">Coach tip</div>
              <p className="text-[rgb(var(--fg-muted))]">{feedback}</p>
            </div>
          )}
        </div>

        {/* ── Chat area ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 gap-3">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 animate-fadeInUp ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  msg.role === "assistant"
                    ? "bg-gradient-to-br from-primary-500 to-violet-500 shadow-glow"
                    : "bg-gradient-to-br from-accent-500 to-primary-500"
                }`}>
                  {msg.role === "assistant" ? <FiCpu className="text-white text-sm" /> : <FiUser className="text-white text-sm" />}
                </div>

                <div className={`flex flex-col gap-1 max-w-[75%] ${msg.role === "user" ? "items-end" : ""}`}>
                  <span className="text-xs text-[rgb(var(--fg-muted))] px-1 font-medium">
                    {msg.role === "assistant" ? "AI Interviewer" : (interviewConfig?.userName || "You")}
                  </span>
                  <div className={msg.role === "assistant" ? "chat-bubble-ai" : "chat-bubble-user"}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {/* AI typing indicator */}
            {thinking && (
              <div className="flex gap-3 animate-fadeIn">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center flex-shrink-0 pulse-ai">
                  <FiCpu className="text-white text-sm" />
                </div>
                <div className="chat-bubble-ai flex items-center gap-1.5 py-3.5">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}

            {/* Interview ended banner */}
            {interviewEnded && (
              <div className="card border border-[rgba(var(--success),0.3)] bg-[rgba(var(--success),0.05)] text-center py-6 animate-fadeInUp">
                <div className="text-3xl mb-2">🎉</div>
                <h3 className="font-bold text-lg mb-1">Interview Complete!</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">Great job! Let&apos;s see how you performed.</p>
                <button onClick={endInterview} className="btn-primary px-8 py-2.5">
                  <FiBarChart2Placeholder /> View Analysis
                </button>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* User input / transcript area */}
          <div className="card p-4 flex-shrink-0">
            {/* Mobile: webcam row */}
            <div className="lg:hidden flex items-center gap-3 mb-3 pb-3 border-b border-[rgba(var(--border),0.5)]">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[rgba(var(--bg-secondary),0.8)] flex-shrink-0">
                {videoReady ? (
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FiUser className="text-[rgb(var(--fg-muted))]" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{interviewConfig?.userName || "You"}</div>
                {dominantEmotion && <div className="text-xs text-[rgb(var(--fg-muted))] capitalize">{emotionEmoji[dominantEmotion]} {dominantEmotion}</div>}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--fg-muted))]">
                <FiClock className="text-xs" />
                <span className="font-mono">{formatDuration(elapsedSec)}</span>
              </div>
            </div>

            {/* Transcript display */}
            <div className="min-h-[52px] mb-3 px-3 py-2 rounded-xl bg-[rgba(var(--bg-secondary),0.6)] text-sm text-[rgb(var(--fg))] border border-[rgba(var(--border),0.5)]">
              {listening ? (
                transcript.length > 0 ? (
                  <span>{transcript}</span>
                ) : (
                  <span className="text-[rgb(var(--fg-muted))] italic flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                    Listening… start speaking
                  </span>
                )
              ) : thinking ? (
                <span className="text-[rgb(var(--fg-muted))] italic">AI is thinking…</span>
              ) : (
                <span className="text-[rgb(var(--fg-muted))] italic">Press mic to speak your answer</span>
              )}
            </div>

            {/* Code editor (coding interviews) */}
            {interviewConfig?.interviewType === "coding" && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowCode((v) => !v)}
                  className="flex items-center gap-2 text-xs text-primary-500 font-semibold mb-2"
                >
                  <FiCode />
                  {showCode ? "Hide" : "Show"} Code Editor
                  <FiChevronUp className={`transition-transform ${showCode ? "" : "rotate-180"}`} />
                </button>
                {showCode && (
                  <textarea
                    className="input font-mono text-sm h-36 resize-none"
                    placeholder="Write your code here…"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                )}
              </div>
            )}

            {/* Controls row */}
            <div className="flex items-center gap-2">
              {/* Mic button — primary action */}
              <button
                type="button"
                onClick={handleMicClick}
                disabled={thinking}
                className={`fab flex-shrink-0 ${
                  listening
                    ? "bg-red-500 text-white pulse-listening"
                    : "bg-gradient-to-br from-primary-500 to-violet-500 text-white"
                } ${thinking ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-label={listening ? "Stop & send" : "Start speaking"}
              >
                {listening ? <FiMicOff /> : <FiMic />}
              </button>

              <div className="flex-1 text-xs text-[rgb(var(--fg-muted))] font-medium">
                {thinking ? "AI is thinking…" : listening ? "Speaking — pause to send" : "Press mic to answer"}
              </div>

              {/* Reset transcript */}
              <button
                type="button"
                onClick={() => { resetTranscript(); lastTranscriptRef.current = ""; }}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgba(var(--border),0.4)] transition-colors"
                aria-label="Reset transcript"
                title="Reset transcript"
              >
                <FiRefreshCw className="text-sm" />
              </button>

              {/* Mute AI */}
              <button
                type="button"
                onClick={handleMute}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--fg-muted))] hover:bg-[rgba(var(--border),0.4)] transition-colors"
                aria-label={muted ? "Unmute" : "Mute AI"}
              >
                {muted ? <FiVolumeX className="text-sm" /> : <FiVolume2 className="text-sm" />}
              </button>

              {/* Submit code button if code editor is open */}
              {showCode && code.trim() && (
                <button
                  type="button"
                  onClick={() => sendToAI(transcript || "Please review my code above.")}
                  className="btn-primary text-xs px-3 py-2"
                >
                  <FiCode /> Submit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Placeholder to avoid import error for FiBarChart2 inside JSX
function FiBarChart2Placeholder() {
  return <FiBarChart2Svg />;
}
function FiBarChart2Svg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
