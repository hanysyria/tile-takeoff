/**
 * tile-takeoff — browser front end.
 *
 * Everything runs locally: the PDF is opened with a bundled pdf.js, the maths
 * comes from cutting.js, and no request leaves the page after it loads. That is
 * the point, not a detail — a floor plan is somebody's home.
 */

import {
  compareStandardSizes,
  parseDimensions,
  recommend,
  takeoff,
} from './cutting.js';

import * as pdfjs from './vendor/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

/* ─────────────────────────── translations ─────────────────────────── */

const STRINGS = {
  en: {
    privacyBadge: 'Runs in your browser · nothing is uploaded',
    s1Title: 'Open a drawing',
    s1Hint: 'Optional. Skip straight to step 2 if you already know your areas.',
    dropLabel: 'Drop a PDF here, or choose a file',
    dropSub: 'The file is opened locally. It is never sent anywhere.',
    clearPlan: 'Close drawing',
    zoom: 'Zoom',
    textLayer: 'Dimensions found in the drawing',
    s2Title: 'Enter the areas',
    s2Hint: 'One row per room. Give a size in metres, or type the area directly. Every figure stays editable — nothing here is inferred without you seeing it.',
    colRoom: 'Room', colW: 'Width (m)', colH: 'Length (m)', colArea: 'Area (m²)',
    colWaste: 'Waste', colRemove: 'Remove',
    totalNet: 'Total net area', addRoom: '+ Add a room',
    s3Title: 'The material',
    slabLabel: 'Slab or tile size (cm)', slabHelp: 'The raw piece you buy, e.g. 295x175',
    maxSideLabel: 'Largest practical side (cm)', maxSideHelp: 'Above this a tile is hard to carry and easy to crack',
    minSideLabel: 'Smallest side worth cutting (cm)', minSideHelp: 'Below this it stops being large format',
    boxLabel: 'm² per box (optional)', boxHelp: 'From the product datasheet. Leave empty to skip boxes.',
    s4Title: 'Result',
    printBtn: 'Print / save as PDF',
    printHint: 'Prints the quantities, the layout, and the assumptions behind them.',
    footerNote: 'Quantities only. This tool does not price the job, and it has no supplier attached to it.',
    footerOffline: 'works offline once loaded',

    wasteStraight: 'straight lay 10%',
    wasteDiagonal: 'diagonal / many corners 15%',
    wasteLarge: 'large format 15%',
    wasteNone: 'none 0%',

    needAreas: 'Add at least one room with an area above, and the quantities will appear here.',
    badSlab: 'That slab size could not be read. Use a size like 295x175 (centimetres).',
    noCut: 'No zero-waste cut exists between {min} and {max} cm per side. Widen the range, or pick one of the off-the-shelf sizes below and accept its waste.',
    recommended: 'Recommended cut',
    perSlab: 'tiles per slab',
    zeroWaste: 'zero waste at the slab',
    tileArea: 'per tile',
    kTiles: 'Tiles needed', kSlabs: 'Slabs to order', kBoxes: 'Boxes to order',
    kOrdered: 'Ordered area', kNet: 'Net area',
    nAllowance: 'includes {pct}% allowance',
    nRounded: 'rounded up to whole boxes',
    nNoAllowance: '{n} without any allowance',
    figCap: 'One slab, cut {rows}×{cols}. Nothing is left over.',
    compareTitle: 'What the same slab costs at off-the-shelf sizes',
    colTile: 'Tile', colPerSlab: 'Per slab', colWasteCol: 'Waste',
    notesTitle: 'Behind these numbers',
    noteSource: 'Areas came from what you typed, not from anything the tool inferred on its own.',
    noteAllowance: 'The allowance covers breakage and site cuts. It is a convention, not a measurement.',
    noteScale: 'If you measured off the drawing, check the calibration against a second written dimension before ordering.',
    noteBoxes: 'Boxes assume {m2} m² per box. Confirm it against the product datasheet.',
    noteNoBoxes: 'Boxes are not shown because m² per box was left empty.',
    noteWaste: 'Waste at the slab is separate from waste at the walls: a zero-waste cut still leaves offcuts where the tile meets the room edge.',
    pageOf: 'Page {n} of {total}',
    noText: 'This page has no text layer — it is a scan. Read the dimensions off the image and type them in.',
    foundDims: 'Click a number to use it. These come from the drawing’s own text layer.',
    scanning: 'Reading the drawing…',
    pdfError: 'That file could not be opened as a PDF.',
  },
  ar: {
    privacyBadge: 'تعمل داخل متصفحك · لا يُرفع شيء',
    s1Title: 'افتح مخططاً',
    s1Hint: 'اختياري. تجاوز إلى الخطوة ٢ إن كانت مساحاتك معروفة سلفاً.',
    dropLabel: 'أفلِت ملف PDF هنا، أو اختر ملفاً',
    dropSub: 'يُفتح الملف محلياً، ولا يُرسل إلى أي جهة.',
    clearPlan: 'إغلاق المخطط',
    zoom: 'تكبير',
    textLayer: 'الأبعاد الموجودة في المخطط',
    s2Title: 'أدخل المساحات',
    s2Hint: 'صف لكل غرفة. أعطِ المقاس بالمتر، أو اكتب المساحة مباشرة. كل رقم يبقى قابلاً للتعديل — ولا شيء هنا يُستنتج دون أن تراه.',
    colRoom: 'الغرفة', colW: 'العرض (م)', colH: 'الطول (م)', colArea: 'المساحة (م²)',
    colWaste: 'الهدر', colRemove: 'حذف',
    totalNet: 'إجمالي المساحة الصافية', addRoom: '+ أضف غرفة',
    s3Title: 'المادة',
    slabLabel: 'مقاس اللوح أو البلاطة (سم)', slabHelp: 'القطعة الخام التي تشتريها، مثل 295x175',
    maxSideLabel: 'أطول ضلع عملي (سم)', maxSideHelp: 'فوقه يصعب حمل البلاطة ويرتفع خطر الكسر',
    minSideLabel: 'أقصر ضلع يستحق القص (سم)', minSideHelp: 'تحته تفقد صفة المقاس الكبير',
    boxLabel: 'م² لكل كرتون (اختياري)', boxHelp: 'من داتاشيت المنتج. اتركه فارغاً لتخطّي الكراتين.',
    s4Title: 'النتيجة',
    printBtn: 'طباعة / حفظ PDF',
    printHint: 'تطبع الكميات ومخطط التقطيع والافتراضات التي بُنيت عليها.',
    footerNote: 'كميات فقط. هذه الأداة لا تسعّر العمل، ولا يقف خلفها أي مورّد.',
    footerOffline: 'تعمل بلا إنترنت بعد أول تحميل',

    wasteStraight: 'فرش مستقيم ١٠٪',
    wasteDiagonal: 'دياغونالي / كثير الزوايا ١٥٪',
    wasteLarge: 'مقاس كبير ١٥٪',
    wasteNone: 'بلا هدر ٠٪',

    needAreas: 'أضف غرفة واحدة على الأقل بمساحة أعلاه، وستظهر الكميات هنا.',
    badSlab: 'تعذّرت قراءة مقاس اللوح. اكتبه بصيغة مثل 295x175 (بالسنتيمتر).',
    noCut: 'لا توجد قصّة بهدر صفر بين {min} و{max} سم للضلع. وسّع المجال، أو اختر أحد المقاسات الجاهزة أدناه واقبل هدرها.',
    recommended: 'القصّة الموصى بها',
    perSlab: 'قطعة لكل لوح',
    zeroWaste: 'هدر صفر عند اللوح',
    tileArea: 'للقطعة الواحدة',
    kTiles: 'القطع المطلوبة', kSlabs: 'الألواح المطلوبة', kBoxes: 'الكراتين المطلوبة',
    kOrdered: 'المساحة المطلوبة', kNet: 'المساحة الصافية',
    nAllowance: 'شاملة احتياطي {pct}٪',
    nRounded: 'مقرّبة لأعلى إلى كراتين كاملة',
    nNoAllowance: '{n} بلا أي احتياطي',
    figCap: 'لوح واحد، مقصوص {rows}×{cols}. لا يتبقّى منه شيء.',
    compareTitle: 'كم يكلّف اللوح نفسه بالمقاسات الجاهزة',
    colTile: 'البلاطة', colPerSlab: 'لكل لوح', colWasteCol: 'الهدر',
    notesTitle: 'خلف هذه الأرقام',
    noteSource: 'المساحات مأخوذة مما كتبته أنت، لا مما استنتجته الأداة من تلقاء نفسها.',
    noteAllowance: 'الاحتياطي يغطّي الكسر والقص في الموقع. وهو عرف مهني لا قياس.',
    noteScale: 'إن كنت قد قِست من المخطط، تحقّق من المعايرة ببُعد مدوَّن ثانٍ قبل الطلب.',
    noteBoxes: 'الكراتين محسوبة على {m2} م² للكرتون. تأكد منها في داتاشيت المنتج.',
    noteNoBoxes: 'الكراتين غير معروضة لأن حقل «م² لكل كرتون» تُرك فارغاً.',
    noteWaste: 'الهدر عند اللوح غير الهدر عند الجدران: القصّة بهدر صفر تترك بواقيَ حيث تلتقي البلاطة بحد الغرفة.',
    pageOf: 'صفحة {n} من {total}',
    noText: 'هذه الصفحة بلا طبقة نص — أي أنها صورة ممسوحة. اقرأ الأبعاد من الصورة واكتبها بنفسك.',
    foundDims: 'انقر رقماً لاستعماله. هذه مأخوذة من طبقة النص في المخطط نفسه.',
    scanning: 'جارٍ قراءة المخطط…',
    pdfError: 'تعذّر فتح هذا الملف كـPDF.',
  },
};

