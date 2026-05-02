import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuraSidebar } from "@/components/aura/AuraSidebar";
import { mieClient } from "@/lib/mieClient";
import {
  PersonaToggle,
  personaForPath,
  defaultPathForPersona,
  type Persona,
} from "@/components/aura/PersonaToggle";
import { Activity, Cpu, Sparkles } from "lucide-react";

const AuraLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const persona: Persona = personaForPath(pathname);
  const [computeSource, setComputeSource] = useState("Standard Edge Node");
  const [agentStatus, setAgentStatus] = useState("NIM Auto");

  useEffect(() => {
    document.title = "Aura Intelligence — Amethyst Precision Chic";
    const desc = document.querySelector('meta[name="description"]');
    const content =
      "Aura Intelligence: a high-performance data intelligence platform — Miranda the executive agent, the Communication Lab, and the Operator Studio — powered by Polars and NeMo-3-Nano.";
    if (desc) desc.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description"; m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const health = await mieClient.health();
        const source = health?.graph_engine?.compute_source || "Standard Edge Node";
        if (!mounted) return;
        setComputeSource(source);
      } catch {
        if (!mounted) return;
        setComputeSource("Standard Edge Node");
      }
    })();
    const mode = mieClient.config.reasoningMode;
    const model = mieClient.config.reasoningModel;
    setAgentStatus(`NIM ${mode} · ${model}`);
    return () => {
      mounted = false;
    };
  }, []);

  const switchPersona = (p: Persona) => {
    if (p === persona) return;
    navigate(defaultPathForPersona(p));
  };

  return (
    <main className="min-h-screen flex">
      <AuraSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Persona toggle — clear Executive vs Operator switch */}
        <div className="px-10 pt-6 pb-0 flex items-center justify-between gap-4 border-b border-border/40">
          <div className="flex items-center gap-3 text-[10px] tracking-couture uppercase text-muted-foreground">
            <span className="hidden sm:inline">Viewing as</span>
            <PersonaToggle persona={persona} onChange={switchPersona} />
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] tracking-couture uppercase text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-amethyst halo-pulse" />
            <span>{persona === "executive" ? "In-Box Mode" : "Quant Mode"}</span>
          </div>
        </div>

        {/* Routed page */}
        <div key={pathname} className="flex-1">
          <Outlet />
        </div>

        {/* Technical Status Bar */}
        <footer className="border-t border-border/60 bg-white/60 backdrop-blur-md">
          <div className="px-10 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[10px] tracking-couture uppercase text-muted-foreground">
            <div className="flex items-center gap-5">
              <span className="inline-flex items-center gap-2">
                <Cpu className="h-3 w-3 text-amethyst" />
                Backend: <span className="text-obsidian">{computeSource}</span>
              </span>
              <span className="hidden md:inline-flex items-center gap-2 font-mono normal-case tracking-normal">
                <Activity className="h-3 w-3 text-amethyst" />
                latency <span className="text-obsidian">0.02ms</span>
              </span>
              <span className="hidden lg:inline-flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-amethyst" />
                Agent Status:
                <span className="text-obsidian">{agentStatus}</span>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amethyst opacity-70 halo-pulse" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amethyst" />
                </span>
                Active
              </span>
            </div>
            <span className="italic font-serif normal-case tracking-normal text-obsidian/70 hidden sm:block">
              "A luxurious second opinion, distilled from eleven million signals."
            </span>
            <span className="text-amethyst">© MMXXVI</span>
          </div>
        </footer>
      </div>
    </main>
  );
};

export default AuraLayout;
