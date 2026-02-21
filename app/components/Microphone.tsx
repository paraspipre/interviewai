"use client";

import { useRecordVoice } from "../hooks/useRecordVoice";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

// FIX: Fixed typos "Mirophone" -> "Microphone", "Mirophonestop" -> removed
// FIX: Removed excessive <br /> tags and improved layout
const Microphone = () => {
  const { startRecording, stopRecording, recording, text } = useRecordVoice();

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex gap-4">
        <button
          onClick={startRecording}
          disabled={recording}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-full transition-colors text-white"
        >
          <FaMicrophone />
          Start
        </button>
        <button
          onClick={stopRecording}
          disabled={!recording}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-full transition-colors text-white"
        >
          <FaMicrophoneSlash />
          Stop
        </button>
      </div>
      {recording && (
        <p className="text-sm text-red-400 animate-pulse">Recording...</p>
      )}
      {text && (
        <div className="mt-2 p-3 bg-gray-800 rounded-lg max-w-md">
          <p className="text-sm text-gray-300">{text}</p>
        </div>
      )}
    </div>
  );
};

export { Microphone };
