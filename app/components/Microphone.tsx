"use client";

import { useRecordVoice } from "../hooks/useRecordVoice";

const Microphone = () => {
  const { startRecording, stopRecording ,text} = useRecordVoice();

  return (
    // Button for starting and stopping voice recording
    <div>
      <button
        onClick={startRecording}
        // onMouseDown={startRecording} // Start recording when mouse is pressed
        // onMouseUp={stopRecording} // Stop recording when mouse is released
        // onTouchStart={startRecording} // Start recording when touch begins on a touch device
        // onTouchEnd={stopRecording} // Stop recording when touch ends on a touch device
        className="border-none bg-transparent w-10"
      >
        {/* Microphone icon component */}
        Mirophone
      </button>
      <p>{text}</p>
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <button
        onClick={stopRecording}
        // onMouseDown={startRecording} // Start recording when mouse is pressed
        // onMouseUp={stopRecording} // Stop recording when mouse is released
        // onTouchStart={startRecording} // Start recording when touch begins on a touch device
        // onTouchEnd={stopRecording} // Stop recording when touch ends on a touch device
        className="border-none bg-transparent w-10"
      >
        {/* Microphone icon component */}
        Mirophonestop
      </button>
    </div>
  );
};

export { Microphone };