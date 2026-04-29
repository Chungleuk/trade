import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { PositionSizingModeProvider } from './context/PositionSizingModeContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PositionSizingModeProvider>
      <App />
    </PositionSizingModeProvider>
  </StrictMode>
);
