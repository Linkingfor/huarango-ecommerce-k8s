import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/600.css';
import './estilos.css';
import { App } from './App.jsx';
import { ProveedorSesion } from './sesion.jsx';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <ProveedorSesion>
      <App />
    </ProveedorSesion>
  </StrictMode>,
);
