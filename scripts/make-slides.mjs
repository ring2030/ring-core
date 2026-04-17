import PptxGenJS from 'pptxgenjs';

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 16:9

// ── Color palette ──────────────────────────────────────────────
const C = {
  bg:        'F8F9FA',
  dark:      '1A1A2E',
  teal:      '0F7173',
  tealLight: 'E0F4F4',
  amber:     'E9A825',
  amberLight:'FEF3D0',
  violet:    '6B4EFF',
  violetLight:'EDE9FF',
  slate:     '64748B',
  white:     'FFFFFF',
  border:    'E2E8F0',
  // layer colours for arch slide
  layerA:    'EBF5FB',  // input
  layerB:    'E8F8F5',  // frontend
  layerC:    'EAF4FB',  // backend
  layerD:    'FEF9E7',  // AI
  layerE:    'F4ECF7',  // data
};

// ── Helpers ─────────────────────────────────────────────────────
function emu(inches) { return inches; } // pptxgenjs uses inches natively

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: opts.fill || C.white },
    line: { color: opts.border || C.border, width: 1.2 },
    rectRadius: 0.12,
    shadow: opts.shadow ? { type: 'outer', color: '00000015', blur: 6, offset: 3, angle: 90 } : undefined,
  });
}

function label(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontSize: opts.size || 11,
    bold: opts.bold || false,
    color: opts.color || C.dark,
    align: opts.align || 'center',
    valign: opts.valign || 'middle',
    fontFace: 'Segoe UI',
    wrap: true,
  });
}

function arrow(slide, x1, y1, x2, y2, opts = {}) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color: opts.color || C.slate, width: opts.width || 1.5, dashType: opts.dash || 'solid', endArrowType: 'triangle' },
  });
}

