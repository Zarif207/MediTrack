# MediTrack frontend

React 19 + Vite 8 + Tailwind CSS 4. See the [root README](../README.md) for setup.

```bash
npm install
npm run dev      # http://localhost:5173 (proxies /api to the FastAPI server on :8000)
npm run lint
npm run build
```

- `src/services/api.js` — the only place that calls the API
- `src/context/AuthContext.jsx` — Firebase session + server profile (role, permissions)
- `src/config/access.js`, `src/config/navigation.js` — route access and role-aware navigation
- `src/components/ui/` — design-system components; tokens live in `src/index.css`
- `src/pages/patient/` — patient views; `src/pages/*.jsx` — staff views; `src/pages/public/` — website
