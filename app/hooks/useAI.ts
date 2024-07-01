"use client"

import "regenerator-runtime/runtime";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import {
   ChatPromptTemplate,
   PromptTemplate,
   SystemMessagePromptTemplate,
   AIMessagePromptTemplate,
   HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ConversationChain } from "langchain/chains";

import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { AudioRecorder, useAudioRecorder } from "react-audio-voice-recorder";
import SpeechRecognition, {
   useSpeechRecognition,
} from "react-speech-recognition";

import pdfToText from "react-pdftotext";
import { useRouter } from "next/navigation";

const useAI = () => {
   const {
      transcript,
      listening,
      resetTranscript,
      browserSupportsSpeechRecognition,
   } = useSpeechRecognition();

   const recorderControls = useAudioRecorder();
   const router = useRouter()

   const [trans, setTranscript] = useState<string>("Hello");

   const [res, setRes] = useState<string>("res");

   const { data: session, status } = useSession();


   const chainRef = useRef<ConversationChain>();


   const initializeAI = async (systemp: string,) => {
      router.replace("/interview")
      const model = new HuggingFaceInference({
         model: "meta-llama/Meta-Llama-3-8B-Instruct",
         apiKey: process.env.HUGGINGFACEHUB_API_TOKEN, // In Node.js defaults to process.env.HUGGINGFACEHUB_API_KEY
         // maxTokens:200
      });

      const template = systemp
      const systemMessagePrompt =
         SystemMessagePromptTemplate.fromTemplate(template);

      const humanTemplate = "{input}";
      const humanMessagePrompt = HumanMessagePromptTemplate.fromTemplate(humanTemplate);

      const chatPrompt = ChatPromptTemplate.fromMessages([
         systemMessagePrompt,
         humanMessagePrompt,
      ]);
      chainRef.current = new ConversationChain({
         llm: model,
         prompt: chatPrompt,
      });
      startinterview(trans)
   }

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

   return { initializeAI, onStop, res, startinterview }
}

export default useAI



// const history = new ChatMessageHistory();
// const memory = new BufferMemory({
//   chatHistory: history,
//   inputKey: "input",
// });

// const formattedChatPrompt = await chatPrompt.formatMessages({
//    role: role,
//    person: session?.user?.name,
//    resume: resume,
// });

// const speechdata = await hf.textToSpeech({
//   model: "espnet/kan-bayashi_ljspeech_vits", // espnet/kan-bayashi_ljspeech_vits
//   inputs: resdata,
// });
// console.log(resdata, speechdata);
// const audio = new Audio();
// const url = URL.createObjectURL(speechdata);
// audio.src = url;

// // Play the audio.
// audio.play();
// audio.onended = () => {
//   URL.revokeObjectURL(url);
//   resetTranscript();
//   SpeechRecognition.startListening().then(() => {
//     onGoing()
//   })
// };