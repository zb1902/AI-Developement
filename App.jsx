import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are a helpful, adaptive AI assistant. You learn from user feedback.
When a user rates your response poorly or corrects you, acknowledge it and adjust.
Keep responses concise and conversational.
If the conversation history includes feedback/corrections, use them to improve.`;

const TypingDots = () => (
  <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "10px 0" }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 8, height: 8, borderRadius: "50%", background: "#7ee8a2",
        animation: "bounce 1.2s infinite",
        animationDelay: `${i * 0.2}s`
      }} />
    ))}
  </div>
);

const FeedbackBar = ({ onRate, onCorrect, messageId, ratings }) => {
  const rated = ratings[messageId];
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#556", fontFamily: "monospace" }}>Was this helpful?</span>
      {["👍", "👎"].map((emoji, i) => (
        <button key={emoji} onClick={() => onRate(messageId, i === 0 ? "good" : "bad")}
          style={{
            background: rated === (i === 0 ? "good" : "bad") ? (i === 0 ? "#1a3a2a" : "#3a1a1a") : "transparent",
            border: `1px solid ${i === 0 ? "#2a5a3a" : "#5a2a2a"}`,
            borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 14,
            opacity: rated && rated !== (i === 0 ? "good" : "bad") ? 0.3 : 1,
            transition: "all 0.2s"
          }}>
          {emoji}
        </button>
      ))}
      <button onClick={() => onCorrect(messageId)}
        style={{
          background: "transparent", border: "1px solid #334", borderRadius: 6,
          padding: "2px 10px", cursor: "pointer", fontSize: 11,
          color: "#7a9", fontFamily: "monospace", transition: "all 0.2s"
        }}>
        ✏️ Correct
      </button>
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState([
    { id: "init", role: "assistant", content: "Hey! I'm your adaptive AI. Ask me anything — and if I get something wrong, just correct me and I'll learn from it." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ratings, setRatings] = useState({});
  const [corrections, setCorrections] = useState({});
  const [correctingId, setCorrectingId] = useState(null);
  const [correctionText, setCorrectionText] = useState("");
  const [memory, setMemory] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const buildApiMessages = (msgs, mem) => {
    const history = [];
    if (mem.length > 0) {
      history.push({
        role: "user",
        content: `[LEARNING LOG — apply these lessons to all future responses]\n${mem.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
      });
      history.push({ role: "assistant", content: "Understood. I've noted these corrections and will apply them going forward." });
    }
    msgs.forEach(m => {
      if (m.role !== "assistant" || m.id !== "init") {
        history.push({ role: m.role, content: m.content });
      }
    });
    return history;
  };

  const sendMessage = async (text, extraMemory = memory) => {
    if (!text.trim()) return;
    const userMsg = { id: Date.now().toString(), role: "user", content: text };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: buildApiMessages(updatedMsgs, extraMemory)
        })
      });
      const data = await res.json();
      const reply = data.content?.map(b => b.text || "").join("") || "Sorry, I couldn't respond.";
      const asstMsg = { id: (Date.now() + 1).toString(), role: "assistant", content: reply };
      setMessages(prev => [...prev, asstMsg]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "⚠️ Connection error. Please try again." }]);
    }
    setLoading(false);
  };

  const handleRate = (msgId, rating) => {
    setRatings(prev => ({ ...prev, [msgId]: rating }));
    if (rating === "bad") {
      const newLesson = `User marked a response as unhelpful (message ID: ${msgId}). Try to be clearer and more accurate.`;
      setMemory(prev => [...prev, newLesson]);
    }
  };

  const handleCorrect = (msgId) => {
    setCorrectingId(msgId);
    setCorrectionText("");
  };

  const submitCorrection = async () => {
    if (!correctionText.trim()) return;
    const idx = messages.findIndex(m => m.id === correctingId);
    const lesson = `Correction: When asked "${messages[idx - 1]?.content}", the previous answer was wrong. The correct answer is: "${correctionText}"`;
    const newMemory = [...memory, lesson];
    setMemory(newMemory);
    setCorrections(prev => ({ ...prev, [correctingId]: correctionText }));
    setCorrectingId(null);
    const ackMsg = { id: Date.now().toString(), role: "assistant", content: `Thanks for the correction! I've learned: "${correctionText}". I'll keep that in mind going forward. 🧠` };
    setMessages(prev => [...prev, ackMsg]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#080d10",
      fontFamily: "'Courier New', monospace",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "24px 16px"
    }}>
      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-8px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d1418; }
        ::-webkit-scrollbar-thumb { background: #2a4a3a; border-radius: 2px; }
        textarea:focus { outline: none; }
        textarea { resize: none; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 720, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#7ee8a2", animation: "pulse 2s infinite" }} />
          <h1 style={{ margin: 0, fontSize: 20, color: "#c8f0d8", letterSpacing: 4, fontWeight: 400 }}>ADAPTIVE.AI</h1>
        </div>
        <div style={{ fontSize: 11, color: "#3a6a4a", letterSpacing: 2, paddingLeft: 22 }}>
          LEARNING FROM FEEDBACK · {memory.length} LESSON{memory.length !== 1 ? "S" : ""} STORED
        </div>
      </div>

      {memory.length > 0 && (
        <div style={{ width: "100%", maxWidth: 720, marginBottom: 16, background: "#0a1a10", border: "1px solid #1a3a20", borderRadius: 10, padding: "10px 16px" }}>
          <div style={{ fontSize: 10, color: "#3a7a4a", letterSpacing: 2, marginBottom: 6 }}>🧠 LEARNED CORRECTIONS</div>
          {memory.map((m, i) => (
            <div key={i} style={{ fontSize: 11, color: "#5a9a6a", borderLeft: "2px solid #1a4a2a", paddingLeft: 8, marginBottom: 4 }}>
              {m.length > 100 ? m.slice(0, 100) + "…" : m}
            </div>
          ))}
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 720, flex: 1, background: "#0b1318", border: "1px solid #1a2a20", borderRadius: 14, padding: 20, minHeight: 400, maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: msg.role === "user" ? "#1a3a5a" : "#1a3a2a", border: `1px solid ${msg.role === "user" ? "#2a5a8a" : "#2a6a4a"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                {msg.role === "user" ? "👤" : "🤖"}
              </div>
              <div style={{ maxWidth: "80%" }}>
                <div style={{ background: msg.role === "user" ? "#0e1f30" : "#0e1f18", border: `1px solid ${msg.role === "user" ? "#1a3a5a" : "#1a3a2a"}`, borderRadius: msg.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px", padding: "10px 14px", fontSize: 14, color: "#c8e8d8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {corrections[msg.id] && (<div style={{ fontSize: 10, color: "#5a8a6a", marginBottom: 6, letterSpacing: 1 }}>✅ CORRECTED</div>)}
                  {msg.content}
                </div>
                {msg.role === "assistant" && msg.id !== "init" && (
                  <>
                    <FeedbackBar onRate={handleRate} onCorrect={handleCorrect} messageId={msg.id} ratings={ratings} />
                    {correctingId === msg.id && (
                      <div style={{ marginTop: 8, animation: "fadeUp 0.2s ease" }}>
                        <textarea value={correctionText} onChange={e => setCorrectionText(e.target.value)} placeholder="What should the correct answer be?" rows={2}
                          style={{ width: "100%", background: "#0a1a14", border: "1px solid #2a5a3a", borderRadius: 8, color: "#a8d8b8", fontSize: 13, padding: "8px 12px", fontFamily: "monospace", boxSizing: "border-box" }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          <button onClick={submitCorrection} style={{ background: "#1a4a2a", border: "1px solid #2a6a3a", borderRadius: 6, padding: "4px 14px", color: "#7ee8a2", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>Submit</button>
                          <button onClick={() => setCorrectingId(null)} style={{ background: "transparent", border: "1px solid #334", borderRadius: 6, padding: "4px 14px", color: "#567", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "fadeUp 0.3s ease" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a3a2a", border: "1px solid #2a6a4a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🤖</div>
            <div style={{ background: "#0e1f18", border: "1px solid #1a3a2a", borderRadius: "4px 14px 14px 14px", padding: "2px 14px" }}>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ width: "100%", maxWidth: 720, marginTop: 12, background: "#0b1318", border: "1px solid #1a2a20", borderRadius: 12, display: "flex", alignItems: "flex-end", gap: 10, padding: "10px 14px" }}>
        <textarea ref={undefined} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything… (Enter to send)" rows={1} disabled={loading}
          style={{ flex: 1, background: "transparent", border: "none", color: "#c8e8d8", fontSize: 14, fontFamily: "monospace", lineHeight: 1.5, maxHeight: 120, overflowY: "auto", opacity: loading ? 0.5 : 1 }} />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          style={{ background: input.trim() && !loading ? "#1a4a2a" : "#0e1e18", border: `1px solid ${input.trim() && !loading ? "#2a6a3a" : "#1a2a1a"}`, borderRadius: 8, width: 36, height: 36, cursor: input.trim() && !loading ? "pointer" : "default", fontSize: 16, transition: "all 0.2s", flexShrink: 0, color: input.trim() && !loading ? "#7ee8a2" : "#2a4a3a" }}>
          ➤
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: "#2a4a3a", letterSpacing: 2 }}>
        👍 RATE · ✏️ CORRECT · 🧠 ADAPTIVE LEARNING
      </div>
    </div>
  );
}
