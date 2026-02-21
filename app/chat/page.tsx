"use client";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import React, { useCallback, useEffect, useRef, useState } from "react";
import pdfToText from "react-pdftotext";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Runnable, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

let messageHistories = new Map<string, InMemoryChatMessageHistory>();
const sessionId = Date.now().toString();

type ChatMessage = {
  role: "user" | "ai";
  content: string;
};

const Chat = () => {
  const [userQuery, setUserQuery] = useState("");
  const chainRef = useRef<Runnable>();
  // FIX: typing state is now properly toggled during AI response generation
  const [typing, setIsTyping] = useState(false);
  // FIX: Initialize with empty array instead of [{role:"", content:""}]
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [resume, setResume] = useState<string>("resume");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const role = "software development engineer";
  const person = "User";

  const initializeAi = useCallback(async () => {
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
      [resume],
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
      getMessageHistory: async (sid) => {
        if (!messageHistories.has(sid)) {
          messageHistories.set(sid, new InMemoryChatMessageHistory());
        }
        const history = messageHistories.get(sid);
        if (!history) throw new Error("Failed to get message history");
        return history;
      },
      inputMessagesKey: "input",
      historyMessagesKey: "chat_history",
      outputMessagesKey: "answer",
    });
  }, [resume]);

  useEffect(() => {
    initializeAi();
  }, [initializeAi]);

  // FIX: Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  const handleSubmit = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.FormEvent
  ) => {
    e.preventDefault();
    if (userQuery.trim() === "") return;

    // FIX: Create new array instead of mutating state directly (was: chats.push(...))
    const userMessage: ChatMessage = { role: "user", content: userQuery };
    setChats((prev) => [...prev, userMessage]);
    setUserQuery("");
    // FIX: Set typing to true while waiting for AI response
    setIsTyping(true);

    try {
      const resdata = await chainRef?.current?.invoke(
        { input: userQuery },
        { configurable: { sessionId } }
      );

      const reply = resdata?.answer
        ?.split("(Note:")[0]
        ?.split("Human:")[0]
        ?.split("AI:")
        ?.slice(1)
        ?.join(" ")
        ?.trim();

      // FIX: AI response now correctly uses role "ai" instead of "user"
      const aiMessage: ChatMessage = {
        role: "ai",
        content: reply || "No response generated.",
      };
      setChats((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage: ChatMessage = {
        role: "ai",
        content: "Sorry, an error occurred. Please try again.",
      };
      setChats((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      const text = await pdfToText(file);
      setResume(text);
    } catch (err) {
      console.error("PDF extraction error:", err);
    }
  };

  // FIX: Handle Enter key submission in chat input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    // FIX: Changed bg-[#FFF] text-black to dark theme matching rest of app
    <div className="bg-gray-950 text-white flex w-full h-screen py-4 px-4">
      <div className="w-full flex items-center justify-center h-full">
        <div className="w-full max-w-3xl flex flex-col h-full justify-between pb-4 rounded-xl">
          {/* Chat header */}
          <div className="text-center py-3 font-semibold text-lg border-b border-gray-800">
            Interview Chat
          </div>

          {/* Messages area */}
          <div className="flex flex-col gap-3 overflow-y-auto scrollbar-hide flex-1 mt-4 px-2">
            {chats.length === 0 && (
              <div className="flex flex-col justify-center items-center h-full text-gray-500">
                Upload your resume and start chatting!
              </div>
            )}

            {/* FIX: Distinct styling for user vs AI messages (were all styled the same) */}
            {chats.map((message, index) => (
              <div
                key={index}
                className={`w-full rounded-xl p-4 ${
                  message.role === "user"
                    ? "bg-purple-600/20 border border-purple-600/30"
                    : "bg-gray-800"
                }`}
              >
                <span className="text-xl mr-3">
                  {message.role === "user" ? "👤" : "🤖"}
                </span>
                {message.content}
              </div>
            ))}

            {/* FIX: Show typing indicator when AI is generating */}
            {typing && (
              <div className="w-full rounded-xl p-4 bg-gray-800">
                <span className="text-xl mr-3">🤖</span>
                <span className="italic text-gray-400">
                  Generating response...
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* FIX: Fixed broken CSS class strings that had un-escaped ternary operators */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full mt-3 p-2 bg-gray-800 rounded-xl">
            <input
              className="flex-1 w-full p-3 bg-gray-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-white placeholder-gray-500"
              placeholder="Type your response..."
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <input
              type="file"
              name="resume"
              accept=".pdf"
              onChange={(e) => handleFileChange(e)}
              hidden
              id="chat-resume"
            />
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() =>
                  document.getElementById("chat-resume")?.click()
                }
                className="py-2 px-4 bg-purple-600 hover:bg-purple-700 transition-colors rounded-xl text-sm whitespace-nowrap flex-1 sm:flex-none"
              >
                Upload Resume
              </button>
              <button
                onClick={(e) => handleSubmit(e)}
                disabled={typing || userQuery.trim() === ""}
                className="py-2 px-6 bg-green-600 hover:bg-green-700 transition-colors rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
