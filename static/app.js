const $ = (sel) => document.querySelector(sel);

const nameInput = $("#name");
const questionInput = $("#question");
const spreadSelect = $("#spread");
const drawBtn = $("#drawBtn");
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

  // Reset UI
  nameInput.value = "";
  questionInput.value = "";
  spreadSelect.value = "3";

  cardsEl.innerHTML = "";
  interpretationEl.textContent = "";
  setStatus("");

  drawBtn.disabled = false;
  nameInput.focus();
}

function sanitizeDisplayName(filenameOrName) {
  // display_name ya viene sin extensión desde backend, pero por si acaso:
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

async function fetchInterpretation(name, question, cards) {
  const res = await fetch("/api/interpretation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
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
  while (revealIndex < currentCards.length) {
    revealNextCard();
  }
}

async function startDraw() {
  if (isDrawing) return;

  const name = nameInput.value.trim();
  const question = questionInput.value.trim();
  const count = Number(spreadSelect.value);

  if (!name) {
    setStatus("Escribe el nombre primero.", true);
    nameInput.focus();
    return;
  }

  isDrawing = true;
  drawBtn.disabled = true;
  setStatus("Barajando...");
  interpretationEl.textContent = "";
  cardsEl.innerHTML = "";
  clearTimers();
  revealIndex = 0;

  try {
    currentCards = await fetchCards(count);

    setStatus("Revelando cartas...");
    // Reveal con delay de 1s entre cada carta
    for (let i = 0; i < currentCards.length; i++) {
      const timer = setTimeout(() => {
        revealNextCard();
        if (revealIndex >= currentCards.length) {
          // cuando termina reveal, pedir interpretación
          (async () => {
            setStatus("Generando interpretación...");
            try {
              const text = await fetchInterpretation(name, question, currentCards);
              interpretationEl.textContent = text;
              setStatus("");
              scrollToInterpretation();
            } catch (e) {
              interpretationEl.textContent = "No se pudo generar la interpretación. Intenta de nuevo.";
              setStatus("", false);
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

// Eventos UI
drawBtn.addEventListener("click", startDraw);

document.addEventListener("keydown", (e) => {
  // Evitar que SPACE haga scroll si la página lo permite
  if (e.code === "Space") e.preventDefault();

  if (e.code === "Enter") {
    // ENTER: tirar
    e.preventDefault();
    startDraw();
    return;
  }

  if (e.code === "Space") {
    // SPACE: reset total
    resetAll();
    return;
  }

  if (e.code === "ArrowLeft") {
    // ←: skip reveal (solo si está en reveal)
    if (isDrawing && currentCards.length > 0 && revealIndex < currentCards.length) {
      revealAllRemaining();
      setStatus("Generando interpretación...");
    }
    return;
  }
});

// Estado inicial
resetAll();