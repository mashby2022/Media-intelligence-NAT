import { useEffect, useMemo, useState } from "react";
import {
  Filter, Search, Sparkles, Sliders, Mail, FileCode2, Eye,
  BookMarked, FolderOpen, Boxes, Music2, Headphones, Layers,
  RefreshCw,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { mieClient, type MarketSignal, type NetworkResult, type WorkspaceResult, type WorkspaceRow } from "@/lib/mieClient";

/* ============================================================
 * Operator Studio — high-density companion to the Forecast view
 * ==========================================================*/

type Atom = {
  id: string;
  atom: string;
  collective: string;
  velocity: number;
  resonance: number;
  reach: string;
  spotify: number[];
  podcast: number[];
  status: "rising" | "peaking" | "fading";
};

const ATOMS: Atom[] = [
  { id: "NA-0142", atom: "soft armour",          collective: "The Etherealists",     velocity: 4.21, resonance: 0.62, reach: "2.3M",
    spotify: [3,4,5,6,8,7,11,14,12,16,19,22], podcast: [4,5,5,7,8,9,10,12,11,13,15,17], status: "rising" },
  { id: "NA-0143", atom: "kitchen-sink romance", collective: "Grounded Visionaries", velocity: 3.84, resonance: 0.48, reach: "1.8M",
    spotify: [6,5,7,8,7,9,10,11,13,12,14,15], podcast: [5,6,6,7,8,8,9,10,11,12,12,13], status: "rising" },
  { id: "NA-0144", atom: "archive ferment",      collective: "Quiet Luminaries",     velocity: 3.12, resonance: 0.41, reach: "4.1M",
    spotify: [8,9,9,10,11,10,12,13,12,14,13,15], podcast: [6,7,7,8,9,8,10,11,10,12,11,13], status: "peaking" },
  { id: "NA-0145", atom: "lichen palette",       collective: "Studio Ceramicists",   velocity: 2.74, resonance: 0.55, reach: "920K",
    spotify: [2,3,3,4,5,5,6,7,8,9,10,11], podcast: [3,3,4,4,5,6,6,7,8,8,9,10], status: "rising" },
  { id: "NA-0146", atom: "performative wellness", collective: "Coastal Grandmothers", velocity: 1.21, resonance: -0.31, reach: "3.4M",
    spotify: [12,11,10,9,8,8,7,6,6,5,4,4], podcast: [10,10,9,8,8,7,7,6,5,5,4,3], status: "fading" },
  { id: "NA-0147", atom: "cinematic wardrobe",   collective: "The Etherealists",     velocity: 4.92, resonance: 0.71, reach: "5.6M",
    spotify: [4,6,7,9,11,13,14,15,17,18,20,22], podcast: [5,6,7,8,10,11,12,13,14,15,16,18], status: "rising" },
  { id: "NA-0148", atom: "slowcore revival",     collective: "Atlantic Brutalists",  velocity: 3.41, resonance: 0.52, reach: "1.1M",
    spotify: [5,5,6,7,8,9,9,10,12,12,13,14], podcast: [4,4,5,6,7,7,8,9,10,11,12,12], status: "peaking" },
];

const FILTERS = ["All Atoms", "Rising", "Peaking", "Fading"];
const TABS = [
  { id: "anatomy",      label: "Atomic Anatomy",         Icon: Layers },
  { id: "knowledge",    label: "Living Knowledge Base",  Icon: BookMarked },
  { id: "orchestration",label: "Orchestration Lab",      Icon: Sliders },
  { id: "template",     label: "Template Architect",     Icon: FileCode2 },
] as const;
type Tab = typeof TABS[number]["id"];

const formatCompact = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
};

