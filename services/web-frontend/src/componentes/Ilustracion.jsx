// Ilustraciones propias por categoría. Se usan cuando el producto todavía no tiene foto.

const FONDOS = {
  piscos: '#D9E6D3',
  vinos: '#E9DCE5',
  tejas: '#F1E6CC',
  chocotejas: '#E8DDD5',
  dulces: '#ECE5D2',
  canastas: '#DEE6D6',
};

function Pisco() {
  return (
    <g>
      <rect x="88" y="18" width="24" height="16" rx="3" fill="#B7791F" />
      <path d="M92 34h16v22c0 6 18 14 18 34v62a8 8 0 0 1-8 8H82a8 8 0 0 1-8-8V90c0-20 18-28 18-34z" fill="#23412E" />
      <rect x="80" y="104" width="40" height="34" rx="3" fill="#F6F3EA" />
      <path d="M100 112c-5 0-8 3-8 7 0 2 1 3 3 4l-1 6h3l1-5h4l1 5h3l-1-6c2-1 3-2 3-4 0-4-3-7-8-7z" fill="#23412E" />
    </g>
  );
}

function Vino() {
  return (
    <g>
      <rect x="91" y="14" width="18" height="26" rx="3" fill="#2E1328" />
      <path d="M91 40h18v16c0 8 16 12 16 30v66a8 8 0 0 1-8 8H83a8 8 0 0 1-8-8V86c0-18 16-22 16-30z" fill="#6B2D5C" />
      <rect x="80" y="102" width="40" height="38" rx="3" fill="#F6F3EA" />
      <circle cx="94" cy="118" r="4" fill="#6B2D5C" /><circle cx="102" cy="118" r="4" fill="#6B2D5C" />
      <circle cx="98" cy="125" r="4" fill="#6B2D5C" /><circle cx="106" cy="125" r="4" fill="#6B2D5C" />
      <circle cx="102" cy="132" r="4" fill="#6B2D5C" />
    </g>
  );
}

function Teja() {
  return (
    <g>
      <path d="M44 92l-18-14v28zM156 92l18-14v28z" fill="#F6F3EA" stroke="#C9B48A" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="100" cy="92" rx="58" ry="30" fill="#F6F3EA" stroke="#C9B48A" strokeWidth="2" />
      <path d="M62 92c12-8 24-8 38 0s26 8 38 0" fill="none" stroke="#B7791F" strokeWidth="3" strokeLinecap="round" />
      <path d="M62 104c12-8 24-8 38 0s26 8 38 0" fill="none" stroke="#B7791F" strokeWidth="3" strokeLinecap="round" opacity=".5" />
    </g>
  );
}

function Chocoteja() {
  return (
    <g>
      <rect x="54" y="58" width="92" height="72" rx="18" fill="#4A2C21" />
      <path d="M66 74c10 8 18-6 28 2s18-6 28 2 14-4 14-4" fill="none" stroke="#C69C6D" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="100" cy="104" rx="16" ry="10" fill="#8A5A3B" />
      <path d="M90 104c6-4 14-4 20 0" fill="none" stroke="#4A2C21" strokeWidth="2" />
    </g>
  );
}

function Dulce() {
  return (
    <g>
      <rect x="66" y="40" width="68" height="16" rx="4" fill="#B7791F" />
      <path d="M70 56h60l6 14v72a10 10 0 0 1-10 10H74a10 10 0 0 1-10-10V70z" fill="#F6F3EA" stroke="#C9B48A" strokeWidth="2" />
      <rect x="64" y="86" width="72" height="40" fill="#C98F4B" />
      <path d="M86 106c4-8 10-8 14 0s10 8 14 0" fill="none" stroke="#F6F3EA" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Canasta() {
  return (
    <g>
      <path d="M52 86c0-36 96-36 96 0" fill="none" stroke="#8A5A3B" strokeWidth="7" strokeLinecap="round" />
      <rect x="114" y="54" width="14" height="40" rx="2" fill="#23412E" />
      <rect x="117" y="44" width="8" height="12" rx="2" fill="#B7791F" />
      <rect x="74" y="66" width="14" height="28" rx="2" fill="#6B2D5C" />
      <path d="M40 88h120l-12 56a8 8 0 0 1-8 6H60a8 8 0 0 1-8-6z" fill="#C98F4B" />
      <path d="M48 106h104M52 124h96" stroke="#8A5A3B" strokeWidth="3" />
    </g>
  );
}

const DIBUJOS = { piscos: Pisco, vinos: Vino, tejas: Teja, chocotejas: Chocoteja, dulces: Dulce, canastas: Canasta };

export function Ilustracion({ categoria, imagen, nombre }) {
  if (imagen) {
    return <img className="ilustracion" src={imagen} alt={nombre} loading="lazy" />;
  }
  const Dibujo = DIBUJOS[categoria] || Canasta;
  return (
    <svg className="ilustracion" viewBox="0 0 200 170" role="img" aria-label={nombre} style={{ background: FONDOS[categoria] || '#E3E8DE' }}>
      <Dibujo />
    </svg>
  );
}
