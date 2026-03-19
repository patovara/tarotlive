const $ = (sel) => document.querySelector(sel);

const nameInput = $("#name");
const birthdateInput = $("#birthdate");
const birthtimeInput = $("#birthtime");
const questionInput = $("#question");
const spreadSelect = $("#spread");
const drawBtn = $("#drawBtn");
const resetBtn = $("#resetBtn");
const statusEl = $("#status");
const cardsEl = $("#cards");
const interpretationEl = $("#interpretation");

let currentCards = [];
let revealTimers = [];
let isDrawing = false;
let revealIndex = 0;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", !!isError);
}

function clearTimers() {
  revealTimers.forEach((t) => clearTimeout(t));
  revealTimers = [];
}

function resetAll() {
  clearTimers();
  isDrawing = false;
  revealIndex = 0;
  currentCards = [];

  nameInput.value = "";
  birthdateInput.value = "";
  birthtimeInput.value = "";
  questionInput.value = "";
  spreadSelect.value = "3";

  cardsEl.innerHTML = "";
  interpretationEl.textContent = "";
  setStatus("");

  resetBtn.classList.add("hidden");
  drawBtn.disabled = false;

  // Volver al inicio del formulario
  nameInput.scrollIntoView({ behavior: "smooth", block: "start" });
  nameInput.focus();
}

function sanitizeDisplayName(filenameOrName) {
  return String(filenameOrName).replace(/\.(jpg|jpeg|png|webp)$/i, "");
}

function addCardToUI(card) {
  const wrap = document.createElement("div");
  wrap.className = "card";

  const img = document.createElement("img");
  img.alt = card.display_name;
  img.src = card.image_url;

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = sanitizeDisplayName(card.display_name);

  wrap.appendChild(img);
  wrap.appendChild(name);
  cardsEl.appendChild(wrap);
}

