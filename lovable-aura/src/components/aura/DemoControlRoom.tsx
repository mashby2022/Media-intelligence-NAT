import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Gauge,
  MailCheck,
  Network,
  Play,
  PlugZap,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { mieClient, type DatasetInventoryResult, type DemoReadinessResult, type DemoWorkflowRunResult, type HealthResult, type PublicConfigResult } from "@/lib/mieClient";

type ContractResult = {
  routes?: Record<string, { method?: string; path?: string; response_model?: string }>;
};

const PHASE_LABELS: Record<string, string> = {
  phase_1_operational_trust: "Operational Trust",
  phase_2_agentic_orchestration: "Agentic Orchestration",
  phase_3_dynamic_knowledge: "Dynamic Knowledge",
  phase_4_dispatch_loop: "Dispatch Loop",
};

const phaseOrder = [
  "phase_1_operational_trust",
  "phase_2_agentic_orchestration",
  "phase_3_dynamic_knowledge",
  "phase_4_dispatch_loop",
];

const ARCHITECTURE_STEPS = [
  {
    label: "Data Foundation",
    path: "/demo",
    talk: "Structured portfolio, market, graph, and historical-memory evidence are normalized into a shared insight package.",
  },
  {
    label: "NAT Orchestration",
    path: "/",
    talk: "NAT coordinates intake, tool calls, memory lookup, reasoning trace, operator handoff, and dispatch.",
  },
  {
    label: "Nemotron Reasoning",
    path: "/",
    talk: "Nemotron Nano 9B v2 is the live reasoning adapter for concise, low-latency executive synthesis.",
  },
  {
    label: "Operator Evidence",
    path: "/operator",
    talk: "Analysts can validate the brief through portfolio assets, filters, clusters, and traceable evidence.",
  },
  {
    label: "Persona Outputs",
    path: "/communication",
    talk: "The same result set becomes an executive inbox brief or an operator workspace without separate backends.",
  },
];

const MODEL_RATIONALE = [
  {
    label: "NAT",
    choice: "Workflow orchestration",
    reason: "Coordinates the workflow rather than just answering a prompt.",
  },
  {
    label: "Nemotron Nano 9B v2",
    choice: "Live reasoning model",
    reason: "Handles fast executive synthesis with a repeatable brief shape.",
  },
  {
    label: "Polars",
    choice: "Tabular evidence layer",
    reason: "Prepares portfolio scoring, filtering, and evidence packages quickly.",
  },
  {
    label: "RAPIDS",
    choice: "Optional acceleration",
    reason: "Shows the enterprise acceleration path when GPU is available.",
  },
];

const AGENTIC_COMPLEXITY = [
  {
    label: "Asset Intake",
    detail: "Scripts and concepts arrive from drives, submissions, reports, and internal trackers.",
  },
  {
    label: "Signal Assembly",
    detail: "Audience behavior, market momentum, cultural signals, and comps need to be joined.",
  },
  {
    label: "Decision Framing",
    detail: "Executives need a clear greenlight recommendation, not another dashboard to interpret.",
  },
  {
    label: "Delivery Loop",
    detail: "The final insight has to become an email, memo, or workflow artifact without rework.",
  },
];

const NAT_CAPABILITIES = [
  "Agents",
  "Tool Execution",
  "Memory",
  "Retrieval",
  "Guardrails",
  "Model Interfaces",
  "Evaluation",
  "Observability",
  "Profiling",
];

const NAT_FRAMEWORKS = ["Custom Python workflow", "FastAPI routes"];

function formatLatency(value?: number | null): string {
  return typeof value === "number" ? `${value.toFixed(1)}ms` : "unavailable";
}

function statusTone(ready?: boolean): string {
  return ready ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200";
}

function statusDot(ready?: boolean): string {
  return ready ? "bg-emerald-500" : "bg-amber-500";
}

