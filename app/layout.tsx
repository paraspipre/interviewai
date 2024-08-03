import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";


import { SessionProvider } from 'next-auth/react';
import { Provider } from "./context/ChainContext";

const inter = Inter({ subsets: ["latin"] });


export const metadata: Metadata = {
  title: "Interview AI",
  description: "Interview AI by Paras",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}><Provider><SessionProvider>{children}</SessionProvider></Provider></body>
    </html>
  );
}