const formatScore = (value: number | undefined, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";

const statusFromRow = (row: WorkspaceRow): Atom["status"] => {
  if (row.risk_category === "HIGH" || row.risk_category === "ELEVATED") return "fading";
  if (row.viability_score >= 0.85 || row.emergent_trend === "Momentum Breakout") return "rising";
  return "peaking";
};

const atomFromWorkspaceRow = (row: WorkspaceRow): Atom => ({
  id: row.script_id,
  atom: row.title,
  collective: `${row.genre_primary} · ${row.platform_fit}`,
  velocity: Math.max(0, row.viability_score * 5),
  resonance: row.completion_prediction - (row.cultural_risk_score ?? 0),
  reach: row.market || row.target_demo,
  spotify: Array.from({ length: 12 }, (_, i) => Math.max(1, Math.round((row.music_momentum_score ?? row.viability_score) * 18 + i / 2))),
  podcast: Array.from({ length: 12 }, (_, i) => Math.max(1, Math.round(row.completion_prediction * 16 + i / 3))),
  status: statusFromRow(row),
});

/* ====================== Main view ======================== */

export const MarketAnatomy = () => {
  const [tab, setTab] = useState<Tab>("anatomy");

  return (
    <section className="fade-up">
      {/* Masthead */}
      <div className="px-10 pt-12 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-[10px] tracking-couture uppercase text-amethyst mb-3">Suite 03 — Neural · Operator Studio</div>
            <h1 className="font-serif text-6xl md:text-7xl text-obsidian leading-[0.95]">
              Quant <span className="italic">Studio.</span>
            </h1>
            <p className="mt-5 max-w-xl text-muted-foreground leading-relaxed">
              The granular layer for the Orchestrator. Inspect Narrative Atoms,
              chart Signal Velocity, and tune the neural pipeline at the atomic level.
            </p>
          </div>
          <div className="text-right">
            <div className="font-serif text-3xl text-obsidian">11.2M<span className="text-amethyst">/d</span></div>
            <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Signals processed today</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap gap-1 p-1 rounded-full bg-white/60 border border-border/60 w-fit shadow-soft">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] tracking-couture uppercase transition-all
                  ${active ? "bg-gradient-amethyst text-white shadow-halo" : "text-foreground/60 hover:text-obsidian"}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-10 pb-16">
        {tab === "anatomy"       && <AtomicAnatomy />}
        {tab === "knowledge"     && <KnowledgeBase />}
        {tab === "orchestration" && <OrchestrationLab />}
        {tab === "template"      && <TemplateArchitect />}
      </div>
    </section>
  );
};

/* ====================== Atomic Anatomy ====================== */

const AtomicAnatomy = () => {
  const [filter, setFilter] = useState("All Atoms");
  const [query, setQuery] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceResult["result"] | null>(null);
  const [marketSignals, setMarketSignals] = useState<MarketSignal[]>([]);
  const [network, setNetwork] = useState<NetworkResult["result"] | null>(null);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const loadBackend = async () => {
    setLoadingBackend(true);
    setBackendError(null);
    try {
      const [workspacePayload, marketPayload, networkPayload] = await Promise.all([
        mieClient.workspace({}, 50),
        mieClient.marketSignals(6),
        mieClient.network("spotify_00001", 6),
      ]);
      setWorkspace(workspacePayload.result);
      setMarketSignals(marketPayload.result.top_signals || []);
      setNetwork(networkPayload.result);
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : "Backend unavailable");
    } finally {
      setLoadingBackend(false);
    }
  };

  useEffect(() => {
    void loadBackend();
  }, []);

  const workspaceRows = workspace?.streams?.workspace?.table_rows || [];
  const kpis = workspace?.streams?.workspace?.kpis;
  const graphSummary = workspace?.streams?.graph?.summary;
  const liveAtoms = workspaceRows.map(atomFromWorkspaceRow);
  const sourceAtoms = liveAtoms.length ? liveAtoms : ATOMS;

  const rows = useMemo(() =>
    sourceAtoms.filter((a) => {
      const f = filter === "All Atoms" || a.status === filter.toLowerCase();
      const q = a.atom.toLowerCase().includes(query.toLowerCase()) || a.collective.toLowerCase().includes(query.toLowerCase());
      return f && q;
    }), [filter, query, sourceAtoms]);

  const statCards = [
    {
      k: "Records Indexed",
      v: formatCompact(kpis?.records),
      note: `${formatCompact(kpis?.high_viability_records)} high-viability candidates`,
    },
    {
      k: "Portfolio Viability",
      v: formatScore(kpis?.avg_viability),
      note: `completion ${formatScore(kpis?.avg_completion_prediction)} · risk ${formatScore(kpis?.avg_cultural_risk)}`,
    },
    {
      k: "Signal Network",
      v: formatCompact(network?.summary?.connected_scripts ?? graphSummary?.unique_scripts),
      note: `${formatCompact(network?.summary?.related_signals ?? graphSummary?.unique_signals)} related signals`,
    },
  ];

  return (
    <div className="grid lg:grid-cols-[1.55fr_1fr] gap-6 fade-up">
      {/* Interactive 3D map */}
      <div className="rounded-2xl border-iridescent bg-white/70 glass shadow-ethereal overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Boxes className="h-3.5 w-3.5 text-amethyst" />
            <span className="text-[10px] tracking-couture uppercase text-amethyst">
              Interactive Map · Backend Signal spotify_00001
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void loadBackend()}
              disabled={loadingBackend}
              className="inline-flex items-center gap-1.5 text-[10px] tracking-couture uppercase px-3 py-1.5 rounded-full bg-white/70 text-amethyst hover:text-obsidian transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${loadingBackend ? "animate-spin" : ""}`} />
              Sync
            </button>
            {["Rotate", "Zoom", "Cluster"].map((m, i) => (
              <button key={m} className={`text-[10px] tracking-couture uppercase px-3 py-1.5 rounded-full transition-colors
                ${i===2 ? "bg-gradient-amethyst text-white" : "bg-secondary text-foreground/60 hover:text-obsidian"}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="relative h-[440px] bg-gradient-iridescent overflow-hidden">
          <Leiden3DGraph />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[10px] tracking-couture uppercase text-obsidian/60">
            <span>
              {formatCompact(graphSummary?.edges)} edges · {formatCompact(graphSummary?.unique_scripts)} scripts · {marketSignals.length || 6} market signals
            </span>
            <span className="text-amethyst">
              {backendError ? "fallback data" : workspace ? "live backend" : "syncing"}
            </span>
          </div>
        </div>
      </div>

      {/* Side stat cards */}
      <div className="grid gap-5">
        {statCards.map((s) => (
          <div key={s.k} className="rounded-2xl border-iridescent bg-white/80 p-5 shadow-soft">
            <div className="flex items-center justify-between text-[10px] tracking-couture uppercase">
              <span className="text-muted-foreground">{s.k}</span>
              <span className="text-amethyst">{workspace ? "live" : "local"}</span>
            </div>
            <div className="font-serif text-4xl text-obsidian mt-2">{s.v}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.note}</div>
          </div>
        ))}
      </div>

      {/* Atomic Anatomy table — full width */}
      <div className="lg:col-span-2 rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-border/60">
          <div>
            <div className="text-[10px] tracking-couture uppercase text-amethyst">Atomic Anatomy</div>
            <h3 className="font-serif text-2xl text-obsidian">
              Narrative Atoms · <span className="italic text-muted-foreground">Polars-optimized query</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {backendError ? "Backend fallback active. Start the API and sync again." : workspace ? "Hydrated from /interactive-workspace." : "Connecting to backend workspace."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search atoms…"
                className="pl-9 pr-3 py-2 bg-lavender/60 border border-border rounded-full text-xs w-56 focus:outline-none focus:border-amethyst"
              />
            </div>
            <div className="flex items-center gap-1 border border-border rounded-full bg-lavender/60 px-3 py-1.5">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-transparent text-xs text-obsidian focus:outline-none pr-1">
                {FILTERS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-couture uppercase text-muted-foreground">
                <th className="text-left  font-normal px-6 py-3">narrative_atom</th>
                <th className="text-left  font-normal px-6 py-3">collective</th>
                <th className="text-left  font-normal px-6 py-3"><span className="inline-flex items-center gap-1"><Music2 className="h-3 w-3" /> spotify_velocity</span></th>
                <th className="text-left  font-normal px-6 py-3"><span className="inline-flex items-center gap-1"><Headphones className="h-3 w-3" /> podcast_velocity</span></th>
                <th className="text-right font-normal px-6 py-3">resonance</th>
                <th className="text-right font-normal px-6 py-3">reach</th>
                <th className="text-left  font-normal px-6 py-3">status</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((r) => [
                <tr key={r.id + "-sep"}><td colSpan={7} className="p-0"><div className="h-px w-full bg-gradient-iridescent opacity-70" /></td></tr>,
                <tr key={r.id} className="hover:bg-lavender/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-serif italic text-obsidian">{r.atom}</div>
                    <div className="text-[10px] tracking-couture uppercase text-muted-foreground">{r.id}</div>
                  </td>
                  <td className="px-6 py-4 text-obsidian/80">{r.collective}</td>
                  <td className="px-6 py-4"><Sparkline data={r.spotify} accent="amethyst" label={`${r.velocity.toFixed(2)}×`} /></td>
                  <td className="px-6 py-4"><Sparkline data={r.podcast} accent="sky" label={`${(r.velocity * 0.84).toFixed(2)}×`} /></td>
                  <td className={`px-6 py-4 text-right font-data ${r.resonance >= 0 ? "text-amethyst" : "text-destructive"}`}>
                    {r.resonance >= 0 ? "+" : ""}{r.resonance.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-data text-obsidian/80">{r.reach}</td>
                  <td className="px-6 py-4"><StatusPill status={r.status} /></td>
                </tr>,
              ])}
              <tr><td colSpan={7} className="p-0"><div className="h-px w-full bg-gradient-iridescent opacity-70" /></td></tr>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic font-serif">No atoms match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-border/60 flex items-center justify-between text-[10px] tracking-couture uppercase text-muted-foreground">
          <span className="font-data normal-case tracking-normal">polars.scan_parquet("atoms.parquet").filter(...).collect()</span>
          <span className="text-amethyst">{rows.length} rows · {workspace ? "backend" : "local"} </span>
        </div>
      </div>

      <div className="lg:col-span-2 grid lg:grid-cols-3 gap-5">
        {marketSignals.slice(0, 3).map((signal) => (
          <article key={signal.signal_id} className="rounded-2xl border-iridescent bg-white/80 p-5 shadow-soft">
            <div className="text-[10px] tracking-couture uppercase text-amethyst">{signal.signal_category.replace(/_/g, " ")}</div>
            <h4 className="font-serif text-xl text-obsidian mt-1 truncate">{signal.signal_name}</h4>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="font-data text-2xl text-obsidian">{formatScore(signal.signal_strength, 2)}</div>
              <div className="text-right text-[10px] tracking-couture uppercase text-muted-foreground">
                {signal.primary_metric_name || "metric"}
                <div className="font-data normal-case tracking-normal text-amethyst">{formatCompact(signal.primary_metric)}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

/* ====================== Living Knowledge Base ====================== */

type Insight = {
  id: string; title: string; collective: string; date: string; tag: string; verdict: "Greenlight"|"Develop"|"Reconsider";
};

const INSIGHTS: Insight[] = [
  { id: "AB-2026-042", title: "Soft armour & the dawn-light renaissance", collective: "The Etherealists",     date: "Apr 28, 2026", tag: "Resort 2027",    verdict: "Greenlight" },
  { id: "AB-2026-041", title: "Why kitchen-sink romance won the quarter", collective: "Grounded Visionaries", date: "Apr 21, 2026", tag: "FW26 Campaign",  verdict: "Greenlight" },
  { id: "AB-2026-040", title: "The slowcore revival is not a phase",     collective: "Atlantic Brutalists",  date: "Apr 14, 2026", tag: "Sonic Strategy", verdict: "Develop"    },
  { id: "AB-2026-039", title: "Performative wellness — a graceful exit", collective: "Coastal Grandmothers", date: "Apr 07, 2026", tag: "Sunset Memo",    verdict: "Reconsider" },
  { id: "AB-2026-038", title: "Lichen, linen, and the Lisbon crossover", collective: "Studio Ceramicists",   date: "Mar 31, 2026", tag: "Color Story",    verdict: "Greenlight" },
  { id: "AB-2026-037", title: "Archive ferment & the new old money",      collective: "Quiet Luminaries",     date: "Mar 24, 2026", tag: "Heritage Brief", verdict: "Develop"    },
];

const KnowledgeBase = () => {
  const [q, setQ] = useState("");
  const items = INSIGHTS.filter((i) =>
    [i.title, i.collective, i.tag, i.id].some((s) => s.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-border/60">
        <div>
          <div className="text-[10px] tracking-couture uppercase text-amethyst">Living Knowledge Base</div>
          <h3 className="font-serif text-2xl text-obsidian">Filing Cabinet <span className="italic text-amethyst">2.0</span></h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-lg">A breathing archive — every brief is a node, every node a thread.</p>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search insights, collectives, tags…"
            className="pl-9 pr-3 py-2 bg-lavender/60 border border-border rounded-full text-xs w-72 focus:outline-none focus:border-amethyst"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 p-6">
        {items.map((i) => (
          <article key={i.id} className="group relative rounded-xl border-iridescent bg-white/70 p-5 shadow-soft hover:shadow-ethereal transition-shadow cursor-pointer">
            <div className="absolute inset-x-0 top-0 h-px iridescent-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between text-[10px] tracking-couture uppercase">
              <span className="text-muted-foreground">{i.date}</span>
              <VerdictPill v={i.verdict} />
            </div>
            <h4 className="font-serif text-lg text-obsidian mt-3 leading-snug">{i.title}</h4>
            <div className="mt-2 text-xs text-muted-foreground">{i.collective}</div>
            <div className="mt-4 flex items-center justify-between text-[10px] tracking-couture uppercase">
              <span className="px-2 py-0.5 rounded-full bg-sky-pale text-amethyst">{i.tag}</span>
              <span className="font-data text-muted-foreground">{i.id}</span>
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground italic font-serif py-12">
            <FolderOpen className="h-6 w-6 mx-auto mb-2 text-periwinkle" />
            No insights matching "{q}".
          </div>
        )}
      </div>
    </div>
  );
};

/* ====================== Orchestration Lab ====================== */

const AGENTS = [
  { name: "Aura · Curator",     role: "Selects atoms worth your attention",      effort: 70, on: true },
  { name: "Aura · Synthesizer", role: "Distills three Greenlight bullets",        effort: 85, on: true },
  { name: "Aura · Mailroom",    role: "Drafts and dispatches branded emails",     effort: 55, on: true },
  { name: "Aura · Archivist",   role: "Files briefs into the Living Knowledge Base", effort: 40, on: false },
];

const OrchestrationLab = () => {
  const [agents, setAgents] = useState(AGENTS);

  return (
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 fade-up">
      {/* Agent control panel */}
      <div className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-couture uppercase text-amethyst">Orchestration Lab</div>
            <h3 className="font-serif text-2xl text-obsidian">Tune your agents.</h3>
          </div>
          <span className="text-[10px] tracking-couture uppercase text-muted-foreground">NeMo-3-Nano · 4 agents</span>
        </div>

        <div className="mt-6 divide-y divide-border/60">
          {agents.map((a, i) => (
            <div key={a.name} className="py-4 grid sm:grid-cols-[1fr_auto_auto] items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amethyst" strokeWidth={1.5} />
                  <span className="font-serif text-obsidian">{a.name}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.role}</div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] tracking-couture uppercase text-muted-foreground">Reasoning</span>
                <input
                  type="range"
                  min={0} max={100}
                  value={a.effort}
                  onChange={(e) => setAgents((arr) => arr.map((x, j) => j===i ? {...x, effort: +e.target.value} : x))}
                  className="w-32 accent-amethyst"
                />
                <span className="font-data text-xs text-obsidian w-10 text-right">{a.effort}%</span>
              </div>

              <Switch
                checked={a.on}
                onCheckedChange={(v) => setAgents((arr) => arr.map((x, j) => j===i ? {...x, on: v} : x))}
                className="data-[state=checked]:bg-gradient-amethyst data-[state=unchecked]:bg-secondary"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Email templates manager */}
      <div className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal p-6">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-amethyst" />
          <div className="text-[10px] tracking-couture uppercase text-amethyst">Email Templates</div>
        </div>
        <h3 className="font-serif text-2xl text-obsidian mt-1">Voice library.</h3>

        <ul className="mt-5 space-y-3">
          {[
            { name: "Greenlight — Executive",  desc: "Warm, decisive, 90 words", active: true  },
            { name: "Develop — Strategy Desk", desc: "Curious, exploratory, 140 words", active: false },
            { name: "Reconsider — Studio",     desc: "Gentle redirect, 110 words", active: false },
            { name: "Sunset Memo",             desc: "Graceful exit, 80 words", active: false },
          ].map((t) => (
            <li key={t.name} className={`group flex items-center justify-between gap-4 px-4 py-3 rounded-xl border transition-colors
              ${t.active ? "border-amethyst/40 bg-lavender/60" : "border-border/60 bg-white/50 hover:bg-lavender/40"}`}>
              <div>
                <div className="text-sm font-serif text-obsidian">{t.name}</div>
                <div className="text-[11px] text-muted-foreground">{t.desc}</div>
              </div>
              {t.active
                ? <span className="text-[10px] tracking-couture uppercase text-amethyst">In use</span>
                : <button className="text-[10px] tracking-couture uppercase text-muted-foreground hover:text-amethyst">Activate</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/* ====================== Template Architect ====================== */

const DEFAULT_TEMPLATE = `# Aura Brief — {{date}}

**Verdict:** {{verdict}}  
**Aura Alignment:** {{index}} / 100

> "{{tagline}}"

## Three things you should know
1. {{bullet_one}}
2. {{bullet_two}}
3. {{bullet_three}}

— *Curated for {{recipient}}*`;

const TemplateArchitect = () => {
  const [src, setSrc] = useState(DEFAULT_TEMPLATE);

  const preview = useMemo(() =>
    src
      .replace(/{{date}}/g, "30 April 2026")
      .replace(/{{verdict}}/g, "Greenlight")
      .replace(/{{index}}/g, "87")
      .replace(/{{tagline}}/g, "Soft armour, dawn light.")
      .replace(/{{bullet_one}}/g, "Concept resonates with The Etherealists (+0.71).")
      .replace(/{{bullet_two}}/g, "Shift palette toward dawn-lavender.")
      .replace(/{{bullet_three}}/g, "Pair with podcast adjacencies (+0.62).")
      .replace(/{{recipient}}/g, "Eloise Marchetti")
  , [src]);

  return (
    <div className="grid lg:grid-cols-2 gap-6 fade-up">
      <div className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal p-6 flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-couture uppercase text-amethyst flex items-center gap-2">
              <FileCode2 className="h-3 w-3" /> Template Architect
            </div>
            <h3 className="font-serif text-2xl text-obsidian mt-1">Author the voice.</h3>
            <p className="text-xs text-muted-foreground mt-1">Markdown or HTML · merge tags in <span className="font-data">{"{{double_braces}}"}</span></p>
          </div>
          <button className="px-4 py-2 rounded-full bg-obsidian text-white text-[10px] tracking-couture uppercase hover:bg-amethyst transition-colors">Save Template</button>
        </div>

        <Textarea
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          rows={18}
          spellCheck={false}
          className="mt-5 flex-1 resize-none bg-lavender/40 border-border/60 font-data text-xs leading-relaxed text-obsidian focus-visible:ring-amethyst/40"
        />
      </div>

      <div className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-amethyst" />
            <span className="text-[10px] tracking-couture uppercase text-amethyst">Live Preview</span>
          </div>
          <span className="text-[10px] tracking-couture uppercase text-muted-foreground">rendered with sample data</span>
        </div>
        <pre className="flex-1 p-7 overflow-auto whitespace-pre-wrap font-serif text-obsidian text-sm leading-relaxed bg-gradient-iridescent/40">
{preview}
        </pre>
      </div>
    </div>
  );
};

/* ====================== Small primitives ====================== */

const Sparkline = ({ data, accent, label }: { data: number[]; accent: "amethyst" | "sky"; label: string }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-end gap-[2px] h-7">
        {data.map((v, i) => (
          <span
            key={i}
            className={`w-1 rounded-[1px] ${accent === "amethyst" ? "bg-gradient-to-t from-lavender to-amethyst" : "bg-gradient-to-t from-sky-pale to-sky-deep"}`}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
      <span className="font-data text-xs text-obsidian">{label}</span>
    </div>
  );
};

const StatusPill = ({ status }: { status: Atom["status"] }) => {
  const map = {
    rising:  { c: "bg-amethyst/10 text-amethyst border-amethyst/30",  d: "● rising"  },
    peaking: { c: "bg-sky-pale text-amethyst border-sky-deep/40",     d: "◆ peaking" },
    fading:  { c: "bg-secondary text-muted-foreground border-border", d: "○ fading"  },
  } as const;
  const s = map[status];
  return <span className={`inline-flex items-center text-[10px] tracking-couture uppercase px-2.5 py-1 rounded-full border ${s.c}`}>{s.d}</span>;
};

const VerdictPill = ({ v }: { v: Insight["verdict"] }) => {
  const map = {
    Greenlight:  "bg-amethyst/10 text-amethyst border-amethyst/30",
    Develop:     "bg-sky-pale text-amethyst border-sky-deep/40",
    Reconsider:  "bg-secondary text-muted-foreground border-border",
  } as const;
  return <span className={`inline-flex items-center text-[10px] tracking-couture uppercase px-2 py-0.5 rounded-full border ${map[v]}`}>{v}</span>;
};

/* ============== Pseudo-3D Leiden cluster graph ============== */

const Leiden3DGraph = () => {
  // Three pseudo-3D Leiden clusters, projected with parallax + size for depth.
  const clusters = [
    { cx: 28, cy: 42, depth: 1.0, color: "amethyst", label: "Etherealists" },
    { cx: 64, cy: 36, depth: 0.7, color: "sky",      label: "Visionaries" },
    { cx: 50, cy: 72, depth: 0.85,color: "amethyst", label: "Ceramicists" },
  ];

  const nodes = clusters.flatMap((c, ci) =>
    Array.from({ length: 16 }).map((_, i) => {
      const angle = (i / 16) * Math.PI * 2 + ci;
      const r = 8 + (i % 4) * 2;
      const x = c.cx + Math.cos(angle) * r * c.depth;
      const y = c.cy + Math.sin(angle) * r * c.depth * 0.7;
      const size = 0.8 + (Math.sin(i + ci) + 1) * 0.6 * c.depth;
      return { x, y, size, color: c.color, ci };
    })
  );

  const edges: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].ci !== nodes[j].ci) continue;
      if ((i + j) % 5 !== 0) continue;
      edges.push([i, j]);
    }
  }
  // a few cross-cluster bridges
  edges.push([2, 18], [4, 36], [20, 40], [12, 28]);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <radialGradient id="g3dAmethyst" cx="40%" cy="40%" r="60%">
          <stop offset="0%"  stopColor="hsl(263 80% 90%)" />
          <stop offset="100%" stopColor="hsl(263 50% 55%)" />
        </radialGradient>
        <radialGradient id="g3dSky" cx="40%" cy="40%" r="60%">
          <stop offset="0%"  stopColor="hsl(199 95% 92%)" />
          <stop offset="100%" stopColor="hsl(232 70% 70%)" />
        </radialGradient>
        <filter id="g3dGlow"><feGaussianBlur stdDeviation="0.6" /></filter>
      </defs>

      {/* halos behind clusters */}
      {clusters.map((c, i) => (
        <ellipse key={i} cx={c.cx} cy={c.cy} rx={16 * c.depth} ry={11 * c.depth}
          fill={c.color === "amethyst" ? "hsl(263 60% 80% / 0.35)" : "hsl(199 80% 85% / 0.45)"}
          filter="url(#g3dGlow)" />
      ))}

      {edges.map(([a, b], i) => {
        const n1 = nodes[a], n2 = nodes[b];
        if (!n1 || !n2) return null;
        return <line key={i} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="hsl(263 44% 42%)" strokeOpacity="0.18" strokeWidth="0.18" />;
      })}

      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.size + 1.6} fill={n.color === "amethyst" ? "url(#g3dAmethyst)" : "url(#g3dSky)"} opacity="0.18" />
          <circle cx={n.x} cy={n.y} r={n.size} fill={n.color === "amethyst" ? "url(#g3dAmethyst)" : "url(#g3dSky)"} stroke="hsl(252 100% 98%)" strokeWidth="0.18" />
        </g>
      ))}

      {clusters.map((c) => (
        <text key={c.label} x={c.cx} y={c.cy - 13} fontSize="2" textAnchor="middle"
              fill="hsl(257 44% 20%)" fontFamily="Playfair Display" fontStyle="italic">
          {c.label}
        </text>
      ))}
    </svg>
  );
};
