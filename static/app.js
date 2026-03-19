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

function isValidBirthdate(v) {
  if (!v) return true;
  return /^\d{2}\/\d{2}\/\d{4}$/.test(v.trim());
}

function isValidBirthtime(v) {
  if (!v) return true;
  // HH:MM 24h simple
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim());
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