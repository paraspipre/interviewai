"use client";
import React, { useContext } from "react";
import { Context } from "../../context/ChainContext";
import Link from "next/link";

// FIX: Map expression names to display colors for the visual bars
const expressionColors: Record<string, string> = {
  angry: "bg-red-500",
  disgusted: "bg-green-700",
  fearful: "bg-yellow-500",
  happy: "bg-green-500",
  neutral: "bg-blue-400",
  sad: "bg-indigo-500",
  surprised: "bg-orange-500",
};

const AnalysisPage = () => {
  const { expressionsObject } = useContext(Context);

  // FIX: Calculate dominant expression from collected data
  const entries = Object.entries(expressionsObject) as [string, number][];
  const maxExpression = entries.reduce(
    (max, curr) => (curr[1] > max[1] ? curr : max),
    entries[0]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6 sm:p-12">
      <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
        Interview Analysis
      </h1>
      <p className="text-gray-400">Thanks for completing the interview!</p>

      {/* FIX: Actually display expression analysis data instead of leaving blank */}
      <div className="w-full max-w-lg bg-gray-900 rounded-2xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-center">
          Facial Expression Summary
        </h2>

        {/* Dominant expression highlight */}
        {maxExpression && maxExpression[1] > 0 && (
          <div className="text-center mb-6 p-4 bg-gray-800 rounded-xl">
            <p className="text-gray-400 text-sm">Dominant Expression</p>
            <p className="text-2xl font-bold capitalize mt-1">
              {maxExpression[0]}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {(maxExpression[1] * 100).toFixed(1)}% average confidence
            </p>
          </div>
        )}

        {/* Expression bars */}
        <div className="space-y-3">
          {entries.map(([expression, value]) => (
            <div key={expression} className="flex items-center gap-3">
              <span className="w-24 text-sm capitalize text-gray-300">
                {expression}
              </span>
              <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    expressionColors[expression] || "bg-purple-500"
                  }`}
                  style={{ width: `${Math.min(value * 100, 100)}%` }}
                />
              </div>
              <span className="w-14 text-right text-sm text-gray-400">
                {(value * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        {/* No data message */}
        {entries.every(([, v]) => v === 0) && (
          <p className="text-center text-gray-500 mt-4 text-sm italic">
            No expression data was captured during this session.
          </p>
        )}
      </div>

      <Link
        href="/"
        className="mt-4 py-3 px-10 bg-purple-600 hover:bg-purple-700 transition-colors rounded-3xl font-medium"
      >
        Back to Home
      </Link>
    </div>
  );
};

export default AnalysisPage;
