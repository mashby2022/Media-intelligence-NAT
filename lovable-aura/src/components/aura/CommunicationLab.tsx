import { useMemo, useState } from "react";
import {
  Mail, Send, ArrowUpRight, FileCode2, Eye, Paperclip, Loader2, Download,
  Presentation, ScrollText, Save,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { mieClient } from "@/lib/mieClient";
import { exportAuraBrief, downloadBytes } from "@/lib/auraPdf";

type Format = "slides" | "memo";
const FORMATS: { id: Format; label: string; sub: string; Icon: typeof Presentation; meta: string }[] = [
  { id: "slides", label: "Editorial Slide Pack", sub: "12-slide deck · 16:9", Icon: Presentation, meta: "aura-brief-2027.pdf" },
  { id: "memo",   label: "Executive Memo",       sub: "1-page brief · A4",   Icon: ScrollText,   meta: "aura-brief-2027.pdf" },
];

const DEFAULT_TEMPLATE = `<h1>Aura Brief — {{date}}</h1>
<p class="meta">Verdict: <strong>{{verdict}}</strong> · Aura Alignment {{index}}/100</p>

<blockquote>"{{tagline}}"</blockquote>

<h3>Three things you should know</h3>
<ol>
  <li>{{bullet_one}}</li>
  <li>{{bullet_two}}</li>
  <li>{{bullet_three}}</li>
</ol>

<p>— Curated for <em>{{recipient}}</em></p>`;

const SAMPLE = {
  date: "30 April 2026",
  verdict: "Greenlight",
  index: "87",
  tagline: "Soft armour, dawn light.",
  bullet_one: "Concept resonates with The Etherealists (+0.71).",
  bullet_two: "Shift palette toward dawn-lavender.",
  bullet_three: "Pair with podcast adjacencies (+0.62).",
  recipient: "Eloise Marchetti — Chief Brand Officer",
};

const merge = (src: string, vars: Record<string, string>) =>
  src.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? `{{${k}}}`);

