import { NextRequest, NextResponse } from "next/server";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

// ─── State definition ───────────────────────────────────────────────────────

const InterviewState = Annotation.Root({
  userMessage: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  conversationHistory: Annotation<{ role: string; content: string }[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  resume: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  role: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "Software Engineer",
  }),
  interviewType: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "technical",
  }),
  interviewerStyle: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "friendly",
  }),
  userName: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "Candidate",
  }),
  questionCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  // Outputs
  response: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  shouldEnd: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  feedback: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
});

// ─── Helper: build LLM instance ─────────────────────────────────────────────

async function buildLLM(temperature = 0.7) {
  // 1. Google Gemini (primary – fastest + free tier)
  if (process.env.GOOGLE_API_KEY) {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    return new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature,
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }
  // 2. Groq fallback (console.groq.com — free tier)
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "your-groq-api-key-here") {
    const { ChatGroq } = await import("@langchain/groq");
    return new ChatGroq({ model: "llama-3.3-70b-versatile", temperature, apiKey: process.env.GROQ_API_KEY });
  }
  throw new Error("No LLM API key configured. Add GOOGLE_API_KEY to .env.local (get one free at aistudio.google.com)");
}

// ─── Retry wrapper for 429 / quota errors ────────────────────────────────────

async function invokeWithRetry(
  llm: Awaited<ReturnType<typeof buildLLM>>,
  messages: Parameters<typeof llm.invoke>[0],
  maxRetries = 3
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await llm.invoke(messages);
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryMatch = msg.match(/retry in (\d+(\.\d+)?)s/i);
      const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : (attempt + 1) * 15;
      if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
        console.warn(`[chat] 429 quota hit — waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

// ─── Node: evaluate & generate response ─────────────────────────────────────

async function interviewNode(state: typeof InterviewState.State) {
  const llm = await buildLLM(0.7);

  const MAX_QUESTIONS = 10;
  const isWrappingUp = state.questionCount >= MAX_QUESTIONS - 1;

  const systemPrompt = `You are a ${state.interviewerStyle} interviewer conducting a ${state.interviewType} interview for the position of ${state.role}.

Candidate name: ${state.userName}
Questions asked so far: ${state.questionCount}/${MAX_QUESTIONS}

Resume context:
${state.resume?.slice(0, 2000) || "Not provided"}

Interviewing guidelines:
- Ask ONE focused question at a time. Never ask multiple questions.
- Keep your response concise (2-4 sentences for context, then 1 clear question).
- Cover different areas: ${state.interviewType === "coding" ? "data structures, algorithms, system design, debugging" : state.interviewType === "hr" ? "background, motivation, teamwork, culture fit" : state.interviewType === "behavioral" ? "STAR method scenarios, leadership, conflict resolution" : "experience, skills, projects, problem-solving"}.
- Be ${state.interviewerStyle} and professional.
- Address the candidate as ${state.userName}.
${isWrappingUp ? "- This is the LAST question. After their answer, thank them and conclude the interview professionally." : ""}
${state.questionCount === 0 ? "- Start with a warm greeting and ask them to introduce themselves." : ""}

IMPORTANT: Reply ONLY as the interviewer. Do NOT generate the candidate's response.`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...state.conversationHistory.map((m) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    ),
    new HumanMessage(state.userMessage),
  ];

  const result = await invokeWithRetry(llm, messages);
  const responseText = result.content.toString().trim();

  // Detect if interview should end
  const endPhrases = [
    "thank you for your time",
    "interview is now complete",
    "that concludes our interview",
    "best of luck",
    "we will be in touch",
    "interview is over",
  ];
  const shouldEnd =
    isWrappingUp ||
    endPhrases.some((p) => responseText.toLowerCase().includes(p));

  return {
    response: responseText,
    shouldEnd,
    questionCount: state.questionCount + 1,
  };
}

// ─── Node: quick response quality hint (agentic feedback loop) ───────────────

async function feedbackNode(state: typeof InterviewState.State) {
  // Only give coaching feedback every 3 questions
  if (state.questionCount % 3 !== 0 || state.questionCount === 0) {
    return { feedback: "" };
  }

  try {
    const llm = await buildLLM(0.3);
    const lastAnswer = state.conversationHistory
      .filter((m) => m.role === "user")
      .slice(-1)[0]?.content || "";

    if (!lastAnswer || lastAnswer.length < 20) return { feedback: "" };

    const result = await invokeWithRetry(llm, [
      new SystemMessage(
        "You are an interview coach. In ONE short sentence (max 15 words), give a quick positive or constructive tip about the candidate's last answer. Be very brief."
      ),
      new HumanMessage(`Last answer: "${lastAnswer.slice(0, 300)}"`),
    ]);

    return { feedback: result.content.toString().trim() };
  } catch {
    return { feedback: "" };
  }
}

// ─── Build the LangGraph ─────────────────────────────────────────────────────

function buildInterviewGraph() {
  return new StateGraph(InterviewState)
    .addNode("interview", interviewNode)
    .addNode("coaching", feedbackNode)
    .addEdge(START, "interview")
    .addEdge("interview", "coaching")
    .addEdge("coaching", END)
    .compile();
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message = "",
      conversationHistory = [],
      resume = "",
      role = "Software Engineer",
      interviewType = "technical",
      interviewerStyle = "friendly",
      userName = "Candidate",
      questionCount = 0,
    } = body;

    const graph = buildInterviewGraph();

    const result = await graph.invoke({
      userMessage: message,
      conversationHistory,
      resume,
      role,
      interviewType,
      interviewerStyle,
      userName,
      questionCount,
    });

    return NextResponse.json({
      response: result.response,
      shouldEnd: result.shouldEnd,
      questionCount: result.questionCount,
      feedback: result.feedback,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[interview/chat] Error:", message);
    return NextResponse.json(
      {
        error: message,
        hint:
          message.includes("API key")
            ? "Please add GROQ_API_KEY=<your-key> to .env.local and restart the dev server. Get a free key at console.groq.com"
            : undefined,
      },
      { status: 500 }
    );
  }
}
