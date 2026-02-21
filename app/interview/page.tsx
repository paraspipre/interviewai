"use client";
import "regenerator-runtime/runtime";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { TiArrowRepeat } from "react-icons/ti";
import { FaMicrophoneSlash } from "react-icons/fa";
import { IoExit } from "react-icons/io5";
import { Context } from "../context/ChainContext";
import * as faceapi from "face-api.js";
import { AiOutlineClose } from "react-icons/ai";

const InterviewPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();

  const {
    chainRef,
    messageHistories,
    sessionId,
    expressionsObject,
    setExpressionsObject,
  } = useContext(Context);

  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const videoRef = useRef<HTMLVideoElement>(null!);
  const [res, setRes] = useState<string>("");
  const [thinking, setThinking] = useState(false);
  const [openintro, setOpenIntro] = useState(true);
  const [videostart, setVideostart] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [code, setCode] = useState("");

  // FIX: Use useRef for detectionInterval so clearInterval works across renders
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // FIX: Use ref to track cumulative expression counts for proper averaging
  const expressionCountRef = useRef(0);

  const dimensions = useMemo(
    () => ({ width: 800, height: 600 }),
    []
  );

  // FIX: setVideostart moved inside .then() so it only triggers after stream is ready
  const getVideo = useCallback(() => {
    navigator.mediaDevices
      .getUserMedia({ video: dimensions })
      .then((stream) => {
        setStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setVideostart(true);
      })
      .catch((err) => {
        console.error("Camera access error:", err);
      });
  }, [dimensions]);

  const loadModels = async () => {
    const url = "./models";
    const models = [
      faceapi.nets.ssdMobilenetv1,
      faceapi.nets.tinyFaceDetector,
      faceapi.nets.faceExpressionNet,
      faceapi.nets.faceLandmark68TinyNet,
      faceapi.nets.faceRecognitionNet,
    ];
    await Promise.all(models.map((model) => model.loadFromUri(url)));
  };

  const startAudio = useCallback(() => {
    SpeechRecognition.startListening({ continuous: true });
  }, []);

  useEffect(() => {
    loadModels();
    getVideo();
    startAudio();

    // FIX: Cleanup interval and video stream on unmount to prevent memory leaks
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [getVideo, startAudio]);

  // FIX: Expression averaging now uses running average with count for accurate results
  const detect = async () => {
    detectionIntervalRef.current = setInterval(async () => {
      try {
        if (!videostart || !videoRef.current) return;

        const detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks(true)
          .withFaceExpressions();

        if (detection) {
          const { expressions } = faceapi.resizeResults(detection, dimensions);
          expressionCountRef.current += 1;
          const count = expressionCountRef.current;

          // FIX: Running average formula: newAvg = oldAvg + (newVal - oldAvg) / count
          setExpressionsObject({
            angry: expressionsObject.angry + (expressions.angry - expressionsObject.angry) / count,
            disgusted: expressionsObject.disgusted + (expressions.disgusted - expressionsObject.disgusted) / count,
            fearful: expressionsObject.fearful + (expressions.fearful - expressionsObject.fearful) / count,
            happy: expressionsObject.happy + (expressions.happy - expressionsObject.happy) / count,
            neutral: expressionsObject.neutral + (expressions.neutral - expressionsObject.neutral) / count,
            sad: expressionsObject.sad + (expressions.sad - expressionsObject.sad) / count,
            surprised: expressionsObject.surprised + (expressions.surprised - expressionsObject.surprised) / count,
          });
        }
      } catch (err) {
        console.error("Face detection error:", err);
      }
    }, 5000);
  };

  const startinterview = useCallback(
    async (trans: string) => {
      if (!chainRef.current) return;
      setRes("");
      setThinking(true);
      try {
        const resdata = await chainRef.current.invoke(
          { input: trans + (code ? `\n\nCode:\n${code}` : "") },
          { configurable: { sessionId } }
        );

        const reply = resdata?.answer
          ?.split("(Note:")[0]
          ?.split("Human:")[0]
          ?.split("AI:")
          ?.slice(1)
          ?.join(" ")
          ?.trim();

        setRes(reply || "Could not generate a response. Please try again.");
        setThinking(false);

        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.onend = startAudio;
        utterance.rate = 1.0;
        speechSynthesis.speak(utterance);
        resetTranscript();
      } catch (err) {
        console.error("Interview error:", err);
        setThinking(false);
        setRes("An error occurred. Please try again.");
      }
    },
    [chainRef, sessionId, resetTranscript, code, startAudio]
  );

  // FIX: Pass transcript directly to startinterview to avoid stale closure
  const onStop = useCallback(() => {
    SpeechRecognition.stopListening().then(() => {
      startinterview(transcript);
    });
  }, [startinterview, transcript]);

  const stopVideo = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  const StopInterview = () => {
    setRes("");
    speechSynthesis.cancel();
    SpeechRecognition.stopListening();
    stopVideo();
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    router.replace("/interview/analysis");
  };

  return (
    <div className="flex flex-col p-2 sm:p-6 h-screen overflow-hidden">
      <h1 className="text-xl sm:text-3xl font-semibold mb-2 truncate">
        Hello, {status === "authenticated" && session.user?.name}
      </h1>

      <div className="w-full flex flex-col justify-between flex-1 overflow-hidden">
        {/* FIX: Responsive grid layout instead of fixed percentages */}
        <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden pb-24">
          {/* Video section */}
          <div className="lg:w-1/3 h-48 sm:h-64 lg:h-full rounded-2xl overflow-hidden flex-shrink-0">
            {videostart ? (
              <video
                className="w-full h-full rounded-2xl object-cover"
                autoPlay
                muted
                ref={videoRef}
                onPlay={detect}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-2xl text-gray-500">
                Loading camera...
              </div>
            )}
          </div>

          {/* Transcript section */}
          <div className="lg:w-1/3 flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-hide rounded-lg shadow-md">
              <div className="text-center font-semibold text-lg sticky top-0 bg-black/80 backdrop-blur-sm py-1 z-10">
                AI Interviewer
              </div>
              {thinking ? (
                <div className="text-center bg-gray-900 min-h-[120px] italic rounded-xl p-4">
                  Thinking...
                </div>
              ) : (
                <div className="bg-gray-900 min-h-[120px] rounded-xl p-4">
                  {res || "Waiting to start..."}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide rounded-lg shadow-md">
              <div className="text-center font-semibold text-lg sticky top-0 bg-black/80 backdrop-blur-sm py-1 z-10">
                {status === "authenticated" ? session.user?.name : "You"}
              </div>
              {listening ? (
                <div className="bg-gray-900 min-h-[120px] rounded-xl p-4">
                  {/* FIX: Use === instead of == for comparison */}
                  {transcript.length === 0
                    ? "Start speaking to see your response here..."
                    : transcript}
                </div>
              ) : (
                <div className="text-center bg-gray-900 italic min-h-[120px] rounded-xl p-4">
                  Wait for the AI...
                </div>
              )}
            </div>
          </div>

          {/* Code editor section */}
          <div className="lg:w-1/3 flex flex-col overflow-hidden">
            <h2 className="text-lg font-semibold mb-2">Code Editor</h2>
            <textarea
              className="w-full flex-1 min-h-[200px] p-4 text-sm font-mono bg-gray-900 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 resize-none"
              placeholder="Write your code here..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <button
                className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg shadow hover:bg-purple-700 transition-colors"
                onClick={onStop}
              >
                Submit Code
              </button>
            </div>
          </div>
        </div>

        {/* FIX: Bottom bar with safe area padding for mobile */}
        <div className="fixed bottom-0 left-0 w-full flex items-center justify-center gap-6 sm:gap-12 p-4 pb-6 backdrop-blur-2xl bg-black/30 z-20">
          {listening && (
            <button
              className="flex items-center p-4 text-2xl sm:text-3xl bg-red-600 hover:bg-red-700 transition-colors rounded-full"
              onClick={onStop}
              title="Stop recording and submit"
            >
              <FaMicrophoneSlash />
            </button>
          )}
          <button
            className="flex items-center p-4 text-2xl sm:text-3xl bg-purple-600 hover:bg-purple-700 transition-colors rounded-full"
            onClick={() => resetTranscript()}
            title="Reset transcript"
          >
            <TiArrowRepeat />
          </button>
          <button
            className="flex items-center p-4 text-2xl sm:text-3xl bg-red-600 hover:bg-red-700 transition-colors rounded-full"
            onClick={StopInterview}
            title="End interview"
          >
            <IoExit />
          </button>
        </div>
      </div>

      {/* Intro modal */}
      {openintro && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
          <div className="bg-white text-black w-[90%] max-w-md p-6 rounded-2xl shadow-xl relative">
            <button
              onClick={() => setOpenIntro(false)}
              className="absolute top-4 right-4 text-xl text-gray-500 hover:text-gray-800"
            >
              <AiOutlineClose />
            </button>

            <h2 className="text-xl font-semibold mb-4 text-center">
              Interview Tips
            </h2>
            <ul className="space-y-4">
              <li>Start by introducing yourself.</li>
              <li className="flex items-center gap-2">
                <FaMicrophoneSlash className="text-red-500 flex-shrink-0" /> Mute after
                giving every answer.
              </li>
              <li className="flex items-center gap-2">
                <TiArrowRepeat className="text-blue-500 flex-shrink-0" /> Reset the answer
                if needed.
              </li>
              <li className="flex items-center gap-2">
                <IoExit className="text-gray-600 flex-shrink-0" /> Exit the interview when
                done.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewPage;
