"use client"
import "regenerator-runtime/runtime";
import Image from "next/image";
import Link from "next/link";
import FormComp from "./components/FormComp";
import { useCallback, useContext, useState } from "react";
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
import { HiDocumentArrowUp } from "react-icons/hi2";
import { useRouter } from "next/navigation";
import pdfToText from "react-pdftotext";
export default function Home() {
  
  const router = useRouter();
  const { chainRef, messageHistories } = useContext(Context);
  const [resume, setResume] = useState<string>("resume");
  const [role, setRole] = useState<string>("Software Engineer");
  const { data: session, status } = useSession();
  const person = status === "authenticated" ? session?.user?.name : "User";

  const initializeAI = useCallback(async () => {
    const model = new HuggingFaceInference({
      model: "mistralai/Mixtral-8x7B-Instruct-v0.1", //mistralai/Mixtral-8x7B-Instruct-v0.1 //meta-llama/Meta-Llama-3-8B-Instruct
      apiKey: process.env.NEXT_PUBLIC_HF_TOKEN, // In Node.js defaults to process.env.HUGGINGFACEHUB_API_KEY
      // maxTokens: 800,
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

    const qaSystemPrompt = `You are a interviewer who takes interview on the job role of ${role}. You can ask question based on context. Use three sentences maximum It is important that you ask small question and only one question at a time. and do not ask question based on only one topic you should cover every aspect of the role and resume. be polite and friendly. and only give response as AI after AI: and do not give Human: response. take name to make interview friendly the name of human is ${person}. \n\n {context} `;

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
        if (!history) throw new Error(`Failed `);
        return history;
      },
      // getMessageHistory: (sessionid) => memory,
      inputMessagesKey: "input",
      historyMessagesKey: "chat_history",
      outputMessagesKey: "answer",
    });
  }, [chainRef, messageHistories, person, resume, role]);

  const handleSubmit = () => {
    if (resume && role) {
      initializeAI();
      router.replace("/interview")
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file: any = e?.target?.files?.[0];
    const text = await pdfToText(file);
    setResume(text);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-10  sm:p-24">
      <div>
        <h1 className="text-[48px] sm:text-[64px]">Interview AI </h1>
        <h3 className="text-end">by Paras Pipre</h3>
      </div>
      <div className="flex items-center gap-2 mt-32 mb-4">
        <input
          className="text-black focus:outline-none my-4 p-2 rounded-lg"
          type="text"
          name="role"
          placeholder="Enter your role"
          onChange={(e) => setRole(e?.target?.value)}
        />
        <input
          type="file"
          name="resume"
          onChange={(e) => handleFileChange(e)}
          hidden
          id="resume"
        />
        <button
          onClick={() => document.getElementById("resume")?.click()}
          className="p-2 text-3xl bg-purple-600 rounded-3xl"
        >
          <HiDocumentArrowUp />
        </button>

      </div>
        <button
          className="py-3 px-20 bg-purple-600 rounded-3xl"
          onClick={handleSubmit}
        >
          Start
        </button>
    </main>
  );
}
