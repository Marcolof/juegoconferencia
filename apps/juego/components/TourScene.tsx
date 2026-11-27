"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Ilustraciones animadas del tour (F51). Son SVG dibujados a mano, tomando como
 * referencia las imágenes que pasó Marco, y se animan con CSS (clases `ts-*` en
 * globals.css). Con «reducir movimiento» quedan quietas en el plano de detalle.
 */

const C = {
  halo: "#e6dcfa",
  shadow: "#ddd3f3",
  hair: "#22104a",
  skin: "#f8b7c2",
  skinShade: "#ee9fb0",
  purple: "#8a5ad8",
  pants: "#7d4ccf",
  pantsDark: "#6c3dbb",
  lilac: "#d6c4fb",
  lilacDark: "#b79ff0",
  chair: "#c7b3f4",
  chairLeg: "#9a88cc",
  brand: "#6a3ac7",
  white: "#ffffff",
  soft: "#f1ecfb",
  bar: "#cfc8e6",
  line: "#e3e0f0",
} as const;

const origin = (x: number, y: number): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });
const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/* ---------- Piezas comunes ---------- */

const DOTS = [
  [24, 30, 1.6, 0],
  [70, 16, 1.2, 0.8],
  [150, 24, 1.4, 1.6],
  [212, 12, 1.1, 0.4],
  [300, 22, 1.6, 1.2],
  [338, 62, 1.2, 2],
  [16, 118, 1.3, 1.4],
  [342, 150, 1.5, 0.6],
  [26, 214, 1.1, 2.2],
  [334, 238, 1.3, 1],
  [196, 286, 1.2, 1.8],
  [120, 62, 1, 2.4],
  [60, 270, 1.4, 0.2],
  [300, 280, 1, 1.5],
  [40, -40, 1.4, 0.7],
  [180, -70, 1.2, 1.9],
  [316, -30, 1.5, 0.3],
  [96, -110, 1.1, 2.6],
  [262, -120, 1.3, 1.1],
  [30, 340, 1.3, 1.7],
  [330, 360, 1.2, 0.5],
] as const;

function Sparkles() {
  return (
    <g fill={C.white}>
      {DOTS.map(([x, y, r, d], n) => (
        <circle key={n} cx={x} cy={y} r={r} className="ts-twinkle" style={delay(d)} />
      ))}
    </g>
  );
}

/** Estrellita de cuatro puntas que sube y se desvanece. */
function Star({ x, y, d = 0, size = 1, color = C.lilacDark }: { x: number; y: number; d?: number; size?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <path className="ts-rise" style={delay(d)} d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill={color} />
    </g>
  );
}

/** Globo de diálogo que aparece y desaparece; `d` desfasa el ciclo. */
function Bubble({ x, y, d = 0, tail = "left", children }: { x: number; y: number; d?: number; tail?: "left" | "right"; children?: ReactNode }) {
  const tailPath = tail === "left" ? `M${x + 8} ${y + 20} L${x + 4} ${y + 28} L${x + 16} ${y + 21} Z` : `M${x + 30} ${y + 20} L${x + 34} ${y + 28} L${x + 22} ${y + 21} Z`;
  return (
    <g className="ts-bubble" style={{ ...delay(d), transformOrigin: tail === "left" ? "0% 100%" : "100% 100%" }}>
      <rect x={x} y={y} width="38" height="22" rx="11" fill={C.white} />
      <path d={tailPath} fill={C.white} />
      {children ?? (
        <g fill={C.brand}>
          {[0, 1, 2].map((n) => (
            <circle key={n} cx={x + 11 + n * 8} cy={y + 11} r="2.4" className="ts-dot" style={delay(n * 0.15)} />
          ))}
        </g>
      )}
    </g>
  );
}

/*
 * Manos dibujadas por Marco (F51): `public/hand 1.svg`, `hand 2.svg`,
 * `SVG HAND PALMA.svg` y `SVG HAND PULGAR.svg`. Se copian acá como trazados para
 * poder ubicarlas y animarlas dentro de la escena.
 */
