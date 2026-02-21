"use client";
import { useState, useRef, useCallback } from "react";
import { HfInference } from "@huggingface/inference";

// FIX: Create HfInference instance outside component to avoid recreation on every render
const hf = new HfInference(process.env.NEXT_PUBLIC_HF_TOKEN);

export const useRecordVoice = () => {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  // FIX: Use ref instead of state so start() is called on the current instance
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const getText = useCallback(async (audioBlob: Blob) => {
    try {
      const response = await hf.automaticSpeechRecognition({
        model: "facebook/wav2vec2-large-960h-lv60-self",
        data: audioBlob,
      });
      setText(response.text);
    } catch (error) {
      console.error("Speech recognition error:", error);
    }
  }, []);

  const initMediaRecorder = useCallback(
    (stream: MediaStream) => {
      const recorder = new MediaRecorder(stream);

      recorder.onstart = () => {
        // FIX: Typo fixed from "recoring" to "recording"
        chunks.current = [];
      };

      recorder.ondataavailable = (ev) => {
        chunks.current.push(ev.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks.current, { type: "audio/wav" });
        getText(audioBlob);
      };

      mediaRecorderRef.current = recorder;
    },
    [getText]
  );

  // FIX: Uses ref so start() is called on the actual instance, not stale state
  const startRecording = useCallback(() => {
    if (typeof window !== "undefined") {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          initMediaRecorder(stream);
          mediaRecorderRef.current?.start(10000);
          setRecording(true);
        })
        .catch((err) => {
          console.error("Microphone access error:", err);
        });
    }
  }, [initMediaRecorder]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  return { recording, startRecording, stopRecording, text };
};
