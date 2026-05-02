import { Sparkles, Telescope, Mailbox, Cpu } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

type Persona = "Executive" | "Operator";
const items: { to: string; label: string; sub: string; persona: Persona; badge?: string; Icon: typeof Telescope }[] = [
  { to: "/",              label: "Miranda",            sub: "Executive agent · home",  persona: "Executive", badge: "agent", Icon: Telescope },
  { to: "/communication", label: "Communication Lab",  sub: "Template & dispatch",     persona: "Executive", Icon: Mailbox },
  { to: "/operator",      label: "Neural Settings",    sub: "Quant studio",            persona: "Operator",  Icon: Cpu },
];

export const AuraSidebar = () => {
  const { pathname } = useLocation();
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <aside className="w-[260px] shrink-0 hidden md:flex flex-col border-r border-border/60 glass">
      {/* Brand */}
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-full bg-gradient-pulse flex items-center justify-center shadow-halo float-soft">
            <Sparkles className="h-4 w-4 text-amethyst" strokeWidth={1.4} />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-xl text-obsidian">Aura</div>
            <div className="text-[9px] tracking-couture uppercase text-muted-foreground">Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-1">
        {(["Executive", "Operator"] as Persona[]).map((persona) => {
          const group = items.filter((it) => it.persona === persona);
          const tone =
            persona === "Executive"
              ? "text-amethyst"
              : "text-periwinkle";
          return (
            <div key={persona} className="pb-3">
              <div className="px-3 pt-2 pb-2 flex items-center gap-2">
                <span className={`h-1 w-3 rounded-full ${persona === "Executive" ? "bg-amethyst" : "bg-periwinkle"}`} />
                <span className={`text-[9px] tracking-couture uppercase ${tone}`}>{persona}</span>
              </div>
              {group.map(({ to, label, sub, badge, Icon }) => {
                const active = isActive(to);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={`group w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all relative
                      ${active
                        ? "bg-white/80 shadow-soft border-iridescent text-obsidian"
                        : "text-foreground/70 hover:text-obsidian hover:bg-white/50"}`}
                  >
                    <span className={`h-9 w-9 rounded-md flex items-center justify-center transition-colors
                      ${active
                        ? "bg-gradient-amethyst text-white"
                        : persona === "Executive" ? "bg-secondary text-amethyst" : "bg-sky-pale text-periwinkle"}`}>
                      <Icon className="h-4 w-4" strokeWidth={1.4} />
                    </span>
                    <span className="flex-1 text-left">
                      <span className="block text-sm font-medium font-serif flex items-center gap-2">
                        {label}
                        {badge && (
                          <span className="text-[8px] tracking-couture uppercase px-1.5 py-0.5 rounded-full bg-amethyst/10 text-amethyst font-sans">
                            {badge}
                          </span>
                        )}
                      </span>
                      <span className="block text-[10px] tracking-couture uppercase text-muted-foreground">{sub}</span>
                    </span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-amethyst halo-pulse" />}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Polars engine status — anchored bottom */}
      <div className="mt-auto p-4">
        <div className="rounded-xl border-iridescent bg-white/70 p-4 shadow-glass">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amethyst opacity-70 halo-pulse" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amethyst" />
              </span>
              <span className="text-[9px] tracking-couture uppercase text-amethyst">Polars Engine</span>
            </div>
            <span className="text-[9px] tracking-couture uppercase text-muted-foreground">live</span>
          </div>
          <div className="mt-2 font-mono text-base text-obsidian leading-tight">1.6M</div>
          <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Edges Active</div>
          <div className="mt-3 h-1 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full w-[78%] bg-gradient-amethyst" />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>lat 0.02ms</span>
            <span className="text-periwinkle">NeMo-3-Nano</span>
          </div>
        </div>
      </div>
    </aside>
  );
};