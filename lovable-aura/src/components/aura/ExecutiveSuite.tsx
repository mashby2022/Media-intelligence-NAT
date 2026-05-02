import { useEffect, useRef, useState } from "react";
import {
  Upload, FileText, RefreshCw, CircleCheck, Sparkles, Cpu, Zap, ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { mieClient } from "@/lib/mieClient";
import { AuraGauge } from "./AuraGauge";
import { MirandaChat } from "./MirandaChat";

type Verdict = "Greenlight" | "Develop" | "Reconsider";

const SUMMARIES: { bullets: string[]; index: number; verdict: Verdict }[] = [
  {
    index: 87, verdict: "Greenlight",
    bullets: [
      "Concept resonates with The Etherealists — soft-focus femininity scoring +0.71 against your 2027 cohort baseline.",
      "Shift palette away from chrome toward dawn-lavender; current visuals risk parity with three competitor launches in Q1.",
      "Pair with podcast adjacencies (Slow Burn, Articles of Interest) — sentiment skew +0.62 within target audience.",
    ],
  },
  {
    index: 73, verdict: "Develop",
    bullets: [
      "Logline aligns with Grounded Visionaries — narrative atom 'kitchen-sink romance' is fusing into the mainstream.",
      "Ephemeral Pulse detects an emerging counter-trend ('soft armour') — consider weaving into the third act.",
      "Sonic palette: ambient-pop stems are out-rotating maximalist score by 2.1× in editorial mood reels.",
    ],
  },
];

const FALLBACK_HEADLINE =
  "Miranda is ready. Run a fresh deconstruction to synthesize your current executive brief.";

const PHASES = [
  "polars.scan_parquet('treatment.bin')",
  "tokenizer · narrative atomization",
  "NeMo-3-Nano · semantic resonance",
  "cuGraph · cluster projection",
  "synthesizer · greenlight distillation",
];

export const ExecutiveSuite = () => {
  const [intake, setIntake] = useState(
    "A 60-second treatment for a Resort 2027 capsule — themes of dawn light, soft armour, and quiet rebellion."
  );
  const [briefIdx, setBriefIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [headline, setHeadline] = useState(FALLBACK_HEADLINE);
  const tick = useRef<number | null>(null);
  const { toast } = useToast();

  const summary = SUMMARIES[briefIdx];

  useEffect(() => () => { if (tick.current) window.clearInterval(tick.current); }, []);

  const deconstruct = () => {
    if (running) return;
    setRunning(true);
    setProgress(0);
    setPhase(0);
    tick.current && window.clearInterval(tick.current);
    tick.current = window.setInterval(() => {
      setProgress((p) => {
        const next = p + 2 + Math.random() * 4;
        if (next >= 100) {
          tick.current && window.clearInterval(tick.current);
          setRunning(false);
          setPhase(PHASES.length - 1);
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
            } catch (error) {
              toast({
                title: "Backend brief unavailable",
                description: "Showing local fallback copy. Check backend URL and CORS.",
                variant: "destructive",
              });
              setBriefIdx((i) => (i + 1) % SUMMARIES.length);
              setHeadline(FALLBACK_HEADLINE);
            }
          })();
          return 100;
        }
        setPhase(Math.min(PHASES.length - 1, Math.floor((next / 100) * PHASES.length)));
        return next;
      });
    }, 80);
  };

  return (
    <section className="fade-up">
      {/* Masthead */}
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
              Your in-box-ready executive agent. Hand Miranda a treatment, a logline,
              a half-formed idea — she returns a magazine-grade brief, distilled by
              NeMo agents over the Polars engine.
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

      {/* Conversational Miranda */}
      <div className="px-10 pb-10">
        <MirandaChat />
      </div>

      {/* Two-column workspace */}
      <div className="px-10 pb-12 grid lg:grid-cols-[1fr_1.1fr] gap-8">
        {/* Creative Intake */}
        <article className="rounded-2xl border-iridescent bg-white/70 glass shadow-ethereal p-7">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] tracking-couture uppercase text-amethyst">Creative Intake</div>
              <h2 className="font-serif text-3xl text-obsidian mt-1">Bring the concept.</h2>
            </div>
            <div className="flex items-center gap-2 text-[10px] tracking-couture uppercase text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-periwinkle" /> Draft
            </div>
          </div>

          <div className="mt-6">
            <Textarea
              value={intake}
              onChange={(e) => setIntake(e.target.value)}
              rows={6}
              placeholder="Paste a treatment, logline, or campaign concept…"
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

          {/* Deconstruct Narrative */}
          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <FileText className="h-3.5 w-3.5" /> 1 concept · 312 tokens
            </div>
            <button
              onClick={deconstruct}
              disabled={running}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-amethyst text-white text-[10px] tracking-couture uppercase shadow-halo hover:scale-[1.02] active:scale-100 transition-transform disabled:opacity-80 disabled:cursor-progress"
            >
              {running ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {running ? "Deconstructing…" : "Deconstruct Narrative"}
            </button>
          </div>

          {/* Technical progress */}
          <div className="mt-5 rounded-xl border border-border/60 bg-white/50 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-amethyst" /> polars · stream
              </span>
              <span className="text-obsidian">{progress.toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-periwinkle to-amethyst transition-[width] duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-1 font-mono text-[10px]">
              {PHASES.map((p, i) => (
                <div
                  key={p}
                  className={`flex items-center gap-2 transition-colors ${
                    i < phase ? "text-amethyst" : i === phase && running ? "text-obsidian" : "text-muted-foreground/60"
                  }`}
                >
                  <span className={`h-1 w-1 rounded-full ${i <= phase ? "bg-amethyst" : "bg-border"}`} />
                  <span>{p}</span>
                  {i < phase && <span className="ml-auto text-[9px] text-amethyst/70">ok</span>}
                  {i === phase && running && <span className="ml-auto text-[9px] text-periwinkle animate-pulse">…</span>}
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Strategic Synthesis */}
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
                Synthesized by NeMo agents · <span className="font-mono not-italic">0.42s</span>
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
                    <span className="font-serif italic text-3xl text-amethyst leading-none w-8 shrink-0">0{i+1}</span>
                    <p className="text-obsidian/90 leading-relaxed text-sm pt-1">{b}</p>
                  </li>
                ))}
              </ol>

              <Link
                to="/communication"
                className="mt-6 inline-flex items-center gap-2 text-[10px] tracking-couture uppercase text-amethyst hover:text-obsidian transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                Ready to dispatch — open the Communication Lab
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};
