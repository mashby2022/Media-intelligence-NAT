import { Telescope, Cpu } from "lucide-react";

export type Persona = "executive" | "operator";

interface Props {
  persona: Persona;
  onChange: (p: Persona) => void;
}

export const personaForPath = (pathname: string): Persona =>
  pathname.startsWith("/operator") || pathname.startsWith("/demo") ? "operator" : "executive";

export const defaultPathForPersona = (p: Persona): string =>
  p === "operator" ? "/operator" : "/";

const PERSONAS: {
  id: Persona;
  label: string;
  sub: string;
  Icon: typeof Telescope;
}[] = [
  { id: "executive", label: "Executive",  sub: "Low-friction · in-box ready", Icon: Telescope },
  { id: "operator",  label: "Operator",   sub: "Granular · quant studio",     Icon: Cpu },
];

export const PersonaToggle = ({ persona, onChange }: Props) => {
  return (
    <div className="inline-flex items-stretch p-1 rounded-full bg-white/70 border-iridescent shadow-soft backdrop-blur-md">
      {PERSONAS.map(({ id, label, sub, Icon }) => {
        const active = persona === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`group relative inline-flex items-center gap-3 pl-3 pr-5 py-2 rounded-full transition-all
              ${active
                ? "bg-gradient-amethyst text-white shadow-halo"
                : "text-foreground/60 hover:text-obsidian"}`}
          >
            <span className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors
              ${active ? "bg-white/20" : "bg-secondary"}`}>
              <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : "text-amethyst"}`} strokeWidth={1.6} />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[10px] tracking-couture uppercase">{label}</span>
              <span className={`block text-[9px] normal-case tracking-normal font-mono ${active ? "text-white/70" : "text-muted-foreground"}`}>
                {sub}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
