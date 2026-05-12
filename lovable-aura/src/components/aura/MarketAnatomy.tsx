import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Filter, Search, Sparkles, Sliders,
  BookMarked, FolderOpen, Boxes, Layers, RefreshCw, Activity,
  Cpu, Network, Database,
} from "lucide-react";
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

const statusFromCluster = (cluster: MapCluster): StatusFilter => {
  const verdict = cluster.dominant_verdict.toLowerCase();
  if (verdict.includes("greenlight")) return "rising";
  if (verdict.includes("reconsider")) return "fading";
  return "peaking";
};

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
              Analyst <span className="italic">Studio.</span>
            </h1>
            <p className="mt-5 max-w-xl text-muted-foreground leading-relaxed">
              The operator layer for the Orchestrator. Inspect portfolio assets,
              validate narrative atoms, and monitor the live intelligence pipeline.
            </p>
          </div>
          <div className="text-right">
            <div className="font-serif text-3xl text-obsidian">11.2M<span className="text-mint-deep">/d</span></div>
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
        <div className="mt-8 flex flex-wrap gap-1 p-1 rounded-full bg-white/70 border border-emerald-200/50 w-fit shadow-soft">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] tracking-couture uppercase transition-all
                  ${active ? "bg-gradient-aura text-white shadow-halo" : "text-foreground/60 hover:text-obsidian hover:bg-mint"}`}
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
      note: ops?.graph?.accelerated_available
        ? "cuGraph acceleration active"
        : "zero-code GPU path via nx-cugraph",
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
    <div className="mt-7 rounded-xl border border-emerald-200 bg-white/85 text-obsidian shadow-soft overflow-hidden">
      <div className="grid md:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        {items.map(({ label, value, note, Icon, tone }) => (
          <div key={label} className="min-w-0 px-4 py-3 border-b md:border-b-0 md:border-r border-emerald-200/50">
            <div className="flex items-center gap-2 text-[10px] tracking-couture uppercase text-muted-foreground">
              <Icon className="h-3.5 w-3.5" style={{ color: tone }} />
              {label}
            </div>
            <div className="mt-1 truncate font-data text-sm" style={{ color: tone }}>{value}</div>
            <div className="truncate text-[11px] text-muted-foreground">{note}</div>
          </div>
        ))}
        <div className="flex md:flex-col items-center md:items-end justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Last Sync</div>
            <div className="font-data text-xs text-obsidian">
              {lastSync ? lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "pending"}
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 text-mint-deep hover:bg-mint transition-colors"
            aria-label="Refresh heartbeat"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {error && (
        <div className="border-t border-rose-200/70 bg-rose-50/70 px-4 py-2 text-[11px] text-[#F43F5E]">
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
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
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
  const activeCluster = useMemo(() => {
    if (!clusters.length) return DEFAULT_CLUSTERS[0];
    return clusters.find((cluster) => cluster.cluster_id === selectedClusterId) || clusters[0];
  }, [clusters, selectedClusterId]);
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
              Interactive Signal Map · Backend Signal spotify_00001
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
              Drag clusters
            </span>
          </div>
        </div>
        <div className="grid xl:grid-cols-[1fr_320px]">
          <div className="relative h-[440px] overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(236,253,245,0.84)_42%,rgba(245,243,255,0.92))]">
            <Leiden3DGraph
              clusters={clusters}
              selectedClusterId={activeCluster?.cluster_id}
              onSelect={(cluster) => setSelectedClusterId(cluster.cluster_id)}
            />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[10px] tracking-couture uppercase text-obsidian/60">
              <span>
                {formatCompact(graphSummary?.edges)} edges · {formatCompact(graphSummary?.unique_scripts)} scripts · {marketSignals.length || 6} market signals
              </span>
              <span className="text-amethyst">
                {backendError ? "backend unavailable" : workspace ? "live audience clusters · draggable map" : "syncing"}
              </span>
            </div>
          </div>
          <div className="border-t xl:border-l xl:border-t-0 border-emerald-200/60 bg-white/82 p-5">
            {activeCluster && (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] tracking-couture uppercase text-mint-deep">Selected Audience Segment</div>
                    <div className="mt-2 text-base font-semibold text-obsidian">{audienceSegmentLabel(activeCluster)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {activeCluster.dominant_verdict} · {activeCluster.dominant_trend || "trend blend"}
                    </div>
                  </div>
                  <span
                    className="mt-1 h-3 w-3 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: clusterColor(activeCluster, clusters.findIndex((cluster) => cluster.cluster_id === activeCluster.cluster_id)) }}
                  />
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 font-data text-[11px] text-obsidian/80">
                  <div className="rounded-lg border border-border/60 bg-gradient-mint px-3 py-2">
                    <div className="text-[9px] tracking-couture uppercase text-muted-foreground">Audience Lens</div>
                    <div className="mt-1 font-sans text-sm text-obsidian">{activeCluster.style_tribe || activeCluster.label}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="rounded-lg border border-border/60 bg-white px-2 py-2">{formatCompact(activeCluster.records)} records</span>
                    <span className="rounded-lg border border-border/60 bg-white px-2 py-2">{formatScore(activeCluster.share * 100, 1)}% share</span>
                    <span className="rounded-lg border border-border/60 bg-white px-2 py-2">{activeCluster.node_count} nodes</span>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter(statusFromCluster(activeCluster));
                      setQuery("");
                    }}
                    className="rounded-full bg-gradient-aura px-3 py-1.5 text-[9px] tracking-couture uppercase text-white shadow-soft"
                  >
                    Filter Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("all");
                      setQuery("");
                    }}
                    className="rounded-full border border-border/70 bg-white px-3 py-1.5 text-[9px] tracking-couture uppercase text-muted-foreground hover:text-obsidian"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
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

        <div className="grid gap-3 border-b border-border/60 bg-gradient-mint px-6 py-3 text-xs text-muted-foreground lg:grid-cols-2">
          <div>
            <span className="font-data text-obsidian">Viability</span>
            <span> = greenlight attractiveness from genre lift, audience behavior, signal momentum, and prime-time affinity.</span>
          </div>
          <div>
            <span className="font-data text-obsidian">Completion</span>
            <span> = predicted audience finish-through from observed completion behavior plus asset viability.</span>
          </div>
          <div className="lg:col-span-2 text-[10px] tracking-couture uppercase text-muted-foreground">
            Source: synthetic demo corpus in scripts_150k.parquet, generated by the local data pipeline and ranked with Polars; not a production trained greenlight model.
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
  {
    name: "Curator",
    role: "Ranks portfolio evidence and audience segments.",
    mode: "Balanced",
    on: true,
    output: "Candidate bets",
  },
  {
    name: "Synthesizer",
    role: "Turns evidence into the executive recommendation.",
    mode: "Deep",
    on: true,
    output: "Greenlight brief",
  },
  {
    name: "Dispatcher",
    role: "Formats and sends the inbox-ready artifact.",
    mode: "Fast",
    on: true,
    output: "Email dispatch",
  },
  {
    name: "Archivist",
    role: "Files the run into the living knowledge base.",
    mode: "Fast",
    on: false,
    output: "Memory update",
  },
];

type AgentMode = typeof AGENTS[number]["mode"];
const AGENT_MODES: Array<{ label: AgentMode; detail: string }> = [
  { label: "Fast", detail: "low latency" },
  { label: "Balanced", detail: "demo default" },
  { label: "Deep", detail: "more reasoning" },
];

const OrchestrationLab = () => {
  const [agents, setAgents] = useState(AGENTS);

  return (
    <div className="fade-up">
      {/* Agent control panel */}
      <div className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-couture uppercase text-amethyst">Orchestration Lab</div>
            <h3 className="font-serif text-2xl text-obsidian">Configure the agent run.</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Choose which workflow agents participate and how much reasoning budget each step gets.
              This is a demo control surface for the NAT orchestration plan, not a hidden model retraining panel.
            </p>
          </div>
          <span className="text-[10px] tracking-couture uppercase text-muted-foreground">NAT + Nemotron Nano · run plan</span>
        </div>

        <div className="mt-6 grid gap-3">
          {agents.map((a, i) => (
            <div key={a.name} className="rounded-xl border border-border/70 bg-white/70 p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amethyst" strokeWidth={1.5} />
                  <div>
                    <div className="font-sans font-semibold text-obsidian">{a.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.role}</div>
                    <div className="mt-2 inline-flex rounded-full bg-mint px-2 py-0.5 text-[9px] tracking-couture uppercase text-mint-deep">
                      Output · {a.output}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] tracking-couture uppercase text-muted-foreground">Reasoning Budget</div>
                  <div className="inline-flex rounded-full border border-border/70 bg-white p-1">
                    {AGENT_MODES.map((mode) => {
                      const active = a.mode === mode.label;
                      return (
                        <button
                          key={mode.label}
                          type="button"
                          onClick={() => setAgents((arr) => arr.map((x, j) => j === i ? { ...x, mode: mode.label } : x))}
                          className={`rounded-full px-3 py-1.5 text-[10px] tracking-couture uppercase transition-colors ${
                            active ? "bg-gradient-aura text-white shadow-soft" : "text-muted-foreground hover:bg-mint hover:text-obsidian"
                          }`}
                          title={mode.detail}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-full border border-border/70 bg-white px-3 py-2">
                  <span className="text-[10px] tracking-couture uppercase text-obsidian">
                    {a.on ? "Included in run" : "Skipped"}
                  </span>
                  <Switch
                    checked={a.on}
                    onCheckedChange={(v) => setAgents((arr) => arr.map((x, j) => j===i ? {...x, on: v} : x))}
                    className="data-[state=checked]:bg-gradient-aura data-[state=unchecked]:bg-secondary"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-gradient-mint px-4 py-3">
          <div className="text-[10px] tracking-couture uppercase text-mint-deep">What changes in the demo</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            These controls demonstrate the kind of orchestration knobs a customer could expose:
            include or skip workflow steps, and choose faster or deeper reasoning for each step.
            The live demo keeps the runtime stable for reliability.
          </p>
        </div>
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
  { cluster_id: "fallback_002", label: "Grounded Visionaries", style_tribe: "Grounded Visionaries", records: 0, share: 0.28, dominant_verdict: "Develop", x: 64, y: 36, depth: 0.75, node_count: 14, color: "#7C3AED" },
  { cluster_id: "fallback_003", label: "Studio Ceramicists", style_tribe: "Studio Ceramicists", records: 0, share: 0.2, dominant_verdict: "Reconsider", x: 50, y: 72, depth: 0.85, node_count: 12, color: "#F43F5E" },
];

const CLUSTER_PALETTE = [
  "#10B981",
  "#7C3AED",
  "#0EA5E9",
  "#F43F5E",
  "#14B8A6",
  "#8B5CF6",
  "#F59E0B",
  "#6366F1",
];

const clusterColor = (cluster: MapCluster, index: number) =>
  CLUSTER_PALETTE[index % CLUSTER_PALETTE.length] || cluster.color || "#7C3AED";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const audienceSegmentLabel = (cluster: MapCluster) =>
  (cluster.style_tribe || cluster.label).replace(/^the\s+/i, "");

const Leiden3DGraph = ({
  clusters: backendClusters,
  selectedClusterId,
  onSelect,
}: {
  clusters: MapCluster[];
  selectedClusterId?: string;
  onSelect: (cluster: MapCluster) => void;
}) => {
  const clusters = backendClusters.length ? backendClusters : DEFAULT_CLUSTERS;
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [drag, setDrag] = useState<{ clusterId: string; dx: number; dy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setPositions((current) => {
      const next: Record<string, { x: number; y: number }> = {};
      clusters.forEach((cluster) => {
        next[cluster.cluster_id] = current[cluster.cluster_id] || { x: cluster.x, y: cluster.y };
      });
      return next;
    });
  }, [clusters]);

  const plottedClusters = clusters.map((cluster, index) => ({
    ...cluster,
    color: clusterColor(cluster, index),
    x: positions[cluster.cluster_id]?.x ?? cluster.x,
    y: positions[cluster.cluster_id]?.y ?? cluster.y,
  }));

  const pointerPoint = (event: ReactPointerEvent<SVGSVGElement | SVGGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const startDrag = (event: ReactPointerEvent<SVGGElement>, cluster: MapCluster) => {
    event.preventDefault();
    onSelect(cluster);
    const point = pointerPoint(event);
    setDrag({ clusterId: cluster.cluster_id, dx: cluster.x - point.x, dy: cluster.y - point.y });
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const point = pointerPoint(event);
    setPositions((current) => ({
      ...current,
      [drag.clusterId]: {
        x: clamp(point.x + drag.dx, 12, 88),
        y: clamp(point.y + drag.dy, 18, 82),
      },
    }));
  };

  const nodes = plottedClusters.flatMap((c, ci) =>
    Array.from({ length: Math.max(6, Math.min(c.node_count || 12, 28)) }).map((_, i) => {
      const count = Math.max(1, c.node_count || 12);
      const angle = (i / count) * Math.PI * 2 + ci;
      const r = 6.5 + (i % 4) * 1.55;
      const x = c.x + Math.cos(angle) * r * c.depth;
      const y = c.y + Math.sin(angle) * r * c.depth * 0.7;
      const size = 0.58 + (Math.sin(i + ci) + 1) * 0.42 * c.depth;
      return { x, y, size, color: c.color, ci, clusterId: c.cluster_id };
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
  for (let i = 0; i < plottedClusters.length - 1; i++) {
    const source = nodes.findIndex((node) => node.ci === i);
    const target = nodes.findIndex((node) => node.ci === i + 1);
    if (source >= 0 && target >= 0) edges.push([source, target]);
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`w-full h-full ${drag ? "cursor-grabbing" : "cursor-default"}`}
      onPointerMove={moveDrag}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
    >
      <defs>
        <filter id="premiumGlow"><feGaussianBlur stdDeviation="1.2" /></filter>
        <pattern id="signalGrid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="hsl(252 60% 88%)" strokeOpacity="0.18" strokeWidth="0.08" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="100" height="100" fill="url(#signalGrid)" />
      <path d="M8 74 C30 60 37 83 52 58 S75 38 92 31" fill="none" stroke="hsl(160 84% 39%)" strokeOpacity="0.12" strokeWidth="0.35" />
      <path d="M12 35 C32 26 43 48 59 35 S78 20 91 44" fill="none" stroke="hsl(262 83% 58%)" strokeOpacity="0.10" strokeWidth="0.35" />

      {plottedClusters.map((c, i) => (
        <g
          key={c.cluster_id || i}
          className="cursor-grab active:cursor-grabbing"
          role="button"
          tabIndex={0}
          aria-label={`Drag or select ${c.label} cluster`}
          onPointerDown={(event) => startDrag(event, c)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onSelect(c);
          }}
          onMouseEnter={() => setHoveredClusterId(c.cluster_id)}
          onMouseLeave={() => setHoveredClusterId(null)}
        >
          <ellipse
            cx={c.x}
            cy={c.y}
            rx={(selectedClusterId === c.cluster_id ? 19 : 16) * c.depth}
            ry={(selectedClusterId === c.cluster_id ? 13 : 11) * c.depth}
            fill={c.color}
            opacity={selectedClusterId === c.cluster_id || hoveredClusterId === c.cluster_id ? "0.16" : "0.08"}
            filter="url(#premiumGlow)"
          />
        </g>
      ))}

      {edges.map(([a, b], i) => {
        const n1 = nodes[a], n2 = nodes[b];
        if (!n1 || !n2) return null;
        const activeEdge = selectedClusterId && (n1.clusterId === selectedClusterId || n2.clusterId === selectedClusterId);
        return (
          <line
            key={i}
            x1={n1.x}
            y1={n1.y}
            x2={n2.x}
            y2={n2.y}
            stroke={activeEdge ? "hsl(160 84% 39%)" : "hsl(263 44% 42%)"}
            strokeOpacity={activeEdge ? "0.34" : "0.12"}
            strokeWidth={activeEdge ? "0.24" : "0.12"}
          />
        );
      })}

      {nodes.map((n, i) => (
        <g
          key={i}
          className="cursor-pointer"
          onClick={() => {
            const cluster = plottedClusters.find((candidate) => candidate.cluster_id === n.clusterId);
            if (cluster) onSelect(cluster);
          }}
          onMouseEnter={() => setHoveredClusterId(n.clusterId)}
          onMouseLeave={() => setHoveredClusterId(null)}
        >
          <circle
            cx={n.x}
            cy={n.y}
            r={n.size + (selectedClusterId === n.clusterId ? 1.9 : 1.1)}
            fill={n.color}
            opacity={selectedClusterId === n.clusterId || hoveredClusterId === n.clusterId ? "0.18" : "0.08"}
          />
          <circle
            cx={n.x}
            cy={n.y}
            r={selectedClusterId === n.clusterId ? n.size * 1.25 : n.size}
            fill={n.color}
            stroke="hsl(252 100% 98%)"
            strokeWidth={selectedClusterId === n.clusterId ? "0.32" : "0.18"}
            opacity={!selectedClusterId || selectedClusterId === n.clusterId ? "1" : "0.45"}
          />
        </g>
      ))}

      {plottedClusters.map((c, ci) => (
        <g
          key={c.cluster_id || c.label}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(event) => startDrag(event, c)}
          onMouseEnter={() => setHoveredClusterId(c.cluster_id)}
          onMouseLeave={() => setHoveredClusterId(null)}
        >
          <text
            x={c.x}
            y={c.y - 13}
            fontSize={selectedClusterId === c.cluster_id ? "1.82" : "1.58"}
            textAnchor="middle"
            fill={selectedClusterId === c.cluster_id ? "hsl(160 84% 28%)" : "hsl(257 44% 20%)"}
            fontFamily="JetBrains Mono"
            fontWeight={selectedClusterId === c.cluster_id ? "600" : "500"}
            letterSpacing="0.18em"
          >
            {`AUD ${ci + 1} · ${audienceSegmentLabel(c).toUpperCase()}`}
          </text>
        </g>
      ))}
    </svg>
  );
};
