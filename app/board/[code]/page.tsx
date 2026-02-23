"use client";
import { useEffect, useState } from "react";
// This points to your lib folder
import { createClient } from "@/lib/supabase"; 

export default function Board({ params }: { params: { code: string } }) {
  const [confessions, setConfessions] = useState<any[]>([]);
  const [text, setText] = useState("");
  const supabase = createClient();

  // Load confessions and listen for new ones
  useEffect(() => {
    const fetchConfessions = async () => {
      const { data } = await supabase
        .from("confessions")
        .select("*")
        .eq("board_code", params.code)
        .order("created_at", { ascending: false });
      if (data) setConfessions(data);
    };

    fetchConfessions();

    const channel = supabase
      .channel("realtime-confessions")
      .on("postgres_changes", { 
        event: "INSERT", 
        schema: "public", 
        table: "confessions",
        filter: `board_code=eq.${params.code}` 
      }, 
      (payload) => {
        setConfessions((prev) => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.code, supabase]);

  const sendWhisper = async () => {
    if (!text.trim()) return;
    
    const { error } = await supabase.from("confessions").insert([
      { content: text, board_code: params.code }
    ]);
    
    if (error) {
        alert("Check your database connection!");
    } else {
        setText(""); 
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 px-4">
      {/* Header */}
      <div className="pt-10 text-center sm:text-left">
        <p className="text-purple-500 font-mono text-[10px] uppercase tracking-[0.4em] mb-2">Secure Whisper Board</p>
        <h1 className="text-4xl font-bold text-white tracking-tighter uppercase italic">
          {params.code}
        </h1>
      </div>

      {/* Input Box */}
      <div className="bg-[#111111] border border-white/10 p-3 rounded-[32px] shadow-2xl">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Whisper your secret..."
          className="w-full h-32 p-5 rounded-[24px] bg-transparent outline-none resize-none text-lg text-white placeholder:text-zinc-700 italic"
        />
        <div className="flex justify-end p-2">
            <button 
              onClick={sendWhisper}
              className="bg-white text-black hover:bg-purple-200 px-10 py-3 rounded-full font-bold transition-all active:scale-95 shadow-lg"
            >
              Whisper
            </button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex flex-col gap-6 pb-20">
        {confessions.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-[32px]">
            <p className="text-zinc-600 italic font-mono text-sm">The board is empty. Start the conversation.</p>
          </div>
        ) : (
          confessions.map((c) => (
            <div 
              key={c.id} 
              className="p-8 rounded-[32px] bg-[#111111] border border-white/5 hover:border-purple-500/30 transition-all group"
            >
              <p className="text-xl text-zinc-200 leading-relaxed font-light italic transition-colors group-hover:text-white">
                "{c.content}"
              </p>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                  <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                    {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-800 uppercase">Anon</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}