let lang = 'en';
const t = (key, vars = {}) =>
  String(STRINGS[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

const WASTE_CHOICES = [
  { value: 0.10, key: 'wasteStraight' },
  { value: 0.15, key: 'wasteDiagonal' },
  { value: 0.15, key: 'wasteLarge' },
  { value: 0.00, key: 'wasteNone' },
];

/* ─────────────────────────── small helpers ─────────────────────────── */

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of [].concat(children)) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};
const fmt = (n, digits = 2) =>
  n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
const fmtInt = (n) => n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB');

/* ─────────────────────────── room rows ─────────────────────────── */

let rooms = [];
let nextRoomId = 1;

function addRoom(values = {}) {
  rooms.push({
    id: nextRoomId++,
    name: values.name ?? '',
    width: values.width ?? '',
    length: values.length ?? '',
    area: values.area ?? '',
    waste: values.waste ?? 0.10,
  });
  renderRooms();
}

/** Typed area wins; otherwise width × length. Returns 0 when neither is usable. */
function roomArea(room) {
  const typed = Number(room.area);
  if (Number.isFinite(typed) && typed > 0) return typed;
  const w = Number(room.width);
  const l = Number(room.length);
  if (Number.isFinite(w) && Number.isFinite(l) && w > 0 && l > 0) return w * l;
  return 0;
}

