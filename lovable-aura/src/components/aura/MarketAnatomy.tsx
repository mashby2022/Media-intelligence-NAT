import { useEffect, useMemo, useState } from "react";
import {
  Filter, Search, Sparkles, Sliders, Mail, FileCode2, Eye,
  BookMarked, FolderOpen, Boxes, Layers, RefreshCw, Activity,
  Cpu, Network, Database,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  mieClient,
  type AssetStatus,
  type HealthResult,
  type KnowledgeItem,
  type KnowledgeVerdict,
  type MapCluster,
  type MarketSignal,
  type NetworkResult,
  type PortfolioAsset,
  type WorkspaceResult,
  type WorkspaceRow,
} from "@/lib/mieClient";

/* ============================================================
 * Operator Studio — high-density companion to the Forecast view
 * ==========================================================*/

type StatusFilter = "all" | AssetStatus;
const STATUS_FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All Assets", value: "all" },
  { label: "Rising", value: "rising" },
  { label: "Peaking", value: "peaking" },
  { label: "Fading", value: "fading" },
];
const TABS = [
  { id: "anatomy",      label: "Portfolio Logic",        Icon: Layers },
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

const statusFromRow = (row: WorkspaceRow): AssetStatus => {
  if (row.risk_category === "HIGH" || row.risk_category === "ELEVATED") return "fading";
  if (row.viability_score >= 0.85 || row.emergent_trend === "Momentum Breakout") return "rising";
  return "peaking";
};

const assetFromWorkspaceRow = (row: WorkspaceRow): PortfolioAsset => ({
  ...row,
  asset_id: row.script_id,
  asset_type: "script",
  status: row.status || statusFromRow(row),
  narrative_atoms: row.narrative_atoms || [
    { atom_id: `${row.script_id}:genre`, atom_type: "genre", label: row.genre_primary, source_field: "genre_primary", role: "genre spine" },
    { atom_id: `${row.script_id}:platform`, atom_type: "platform", label: row.platform_fit, source_field: "platform_fit", role: "distribution fit" },
    { atom_id: `${row.script_id}:audience`, atom_type: "audience", label: row.target_demo, source_field: "target_demo", role: "target demo" },
    { atom_id: `${row.script_id}:trend`, atom_type: "trend", label: row.emergent_trend || "Stable Demand", source_field: "emergent_trend", role: "market movement" },
    { atom_id: `${row.script_id}:risk`, atom_type: "risk", label: row.risk_category, source_field: "risk_category", role: "risk posture" },
  ],
});

/* ====================== Main view ======================== */

export const MarketAnatomy = () => {
  const [tab, setTab] = useState<Tab>("anatomy");
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [heartbeatError, setHeartbeatError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadHeartbeat = async () => {
    try {
      const payload = await mieClient.health();
      setHealth(payload);
      setHeartbeatError(null);
      setLastSync(new Date());
    } catch (error) {
      setHeartbeatError(error instanceof Error ? error.message : "Backend heartbeat unavailable");
    }
  };

  useEffect(() => {
    void loadHeartbeat();
  }, []);

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
              The operator layer for the Orchestrator. Inspect portfolio assets,
              validate narrative atoms, and monitor the live intelligence pipeline.
            </p>
          </div>
          <div className="text-right">
            <div className="font-serif text-3xl text-obsidian">11.2M<span className="text-amethyst">/d</span></div>
            <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Signals processed today</div>
          </div>
        </div>

        <HeartbeatStrip
          health={health}
          error={heartbeatError}
          lastSync={lastSync}
          onRefresh={() => void loadHeartbeat()}
        />

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
        {tab === "anatomy"       && <AtomicAnatomy onSynced={() => setLastSync(new Date())} />}
        {tab === "knowledge"     && <KnowledgeBase />}
        {tab === "orchestration" && <OrchestrationLab />}
        {tab === "template"      && <TemplateArchitect />}
      </div>
    </section>
  );
};

/* ====================== Operator heartbeat ====================== */

const HeartbeatStrip = ({
  health,
  error,
  lastSync,
  onRefresh,
}: {
  health: HealthResult | null;
  error: string | null;
  lastSync: Date | null;
  onRefresh: () => void;
}) => {
  const ops = health?.ops;
  const items = [
    {
      label: "Backend",
      value: health?.status === "ok" ? "online" : error ? "offline" : "syncing",
      note: health?.data_dir || "data pending",
      Icon: Activity,
      tone: health?.status === "ok" ? "#10B981" : error ? "#F43F5E" : "#F59E0B",
    },
    {
      label: "NIM",
      value: ops?.nim?.configured ? "configured" : "fallback",
      note: ops?.nim?.mode || "checking",
      Icon: Cpu,
      tone: ops?.nim?.configured ? "#10B981" : "#F59E0B",
    },
    {
      label: "Graph",
      value: ops?.graph?.active_engine || "unknown",
      note: ops?.graph?.compute_source || "package scan pending",
      Icon: Network,
      tone: ops?.graph?.accelerated_available ? "#10B981" : "#F59E0B",
    },
    {
      label: "Polars",
      value: `${formatScore(ops?.polars?.latency_ms ?? undefined, 2)}ms`,
      note: `${formatCompact(ops?.polars?.throughput ?? undefined)} rows/sec`,
      Icon: Database,
      tone: "#10B981",
    },
  ];

  return (
    <div className="mt-7 rounded-xl border border-obsidian/10 bg-obsidian text-white shadow-soft overflow-hidden">
      <div className="grid md:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        {items.map(({ label, value, note, Icon, tone }) => (
          <div key={label} className="min-w-0 px-4 py-3 border-b md:border-b-0 md:border-r border-white/10">
            <div className="flex items-center gap-2 text-[10px] tracking-couture uppercase text-white/55">
              <Icon className="h-3.5 w-3.5" style={{ color: tone }} />
              {label}
            </div>
            <div className="mt-1 truncate font-data text-sm" style={{ color: tone }}>{value}</div>
            <div className="truncate text-[11px] text-white/50">{note}</div>
          </div>
        ))}
        <div className="flex md:flex-col items-center md:items-end justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] tracking-couture uppercase text-white/45">Last Sync</div>
            <div className="font-data text-xs text-white/75">
              {lastSync ? lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "pending"}
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/35 transition-colors"
            aria-label="Refresh heartbeat"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {error && (
        <div className="border-t border-white/10 px-4 py-2 text-[11px] text-[#F43F5E]">
          {error}
        </div>
      )}
    </div>
  );
};

