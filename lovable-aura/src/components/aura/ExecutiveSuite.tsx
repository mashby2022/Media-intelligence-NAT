import { useEffect, useRef, useState } from "react";
import {
  Upload, FileText, RefreshCw, CircleCheck, Sparkles, Zap, ArrowUpRight,
  Bot, Inbox, Terminal, Play, Cpu,
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
  const [intake, setIntake] = useState(
    "A 60-second treatment for a Resort 2027 capsule - themes of dawn light, soft armour, and quiet rebellion."
  );
  const [briefIdx, setBriefIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<IntakeMode>("autonomous");
  const [headline, setHeadline] = useState(FALLBACK_HEADLINE);
  const [trace, setTrace] = useState<AgentTraceEvent[]>(INITIAL_TRACE);
  const [memoryMatches, setMemoryMatches] = useState<MemoryMatch[]>([]);
  const [autonomousItems, setAutonomousItems] = useState<AutonomousIntakeItem[]>([]);
  const traceTimers = useRef<number[]>([]);
  const { toast } = useToast();

  const summary = SUMMARIES[briefIdx];
  const activeIntake = autonomousItems[0]?.asset;

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

  const intakeCopy = mode === "autonomous"
    ? { eyebrow: "Autonomous Pipeline", title: "Miranda is already watching.", status: "Drive watcher" }
    : { eyebrow: "Creative Intake", title: "Bring the concept.", status: "Draft" };
  const buttonLabel = mode === "autonomous" ? "Synthesize Latest Detection" : "Run Agentic Trace";

  return (
    <section className="fade-up">
      <div className="px-10 pt-12 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-[10px] tracking-couture uppercase text-amethyst mb-3 flex items-center gap-2">
              Aura · Executive Agent
              <span className="px-2 py-0.5 rounded-full bg-amethyst/10 text-amethyst normal-case tracking-normal text-[10px]">
                online
              </span>
            </div>
            <h1 className="font-serif text-6xl md:text-7xl text-obsidian leading-[0.95]">
              Miranda<span className="italic text-amethyst">.</span>
            </h1>
            <p className="mt-5 max-w-xl text-muted-foreground leading-relaxed">
              Your in-box-ready executive agent. Miranda monitors intake, retrieves
              historical context, and returns a magazine-grade brief through NAT
              orchestration and Nemotron reasoning. Polars/RAPIDS power the evidence layer underneath.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] tracking-couture uppercase">
              <Link to="/communication" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 border-iridescent text-obsidian hover:bg-white transition-colors">
                Open Communication Lab <ArrowUpRight className="h-3 w-3" />
              </Link>
              <Link to="/operator" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 border-iridescent text-obsidian hover:bg-white transition-colors">
                Open Operator Studio <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl text-obsidian">{summary.index}<span className="text-amethyst">/100</span></div>
            <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Aura Alignment</div>
          </div>
        </div>
      </div>

      <div className="px-10 pb-10">
        <MirandaChat />
      </div>

      <div className="px-10 pb-12 grid lg:grid-cols-[1fr_1.1fr] gap-8">
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

        <article className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-px iridescent-shimmer" />

          <div className="px-8 pt-7 pb-5 border-b border-border/60 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] tracking-couture uppercase text-amethyst flex items-center gap-2">
                Strategic Synthesis
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amethyst/10 text-amethyst normal-case tracking-normal text-[10px]">
                  <CircleCheck className="h-3 w-3" />
                  {summary.verdict}
                </span>
              </div>
              <div className="font-serif italic text-muted-foreground text-sm mt-0.5">
                Synthesized by Nemotron via NAT · <span className="font-mono not-italic">live trace</span>
              </div>
            </div>
            <div className="text-right text-[10px] tracking-couture uppercase text-muted-foreground">
              Vol. 12 · Edition N°042
              <div className="font-serif italic normal-case tracking-normal text-amethyst mt-0.5">"Soft armour, dawn light."</div>
            </div>
          </div>

          <div className="px-8 py-8 grid sm:grid-cols-[auto_1fr] gap-8 items-start">
            <div className="mx-auto"><AuraGauge value={summary.index} /></div>

            <div>
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground mb-3">The Aura Brief</div>
              <h3 className="font-serif text-2xl text-obsidian leading-snug mb-5">
                Three things <span className="italic text-amethyst">your strategy must know.</span>
              </h3>
              <p className="mb-5 text-sm text-obsidian/85 leading-relaxed">{headline}</p>
              <ol className="space-y-4">
                {summary.bullets.map((b, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="font-serif italic text-3xl text-amethyst leading-none w-8 shrink-0">0{i + 1}</span>
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

              <Link
                to="/communication"
                className="mt-6 inline-flex items-center gap-2 text-[10px] tracking-couture uppercase text-amethyst hover:text-obsidian transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                Ready to dispatch - open the Communication Lab
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};

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
        className="resize-none bg-white/60 border-border/60 focus-visible:ring-amethyst/40 font-serif italic text-base text-obsidian leading-relaxed"
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
        <div className="px-4 py-8 text-center text-sm text-muted-foreground font-serif italic">
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
