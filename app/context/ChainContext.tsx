"use client";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { Runnable } from "@langchain/core/runnables";
import {
  createContext,
  MutableRefObject,
  ReactNode,
  useRef,
  useState,
} from "react";

// FIX: Simplified type definitions - removed deprecated LLMChain usage
type ExpressionsObject = {
  angry: number;
  disgusted: number;
  fearful: number;
  happy: number;
  neutral: number;
  sad: number;
  surprised: number;
};

type ContextType = {
  sessionId: string;
  chainRef: MutableRefObject<Runnable | null>;
  messageHistories: Map<string, InMemoryChatMessageHistory>;
  setMap: (key: string, value: InMemoryChatMessageHistory) => void;
  getMap: (key: string) => InMemoryChatMessageHistory | undefined;
  expressionsObject: ExpressionsObject;
  setExpressionsObject: (expressions: ExpressionsObject) => void;
};

const defaultExpressions: ExpressionsObject = {
  angry: 0,
  disgusted: 0,
  fearful: 0,
  happy: 0,
  neutral: 0,
  sad: 0,
  surprised: 0,
};

const contextDefaultValues: ContextType = {
  sessionId: "",
  // FIX: Initialize chainRef as null instead of using deprecated LLMChain
  chainRef: { current: null } as MutableRefObject<Runnable | null>,
  messageHistories: new Map<string, InMemoryChatMessageHistory>(),
  setMap: () => {},
  getMap: () => undefined,
  expressionsObject: defaultExpressions,
  setExpressionsObject: () => {},
};

export const Context = createContext<ContextType>(contextDefaultValues);

// FIX: Simplified Provider props type to use ReactNode
export const Provider = ({ children }: { children: ReactNode }) => {
  const [sessionId] = useState(Date.now().toString());
  const [expressionsObject, setExpressionsObject] =
    useState<ExpressionsObject>(defaultExpressions);

  // FIX: No longer creating deprecated LLMChain at module/init level
  const chainRef = useRef<Runnable | null>(null);

  const [messageHistories, setMapState] = useState<
    Map<string, InMemoryChatMessageHistory>
  >(new Map<string, InMemoryChatMessageHistory>());

  const setMap = (key: string, value: InMemoryChatMessageHistory) => {
    setMapState((prevMap) => new Map(prevMap.set(key, value)));
  };

  const getMap = (key: string) => {
    return messageHistories.get(key);
  };

  return (
    <Context.Provider
      value={{
        chainRef,
        sessionId,
        messageHistories,
        setMap,
        getMap,
        expressionsObject,
        setExpressionsObject,
      }}
    >
      {children}
    </Context.Provider>
  );
};
