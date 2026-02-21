"use client";

import "regenerator-runtime/runtime";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ConversationChain } from "langchain/chains";
import { useRef, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useRouter } from "next/navigation";

const useAI = () => {
  const {
    transcript,
    resetTranscript,
  } = useSpeechRecognition();

  const router = useRouter();
  const [res, setRes] = useState<string>("");
  const chainRef = useRef<ConversationChain>();

  const initializeAI = async (systemp: string) => {
    router.replace("/interview");
    const model = new HuggingFaceInference({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      apiKey: process.env.HUGGINGFACEHUB_API_TOKEN,
    });

    const systemMessagePrompt =
      SystemMessagePromptTemplate.fromTemplate(systemp);
    const humanMessagePrompt =
      HumanMessagePromptTemplate.fromTemplate("{input}");

    const chatPrompt = ChatPromptTemplate.fromMessages([
      systemMessagePrompt,
      humanMessagePrompt,
    ]);
    chainRef.current = new ConversationChain({
      llm: model,
      prompt: chatPrompt,
    });
    // FIX: Pass transcript directly instead of stale `trans` state
    startinterview(transcript || "Hello");
  };

  const startinterview = async (input: string) => {
    const resdata = await chainRef.current?.invoke({
      input: input,
    });
    setRes(resdata?.response);

    const utterance = new SpeechSynthesisUtterance(resdata?.response);
    utterance.onend = start;
    // FIX: Speech rate changed from 3.0 (unintelligibly fast) to 1.0 (normal)
    utterance.rate = 1.0;
    speechSynthesis.speak(utterance);
  };

  const start = () => {
    SpeechRecognition.startListening({ continuous: true });
  };

  // FIX: Pass transcript directly to startinterview to avoid stale closure bug
  const onStop = () => {
    SpeechRecognition.stopListening()
      .then(() => {
        const currentTranscript = transcript;
        resetTranscript();
        return currentTranscript;
      })
      .then((text) => {
        startinterview(text);
      });
  };

  return { initializeAI, onStop, res, startinterview };
};

export default useAI;
