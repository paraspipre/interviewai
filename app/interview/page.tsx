"use client";
import "regenerator-runtime/runtime";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";

import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import {
  ChatPromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";

import { HfInference } from "@huggingface/inference";

import { AudioRecorder, useAudioRecorder } from "react-audio-voice-recorder";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { ConversationChain } from "langchain/chains";

import pdfToText from "react-pdftotext";
import { ChainValues } from "@langchain/core/utils/types";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { MessagesPlaceholder } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory/index";
import useAI from "../hooks/useAI";

const InterviewPage = () => {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();


  const recorderControls = useAudioRecorder();
  const videoref = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  const { data: session, status } = useSession();
  const [resume, setResume] = useState<string>("resume");
  const [role, setRole] = useState<string>("Software Engineer");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file: any = e?.target?.files?.[0];
    pdfToText(file)
      .then((text) => setResume(text))
      .catch((error) => console.error("Failed to extract text from pdf"));
  };

 
  if (status === "unauthenticated") {
    router.replace("/api/auth/signin");
  }


  // const hf = new HfInference(process.env.HF_TOKEN);

  

  const [trans, setTranscript] = useState<string>("Hello");

  const [res, setRes] = useState<string>("res");

  const chainRef = useRef<ConversationChain>();

  const initializeAI = async (systemp: string) => {
    const token = process.env.NEXT_PUBLIC_HF_TOKEN;
    const model = new HuggingFaceInference({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      apiKey: token, // In Node.js defaults to process.env.HUGGINGFACEHUB_API_KEY
      maxTokens: 200,
    });

    const template = systemp;
    const systemMessagePrompt =
      SystemMessagePromptTemplate.fromTemplate(template);

    const humanTemplate = "{input}";
    const humanMessagePrompt =
      HumanMessagePromptTemplate.fromTemplate(humanTemplate);

    const chatPrompt = ChatPromptTemplate.fromMessages([
      systemMessagePrompt,
      humanMessagePrompt,
    ]);
    chainRef.current = new ConversationChain({
      llm: model,
      prompt: chatPrompt,
    });
    startinterview(trans);
  };

  const startinterview = async (trans: any) => {
    console.log("invoke model start", chainRef);
    const resdata = await chainRef.current?.invoke({
      input: trans,
    });
    console.log(resdata?.response);
    setRes(resdata?.response);

    console.log("text to speech start");
    let utterance = new SpeechSynthesisUtterance(resdata?.response);
    console.log(utterance);
    utterance.onend = start;
    utterance.rate = 3.0;
    speechSynthesis.speak(utterance);
  };

  const start = () => {
    SpeechRecognition.startListening({ continuous: true });
  };

  const onStop = () => {
    SpeechRecognition.stopListening()
      .then(() => {
        setTranscript(transcript);
        resetTranscript();
      })
      .then(() => {
        startinterview(trans);
      });
  };

   const handlesubmit = () => {
     const person = session?.user?.name;
     const systemp = `You are a very polite interviewer for ${role} job role, take interview of ${person} ask question related to job role and resume provided in context, also give response according to the answer giver by ${person}, take name of person to comfort and make environment friendly. ask one question at a time. resume ${resume}`;
     initializeAI(systemp);
   };

  const startvideo = () => {
    if (typeof window !== "undefined") {
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        if (videoref.current) {
          videoref.current.srcObject = stream;
          videoref.current.play();
        }
      });
    }
  };
  useEffect(() => {
    startvideo();
  });

  return (
    <div className="flex flex-col items-center p-10">
      <h1 className="text-xl mb-20">
        Hello {status === "authenticated" && session.user?.name}
      </h1>
      <div className="flex flex-col items-center p-10 gap-2">
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
        <input
          className="text-black focus:outline-none my-4 p-2 rounded-lg"
          type="text"
          name="role"
          placeholder="enter your role"
          onChange={(e) => setRole(e?.target?.value)}
        />
        <button
          className="py-3 px-10 bg-purple-600 rounded-3xl"
          onClick={() => handlesubmit()}
        >
          Start Interview
        </button>
      </div>
      <div className="flex w-[80%]">
        <div className="w-[50%]">
          <h3>{res}</h3>
        </div>
        <div className="w-[50%]">
          <video ref={videoref} id="videoid" width="750" height="500"></video>
          {listening ? (
            <div>
              <p>{transcript}</p>
              <button
                className=" px-2 bg-red-600 rounded-full"
                onClick={onStop}
              >
                X
              </button>
            </div>
          ) : (
            ""
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;
