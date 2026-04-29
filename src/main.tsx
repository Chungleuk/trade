import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootEl = document.getElementById('root')!;

function showMissingEnvScreen() {
  rootEl.innerHTML = `
    <div style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1.5rem;line-height:1.5;color:#1a1a1a">
      <h1 style="font-size:1.25rem;margin-bottom:0.75rem">無法載入儀表板 / Dashboard cannot load</h1>
      <p style="margin:0 0 1rem">此網站需在 Netlify 設定前端環境變數並重新部署。</p>
      <p style="margin:0 0 1rem">Set these in <strong>Netlify → Site configuration → Environment variables</strong>, then trigger a new deploy:</p>
      <ul style="margin:0 0 1rem;padding-left:1.25rem">
        <li><code>VITE_SUPABASE_URL</code> — your Supabase project URL</li>
        <li><code>VITE_SUPABASE_ANON_KEY</code> — Supabase anon (public) key</li>
        <li><code>VITE_BACKEND_URL</code> — optional; defaults to Render URL if omitted</li>
      </ul>
      <p style="margin:0;font-size:0.9rem;color:#555">Vite 會在建置時內嵌這些變數，設定後請重新執行 production deploy。</p>
    </div>
  `;
}

async function bootstrap() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    showMissingEnvScreen();
    return;
  }

  const [{ default: App }, { PositionSizingModeProvider }] = await Promise.all([
    import('./App.tsx'),
    import('./context/PositionSizingModeContext.tsx'),
  ]);

  createRoot(rootEl).render(
    <StrictMode>
      <PositionSizingModeProvider>
        <App />
      </PositionSizingModeProvider>
    </StrictMode>
  );
}

void bootstrap();
