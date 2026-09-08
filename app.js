// ---- Feste Inhalte (hier später einfach anpassen) ----
const TITLE_TEXT = "AUGSBURG";
const DATE_TEXT = "September 19th & 20th";
const TEXT_COLOR = "#03111F";

const CANVAS_W = 1080;
const CANVAS_H = 1920;

// Position der Foto-Fläche (Bounding Box der Blob-Form innerhalb der Canvas)
const PHOTO_BOX = { x: 100, y: 409, w: 980, h: 1511 };

// Logo-Box: rechts/oben ausgerichtet, Größe passt sich dem Logo-Seitenverhältnis an
const LOGO_BOX = { right: 1043, top: 35, maxW: 340, maxH: 210 };

// Textpositionen (x, Baseline-y): Titel oben über dem Foto, Datum & Name unten darunter
const TITLE_POS = { x: 230, y: 430, size: 100 };
const DATE_POS = { x: 40, y: 1580, size: 65 };
const NAME_POS = { x: 40, y: 1700, size: 65 };

const FONT_FAMILY = "WorldClimbingBold";

// ---- Setup ----
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");
const offCanvas = document.createElement("canvas");
offCanvas.width = CANVAS_W;
offCanvas.height = CANVAS_H;
const offCtx = offCanvas.getContext("2d");

const stage = document.getElementById("stage");
const stageHint = document.getElementById("stageHint");
const photoInput = document.getElementById("photoInput");
const nameInput = document.getElementById("nameInput");
const zoomRange = document.getElementById("zoomRange");
const photoControls = document.getElementById("photoControls");
const downloadBtn = document.getElementById("downloadBtn");

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const assets = {};
let userImg = null;
let userImgNatural = { w: 0, h: 0 };

const state = {
  zoom: 1, // 1 = passgenau (cover), bis 3 = reingezoomt
  panX: 0,
  panY: 0,
};

let baseScale = 1;

function computeBaseScale() {
  if (!userImg) return 1;
  return Math.max(
    PHOTO_BOX.w / userImgNatural.w,
    PHOTO_BOX.h / userImgNatural.h
  );
}

function computeImageRect() {
  const scale = baseScale * state.zoom;
  const drawW = userImgNatural.w * scale;
  const drawH = userImgNatural.h * scale;
  const cx = PHOTO_BOX.x + PHOTO_BOX.w / 2;
  const cy = PHOTO_BOX.y + PHOTO_BOX.h / 2;
  const drawX = cx - drawW / 2 + state.panX;
  const drawY = cy - drawH / 2 + state.panY;
  return { drawX, drawY, drawW, drawH };
}

function drawLogo() {
  const logo = assets.logo;
  if (!logo) return;
  const scale = Math.min(LOGO_BOX.maxW / logo.width, LOGO_BOX.maxH / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  const x = LOGO_BOX.right - w;
  const y = LOGO_BOX.top;
  ctx.drawImage(logo, x, y, w, h);
}

function drawTexts() {
  ctx.fillStyle = TEXT_COLOR;
  ctx.textBaseline = "alphabetic";

  ctx.font = `${TITLE_POS.size}px "${FONT_FAMILY}"`;
  ctx.fillText(TITLE_TEXT, TITLE_POS.x, TITLE_POS.y);

  ctx.font = `${DATE_POS.size}px "${FONT_FAMILY}"`;
  ctx.fillText(DATE_TEXT, DATE_POS.x, DATE_POS.y);

  const name = nameInput.value.trim();
  if (name) {
    ctx.font = `${NAME_POS.size}px "${FONT_FAMILY}"`;
    ctx.fillText(name, NAME_POS.x, NAME_POS.y);
  }
}

function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (assets.bg) ctx.drawImage(assets.bg, 0, 0, CANVAS_W, CANVAS_H);

  if (userImg && assets.mask) {
    offCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    offCtx.globalCompositeOperation = "source-over";
    offCtx.drawImage(assets.mask, 0, 0, CANVAS_W, CANVAS_H);
    offCtx.globalCompositeOperation = "source-in";
    const { drawX, drawY, drawW, drawH } = computeImageRect();
    offCtx.drawImage(userImg, drawX, drawY, drawW, drawH);
    offCtx.globalCompositeOperation = "source-over";
    ctx.drawImage(offCanvas, 0, 0);
  }

  if (assets.chalk) ctx.drawImage(assets.chalk, 0, 0, CANVAS_W, CANVAS_H);
  if (assets.accents) ctx.drawImage(assets.accents, 0, 0, CANVAS_W, CANVAS_H);

  drawLogo();
  drawTexts();
}

// ---- Interaktion: Ziehen zum Verschieben ----
let dragging = false;
let dragStart = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };

function canvasScaleFactor() {
  const rect = stage.getBoundingClientRect();
  return CANVAS_W / rect.width;
}

function pointerPos(evt) {
  return { x: evt.clientX, y: evt.clientY };
}

stage.addEventListener("pointerdown", (evt) => {
  if (!userImg) return;
  dragging = true;
  stage.setPointerCapture(evt.pointerId);
  dragStart = pointerPos(evt);
  panStart = { x: state.panX, y: state.panY };
});

stage.addEventListener("pointermove", (evt) => {
  if (!dragging) return;
  const p = pointerPos(evt);
  const f = canvasScaleFactor();
  state.panX = panStart.x + (p.x - dragStart.x) * f;
  state.panY = panStart.y + (p.y - dragStart.y) * f;
  render();
});

function endDrag(evt) {
  dragging = false;
}
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("pointerleave", endDrag);

zoomRange.addEventListener("input", () => {
  state.zoom = parseFloat(zoomRange.value);
  render();
});

nameInput.addEventListener("input", render);

photoInput.addEventListener("change", async () => {
  const file = photoInput.files[0];
  if (!file) return;
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
  const img = await loadImage(dataUrl);
  if (!img) return;

  userImg = img;
  userImgNatural = { w: img.naturalWidth, h: img.naturalHeight };
  baseScale = computeBaseScale();
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  zoomRange.value = "1";

  stageHint.hidden = true;
  photoControls.hidden = false;
  downloadBtn.disabled = false;

  render();
});

downloadBtn.addEventListener("click", () => {
  render();
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const namePart = nameInput.value.trim().replace(/\s+/g, "_") || "EYCH_Augsburg";
    a.href = url;
    a.download = `${namePart}_Story.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
});

// ---- Init ----
async function init() {
  const [bg, mask, chalk, accents, logo] = await Promise.all([
    loadImage("assets/images/bg-base.png"),
    loadImage("assets/images/photo-mask.png"),
    loadImage("assets/images/chalk-texture.png"),
    loadImage("assets/images/accents-lead.png"),
    loadImage("assets/images/logo.png"),
  ]);
  assets.bg = bg;
  assets.mask = mask;
  assets.chalk = chalk;
  assets.accents = accents;
  assets.logo = logo;

  try {
    const face = new FontFace(
      FONT_FAMILY,
      `url(assets/fonts/WorldClimbing-Bold.otf)`
    );
    await face.load();
    document.fonts.add(face);
  } catch (e) {
    console.warn("Font konnte nicht geladen werden, Fallback wird genutzt.", e);
  }

  render();
}

init();
