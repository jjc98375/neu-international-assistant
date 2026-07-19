// src/components/PixelQuad.tsx
// Hand-drawn pixel-art rendition of the NEU quad photo (Ell Hall facade,
// Centennial lawn, flag, trees). Pure SVG rects on a 320×180 grid so it stays
// crisp at any size. Clouds drift and the flag waves via the quad-cloud /
// quad-flag keyframes in globals.css (disabled under prefers-reduced-motion).

function Cloud({ variant }: { variant: "big" | "mid" | "small" }) {
  if (variant === "big") {
    return (
      <>
        <rect x={2} y={6} width={30} height={6} fill="#ffffff" />
        <rect x={8} y={2} width={18} height={4} fill="#ffffff" />
        <rect x={24} y={4} width={6} height={2} fill="#ffffff" />
        <rect x={2} y={10} width={30} height={2} fill="#ddedf7" />
      </>
    );
  }
  if (variant === "mid") {
    return (
      <>
        <rect x={2} y={4} width={22} height={5} fill="#ffffff" />
        <rect x={6} y={1} width={12} height={3} fill="#ffffff" />
        <rect x={2} y={7} width={22} height={2} fill="#ddedf7" />
      </>
    );
  }
  return (
    <>
      <rect x={1} y={3} width={15} height={4} fill="#ffffff" />
      <rect x={4} y={0} width={9} height={3} fill="#ffffff" />
      <rect x={1} y={5} width={15} height={2} fill="#ddedf7" />
    </>
  );
}

/** One 10-unit-wide bay of the facade window grid. */
function FacadeWindow({ x }: { x: number }) {
  return (
    <>
      <rect x={x} y={70} width={8} height={36} fill="#344052" />
      <rect x={x} y={78} width={8} height={1} fill="#46536a" />
      <rect x={x} y={86} width={8} height={1} fill="#46536a" />
      <rect x={x} y={94} width={8} height={1} fill="#46536a" />
      <rect x={x} y={102} width={8} height={1} fill="#46536a" />
      <rect x={x - 1} y={106} width={10} height={2} fill="#979da7" />
    </>
  );
}

function Tree({
  cx,
  light,
  base,
  shade,
  hi,
}: {
  cx: number;
  light: string;
  base: string;
  shade: string;
  hi: string;
}) {
  return (
    <>
      <rect x={cx - 6} y={56} width={12} height={6} fill={light} />
      <rect x={cx - 12} y={62} width={24} height={10} fill={base} />
      <rect x={cx - 15} y={72} width={30} height={8} fill={base} />
      <rect x={cx - 15} y={78} width={30} height={2} fill={shade} />
      <rect x={cx - 12} y={80} width={24} height={6} fill={shade} />
      <rect x={cx - 3} y={60} width={7} height={4} fill={hi} />
      <rect x={cx - 3} y={86} width={6} height={32} fill="#6b4a2f" />
      <rect x={cx + 1} y={86} width={2} height={32} fill="#57392f" />
      <rect x={cx - 14} y={118} width={30} height={3} fill="#4d8a45" />
    </>
  );
}

// Facade window bays sit every 16 units from x=76; bay 5 (x=156) is the door.
const WINDOW_BAYS = [76, 92, 108, 124, 140, 172, 188, 204, 220, 236];
// Hedgerow along the building base; the two bays around the entrance stay open.
const BUSHES = [78, 92, 106, 120, 134, 176, 190, 204, 218, 232];
const GRASS_SPECKS: [number, number][] = [
  [24, 126], [58, 149], [90, 124], [118, 158], [146, 127], [171, 150],
  [201, 125], [232, 156], [262, 128], [289, 148], [40, 168], [140, 171],
  [216, 166], [300, 170], [76, 131], [252, 133],
];

