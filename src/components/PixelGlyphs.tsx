/* Pixel glyphs — hand-drawn stand-ins for the Unicode shapes this UI used to
   lean on (▼ ▾ ▶ ◀ ▮ ▤ 📌).

   Press Start 2P carries none of them, so each one silently fell through to
   whatever fallback font the browser picked: ▤ drew an empty box, and the
   arrows arrived at a weight and baseline that never matched the type around
   them. 📌 had the opposite problem — it resolved to a full-colour emoji,
   the one smooth, glossy object in a scene built from squares.

   All of these take their colour from `currentColor`, so a glyph inherits
   whatever the surrounding text is doing. */

type GlyphProps = { size?: number; className?: string };

/** Solid triangle. Sized on a 7×7 grid so the steps land on whole pixels. */
export function PixelTriangle({
  dir,
  size = 8,
  className,
}: GlyphProps & { dir: "up" | "down" | "left" | "right" }) {
  // One row per step, drawn pointing down; the other three directions are the
  // same shape rotated, which keeps the stepping identical on every edge.
  const rows = [
    { x: 0, y: 0, w: 7, h: 1 },
    { x: 1, y: 1, w: 5, h: 1 },
    { x: 2, y: 2, w: 3, h: 1 },
    { x: 3, y: 3, w: 1, h: 1 },
  ];
  const rotation = { down: 0, left: 90, up: 180, right: 270 }[dir];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 7"
      style={{ shapeRendering: "crispEdges" }}
      className={className}
      aria-hidden
    >
      <g transform={`rotate(${rotation} 3.5 3.5)`}>
        {rows.map((r) => (
          <rect key={r.y} {...r} fill="currentColor" />
        ))}
      </g>
    </svg>
  );
}

/** Filled block — the terminal-style cursor that trails a status readout. */
export function PixelCursor({ size = 8, className }: GlyphProps) {
  return (
    <svg
      width={size * 0.6}
      height={size}
      viewBox="0 0 3 5"
      style={{ shapeRendering: "crispEdges" }}
      className={className}
      aria-hidden
    >
      <rect x={0} y={0} width={3} height={5} fill="currentColor" />
    </svg>
  );
}

/** Pushpin, seen head-on: round head, then the shaft tapering to a point. */
export function PixelPin({ size = 11, className }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 9 9"
      style={{ shapeRendering: "crispEdges" }}
      className={className}
      aria-hidden
    >
      {/* head */}
      <rect x={2} y={0} width={5} height={1} fill="currentColor" />
      <rect x={1} y={1} width={7} height={3} fill="currentColor" />
      <rect x={2} y={4} width={5} height={1} fill="currentColor" />
      {/* shaft */}
      <rect x={4} y={5} width={1} height={3} fill="currentColor" />
      <rect x={4} y={8} width={1} height={1} fill="currentColor" />
    </svg>
  );
}

/** Speech bubble with two text lines — the "my chats" mark. */
export function ChatsIcon({ size = 12, className }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      style={{ shapeRendering: "crispEdges" }}
      className={className}
      aria-hidden
    >
      {/* bubble outline */}
      <rect x={0} y={0} width={9} height={1} fill="currentColor" />
      <rect x={0} y={6} width={9} height={1} fill="currentColor" />
      <rect x={0} y={0} width={1} height={7} fill="currentColor" />
      <rect x={8} y={0} width={1} height={7} fill="currentColor" />
      {/* text lines */}
      <rect x={2} y={2} width={5} height={1} fill="currentColor" />
      <rect x={2} y={4} width={3} height={1} fill="currentColor" />
      {/* tail */}
      <rect x={2} y={7} width={2} height={1} fill="currentColor" />
      <rect x={2} y={8} width={1} height={1} fill="currentColor" />
    </svg>
  );
}