const netArea = () => rooms.reduce((sum, r) => sum + roomArea(r), 0);
const grossArea = () => rooms.reduce((sum, r) => sum + roomArea(r) * (1 + r.waste), 0);

/**
 * Rebuild every row. Only called when the set of rows or the language changes —
 * never on a keystroke, or the field being typed into would lose focus.
 */
function renderRooms() {
  const body = $('rooms-body');
  body.replaceChildren();

  for (const room of rooms) {
    const row = el('tr');

    const bind = (field, props) => {
      const input = el('input', props);
      input.value = room[field];
      input.dataset.field = field;
      input.addEventListener('input', () => {
        room[field] = input.value;
        // Width × length and a typed area are alternatives, not both at once.
        if (field === 'area' && input.value) {
          room.width = '';
          room.length = '';
          for (const other of row.querySelectorAll('input[data-field="width"], input[data-field="length"]')) {
            other.value = '';
          }
        }
        if ((field === 'width' || field === 'length') && input.value) {
          room.area = '';
          const areaInput = row.querySelector('input[data-field="area"]');
          if (areaInput) areaInput.value = '';
        }
        refreshTotals();
      });
      return input;
    };

    row.append(
      el('td', {}, bind('name', { type: 'text', placeholder: lang === 'ar' ? 'مثال: صالة' : 'e.g. living room' })),
      el('td', {}, bind('width', { type: 'number', step: '0.01', min: '0', placeholder: '—' })),
      el('td', {}, bind('length', { type: 'number', step: '0.01', min: '0', placeholder: '—' })),
    );

    // The area cell holds both an input (for a typed area) and a computed
    // read-out; refreshTotals shows whichever one applies right now.
    const areaCell = el('td', { className: 'row-area' }, [
      bind('area', { type: 'number', step: '0.01', min: '0', placeholder: '—' }),
      el('span', { className: 'computed' }),
    ]);
    row.append(areaCell);

    const select = el('select');
    WASTE_CHOICES.forEach((choice, index) => {
      select.append(el('option', { value: String(index), selected: choice.value === room.waste && index === WASTE_CHOICES.findIndex((c) => c.value === room.waste) }, t(choice.key)));
    });
    select.addEventListener('change', () => {
      room.waste = WASTE_CHOICES[Number(select.value)].value;
      refreshTotals();
    });
    row.append(el('td', {}, select));

    const remove = el('button', { type: 'button', className: 'link-btn' }, '×');
    remove.setAttribute('aria-label', t('colRemove'));
    remove.addEventListener('click', () => {
      rooms = rooms.filter((r) => r.id !== room.id);
      if (rooms.length === 0) addRoom();
      else renderRooms();
    });
    row.append(el('td', {}, remove));

    row.dataset.roomId = String(room.id);
    body.append(row);
  }

  refreshTotals();
}

