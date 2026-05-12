import { useMemo, useState } from "react";
import {
  Mail, Send, ArrowUpRight, FileCode2, Eye, Paperclip, Loader2,
  Presentation, ScrollText, Save, ShieldCheck, Library, CheckCircle2,
  Bot, Inbox, ClipboardCheck,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { mieClient } from "@/lib/mieClient";
import { exportAuraBrief, downloadBytes } from "@/lib/auraPdf";

type Format = "slides" | "memo";
type DispatchProof = {
  subject: string;
  recipients: string[];
  status?: string;
  autoVerified?: boolean;
  timestamp: string;
  artifacts: Array<{ format?: string; filename?: string; status?: string; auto_generated?: boolean }>;
};

const FORMATS: { id: Format; label: string; sub: string; Icon: typeof Presentation; meta: string }[] = [
  { id: "slides", label: "Editorial Slide Pack", sub: "12-slide deck · 16:9", Icon: Presentation, meta: "aura-brief-2027.pdf" },
  { id: "memo",   label: "Executive Memo",       sub: "1-page brief · A4",   Icon: ScrollText,   meta: "aura-brief-2027.pdf" },
];

const DEFAULT_TEMPLATE = `<h1>Greenlight Brief — {{date}}</h1>
<p class="meta">Verdict: <strong>{{verdict}}</strong> · Aura Alignment {{index}}/100</p>

<blockquote>Recommendation: {{tagline}}</blockquote>

<h3>Executive Summary</h3>
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
  tagline: "Prioritize grounded genre bets with a clear subculture signal.",
  bullet_one: "Grounded sci-fi with spiritual resilience shows the strongest greenlight signal.",
  bullet_two: "Small-town romance with prestige stakes offers the lowest-risk repeatable engine.",
  bullet_three: "Quiet rebellion coming-of-age is promising, but requires distinctive execution.",
  recipient: "Head of Scripted — Executive Stakeholder",
};

const VOICE_TEMPLATES = [
  {
    id: "greenlight",
    name: "Greenlight — Executive",
    desc: "Warm, decisive, 90 words",
    subject: "Greenlight Brief — Next 6-12 Month Bets",
    template: DEFAULT_TEMPLATE,
  },
  {
    id: "develop",
    name: "Develop — Strategy Desk",
    desc: "Curious, exploratory, 140 words",
    subject: "Development Brief — Evidence to Validate",
    template: `<h1>Development Brief — {{date}}</h1>
<p class="meta">Status: <strong>Develop</strong> · Evidence Confidence {{index}}/100</p>

<blockquote>Strategic read: {{tagline}}</blockquote>

<h3>What the team should test next</h3>
<ol>
  <li>{{bullet_one}}</li>
  <li>{{bullet_two}}</li>
  <li>{{bullet_three}}</li>
</ol>

<p>Next checkpoint: operator validation for <em>{{recipient}}</em></p>`,
  },
  {
    id: "reconsider",
    name: "Reconsider — Studio",
    desc: "Gentle redirect, 110 words",
    subject: "Reconsideration Brief — Risk and Evidence Review",
    template: `<h1>Reconsideration Brief — {{date}}</h1>
<p class="meta">Recommendation: <strong>Reconsider</strong> · Risk Review {{index}}/100</p>

<blockquote>Use the evidence to slow the decision, not kill the idea prematurely.</blockquote>

<h3>Evidence notes</h3>
<ol>
  <li>{{bullet_one}}</li>
  <li>{{bullet_two}}</li>
  <li>{{bullet_three}}</li>
</ol>

<p>Suggested path: return to operator review before escalation to <em>{{recipient}}</em>.</p>`,
  },
  {
    id: "sunset",
    name: "Sunset Memo",
    desc: "Graceful exit, 80 words",
    subject: "Sunset Memo — Pause Recommendation",
    template: `<h1>Sunset Memo — {{date}}</h1>
<p class="meta">Decision: <strong>Pause / Archive</strong> · Evidence Confidence {{index}}/100</p>

<blockquote>{{tagline}}</blockquote>

<h3>Why now</h3>
<ol>
  <li>{{bullet_one}}</li>
  <li>{{bullet_two}}</li>
  <li>{{bullet_three}}</li>
</ol>

<p>Archive note prepared for <em>{{recipient}}</em>.</p>`,
  },
];

const merge = (src: string, vars: Record<string, string>) =>
  src.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? `{{${k}}}`);

export const CommunicationLab = () => {
  const customerName = mieClient.config.customerName;
  const [tpl, setTpl] = useState(() =>
    typeof window === "undefined" ? DEFAULT_TEMPLATE : window.localStorage.getItem("aura.dispatch.template") || DEFAULT_TEMPLATE
  );
  const [format, setFormat] = useState<Format>("slides");
  const [exporting, setExporting] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [autoVerify, setAutoVerify] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [activeVoice, setActiveVoice] = useState("greenlight");
  const [recipientEmail, setRecipientEmail] = useState("head-of-scripted@studio.example");
  const [dispatchSubject, setDispatchSubject] = useState("Greenlight Brief — Next 6-12 Month Bets");
  const [dispatchHtml, setDispatchHtml] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Array<{ format?: string; filename?: string; status?: string }>>([]);
  const [dispatchProof, setDispatchProof] = useState<DispatchProof | null>(null);
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

  const saveTemplate = () => {
    window.localStorage.setItem("aura.dispatch.template", tpl);
    toast({
      title: "Template saved",
      description: "Communication Lab will reuse this template for future dispatches.",
    });
  };

  const applyVoiceTemplate = (voiceId: string) => {
    const voice = VOICE_TEMPLATES.find((candidate) => candidate.id === voiceId);
    if (!voice) return;
    setActiveVoice(voice.id);
    setTpl(voice.template);
    setDispatchSubject(voice.subject);
    setDispatchHtml(null);
    setArtifacts([]);
    setDispatchProof(null);
  };

  const dispatch = async (autonomous = false) => {
    if (exporting) return;
    setExporting(true);
    try {
      const outputFormat = format === "memo" ? "pdf" : "slides";
      const dispatchResult = await mieClient.dispatchExecutiveBrief([recipientEmail], 5, {
        template: tpl,
        outputFormats: ["html", outputFormat],
        autoVerify: autonomous,
      });
      const payload = dispatchResult.result;
      setDispatchSubject(payload.subject);
      setDispatchHtml(payload.html_body);
      setDispatchBullets(payload.bullets || []);
      setArtifacts(payload.generated_artifacts || []);
      setDispatchProof({
        subject: payload.subject,
        recipients: [recipientEmail],
        status: payload.dispatch_status,
        autoVerified: payload.auto_verified,
        timestamp: new Date().toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        artifacts: payload.generated_artifacts || [],
      });

      let filename = payload.generated_artifacts?.find((artifact) => artifact.format === outputFormat)?.filename || activeFormat.meta;
      if (!autonomous) {
        const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
        const exported = await exportAuraBrief(format, {
          date: today,
          edition: "Vol. 12 · Edition N°042",
          tagline: SAMPLE.tagline,
          verdict: SAMPLE.verdict as "Greenlight" | "Develop" | "Reconsider",
          alignmentIndex: Number(SAMPLE.index),
          bullets: payload.bullets?.length === 3 ? payload.bullets : [SAMPLE.bullet_one, SAMPLE.bullet_two, SAMPLE.bullet_three],
          recipient: SAMPLE.recipient,
          intake: "Resort 2027 — dawn light, soft armour, quiet rebellion.",
        });
        filename = exported.filename;
        downloadBytes(exported.filename, exported.bytes);
      }
      setDispatched(true);
      setTimeout(() => setDispatched(false), 2400);
      toast({
        title: autonomous ? "Dispatch sent" : "Executive brief dispatched",
        description: autonomous
          ? `${payload.subject} · Auto-Verify completed.`
          : `${payload.subject} · ${activeFormat.label} downloaded as ${filename}.`,
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
              End the {customerName} workflow with the artifact: a polished executive brief Miranda can
              auto-verify and place in the client inbox.
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl text-obsidian">04<span className="text-amethyst">/04</span></div>
            <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Templates active</div>
          </div>
        </div>
      </div>

      {/* Outcome-first dispatch preview */}
      <div className={`px-10 pb-8 grid gap-6 ${showTemplateEditor ? "lg:grid-cols-[0.82fr_1.18fr]" : "lg:grid-cols-1"}`}>
        {/* Template editor */}
        {showTemplateEditor && (
          <article className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal p-6 flex flex-col">
            <div>
              <div className="flex items-center gap-2">
                <Library className="h-3.5 w-3.5 text-amethyst" />
                <div className="text-[10px] tracking-couture uppercase text-amethyst">Email Templates</div>
              </div>
              <h3 className="font-serif text-2xl text-obsidian mt-1">Voice library.</h3>
              <div className="mt-4 space-y-2">
                {VOICE_TEMPLATES.map((voice) => {
                  const active = activeVoice === voice.id;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyVoiceTemplate(voice.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        active ? "border-emerald-200 bg-mint shadow-soft" : "border-border/60 bg-white/60 hover:bg-mint"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-obsidian">{voice.name}</div>
                          <div className="text-[11px] text-muted-foreground">{voice.desc}</div>
                        </div>
                        <span className={`text-[10px] tracking-couture uppercase ${active ? "text-mint-deep" : "text-muted-foreground"}`}>
                          {active ? "In use" : "Activate"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7 flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] tracking-couture uppercase text-amethyst flex items-center gap-2">
                  <FileCode2 className="h-3 w-3" /> Template Architect
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Markdown or HTML · merge tags <span className="text-amethyst">{"{{double_braces}}"}</span>
                </p>
              </div>
              <button
                onClick={saveTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-obsidian text-white text-[10px] tracking-couture uppercase hover:bg-amethyst transition-colors"
              >
                <Save className="h-3 w-3" /> Save
              </button>
            </div>

          <Textarea
            value={tpl}
            onChange={(e) => setTpl(e.target.value)}
            rows={18}
            spellCheck={false}
            className="mt-5 flex-1 resize-none bg-gradient-mint border-emerald-200/70 font-mono text-xs leading-relaxed text-obsidian focus-visible:ring-emerald-300/40"
          />

          <div className="mt-4 flex flex-wrap gap-1.5">
            {Object.keys(SAMPLE).map((k) => (
              <span key={k} className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-sky-pale text-amethyst border border-amethyst/20">
                {`{{${k}}}`}
              </span>
            ))}
          </div>
          </article>
        )}

        {/* Live preview */}
        <article className="rounded-2xl border-iridescent bg-white/80 shadow-ethereal overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-border/60 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-amethyst" />
                <span className="text-[10px] tracking-couture uppercase text-amethyst">Inbox-Ready Output</span>
              </div>
              <h2 className="mt-1 font-serif text-3xl text-obsidian">Executive brief preview</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-couture uppercase">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
                autoVerify ? "bg-[#10B981]/10 text-[#10B981]" : "bg-amethyst/10 text-amethyst"
              }`}>
                <ShieldCheck className="h-3 w-3" />
                {autoVerify ? "auto-send armed" : "review draft mode"}
              </span>
              <button
                onClick={() => setShowTemplateEditor((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border-iridescent px-3 py-1.5 text-obsidian hover:bg-white transition-colors"
              >
                <FileCode2 className="h-3 w-3" />
                {showTemplateEditor ? "Hide template" : "Edit template"}
              </button>
            </div>
          </div>

          {/* Email envelope */}
          <div className="px-6 py-5 border-b border-border/60 bg-lavender/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-aura text-white flex items-center justify-center font-sans font-semibold">M</div>
              <div className="leading-tight">
                <div className="text-xs text-obsidian">
                  <span className="font-semibold">Miranda</span>{" "}
                  <span className="text-muted-foreground font-mono">&lt;briefing-agent@aura.intel&gt;</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  to: <span className="text-obsidian">{recipientEmail}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-white/70 px-4 py-3">
              <div className="text-[10px] tracking-couture uppercase text-muted-foreground">Subject</div>
              <div className="mt-1 text-base font-semibold text-obsidian">{dispatchSubject}</div>
            </div>
          </div>

          {/* Rendered template */}
          <div
            className="flex-1 px-7 py-7 overflow-auto bg-white prose prose-sm max-w-none
                       prose-headings:font-sans prose-headings:font-semibold prose-h1:text-3xl prose-h1:text-obsidian
                       prose-h3:text-amethyst prose-strong:text-amethyst
                       prose-blockquote:font-sans prose-blockquote:not-italic prose-blockquote:text-amethyst
                       prose-blockquote:border-l-amethyst
                       prose-li:text-obsidian/90"
            dangerouslySetInnerHTML={{ __html: rendered }}
          />

          <div className="px-6 py-3 border-t border-border/60 flex items-center justify-between bg-white/60 text-[10px] tracking-couture uppercase text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-mono normal-case tracking-normal">
              <Paperclip className="h-3 w-3" /> {artifacts[0]?.filename || activeFormat.meta}
            </span>
              <span className="text-mint-deep">{dispatchProof?.status === "sent" ? "dispatch receipt logged" : "draft ready"}</span>
          </div>
        </article>
      </div>

      {/* Dispatch bar */}
      <div className="px-10 pb-14">
        <div className="rounded-2xl border-iridescent bg-gradient-iridescent/40 p-6 shadow-ethereal">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/70 border-iridescent flex items-center justify-center">
                  {autoVerify ? <Bot className="h-5 w-5 text-mint-deep" strokeWidth={1.5} /> : <Mail className="h-5 w-5 text-amethyst" strokeWidth={1.5} />}
                </div>
                <div>
                  <div className="text-[10px] tracking-couture uppercase text-amethyst">Close the Loop</div>
                  <h3 className="font-serif text-xl text-obsidian">
                    {autoVerify ? "Miranda sends the brief after Auto-Verify" : "Prepare the executive inbox brief"}
                  </h3>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {autoVerify
                      ? "NAT sequence · template injection · recipient check · backend dispatch_status=sent"
                      : "reviewable draft · template preview · local export"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border/60 bg-white/70">
                  <Switch
                    checked={autoVerify}
                    onCheckedChange={(checked) => {
                      setAutoVerify(checked);
                      setDispatchProof(null);
                    }}
                    className="data-[state=checked]:bg-mint-deep"
                  />
                  <span className="text-[10px] tracking-couture uppercase text-obsidian">
                    {autoVerify ? "Auto-send mode" : "Review mode"}
                  </span>
                </div>
                <input
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="recipient@email.com"
                  className="px-3 py-2 rounded-full border border-border/60 bg-white/70 text-xs w-64 focus:outline-none focus:border-amethyst"
                />
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
                  onClick={() => void dispatch(autoVerify)}
                  disabled={exporting}
                  className={`group inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-full text-white text-[10px] tracking-couture uppercase shadow-halo hover:scale-[1.02] active:scale-100 transition-transform disabled:opacity-80 disabled:cursor-progress ${
                    autoVerify ? "bg-gradient-mint text-obsidian" : "bg-gradient-aura"
                  }`}
                >
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : dispatched ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : autoVerify ? <Inbox className="h-3.5 w-3.5" />
                    : <Send className="h-3.5 w-3.5" />}
                  {exporting
                    ? autoVerify ? "Running auto-send..." : "Composing draft..."
                    : dispatched ? "Dispatch complete"
                    : autoVerify ? "Run autonomous send" : "Export review draft"}
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-xl border border-emerald-200/70 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] tracking-couture uppercase text-mint-deep">Autonomous Send Sequence</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Shows what Miranda does when the workflow is allowed to finish without a manual download step.
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] tracking-couture uppercase ${
                    dispatchProof?.status === "sent"
                      ? "bg-[#10B981]/10 text-[#10B981]"
                      : exporting && autoVerify
                        ? "bg-amber-100 text-amber-700"
                        : "bg-lavender text-amethyst"
                  }`}>
                    {dispatchProof?.status === "sent" ? "sent" : exporting && autoVerify ? "running" : autoVerify ? "armed" : "standby"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-4">
                  {[
                    { label: "Evidence locked", detail: "ranked asset package", Icon: ClipboardCheck },
                    { label: "Template injected", detail: activeVoice.replace("-", " "), Icon: FileCode2 },
                    { label: "Auto-Verify", detail: autoVerify ? "enabled" : "off", Icon: ShieldCheck },
                    { label: "Inbox dispatch", detail: recipientEmail, Icon: Inbox },
                  ].map((step, index) => {
                    const StepIcon = step.Icon;
                    const complete = dispatchProof?.status === "sent" || (index < 2 && (exporting || autoVerify));
                    const active = exporting && autoVerify && index === 2;
                    return (
                      <div key={step.label} className="rounded-lg border border-border/60 bg-white/75 px-3 py-3">
                        <div className="flex items-center gap-2">
                          {complete ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-mint-deep" />
                          ) : active ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                          ) : (
                            <StepIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="text-[10px] tracking-couture uppercase text-obsidian">{step.label}</span>
                        </div>
                        <div className="mt-2 truncate text-[11px] text-muted-foreground">{step.detail}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-white/75 p-4">
                <div className="text-[10px] tracking-couture uppercase text-amethyst">Dispatch Receipt</div>
                {dispatchProof ? (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-mono text-mint-deep">{dispatchProof.status || "draft_ready"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Auto-Verify</span>
                      <span className="font-mono text-obsidian">{dispatchProof.autoVerified ? "passed" : "not used"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Time</span>
                      <span className="font-mono text-obsidian">{dispatchProof.timestamp}</span>
                    </div>
                    <div className="pt-2 border-t border-border/60">
                      <div className="text-muted-foreground">Subject</div>
                      <div className="mt-1 text-obsidian line-clamp-2">{dispatchProof.subject}</div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Run auto-send to show proof that the backend returned a sent dispatch and generated inbox artifacts.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