/* ====================== Portfolio Logic Matrix ====================== */

const AtomicAnatomy = ({ onSynced }: { onSynced: () => void }) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceResult["result"] | null>(null);
  const [marketSignals, setMarketSignals] = useState<MarketSignal[]>([]);
  const [network, setNetwork] = useState<NetworkResult["result"] | null>(null);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const loadBackend = async (nextStatus: StatusFilter = statusFilter) => {
    setLoadingBackend(true);
    setBackendError(null);
    try {
      const filters = nextStatus === "all" ? {} : { status: nextStatus };
      const [workspacePayload, marketPayload, networkPayload] = await Promise.all([
        mieClient.workspace(filters, 50),
        mieClient.marketSignals(6),
        mieClient.network("spotify_00001", 6),
      ]);
      setWorkspace(workspacePayload.result);
      setMarketSignals(marketPayload.result.top_signals || []);
      setNetwork(networkPayload.result);
      onSynced();
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : "Backend unavailable");
    } finally {
      setLoadingBackend(false);
    }
  };

  useEffect(() => {
    void loadBackend();
  }, [statusFilter]);

  const workspaceStream = workspace?.streams?.workspace;
  const workspaceRows = workspaceStream?.table_rows || [];
  const portfolioAssets = workspaceStream?.portfolio_assets?.length
    ? workspaceStream.portfolio_assets
    : workspaceRows.map(assetFromWorkspaceRow);
  const clusters = workspaceStream?.clusters || [];
  const kpis = workspace?.streams?.workspace?.kpis;
  const benchmark = workspace?.streams?.workspace?.benchmark;
  const graphSummary = workspace?.streams?.graph?.summary;

  const rows = useMemo(() =>
    portfolioAssets.filter((asset) => {
      const haystack = [
        asset.title,
        asset.script_id,
        asset.genre_primary,
        asset.platform_fit,
        asset.target_demo,
        asset.market,
        asset.emergent_trend,
        ...(asset.narrative_atoms || []).map((atom) => atom.label),
      ].join(" ").toLowerCase();
      return haystack.includes(query.toLowerCase());
    }), [query, portfolioAssets]);

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
              Signal Map Preview · Backend Signal spotify_00001
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
            <span className="inline-flex items-center text-[10px] tracking-couture uppercase px-3 py-1.5 rounded-full bg-secondary text-muted-foreground">
              Static layout
            </span>
          </div>
        </div>
        <div className="relative h-[440px] bg-gradient-iridescent overflow-hidden">
          <Leiden3DGraph clusters={clusters} />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[10px] tracking-couture uppercase text-obsidian/60">
            <span>
              {formatCompact(graphSummary?.edges)} edges · {formatCompact(graphSummary?.unique_scripts)} scripts · {marketSignals.length || 6} market signals
            </span>
            <span className="text-amethyst">
              {backendError ? "backend unavailable" : workspace ? "live counts · preview map" : "syncing"}
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

      {/* Portfolio Logic Matrix table — full width */}
      <div className="lg:col-span-2 rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-border/60">
          <div>
            <div className="text-[10px] tracking-couture uppercase text-amethyst">Portfolio Logic Matrix</div>
            <h3 className="font-serif text-2xl text-obsidian">
              Asset Inventory · <span className="italic text-muted-foreground">Polars-optimized query</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {backendError ? "Backend unavailable. Start the API and sync again." : workspace ? "Hydrated from /interactive-workspace portfolio_assets." : "Connecting to backend workspace."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search assets…"
                className="pl-9 pr-3 py-2 bg-lavender/60 border border-border rounded-full text-xs w-56 focus:outline-none focus:border-amethyst"
              />
            </div>
            <div className="flex items-center gap-1 border border-border rounded-full bg-lavender/60 px-3 py-1.5">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-transparent text-xs text-obsidian focus:outline-none pr-1"
              >
                {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-couture uppercase text-muted-foreground">
                <th className="text-left  font-normal px-6 py-3">asset</th>
                <th className="text-left  font-normal px-6 py-3">fit</th>
                <th className="text-right font-normal px-6 py-3">viability</th>
                <th className="text-right font-normal px-6 py-3">completion</th>
                <th className="text-left  font-normal px-6 py-3">trend / risk</th>
                <th className="text-left  font-normal px-6 py-3">narrative atoms</th>
                <th className="text-left  font-normal px-6 py-3">status</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((r) => [
                <tr key={r.asset_id + "-sep"}><td colSpan={7} className="p-0"><div className="h-px w-full bg-gradient-iridescent opacity-70" /></td></tr>,
                <tr key={r.asset_id} className="hover:bg-lavender/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-serif italic text-obsidian">{r.title}</div>
                    <div className="text-[10px] tracking-couture uppercase text-muted-foreground">{r.asset_id} · {r.asset_type}</div>
                  </td>
                  <td className="px-6 py-4 text-obsidian/80">
                    <div>{r.genre_primary} · {r.platform_fit}</div>
                    <div className="text-[11px] text-muted-foreground">{r.target_demo} · {r.market || "market n/a"}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-data text-obsidian/80">
                    {formatScore(r.viability_score)}
                  </td>
                  <td className="px-6 py-4 text-right font-data text-obsidian/80">
                    {formatScore(r.completion_prediction)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-obsidian/80">{r.emergent_trend || "Stable Demand"}</div>
                    <div className="font-data text-[11px] text-muted-foreground">risk {r.risk_category}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                      {(r.narrative_atoms || []).slice(0, 6).map((atom) => (
                        <span key={atom.atom_id} className="rounded-full border border-border/70 bg-white/70 px-2 py-0.5 text-[10px] text-obsidian/70">
                          {atom.atom_type}: {atom.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4"><StatusPill status={r.status} /></td>
                </tr>,
              ])}
              <tr><td colSpan={7} className="p-0"><div className="h-px w-full bg-gradient-iridescent opacity-70" /></td></tr>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic font-serif">No assets match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-border/60 flex items-center justify-between text-[10px] tracking-couture uppercase text-muted-foreground">
          <span className="font-data normal-case tracking-normal">
            polars.scan_parquet("scripts_150k.parquet").filter(status={statusFilter}).collect()
          </span>
          <span className="text-amethyst">{rows.length} rows · {formatScore(benchmark?.latency_ms, 2)}ms</span>
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

const DEFAULT_STYLE_TRIBES = [
  "The Etherealists",
  "Grounded Visionaries",
  "Quiet Luminaries",
  "Signal Maximalists",
  "Atlantic Brutalists",
  "Studio Ceramicists",
];
const DEFAULT_VERDICTS: KnowledgeVerdict[] = ["Greenlight", "Develop", "Reconsider"];

const KnowledgeBase = () => {
  const [q, setQ] = useState("");
  const [styleTribe, setStyleTribe] = useState("");
  const [verdict, setVerdict] = useState("");
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [styleOptions, setStyleOptions] = useState(DEFAULT_STYLE_TRIBES);
  const [verdictOptions, setVerdictOptions] = useState<KnowledgeVerdict[]>(DEFAULT_VERDICTS);
  const [latencyMs, setLatencyMs] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      mieClient.knowledgeSearch({
        query: q,
        style_tribe: styleTribe || undefined,
        verdict: verdict ? (verdict as KnowledgeVerdict) : undefined,
        limit: 24,
      })
        .then((payload) => {
          if (cancelled) return;
          setItems(payload.result.items || []);
          setStyleOptions(payload.result.filter_options?.style_tribes || DEFAULT_STYLE_TRIBES);
          setVerdictOptions(payload.result.filter_options?.verdicts || DEFAULT_VERDICTS);
          setLatencyMs(payload.result.benchmark?.latency_ms);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Knowledge search unavailable");
          setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, styleTribe, verdict]);

  return (
    <div className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-border/60">
        <div>
          <div className="text-[10px] tracking-couture uppercase text-amethyst">Living Knowledge Base</div>
          <h3 className="font-serif text-2xl text-obsidian">Filing Cabinet <span className="italic text-amethyst">2.0</span></h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-lg">
            Hydrated from Polars search across scripts, style tribes, verdicts, and historical context.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="search archive..."
              className="pl-9 pr-3 py-2 bg-lavender/60 border border-border rounded-full text-xs w-64 focus:outline-none focus:border-amethyst"
            />
          </div>
          <select
            value={styleTribe}
            onChange={(e) => setStyleTribe(e.target.value)}
            className="px-3 py-2 bg-lavender/60 border border-border rounded-full text-xs text-obsidian focus:outline-none focus:border-amethyst"
          >
            <option value="">All Style Tribes</option>
            {styleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select
            value={verdict}
            onChange={(e) => setVerdict(e.target.value)}
            className="px-3 py-2 bg-lavender/60 border border-border rounded-full text-xs text-obsidian focus:outline-none focus:border-amethyst"
          >
            <option value="">All Verdicts</option>
            {verdictOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 p-6">
        {items.map((i) => (
          <article key={i.knowledge_id} className="group relative rounded-xl border-iridescent bg-white/70 p-5 shadow-soft hover:shadow-ethereal transition-shadow cursor-pointer">
            <div className="absolute inset-x-0 top-0 h-px iridescent-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between text-[10px] tracking-couture uppercase">
              <span className="text-muted-foreground">{i.published_date}</span>
              <VerdictPill v={i.verdict} />
            </div>
            <h4 className="font-serif text-lg text-obsidian mt-3 leading-snug">{i.title}</h4>
            <div className="mt-2 text-xs text-muted-foreground">{i.style_tribe}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 font-data text-[11px] text-obsidian/70">
              <span>viability {formatScore(i.viability_score)}</span>
              <span>risk {formatScore(i.cultural_risk_score)}</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] tracking-couture uppercase">
              <span className="px-2 py-0.5 rounded-full bg-sky-pale text-amethyst">{i.tag}</span>
              <span className="font-data text-muted-foreground">{i.knowledge_id}</span>
            </div>
          </article>
        ))}
        {loading && (
          <div className="col-span-full text-center text-muted-foreground italic font-serif py-12">
            Searching living knowledge.
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground italic font-serif py-12">
            <FolderOpen className="h-6 w-6 mx-auto mb-2 text-periwinkle" />
            {error ? error : `No archive entries matching "${q}".`}
          </div>
        )}
      </div>
      <div className="px-6 py-3 border-t border-border/60 flex items-center justify-between text-[10px] tracking-couture uppercase text-muted-foreground">
        <span className="font-data normal-case tracking-normal">polars.scan_parquet("scripts_150k.parquet").filter(tribe, verdict, query)</span>
        <span className="text-amethyst">{items.length} entries · {formatScore(latencyMs, 2)}ms</span>
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
          <span className="text-[10px] tracking-couture uppercase text-muted-foreground">NAT + Nemotron Nano · 4 agents</span>
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

const StatusPill = ({ status }: { status: AssetStatus }) => {
  const map = {
    rising:  { color: "#10B981", d: "● rising"  },
    peaking: { color: "#F59E0B", d: "◆ peaking" },
    fading:  { color: "#F43F5E", d: "○ fading"  },
  } as const;
  const s = map[status];
  return (
    <span
      className="inline-flex items-center text-[10px] tracking-couture uppercase px-2.5 py-1 rounded-full border"
      style={{
        color: s.color,
        borderColor: `${s.color}55`,
        backgroundColor: `${s.color}14`,
      }}
    >
      {s.d}
    </span>
  );
};

const VerdictPill = ({ v }: { v: KnowledgeVerdict }) => {
  const map = {
    Greenlight:  "bg-amethyst/10 text-amethyst border-amethyst/30",
    Develop:     "bg-sky-pale text-amethyst border-sky-deep/40",
    Reconsider:  "bg-secondary text-muted-foreground border-border",
  } as const;
  return <span className={`inline-flex items-center text-[10px] tracking-couture uppercase px-2 py-0.5 rounded-full border ${map[v]}`}>{v}</span>;
};

/* ============== Backend-driven signal cluster graph ============== */

const DEFAULT_CLUSTERS: MapCluster[] = [
  { cluster_id: "fallback_001", label: "The Etherealists", style_tribe: "The Etherealists", records: 0, share: 0.34, dominant_verdict: "Greenlight", x: 28, y: 42, depth: 1.0, node_count: 16, color: "#10B981" },
  { cluster_id: "fallback_002", label: "Grounded Visionaries", style_tribe: "Grounded Visionaries", records: 0, share: 0.28, dominant_verdict: "Develop", x: 64, y: 36, depth: 0.75, node_count: 14, color: "#F59E0B" },
  { cluster_id: "fallback_003", label: "Studio Ceramicists", style_tribe: "Studio Ceramicists", records: 0, share: 0.2, dominant_verdict: "Reconsider", x: 50, y: 72, depth: 0.85, node_count: 12, color: "#F43F5E" },
];

const Leiden3DGraph = ({ clusters: backendClusters }: { clusters: MapCluster[] }) => {
  const clusters = backendClusters.length ? backendClusters : DEFAULT_CLUSTERS;

  const nodes = clusters.flatMap((c, ci) =>
    Array.from({ length: Math.max(6, Math.min(c.node_count || 12, 28)) }).map((_, i) => {
      const count = Math.max(1, c.node_count || 12);
      const angle = (i / count) * Math.PI * 2 + ci;
      const r = 7 + (i % 4) * 2.1;
      const x = c.x + Math.cos(angle) * r * c.depth;
      const y = c.y + Math.sin(angle) * r * c.depth * 0.7;
      const size = 0.75 + (Math.sin(i + ci) + 1) * 0.55 * c.depth;
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
  for (let i = 0; i < clusters.length - 1; i++) {
    const source = nodes.findIndex((node) => node.ci === i);
    const target = nodes.findIndex((node) => node.ci === i + 1);
    if (source >= 0 && target >= 0) edges.push([source, target]);
  }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <filter id="g3dGlow"><feGaussianBlur stdDeviation="0.6" /></filter>
      </defs>

      {clusters.map((c, i) => (
        <ellipse key={c.cluster_id || i} cx={c.x} cy={c.y} rx={16 * c.depth} ry={11 * c.depth}
          fill={c.color}
          opacity="0.18"
          filter="url(#g3dGlow)"
        />
      ))}

      {edges.map(([a, b], i) => {
        const n1 = nodes[a], n2 = nodes[b];
        if (!n1 || !n2) return null;
        return <line key={i} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="hsl(263 44% 42%)" strokeOpacity="0.18" strokeWidth="0.18" />;
      })}

      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.size + 1.6} fill={n.color} opacity="0.16" />
          <circle cx={n.x} cy={n.y} r={n.size} fill={n.color} stroke="hsl(252 100% 98%)" strokeWidth="0.18" />
        </g>
      ))}

      {clusters.map((c) => (
        <text key={c.cluster_id || c.label} x={c.x} y={c.y - 13} fontSize="2" textAnchor="middle"
              fill="hsl(257 44% 20%)" fontFamily="Playfair Display" fontStyle="italic">
          {c.label}
        </text>
      ))}
    </svg>
  );
};
