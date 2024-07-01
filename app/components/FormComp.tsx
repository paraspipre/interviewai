"use client"
import { useState } from "react";

import pdfToText from "react-pdftotext";
import useAI from "../hooks/useAI";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
const FormComp = () => {
  const [resume, setResume] = useState<string>("resume");
  const router = useRouter();
  const { data: session, status } = useSession();
  const [role, setRole] = useState<string>("Software Engineer");
  const { initializeAI ,startinterview} = useAI();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file: any = e?.target?.files?.[0];
    pdfToText(file)
      .then((text) => setResume(text))
      .catch((error) => console.error("Failed to extract text from pdf"));
  };


  const handlesubmit = () => {
    const person = session?.user?.name;
    const systemp = `You are a very polite interviewer for ${role} job role, take interview of ${person} ask question related to job role and resume provided in context, also give response according to the answer giver by ${person}, take name of person to comfort and make environment friendly. ask one question at a time. resume ${resume}`;
    initializeAI(systemp)
  }

  return (
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
        onClick={()=>handlesubmit()}
      >
        Start Interview
      </button>
    </div>
  );
};

export default FormComp;
