Got it! Here's a **simple and focused `README.md`** that only covers the `package.json` commands and `.env.example` setup for your Vite + Convex app:

---

````markdown
# Vite + Convex App

Full-stack app powered by Vite (frontend) and Convex (backend).

## 📦 Setup

Install dependencies:

```bash
pnpm install
````

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

## 🧪 Scripts

### Start local development (frontend + backend)

```bash
pnpm dev
```

### Start only frontend (Vite)

```bash
pnpm dev:frontend
```

### Start only backend (Convex)

```bash
pnpm dev:backend
```

### Lint + type check frontend & backend

```bash
pnpm run lint
```

## 🌐 Environment Variables (`.env.example`)

```env
# Convex Configuration
CONVEX_DEPLOYMENT=
VITE_CONVEX_URL=
SITE_URL=

# Authentication - GitHub OAuth
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Authentication - Google OAuth  
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# AssemblyAI API
ASSEMBLYAI_API_KEY=

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
OPENAI_API_VERSION=

# Google Cloud
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=

# Openrouter
OPENROUTER_BASE_URL=
OPENROUTER_API_KEY=

# Deepseek
DEEPSEEK_API_KEY=
```
