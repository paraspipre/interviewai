"use client";
import { useEffect, useState, useRef } from "react";
import { createMediaStream } from "../utils/createMediaStream";

import { HfInference } from "@huggingface/inference";
export const useRecordVoice = () => {
   const [text, setText] = useState("");
   const [mediaRecorder, setMediaRecorder] = useState <MediaRecorder>();
   const [recording, setRecording] = useState(false);
   const isRecording = useRef(false);
   const chunks = useRef([] as any);

   const hf = new HfInference(process.env.HUGGINGFACEHUB_API_TOKEN);

   const startRecording = () => {
      if (typeof window !== "undefined") {
         navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then(stream => initialMediaRecorder(stream))
            .then(() => {
                  isRecording.current = true;
                  mediaRecorder?.start(10000);
                  setRecording(true);
         })
      }
   };

   const stopRecording = () => {
      if (mediaRecorder) {
         isRecording.current = false;
         mediaRecorder.stop();
         setRecording(false);
      }

      //reset API properties for next recording
   };

   

   const getText = async (audioBlob: Blob) => {
      try {
         console.log("gettext start")
         const response = await hf.automaticSpeechRecognition({
            model: 'facebook/wav2vec2-large-960h-lv60-self',
            data: audioBlob
         })
         console.log(response)
         const { text } = response;
         setText(text);
      } catch (error) {
         console.log(error);
      }
   };

   // const blobToBase64 = (blob:any, callback:any) => {
   //    const reader = new FileReader();
   //    reader.onload = function () {
   //       const base64data = reader?.result?.split(",")[1]
   //       callback(base64data);
   //    };
   //    reader.readAsDataURL(blob);
   // };

   const logPeakLevel = (peakLevel:any) => {
      console.log("Current peak level:", peakLevel);
   };

   const initialMediaRecorder = (stream:any) => {
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.onstart = () => {
         // createMediaStream(stream, recording, logPeakLevel)
         console.log("recoring start")
         chunks.current = [];
      };

      mediaRecorder.ondataavailable = (ev) => {

         console.log("recoring start,availabe data")
         console.log(chunks)
         chunks.current.push(ev.data);
      };

      mediaRecorder.onstop = () => {
         console.log("recoring stop,get tesxt called")
         const audioBlob = new Blob(chunks.current, { type: "audio/wav" });
         console.log("audioBlob", audioBlob)
         getText(audioBlob)
      };

      setMediaRecorder(mediaRecorder);
   };

   // useEffect(() => {
   //    if (typeof window !== "undefined") {
   //       navigator.mediaDevices
   //          .getUserMedia({ audio: true })
   //          .then(stream =>initialMediaRecorder(stream));
   //    }
   // });

   return { recording, startRecording, stopRecording, text };
};