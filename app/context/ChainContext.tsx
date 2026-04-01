"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export interface InterviewConfig {
  role: string;
  interviewType: string;
  interviewerStyle: string;
  resume: string;
  userName: string;
}

export interface ExpressionsData {
  angry: number;
  disgusted: number;
  fearful: number;
  happy: number;
  neutral: number;
  sad: number;
  surprised: number;
}

interface ContextType {
  // Session
  sessionId: string;

  // Interview configuration
  interviewConfig: InterviewConfig | null;
  setInterviewConfig: (config: InterviewConfig) => void;

  // Conversation history (replaces InMemoryChatMessageHistory)
  conversationHistory: ChatMessage[];
  addMessage: (role: "user" | "assistant", content: string) => void;
  clearHistory: () => void;

  // Question tracking
  questionCount: number;
  setQuestionCount: (n: number) => void;

  // Facial expression data
  expressionsObject: ExpressionsData;
  setExpressionsObject: (data: ExpressionsData) => void;

  // Interview timing
  startTime: number | null;
  setStartTime: (t: number | null) => void;

  // Legacy ref kept for any remaining references
  chainRef: React.MutableRefObject<null>;
  messageHistories: Map<string, unknown>;
}

const defaultExpressions: ExpressionsData = {
  angry: 0,
  disgusted: 0,
  fearful: 0,
  happy: 0,
  neutral: 0,
  sad: 0,
  surprised: 0,
};

const defaultContext: ContextType = {
  sessionId: "",
  interviewConfig: null,
  setInterviewConfig: () => {},
  conversationHistory: [],
  addMessage: () => {},
  clearHistory: () => {},
  questionCount: 0,
  setQuestionCount: () => {},
  expressionsObject: defaultExpressions,
  setExpressionsObject: () => {},
  startTime: null,
  setStartTime: () => {},
  chainRef: { current: null },
  messageHistories: new Map(),
};

export const Context = createContext<ContextType>(defaultContext);

export function useInterview() {
  return useContext(Context);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function Provider({ children }: { children: ReactNode }) {
  const [sessionId] = useState(() => Date.now().toString());
  const [interviewConfig, setInterviewConfigState] = useState<InterviewConfig | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [expressionsObject, setExpressionsObject] = useState<ExpressionsData>(defaultExpressions);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Legacy refs (kept so existing code referencing them doesn't crash)
  const chainRef = useRef<null>(null);
  const messageHistories = useRef(new Map()).current;

  const setInterviewConfig = useCallback((config: InterviewConfig) => {
    setInterviewConfigState(config);
  }, []);

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    setConversationHistory((prev) => [
      ...prev,
      { role, content, timestamp: Date.now() },
    ]);
  }, []);

  const clearHistory = useCallback(() => {
    setConversationHistory([]);
    setQuestionCount(0);
    setStartTime(null);
    setExpressionsObject(defaultExpressions);
  }, []);

  return (
    <Context.Provider
      value={{
        sessionId,
        interviewConfig,
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
        chainRef,
        messageHistories,
      }}
    >
      {children}
    </Context.Provider>
  );
}
