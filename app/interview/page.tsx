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
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AudioRecorder, useAudioRecorder } from "react-audio-voice-recorder";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import pdfToText from "react-pdftotext";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { MessagesPlaceholder } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Runnable } from "@langchain/core/runnables";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { loadImage } from "canvas";
import { AiOutlineClose } from "react-icons/ai";
import { streamingRequest } from "@huggingface/inference";

const InterviewPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  // if (status === "unauthenticated") {
  //   router.replace("/api/auth/signin");
  // }
  const {
    chainRef,
    messageHistories,
    sessionId,
    expressionsObject,
    setExpressionsObject,
  } = useContext(Context);
  const {transcript,listening,resetTranscript} = useSpeechRecognition();
  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const interviewerRef = useRef(null!)
  const userResponseRef = useRef(null!)
  const [res, setRes] = useState<string>("");
  const [hover, setHover] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [openintro, setOpenIntro] = useState(true);
  const [videostart, setVideostart] = useState(false);
  const [stream, setStream] = useState<MediaStream>(null!);
  const [code, setCode] = useState("");

  const dimensions = useMemo(
    () => ({
      width: 800,
      height: 600,
    }),
    []
  );
  const minConfidence = 0.7;

  const getVideo = useCallback(() => {
    navigator.mediaDevices
      .getUserMedia({ video: dimensions })
      .then((stream) => {
        setStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("error:", err);
      });
    setVideostart(true);
  }, [dimensions]); 

  useEffect(() => {
    loadModels();
    getVideo();
    startAudio()
  }, [getVideo])
  

  const loadModels = async () => {
    const url = "./models";
    const models = [
      faceapi.nets.ssdMobilenetv1,
      faceapi.nets.tinyYolov2,
      faceapi.nets.tinyFaceDetector,
      faceapi.nets.faceExpressionNet,
      faceapi.nets.faceLandmark68TinyNet,
      faceapi.nets.faceLandmark68Net,
      faceapi.nets.faceRecognitionNet,
    ];
    await Promise.all(models.map((model) => model.loadFromUri(url)));
    console.log("Models loaded");
  };

  let detectionInterval: string | number | NodeJS.Timeout | undefined;
  const detect = async () => {
    try {
      detectionInterval = setInterval(async () => {
        
        const detection =
          videostart &&
          (await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks(true)
            .withFaceExpressions()
            .withFaceDescriptor());
        if (detection) {
          const resizedDetections = faceapi.resizeResults(
            detection,
            dimensions
          );
          const { expressions } = resizedDetections;
          const result = {
            angry: (expressionsObject["angry"] + expressions["angry"]) / 2,
            disgusted: (expressionsObject["disgusted"] + expressions["disgusted"]) / 2,
            fearful: (expressionsObject["fearful"] + expressions["fearful"]) / 2,
            happy: (expressionsObject["happy"] + expressions["happy"]) / 2,
            neutral: (expressionsObject["neutral"] + expressions["neutral"]) / 2,
            sad: (expressionsObject["sad"] + expressions["sad"]) / 2,
            surprised: (expressionsObject["surprised"] + expressions["surprised"]) / 2,
          }
          setExpressionsObject(result)
        }
      }, 5000);
    } catch (err) {
      console.log(err);
    }
  };

  const startinterview = useCallback(
    async (trans: string) => {
      console.log(trans);
      setRes("");
      setThinking(true);
      const resdata = await chainRef.current?.invoke(
        {
          input: trans + code,
        },
        { configurable: { sessionId } }
      );
      console.log({ resdata });
      const reply = resdata?.answer
        ?.split("(Note:")[0]
        ?.split("Human:")[0]
        ?.split("AI:")
        ?.slice(1)
        ?.join(" ");

      setRes(reply);
      setThinking(false);

      let utterance = new SpeechSynthesisUtterance(reply);
      console.log(utterance);
      utterance.onend = startAudio;
      utterance.rate = 1.0;
      speechSynthesis.speak(utterance);
      console.log(messageHistories);
      resetTranscript();
    },
    [chainRef, messageHistories, sessionId, resetTranscript,code]
  );

  const startAudio = () => {
    SpeechRecognition.startListening({ continuous: true });
  };

  const onStop = () => {
    SpeechRecognition.stopListening()
      .then(() => {
        startinterview(transcript);
      })
  };

  const stopVideo = () => {
    if (stream) {
      // Stop all tracks of the media stream
      stream.getTracks().forEach((track) => track.stop());
      // setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  const StopInterview = () => {
    setRes("")
    SpeechRecognition.stopListening();
    stopVideo()
    clearInterval(detectionInterval);
    router.replace("/interview/analysis");
  }

  

  const handleSubmit = () => {
    console.log("Submitted Code:", code);
    alert("Code submitted successfully!");
    // You can add further logic to process the code here.
  };

  return (
    <div className="flex flex-col p-2 sm:p-10 h-screen">
      <h1 className="text-3xl">
        Hello {status === "authenticated" && session.user?.name}
      </h1>
      <div className="w-full flex flex-col justify-between h-full">
        <div className="flex flex-col h-full sm:flex-row">
          <div className="sm:w-[30%] h-[90%] p-8 rounded-[24px] overflow-hidden">
            {videostart ? (
              <video
                className="w-full h-full rounded-[24px] object-cover"
                autoPlay
                muted
                ref={videoRef}
                onPlay={detect}
              />
            ) : (
              ""
            )}
          </div>
          <div className="sm:w-[30%] h-[90%] flex flex-col justify-between px-4">
            <div
              className="h-[200px] sm:h-[50%] overflow-y-auto scrollbar-hide  rounded-lg shadow-md"
              ref={interviewerRef}
            >
              <div className="text-center font-semibold text-lg">
                AI Interviewer
              </div>
              {thinking ? (
                <div className="text-center bg-gray-900 min-h-full italic rounded-[12px] p-4">
                  Thinking...
                </div>
              ) : (
                <div className="bg-gray-900 min-h-full rounded-[12px] p-4">
                  {res}
                </div>
              )}
            </div>

            <div
              className="h-[200px] sm:h-[50%] overflow-y-auto scrollbar-hide  rounded-lg shadow-md mt-4"
              ref={userResponseRef}
            >
              <div className="text-center font-semibold text-lg">
                {status === "authenticated" && session.user?.name}
              </div>
              {listening ? (
                <div className="bg-gray-900 min-h-full rounded-[12px] p-4">
                  {transcript.length == 0
                    ? "Start speaking to see your response here..."
                    : transcript}
                </div>
              ) : (
                <div className="text-center bg-gray-900 italic min-h-full rounded-[12px] p-4">
                  Wait for the AI...
                </div>
              )}
            </div>
          </div>
          <div className="sm:w-[40%]">
            <div className="flex flex-col items-center justify-center ">
              <div className="w-full max-w-4xl shadow-lg rounded-2xl">
                <h1 className="text-xl font-semibold">Code Editor</h1>
                <textarea
                  className="w-full h-[450px] p-4 text-sm font-mono  bg-gray-900 rounded-lg border border-gray-300 focus:outline-none resize-none"
                  placeholder="Write your code here..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                ></textarea>
                <div className="flex justify-end mt-4">
                  <button
                    className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 transition-all"
                    onClick={onStop}
                  >
                    Submit Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="fixed flex  bottom-0 left-0 w-full items-center justify-center gap-4 sm:gap-12  p-4 backdrop-blur-2xl">
          {listening && (
            <div className="">
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
          <div className="">
            <button
              onMouseOver={() => setHover(false)}
              onMouseLeave={() => setHover(true)}
              className="flex items-center p-4 text-3xl bg-purple-600 rounded-full"
              onClick={() => resetTranscript()}
            >
              <TiArrowRepeat />
            </button>
          </div>
          <div className="">
            <button
              className="flex items-center p-4 text-3xl bg-red-600 rounded-full gap-2"
              onClick={StopInterview}
            >
              <IoExit />
            </button>
          </div>
        </div>
      </div>
      {openintro && (
        <div className="absolute top-0 right-0 w-full h-screen flex flex-col items-center justify-center backdrop-blur-2xl">
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
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
                  <FaMicrophoneSlash className="text-red-500" /> Mute after
                  giving every answer.
                </li>
                <li className="flex items-center gap-2">
                  <TiArrowRepeat className="text-blue-500" /> Reset the answer
                  if needed.
                </li>
                <li className="flex items-center gap-2">
                  <IoExit className="text-gray-600" /> Exit the interview when
                  done.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewPage;
