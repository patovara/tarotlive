import os
import random
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from dotenv import load_dotenv

from openai import OpenAI

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
CARDS_DIR = BASE_DIR / "Cartas-Tarot"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini-2024-07-18").strip()

SYSTEM_PROMPT = (
    "Actúa como una tarotista profesional. Da una interpretación emocional, directa y envolvente. "
    " Usa un lenguaje cercano, como si estuvieras hablando con la persona en persona. "
    " No seas genérica."
    "No expliques cada carta por separado, haz una narrativa fluida. Máximo 120 palabras."
)

app = Flask(__name__)

# Exponer la carpeta de cartas como estático adicional.
# Queda accesible como /cards/<filename>
@app.get("/cards/<path:filename>")
def serve_card(filename):
    # Seguridad básica: solo permitir servir archivos que existan en CARDS_DIR
    # y no permitir path traversal fuera del directorio.
    file_path = (CARDS_DIR / filename).resolve()
    if not str(file_path).startswith(str(CARDS_DIR.resolve())):
        return jsonify({"error": "Ruta inválida"}), 400
    if not file_path.exists() or not file_path.is_file():
        return jsonify({"error": "Carta no encontrada"}), 404

    # Usamos send_from_directory a través de Flask internamente
    from flask import send_from_directory

    return send_from_directory(CARDS_DIR, filename)


@app.get("/")
def index():
    return render_template("index.html")


def list_card_files():
    if not CARDS_DIR.exists() or not CARDS_DIR.is_dir():
        return []

    # Solo .jpg por lo que dijiste. Si luego quieres png, se agrega aquí.
    files = [p.name for p in CARDS_DIR.iterdir() if p.is_file() and p.suffix.lower() == ".jpg"]
    files.sort()
    return files


@app.get("/api/cards")
def api_cards():
    try:
        count = int(request.args.get("count", "3"))
    except ValueError:
        return jsonify({"error": "count inválido"}), 400

    if count not in (1, 3, 5):
        return jsonify({"error": "count debe ser 1, 3 o 5"}), 400

    files = list_card_files()
    if len(files) == 0:
        return jsonify({"error": "No se encontraron cartas en la carpeta Cartas-Tarot (solo .jpg)"}), 500
    if len(files) < count:
        return jsonify({"error": f"No hay suficientes cartas. Encontradas={len(files)} requeridas={count}"}), 500

    chosen = random.sample(files, count)  # sin repetir dentro de la tirada

    cards = []
    for filename in chosen:
        display_name = Path(filename).stem  # nombre sin .jpg
        cards.append(
            {
                "filename": filename,
                "display_name": display_name,
                "image_url": f"/cards/{filename}",
            }
        )

    return jsonify({"cards": cards})


@app.post("/api/interpretation")
def api_interpretation():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    question = (payload.get("question") or "").strip()
    cards = payload.get("cards") or []

    if not name:
        return jsonify({"error": "Falta nombre"}), 400
    if not isinstance(cards, list) or len(cards) == 0:
        return jsonify({"error": "Faltan cartas"}), 400

    # Normalizamos lista a strings
    card_names = []
    for c in cards:
        if isinstance(c, str):
            card_names.append(c)
        elif isinstance(c, dict) and c.get("display_name"):
            card_names.append(str(c["display_name"]))
        else:
            # Ignorar entradas raras
            pass

    if len(card_names) == 0:
        return jsonify({"error": "Cartas inválidas"}), 400

    if not OPENAI_API_KEY:
        return jsonify({"error": "OPENAI_API_KEY no está configurada en .env"}), 500

    client = OpenAI(api_key=OPENAI_API_KEY)

    user_content = (
        f"Nombre: {name}\n"
        f"Pregunta/Contexto: {question if question else '(sin pregunta)'}\n"
        f"Cartas: {', '.join(card_names)}\n"
        "Da la interpretación en español."
    )

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.9,
            max_tokens=220,  # suficiente para 120 palabras aprox
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return jsonify({"error": "La IA no devolvió texto"}), 502
        return jsonify({"interpretation": text})
    except Exception:
        # Mensaje simple (no exponemos detalles)
        return jsonify({"error": "No se pudo generar la interpretación. Intenta de nuevo."}), 502


if __name__ == "__main__":
    # Host 127.0.0.1 para uso local. Cambia a 0.0.0.0 si quieres abrir en red local.
    app.run(host="127.0.0.1", port=5000, debug=True)