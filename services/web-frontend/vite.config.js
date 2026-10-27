import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo (npm run dev) las llamadas a /api se reenvían a cada servicio corriendo en local.
// En el contenedor, este mismo trabajo lo hace nginx (nginx/default.conf).
const destino = (variable, puerto) => process.env[variable] || `http://localhost:${puerto}`;
const proxy = {
  '/api/usuarios': destino('USUARIOS_URL', 3001),
  '/api/catalogo': destino('CATALOGO_URL', 3002),
  '/media': destino('CATALOGO_URL', 3002),
  '/api/carrito': destino('CARRITO_URL', 3003),
  '/api/ordenes': destino('ORDENES_URL', 3004),
  '/api/pagos': destino('PAGOS_URL', 3005),
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 8080, proxy },
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
});