/** Update the derived numbers in place, leaving the inputs — and focus — alone. */
function refreshTotals() {
  for (const row of $('rooms-body').querySelectorAll('tr')) {
    const room = rooms.find((r) => String(r.id) === row.dataset.roomId);
    if (!room) continue;
    const areaInput = row.querySelector('input[data-field="area"]');
    const computed = row.querySelector('.computed');
    const derived = !room.area && roomArea(room) > 0;
    areaInput.hidden = derived;
    computed.hidden = !derived;
    computed.textContent = derived ? fmt(roomArea(room)) : '';
  }
  $('total-area').textContent = fmt(netArea());
  renderResults();
}

/* ─────────────────────────── results ─────────────────────────── */

function renderResults() {
  const out = $('result-body');
  out.replaceChildren();

  const area = netArea();
  if (area <= 0) {
    out.append(el('p', { className: 'empty' }, t('needAreas')));
    return;
  }

  let slabW, slabH;
  try {
    [slabW, slabH] = parseDimensions($('slab').value);
  } catch {
    out.append(el('p', { className: 'warn' }, t('badSlab')));
    return;
  }

  const minSide = Number($('min-side').value) || 40;
  const maxSide = Number($('max-side').value) || 150;
  const slabM2 = (slabW * slabH) / 10000;
  const best = recommend(slabW, slabH, null, null, minSide, maxSide);
  const ordered = grossArea();

  if (!best) {
    out.append(el('p', { className: 'warn' }, t('noCut', { min: fmtInt(minSide), max: fmtInt(maxSide) })));
    out.append(comparisonTable(slabW, slabH));
    return;
  }

  // headline
  out.append(el('div', { className: 'headline' }, [
    el('span', { className: 'label' }, t('recommended')),
    el('span', { className: 'big' }, `${fmt(best.widthCm, 1)} × ${fmt(best.heightCm, 1)} cm`),
    el('span', { className: 'label' }, `${fmtInt(best.perSlab)} ${t('perSlab')} · ${t('zeroWaste')} · ${fmt(best.areaM2, 3)} m² ${t('tileArea')}`),
  ]));

  // numbers
  const quantities = takeoff(ordered, best.areaM2, slabM2, 0);
  const bare = takeoff(area, best.areaM2, slabM2, 0);
  const allowancePct = area > 0 ? Math.round(((ordered / area) - 1) * 100) : 0;

  const cells = [
    cell(t('kNet'), `${fmt(area)} m²`, ''),
    cell(t('kOrdered'), `${fmt(ordered)} m²`, t('nAllowance', { pct: fmtInt(allowancePct) })),
    cell(t('kTiles'), fmtInt(quantities.tilesNeeded), ''),
    cell(t('kSlabs'), fmtInt(quantities.slabsBare), t('nNoAllowance', { n: fmtInt(bare.slabsBare) })),
  ];

  const boxM2 = Number($('box-m2').value);
  const hasBoxes = Number.isFinite(boxM2) && boxM2 > 0;
  if (hasBoxes) {
    cells.push(cell(t('kBoxes'), fmtInt(Math.ceil(ordered / boxM2)), t('nRounded')));
  }
  out.append(el('div', { className: 'res-grid' }, cells));

  // diagram
  const canvas = el('canvas', { id: 'layout-canvas' });
  out.append(el('figure', { style: 'margin:0' }, [
    canvas,
    el('figcaption', { className: 'fig-cap' }, t('figCap', { rows: fmtInt(best.rows), cols: fmtInt(best.cols) })),
  ]));
  drawSlab(canvas, slabW, slabH, best);

  // comparison
  out.append(el('h3', { className: 'res-h3' }, t('compareTitle')));
  out.append(comparisonTable(slabW, slabH));

  // notes
  out.append(el('h3', { className: 'res-h3' }, t('notesTitle')));
  const notes = [t('noteSource'), t('noteAllowance'), t('noteWaste'), t('noteScale')];
  notes.push(hasBoxes ? t('noteBoxes', { m2: fmt(boxM2) }) : t('noteNoBoxes'));
  out.append(el('ul', { className: 'notes' }, notes.map((n) => el('li', {}, el('span', {}, n)))));
}