function formatBytes(value?: number): string {
  if (typeof value !== "number") return "unknown";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unit = units[0];
  for (let index = 1; size >= 1024 && index < units.length; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}

export function DemoControlRoom() {
  const [readiness, setReadiness] = useState<DemoReadinessResult | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfigResult | null>(null);
  const [datasetInventory, setDatasetInventory] = useState<DatasetInventoryResult | null>(null);
  const [contract, setContract] = useState<ContractResult | null>(null);
  const [workflow, setWorkflow] = useState<DemoWorkflowRunResult | null>(null);
  const [lastSync, setLastSync] = useState<string>("not checked");
  const [loading, setLoading] = useState(true);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [adapterProvider, setAdapterProvider] = useState("openai-compatible");
  const [adapterModel, setAdapterModel] = useState("customer-hosted-reasoner");
  const [adapterPreview, setAdapterPreview] = useState<Awaited<ReturnType<typeof mieClient.previewModelSwitch>> | null>(null);
  const [adapterLoading, setAdapterLoading] = useState(false);
  const [adapterError, setAdapterError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextReadiness, nextHealth, nextPublicConfig, nextContract] = await Promise.all([
        mieClient.demoReadiness(),
        mieClient.health(),
        mieClient.publicConfig(),
        mieClient.frontendContract() as Promise<ContractResult>,
      ]);
      const nextDatasets = await mieClient.datasets().catch(() => null);
      setReadiness(nextReadiness);
      setHealth(nextHealth);
      setPublicConfig(nextPublicConfig);
      setDatasetInventory(nextDatasets);
      setContract(nextContract);
      setLastSync(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach backend readiness checks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runWorkflow = useCallback(async () => {
    setWorkflowLoading(true);
    setWorkflowError(null);
    try {
      const payload = await mieClient.demoWorkflowRun();
      setWorkflow(payload);
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : "Unable to run the customer workflow simulation.");
    } finally {
      setWorkflowLoading(false);
    }
  }, []);

  const previewAdapterSwitch = useCallback(async () => {
    setAdapterLoading(true);
    setAdapterError(null);
    try {
      const payload = await mieClient.previewModelSwitch({
        provider: adapterProvider,
        model: adapterModel,
        authMode: "customer_managed",
        purpose: "executive_brief",
      });
      setAdapterPreview(payload);
    } catch (err) {
      setAdapterError(err instanceof Error ? err.message : "Unable to preview model adapter switch.");
    } finally {
      setAdapterLoading(false);
    }
  }, [adapterModel, adapterProvider]);

  const phases = readiness?.phases || {};
  const readyPhases = Object.values(phases).filter((phase) => phase.ready).length;
  const totalPhases = Object.values(phases).length || 4;
  const allReady = readiness?.status === "ready";
  const routeEntries = useMemo(
    () => Object.entries(contract?.routes || {}).sort(([a], [b]) => a.localeCompare(b)),
    [contract?.routes],
  );
  const ops = health?.ops;
  const nimReady = Boolean(ops?.nim?.configured);
  const graphReady = Boolean(ops?.graph?.standard_available || ops?.graph?.accelerated_available);
  const polarsReady = typeof ops?.polars?.latency_ms === "number";
  const knowledgeReady = Boolean(phases.phase_3_dynamic_knowledge?.ready);
  const dispatchReady = Boolean(phases.phase_4_dispatch_loop?.ready);
  const datasetEntries = Object.entries(publicConfig?.datasets || {});
  const missingEntries = Object.entries(publicConfig?.missing || {}).flatMap(([group, items]) =>
    (items || []).map((item) => `${group}: ${item}`),
  );
  const checks = [
    {
      label: "Backend",
      value: health?.status === "ok" ? "connected" : "offline",
      ready: health?.status === "ok",
      detail: health?.data_dir || "data",
      Icon: Activity,
    },
    {
      label: "Nemotron",
      value: nimReady ? ops?.nim?.mode || "configured" : "fallback",
      ready: nimReady,
      detail: `NIM alias ${mieClient.config.reasoningModel}`,
      Icon: Sparkles,
    },
    {
      label: "Polars",
      value: formatLatency(ops?.polars?.latency_ms),
      ready: polarsReady,
      detail: ops?.polars?.compute_source || "Standard Edge Node",
      Icon: Gauge,
    },
    {
      label: "Graph",
      value: ops?.graph?.active_engine || "unavailable",
      ready: graphReady,
      detail: ops?.graph?.compute_source || "not detected",
      Icon: Network,
    },
    {
      label: "Knowledge",
      value: knowledgeReady ? `${phases.phase_3_dynamic_knowledge?.knowledge_items || 0} items` : "degraded",
      ready: knowledgeReady,
      detail: `${phases.phase_3_dynamic_knowledge?.clusters || 0} clusters`,
      Icon: Database,
    },
    {
      label: "Dispatch",
      value: phases.phase_4_dispatch_loop?.dispatch_status || "not checked",
      ready: dispatchReady,
      detail: `${phases.phase_4_dispatch_loop?.artifacts?.length || 0} artifacts`,
      Icon: MailCheck,
    },
  ];

  return (
    <section className="px-6 md:px-10 py-8 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] tracking-couture uppercase text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            NAT + Nemotron Demo
          </div>
          <h1 className="mt-4 font-serif text-4xl md:text-5xl text-obsidian">NAT Executive Briefing Agent</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            The demo foregrounds NVIDIA NeMo Agent Toolkit orchestration and Nemotron reasoning.
            Polars and RAPIDS sit underneath as the evidence-processing and acceleration layer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] tracking-couture uppercase ${statusTone(allReady)}`}>
            <span className={`h-2 w-2 rounded-full ${statusDot(allReady)}`} />
            {readiness?.status || "checking"} · {readyPhases}/{totalPhases} phases
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-white/75 px-3 py-2 text-[10px] tracking-couture uppercase text-obsidian shadow-soft transition-colors hover:bg-white disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-lg border border-border/70 bg-white/75 p-5 shadow-soft">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-obsidian">The Studio Problem: Insight Does Not Travel Cleanly</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              Studios already have assets, audience data, and internal expertise. The gap is a repeatable
              workflow that carries evidence from analysis to executive action.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] tracking-couture uppercase text-emerald-700">
            Agentic studio workflow
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {AGENTIC_COMPLEXITY.map((item) => (
            <div key={item.label} className="rounded-md border border-border/70 bg-white/65 p-4">
              <div className="text-[10px] tracking-couture uppercase text-emerald-700">{item.label}</div>
              <div className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-emerald-300 bg-gradient-mint px-5 py-5 shadow-soft">
          <div className="text-[10px] tracking-couture uppercase text-emerald-700">Demo Thesis</div>
          <div className="mt-2 max-w-5xl text-xl font-semibold leading-snug text-obsidian">
            NAT + Nemotron turns scattered studio evidence into an observable agent run.
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {["Tool calls", "Evidence package", "Reasoning trace", "Inbox-ready output"].map((item) => (
              <div key={item} className="rounded-md border border-emerald-200 bg-white/70 px-3 py-2 text-[10px] tracking-couture uppercase text-emerald-800">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/45 p-5 shadow-soft">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-obsidian">NeMo Agent Toolkit Control Plane</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-emerald-900/70">
              In this demo, NeMo Agent Toolkit is the orchestration layer: it sits above the Python workflow,
              coordinates tools and reasoning, and keeps model choice, evaluation, and observability explicit.
            </p>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] tracking-couture uppercase text-emerald-700">
            framework agnostic
          </span>
        </div>

        <div className="mt-5 rounded-lg border border-emerald-200 bg-white/80 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_1.25fr_1fr]">
            <div className="rounded-md border border-border/70 bg-white/75 p-4">
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Input Surfaces</div>
              <div className="mt-3 space-y-2 text-xs text-obsidian">
                <div className="rounded bg-secondary px-3 py-2">Executive question</div>
                <div className="rounded bg-secondary px-3 py-2">Operator validation</div>
                <div className="rounded bg-secondary px-3 py-2">Template dispatch</div>
              </div>
            </div>

            <div className="rounded-md border border-emerald-300 bg-emerald-600 p-4 text-white shadow-soft">
              <div className="text-center text-[10px] tracking-couture uppercase text-white/80">
                NVIDIA NeMo Agent Toolkit
              </div>
              <div className="mt-3 rounded-md bg-white/15 px-4 py-3 text-center text-sm font-semibold">
                Optimized Agentic Application
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                {NAT_CAPABILITIES.map((capability) => (
                  <div key={capability} className="rounded bg-white/15 px-2 py-2 text-center text-[10px] leading-4">
                    {capability}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-white/75 p-4">
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Output Surfaces</div>
              <div className="mt-3 space-y-2 text-xs text-obsidian">
                <div className="rounded bg-secondary px-3 py-2">Greenlight brief</div>
                <div className="rounded bg-secondary px-3 py-2">Evidence workspace</div>
                <div className="rounded bg-secondary px-3 py-2">Inbox-ready artifact</div>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
            <div className="rounded-md border border-border/70 bg-white/75 p-3">
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Reasoning</div>
              <div className="mt-1 font-mono text-xs text-obsidian">Nemotron Nano 9B v2 via NIM</div>
              <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
                Fast executive synthesis with a stable greenlight-brief shape.
              </div>
            </div>
            <div className="rounded-md border border-border/70 bg-white/75 p-3">
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Demo Runtime Layer</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {NAT_FRAMEWORKS.map((framework) => (
                  <span key={framework} className="rounded-full bg-secondary px-2 py-1 text-[9px] tracking-couture uppercase text-muted-foreground">
                    {framework}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
                Simple local runtime now, reusable adapter boundary later.
              </div>
            </div>
            <div className="rounded-md border border-border/70 bg-white/75 p-3">
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Evidence Layer</div>
              <div className="mt-1 font-mono text-xs text-obsidian">Polars now · RAPIDS path when GPU is available</div>
              <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
                Fast tabular preparation with a credible GPU acceleration path.
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {MODEL_RATIONALE.map((item) => (
              <div key={item.label} className="rounded-md border border-border/70 bg-white/75 p-3">
                <div className="text-[10px] tracking-couture uppercase text-amethyst">{item.label}</div>
                <div className="mt-1 text-xs font-semibold text-obsidian">{item.choice}</div>
                <div className="mt-2 text-[11px] leading-5 text-muted-foreground">{item.reason}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-white/75 p-5 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-obsidian">Architecture Walkthrough</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Follow the shared insight package from evidence preparation through NAT orchestration, Nemotron reasoning,
              operator validation, and executive dispatch.
            </p>
          </div>
          <div className="rounded-full bg-secondary px-3 py-1.5 text-[10px] tracking-couture uppercase text-muted-foreground">
            shared insight path
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {ARCHITECTURE_STEPS.map((step, index) => (
            <Link
              key={step.label}
              to={step.path}
              className="rounded-md border border-border/70 bg-white/65 p-3 transition-colors hover:bg-white"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-amethyst">{String(index + 1).padStart(2, "0")}</span>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="mt-2 text-sm font-medium text-obsidian">{step.label}</div>
              <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{step.talk}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-white/75 p-5 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-obsidian">Current Datasets</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              These are the local evidence datasets currently available to Miranda and the operator workspace.
              Download exports are generated from the backend allowlist, not arbitrary file paths.
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-[10px] tracking-couture uppercase text-muted-foreground">
            {datasetInventory?.count ?? 0} files · {datasetInventory?.data_dir || "data"}
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-white/60">
          <div className="grid grid-cols-[1.35fr_0.45fr_0.45fr_0.45fr_1fr] gap-3 border-b border-border/60 px-4 py-3 text-[10px] tracking-couture uppercase text-muted-foreground">
            <span>Dataset</span>
            <span>Rows</span>
            <span>Columns</span>
            <span>Size</span>
            <span>Download</span>
          </div>
          <div className="divide-y divide-border/60">
            {(datasetInventory?.items || []).map((item) => (
              <div key={item.dataset_id} className="grid grid-cols-[1.35fr_0.45fr_0.45fr_0.45fr_1fr] gap-3 px-4 py-3 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium text-obsidian">{item.filename}</div>
                  <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                    {item.format.toUpperCase()} · {(item.columns || []).slice(0, 4).join(", ")}
                  </div>
                </div>
                <div className="font-mono text-obsidian">{typeof item.rows === "number" ? item.rows.toLocaleString() : "--"}</div>
                <div className="font-mono text-obsidian">{item.column_count ?? "--"}</div>
                <div className="font-mono text-muted-foreground">{formatBytes(item.size_bytes)}</div>
                <div className="flex flex-wrap gap-1.5">
                  {item.download_formats.map((format) => (
                    <a
                      key={`${item.dataset_id}-${format}`}
                      href={mieClient.datasetDownloadUrl(item.dataset_id, format)}
                      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-white px-2 py-1 text-[9px] tracking-couture uppercase text-obsidian transition-colors hover:border-amethyst hover:text-amethyst"
                    >
                      <Download className="h-3 w-3" />
                      {format}
                    </a>
                  ))}
                </div>
              </div>
            ))}
            {!datasetInventory?.items?.length && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Dataset inventory is unavailable. Confirm the backend is running on {mieClient.config.apiBase}.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {checks.map(({ label, value, detail, ready, Icon }) => (
          <div key={label} className="rounded-lg border border-border/70 bg-white/75 p-4 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] tracking-couture uppercase text-muted-foreground">{label}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-md ${ready ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-700"}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 min-h-8 font-mono text-sm text-obsidian break-words">{value}</div>
            <div className="mt-1 text-[10px] tracking-couture uppercase text-muted-foreground break-words">{detail}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border/70 bg-white/75 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl text-obsidian">Phase Readiness</h2>
              <p className="mt-1 text-xs text-muted-foreground">Current status from `/demo/readiness`.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-[10px] tracking-couture uppercase text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {lastSync}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {phaseOrder.map((key, index) => {
              const phase = phases[key];
              const ready = Boolean(phase?.ready);
              return (
                <div key={key} className="rounded-md border border-border/70 bg-white/65 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-md font-mono text-xs ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-obsidian">{PHASE_LABELS[key] || key}</div>
                        <div className="text-[10px] tracking-couture uppercase text-muted-foreground">
                          {ready ? "ready" : "needs attention"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] tracking-couture uppercase">
                      {phase?.polars_latency_ms !== undefined && <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">lat {formatLatency(phase.polars_latency_ms)}</span>}
                      {phase?.graph_engine && <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{phase.graph_engine}</span>}
                      {phase?.trace_events !== undefined && <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{phase.trace_events} trace events</span>}
                      {phase?.memory_matches !== undefined && <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{phase.memory_matches} memory matches</span>}
                      {phase?.knowledge_items !== undefined && <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{phase.knowledge_items} knowledge items</span>}
                      {phase?.dispatch_status && <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{phase.dispatch_status}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border/70 bg-white/75 p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl text-obsidian">Bring Your Own Model</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  The live demo stays on Nemotron Nano 9B v2, while NAT treats the reasoner as a swappable adapter.
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-emerald-600" />
            </div>

            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/70 p-3">
              <div className="text-[10px] tracking-couture uppercase text-emerald-700">Active Runtime</div>
              <div className="mt-1 font-mono text-xs text-obsidian break-words">
                {publicConfig?.model_adapters?.active_adapter?.model || "nvidia/nvidia-nemotron-nano-9b-v2"}
              </div>
              <div className="mt-2 text-xs leading-5 text-emerald-900/75">
                {publicConfig?.model_adapters?.active_adapter?.reason || "Nemotron Nano remains the default live model for the demo."}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
              <label className="block">
                <span className="text-[10px] tracking-couture uppercase text-muted-foreground">Provider</span>
                <input
                  value={adapterProvider}
                  onChange={(event) => setAdapterProvider(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-white/70 px-3 py-2 font-mono text-xs text-obsidian outline-none focus:border-emerald-400"
                />
              </label>
              <label className="block">
                <span className="text-[10px] tracking-couture uppercase text-muted-foreground">Model Identifier</span>
                <input
                  value={adapterModel}
                  onChange={(event) => setAdapterModel(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-white/70 px-3 py-2 font-mono text-xs text-obsidian outline-none focus:border-emerald-400"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void previewAdapterSwitch()}
                disabled={adapterLoading}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-white/75 px-3 py-2 text-[10px] tracking-couture uppercase text-obsidian shadow-soft transition-colors hover:bg-white disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${adapterLoading ? "animate-spin" : ""}`} />
                Preview Switch
              </button>
              <span className="text-[10px] tracking-couture uppercase text-muted-foreground">Preview only · no secrets stored · runtime unchanged</span>
            </div>

            {adapterError && (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{adapterError}</div>
            )}

            {adapterPreview && (
              <div className="mt-4 rounded-md border border-border/70 bg-white/65 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-[9px] tracking-couture uppercase ${adapterPreview.status === "preview_ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {adapterPreview.status}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-1 text-[9px] tracking-couture uppercase text-muted-foreground">
                    runtime {adapterPreview.active_runtime_unchanged ? "unchanged" : "changed"}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[9px] tracking-couture uppercase ${adapterPreview.secrets_exposed ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                    secrets {adapterPreview.secrets_exposed ? "exposed" : "hidden"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs">
                  {Object.entries(adapterPreview.workflow_impact || {}).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[150px_1fr] gap-3">
                      <span className="font-mono text-muted-foreground">{key}</span>
                      <span className="text-obsidian">{value}</span>
                    </div>
                  ))}
                </div>
                {Boolean(adapterPreview.warnings?.length) && (
                  <div className="mt-3 text-xs leading-5 text-amber-700">
                    {adapterPreview.warnings?.join(" ")}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border/70 bg-white/75 p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl text-obsidian">Deployment Connection</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Frontend-safe config for Lovable, ngrok, CORS, NIM, and datasets.
                </p>
              </div>
              <PlugZap className="h-4 w-4 text-emerald-600" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                { label: "Lovable", value: publicConfig?.deployment?.lovable_supported ? "supported" : "check", ready: publicConfig?.deployment?.lovable_supported },
                { label: "ngrok", value: publicConfig?.deployment?.ngrok_supported ? "supported" : "check", ready: publicConfig?.deployment?.ngrok_supported },
                { label: "CORS Origins", value: String(publicConfig?.deployment?.cors_origin_count || 0), ready: Boolean(publicConfig?.deployment?.cors_origin_count) },
                { label: "Nemotron Timeout", value: `${publicConfig?.reasoning?.timeout_sec || 25}s`, ready: true },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-border/70 bg-white/65 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] tracking-couture uppercase text-muted-foreground">{item.label}</span>
                    <span className={`h-2 w-2 rounded-full ${statusDot(Boolean(item.ready))}`} />
                  </div>
                  <div className="mt-2 font-mono text-xs text-obsidian">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-md border border-border/70 bg-white/65 p-3">
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Dataset Availability</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {datasetEntries.map(([name, exists]) => (
                  <span key={name} className={`rounded-full px-2 py-1 text-[9px] tracking-couture uppercase ${exists ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {name}
                  </span>
                ))}
                {!datasetEntries.length && <span className="text-xs text-muted-foreground">No dataset status loaded.</span>}
              </div>
            </div>

            <div className="mt-3 rounded-md border border-border/70 bg-white/65 p-3">
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Allowed Frontend Origins</div>
              <div className="mt-2 max-h-24 overflow-auto font-mono text-[10px] leading-5 text-muted-foreground">
                {(publicConfig?.deployment?.explicit_origins || []).map((origin) => (
                  <div key={origin}>{origin}</div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] tracking-couture uppercase">
              <span className={`rounded-full px-2 py-1 ${publicConfig?.reasoning?.nim_configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                Nemotron {publicConfig?.reasoning?.mode || "checking"}
              </span>
              <span className={`rounded-full px-2 py-1 ${publicConfig?.secrets_exposed ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                Secrets {publicConfig?.secrets_exposed ? "exposed" : "hidden"}
              </span>
              {missingEntries.slice(0, 3).map((item) => (
                <span key={item} className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{item}</span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-white/75 p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl text-obsidian">Customer Workflow Run</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  One simulated autonomous run across intake, Miranda, operator evidence, and dispatch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void runWorkflow()}
                disabled={workflowLoading}
                className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] tracking-couture uppercase text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Run
              </button>
            </div>

            {workflowError && (
              <div className="mt-4 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{workflowError}</span>
              </div>
            )}

            <div className="mt-4 rounded-md border border-border/70 bg-white/65 p-4">
              <div className="grid gap-3 text-xs md:grid-cols-3">
                <div>
                  <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Shared Asset</div>
                  <div className="mt-1 font-mono text-obsidian break-words">{workflow?.shared_asset_id || "not run"}</div>
                </div>
                <div>
                  <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Dispatch</div>
                  <div className="mt-1 text-obsidian">{workflow?.surfaces?.executive_email?.status || "pending"}</div>
                </div>
                <div>
                  <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Trace</div>
                  <div className="mt-1 text-obsidian">{workflow?.shared_insight_package?.reasoning_trace?.length || 0} events</div>
                </div>
              </div>
              {workflow?.shared_insight_package?.headline && (
                <div className="mt-4 border-t border-border/60 pt-3">
                  <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Executive Headline</div>
                  <div className="mt-1 text-sm text-obsidian">{workflow.shared_insight_package.headline}</div>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {(workflow?.timeline || []).map((event, index) => (
                <div key={`${event.step_id || index}-${event.time || "time"}`} className="grid grid-cols-[64px_1fr] gap-3 rounded-md border border-border/60 bg-white/60 px-3 py-2">
                  <div className="font-mono text-[10px] text-muted-foreground">{event.time || "now"}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-obsidian">{event.label || event.step_id}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] tracking-couture uppercase ${event.status === "complete" || event.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {event.status || "running"}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] tracking-couture uppercase text-muted-foreground">{event.actor}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{event.detail}</div>
                  </div>
                </div>
              ))}
              {!workflow && (
                <div className="rounded-md border border-dashed border-border bg-white/40 px-3 py-4 text-xs text-muted-foreground">
                  Run the simulation to confirm one shared insight package powers all persona surfaces.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-white/75 p-5 shadow-soft">
            <h2 className="font-serif text-2xl text-obsidian">Demo Paths</h2>
            <div className="mt-4 grid gap-2">
              {[
                { to: "/", label: "Miranda Executive", sub: "autonomous intake and agent trace" },
                { to: "/operator", label: "Operator Workspace", sub: "portfolio logic matrix and knowledge map" },
                { to: "/communication", label: "Communication Lab", sub: "template injection and auto-verify dispatch" },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex items-center justify-between gap-3 rounded-md border border-border/70 bg-white/65 px-4 py-3 transition-colors hover:bg-white"
                >
                  <span>
                    <span className="block text-sm text-obsidian">{item.label}</span>
                    <span className="block text-[10px] tracking-couture uppercase text-muted-foreground">{item.sub}</span>
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 opacity-70 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-white/75 p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl text-obsidian">Route Contract</h2>
              <Route className="h-4 w-4 text-amethyst" />
            </div>
            <div className="mt-4 max-h-[320px] overflow-auto pr-1">
              <div className="space-y-2">
                {routeEntries.map(([name, route]) => (
                  <div key={name} className="grid grid-cols-[72px_1fr] gap-3 rounded-md border border-border/60 bg-white/60 px-3 py-2 text-xs">
                    <span className="font-mono text-[10px] uppercase text-amethyst">{route?.method || "GET"}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-obsidian">{route?.path || name}</span>
                      <span className="block truncate text-[10px] tracking-couture uppercase text-muted-foreground">{name}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-white/75 px-5 py-4 shadow-soft">
        <div className="grid gap-3 text-[10px] tracking-couture uppercase text-muted-foreground md:grid-cols-4">
          <span>API Base: <span className="font-mono normal-case tracking-normal text-obsidian">{mieClient.config.apiBase}</span></span>
          <span>Brand: <span className="text-obsidian">{mieClient.config.brand}</span></span>
          <span>Reasoning: <span className="text-obsidian">{mieClient.config.reasoningMode} · {mieClient.config.reasoningModel}</span></span>
          <span>Secrets: <span className={readiness?.secrets_exposed ? "text-rose-600" : "text-emerald-600"}>{readiness?.secrets_exposed ? "exposed" : "not exposed"}</span></span>
        </div>
      </div>
    </section>
  );
}