export function PixelQuad() {
  return (
    <svg
      className="w-full h-full"
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMax slice"
      style={{ shapeRendering: "crispEdges" }}
      aria-hidden
    >
      {/* Sky bands */}
      <rect x={0} y={0} width={320} height={40} fill="#5ba7dd" />
      <rect x={0} y={40} width={320} height={35} fill="#74bce6" />
      <rect x={0} y={75} width={320} height={43} fill="#90cdee" />

      {/* Clouds (drift behind the buildings) */}
      <g transform="translate(0,26)">
        <g className="quad-cloud" style={{ animationDuration: "200s", animationDelay: "-150s" }}>
          <Cloud variant="small" />
        </g>
      </g>
      <g transform="translate(0,30)">
        <g className="quad-cloud" style={{ animationDuration: "160s", animationDelay: "-40s" }}>
          <Cloud variant="big" />
        </g>
      </g>
      <g transform="translate(0,44)">
        <g className="quad-cloud" style={{ animationDuration: "130s", animationDelay: "-100s" }}>
          <Cloud variant="mid" />
        </g>
      </g>

      {/* Left brick hall */}
      <rect x={0} y={55} width={60} height={3} fill="#6e4237" />
      <rect x={0} y={58} width={58} height={60} fill="#8a5646" />
      <rect x={54} y={58} width={4} height={60} fill="#6e4237" />
      {[6, 24, 42].map((wx) =>
        [64, 78, 92, 106].map((wy) => (
          <rect key={`${wx}-${wy}`} x={wx} y={wy} width={10} height={8} fill="#573a31" />
        )),
      )}

      {/* Right glass hall */}
      <rect x={266} y={62} width={54} height={56} fill="#9aa3ad" />
      {[270, 280, 290, 300, 310].map((gx) => (
        <rect key={gx} x={gx} y={62} width={5} height={52} fill="#6c7684" />
      ))}
      <rect x={266} y={114} width={54} height={4} fill="#7d8590" />

      {/* Rooftop flag */}
      <rect x={159} y={16} width={2} height={31} fill="#757b86" />
      <rect x={158} y={14} width={4} height={2} fill="#FFD23F" />
      <g className="quad-flag" style={{ transformOrigin: "161px 17px" }}>
        <rect x={167} y={17} width={8} height={1} fill="#cf4444" />
        <rect x={167} y={18} width={8} height={1} fill="#f2f3f5" />
        <rect x={167} y={19} width={8} height={1} fill="#cf4444" />
        <rect x={167} y={20} width={8} height={1} fill="#f2f3f5" />
        <rect x={161} y={21} width={14} height={1} fill="#cf4444" />
        <rect x={161} y={22} width={14} height={1} fill="#f2f3f5" />
        <rect x={161} y={23} width={14} height={1} fill="#cf4444" />
        <rect x={161} y={17} width={6} height={4} fill="#34518c" />
      </g>

      {/* Main facade — “NORTHEASTERN UNIVERSITY” hall */}
      <rect x={66} y={44} width={188} height={3} fill="#868c97" />
      <rect x={64} y={47} width={192} height={5} fill="#979da7" />
      <rect x={68} y={52} width={184} height={12} fill="#b0b5bd" />
      <rect x={68} y={64} width={184} height={54} fill="#b0b5bd" />
      <rect x={68} y={64} width={6} height={54} fill="#c2c6cd" />
      <rect x={246} y={64} width={6} height={54} fill="#979da7" />
      <rect x={68} y={112} width={184} height={6} fill="#a6abb4" />
      <text
        x={160}
        y={61}
        textAnchor="middle"
        fontSize={5}
        letterSpacing={0.5}
        fill="#4a4f5a"
        style={{ fontFamily: "var(--font-pixel), monospace" }}
      >
        NORTHEASTERN UNIVERSITY
      </text>
      {WINDOW_BAYS.map((x) => (
        <FacadeWindow key={x} x={x} />
      ))}
      {/* Entrance */}
      <rect x={153} y={86} width={14} height={2} fill="#979da7" />
      <rect x={154} y={88} width={12} height={30} fill="#2c3644" />
      <rect x={159} y={100} width={2} height={2} fill="#FFD23F" />
      <rect x={150} y={118} width={20} height={3} fill="#a6abb4" />
      <rect x={148} y={121} width={24} height={3} fill="#979da7" />

      {/* Hedgerow at the building base */}
      {BUSHES.map((x, i) => (
        <g key={x}>
          <rect x={x} y={113} width={12} height={5} fill={i % 2 ? "#3f7d44" : "#47894c"} />
          {i % 2 === 0 && <rect x={x + 2} y={112} width={8} height={1} fill="#58a05f" />}
        </g>
      ))}

      {/* Trees — green left, autumn yellow + green right (as in the photo) */}
      <Tree cx={72} light="#5c9e58" base="#4f8f4f" shade="#3d7440" hi="#6fae66" />
      <Tree cx={262} light="#e2b654" base="#d9a53f" shade="#b7842c" hi="#ecc768" />
      <Tree cx={300} light="#5c9e58" base="#4f8f4f" shade="#3d7440" hi="#6fae66" />

      {/* Lawn */}
      <rect x={0} y={118} width={320} height={62} fill="#5f9e52" />
      <rect x={0} y={118} width={320} height={2} fill="#47823f" />
      <rect x={0} y={124} width={320} height={5} fill="#66a75a" />
      <rect x={0} y={148} width={320} height={5} fill="#66a75a" />
      <rect x={0} y={168} width={320} height={5} fill="#66a75a" />
      {GRASS_SPECKS.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={1} height={1} fill={i % 3 ? "#79b569" : "#4c8a44"} />
      ))}

      {/* Brick path across the quad */}
      <rect x={0} y={136} width={320} height={1} fill="#8a4f3d" />
      <rect x={0} y={137} width={320} height={8} fill="#b06a52" />
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={i * 8 + 3} y={137 + (i % 2) * 4} width={1} height={4} fill="#9a5a45" />
      ))}
      <rect x={0} y={141} width={320} height={1} fill="#9a5a45" />
      <rect x={0} y={145} width={320} height={1} fill="#8a4f3d" />

    </svg>
  );
}
