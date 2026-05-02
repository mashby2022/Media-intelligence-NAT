import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

/* ============================================================
 * Aura Brief — real PDF export (Editorial Memo + Slide Pack)
 * Uses pdf-lib so it runs entirely in the browser, no backend.
 * ==========================================================*/

export type Verdict = "Greenlight" | "Develop" | "Reconsider";

export interface AuraBriefData {
  date: string;          // e.g. "30 April 2026"
  edition: string;       // e.g. "Vol. 12 · Edition N°042"
  tagline: string;       // e.g. "Soft armour, dawn light."
  verdict: Verdict;
  alignmentIndex: number; // 0-100
  bullets: string[];     // exactly 3
  recipient: string;     // e.g. "Eloise Marchetti — CBO"
  intake: string;        // the original concept text
}

/* Ethereal palette → pdf-lib RGB (0-1) */
const C = {
  amethyst: rgb(0.333, 0.235, 0.604),     // #553C9A
  amethystSoft: rgb(0.66, 0.55, 0.82),
  obsidian: rgb(0.16, 0.12, 0.27),
  ink: rgb(0.21, 0.18, 0.30),
  muted: rgb(0.45, 0.42, 0.55),
  rule: rgb(0.85, 0.83, 0.95),
  lavender: rgb(0.962, 0.952, 1),
  sky: rgb(0.878, 0.949, 0.996),
  paper: rgb(1, 1, 1),
  white: rgb(1, 1, 1),
};

/** Word-wrap text into lines that fit `maxWidth` at the given font/size. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const trial = current ? current + " " + w : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; maxWidth: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; lineHeight?: number }
): number {
  const lh = opts.lineHeight ?? opts.size * 1.45;
  const lines = wrapText(text, opts.font, opts.size, opts.maxWidth);
  let y = opts.y;
  for (const line of lines) {
    page.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: opts.color });
    y -= lh;
  }
  return y;
}

/** Soft iridescent gradient header — drawn as fine horizontal slivers. */
function drawIridescentBar(page: PDFPage, x: number, y: number, w: number, h: number) {
  const slices = 60;
  for (let i = 0; i < slices; i++) {
    const t = i / (slices - 1);
    // lavender → sky → amethyst-soft
    const r = 0.94 - 0.18 * t + 0.10 * Math.sin(t * Math.PI);
    const g = 0.92 - 0.05 * t;
    const b = 0.99 - 0.04 * t;
    page.drawRectangle({
      x: x + (w / slices) * i,
      y,
      width: w / slices + 0.6,
      height: h,
      color: rgb(Math.max(0, r), Math.max(0, g), Math.max(0, b)),
    });
  }
}

function drawGaugeRing(page: PDFPage, cx: number, cy: number, radius: number, value: number) {
  // Background ring
  const segments = 72;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const x = cx + Math.cos(a0) * radius;
    const y = cy + Math.sin(a0) * radius;
    page.drawCircle({ x, y, size: 1.6, color: C.rule });
  }
  // Foreground arc — proportional to value
  const filled = Math.round(segments * (value / 100));
  for (let i = 0; i < filled; i++) {
    const t = i / segments;
    // Sweep amethyst → sky for an iridescent feel
    const a0 = (-Math.PI / 2) + t * Math.PI * 2;
    const x = cx + Math.cos(a0) * radius;
    const y = cy + Math.sin(a0) * radius;
    const r = 0.40 + 0.25 * Math.sin(t * Math.PI);
    const g = 0.30 + 0.30 * t;
    const b = 0.70 + 0.25 * (1 - t);
    page.drawCircle({ x, y, size: 2.2, color: rgb(Math.min(1, r), Math.min(1, g), Math.min(1, b)) });
  }
}

/* ============================================================
 * Executive Memo — single A4 page, editorial layout
 * ==========================================================*/

