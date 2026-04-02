import { NextRequest, NextResponse } from "next/server";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// Allow up to 120s for this route (Vercel/Next.js edge config)
export const maxDuration = 120;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnalysisResult {
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

// ─── State ───────────────────────────────────────────────────────────────────

const AnalysisState = Annotation.Root({
  conversationHistory: Annotation<{ role: string; content: string }[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  expressionsData: Annotation<Record<string, number>>({
    reducer: (x, y) => y ?? x,
    default: () => ({}),
  }),
  role: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => "Software Engineer" }),
  interviewType: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => "technical" }),
  duration: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 0 }),
  resume: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => "" }),
  // Output
  result: Annotation<AnalysisResult | null>({ reducer: (x, y) => y ?? x, default: () => null }),
});

// ─── Build LLM ───────────────────────────────────────────────────────────────

async function buildLLM(temperature = 0.3) {
  if (process.env.GOOGLE_API_KEY) {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    return new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature,
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "your-groq-api-key-here") {
    const { ChatGroq } = await import("@langchain/groq");
    return new ChatGroq({ model: "llama-3.3-70b-versatile", temperature, apiKey: process.env.GROQ_API_KEY });
  }
  throw new Error("No LLM API key configured. Add GOOGLE_API_KEY to .env.local (get one free at aistudio.google.com)");
}

// ─── Retry wrapper for 429 / quota errors ────────────────────────────────────

async function invokeWithRetry(
  llm: Awaited<ReturnType<typeof buildLLM>>,
  messages: (SystemMessage | HumanMessage)[],
  maxRetries = 3
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await llm.invoke(messages);
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Extract retry delay from Gemini 429 message, e.g. "Please retry in 34s"
      const retryMatch = msg.match(/retry in (\d+(\.\d+)?)s/i);
      const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : (attempt + 1) * 15;
      if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
        console.warn(`[analyze] 429 quota hit — waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
      } else {
        throw err; // non-quota errors bubble immediately
      }
    }
  }
  throw lastError;
}

function safeParseJSON(text: string): Record<string, unknown> {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return {};
}

// ─── Compute confidence from face expressions ─────────────────────────────────

function computeConfidence(expr: Record<string, number>): number {
  const raw =
    (expr.happy || 0) * 100 +
    (expr.neutral || 0) * 75 +
    (expr.surprised || 0) * 55 -
    (expr.fearful || 0) * 50 -
    (expr.sad || 0) * 40 -
    (expr.angry || 0) * 30 -
    (expr.disgusted || 0) * 25 +
    30;
  return Math.min(100, Math.max(10, Math.round(raw)));
}

// ─── Single analysis node ─────────────────────────────────────────────────────

async function analyzeNode(state: typeof AnalysisState.State) {
  const llm = await buildLLM(0.3);

  const userAnswers = state.conversationHistory
    .filter((m) => m.role === "user")
    .map((m, i) => `Answer ${i + 1}: ${m.content.slice(0, 400)}`)
    .join("\n\n");

  const aiQuestions = state.conversationHistory
    .filter((m) => m.role === "assistant")
    .map((m) => m.content.slice(0, 200))
    .join("\n");

  const confidenceScore = computeConfidence(state.expressionsData);

  const response = await invokeWithRetry(llm, [
    new SystemMessage(
      `You are a senior technical interviewer and HR expert. Analyze this ${state.interviewType} interview for the role of ${state.role}.
Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "technicalScore": <0-100>,
  "communicationScore": <0-100>,
  "problemSolvingScore": <0-100>,
  "summary": "<2-3 sentence summary>",
  "detailedFeedback": "<3 paragraph detailed feedback>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<area 1>", "<area 2>", "<area 3>"],
  "recommendations": ["<action 1>", "<action 2>", "<action 3>", "<action 4>"],
  "questionBreakdown": [
    {"question": "<brief question>", "answer": "<brief answer summary>", "quality": "excellent|good|average|poor", "score": <0-100>}
  ],
  "hiringVerdict": "Strong Yes|Yes|Maybe|No",
  "verdictReason": "<one sentence>"
}`
    ),
    new HumanMessage(
      `Role: ${state.role}
Interview Type: ${state.interviewType}
Duration: ${state.duration} minutes
Confidence (from facial analysis): ${confidenceScore}/100

QUESTIONS ASKED:
${aiQuestions.slice(0, 1500)}

CANDIDATE ANSWERS:
${userAnswers.slice(0, 2500)}`
    ),
  ]);

  const parsed = safeParseJSON(response.content.toString());

  const technicalScore = (parsed.technicalScore as number) || 65;
  const communicationScore = (parsed.communicationScore as number) || 65;
  const problemSolvingScore = (parsed.problemSolvingScore as number) || 65;
  const overallScore = Math.round(
    technicalScore * 0.4 +
    communicationScore * 0.3 +
    confidenceScore * 0.15 +
    problemSolvingScore * 0.15
  );

  const result: AnalysisResult = {
    overallScore,
    technicalScore,
    communicationScore,
    confidenceScore,
    problemSolvingScore,
    summary: (parsed.summary as string) || "The candidate demonstrated adequate performance.",
    detailedFeedback: (parsed.detailedFeedback as string) || "Performance was satisfactory with room for growth.",
    strengths: (parsed.strengths as string[]) || ["Shows effort", "Communicates clearly"],
    improvements: (parsed.improvements as string[]) || ["Deepen technical knowledge", "Use more concrete examples"],
    recommendations: (parsed.recommendations as string[]) || [
      "Practice more mock interviews",
      "Study core concepts for the role",
      "Use the STAR method for behavioral questions",
    ],
    questionBreakdown: (parsed.questionBreakdown as AnalysisResult["questionBreakdown"]) || [],
    hiringVerdict: ((parsed.hiringVerdict as string) || "Maybe") as AnalysisResult["hiringVerdict"],
    verdictReason: (parsed.verdictReason as string) || "Evaluation pending further review.",
  };

  return { result };
}

// ─── Build graph ──────────────────────────────────────────────────────────────

function buildAnalysisGraph() {
  return new StateGraph(AnalysisState)
    .addNode("analyze", analyzeNode)
    .addEdge(START, "analyze")
    .addEdge("analyze", END)
    .compile();
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      conversationHistory = [],
      expressionsData = {},
      role = "Software Engineer",
      interviewType = "technical",
      duration = 0,
      resume = "",
    } = body;

    if (conversationHistory.length < 2) {
      return NextResponse.json(
        { error: "Not enough conversation data to analyze." },
        { status: 400 }
      );
    }

    const graph = buildAnalysisGraph();
    const state = await graph.invoke({
      conversationHistory,
      expressionsData,
      role,
      interviewType,
      duration,
      resume,
    });

    if (!state.result) {
      return NextResponse.json({ error: "Analysis produced no result." }, { status: 500 });
    }

    return NextResponse.json(state.result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[interview/analyze] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