export const CommunicationLab = () => {
  const [tpl, setTpl] = useState(DEFAULT_TEMPLATE);
  const [format, setFormat] = useState<Format>("slides");
  const [exporting, setExporting] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("client@example.com");
  const [dispatchSubject, setDispatchSubject] = useState("Aura Brief — 2027 Strategy");
  const [dispatchHtml, setDispatchHtml] = useState<string | null>(null);
  const [dispatchBullets, setDispatchBullets] = useState<string[]>([
    SAMPLE.bullet_one,
    SAMPLE.bullet_two,
    SAMPLE.bullet_three,
  ]);
  const { toast } = useToast();

  const rendered = useMemo(() => {
    if (dispatchHtml) return dispatchHtml;
    const fallbackSample = {
      ...SAMPLE,
      bullet_one: dispatchBullets[0] || SAMPLE.bullet_one,
      bullet_two: dispatchBullets[1] || SAMPLE.bullet_two,
      bullet_three: dispatchBullets[2] || SAMPLE.bullet_three,
    };
    return merge(tpl, fallbackSample);
  }, [tpl, dispatchHtml, dispatchBullets]);
  const activeFormat = FORMATS.find((f) => f.id === format)!;

  const dispatch = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const dispatchResult = await mieClient.dispatchExecutiveBrief([recipientEmail], 5);
      const payload = dispatchResult.result;
      setDispatchSubject(payload.subject);
      setDispatchHtml(payload.html_body);
      setDispatchBullets(payload.bullets || []);

      const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const { filename, bytes } = await exportAuraBrief(format, {
        date: today,
        edition: "Vol. 12 · Edition N°042",
        tagline: SAMPLE.tagline,
        verdict: SAMPLE.verdict as "Greenlight" | "Develop" | "Reconsider",
        alignmentIndex: Number(SAMPLE.index),
        bullets: [SAMPLE.bullet_one, SAMPLE.bullet_two, SAMPLE.bullet_three],
        recipient: SAMPLE.recipient,
        intake: "Resort 2027 — dawn light, soft armour, quiet rebellion.",
      });
      downloadBytes(filename, bytes);
      setDispatched(true);
      setTimeout(() => setDispatched(false), 2400);
      toast({
        title: "Aura Brief dispatched",
        description: `${payload.subject} · ${activeFormat.label} downloaded as ${filename}.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Couldn't generate the brief",
        description: err instanceof Error ? err.message : "Unknown error during PDF export.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="fade-up">
      {/* Masthead */}
      <div className="px-10 pt-12 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-[10px] tracking-couture uppercase text-amethyst mb-3">Suite 02 — Communication</div>
            <h1 className="font-serif text-6xl md:text-7xl text-obsidian leading-[0.95]">
              Communication <span className="italic">Lab.</span>
            </h1>
            <p className="mt-5 max-w-xl text-muted-foreground leading-relaxed">
              Automate intelligence delivery. Author your house template,
              preview the dispatch, and send a magazine-grade brief straight to the client inbox.
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl text-obsidian">04<span className="text-amethyst">/04</span></div>
            <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Templates active</div>
          </div>
        </div>
      </div>

      {/* Two-column: editor + preview */}
      <div className="px-10 pb-8 grid lg:grid-cols-2 gap-6">
        {/* Template editor */}
        <article className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] tracking-couture uppercase text-amethyst flex items-center gap-2">
                <FileCode2 className="h-3 w-3" /> Template Editor
              </div>
              <h3 className="font-serif text-2xl text-obsidian mt-1">Author the voice.</h3>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                Markdown or HTML · merge tags <span className="text-amethyst">{"{{double_braces}}"}</span>
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-obsidian text-white text-[10px] tracking-couture uppercase hover:bg-amethyst transition-colors">
              <Save className="h-3 w-3" /> Save
            </button>
          </div>

          <Textarea
            value={tpl}
            onChange={(e) => setTpl(e.target.value)}
            rows={18}
            spellCheck={false}
            className="mt-5 flex-1 resize-none bg-lavender/40 border-border/60 font-mono text-xs leading-relaxed text-obsidian focus-visible:ring-amethyst/40"
          />

          <div className="mt-4 flex flex-wrap gap-1.5">
            {Object.keys(SAMPLE).map((k) => (
              <span key={k} className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-sky-pale text-amethyst border border-amethyst/20">
                {`{{${k}}}`}
              </span>
            ))}
          </div>
        </article>

        {/* Live preview */}
        <article className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-amethyst" />
              <span className="text-[10px] tracking-couture uppercase text-amethyst">Live Preview</span>
            </div>
            <span className="text-[10px] tracking-couture uppercase text-muted-foreground font-mono normal-case">rendered with sample data</span>
          </div>

          {/* Email envelope */}
          <div className="px-6 py-4 border-b border-border/60 bg-lavender/30">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-amethyst text-white flex items-center justify-center font-serif">A</div>
              <div className="leading-tight">
                <div className="text-xs text-obsidian">
                  <span className="font-medium">Aura Mailroom</span>{" "}
                  <span className="text-muted-foreground font-mono">&lt;curator@aura.intel&gt;</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  to: <span className="text-obsidian">{recipientEmail}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 text-[10px] tracking-couture uppercase text-muted-foreground">
              Subject: <span className="font-serif italic normal-case tracking-normal text-amethyst">{dispatchSubject}</span>
            </div>
          </div>

          {/* Rendered template */}
          <div
            className="flex-1 px-7 py-6 overflow-auto bg-white prose prose-sm max-w-none
                       prose-headings:font-serif prose-h1:text-3xl prose-h1:text-obsidian
                       prose-h3:text-amethyst prose-strong:text-amethyst
                       prose-blockquote:font-serif prose-blockquote:italic prose-blockquote:text-amethyst
                       prose-blockquote:border-l-amethyst
                       prose-li:text-obsidian/90"
            dangerouslySetInnerHTML={{ __html: rendered }}
          />

          <div className="px-6 py-3 border-t border-border/60 flex items-center justify-between bg-white/60 text-[10px] tracking-couture uppercase text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-mono normal-case tracking-normal">
              <Paperclip className="h-3 w-3" /> {activeFormat.meta}
            </span>
            <span className="text-amethyst">draft ready</span>
          </div>
        </article>
      </div>

      {/* Dispatch bar */}
      <div className="px-10 pb-14">
        <div className="rounded-2xl border-iridescent bg-gradient-iridescent/40 p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-ethereal">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/70 border-iridescent flex items-center justify-center">
              <Mail className="h-5 w-5 text-amethyst" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-[10px] tracking-couture uppercase text-amethyst">Automate Intelligence Delivery</div>
              <h3 className="font-serif text-xl text-obsidian">Dispatch — <span className="italic">{SAMPLE.recipient.split(" — ")[0]}</span></h3>
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {activeFormat.label.toLowerCase()} · {activeFormat.sub}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@email.com"
              className="px-3 py-2 rounded-full border border-border/60 bg-white/70 text-xs w-64 focus:outline-none focus:border-amethyst"
            />
            {/* Format toggle */}
            <div className="inline-flex p-1 rounded-full bg-white/70 border border-border/60">
              {FORMATS.map(({ id, label, Icon }) => {
                const active = format === id;
                return (
                  <button
                    key={id}
                    onClick={() => setFormat(id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[10px] tracking-couture uppercase transition-all
                      ${active ? "bg-white text-obsidian shadow-soft" : "text-foreground/60 hover:text-obsidian"}`}
                  >
                    <Icon className="h-3 w-3" strokeWidth={1.5} />
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={dispatch}
              disabled={exporting}
              className="group inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-full bg-gradient-amethyst text-white text-[10px] tracking-couture uppercase shadow-halo hover:scale-[1.02] active:scale-100 transition-transform disabled:opacity-80 disabled:cursor-progress"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : dispatched ? <Download className="h-3.5 w-3.5" />
                : <Send className="h-3.5 w-3.5" />}
              {exporting ? "Composing PDF…" : dispatched ? "Dispatched ✦  ·  Download again" : "Dispatch to Client Inbox"}
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
