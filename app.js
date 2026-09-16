// ---- Feste Inhalte (hier später einfach anpassen) ----
const TITLE_TEXT = "AUGSBURG";
const DATE_LINES = ["September", "19th & 20th"];
const DOMAIN_TEXT = "www.dav-kletterzentrum-augsburg.de";
const TEXT_COLOR = "#03111F";

const CANVAS_W = 1080;
const CANVAS_H = 1920;

// Position der Foto-Fläche (Bounding Box der Blob-Form innerhalb der Canvas)
const PHOTO_BOX = { x: 100, y: 409, w: 980, h: 1511 };

// Logo-Box: rechts/oben ausgerichtet, Größe passt sich dem Logo-Seitenverhältnis an
const LOGO_BOX = { right: 1043, top: 35, maxW: 340, maxH: 210 };

// Textpositionen (x, Baseline-y): Titel oben über dem Foto, Datum & Name unten darunter
const TITLE_POS = { x: 230, y: 430, size: 100 };
const DATE_POS = { x: 40, y: 1560, size: 65, lineHeight: 80 };
const NAME_POS = { x: 40, y: 1760, size: 65 };

// Domain am linken Rand, um 90° gedreht (liest von unten nach oben)
const DOMAIN_POS = { x: 44, yBottom: 1420, size: 26 };

const FONT_FAMILY = "WorldClimbingBold";
// WorldClimbingBold hat keine Ziffern/&-Zeichen, darum fürs Datum eine
// Schrift mit vollständigem Zeichensatz nutzen, statt browserseitigem
// Fallback (der uneinheitliche Strichstärken verursacht).
const DATE_FONT_FAMILY = "AntarcticanMono";

// ---- Sprache (nur Seitentexte - das Bild selbst bleibt unverändert) ----
const TRANSLATIONS = {
  de: {
    title: "EYCH Augsburg – Story Generator",
    intro:
      "Lade dein Foto hoch, positioniere es und lade dein persönliches Story-Bild herunter. Dein Foto wird ausschließlich in deinem Browser verarbeitet und nirgendwo hochgeladen oder gespeichert.",
    stageHint: "Foto hochladen, um zu starten",
    zoom: "Zoom",
    dragHint:
      "Tipp: Foto mit der Maus ziehen (am Handy: mit zwei Fingern), um den Ausschnitt anzupassen. Mit einem Finger kannst du die Seite ganz normal weiterscrollen.",
    photoLabel: "Dein Foto",
    textLabel: "Dein Text",
    textPlaceholder: "z. B. dein Name",
    downloadBtn: "Bild herunterladen",
    privacyNote:
      "🔒 Alles läuft lokal in deinem Browser ab. Es werden keine Bilder oder Namen an einen Server gesendet oder gespeichert.",
    inAppSaveHint: "Bild gedrückt halten und „Bild sichern\" wählen.",
    inAppSaveClose: "Ausblenden",
  },
  en: {
    title: "EYCH Augsburg – Story Generator",
    intro:
      "Upload your photo, position it, and download your personal story image. Your photo is processed entirely in your browser and never uploaded or stored anywhere.",
    stageHint: "Upload a photo to get started",
    zoom: "Zoom",
    dragHint:
      "Tip: drag the photo with your mouse (on mobile: with two fingers) to adjust the crop. With one finger you can keep scrolling the page normally.",
    photoLabel: "Your photo",
    textLabel: "Your text",
    textPlaceholder: "e.g. your name",
    downloadBtn: "Download image",
    privacyNote:
      "🔒 Everything runs locally in your browser. No images or names are ever sent to or stored on a server.",
    inAppSaveHint: "Press and hold the image, then choose \"Save Image\".",
    inAppSaveClose: "Hide",
  },
};

const LANG_STORAGE_KEY = "eych-lang";

function applyLanguage(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.de;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (t[key]) el.placeholder = t[key];
  });
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.langBtn === lang));
  });
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (e) {
    // localStorage kann in manchen Kontexten (z. B. privates Fenster mit
    // blockiertem Speicher) fehlschlagen - dann merken wir uns die Wahl
    // eben nur für diese Sitzung.
  }
}

function initLanguage() {
  let saved = null;
  try {
    saved = localStorage.getItem(LANG_STORAGE_KEY);
  } catch (e) {
    // s.o.
  }
  applyLanguage(saved === "en" ? "en" : "de");

  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.addEventListener("click", () => applyLanguage(btn.dataset.langBtn));
  });
}

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
const inAppSave = document.getElementById("inAppSave");
const inAppSaveImg = document.getElementById("inAppSaveImg");
const inAppSaveClose = document.getElementById("inAppSaveClose");

// Instagram (und aehnliche In-App-Browser) blockieren echte Datei-Downloads
// (a[download] / Blob-URLs). Dort versuchen wir zuerst die Web Share API
// (oeffnet das native "Sichern"-Menue); wenn die nicht verfuegbar ist oder
// fehlschlaegt, zeigen wir das Bild als normalen Seiteninhalt an (kein
// Overlay!), damit man es per Fingerdruck speichern kann.
function isInAppBrowser() {
  return /Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(navigator.userAgent);
}