function cell(key, value, note) {
  return el('div', { className: 'res-cell' }, [
    el('span', { className: 'k' }, key),
    el('span', { className: 'v' }, value),
    note ? el('span', { className: 'n' }, note) : el('span', { className: 'n' }, ''),
  ]);
}

function comparisonTable(slabW, slabH) {
  const rows = compareStandardSizes(slabW, slabH).map(([w, h, count, waste]) =>
    el('tr', {}, [
      el('td', {}, `${fmtInt(w)} × ${fmtInt(h)}`),
      el('td', { className: 'num' }, fmtInt(count)),
      el('td', { className: `num ${waste < 0.05 ? 'waste-good' : 'waste-bad'}` }, `${fmt(waste * 100, 1)}%`),
    ]));

  return el('div', { className: 'table-scroll' }, el('table', {}, [
    el('thead', {}, el('tr', {}, [
      el('th', {}, t('colTile')),
      el('th', { className: 'num' }, t('colPerSlab')),
      el('th', { className: 'num' }, t('colWasteCol')),
    ])),
    el('tbody', {}, rows),
  ]));
}

/** Draw the slab divided into its grid, at device resolution. */
function drawSlab(canvas, slabW, slabH, option) {
  const styles = getComputedStyle(document.body);
  const ink = styles.getPropertyValue('--ink').trim();
  const blue = styles.getPropertyValue('--blue').trim();
  const soft = styles.getPropertyValue('--blue-soft').trim();
  const surface = styles.getPropertyValue('--surface').trim();

  const cssWidth = Math.min(canvas.parentElement.clientWidth || 640, 720);
  const pad = 18;
  const scale = (cssWidth - pad * 2) / slabW;
  const cssHeight = slabH * scale + pad * 2;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  // Canvas text inherits the page direction, which would flip "147.5×87.5" into
  // "87.5×147.5" in Arabic — a dimension label that contradicts the drawing.
  ctx.direction = 'ltr';
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const tileW = (slabW / option.rows) * scale;
  const tileH = (slabH / option.cols) * scale;

  for (let row = 0; row < option.rows; row++) {
    for (let col = 0; col < option.cols; col++) {
      const x = pad + row * tileW;
      const y = pad + col * tileH;
      ctx.fillStyle = (row + col) % 2 === 0 ? soft : surface;
      ctx.fillRect(x, y, tileW, tileH);
      ctx.strokeStyle = blue;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, tileW - 1, tileH - 1);

      ctx.fillStyle = blue;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (tileW > 74 && tileH > 26) {
        ctx.fillText(
          `${(slabW / option.rows).toFixed(1)}×${(slabH / option.cols).toFixed(1)}`,
          x + tileW / 2, y + tileH / 2,
        );
      }
    }
  }

  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, slabW * scale, slabH * scale);
}

/* ─────────────────────────── the drawing ─────────────────────────── */

let pdfDoc = null;
let pageNumber = 1;

async function openPdf(file) {
  $('text-status').textContent = t('scanning');
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdfDoc = await pdfjs.getDocument({ data: bytes }).promise;
  } catch {
    $('text-status').textContent = t('pdfError');
    return;
  }
  pageNumber = 1;
  $('plan-name').textContent = file.name;
  $('drop').hidden = true;
  $('plan').hidden = false;
  await showPage();
}

