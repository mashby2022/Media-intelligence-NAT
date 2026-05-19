import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Upload, FileText, RefreshCw, CircleCheck, Sparkles, Zap, ArrowUpRight,
  Bot, Inbox, Terminal, Play, Cpu, Target, ShieldCheck, Send,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { mieClient, type AgentTraceEvent, type AutonomousIntakeItem, type MemoryMatch } from "@/lib/mieClient";
import { AuraGauge } from "./AuraGauge";
import { MirandaChat } from "./MirandaChat";

type Verdict = "Greenlight" | "Develop" | "Reconsider";
type IntakeMode = "manual" | "autonomous";

const SUMMARIES: { bullets: string[]; index: number; verdict: Verdict }[] = [
  {
    index: 87, verdict: "Greenlight",
    bullets: [
      "Concept resonates with The Etherealists - soft-focus femininity scoring +0.71 against your 2027 cohort baseline.",
      "Shift palette away from chrome toward dawn-lavender; current visuals risk parity with three competitor launches in Q1.",
      "Pair with podcast adjacencies (Slow Burn, Articles of Interest) - sentiment skew +0.62 within target audience.",
    ],
  },
  {
    index: 73, verdict: "Develop",
    bullets: [
      "Logline aligns with Grounded Visionaries - narrative atom 'kitchen-sink romance' is fusing into the mainstream.",
      "Ephemeral Pulse detects an emerging counter-trend ('soft armour') - consider weaving into the third act.",
      "Sonic palette: ambient-pop stems are out-rotating maximalist score by 2.1x in editorial mood reels.",
    ],
  },
];

const FALLBACK_HEADLINE =
  "Miranda is ready. Run a fresh synthesis to generate the current executive brief.";

const MIRANDA_FALLBACK_REPLY =
  "**Recommendation:** Keep the demo on the prepared executive briefing path while the backend reconnects.\n\n"
  + "**Top 3 bets:**\n"
  + "1. **Grounded sci-fi with spiritual resilience** - keep as the lead greenlight example.\n"
  + "2. **Geo-language growth markets** - use the operator view to validate Nollywood, Korean-language, and Indian regional-language opportunities.\n"
  + "3. **Small-town romance with prestige stakes** - keep as the low-risk repeatable slate example.\n\n"
  + "**Evidence:** The local evidence layer is available through the operator workspace and readiness checks.\n\n"
  + "**Risk:** Miranda could not complete the live chat call, so treat this as a demo fallback.\n\n"
  + "**Next action:** Run the briefing again or move to the ranked bets and dispatch preview.";

const EXECUTIVE_QUESTION =
  "What genres and subcultures should we bet on in the next 6-12 months?";

const EXECUTIVE_QUESTIONS = [
  EXECUTIVE_QUESTION,
  "Which emerging audience markets are underserved?",
  "What should we avoid greenlighting right now?",
];

const HAPPY_PATH = [
  "Ask the greenlight question",
  "Miranda scans portfolio evidence",
  "Rank the next big bets",
  "Inspect one opportunity",
  "Dispatch the executive brief",
];

const NEXT_BETS = [
  {
    title: "Grounded sci-fi with spiritual resilience",
    subculture: "Stoic Resilience / Faith-forward futurists",
    confidence: 91,
    risk: "Medium",
    why: "High viability scripts are clustering around human-scale futurism, family duty, and non-dystopian technology.",
    action: "Greenlight one prestige limited series concept and test Heartland + faith-adjacent audience cuts.",
  },
  {
    title: "Small-town romance with prestige stakes",
    subculture: "Grounded Visionaries / comfort-drama loyalists",
    confidence: 87,
    risk: "Low",
    why: "Romance remains durable, but the strongest lift is coming from working-class settings and multi-generational ensemble arcs.",
    action: "Fast-track development on one script with a clear repeatable town, family, or workplace engine.",
  },
  {
    title: "Quiet rebellion coming-of-age",
    subculture: "Etherealists / soft-armour identity seekers",
    confidence: 82,
    risk: "Elevated",
    why: "Cultural signals are rising quickly, but the trend is vulnerable to visual sameness and over-stylized positioning.",
    action: "Develop selectively; require a distinctive world, sonic palette, and proof of audience specificity.",
  },
];

