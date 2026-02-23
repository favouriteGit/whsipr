"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [code, setCode] = useState("");
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <h1 className="text-6xl font-bold tracking-tighter mb-4 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent italic">
        whsipr
      </h1>
      <p className="text-zinc-400 mb-12 max-w-sm">
        A private space for anonymous secrets. No accounts, no tracking, just whispers.
      </p>

      <div className="grid gap-6 w-full max-w-sm">
        {/* Join Board Section */}
        <div className="p-6 rounded-2xl bg-surface border border-border transition-all hover:border-accent/50">
          <input
            type="text"
            placeholder="Enter Board Code"
            className="w-full p-3 rounded-xl mb-3 text-center font-mono uppercase tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button 
            onClick={() => code && router.push(`/board/${code}`)}
            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors"
          >
            Join Board
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"></span></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-zinc-500 font-mono">Or</span></div>
        </div>

        {/* Create Board Section */}
        <button 
          onClick={() => router.push('/board/' + Math.random().toString(36).substring(2, 8))}
          className="w-full border border-border py-4 rounded-2xl hover:bg-white/5 transition-all text-zinc-300 font-medium"
        >
          Create a New Board
        </button>
      </div>
    </div>
  );
}