inAppSaveClose.addEventListener("click", () => {
  inAppSave.hidden = true;
});

function showInAppSaveFallback() {
  inAppSaveImg.src = canvas.toDataURL("image/png");
  inAppSave.hidden = false;
  inAppSave.scrollIntoView({ behavior: "smooth", block: "center" });
}

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

  ctx.font = `${DATE_POS.size}px "${DATE_FONT_FAMILY}"`;
  DATE_LINES.forEach((line, i) => {
    ctx.fillText(line, DATE_POS.x, DATE_POS.y + i * DATE_POS.lineHeight);
  });

  const name = nameInput.value.trim();
  if (name) {
    ctx.font = `${NAME_POS.size}px "${FONT_FAMILY}"`;
    ctx.fillText(name, NAME_POS.x, NAME_POS.y);
  }

  ctx.save();
  ctx.translate(DOMAIN_POS.x, DOMAIN_POS.yBottom);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `${DOMAIN_POS.size}px "${FONT_FAMILY}"`;
  ctx.fillText(DOMAIN_TEXT, 0, 0);
  ctx.restore();
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
// Maus: ein Klick+Ziehen reicht (kein Scroll-Konflikt auf dem Desktop).
// Touch: die Seite soll mit einem Finger weiter scrollbar bleiben, darum
// wird das Foto dort erst mit zwei Fingern verschoben (wie z. B. bei
// eingebetteten Karten üblich).
let dragging = false;
let dragStart = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };
const activeTouches = new Map(); // pointerId -> {x, y}

function canvasScaleFactor() {
  const rect = stage.getBoundingClientRect();
  return CANVAS_W / rect.width;
}

function pointerPos(evt) {
  return { x: evt.clientX, y: evt.clientY };
}

function touchCentroid() {
  const pts = [...activeTouches.values()];
  const sum = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}

function startDrag(pos) {
  dragging = true;
  dragStart = pos;
  panStart = { x: state.panX, y: state.panY };
}

function tryCapture(pointerId) {
  try {
    stage.setPointerCapture(pointerId);
  } catch (e) {
    // Capture ist nur ein "nice to have" (hält das Dragging auch bei
    // schnellen Bewegungen über den Rand hinaus stabil) - falls es aus
    // irgendeinem Grund fehlschlägt, soll das Verschieben trotzdem
    // funktionieren.
  }
}

stage.addEventListener("pointerdown", (evt) => {
  if (!userImg) return;

  if (evt.pointerType === "touch") {
    activeTouches.set(evt.pointerId, pointerPos(evt));
    if (activeTouches.size === 2) {
      tryCapture(evt.pointerId);
      startDrag(touchCentroid());
    }
    return;
  }

  tryCapture(evt.pointerId);
  startDrag(pointerPos(evt));
});

stage.addEventListener("pointermove", (evt) => {
  if (evt.pointerType === "touch") {
    if (!activeTouches.has(evt.pointerId)) return;
    activeTouches.set(evt.pointerId, pointerPos(evt));
    if (activeTouches.size < 2 || !dragging) return;
    evt.preventDefault();
  }

  if (!dragging) return;
  const p = evt.pointerType === "touch" ? touchCentroid() : pointerPos(evt);
  const f = canvasScaleFactor();
  state.panX = panStart.x + (p.x - dragStart.x) * f;
  state.panY = panStart.y + (p.y - dragStart.y) * f;
  render();
});

function endDrag(evt) {
  if (evt.pointerType === "touch") {
    activeTouches.delete(evt.pointerId);
    if (activeTouches.size < 2) dragging = false;
    return;
  }
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

downloadBtn.addEventListener("click", async () => {
  render();
  inAppSave.hidden = true;

  const namePart = nameInput.value.trim().replace(/\s+/g, "_") || "EYCH_Augsburg";

  if (isInAppBrowser()) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      showInAppSaveFallback();
      return;
    }

    let file = null;
    try {
      file = new File([blob], `${namePart}_Story.png`, { type: "image/png" });
    } catch (e) {
      file = null; // sehr alte Browser ohne File-Konstruktor
    }

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return; // erfolgreich geteilt/gespeichert
      } catch (err) {
        if (err && err.name === "AbortError") return; // Nutzer hat abgebrochen
        // sonst: unten auf die Bild-Anzeige zurückfallen
      }
    }

    showInAppSaveFallback();
    return;
  }

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
    const [titleFace, dateFace] = await Promise.all([
      new FontFace(FONT_FAMILY, `url(assets/fonts/WorldClimbing-Bold.otf)`).load(),
      new FontFace(DATE_FONT_FAMILY, `url(assets/fonts/AntarcticanMono-Book.ttf)`).load(),
    ]);
    document.fonts.add(titleFace);
    document.fonts.add(dateFace);
  } catch (e) {
    console.warn("Font konnte nicht geladen werden, Fallback wird genutzt.", e);
  }

  render();
}

initLanguage();
init();
