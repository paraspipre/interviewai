"use client";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ConversationChain } from "langchain/chains";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BufferMemory, ChatMessageHistory } from "langchain/memory";
import { StructuredOutputParser } from "langchain/output_parsers";

import pdfToText from "react-pdftotext";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Runnable, RunnableConfig, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

let messageHistories = new Map<string, InMemoryChatMessageHistory>();
const sessionId = Date.now().toString();


const Chat = () => {
  const [userQuery, setUserQuery] = useState("");

  const chainRef = useRef<Runnable>();
  const modelRef = useRef<HuggingFaceInference>();
  const [typing, setIsTyping] = useState(false);
  const [chats, setChats] = useState([{ role: "", content: "" }]);

  const [resume, setResume] = useState<string>("resume");

  // const config: RunnableConfig = { configurable: { sessionId: "1" } };

  // const template = `You are a interviewer chatbot who takes interview. You can ask question based on resume: ${resume} and role: ${role}. It is important that you ask small question and only one question at a time. and do not ask question based on only one topic you should cover every aspect of the role and resume. be polite and friendly. and give response after AI: and do not give Human: response. take name to make interview friendly the name of human is ${person}. `;
  const role = "software development engineer";
  const person = "Paras Pipre";
  // const resume = "skills: pyhton , javascript , expreience : full stack developer at Tapop";
  // const systemMessagePrompt =
  // SystemMessagePromptTemplate.fromTemplate(template);

  // memoryRef.current = new BufferMemory({
  //   memoryKey: "chat_history",
  //   returnMessages: true,
  // });
  const initializeAi = useCallback(async () => {
    modelRef.current = new HuggingFaceInference({
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
      llm: modelRef.current,
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
      llm: modelRef.current,
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
        if (!history)throw new Error(`Failed `)
        return history
      },
      // getMessageHistory: (sessionid) => memory,
      inputMessagesKey: "input",
      historyMessagesKey: "chat_history",
      outputMessagesKey: "answer",
    });
  }, [resume]);

  useEffect(() => {
    initializeAi();
  }, [initializeAi]);
  
  const handleSubmit = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.preventDefault();
    if (userQuery === "") return;
    let newchat = chats;
    newchat.push({ role: "user", content: userQuery });
    setChats(newchat);
    const resdata = await chainRef?.current?.invoke(
      { input: userQuery },
      { configurable: { sessionId } }
    );
    console.log(resdata);
    console.log(messageHistories);
    const reply = resdata?.answer
      .split("(Note:")[0]
      .split("Human:")[0]
      .split("AI:")
      .slice(1)
      .join(" ");
    // .split("System:")
    // .slice(1)
    // .join(" ")

    setUserQuery("");
    let newaichat = chats;
    newaichat.push({ role: "user", content: reply });
    setChats(newaichat);
    console.log(chainRef);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file: any = e?.target?.files?.[0];
    const text = await pdfToText(file);
    setResume(text);
  };

  return (
    <div className={`bg-[#FFF] text-black flex w-full h-[100vh] py-4 px-4`}>
      <div className="w-full md:w-[80%] flex items-center justify-center h-full ">
        <div className="w-full md:w-[80%] self-center flex flex-col h-full justify-between backdrop-blur-xl pb-4 rounded-[12px]">
          <div className="flex items-center justify-between"></div>
          <div className="flex flex-col gap-3 overflow-y-scroll no-scrollbar h-full mt-4">
            {chats?.map((message, index) => (
              <div key={index} className={`w-full rounded-[12px] bg-[#35383F]`}>
                <div
                  className={` w-full  rounded-[12px] p-4 bg-[#17CE92] text-[20px]`}
                >
                  <span className=" text-[24px] mr-4">👨🏻</span>
                  {message.content}
                </div>
              </div>
            )) || (
              <div className="flex flex-col justify-center items-center">
                Create New Chat or Select old chats
              </div>
            )}
            {typing && (
              <div
                className={`w-full  self-start received rounded-[12px] p-4 "bg-[#F5F5F5]" : "bg-[#35383F]"}`}
              >
                <div className=" w-full self-end rounded-[12px] p-4 bg-[#17CE92] text-[20px]">
                  <span className=" text-[24px] mr-4">👨🏻</span>
                  {userQuery}
                </div>
                <div className="p-4 flex  ">🤖 generating...</div>
              </div>
            )}
          </div>

          <div
            className={`flex justify-between items-center self-center w-full mt-3 p-2 bg-[#35383F] rounded-[12px]`}
          >
            <input
              className={`w-full p-2 "bg-[#F5F5F5]" "bg-[#35383F]"
              } rounded-[12px] focus:outline-none`}
              placeholder="Type your question..."
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
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
              className="py-3 px-10 bg-purple-600 rounded-3xl"
            >
              upload resume
            </button>
            <button
              onClick={(e) => handleSubmit(e)}
              className="send-button text-[#17CE92] text-[28px]"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