const HAND_BACK = "M21.6602 68.1035L17.9619 66.2645C15.3028 64.9422 12.1809 66.8764 12.1809 69.8461L12.1809 123.548L15.4654 150.321C17.3817 165.942 28.2801 178.988 43.311 183.653L46.5637 184.662C59.3619 188.635 73.2989 185.934 83.6874 177.469L91.6338 170.995C104.492 160.518 116.458 148.993 127.411 136.538L168.326 90.0137C170.508 87.5328 170.995 83.988 169.563 81.0105C167.331 76.3686 161.432 74.8935 157.278 77.9384L121.35 104.272C120.403 104.966 119.242 103.742 119.984 102.833L158.35 55.8709C160.632 53.0773 160.876 49.1387 158.956 46.0846C156.047 41.4554 149.56 40.7951 145.777 44.7429L103.308 89.0623C102.489 89.9171 101.125 88.8988 101.72 87.8759C112.769 68.907 127.894 43.0174 135.478 30.042C138.081 25.5879 136.5 19.8742 131.985 17.3789C127.882 15.1115 122.73 16.2982 120.032 20.1319L77.9433 79.9476C77.2739 80.8989 75.794 80.1339 76.1831 79.0377L94.9458 26.1754C96.4052 22.0637 94.7307 17.4956 90.9598 15.3011C86.2494 12.56 80.2023 14.5618 78.058 19.5722L40.9448 106.289C40.5726 107.159 39.313 107.073 39.0614 106.161L32.035 80.6927C30.5231 75.2125 26.7505 70.6347 21.6602 68.1035Z";
const HAND_FRONT = "M127.779 48.6386L128.838 47.4795C130.972 45.1447 134.844 46.0939 135.656 49.151L140.564 67.6202C144.285 81.6237 146.987 95.8784 148.648 110.272L148.932 112.732C150.396 125.426 145.027 137.947 134.821 145.636C123.988 153.798 109.489 155.184 97.3059 149.222L73.2123 137.432L18.7765 103.246C16.3473 101.72 15.0712 98.8858 15.5397 96.0558C16.2905 91.5207 21.079 88.876 25.3173 90.6555L51.7226 101.742C52.8209 102.203 53.6605 100.702 52.6927 100.007L17.834 74.9936C15.0473 72.9939 13.715 69.5296 14.4437 66.1779C15.7001 60.3988 22.2791 57.5825 27.328 60.6624L65.5285 83.9657C66.5473 84.5872 67.5656 83.2745 66.6948 82.4586C53.3552 69.9598 35.1963 53.8136 26.6829 46.2866C23.7957 43.734 22.7603 39.6936 24.0571 36.0645C26.2842 29.8321 34.084 27.7929 39.0764 32.1378L82.5492 69.9728C83.4422 70.75 84.7064 69.605 84.0212 68.6396L59.7895 34.5019C57.2869 30.9762 57.7317 26.1517 60.8368 23.1431C64.4512 19.6409 70.2668 19.8984 73.5575 23.7063L120.784 78.3557C121.39 79.0566 122.541 78.6282 122.541 77.7018V62.1323C122.541 57.1382 124.409 52.3248 127.779 48.6386Z";
const HAND_PALM = "M258.733 133.887L153.669 490.453C115.682 619.37 227.529 742.818 359.558 717.697C403.845 709.271 439.648 676.688 452.198 633.388L494.086 488.867L545.013 257.154C552.392 223.579 548.031 188.489 532.657 157.742L509.594 111.615C488.104 68.6359 445.436 40.2749 397.489 37.1001C334.287 32.9153 276.636 73.1284 258.733 133.887Z";
const HAND_THUMB = "M95.9466 561.067L149.2 632.693C163.417 651.816 185.418 663.608 209.214 664.86C279.896 668.58 320.255 585.452 273.614 532.212L171.706 415.884C171.666 415.839 171.632 415.788 171.605 415.734L129.165 332.142C126.864 327.609 126.375 322.369 127.799 317.488L129.995 309.958C142.606 266.72 140.253 220.49 123.317 178.755L121.784 174.977C114.832 157.844 90.3468 158.511 84.3376 175.998L30.2621 333.356C24.7868 349.289 24.4813 366.544 29.3891 382.66L65.1206 499.999C71.8125 521.974 82.2404 542.632 95.9466 561.067Z";

