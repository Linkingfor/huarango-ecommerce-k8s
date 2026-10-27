// Sesión del usuario y contador del carrito, compartidos por toda la aplicación.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ErrorApi } from './api.js';

const Contexto = createContext(null);
const CLAVE = 'huarango.sesion';

function leerGuardada() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || null;
  } catch {
    return null;
  }
}

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(leerGuardada);
  const [carrito, setCarrito] = useState({ items: [], unidades: 0, total: 0 });

  const guardar = useCallback((nueva) => {
    setSesion(nueva);
    try {
      if (nueva) localStorage.setItem(CLAVE, JSON.stringify(nueva));
      else localStorage.removeItem(CLAVE);
    } catch {
      /* el navegador puede bloquear el almacenamiento: la sesión dura lo que la pestaña */
    }
  }, []);

  const salir = useCallback(() => {
    guardar(null);
    setCarrito({ items: [], unidades: 0, total: 0 });
  }, [guardar]);

  // Llamada autenticada: si el token venció, cierra la sesión.
  const llamar = useCallback(async (ruta, opciones = {}) => {
    try {
      return await api(ruta, { ...opciones, token: sesion?.token });
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401 && sesion) salir();
      throw e;
    }
  }, [sesion, salir]);

  const refrescarCarrito = useCallback(async () => {
    if (!sesion) return;
    try {
      setCarrito(await llamar('/api/carrito'));
    } catch {
      /* el contador se actualizará en la siguiente acción */
    }
  }, [sesion, llamar]);

  useEffect(() => { refrescarCarrito(); }, [refrescarCarrito]);

  const valor = useMemo(() => ({
    usuario: sesion?.usuario || null,
    esAdmin: sesion?.usuario?.rol === 'admin',
    entrar: (datos) => guardar({ token: datos.token, usuario: datos.usuario }),
    salir,
    llamar,
    carrito,
    setCarrito,
    refrescarCarrito,
  }), [sesion, guardar, salir, llamar, carrito, refrescarCarrito]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useSesion = () => useContext(Contexto);