const INITIAL_TRACE: AgentTraceEvent[] = [
  {
    event_type: "thought",
    actor: "miranda",
    message: "Standing by with NAT orchestration, memory retrieval, and Nemotron synthesis tools loaded.",
    status: "ready",
    offset_ms: 0,
  },
];

export const ExecutiveSuite = () => {
  const customerName = mieClient.config.customerName;
  const [intake, setIntake] = useState(
    EXECUTIVE_QUESTION
  );
  const [briefIdx, setBriefIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<IntakeMode>("autonomous");
  const [activeBet, setActiveBet] = useState(0);
  const [executivePrompt, setExecutivePrompt] = useState("");
  const [executiveReply, setExecutiveReply] = useState("");
  const [askingExecutivePrompt, setAskingExecutivePrompt] = useState(false);
  const [showUnderHood, setShowUnderHood] = useState(false);
  const [showFullChat, setShowFullChat] = useState(false);
  const [headline, setHeadline] = useState(FALLBACK_HEADLINE);
  const [trace, setTrace] = useState<AgentTraceEvent[]>(INITIAL_TRACE);
  const [memoryMatches, setMemoryMatches] = useState<MemoryMatch[]>([]);
  const [autonomousItems, setAutonomousItems] = useState<AutonomousIntakeItem[]>([]);
  const traceTimers = useRef<number[]>([]);
  const { toast } = useToast();

  const summary = SUMMARIES[briefIdx];
  const activeIntake = autonomousItems[0]?.asset;
  const selectedBet = NEXT_BETS[activeBet];

  const clearTraceTimers = () => {
    traceTimers.current.forEach((timer) => window.clearTimeout(timer));
    traceTimers.current = [];
  };

  useEffect(() => {
    void (async () => {
      try {
        const feed = await mieClient.autonomousIntakeFeed(6);
        setAutonomousItems(feed.items || []);
        const first = feed.items?.[0]?.asset;
        if (first) {
          setTrace([
            {
              event_type: "tool",
              actor: "drive_watcher",
              message: `Auto-detected ${first.title} from Studio Drive and queued brief synthesis.`,
              status: "complete",
              offset_ms: 0,
            },
            ...INITIAL_TRACE,
          ]);
        }
      } catch {
        setTrace(INITIAL_TRACE);
      }
    })();
    return clearTraceTimers;
  }, []);

  const animateTrace = (events: AgentTraceEvent[]) => {
    clearTraceTimers();
    setTrace([]);
    events.forEach((event, idx) => {
      const timer = window.setTimeout(() => {
        setTrace((prev) => [...prev, event]);
      }, Math.min(event.offset_ms ?? idx * 220, 1600));
      traceTimers.current.push(timer);
    });
  };

  const runSynthesis = () => {
    if (running) return;
    setRunning(true);
    setTrace([
      {
        event_type: "thought",
        actor: "miranda",
        message: mode === "autonomous"
          ? "Picking up the latest autonomous intake item and preparing tool calls."
          : "Received manual concept and preparing tool calls.",
        status: "running",
        offset_ms: 0,
      },
      {
        event_type: "tool",
        actor: "polars",
        message: "Scheduling portfolio scan, memory retrieval, and synthesis pass.",
        status: "running",
        offset_ms: 120,
      },
    ]);

    void (async () => {
      try {
        const payload = await mieClient.generateBrief(5);
        const result = payload.result || {};
        const modelBullets = (result.brief_bullets || []).filter(Boolean).slice(0, 3);
        const fallback = SUMMARIES[(briefIdx + 1) % SUMMARIES.length].bullets;
        const nextBullets = modelBullets.length === 3 ? modelBullets : fallback;
        const avg = result.source_evidence?.summary?.avg_viability;
        const nextIndex =
          typeof avg === "number"
            ? Math.max(0, Math.min(100, Math.round(avg * 100)))
            : SUMMARIES[(briefIdx + 1) % SUMMARIES.length].index;

        setBriefIdx((i) => {
          const next = (i + 1) % SUMMARIES.length;
          SUMMARIES[next] = { ...SUMMARIES[next], bullets: nextBullets, index: nextIndex };
          return next;
        });
        setHeadline(result.headline || FALLBACK_HEADLINE);
        setMemoryMatches(result.memory_matches || []);
        animateTrace(result.reasoning_trace?.length ? result.reasoning_trace : INITIAL_TRACE);
      } catch (error) {
        toast({
          title: "Backend brief unavailable",
          description: "Showing local fallback copy. Check backend URL and CORS.",
          variant: "destructive",
        });
        setBriefIdx((i) => (i + 1) % SUMMARIES.length);
        setHeadline(FALLBACK_HEADLINE);
        setTrace([
          {
            event_type: "tool",
            actor: "backend",
            message: error instanceof Error ? error.message : "Backend request failed.",
            status: "error",
            offset_ms: 0,
          },
        ]);
      } finally {
        setRunning(false);
      }
    })();
  };

  const askExecutivePrompt = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || askingExecutivePrompt) return;
    setIntake(trimmed);
    setExecutivePrompt("");
    setAskingExecutivePrompt(true);
    setExecutiveReply("");

    try {
      const response = await mieClient.mirandaChat([{ role: "user", content: trimmed }]);
      const reply = response?.result?.reply?.trim();
      setExecutiveReply(reply && reply.length > 20 ? reply : MIRANDA_FALLBACK_REPLY);
    } catch (error) {
      setExecutiveReply(MIRANDA_FALLBACK_REPLY);
      toast({
        title: "Miranda prompt failed",
        description: error instanceof Error ? error.message : "Check the backend connection.",
        variant: "destructive",
      });
    } finally {
      setAskingExecutivePrompt(false);
    }
  };

  const intakeCopy = mode === "autonomous"
    ? { eyebrow: "Step 2 · Select Data", title: "Miranda is already watching Studio Drive.", status: "Drive watcher" }
    : { eyebrow: "Step 2 · Select Data", title: "Ask against a specific concept.", status: "Draft" };
  const buttonLabel = mode === "autonomous" ? "Generate Executive Brief" : "Run Miranda Brief";

  return (
    <section className="fade-up">
      <div className="px-10 pt-10 pb-8">
        <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-8 items-stretch">
          <article className="rounded-2xl border-iridescent bg-gradient-mint glass shadow-ethereal p-8 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px iridescent-shimmer" />
            <div className="text-[10px] tracking-couture uppercase text-amethyst mb-4 flex items-center gap-2">
              Executive Greenlight Briefing
              <span className="px-2 py-0.5 rounded-full bg-mint text-mint-deep normal-case tracking-normal text-[10px]">
                demo path ready
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/70 border border-border/60 text-muted-foreground normal-case tracking-normal text-[10px]">
                {customerName}
              </span>
            </div>
            <h1 className="font-serif text-6xl md:text-7xl text-obsidian leading-[0.95]">
              Miranda<span className="italic text-amethyst">.</span>
            </h1>
            <div className="mt-6 max-w-3xl rounded-2xl border-iridescent bg-lavender/30 p-4">
              <div className="flex gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-aura text-white flex items-center justify-center font-serif text-sm">
                  M
                </div>
                <div className="min-w-0 flex-1">
                  <div className="inline-block rounded-2xl rounded-tl-sm bg-white border-iridescent px-4 py-3 shadow-soft">
                    <div className="text-[10px] tracking-couture uppercase text-amethyst">Miranda prompt</div>
                    <p className="mt-1 text-sm leading-relaxed text-obsidian">
                      Choose an executive question or ask your own. I will answer in greenlight-brief format.
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {EXECUTIVE_QUESTIONS.map((question, idx) => (
                      <button
                        key={question}
                        onClick={() => {
                          void askExecutivePrompt(question);
                          if (idx === 0) runSynthesis();
                        }}
                        disabled={askingExecutivePrompt}
                        className={`text-left text-[11px] font-sans font-medium leading-snug px-3 py-2 rounded-full border transition-colors ${
                          idx === 0
                            ? "bg-gradient-aura text-white border-transparent shadow-soft"
                            : "bg-white/80 border-amethyst/20 text-amethyst hover:bg-mint hover:border-emerald-200"
                        }`}
                      >
                        "{question}"
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void askExecutivePrompt(executivePrompt);
                    }}
                    className="mt-3 flex items-center gap-2 rounded-full border border-border/60 bg-white/80 px-3 py-2"
                  >
                    <input
                      value={executivePrompt}
                      onChange={(event) => setExecutivePrompt(event.target.value)}
                      disabled={askingExecutivePrompt}
                      placeholder="Ask your own greenlight question..."
                      className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm font-sans text-obsidian placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={askingExecutivePrompt || !executivePrompt.trim()}
                      className="h-9 w-9 shrink-0 rounded-full bg-gradient-aura text-white flex items-center justify-center shadow-soft disabled:opacity-40"
                      aria-label="Ask Miranda"
                    >
                      {askingExecutivePrompt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </form>
                  {(executiveReply || askingExecutivePrompt) && (
                    <ExecutiveBriefCard
                      loading={askingExecutivePrompt}
                      reply={executiveReply}
                    />
                  )}
                </div>
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-muted-foreground leading-relaxed">
              Miranda turns {customerName}'s portfolio archive, market signals, and historical memory into
              a short greenlight answer. NAT orchestrates the work, Nemotron Nano reasons over
              the evidence, and Polars/RAPIDS stay in the evidence layer where they belong.
            </p>
            <div className="mt-7 grid sm:grid-cols-5 gap-2">
              {HAPPY_PATH.map((step, idx) => (
                <div key={step} className="rounded-xl border border-border/60 bg-white/70 px-3 py-3">
                  <div className="font-mono text-[10px] text-amethyst">0{idx + 1}</div>
                  <div className="mt-1 text-[11px] leading-snug text-obsidian">{step}</div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-2 text-[10px] tracking-couture uppercase">
              <button
                onClick={runSynthesis}
                disabled={running}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-aura text-white shadow-soft hover:opacity-95 transition-opacity disabled:opacity-80 disabled:cursor-progress"
              >
                {running ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {running ? "Miranda working..." : "Run the briefing"}
              </button>
              <Link to="/operator" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/70 border-iridescent text-obsidian hover:bg-white transition-colors">
                Inspect evidence <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] tracking-couture uppercase text-amethyst">Executive Answer</div>
                <h2 className="font-serif text-2xl text-obsidian mt-1">Three ranked bets.</h2>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl text-obsidian">{summary.index}<span className="text-amethyst">/100</span></div>
                <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Brief confidence</div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {NEXT_BETS.map((bet, idx) => (
                <button
                  key={bet.title}
                  onClick={() => setActiveBet(idx)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    activeBet === idx
                      ? "border-amethyst/50 bg-lavender/50"
                      : "border-border/60 bg-white/60 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Bet {idx + 1}</div>
                      <div className="mt-1 font-serif text-lg leading-tight text-obsidian">{bet.title}</div>
                    </div>
                    <span className="font-mono text-sm text-[#10B981]">{bet.confidence}%</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{bet.subculture}</div>
                </button>
              ))}
            </div>
          </article>
        </div>
      </div>

      <div className="px-10 pb-8">
        <article className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-px iridescent-shimmer" />

          <div className="px-8 pt-7 pb-5 border-b border-border/60 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] tracking-couture uppercase text-amethyst flex items-center gap-2">
                Step 4 · Inspect One Opportunity
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amethyst/10 text-amethyst normal-case tracking-normal text-[10px]">
                  <CircleCheck className="h-3 w-3" />
                  {summary.verdict}
                </span>
              </div>
              <div className="font-sans text-muted-foreground text-sm mt-0.5">
                Selected bet: {selectedBet.subculture}
              </div>
            </div>
            <div className="text-right text-[10px] tracking-couture uppercase text-muted-foreground">
              Risk · {selectedBet.risk}
              <div className="font-sans font-medium normal-case tracking-normal text-amethyst mt-0.5">{selectedBet.confidence}% confidence</div>
            </div>
          </div>

          <div className="px-8 py-8 grid sm:grid-cols-[auto_1fr] gap-8 items-start">
            <div className="mx-auto"><AuraGauge value={summary.index} /></div>

            <div>
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground mb-3">Miranda Recommendation</div>
              <h3 className="font-serif text-2xl text-obsidian leading-snug mb-5">
                {selectedBet.title}
              </h3>
              <p className="mb-5 text-sm text-obsidian/85 leading-relaxed">
                {headline === FALLBACK_HEADLINE ? selectedBet.why : headline}
              </p>
              <div className="mb-5 grid sm:grid-cols-3 gap-3">
                <MiniMetric icon={<Target className="h-3.5 w-3.5" />} label="Decision" value={summary.verdict} />
                <MiniMetric icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Risk" value={selectedBet.risk} />
                <MiniMetric icon={<Send className="h-3.5 w-3.5" />} label="Next action" value="Brief execs" />
              </div>
              <ol className="space-y-4">
                {[selectedBet.why, selectedBet.action, ...summary.bullets].slice(0, 3).map((b, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="font-mono text-2xl text-amethyst leading-none w-8 shrink-0">0{i + 1}</span>
                    <p className="text-obsidian/90 leading-relaxed text-sm pt-1">{b}</p>
                  </li>
                ))}
              </ol>

              {memoryMatches.length > 0 && (
                <div className="mt-6 rounded-xl border border-border/60 bg-lavender/40 p-4">
                  <div className="text-[10px] tracking-couture uppercase text-amethyst mb-3">Historical Memory</div>
                  <div className="space-y-2">
                    {memoryMatches.slice(0, 3).map((match) => (
                      <div key={match.memory_id || match.script_id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="truncate font-serif text-obsidian">{match.title}</div>
                          <div className="truncate text-muted-foreground">{match.memory_period} · {match.reason}</div>
                        </div>
                        <span className="font-mono text-amethyst">{formatPercent(match.memory_similarity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2 text-[10px] tracking-couture uppercase">
                <Link
                  to="/communication"
                  className="inline-flex items-center gap-2 rounded-full bg-obsidian px-5 py-2.5 text-white shadow-soft hover:bg-obsidian/90 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Dispatch executive brief
                </Link>
                <Link
                  to="/operator"
                  className="inline-flex items-center gap-2 rounded-full bg-white/70 border-iridescent px-4 py-2.5 text-obsidian hover:bg-white transition-colors"
                >
                  Validate evidence
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div className="px-10 pb-12 space-y-4">
        <div className="rounded-2xl border-iridescent bg-white/70 p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] tracking-couture uppercase text-amethyst">Optional demo depth</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep this collapsed for the executive story. Open it only when someone asks how the workflow runs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] tracking-couture uppercase">
              <button
                onClick={() => setShowUnderHood((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full bg-white/80 border-iridescent px-4 py-2.5 text-obsidian hover:bg-white transition-colors"
              >
                <Terminal className="h-3 w-3" />
                {showUnderHood ? "Hide under the hood" : "Show under the hood"}
              </button>
              <button
                onClick={() => setShowFullChat((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full bg-white/80 border-iridescent px-4 py-2.5 text-obsidian hover:bg-white transition-colors"
              >
                <Bot className="h-3 w-3" />
                {showFullChat ? "Hide full chat" : "Open full chat"}
              </button>
            </div>
          </div>
        </div>

        {showUnderHood && (
          <div className="grid lg:grid-cols-[1fr_0.8fr] gap-8">
            <article className="rounded-2xl border-iridescent bg-white/70 glass shadow-ethereal p-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] tracking-couture uppercase text-amethyst">{intakeCopy.eyebrow}</div>
                  <h2 className="font-serif text-3xl text-obsidian mt-1">{intakeCopy.title}</h2>
                </div>
                <div className="flex items-center gap-2 text-[10px] tracking-couture uppercase text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-periwinkle" /> {intakeCopy.status}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-1 p-1 rounded-full bg-white/60 border border-border/60">
                {([
                  { id: "autonomous", label: "Autonomous Pipeline", Icon: Inbox },
                  { id: "manual", label: "Manual Intake", Icon: FileText },
                ] as const).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setMode(id)}
                    className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full text-[10px] tracking-couture uppercase transition-colors ${
                      mode === id ? "bg-obsidian text-white" : "text-muted-foreground hover:text-obsidian"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {mode === "manual" ? (
                <ManualIntake intake={intake} onIntakeChange={setIntake} />
              ) : (
                <AutonomousPipeline activeScriptId={activeIntake?.script_id} items={autonomousItems} />
              )}

              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <FileText className="h-3.5 w-3.5" />
                  {mode === "autonomous" ? "auto queue · brief ready" : "1 concept · 312 tokens"}
                </div>
                <button
                  onClick={runSynthesis}
                  disabled={running}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-amethyst text-white text-[10px] tracking-couture uppercase shadow-halo hover:scale-[1.02] active:scale-100 transition-transform disabled:opacity-80 disabled:cursor-progress"
                >
                  {running ? <RefreshCw className="h-3 w-3 animate-spin" /> : mode === "autonomous" ? <Play className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                  {running ? "Miranda working..." : buttonLabel}
                </button>
              </div>

              <TraceTerminal events={trace} running={running} />
            </article>

            <article className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal p-7">
              <div className="text-[10px] tracking-couture uppercase text-amethyst">NVIDIA Value, Kept Simple</div>
              <h2 className="mt-2 font-serif text-3xl text-obsidian">The demo is the workflow.</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                This is not trying to recreate a customer's proprietary predictive models. It shows how
                the NAT-compatible workflow can run around their data and model boundary, while Nemotron
                Nano provides low-latency reasoning for persona-ready output.
              </p>
              <div className="mt-5 space-y-3">
                {[
                  ["NAT", "Coordinates intake, memory, evidence, reasoning trace, and dispatch."],
                  ["Nemotron Nano 9B v2", "Produces the executive answer in a repeatable brief format."],
                  ["Polars + optional RAPIDS", "Prepares and filters the evidence fast enough for operator trust."],
                ].map(([label, copy]) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-white/60 p-4">
                    <div className="font-mono text-[10px] uppercase tracking-couture text-amethyst">{label}</div>
                    <div className="mt-1 text-sm text-obsidian/85">{copy}</div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        )}

        {showFullChat && <MirandaChat />}
      </div>
    </section>
  );
};

const MiniMetric = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="rounded-xl border border-border/60 bg-white/60 px-3 py-3">
    <div className="flex items-center gap-1.5 text-[10px] tracking-couture uppercase text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className="mt-1 font-serif text-sm text-obsidian leading-tight">{value}</div>
  </div>
);

type BriefSection = {
  title: string;
  content: string[];
};

const ExecutiveBriefCard = ({ loading, reply }: { loading: boolean; reply: string }) => {
  const sections = parseBriefSections(reply);
  const recommendation = sections.find((section) => section.title === "Recommendation")?.content.join(" ");
  const topSection = sections.find((section) => /top|best|watch/i.test(section.title));
  const evidence = sections.find((section) => section.title === "Evidence")?.content.join(" ");
  const risk = sections.find((section) => section.title === "Risk")?.content.join(" ");
  const nextAction = sections.find((section) => section.title === "Next action")?.content.join(" ");

  if (loading) {
    return (
      <div className="mt-3 rounded-2xl rounded-tl-sm bg-white border-iridescent px-4 py-4 shadow-soft">
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amethyst" />
          Miranda is shaping the executive brief...
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl rounded-tl-sm bg-white border-iridescent shadow-soft overflow-hidden">
      <div className="border-b border-border/60 px-4 py-3 bg-gradient-iridescent/25">
        <div className="text-[10px] tracking-couture uppercase text-amethyst">Miranda executive brief</div>
        <p className="mt-1 text-sm leading-relaxed text-obsidian">
          {recommendation || "Miranda generated a brief for the executive decision path."}
        </p>
      </div>

      {topSection && (
        <div className="px-4 py-4">
          <div className="text-[10px] tracking-couture uppercase text-muted-foreground">{topSection.title}</div>
          <div className="mt-3 grid gap-2">
            {topSection.content.map((item, idx) => (
              <div key={`${topSection.title}-${idx}`} className="rounded-xl border border-border/60 bg-lavender/35 px-3 py-3">
                <div className="flex gap-3">
                  <span className="font-mono text-[11px] text-amethyst">{String(idx + 1).padStart(2, "0")}</span>
                  <p className="text-xs leading-relaxed text-obsidian/90">{stripMarkdown(item)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 border-t border-border/60">
        <BriefMiniSection title="Evidence" value={evidence} />
        <BriefMiniSection title="Risk" value={risk} />
        <BriefMiniSection title="Next action" value={nextAction} />
      </div>
    </div>
  );
};

const BriefMiniSection = ({ title, value }: { title: string; value?: string }) => (
  <div className="border-b border-border/60 px-4 py-3 md:border-b-0 md:border-r last:border-r-0">
    <div className="text-[10px] tracking-couture uppercase text-amethyst">{title}</div>
    <p className="mt-1 text-[11px] leading-relaxed text-obsidian/80">
      {value ? stripMarkdown(value) : "Available in the operator evidence view."}
    </p>
  </div>
);

const parseBriefSections = (reply: string): BriefSection[] => {
  const sections: BriefSection[] = [];
  let current: BriefSection | null = null;

  reply.split(/\n+/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const heading = line.match(/^\*\*([^:*]+):\*\*\s*(.*)$/);
    if (heading) {
      current = {
        title: heading[1].trim(),
        content: heading[2]?.trim() ? [heading[2].trim()] : [],
      };
      sections.push(current);
      return;
    }
    if (!current) {
      current = { title: "Brief", content: [] };
      sections.push(current);
    }
    current.content.push(line.replace(/^\d+\.\s*/, ""));
  });

  return sections;
};

const stripMarkdown = (value: string) =>
  value.replace(/\*\*/g, "").replace(/\s+-\s+/g, " - ").trim();

const ManualIntake = ({
  intake,
  onIntakeChange,
}: {
  intake: string;
  onIntakeChange: (value: string) => void;
}) => (
  <>
    <div className="mt-6">
      <Textarea
        value={intake}
        onChange={(e) => onIntakeChange(e.target.value)}
        rows={6}
        placeholder="Paste a treatment, logline, or campaign concept..."
        className="resize-none bg-white/60 border-border/60 focus-visible:ring-amethyst/40 font-sans text-base text-obsidian leading-relaxed"
      />
    </div>

    <label className="mt-4 flex items-center justify-between gap-3 px-4 py-5 rounded-xl border-2 border-dashed border-amethyst/40 bg-lavender/60 cursor-pointer hover:bg-white/70 hover:border-amethyst/70 transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-iridescent flex items-center justify-center">
          <Upload className="h-4 w-4 text-amethyst" strokeWidth={1.5} />
        </div>
        <div className="leading-tight">
          <div className="text-sm text-obsidian">Drop treatment or script</div>
          <div className="text-[10px] tracking-couture uppercase text-muted-foreground font-mono normal-case">PDF · DOCX · TXT · FDX</div>
        </div>
      </div>
      <span className="text-[10px] tracking-couture uppercase text-amethyst">Browse</span>
      <input type="file" className="hidden" />
    </label>
  </>
);

const AutonomousPipeline = ({
  activeScriptId,
  items,
}: {
  activeScriptId?: string;
  items: AutonomousIntakeItem[];
}) => (
  <div className="mt-6 rounded-xl border border-border/60 bg-white/60 overflow-hidden">
    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
      <div className="inline-flex items-center gap-2 text-[10px] tracking-couture uppercase text-amethyst">
        <Bot className="h-3.5 w-3.5" /> Live Feed
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">{activeScriptId || "syncing"}</span>
    </div>
    <div className="divide-y divide-border/60 max-h-64 overflow-auto">
      {items.map((item) => (
        <div key={item.event_id} className="px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-center">
          <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          <div className="min-w-0">
            <div className="truncate text-sm font-serif text-obsidian">{item.asset.title}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {item.source} · {item.asset.genre_primary} · {item.asset.platform_fit}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-obsidian">{item.detected_at}</div>
            <div className="text-[9px] tracking-couture uppercase text-[#10B981]">{item.status.replace(/_/g, " ")}</div>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground font-sans">
          Waiting for intake feed.
        </div>
      )}
    </div>
  </div>
);

const TraceTerminal = ({ events, running }: { events: AgentTraceEvent[]; running: boolean }) => (
  <div className="mt-5 rounded-xl border border-obsidian/10 bg-obsidian text-white overflow-hidden">
    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
      <div className="inline-flex items-center gap-2 text-[10px] tracking-couture uppercase text-white/60">
        <Terminal className="h-3.5 w-3.5 text-[#10B981]" /> Agentic Trace
      </div>
      <span className="inline-flex items-center gap-2 font-mono text-[10px] text-white/50">
        <Cpu className={`h-3 w-3 ${running ? "animate-pulse text-[#F59E0B]" : "text-[#10B981]"}`} />
        {running ? "running" : "ready"}
      </span>
    </div>
    <div className="max-h-60 overflow-auto p-4 space-y-2 font-mono text-[11px] leading-relaxed">
      {events.map((event, idx) => (
        <div key={`${event.actor}-${idx}`} className="grid grid-cols-[72px_1fr] gap-3">
          <span className={event.event_type === "tool" ? "text-[#F59E0B]" : event.event_type === "output" ? "text-[#10B981]" : "text-periwinkle"}>
            [{event.actor}]
          </span>
          <span className="text-white/78">{event.message}</span>
        </div>
      ))}
      {running && (
        <div className="grid grid-cols-[72px_1fr] gap-3">
          <span className="text-[#F59E0B]">[agent]</span>
          <span className="text-white/60 animate-pulse">waiting for backend trace...</span>
        </div>
      )}
    </div>
  </div>
);

const formatPercent = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
};
