# Resume Roaster (Version française)

[🇬🇧 English version](./README.md)

Dépose ton CV — obtiens un feedback IA brutal et honnête pour le faire ressortir.

Starter prêt pour GitHub + Hugging Face Spaces (Docker), avec :

- upload de CV (PDF / DOCX / TXT)
- extraction de texte côté backend
- abstraction de provider LLM (`huggingface` ou `openai`)
- mode démo fallback dans l’UI
- variante frontend statique (`public/index.static.html`) pour hébergement séparé

## 1) Stack

- Node.js 18+
- Express + Multer
- `pdf-parse` pour PDF
- `mammoth` pour DOCX
- Hugging Face Inference API ou OpenAI Chat Completions

## 2) Démarrage rapide (local)

```bash
npm install
cp .env.example .env
```

Ensuite, édite `.env` avec ton provider et ta clé API.

```bash
npm start
```

Ouvre : `http://localhost:7860`

## 3) Variables d’environnement

Voir `.env.example`.

Minimum requis :

- Si `LLM_PROVIDER=huggingface` :
  - `HF_API_KEY`
  - `HF_MODEL` optionnel
- Si `LLM_PROVIDER=openai` :
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` optionnel

## 4) Contrat API

### `POST /api/roast`

`multipart/form-data`

- `resume` : fichier (PDF, DOCX, TXT)
- `systemInstruction` : accepté, mais le backend impose le prompt système serveur pour la sécurité

Réponse succès :

```json
{
  "feedback": "...",
  "meta": {
    "provider": "huggingface",
    "model": "meta-llama/Llama-3.1-8B-Instruct"
  }
}
```

## 5) Déploiement Hugging Face Spaces (recommandé)

Le repo est déjà configuré pour un **Docker Space** via le front-matter du README principal.

### Étapes

1. Crée un nouveau **Docker Space** sur Hugging Face.
2. Push ce repository.
3. Dans **Settings → Variables and secrets**, ajoute :
   - `LLM_PROVIDER`
   - `HF_API_KEY` ou `OPENAI_API_KEY`
   - variables modèle optionnelles
4. Le Space build et sert sur le port `7860`.

## 6) Option frontend statique

Si tu héberges le frontend séparément (GitHub Pages / hébergement statique), utilise :

- `public/index.static.html`

Avant le script, définis l’URL d’API :

```html
<script>
  window.RESUME_ROASTER_API_BASE = "https://ton-api.com";
</script>
```

La page appellera ensuite `https://ton-api.com/api/roast`.

Pense à régler `CORS_ORIGIN` côté backend.

## 7) Notes sécurité

- Ne jamais commit `.env`
- Garder les clés API uniquement en variables d’environnement/secrets
- Garder le prompt système authoritative côté serveur
- Limiter la taille upload via `MAX_FILE_SIZE_MB`

## 8) Structure du projet

```
.
├── index.html                # UI principale servie par Express
├── public/
│   └── index.static.html     # Variante frontend statique
├── server.js                 # API + extraction + logique provider
├── package.json
├── .env.example
├── .gitignore
├── Dockerfile
├── README.md
└── README.fr.md
```

## 9) Résolution des problèmes

- `HF_API_KEY is missing in environment.`
  - ajoute la clé dans `.env` ou dans les secrets HF Space
- `Could not extract readable text`
  - essaie un PDF/DOCX textuel (les scans image nécessitent de l’OCR)
- `API error (4xx/5xx)` côté frontend
  - vérifie les logs backend et les credentials/provider/model

## 10) Checklist qualité

- `npm run check` passe
- `GET /health` répond `{ "ok": true, ... }`
- `.env` n’est pas commité (protégé par `.gitignore`)
- `package-lock.json` est versionné pour des installs reproductibles