// ════════════════════════════════════════════════════════════════
//  SLIDE 1 — Stakeholder Interaction
// ════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };

  // ── Title bar ──
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: C.dark } });
  label(slide, 'ring  —  How Patients, Nurses & Families Work Together', 0.3, 0, 12.5, 0.9,
        { size: 20, bold: true, color: C.white, align: 'left', valign: 'middle' });

  // ── Centre hub ──
  const hubX = 5.4, hubY = 1.6, hubW = 2.5, hubH = 2.5;
  slide.addShape(pptx.ShapeType.ellipse, {
    x: hubX, y: hubY, w: hubW, h: hubH,
    fill: { color: C.teal },
    line: { color: C.teal, width: 0 },
    shadow: { type: 'outer', color: '00000030', blur: 10, offset: 4, angle: 90 },
  });
  label(slide, 'ring\nPlatform', hubX, hubY, hubW, hubH,
        { size: 14, bold: true, color: C.white });

  // Sub-label inside hub
  slide.addText('AI Triage · Firestore\nReal-time Alerts', {
    x: hubX, y: hubY + 0.9, w: hubW, h: 0.8,
    fontSize: 8, color: 'AEEAEC', align: 'center', fontFace: 'Segoe UI', italic: true,
  });

  // ── Actor cards ──
  // Patient — left
  const pX = 0.5, pY = 1.7;
  card(slide, pX, pY, 2.8, 2.3, { fill: C.tealLight, border: C.teal, shadow: true });
  slide.addText('👁', { x: pX + 1.0, y: pY + 0.1, w: 0.8, h: 0.5, fontSize: 22, align: 'center' });
  label(slide, 'PATIENT', pX, pY + 0.55, 2.8, 0.35, { size: 11, bold: true, color: C.teal });
  slide.addText(
    '• Gazes at target (Toilet / Chat)\n• Speaks to AI when confused\n• Watches family video messages',
    { x: pX + 0.1, y: pY + 0.88, w: 2.6, h: 1.3,
      fontSize: 8.5, color: C.dark, fontFace: 'Segoe UI', bullet: false, align: 'left', valign: 'top' });

  // Nurse — top right
  const nX = 9.9, nY = 1.0;
  card(slide, nX, nY, 2.8, 2.3, { fill: C.amberLight, border: C.amber, shadow: true });
  slide.addText('🏥', { x: nX + 1.0, y: nY + 0.1, w: 0.8, h: 0.5, fontSize: 22, align: 'center' });
  label(slide, 'NURSE / STAFF', nX, nY + 0.55, 2.8, 0.35, { size: 11, bold: true, color: C.amber });
  slide.addText(
    '• Gets real-time call alerts\n• Views priority & AI summary\n• Logs care notes & outcomes',
    { x: nX + 0.1, y: nY + 0.88, w: 2.6, h: 1.3,
      fontSize: 8.5, color: C.dark, fontFace: 'Segoe UI', align: 'left', valign: 'top' });

  // Family — bottom right
  const fX = 9.9, fY = 4.0;
  card(slide, fX, fY, 2.8, 2.3, { fill: C.violetLight, border: C.violet, shadow: true });
  slide.addText('👨‍👩‍👧', { x: fX + 1.0, y: fY + 0.1, w: 0.8, h: 0.5, fontSize: 22, align: 'center' });
  label(slide, 'FAMILY', fX, fY + 0.55, 2.8, 0.35, { size: 11, bold: true, color: C.violet });
  slide.addText(
    '• Reads AI daily care summary\n• Records & sends video messages\n• Stays close without being there',
    { x: fX + 0.1, y: fY + 0.88, w: 2.6, h: 1.3,
      fontSize: 8.5, color: C.dark, fontFace: 'Segoe UI', align: 'left', valign: 'top' });

  // ── Arrows with labels ──
  // Patient → Hub  (gaze / call request)
  slide.addShape(pptx.ShapeType.line, {
    x: 3.3, y: 2.55, w: 2.1, h: 0.15,
    line: { color: C.teal, width: 1.8, endArrowType: 'triangle' },
  });
  slide.addText('Gaze → Call Request', {
    x: 3.3, y: 2.2, w: 2.1, h: 0.3,
    fontSize: 7.5, color: C.teal, align: 'center', fontFace: 'Segoe UI', bold: true,
  });

  // Hub → Patient  (AI voice response)
  slide.addShape(pptx.ShapeType.line, {
    x: 3.3, y: 2.9, w: 2.1, h: -0.15,
    line: { color: C.teal, width: 1.8, dashType: 'dash', endArrowType: 'triangle' },
  });
  slide.addText('AI Voice Response', {
    x: 3.3, y: 2.85, w: 2.1, h: 0.3,
    fontSize: 7.5, color: C.teal, align: 'center', fontFace: 'Segoe UI', italic: true,
  });

  // Hub → Nurse  (real-time alert)
  slide.addShape(pptx.ShapeType.line, {
    x: 7.9, y: 2.2, w: 2.0, h: 0.1,
    line: { color: C.amber, width: 1.8, endArrowType: 'triangle' },
  });
  slide.addText('Real-time Alert + Priority', {
    x: 7.75, y: 1.88, w: 2.3, h: 0.3,
    fontSize: 7.5, color: C.amber, align: 'center', fontFace: 'Segoe UI', bold: true,
  });

  // Nurse → Hub  (care notes)
  slide.addShape(pptx.ShapeType.line, {
    x: 7.9, y: 2.55, w: 2.0, h: -0.1,
    line: { color: C.amber, width: 1.8, dashType: 'dash', endArrowType: 'triangle' },
  });
  slide.addText('Care Notes Logged', {
    x: 7.75, y: 2.5, w: 2.3, h: 0.3,
    fontSize: 7.5, color: C.amber, align: 'center', fontFace: 'Segoe UI', italic: true,
  });

  // Hub → Family  (daily summary)
  slide.addShape(pptx.ShapeType.line, {
    x: 7.9, y: 3.3, w: 2.0, h: 0.9,
    line: { color: C.violet, width: 1.8, endArrowType: 'triangle' },
  });
  slide.addText('AI Daily Summary', {
    x: 7.5, y: 3.8, w: 2.4, h: 0.3,
    fontSize: 7.5, color: C.violet, align: 'center', fontFace: 'Segoe UI', bold: true,
  });

  // Family → Hub  (video message)
  slide.addShape(pptx.ShapeType.line, {
    x: 9.9, y: 4.3, w: -1.5, h: -1.3,
    line: { color: C.violet, width: 1.8, dashType: 'dash', endArrowType: 'triangle' },
  });
  slide.addText('Video Message Upload', {
    x: 7.5, y: 3.1, w: 2.4, h: 0.3,
    fontSize: 7.5, color: C.violet, align: 'center', fontFace: 'Segoe UI', italic: true,
  });

  // ── Bottom legend ──
  const legendY = 6.8;
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: legendY, w: 13.33, h: 0.7, fill: { color: C.dark } });
  const legendItems = [
    { text: '— Outbound (request/alert/summary)',  color: C.white },
    { text: '- - Inbound (response/video/notes)',   color: 'AAAAAA' },
    { text: 'Hub processes every call through Gemini AI before routing', color: C.amber },
  ];
  legendItems.forEach((item, i) => {
    slide.addText(item.text, {
      x: 0.4 + i * 4.3, y: legendY + 0.05, w: 4.1, h: 0.6,
      fontSize: 8, color: item.color, fontFace: 'Segoe UI', valign: 'middle',
    });
  });
}