async function buildMemo(data: AuraBriefData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Aura Brief — ${data.date}`);
  pdf.setAuthor("Aura Intelligence");
  pdf.setSubject("Executive Memo");
  pdf.setProducer("Aura Intelligence · pdf-lib");

  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifIt = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // A4 portrait
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 56;
  const contentW = width - margin * 2;

  // Iridescent header band
  drawIridescentBar(page, 0, height - 90, width, 90);

  // Brand
  page.drawText("AURA INTELLIGENCE", { x: margin, y: height - 38, size: 9, font: sansBold, color: C.amethyst });
  page.drawText("Executive Memo", { x: margin, y: height - 54, size: 8, font: sans, color: C.muted });
  // Edition (right aligned)
  const edW = sans.widthOfTextAtSize(data.edition, 8);
  page.drawText(data.edition, { x: width - margin - edW, y: height - 38, size: 8, font: sans, color: C.muted });
  const dateW = sans.widthOfTextAtSize(data.date, 8);
  page.drawText(data.date, { x: width - margin - dateW, y: height - 54, size: 8, font: sans, color: C.muted });

  // Headline
  let y = height - 140;
  y = drawWrapped(page, "The Aura Brief.", {
    x: margin, y, maxWidth: contentW, font: serif, size: 36, color: C.obsidian, lineHeight: 38,
  });
  y -= 10;
  y = drawWrapped(page, `“${data.tagline}”`, {
    x: margin, y, maxWidth: contentW, font: serifIt, size: 14, color: C.amethyst, lineHeight: 18,
  });

  // Verdict + Alignment row
  y -= 22;
  const rowY = y;
  // Verdict pill — generous horizontal padding so all verdicts fit
  const verdictText = `Verdict · ${data.verdict}`;
  const vTextW = sansBold.widthOfTextAtSize(verdictText, 9);
  const pillW = vTextW + 28;
  page.drawRectangle({
    x: margin, y: rowY - 8, width: pillW, height: 24,
    color: C.lavender, borderColor: C.amethystSoft, borderWidth: 0.6,
  });
  page.drawText(verdictText, { x: margin + 14, y: rowY + 1, size: 9, font: sansBold, color: C.amethyst });

  // Alignment label + value, positioned right after the pill with a comfortable gap
  const alignX = margin + pillW + 28;
  page.drawText("AURA ALIGNMENT INDEX", { x: alignX, y: rowY + 6, size: 8, font: sans, color: C.muted });
  page.drawText(`${data.alignmentIndex} / 100`, {
    x: alignX, y: rowY - 8, size: 16, font: serif, color: C.obsidian,
  });

  // Mini gauge ring on the right
  drawGaugeRing(page, width - margin - 28, rowY + 4, 22, data.alignmentIndex);
  const idxW = sansBold.widthOfTextAtSize(String(data.alignmentIndex), 12);
  page.drawText(String(data.alignmentIndex), {
    x: width - margin - 28 - idxW / 2, y: rowY + 0, size: 12, font: sansBold, color: C.obsidian,
  });

  // Divider
  y = rowY - 28;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.6, color: C.rule });
  y -= 28;

  // Section label
  page.drawText("THREE THINGS YOU SHOULD KNOW", { x: margin, y, size: 8, font: sansBold, color: C.amethyst });
  y -= 22;

  // Bullets — numbered, serif
  data.bullets.forEach((b, i) => {
    const numLabel = `0${i + 1}`;
    page.drawText(numLabel, { x: margin, y: y - 4, size: 26, font: serifIt, color: C.amethyst });
    const next = drawWrapped(page, b, {
      x: margin + 44, y, maxWidth: contentW - 44, font: serif, size: 11.5, color: C.ink, lineHeight: 16,
    });
    y = next - 16;
  });

  // Concept summary box
  y -= 6;
  page.drawRectangle({ x: margin, y: y - 90, width: contentW, height: 90, color: C.lavender });
  page.drawText("THE CONCEPT IN BRIEF", { x: margin + 14, y: y - 18, size: 8, font: sansBold, color: C.amethyst });
  drawWrapped(page, data.intake, {
    x: margin + 14, y: y - 36, maxWidth: contentW - 28, font: serifIt, size: 10, color: C.ink, lineHeight: 14,
  });

  // Footer — two lines so long strings never collide
  const footerY = 56;
  page.drawLine({
    start: { x: margin, y: footerY + 26 },
    end: { x: width - margin, y: footerY + 26 },
    thickness: 0.4, color: C.rule,
  });
  page.drawText(`CURATED FOR ${data.recipient.toUpperCase()}`, {
    x: margin, y: footerY + 10, size: 7.5, font: sansBold, color: C.muted,
  });
  const editionLine = data.edition.toUpperCase();
  const elW = sans.widthOfTextAtSize(editionLine, 7.5);
  page.drawText(editionLine, {
    x: width - margin - elW, y: footerY + 10, size: 7.5, font: sans, color: C.muted,
  });
  const tech = "AURA INTELLIGENCE · POLARS HIGH-PERFORMANCE ENGINE · NEMO-3-NANO";
  page.drawText(tech, { x: margin, y: footerY - 6, size: 6.5, font: sans, color: C.muted });

  return pdf.save();
}

/* ============================================================
 * Editorial Slide Pack — 16:9 deck, ~6 slides
 * ==========================================================*/

const SLIDE_W = 960;
const SLIDE_H = 540;

async function buildSlidePack(data: AuraBriefData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Aura Brief — ${data.date} (Editorial Slide Pack)`);
  pdf.setAuthor("Aura Intelligence");
  pdf.setSubject("Editorial Slide Pack");

  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifIt = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const slideHeader = (page: PDFPage, label: string, n: number, total: number) => {
    drawIridescentBar(page, 0, SLIDE_H - 6, SLIDE_W, 6);
    page.drawText("AURA INTELLIGENCE", { x: 56, y: SLIDE_H - 32, size: 9, font: sansBold, color: C.amethyst });
    page.drawText(label, { x: 56, y: SLIDE_H - 46, size: 8, font: sans, color: C.muted });
    const pageStr = `${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    const w = sans.widthOfTextAtSize(pageStr, 8);
    page.drawText(pageStr, { x: SLIDE_W - 56 - w, y: SLIDE_H - 32, size: 8, font: sans, color: C.muted });
    page.drawText(data.date, {
      x: SLIDE_W - 56 - sans.widthOfTextAtSize(data.date, 8), y: SLIDE_H - 46, size: 8, font: sans, color: C.muted,
    });
  };

  const slideFooter = (page: PDFPage) => {
    page.drawLine({ start: { x: 56, y: 40 }, end: { x: SLIDE_W - 56, y: 40 }, thickness: 0.4, color: C.rule });
    page.drawText("CURATED FOR " + data.recipient.toUpperCase(),
      { x: 56, y: 24, size: 7, font: sansBold, color: C.muted });
    const right = "POLARS · NEMO-3-NANO · 0.02ms";
    const w = sans.widthOfTextAtSize(right, 7);
    page.drawText(right, { x: SLIDE_W - 56 - w, y: 24, size: 7, font: sans, color: C.muted });
  };

  const totalSlides = 3 + data.bullets.length;

  /* --- Slide 1: Cover --- */
  {
    const p = pdf.addPage([SLIDE_W, SLIDE_H]);
    p.drawRectangle({ x: 0, y: 0, width: SLIDE_W, height: SLIDE_H, color: C.lavender });
    drawIridescentBar(p, 0, SLIDE_H - 80, SLIDE_W, 80);
    slideHeader(p, "Cover · Editorial Slide Pack", 1, totalSlides);

    p.drawText("The Aura", { x: 56, y: SLIDE_H - 200, size: 84, font: serif, color: C.obsidian });
    p.drawText("Brief.", { x: 56, y: SLIDE_H - 280, size: 84, font: serifIt, color: C.amethyst });
    drawWrapped(p, `“${data.tagline}”`, {
      x: 56, y: SLIDE_H - 320, maxWidth: SLIDE_W - 112, font: serifIt, size: 18, color: C.muted, lineHeight: 22,
    });
    p.drawText(data.edition.toUpperCase(), { x: 56, y: 80, size: 9, font: sansBold, color: C.amethyst });
    p.drawText(data.date, { x: 56, y: 64, size: 9, font: sans, color: C.muted });
    slideFooter(p);
  }

  /* --- Slide 2: Verdict + Gauge --- */
  {
    const p = pdf.addPage([SLIDE_W, SLIDE_H]);
    p.drawRectangle({ x: 0, y: 0, width: SLIDE_W, height: SLIDE_H, color: C.paper });
    slideHeader(p, "Verdict · Aura Alignment", 2, totalSlides);

    // Left: verdict
    p.drawText("VERDICT", { x: 56, y: SLIDE_H - 130, size: 10, font: sansBold, color: C.amethyst });
    p.drawText(data.verdict, { x: 56, y: SLIDE_H - 200, size: 64, font: serif, color: C.obsidian });
    drawWrapped(p,
      data.verdict === "Greenlight"
        ? "The cultural weather is in your favour. Move."
        : data.verdict === "Develop"
          ? "Promising. A few refinements unlock the room."
          : "Pause. The signal asks for a different angle.",
      { x: 56, y: SLIDE_H - 240, maxWidth: 420, font: serifIt, size: 16, color: C.ink, lineHeight: 22 });

    // Right: gauge
    const cx = SLIDE_W - 200, cy = SLIDE_H / 2 - 20;
    drawGaugeRing(p, cx, cy, 84, data.alignmentIndex);
    const big = String(data.alignmentIndex);
    const bigW = serif.widthOfTextAtSize(big, 56);
    p.drawText(big, { x: cx - bigW / 2, y: cy - 18, size: 56, font: serif, color: C.obsidian });
    p.drawText("/ 100", { x: cx - 22, y: cy - 50, size: 11, font: sans, color: C.muted });
    p.drawText("AURA ALIGNMENT INDEX", {
      x: cx - sans.widthOfTextAtSize("AURA ALIGNMENT INDEX", 9) / 2,
      y: cy - 92, size: 9, font: sansBold, color: C.amethyst,
    });

    slideFooter(p);
  }

  /* --- Slides 3..n: One bullet per slide, magazine-style --- */
  data.bullets.forEach((b, i) => {
    const p = pdf.addPage([SLIDE_W, SLIDE_H]);
    p.drawRectangle({ x: 0, y: 0, width: SLIDE_W, height: SLIDE_H, color: C.paper });
    // accent stripe on the left
    p.drawRectangle({ x: 0, y: 0, width: 8, height: SLIDE_H, color: C.amethyst });
    slideHeader(p, `Insight 0${i + 1} of 0${data.bullets.length}`, 3 + i, totalSlides);

    p.drawText(`0${i + 1}`, { x: 56, y: SLIDE_H - 220, size: 130, font: serifIt, color: C.amethystSoft });
    p.drawText("THE INSIGHT", { x: 230, y: SLIDE_H - 140, size: 9, font: sansBold, color: C.amethyst });
    drawWrapped(p, b, {
      x: 230, y: SLIDE_H - 170, maxWidth: SLIDE_W - 290, font: serif, size: 26, color: C.obsidian, lineHeight: 34,
    });

    // small data caption
    p.drawRectangle({ x: 230, y: 90, width: SLIDE_W - 290, height: 56, color: C.sky });
    p.drawText("WHY IT MATTERS", { x: 246, y: 124, size: 8, font: sansBold, color: C.amethyst });
    drawWrapped(p, `Cross-references ${data.bullets.length} narrative atoms across the Aura graph; resonance trending toward the ${data.verdict.toLowerCase()} threshold.`, {
      x: 246, y: 110, maxWidth: SLIDE_W - 322, font: serifIt, size: 11, color: C.ink, lineHeight: 14,
    });

    slideFooter(p);
  });

  /* --- Final slide: Closing --- */
  {
    const p = pdf.addPage([SLIDE_W, SLIDE_H]);
    p.drawRectangle({ x: 0, y: 0, width: SLIDE_W, height: SLIDE_H, color: C.obsidian });
    drawIridescentBar(p, 0, 0, SLIDE_W, 6);
    p.drawText("AURA INTELLIGENCE", { x: 56, y: SLIDE_H - 60, size: 10, font: sansBold, color: C.amethystSoft });
    p.drawText("Thank you.", { x: 56, y: SLIDE_H / 2 + 10, size: 96, font: serif, color: C.white });
    p.drawText("A luxurious second opinion,", { x: 56, y: SLIDE_H / 2 - 60, size: 16, font: serifIt, color: C.amethystSoft });
    p.drawText("distilled from eleven million signals.", { x: 56, y: SLIDE_H / 2 - 84, size: 16, font: serifIt, color: C.amethystSoft });
    p.drawText("CURATED FOR " + data.recipient.toUpperCase(), { x: 56, y: 56, size: 8, font: sansBold, color: C.amethystSoft });
  }

  return pdf.save();
}

/* ============================================================
 * Public API
 * ==========================================================*/

export async function exportAuraBrief(
  format: "memo" | "slides",
  data: AuraBriefData
): Promise<{ filename: string; bytes: Uint8Array }> {
  const safeDate = data.date.replace(/\s+/g, "-").toLowerCase();
  if (format === "memo") {
    const bytes = await buildMemo(data);
    return { filename: `aura-brief-${safeDate}-memo.pdf`, bytes };
  }
  const bytes = await buildSlidePack(data);
  return { filename: `aura-brief-${safeDate}-slide-pack.pdf`, bytes };
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime = "application/pdf") {
  // Copy into a fresh ArrayBuffer to satisfy strict BlobPart typing
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revocation slightly so the download has time to start
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}