async function fetchCards(count) {
  const res = await fetch(`/api/cards?count=${encodeURIComponent(count)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al obtener cartas");
  return data.cards;
}

async function fetchInterpretation(name, birthdate, birthtime, question, cards) {
  const res = await fetch("/api/interpretation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      birthdate,
      birthtime,
      question,
      cards: cards.map((c) => c.display_name),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al generar interpretación");
  return data.interpretation;
}

function scrollToInterpretation() {
  interpretationEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function revealNextCard() {
  if (revealIndex >= currentCards.length) return;
  const card = currentCards[revealIndex];
  addCardToUI(card);
  revealIndex += 1;
}

function revealAllRemaining() {
  clearTimers();
  while (revealIndex < currentCards.length) revealNextCard();
}

// ... arriba ya tienes:
// const birthdateInput = $("#birthdate");
// const birthtimeInput = $("#birthtime");

// Helpers
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function digitsOnly(s) {
  return (s || "").replace(/\D/g, "");
}

/**
 * Formatea DD/MM/AAAA:
 * - auto inserta "/" después de DD y MM
 * - limita DD a 01-31, MM a 01-12
 * - AAAA: 4 dígitos (sin rango duro)
 */
function formatBirthdate(raw) {
  const d = digitsOnly(raw).slice(0, 8); // ddmmyyyy
  let dd = d.slice(0, 2);
  let mm = d.slice(2, 4);
  const yyyy = d.slice(4, 8);

  if (dd.length === 2) {
    const n = clamp(parseInt(dd, 10) || 0, 1, 31);
    dd = String(n).padStart(2, "0");
  }
  if (mm.length === 2) {
    const n = clamp(parseInt(mm, 10) || 0, 1, 12);
    mm = String(n).padStart(2, "0");
  }

  let out = "";
  if (dd.length) out += dd;
  if (mm.length) out += (out.length >= 2 ? "/" : "") + mm;
  if (yyyy.length) out += (out.length >= 5 ? "/" : out.length >= 4 ? "/" : "") + yyyy;

  // Asegura el patrón visual cuando ya hay 2 o 4 dígitos
  // (ej: "20" -> "20/", "2001" -> "20/01/")
  if (d.length === 2) out = `${dd}/`;
  if (d.length === 4) out = `${dd}/${mm}/`;

  return out;
}

/**
 * Formatea HH:MM (24h):
 * - auto inserta ":" después de HH
 * - limita HH a 00-23, MM a 00-59
 */
function formatBirthtime(raw) {
  const d = digitsOnly(raw).slice(0, 4); // hhmm
  let hh = d.slice(0, 2);
  let mm = d.slice(2, 4);

  if (hh.length === 2) {
    const n = clamp(parseInt(hh, 10) || 0, 0, 23);
    hh = String(n).padStart(2, "0");
  }
  if (mm.length === 2) {
    const n = clamp(parseInt(mm, 10) || 0, 0, 59);
    mm = String(n).padStart(2, "0");
  }

  let out = "";
  if (hh.length) out += hh;
  if (mm.length) out += (out.length >= 2 ? ":" : "") + mm;

  if (d.length === 2) out = `${hh}:`; // "14" -> "14:"
  return out;
}

// Mantiene el cursor “bien” al final (simple, suficiente para MVP móvil)
function keepCursorAtEnd(el) {
  const len = el.value.length;
  el.setSelectionRange(len, len);
}

// Auto-formateo en tiempo real
birthdateInput.addEventListener("input", () => {
  const formatted = formatBirthdate(birthdateInput.value);
  if (birthdateInput.value !== formatted) {
    birthdateInput.value = formatted;
    keepCursorAtEnd(birthdateInput);
  }
});

birthtimeInput.addEventListener("input", () => {
  const formatted = formatBirthtime(birthtimeInput.value);
  if (birthtimeInput.value !== formatted) {
    birthtimeInput.value = formatted;
    keepCursorAtEnd(birthtimeInput);
  }
});

// Validaciones (puedes dejar las que ya tenías, pero te las ajusto a los formatos finales)
function isValidBirthdate(v) {
  if (!v) return true;
  const s = v.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;
  const [dd, mm, yyyy] = s.split("/").map(Number);
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  if (yyyy < 1000 || yyyy > 9999) return false;
  return true;
}

function isValidBirthtime(v) {
  if (!v) return true;
  const s = v.trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const [hh, mm] = s.split(":").map(Number);
  if (hh < 0 || hh > 23) return false;
  if (mm < 0 || mm > 59) return false;
  return true;
}

async function startDraw() {
  if (isDrawing) return;

  const name = nameInput.value.trim();
  const birthdate = birthdateInput.value.trim();
  const birthtime = birthtimeInput.value.trim();
  const question = questionInput.value.trim();
  const count = Number(spreadSelect.value);

  if (!name) {
    setStatus("Escribe el nombre primero.", true);
    nameInput.focus();
    return;
  }

  if (!isValidBirthdate(birthdate)) {
    setStatus("Fecha inválida. Usa DD/MM/AAAA (ej: 07/11/1996).", true);
    birthdateInput.focus();
    return;
  }

  if (!isValidBirthtime(birthtime)) {
    setStatus("Hora inválida. Usa HH:MM (ej: 14:30).", true);
    birthtimeInput.focus();
    return;
  }

  isDrawing = true;
  drawBtn.disabled = true;
  resetBtn.classList.add("hidden");
  setStatus("Barajando...");
  interpretationEl.textContent = "";
  cardsEl.innerHTML = "";
  clearTimers();
  revealIndex = 0;

  try {
    currentCards = await fetchCards(count);

    setStatus("Revelando cartas...");
    for (let i = 0; i < currentCards.length; i++) {
      const timer = setTimeout(() => {
        revealNextCard();
        if (revealIndex >= currentCards.length) {
          (async () => {
            setStatus("Generando interpretación...");
            try {
              const text = await fetchInterpretation(
                name,
                birthdate,
                birthtime,
                question,
                currentCards
              );
              interpretationEl.textContent = text;
              setStatus("");
              resetBtn.classList.remove("hidden");
              scrollToInterpretation();
            } catch (e) {
              interpretationEl.textContent =
                "No se pudo generar la interpretación. Intenta de nuevo.";
              setStatus("", false);
              resetBtn.classList.remove("hidden");
              scrollToInterpretation();
            } finally {
              isDrawing = false;
              drawBtn.disabled = false;
            }
          })();
        }
      }, i * 1000);

      revealTimers.push(timer);
    }
  } catch (e) {
    setStatus(e.message || "Error", true);
    isDrawing = false;
    drawBtn.disabled = false;
  }
}

// Botones
drawBtn.addEventListener("click", startDraw);
resetBtn.addEventListener("click", resetAll);

// Teclado
document.addEventListener("keydown", (e) => {
  // ENTER: tirar, pero no si estás escribiendo dentro de inputs (para evitar tiros accidentales)
  if (e.code === "Enter") {
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (isTyping) return;

    e.preventDefault();
    startDraw();
    return;
  }

  if (e.code === "ArrowLeft") {
    if (isDrawing && currentCards.length > 0 && revealIndex < currentCards.length) {
      revealAllRemaining();
      setStatus("Generando interpretación...");
    }
    return;
  }

  // ESC como reset rápido (no afecta escritura)
  if (e.code === "Escape") {
    resetAll();
  }
});

// Estado inicial
resetAll();