"use client"
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { Runnable, RunnableConfig, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { LLMChain } from "langchain/chains";
import { AwaitedReactNode, createContext, Dispatch, JSXElementConstructor, MutableRefObject, ReactElement, ReactNode, ReactPortal, SetStateAction, useRef, useState } from "react";

const llm = new HuggingFaceInference({
  model: "mistralai/Mixtral-8x7B-Instruct-v0.1", //mistralai/Mixtral-8x7B-Instruct-v0.1 //meta-llama/Meta-Llama-3-8B-Instruct
  apiKey: process.env.NEXT_PUBLIC_HF_TOKEN, // In Node.js defaults to process.env.HUGGINGFACEHUB_API_KEY
  // maxTokens: 800,
  temperature: 0.7,
  topP: 0.9,
});

type ContextType = {
  sessionId: string;
  chainRef: MutableRefObject<Runnable>;
  messageHistories: Map<string, InMemoryChatMessageHistory>;
  setMap: (key: string, value: any) => void;
  getMap: (key: string) => void;
};

const contextDefaultValues: ContextType = {
  sessionId :"",
  chainRef: { current:   new LLMChain({llm,prompt:ChatPromptTemplate.fromMessages([["user", "{input}"]])})} as MutableRefObject<Runnable>,
   messageHistories: new Map<string, InMemoryChatMessageHistory>(),
   setMap: (key: string, value: any) => {},
  getMap: (key: string) => {}
};

export const Context = createContext<ContextType>(contextDefaultValues);


export const Provider = (props: { children: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; }) => {
  const [sessionId, setSessionId] = useState(Date.now().toString());
   
  const chainRef = useRef<Runnable>(
    new LLMChain({
      llm,
      prompt: ChatPromptTemplate.fromMessages([
        ["system", "You are a world class technical documentation writer."],
        ["user", "{input}"],
      ]),
    })
   );

   const [messageHistories, setMapState] = useState<
     Map<string, InMemoryChatMessageHistory>
   >(new Map<string, InMemoryChatMessageHistory>());

   const setMap = (key: string, value: any) => {
     setMapState((prevMap) => new Map(prevMap.set(key, value)));
   };

   const getMap = (key: string) => {
     return messageHistories.get(key);
   };

  return (
    <Context.Provider value={{ chainRef, sessionId, messageHistories , setMap , getMap }}>
      {props.children}
    </Context.Provider>
  );
};
