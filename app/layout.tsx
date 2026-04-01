import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Provider } from "./context/ChainContext";
import Navbar from "./components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "InterviewAI — Ace Your Next Interview",
  description: "AI-powered mock interview platform with Gemini + LangGraph agentic intelligence. Get real-time feedback, voice input, and comprehensive analysis.",
  keywords: "AI interview, mock interview, interview practice, LangGraph, Gemini AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <Provider>
          <SessionProvider>
            <Navbar />
            <main>{children}</main>
          </SessionProvider>
        </Provider>
      </body>
    </html>
  );
}
