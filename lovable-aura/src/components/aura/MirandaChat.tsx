import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { mieClient } from "@/lib/mieClient";

type Msg = { role: "user" | "assistant"; content: string; ts: number };

const SUGGESTIONS = [
  "Read my Resort 2027 treatment.",
  "Which TasteCollective is rising fastest?",
  "Three counter-signals to watch this week.",
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "**Miranda here.**\n\nHand me a treatment, a logline, or a half-formed idea — I'll return an Aura Brief, distilled across eleven million signals. Or simply ask.",
  ts: Date.now(),
};

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const MirandaChat = () => {
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Msg = { role: "user", content: trimmed, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const history = next
        .filter((m) => m !== GREETING)
        .map((m) => ({ role: m.role, content: m.content }));
      const response = await mieClient.mirandaChat(history);
      const reply = response?.result?.reply?.trim();
      setMessages((prev) => [...prev, { role: "assistant", content: reply || "Miranda is ready.", ts: Date.now() }]);
    } catch (e) {
      console.error(e);
      toast({ title: "Miranda stumbled", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden flex flex-col h-[640px]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-gradient-iridescent/30">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-full bg-gradient-amethyst flex items-center justify-center shadow-halo">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={1.5} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amethyst halo-pulse ring-2 ring-white" />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-lg text-obsidian">
              Miranda<span className="italic text-amethyst">.</span>
            </div>
            <div className="text-[9px] tracking-couture uppercase text-muted-foreground">
              Executive agent · NeMo-3-Nano · online
            </div>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[9px] tracking-couture uppercase text-amethyst font-mono normal-case tracking-normal">
          ctx · {messages.length - 1} turns
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-lavender/20">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 fade-up ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-amethyst text-white flex items-center justify-center font-serif text-sm">
                M
              </div>
            )}
            <div className={`flex flex-col max-w-[78%] ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-soft
                  ${m.role === "user"
                    ? "bg-gradient-amethyst text-white rounded-tr-sm"
                    : "bg-white border-iridescent text-obsidian rounded-tl-sm"}`}
              >
                {m.role === "assistant" ? (
                  <div
                    className="prose prose-sm max-w-none
                      prose-p:my-2 prose-p:text-obsidian/90
                      prose-headings:font-serif prose-headings:text-obsidian
                      prose-strong:text-amethyst prose-strong:font-medium
                      prose-em:text-amethyst prose-em:italic
                      prose-ol:my-2 prose-ul:my-2 prose-li:my-1 prose-li:text-obsidian/90
                      prose-blockquote:font-serif prose-blockquote:italic prose-blockquote:text-amethyst prose-blockquote:border-l-amethyst
                      prose-code:text-amethyst prose-code:bg-lavender/60 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
                  >
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap font-serif italic">{m.content}</p>
                )}
              </div>
              <div className={`mt-1 px-1 flex items-center gap-1.5 text-[9px] tracking-couture uppercase text-muted-foreground/70 font-mono normal-case tracking-normal
                ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <span>{m.role === "user" ? "you" : "miranda"}</span>
                <span className="opacity-50">·</span>
                <span>{formatTime(m.ts)}</span>
              </div>
            </div>
            {m.role === "user" && (
              <div className="h-8 w-8 shrink-0 rounded-full bg-white border-iridescent text-amethyst flex items-center justify-center">
                <User className="h-3.5 w-3.5" strokeWidth={1.5} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 fade-up">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-amethyst text-white flex items-center justify-center font-serif text-sm">M</div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white border-iridescent shadow-soft inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-amethyst" />
              <span className="font-mono">miranda · synthesizing…</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && !loading && (
        <div className="px-6 pt-3 flex flex-wrap gap-2 border-t border-border/40 bg-white/40">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] font-serif italic px-3 py-1.5 rounded-full bg-lavender/70 border border-amethyst/20 text-amethyst hover:bg-white hover:border-amethyst transition-colors"
            >
              "{s}"
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="px-4 py-3 border-t border-border/60 bg-white/70 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Miranda — paste a treatment, a logline, a question…"
          disabled={loading}
          className="flex-1 bg-lavender/40 border border-border/60 rounded-full px-5 py-3 text-sm text-obsidian font-serif italic placeholder:text-muted-foreground/70 focus:outline-none focus:border-amethyst focus:bg-white transition-colors disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-11 w-11 rounded-full bg-gradient-amethyst text-white flex items-center justify-center shadow-halo hover:scale-[1.05] active:scale-100 transition-transform disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Send to Miranda"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </article>
  );
};