/** Mano que gesticula. (wx, wy) es la muñeca dentro del dibujo original; se apoya en (x, y). */
function GestureHand({ d, x, y, wx, wy, r, s }: { d: string; x: number; y: number; wx: number; wy: number; r: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s}) translate(${-wx} ${-wy})`}>
      <path d={d} fill="#F8B7C2" stroke="#EEA6A7" strokeWidth="4" />
    </g>
  );
}

/* ---------- Personas de pie (imagen 2) ---------- */

function StandingMan({ signal = false }: { signal?: boolean }) {
  return (
    <g>
      <ellipse cx="116" cy="278" rx="46" ry="7" fill={C.shadow} />
      {/* brazo de atrás */}
      <path d="M98 100 L92 150" stroke={C.purple} strokeWidth="12" strokeLinecap="round" />
      <circle cx="92" cy="156" r="6" fill={C.skin} />
      <path d="M92 150 H140 L142 268 H90 Z" fill={C.lilac} />
      <path d="M117 176 L116 264" stroke={C.hair} strokeWidth="2" opacity="0.35" />
      <rect x="90" y="264" width="54" height="11" rx="5" fill={C.white} />
      <rect x="110" y="76" width="12" height="18" fill={C.skinShade} />
      <path d="M96 94 Q116 86 138 94 L142 156 H90 Z" fill={C.purple} />
      <path d="M106 91 Q116 98 128 91" stroke={C.white} strokeWidth="4" fill="none" strokeLinecap="round" />
      <g className="ts-nod" style={origin(116, 80)}>
        <ellipse cx="118" cy="62" rx="17" ry="19" fill={C.skin} />
        <path d="M100 68 Q95 40 118 37 Q141 36 137 55 Q124 48 114 52 Q106 56 106 72 Z" fill={C.hair} />
        <circle cx="105" cy="67" r="4.5" fill={C.skin} />
      </g>
      {/* brazo con el teléfono */}
      <path d="M132 100 L142 134 L160 114" stroke={C.purple} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="152.5" y1="122.4" x2="156" y2="118.5" stroke={C.white} strokeWidth="12.5" />
      <g transform="rotate(25 164 104)">
        <rect x="158" y="91" width="12" height="22" rx="3" fill={C.hair} />
      </g>
      <circle cx="161" cy="112" r="6" fill={C.skin} />
      {signal && (
        <path className="ts-blink" d="M170 82 L172 74 M176 87 L183 81 M179 94 L187 92" stroke={C.brand} strokeWidth="2.5" strokeLinecap="round" />
      )}
    </g>
  );
}

function StandingWoman() {
  return (
    <g>
      <ellipse cx="246" cy="278" rx="46" ry="7" fill={C.shadow} />
      <path d="M230 58 Q230 32 250 32 Q272 32 272 62 Q272 100 282 124 Q266 134 256 116 L250 80 Z" fill={C.hair} />
      <path d="M222 150 H270 L274 268 H218 Z" fill={C.purple} />
      <path d="M246 176 L246 264" stroke={C.hair} strokeWidth="2" opacity="0.3" />
      <rect x="218" y="264" width="56" height="11" rx="5" fill={C.white} />
      {/* brazo de atrás */}
      <path d="M264 100 L270 146" stroke={C.lilac} strokeWidth="11" strokeLinecap="round" />
      <circle cx="270" cy="152" r="5.5" fill={C.skin} />
      <rect x="240" y="76" width="12" height="18" fill={C.skinShade} />
      <path d="M224 94 Q246 86 268 94 L270 152 H222 Z" fill={C.lilac} />
      <rect x="222" y="146" width="48" height="7" rx="1" fill={C.white} />
      <path d="M237 92 L244 102 L246 92 Z M255 92 L248 102 L246 92 Z" fill={C.white} />
      <g className="ts-nod" style={{ ...origin(246, 80), ...delay(-1.2) }}>
        <ellipse cx="245" cy="60" rx="16" ry="19" fill={C.skin} />
        <path d="M229.5 58 Q230 40 246 39.5 Q261 40 261.5 52 Q252 45.5 242 48 Q234 50.5 231 62 Z" fill={C.hair} />
        <circle cx="258" cy="64" r="4.5" fill={C.skin} />
      </g>
      {/* brazo con el teléfono */}
      <path d="M230 100 L218 132 L200 118" stroke={C.lilac} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="208" y1="124.2" x2="204.6" y2="121.5" stroke={C.white} strokeWidth="11.5" />
      <g transform="rotate(-25 196 106)">
        <rect x="190" y="94" width="12" height="22" rx="3" fill={C.hair} />
      </g>
      <circle cx="199" cy="116" r="5.5" fill={C.skin} />
    </g>
  );
}

/* ---------- Primer plano de dos teléfonos (imagen 3) ---------- */

function TopBar() {
  return <path d="M6 17 Q6 6 17 6 H69 Q80 6 80 17 V26 H6 Z" fill={C.brand} />;
}

function PhonesClose({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <g>
      <circle cx="180" cy="152" r="112" fill={C.halo} />
      {/* la otra persona: brazo desde arriba a la derecha */}
      <path d="M560 -236 L292 92" stroke={C.lilac} strokeWidth="50" />
      <path d="M314 65 L305 76" stroke={C.white} strokeWidth="50" />
      <ellipse cx="272" cy="104" rx="32" ry="27" fill={C.skin} />
      <g transform="translate(232 52) rotate(16)">
        <rect width="74" height="124" rx="14" fill={C.hair} />
        <rect x="5" y="5" width="64" height="114" rx="10" fill={C.white} />
        {right}
        {[62, 78, 94].map((y) => (
          <rect key={y} x="-7" y={y} width="15" height="12" rx="6" fill={C.skin} />
        ))}
      </g>
      {/* vos: brazo desde abajo a la izquierda */}
      <path d="M-300 600 L80 220" stroke={C.purple} strokeWidth="56" />
      <path d="M50 250 L60 240" stroke={C.white} strokeWidth="56" />
      <ellipse cx="114" cy="214" rx="40" ry="34" fill={C.skin} />
      <g transform="translate(92 94) rotate(14)">
        <rect width="86" height="152" rx="16" fill={C.hair} />
        <rect x="6" y="6" width="74" height="140" rx="11" fill={C.white} />
        {left}
        {[74, 92, 110].map((y) => (
          <rect key={y} x="78" y={y} width="16" height="13" rx="6" fill={C.skin} />
        ))}
        <ellipse cx="0" cy="118" rx="8" ry="18" fill={C.skin} />
      </g>
    </g>
  );
}

/** QR de mentira, armado siempre igual. */
function FakeQr({ x, y, m }: { x: number; y: number; m: number }) {
  const n = 15;
  const cells: ReactNode[] = [];
  const inFinder = (r: number, c: number) => (r < 8 && c < 8) || (r < 8 && c > n - 9) || (r > n - 9 && c < 8);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (inFinder(r, c)) continue;
      if ((r * 31 + c * 17 + r * c * 7) % 11 < 5) cells.push(<rect key={`${r}-${c}`} x={x + c * m} y={y + r * m} width={m} height={m} />);
    }
  }
  const finder = (fx: number, fy: number) => (
    <g key={`${fx}-${fy}`}>
      <rect x={fx} y={fy} width={m * 7} height={m * 7} rx={m * 0.8} />
      <rect x={fx + m} y={fy + m} width={m * 5} height={m * 5} rx={m * 0.5} fill={C.white} />
      <rect x={fx + m * 2} y={fy + m * 2} width={m * 3} height={m * 3} rx={m * 0.4} />
    </g>
  );
  return (
    <g fill={C.hair}>
      {cells}
      {finder(x, y)}
      {finder(x + (n - 7) * m, y)}
      {finder(x, y + (n - 7) * m)}
    </g>
  );
}

function ScannerScreen() {
  return (
    <g>
      <TopBar />
      <rect x="6" y="26" width="74" height="88" fill="#ece4fb" />
      <path d="M18 40 V34 H26 M60 34 H68 V40 M18 92 V98 H26 M60 98 H68 V92" stroke={C.hair} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g className="ts-scan">
        <rect x="18" y="39" width="50" height="12" fill={C.brand} opacity="0.12" />
        <rect x="18" y="36" width="50" height="3" rx="1.5" fill={C.brand} />
      </g>
      <circle cx="43" cy="130" r="10" fill={C.brand} />
      <path d="M38 128 V125 H41 M45 125 H48 V128 M38 132 V135 H41 M45 135 H48 V132" stroke={C.white} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <g className="ts-check ts-c">
        <circle cx="43" cy="66" r="19" fill={C.brand} />
        <path d="M34 66 L40.5 72.5 L52 60" stroke={C.white} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

function ChoosingScreen() {
  const options = [
    { y: 58, w: 38 },
    { y: 80, w: 30 },
    { y: 102, w: 42 },
  ];
  return (
    <g>
      <TopBar />
      <text x="43" y="19.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={C.white}>
        4:52
      </text>
      <rect x="14" y="34" width="58" height="5" rx="2.5" fill={C.hair} opacity="0.8" />
      <rect x="14" y="43" width="40" height="5" rx="2.5" fill={C.hair} opacity="0.8" />
      {options.map((o, n) => (
        <g key={o.y} className="ts-opt" style={delay(n * 0.18)}>
          <rect x="12" y={o.y} width="62" height="16" rx="8" fill={C.white} stroke={C.line} strokeWidth="1.5" />
          <rect x="20" y={o.y + 6} width={o.w} height="4" rx="2" fill={C.bar} />
        </g>
      ))}
      <g className="ts-picked">
        <rect x="12" y="80" width="62" height="16" rx="8" fill={C.brand} />
        <rect x="20" y="86" width="30" height="4" rx="2" fill={C.white} opacity="0.85" />
        <path d="M58 88 L61 91 L67 85" stroke={C.white} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx="54" cy="88" r="9" fill={C.brand} className="ts-tap ts-c" />
    </g>
  );
}

function QrScreen() {
  return (
    <g>
      <rect x="5" y="5" width="64" height="114" rx="10" fill={C.white} />
      <FakeQr x={11.75} y={35} m={3.4} />
    </g>
  );
}

function WaitingScreen() {
  return (
    <g>
      <path d="M5 15 Q5 5 15 5 H59 Q69 5 69 15 V22 H5 Z" fill={C.brand} />
      <circle cx="37" cy="56" r="14" fill="none" stroke={C.halo} strokeWidth="5" />
      <circle cx="37" cy="56" r="14" fill="none" stroke={C.brand} strokeWidth="5" strokeLinecap="round" strokeDasharray="26 100" className="ts-spin ts-c" />
      <text x="37" y="90" textAnchor="middle" fontSize="8" fontWeight="700" fill={C.hair}>
        Esperando…
      </text>
      <rect x="18" y="97" width="38" height="4" rx="2" fill={C.bar} />
    </g>
  );
}

/* ---------- Escenas ---------- */

/** 1 · Conocé gente nueva (imagen 1): dos personas sentadas charlando. */
function SceneMeet() {
  return (
    <g>
      {/* Ella, sentada a la derecha */}
      <ellipse cx="258" cy="284" rx="70" ry="8" fill={C.shadow} />
      <rect x="276" y="214" width="5" height="68" rx="2" fill={C.chairLeg} />
      <path d="M228 232 Q208 162 236 130 Q262 106 298 120 Q324 136 318 182 Q314 226 292 236 Z" fill={C.chair} />
      <path d="M226 70 Q224 34 252 33 Q280 34 279 70 Q280 106 292 138 Q272 148 254 132 Q236 148 214 138 Q226 106 226 70 Z" fill={C.hair} />
      <rect x="246" y="86" width="12" height="18" fill={C.skinShade} />
      <path d="M276 110 Q290 150 244 188" stroke={C.lilac} strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d="M226 106 Q252 96 278 106 L284 176 H222 Z" fill={C.lilac} />
      <path d="M240 101 L250 112 L252 103 Z M264 101 L254 112 L252 103 Z" fill={C.white} />
      <rect x="222" y="170" width="62" height="7" rx="2" fill={C.white} />
      {/* piernas cruzadas */}
      <ellipse cx="270" cy="208" rx="50" ry="13" fill={C.lilacDark} />
      <path d="M240 192 H266 L262 274 H242 Z" fill={C.pantsDark} />
      <rect x="236" y="268" width="36" height="11" rx="5" fill={C.white} />
      <path d="M222 172 H284 Q292 198 262 202 L214 206 Q202 190 222 172 Z" fill={C.pants} />
      <path d="M204 194 L228 202 L206 256 L188 249 Z" fill={C.pants} />
      <g transform="rotate(-24 192 254)">
        <rect x="174" y="248" width="34" height="11" rx="5" fill={C.white} />
      </g>
      <ellipse cx="236" cy="190" rx="11" ry="6" fill={C.skin} />
      <g className="ts-nod" style={{ ...origin(252, 96), ...delay(-0.8) }}>
        <ellipse cx="252" cy="68" rx="18" ry="21" fill={C.skin} />
        <circle cx="234" cy="73" r="5" fill={C.skin} />
        <circle cx="270" cy="73" r="5" fill={C.skin} />
        <path d="M233 72 Q231 42 252 41 Q273 42 271 72 Q266 52 252 50 Q238 52 233 72 Z" fill={C.hair} />
      </g>
      {/* su brazo que gesticula */}
      <g className="ts-sway" style={{ ...origin(232, 112), ...delay(-0.7) }}>
        <path d="M232 112 L222 148 L200 128" stroke={C.lilac} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <line x1="207" y1="134.4" x2="203.3" y2="131" stroke={C.white} strokeWidth="12.5" />
        <GestureHand d={HAND_FRONT} x={201} y={129} wx={128} wy={140} r={-7} s={0.204} />
      </g>

      {/* Él, de espaldas en primer plano */}
      <g className="ts-nod" style={origin(95, 150)}>
        <ellipse cx="118" cy="108" rx="20" ry="26" fill={C.skin} />
        <path d="M78 120 H112 V172 H78 Z" fill={C.skin} />
        <ellipse cx="88" cy="88" rx="44" ry="47" fill={C.hair} />
        <ellipse cx="104" cy="50" rx="28" ry="16" fill={C.hair} />
        <ellipse cx="133" cy="99" rx="8" ry="11" fill={C.skin} />
      </g>
      <path d="M-40 700 V206 Q6 166 64 156 Q128 150 152 196 L176 700 Z" fill={C.purple} />
      <path d="M56 161 Q92 177 126 157" stroke={C.white} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M118 272 Q164 250 204 282 L214 700 H118 Z" fill={C.lilac} />
      <path d="M-40 700 V224 Q50 200 104 226 Q134 244 140 300 L146 700 Z" fill={C.chair} />
      <path d="M-40 236 Q50 206 102 232" stroke={C.lilacDark} strokeWidth="3" fill="none" opacity="0.6" />
      {/* su brazo que gesticula */}
      <g className="ts-sway" style={origin(126, 236)}>
        {/* la mano va detrás del brazo; la manga termina redondeada */}
        <GestureHand d={HAND_BACK} x={168} y={182} wx={55} wy={182} r={12} s={0.29} />
        <path d="M126 236 L170 178" stroke={C.purple} strokeWidth="22" strokeLinecap="round" />
        <line x1="157.7" y1="194.2" x2="161.3" y2="189.4" stroke={C.white} strokeWidth="22.5" />
      </g>

      <Bubble x={184} y={30} tail="right" />
      <Bubble x={140} y={58} d={-2.4} />
      <Star x={190} y={150} d={0.4} />
      <Star x={214} y={176} d={1.5} size={0.8} />
      <Star x={170} y={120} d={2.5} size={0.7} color={C.brand} />
    </g>
  );
}

/** 2 · Mostrá o escaneá un QR (imágenes 2 y 3): plano general y después el escaneo. */
function SceneQr() {
  return (
    <g>
      <g className="ts-shot-a" style={origin(170, 110)}>
        <g transform="translate(-54 -48) scale(1.3)">
          <StandingMan signal />
          <StandingWoman />
        </g>
      </g>
      <g className="ts-shot-b" style={origin(180, 150)}>
        <g transform="translate(-21.6 -18) scale(1.12)">
          <PhonesClose left={<ScannerScreen />} right={<QrScreen />} />
        </g>
      </g>
    </g>
  );
}

/** 3 · Charlá y elegí: plano medio y después los teléfonos (uno elige, el otro espera). */
function SceneChat() {
  return (
    <g>
      <g className="ts-shot-a" style={origin(178, 175)}>
        <g transform="translate(-133.8 -14.8) scale(1.8)">
          <StandingMan />
        </g>
        <g transform="translate(-157.8 -14.8) scale(1.8)">
          <StandingWoman />
        </g>
        <g transform="translate(100 4) scale(1.35)">
          <Bubble x={0} y={0} tail="left">
            <text x={19} y={16} textAnchor="middle" fontSize="15" fontWeight="800" fill={C.brand}>
              ?
            </text>
          </Bubble>
        </g>
        <g transform="translate(206 10) scale(1.35)">
          <Bubble x={0} y={0} d={-2.4} tail="right" />
        </g>
      </g>
      <g className="ts-shot-b" style={origin(180, 150)}>
        <g transform="translate(-21.6 -18) scale(1.12)">
          <PhonesClose left={<ChoosingScreen />} right={<WaitingScreen />} />
        </g>
      </g>
    </g>
  );
}

/** Cuenta de encuentros y puntos que sube y vuelve a empezar. */
function useCountUp() {
  const FINAL = { encounters: 4, points: 3 };
  const [v, setV] = useState({ encounters: 0, points: 0 });
  useEffect(() => {
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* sin matchMedia: se anima */
    }
    if (reduce) {
      setV(FINAL);
      return;
    }
    let tick = 0;
    const id = window.setInterval(() => {
      tick = (tick + 1) % 14;
      // ticks 1..7 suben de a uno, alternando; 8..13 se queda en el final; 0 reinicia.
      const steps = Math.min(tick, 7);
      setV({ encounters: Math.min(Math.ceil(steps / 2) + (steps > 6 ? 1 : 0), FINAL.encounters), points: Math.min(Math.floor(steps / 2), FINAL.points) });
    }, 650);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ...v, done: v.encounters === FINAL.encounters && v.points === FINAL.points };
}

/** 4 · Mirá tu progreso: el teléfono en la mano con «Mi progreso». */
function SceneProgress() {
  const { encounters, points, done } = useCountUp();
  return (
    <g transform="translate(-45 -40) scale(1.25)">
      <circle cx="180" cy="152" r="112" fill={C.halo} />
      <Star x={92} y={92} d={0.2} size={1.2} />
      <Star x={270} y={76} d={1.3} />
      <Star x={262} y={168} d={2.2} size={0.9} color={C.brand} />
      <Star x={98} y={176} d={0.9} size={0.8} color={C.brand} />
      <g className="ts-bob" style={origin(180, 300)}>
        <path d="M118 700 L180 262" stroke={C.purple} strokeWidth="56" />
        <path d="M173.6 307 L175 297" stroke={C.white} strokeWidth="56.5" />
        {/* palma (detrás del teléfono) y pulgar (delante), dibujados por Marco sobre el mismo lienzo */}
        <g transform="translate(100 84) scale(0.254)">
          <path d={HAND_PALM} fill="#FEBBC3" />
        </g>
        <g transform="translate(128 36)">
          <rect width="104" height="190" rx="18" fill={C.hair} />
          <rect x="6" y="6" width="92" height="178" rx="13" fill={C.white} />
          <rect x="12" y="16" width="42" height="14" rx="7" fill={C.brand} />
          <text x="33" y="25.5" textAnchor="middle" fontSize="6" fontWeight="700" fill={C.white}>
            Mi progreso
          </text>
          <rect x="56" y="16" width="36" height="14" rx="7" fill={C.soft} />
          <text x="74" y="25.5" textAnchor="middle" fontSize="6" fontWeight="600" fill="#6b6785">
            Jugadores
          </text>
          <g key={done ? "top" : "base"} className="ts-msg">
            <text x="52" y="46" textAnchor="middle" fontSize="7" fontWeight="700" fill={done ? C.brand : C.hair}>
              {done ? "¡Estás entre" : "Conocé gente"}
            </text>
            <text x="52" y="56" textAnchor="middle" fontSize="7" fontWeight="700" fill={done ? C.brand : C.hair}>
              {done ? "los primeros 10!" : "y sumá puntos"}
            </text>
          </g>
          <rect x="12" y="66" width="38" height="48" rx="8" fill={C.soft} />
          <text x="31" y="94" textAnchor="middle" fontSize="20" fontWeight="800" fill={C.brand}>
            {encounters}
          </text>
          <text x="31" y="106" textAnchor="middle" fontSize="5.5" fontWeight="600" fill="#6b6785">
            Encuentros
          </text>
          <rect x="54" y="66" width="38" height="48" rx="8" fill={C.soft} />
          <text x="73" y="94" textAnchor="middle" fontSize="20" fontWeight="800" fill={C.brand}>
            {points}
          </text>
          <text x="73" y="106" textAnchor="middle" fontSize="5.5" fontWeight="600" fill="#6b6785">
            Puntos
          </text>
          {points > 0 && (
            <text key={points} x="86" y="74" textAnchor="middle" fontSize="8" fontWeight="800" fill={C.brand} className="ts-plus ts-c">
              +1
            </text>
          )}
          {[124, 144, 164].map((y, n) => (
            <g key={y}>
              <circle cx="20" cy={y + 6} r="6" fill={n === 0 ? C.lilac : n === 1 ? C.chair : C.halo} />
              <rect x="31" y={y + 2} width={[44, 36, 50][n]} height="4" rx="2" fill={C.bar} />
              <rect x="31" y={y + 8} width={[26, 32, 20][n]} height="3" rx="1.5" fill={C.line} />
            </g>
          ))}
        </g>
        <g transform="translate(100 84) scale(0.254)">
          <path d={HAND_THUMB} fill="#FEBBC3" />
        </g>
      </g>
    </g>
  );
}

const SCENES = [SceneMeet, SceneQr, SceneChat, SceneProgress];

/** Ilustración animada del paso `step` del tour (0 a 3). Decorativa: el texto del paso la explica. */
export function TourScene({ step }: { step: number }) {
  const Scene = SCENES[step] ?? SceneMeet;
  return (
    <svg viewBox="0 0 360 300" className="ts ts-enter h-full w-full" preserveAspectRatio="xMidYMid meet" overflow="visible" aria-hidden focusable="false">
      <Sparkles />
      <Scene />
    </svg>
  );
}
