"use client";
import "regenerator-runtime/runtime";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, MutableRefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import {
  ChatPromptTemplate
} from "@langchain/core/prompts";


import { AudioRecorder, useAudioRecorder } from "react-audio-voice-recorder";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

import pdfToText from "react-pdftotext";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { MessagesPlaceholder } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Runnable } from "@langchain/core/runnables";
import {
  RunnableWithMessageHistory,
} from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { TiArrowRepeat } from "react-icons/ti";
import { FaMicrophoneSlash } from "react-icons/fa";
import { IoExit } from "react-icons/io5";
import { Context } from "../context/ChainContext";


const InterviewPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  if (status === "unauthenticated") {
    router.replace("/api/auth/signin");
  }
  const { chainRef, messageHistories , sessionId } = useContext(Context);
  const {transcript,listening,resetTranscript} = useSpeechRecognition();
  const videoref = useRef<HTMLVideoElement>(null);
  const [res, setRes] = useState<string>("");
  const [hover, setHover] = useState(true);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    startVideo()
    startAudio()
  },[])

  const startinterview = useCallback(async (trans: string) => {
    console.log(trans);
    setRes("");
    setThinking(true)
    const resdata = await chainRef.current?.invoke(
      {
        input: trans,
      },
      { configurable: { sessionId } }
    );
    console.log({ resdata });
    const reply = resdata?.answer
      ?.split("(Note:")[0]
      ?.split("Human:")[0]
      ?.split("AI:")
      ?.slice(1)
      ?.join(" ")
    
    setRes(reply);
    setThinking(false)

    let utterance = new SpeechSynthesisUtterance(reply);
    console.log(utterance);
    utterance.onend = startAudio;
    utterance.rate = 1.0;
    speechSynthesis.speak(utterance);
    console.log(messageHistories)
  },[chainRef, messageHistories, sessionId]);

  const startAudio = () => {
    SpeechRecognition.startListening({ continuous: true });
  };

  const onStop = () => {
    SpeechRecognition.stopListening()
      .then(() => {
        startinterview(transcript);
        resetTranscript()
      })
  };

  const startVideo = () => {
    if (typeof window !== "undefined") {
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        if (videoref.current) {
          videoref.current.srcObject = stream;
          videoref.current.play();
        }
      });
    }
  };

  const StopInterview = () => {
    setRes("")
    resetTranscript();
    router.replace("/interview/analysis");
  }

  return (
    <div className="flex flex-col p-10 h-screen">
      <h1 className="text-xl">
        Hello {status === "authenticated" && session.user?.name}
      </h1>
      <div className="w-full flex flex-col justify-between h-full">
        <div className="flex flex-col h-full sm:flex-row">
          <div className="sm:w-[50%]">
            <video ref={videoref} id="videoid" width="750" height="500"></video>
          </div>
          <div className="sm:w-[50%] h-full flex flex-col justify-between px-2">
            <div className="h-[200px] sm:h-[50%] overflow-y-scroll">
              <div className="text-center">AI Interviewer</div>
              {thinking ? <div>Thinking...</div> : <h3 className="">{res}</h3>}
            </div>
            <div className="h-[200px] sm:h-[50%] overflow-y-scroll ">
              <div className="text-center ">
                {status === "authenticated" && session.user?.name}
              </div>
              {listening ? (
                <p className="">{transcript}</p>
              ) : (
                ""
              )}
            </div>
          </div>
        </div>
        <div className="fixed flex  bottom-0 left-0 w-full items-center justify-center gap-4 sm:gap-12  p-4 backdrop-blur-2xl">
          {listening && (
            <div className="relative">
              {hover && (
                <div className="absolute bottom-16 left-0 backdrop-blur-2xl p-2 rounded-12">
                  Click after answering 👇🏻
                </div>
              )}
              <button
                onMouseOver={() => setHover(false)}
                onMouseLeave={() => setHover(true)}
                className="flex items-center p-4 text-3xl bg-red-600 rounded-full"
                onClick={onStop}
              >
                <FaMicrophoneSlash />
              </button>
            </div>
          )}
          <div className="relative">
            {hover && (
              <div className="absolute bottom-16 left-0 backdrop-blur-2xl p-2 rounded-12">
                Click to reset transcript 👇🏻
              </div>
            )}
            <button
              onMouseOver={() => setHover(false)}
              onMouseLeave={() => setHover(true)}
              className="flex items-center p-4 text-3xl bg-purple-600 rounded-full"
              onClick={() => resetTranscript()}
            >
              <TiArrowRepeat />
            </button>
          </div>
          <div className="relative">
            {hover && (
              <div
                onMouseOver={() => setHover(false)}
                onMouseLeave={() => setHover(true)}
                className="absolute bottom-16 left-0 backdrop-blur-2xl p-2 rounded-12"
              >
                Click to end interview 👇🏻
              </div>
            )}
            <button
              className="flex items-center p-4 text-3xl bg-red-600 rounded-full gap-2"
              onClick={StopInterview}
            >
              <IoExit />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;
