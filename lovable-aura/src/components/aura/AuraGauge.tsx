interface Props {
  value: number; // 0-100
  label?: string;
}

export const AuraGauge = ({ value, label = "Aura Alignment Index" }: Props) => {
  const size = 220;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="iridescent-gauge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="hsl(232 70% 80%)" />
            <stop offset="35%" stopColor="hsl(263 60% 75%)" />
            <stop offset="70%" stopColor="hsl(199 80% 80%)" />
            <stop offset="100%" stopColor="hsl(280 60% 80%)" />
          </linearGradient>
          <filter id="gauge-glow"><feGaussianBlur stdDeviation="2" /></filter>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(252 60% 92%)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke="url(#iridescent-gauge)" strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)" }}
        />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke="url(#iridescent-gauge)" strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          opacity="0.45" filter="url(#gauge-glow)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[9px] tracking-couture uppercase text-muted-foreground">Aura Alignment</div>
        <div className="font-serif text-6xl text-obsidian leading-none mt-2">{value}</div>
        <div className="text-[10px] tracking-couture uppercase text-amethyst mt-2">/ 100 · Index</div>
      </div>
    </div>
  );
};