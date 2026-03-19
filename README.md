# tarotlive

App local (Flask) para tirar cartas del tarot y generar una interpretación con OpenAI.

## Requisitos
- Python 3.11+ recomendado
- Una carpeta local `Cartas-Tarot/` con imágenes `.jpg` (no se sube al repo)

Estructura esperada:

```text
tarotlive/
  app.py
  requirements.txt
  .env            # local (no se sube)
  Cartas-Tarot/   # local (no se sube)
  templates/
  static/
```

## Setup (Mac / Linux)

Crear entorno virtual e instalar dependencias:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configuración de variables de entorno

Copia el ejemplo:

```bash
cp .env.example .env
```

Edita `.env` y pon tu API key:

```env
OPENAI_API_KEY=tu_key_aqui
OPENAI_MODEL=gpt-4o-mini
```

## Ejecutar

```bash
source .venv/bin/activate
python app.py
```

Luego abre:
- http://127.0.0.1:5000

## Controles
- Botón **Tirar cartas**: inicia la tirada
- **← (flecha izquierda)**: revela todas las cartas restantes al instante
- **ESC**: reset / nueva tirada