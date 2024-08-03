"use client";
import React, { useContext } from "react";
import { Context } from "../../context/ChainContext";
import Link from "next/link";

const UserPage = () => {
  const {} = useContext(Context);
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-3">
      <div>Thanks for taking interview.</div>
      <Link
        href="/"
        className="my-3 mx-20 py-3 px-10 bg-purple-600 rounded-3xl"
      >
        Home Page
      </Link>
    </div>
  );
};

export default UserPage;
