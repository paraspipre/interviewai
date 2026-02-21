"use client";
import "regenerator-runtime/runtime";
import { useCallback, useContext, useEffect, useState } from "react";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { Context } from "./context/ChainContext";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import pdfToText from "react-pdftotext";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { chainRef, messageHistories } = useContext(Context);
  const [role, setRole] = useState<string>("Software Engineer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const person = status === "authenticated" ? session?.user?.name : "User";

  // FIX: Redirect in useEffect instead of during render to avoid React warnings
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/api/auth/signin");
    }
  }, [status, router]);

  const initializeAI = useCallback(
    async (resumeText: string) => {
      const model = new HuggingFaceInference({
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        apiKey: process.env.NEXT_PUBLIC_HF_TOKEN,
        temperature: 0.7,
        topP: 0.9,
      });

      const embeddings = new HuggingFaceInferenceEmbeddings({
        model: "sentence-transformers/all-MiniLM-L6-v2",
        apiKey: process.env.NEXT_PUBLIC_HF_TOKEN,
      });

      const vectorStore = await MemoryVectorStore.fromTexts(
        [resumeText],
        [{ id: 1 }],
        embeddings
      );
      const retriever = vectorStore.asRetriever();

      const contextualizeQSystemPrompt = `
      Given a chat history and the latest user question
      which might reference context in the chat history,
      formulate a standalone question which can be understood
      without the chat history. Do NOT answer the question, just
      reformulate it if needed and otherwise return it as is.`;

      const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
        ["system", contextualizeQSystemPrompt],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
      ]);

      const historyAwareRetriever = await createHistoryAwareRetriever({
        llm: model,
        retriever,
        rephrasePrompt: contextualizeQPrompt,
      });

      const qaSystemPrompt = `You are a interviewer who takes interview on the job role of ${role}. You can ask question based on context. Use three sentences maximum. It is important that you ask small question and only one question at a time. Do not ask question based on only one topic - you should cover every aspect of the role and resume. Be polite and friendly. Only give response as AI after AI: and do not give Human: response. Take name to make interview friendly - the name of human is ${person}. \n\n {context} `;

      const qaPrompt = ChatPromptTemplate.fromMessages([
        ["system", qaSystemPrompt],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
      ]);

      const questionAnswerChain = await createStuffDocumentsChain({
        llm: model,
        prompt: qaPrompt,
      });
      const runnable = await createRetrievalChain({
        retriever: historyAwareRetriever,
        combineDocsChain: questionAnswerChain,
      });

      chainRef.current = new RunnableWithMessageHistory({
        runnable,
        getMessageHistory: async (sessionId) => {
          if (!messageHistories.has(sessionId)) {
            messageHistories.set(sessionId, new InMemoryChatMessageHistory());
          }
          const history = messageHistories.get(sessionId);
          if (!history) throw new Error("Failed to get message history");
          return history;
        },
        inputMessagesKey: "input",
        historyMessagesKey: "chat_history",
        outputMessagesKey: "answer",
      });
    },
    [chainRef, messageHistories, person, role]
  );

  // FIX: Await initializeAI before navigating, pass resumeText directly to avoid stale state
  const handleSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError("");
    try {
      setLoading(true);
      const file = e?.target?.files?.[0];
      if (!file) {
        setError("No file selected. Please upload a PDF resume.");
        return;
      }
      const text = await pdfToText(file);
      if (!text || text.trim().length === 0) {
        setError("Could not extract text from PDF. Please try another file.");
        return;
      }
      await initializeAI(text);
      router.replace("/interview");
    } catch (err) {
      console.error("Error processing resume:", err);
      setError("Failed to process resume. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24">
      {/* FIX: Improved visual hierarchy and responsive layout */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
          Interview AI
        </h1>
        <p className="text-sm text-gray-400 mt-2">by Paras Pipre</p>
        <p className="text-gray-400 mt-4 max-w-md mx-auto text-sm">
          Upload your resume and let our AI conduct a mock interview tailored to
          your role.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        {/* FIX: w-full instead of fixed w-[350px] for mobile responsiveness */}
        <input
          className="text-black focus:outline-none p-4 rounded-2xl h-[50px] w-full bg-white placeholder-gray-500"
          type="text"
          name="role"
          placeholder="Enter your target role (e.g. Software Engineer)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />

        <input
          type="file"
          name="resume"
          accept=".pdf"
          onChange={(e) => handleSubmit(e)}
          hidden
          id="resume"
        />

        <button
          onClick={() => document.getElementById("resume")?.click()}
          className="py-3 px-10 bg-purple-600 hover:bg-purple-700 transition-colors rounded-3xl font-medium w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || !role.trim()}
        >
          {loading ? "Processing Resume..." : "Upload Resume to Start"}
        </button>

        {/* FIX: Show error feedback to user instead of only console.log */}
        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </main>
  );
}