// ════════════════════════════════════════════════════════════════
//  SLIDE 2 — System Architecture
// ════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };

  // ── Title bar ──
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: C.dark } });
  label(slide, 'ring  —  System Architecture', 0.3, 0, 12.5, 0.9,
        { size: 20, bold: true, color: C.white, align: 'left', valign: 'middle' });

  // ── Layer definitions ──
  const layers = [
    {
      label: '① INPUT',
      y: 1.0, h: 1.05,
      fill: 'EBF5FB', border: '85C1E9',
      items: [
        { t: 'Eye Gaze\n(Eyedid SDK)', w: 2.2 },
        { t: 'Iris Fallback\n(MediaPipe)', w: 2.2 },
        { t: 'Voice\n(Web Speech API)', w: 2.4 },
        { t: 'Touch / Mouse\n(pointer fallback)', w: 2.4 },
      ],
    },
    {
      label: '② FRONTEND',
      y: 2.2, h: 1.05,
      fill: 'E8F8F5', border: '1ABC9C',
      items: [
        { t: 'Patient UI\nGaze + AI Chat', w: 2.8 },
        { t: 'Nurse Dashboard\nCall Queue + Analytics', w: 3.0 },
        { t: 'Family Portal\nSummary + Video', w: 2.8 },
      ],
    },
    {
      label: '③ API (Next.js)',
      y: 3.4, h: 1.05,
      fill: 'EAF4FB', border: '5DADE2',
      items: [
        { t: '/api/chat\nAI Triage', w: 2.2 },
        { t: '/api/family-summary\nDaily Narrative', w: 2.7 },
        { t: '/api/invite\nToken Auth', w: 2.2 },
        { t: '/api/auth\nNurse Login', w: 2.2 },
      ],
    },
    {
      label: '④ AI SERVICES',
      y: 4.6, h: 1.05,
      fill: 'FEF9E7', border: 'F39C12',
      items: [
        { t: 'Gemini 2.5 Flash\nCall Triage + Priority', w: 3.0 },
        { t: 'Gemini 1.5 Flash\nDaily Summary (family)', w: 3.0 },
        { t: 'Local Fallback\nRegex Classifier', w: 2.5 },
      ],
    },
    {
      label: '⑤ DATA',
      y: 5.8, h: 1.05,
      fill: 'F4ECF7', border: '8E44AD',
      items: [
        { t: 'Firestore\ncalls / messages', w: 2.8 },
        { t: 'Firebase Storage\nFamily videos', w: 2.8 },
        { t: 'Firebase Auth\nRole-based sessions', w: 2.8 },
      ],
    },
  ];

  const startX = 1.5;
  const layerLabelW = 1.2;

  layers.forEach((layer) => {
    // Layer background stripe
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.18, y: layer.y, w: 12.97, h: layer.h,
      fill: { color: layer.fill },
      line: { color: layer.border, width: 1.0 },
      rectRadius: 0.1,
    });

    // Layer label (left side)
    slide.addText(layer.label, {
      x: 0.22, y: layer.y, w: layerLabelW, h: layer.h,
      fontSize: 8.5, bold: true, color: '34495E',
      align: 'center', valign: 'middle', fontFace: 'Segoe UI',
    });

    // Item cards
    let curX = startX;
    layer.items.forEach((item) => {
      card(slide, curX, layer.y + 0.08, item.w, layer.h - 0.16,
           { fill: C.white, border: layer.border });
      slide.addText(item.t, {
        x: curX, y: layer.y + 0.08, w: item.w, h: layer.h - 0.16,
        fontSize: 8, color: C.dark, align: 'center', valign: 'middle',
        fontFace: 'Segoe UI', wrap: true,
      });
      curX += item.w + 0.15;
    });
  });

  // ── Vertical connector arrows between layers ──
  const arrowX = 6.6;
  [1.95, 3.15, 4.35, 5.55].forEach((arrowY) => {
    slide.addShape(pptx.ShapeType.line, {
      x: arrowX, y: arrowY + 0.08, w: 0, h: 0.18,
      line: { color: C.slate, width: 1.5, endArrowType: 'triangle' },
    });
  });

  // ── Footer ──
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 6.95, w: 13.33, h: 0.55, fill: { color: C.dark } });
  slide.addText(
    'Next.js 16 (App Router)  ·  React 19  ·  TypeScript 5  ·  TailwindCSS 4  ·  Firebase  ·  Google Gemini  ·  Vercel',
    { x: 0.3, y: 6.95, w: 12.73, h: 0.55,
      fontSize: 8, color: 'AAAAAA', align: 'center', valign: 'middle', fontFace: 'Segoe UI' });
}

// ── Save ────────────────────────────────────────────────────────
await pptx.writeFile({ fileName: 'ring-overview.pptx' });
console.log('ring-overview.pptx saved');