async function showPage() {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: Number($('zoom').value) });
  const canvas = $('page-canvas');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(viewport.width * dpr);
  canvas.height = Math.round(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  await page.render({ canvasContext: ctx, viewport }).promise;

  $('page-label').textContent = t('pageOf', { n: fmtInt(pageNumber), total: fmtInt(pdfDoc.numPages) });
  $('plan-meta').textContent =
    `${Math.round(viewport.width / Number($('zoom').value) * 25.4 / 72)}×` +
    `${Math.round(viewport.height / Number($('zoom').value) * 25.4 / 72)} mm`;

  await showDimensions(page);
}

/** Pull number-looking tokens out of the page's text layer, biggest first. */
async function showDimensions(page) {
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str).join(' ');
  const list = $('dim-list');
  list.replaceChildren();

  if (text.trim().length < 20) {
    $('text-status').textContent = t('noText');
    return;
  }

  const numbers = [...new Set(
    (text.match(/\d[\d.,]*\s*(?:x|×|X)?\s*\d*[\d.,]*/g) || [])
      .map((s) => s.trim())
      .filter((s) => /\d{2,}/.test(s)),
  )].slice(0, 60);

  if (numbers.length === 0) {
    $('text-status').textContent = t('noText');
    return;
  }

  $('text-status').textContent = t('foundDims');
  for (const value of numbers) {
    const button = el('button', { type: 'button' }, value);
    button.addEventListener('click', () => useDimension(value));
    list.append(button);
  }
}

/**
 * Put a clicked dimension into the first empty field, converting millimetres to
 * metres when the number is clearly in mm (a 3600 is 3.60 m, not 3600 m).
 */
function useDimension(raw) {
  const parts = raw.split(/[x×X]/).map((p) => Number(p.replace(/[^\d.]/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length === 0) return;
  const toMetres = (n) => (n > 100 ? n / 1000 : n);

  let room = rooms.find((r) => !r.width && !r.length && !r.area);
  if (!room) { addRoom(); room = rooms[rooms.length - 1]; }

  room.width = String(Number(toMetres(parts[0]).toFixed(3)));
  if (parts.length > 1) room.length = String(Number(toMetres(parts[1]).toFixed(3)));
  room.area = '';
  renderRooms();
}

function closePdf() {
  pdfDoc = null;
  $('plan').hidden = true;
  $('drop').hidden = false;
  $('file').value = '';
  $('dim-list').replaceChildren();
  $('text-status').textContent = '';
}

/* ─────────────────────────── language ─────────────────────────── */

function applyLanguage(next) {
  lang = next;
  document.documentElement.lang = next;
  document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  document.body.dataset.lang = next;
  $('lang-en').setAttribute('aria-pressed', String(next === 'en'));
  $('lang-ar').setAttribute('aria-pressed', String(next === 'ar'));

  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  document.title = next === 'ar'
    ? 'tile-takeoff — حصر البلاط من المخطط'
    : 'tile-takeoff — tile quantities from a floor plan';

  try { localStorage.setItem('tt-lang', next); } catch { /* private mode */ }
  renderRooms();
  if (pdfDoc) showPage();
}

/* ─────────────────────────── wiring ─────────────────────────── */

$('lang-en').addEventListener('click', () => applyLanguage('en'));
$('lang-ar').addEventListener('click', () => applyLanguage('ar'));
$('add-room').addEventListener('click', () => addRoom());
$('print').addEventListener('click', () => window.print());

for (const id of ['slab', 'max-side', 'min-side', 'box-m2']) {
  $(id).addEventListener('input', renderResults);
}

const drop = $('drop');
drop.addEventListener('click', () => $('file').click());
drop.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('file').click(); }
});
drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('dragging');
  const file = event.dataTransfer.files[0];
  if (file) openPdf(file);
});
$('file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) openPdf(file);
});

$('plan-clear').addEventListener('click', closePdf);
$('page-prev').addEventListener('click', () => { if (pageNumber > 1) { pageNumber--; showPage(); } });
$('page-next').addEventListener('click', () => { if (pdfDoc && pageNumber < pdfDoc.numPages) { pageNumber++; showPage(); } });
$('zoom').addEventListener('input', () => { if (pdfDoc) showPage(); });

window.addEventListener('resize', () => { if (netArea() > 0) renderResults(); });

let saved = null;
try { saved = localStorage.getItem('tt-lang'); } catch { /* private mode */ }
addRoom();
applyLanguage(saved === 'ar' ? 'ar' : 'en');
