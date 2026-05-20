// Achievement Insignia — Twin Suns
// 14 hexagonal badges, ported from the design system in ACHIEVEMENT_BADGE_BRIEF.md
//
// Frame: regular hexagon matching the site's .ts-aspect-pip clip path.
// Outer hex (rim): (32,2) (60,17) (60,47) (32,62) (4,47) (4,17)  — 64×64 viewbox
// Inner hex (amber rim): 4px-inset polygon.
// Vertex ticks at each of the 6 corners.
//
// Earned state only. Locked state handled by host:
//   opacity: 0.35; filter: grayscale(0.85)

const HEX_OUTER = "32,2 60,17 60,47 32,62 4,47 4,17";
const HEX_INNER = "32,6 56,19 56,45 32,58 8,45 8,19";
const HEX_VERTICES: [number, number][] = [[32,2],[60,17],[60,47],[32,62],[4,47],[4,17]];

const AMBER  = "#ffb454";
const INK3   = "#8a7a5d";
const PANEL  = "#1f1a12";
const PANEL2 = "#2c251a";
const LINE2  = "#4d4332";

const ASPECT: Record<string, string> = {
  command:    "#c2453a",
  aggression: "#d96f2d",
  cunning:    "#e2b342",
  heroism:    "#ead7a8",
  vigilance:  "#4a90c4",
  villainy:   "#2c2a26",
};

// ── Shared frame ─────────────────────────────────────────────────────────────

function HexFrame({
  children,
  fill = PANEL2,
  rim = AMBER,
  rimOpacity = 0.55,
  ticks = true,
  size = 64,
}: {
  children?: React.ReactNode;
  fill?: string;
  rim?: string;
  rimOpacity?: number | string;
  ticks?: boolean;
  size: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
      <polygon points={HEX_OUTER} fill={fill} stroke={LINE2} strokeWidth="1.2" />
      <polygon points={HEX_INNER} fill="none" stroke={rim} strokeWidth="0.7" strokeOpacity={rimOpacity} />
      {ticks && HEX_VERTICES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.9" fill={rim} opacity="0.85" />
      ))}
      {children}
    </svg>
  );
}

// ── Shared atoms ─────────────────────────────────────────────────────────────

// Top-down X-wing silhouette
function ShipGlyph({
  cx, cy, size: s = 1, color = AMBER, trail = true, opacity = 1, foilOpen = true,
}: {
  cx: number; cy: number; size?: number; color?: string;
  trail?: boolean; opacity?: number; foilOpen?: boolean;
}) {
  const w = 8 * s;
  const f = 7 * s;
  const c = 1.1 * s;
  return (
    <g opacity={opacity} transform={`translate(${cx} ${cy})`}>
      <path d={`M0 ${-w} L${1.4*s} ${0.4*w} L0 ${w} L${-1.4*s} ${0.4*w} Z`} fill={color} />
      <circle cx="0" cy={-w*0.35} r={0.6*s} fill={PANEL} />
      {foilOpen ? (
        <>
          <line x1={-1.2*s} y1={-w*0.55} x2={-f} y2={-w*0.95} stroke={color} strokeWidth={0.9*s} strokeLinecap="round" />
          <line x1={ 1.2*s} y1={-w*0.55} x2={ f} y2={-w*0.95} stroke={color} strokeWidth={0.9*s} strokeLinecap="round" />
          <line x1={-1.2*s} y1={ w*0.4 } x2={-f} y2={ w*0.85} stroke={color} strokeWidth={0.9*s} strokeLinecap="round" />
          <line x1={ 1.2*s} y1={ w*0.4 } x2={ f} y2={ w*0.85} stroke={color} strokeWidth={0.9*s} strokeLinecap="round" />
          <line x1={-f} y1={-w*0.95-c} x2={-f} y2={-w*0.95+c} stroke={color} strokeWidth={1.6*s} strokeLinecap="round" />
          <line x1={ f} y1={-w*0.95-c} x2={ f} y2={-w*0.95+c} stroke={color} strokeWidth={1.6*s} strokeLinecap="round" />
          <line x1={-f} y1={ w*0.85-c} x2={-f} y2={ w*0.85+c} stroke={color} strokeWidth={1.6*s} strokeLinecap="round" />
          <line x1={ f} y1={ w*0.85-c} x2={ f} y2={ w*0.85+c} stroke={color} strokeWidth={1.6*s} strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1={-1.2*s} y1="0" x2={-f*0.9} y2={ w*0.15} stroke={color} strokeWidth={1.0*s} strokeLinecap="round" />
          <line x1={ 1.2*s} y1="0" x2={ f*0.9} y2={ w*0.15} stroke={color} strokeWidth={1.0*s} strokeLinecap="round" />
        </>
      )}
      {trail && (
        <line x1="0" y1={w*1.1} x2="0" y2={w*2.0} stroke={color} strokeOpacity="0.55" strokeWidth={0.6*s} strokeDasharray={`${0.8*s} ${1.2*s}`} />
      )}
    </g>
  );
}

// Filled triangle ship — reads cleanly at small sizes
function DeltaShip({
  cx, cy, size: s = 4, color = AMBER, opacity = 1, trail = true,
}: {
  cx: number; cy: number; size?: number; color?: string; opacity?: number; trail?: boolean;
}) {
  return (
    <g opacity={opacity} transform={`translate(${cx} ${cy})`}>
      <path d={`M0 ${-s} L${0.85*s} ${0.7*s} L0 ${0.4*s} L${-0.85*s} ${0.7*s} Z`} fill={color} stroke={color} strokeWidth="0.4" strokeLinejoin="round" />
      {trail && <line x1="0" y1={0.9*s} x2="0" y2={1.9*s} stroke={color} strokeOpacity="0.45" strokeWidth="0.5" strokeDasharray="0.8 1.2" />}
    </g>
  );
}

// Rebel officer rank square
function RankSquare({ x, y, s = 5, fill, dimOutline = false }: {
  x: number; y: number; s?: number; fill?: string | null; dimOutline?: boolean;
}) {
  if (!fill) {
    return <rect x={x} y={y} width={s} height={s} fill="none" stroke={LINE2} strokeWidth="0.6" opacity={dimOutline ? 0.5 : 1} />;
  }
  return (
    <g>
      <rect x={x} y={y} width={s} height={s} fill={fill} />
      <rect x={x+0.5} y={y+0.5} width={s-1} height={s-1} fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="0.5" />
      <rect x={x+0.8} y={y+0.8} width={s-2.2} height={s-3.6} fill="#fff" opacity="0.18" />
    </g>
  );
}

// Card silhouette
function CardGlyph({
  cx, cy, w = 14, h = 20, rotate = 0, fill = PANEL2, stroke = AMBER, strokeWidth = 1.1, accent = true,
}: {
  cx: number; cy: number; w?: number; h?: number; rotate?: number;
  fill?: string; stroke?: string; strokeWidth?: number; accent?: boolean;
}) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate})`}>
      <rect x={-w/2} y={-h/2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={strokeWidth} rx="0.6" />
      {accent && (
        <>
          <line x1={-w/2+2} y1={-h/2+3} x2={w/2-2} y2={-h/2+3} stroke={stroke} strokeOpacity="0.55" strokeWidth="0.5" />
          <line x1={-w/2+2} y1={ h/2-3} x2={w/2-2} y2={ h/2-3} stroke={stroke} strokeOpacity="0.4"  strokeWidth="0.5" />
        </>
      )}
    </g>
  );
}

// ── 1. first_deck — "First Flight" ───────────────────────────────────────────

function BadgeFirstDeck({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <ShipGlyph cx={32} cy={30} size={1.5} color={AMBER} />
      <path d="M16 52 Q32 49 48 52" stroke={AMBER} strokeOpacity="0.25" strokeWidth="0.8" fill="none" />
      <path d="M20 55 Q32 53 44 55" stroke={AMBER} strokeOpacity="0.15" strokeWidth="0.6" fill="none" />
    </HexFrame>
  );
}

// ── 2. three_decks — "Wing Formation" ────────────────────────────────────────

function BadgeThreeDecks({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <DeltaShip cx={32} cy={22} size={5} color={AMBER} />
      <DeltaShip cx={20} cy={36} size={4.2} color={AMBER} opacity={0.9} />
      <DeltaShip cx={44} cy={36} size={4.2} color={AMBER} opacity={0.9} />
    </HexFrame>
  );
}

// ── 3. ten_decks — "Squadron Leader" ─────────────────────────────────────────

function BadgeTenDecks({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <g>
        <DeltaShip cx={32} cy={17} size={5} color={AMBER} trail={false} />
        <line x1="29" y1="14" x2="35" y2="14" stroke={PANEL} strokeWidth="1" />
      </g>
      <DeltaShip cx={22} cy={28} size={3.8} color={AMBER} opacity={0.9} trail={false} />
      <DeltaShip cx={42} cy={28} size={3.8} color={AMBER} opacity={0.9} trail={false} />
      <DeltaShip cx={14} cy={40} size={3.4} color={AMBER} opacity={0.75} />
      <DeltaShip cx={32} cy={40} size={3.4} color={AMBER} opacity={0.75} />
      <DeltaShip cx={50} cy={40} size={3.4} color={AMBER} opacity={0.75} />
    </HexFrame>
  );
}

// ── 4. all_aspects — "Full Spectrum" ─────────────────────────────────────────
// Six wedges, one per aspect, fanning from center to each hex face.

function BadgeAllAspects({ size }: { size: number }) {
  const c: [number, number] = [32, 32];
  const verts: [number, number][] = [
    [32, 8.5], [54, 20.5], [54, 43.5],
    [32, 55.5], [10, 43.5], [10, 20.5],
  ];
  const order = ["command", "aggression", "cunning", "heroism", "vigilance", "villainy"];
  return (
    <HexFrame size={size} fill={PANEL} rim={AMBER} rimOpacity={0} ticks={false}>
      {order.map((asp, i) => {
        const a = verts[i];
        const b = verts[(i + 1) % 6];
        const d = `M${c[0]} ${c[1]} L${a[0]} ${a[1]} L${b[0]} ${b[1]} Z`;
        return <path key={asp} d={d} fill={ASPECT[asp]} opacity="0.85" stroke={PANEL} strokeWidth="0.7" />;
      })}
      <circle cx="32" cy="32" r="6.5" fill={PANEL} stroke={AMBER} strokeWidth="1" />
      <circle cx="32" cy="32" r="3" fill={AMBER} />
      <polygon points={HEX_OUTER} fill="none" stroke={LINE2} strokeWidth="1.2" />
      <polygon points={HEX_INNER} fill="none" stroke={AMBER} strokeWidth="0.7" strokeOpacity="0.6" />
      {HEX_VERTICES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1" fill={AMBER} />
      ))}
    </HexFrame>
  );
}

// ── 5. first_share — "Broadcast" — holocomm beacon ───────────────────────────

function BadgeFirstShare({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <rect x="29" y="42" width="6" height="9" fill={AMBER} opacity="0.85" />
      <rect x="26" y="50" width="12" height="2" fill={AMBER} />
      <line x1="32" y1="42" x2="32" y2="34" stroke={AMBER} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="1.8" fill={AMBER} />
      <path d="M22 28 Q32 18 42 28" stroke={AMBER} strokeWidth="1.2" fill="none" strokeOpacity="0.95" strokeLinecap="round" />
      <path d="M17 26 Q32 10 47 26" stroke={AMBER} strokeWidth="1.1" fill="none" strokeOpacity="0.6"  strokeLinecap="round" />
      <path d="M12 24 Q32  4 52 24" stroke={AMBER} strokeWidth="1.0" fill="none" strokeOpacity="0.35" strokeLinecap="round" />
      <circle cx="22" cy="28" r="0.9" fill={AMBER} />
      <circle cx="42" cy="28" r="0.9" fill={AMBER} />
    </HexFrame>
  );
}

// ── 6. first_card — "In the Vault" ───────────────────────────────────────────

function BadgeFirstCard({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <CardGlyph cx={32} cy={33} w={20} h={26} fill={PANEL} stroke={AMBER} strokeWidth={1.2} />
      <g transform="translate(32 33)">
        <path d="M-3.2 -2.5 Q-3.2 -6 0 -6 Q3.2 -6 3.2 -2.5 L3.2 -1" stroke={AMBER} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <rect x="-4" y="-1.5" width="8" height="7" fill={AMBER} stroke={PANEL} strokeWidth="0.4" />
        <circle cx="0" cy="2" r="0.9" fill={PANEL} />
      </g>
      <rect x="23" y="22" width="3" height="0.8" fill={AMBER} opacity="0.7" />
      <rect x="38" y="22" width="3" height="0.8" fill={AMBER} opacity="0.7" />
      <rect x="23" y="43.2" width="3" height="0.8" fill={AMBER} opacity="0.7" />
      <rect x="38" y="43.2" width="3" height="0.8" fill={AMBER} opacity="0.7" />
    </HexFrame>
  );
}

// ── 7. fifty_cards — "Growing Arsenal" ───────────────────────────────────────

function BadgeFiftyCards({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <CardGlyph cx={22} cy={36} w={14} h={20} rotate={-14} fill={PANEL} stroke={AMBER} strokeWidth={1} />
      <CardGlyph cx={42} cy={36} w={14} h={20} rotate={ 14} fill={PANEL} stroke={AMBER} strokeWidth={1} />
      <CardGlyph cx={32} cy={32} w={14} h={22} rotate={  0} fill={PANEL2} stroke={AMBER} strokeWidth={1.3} />
      <circle cx="32" cy="36" r="2.6" fill={AMBER} />
      <text x="32" y="37.5" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="3.2" fontWeight="700" fill={PANEL}>50</text>
    </HexFrame>
  );
}

// ── 8. hundred_cards — "Armory" — crossed lightsaber hilts ───────────────────

function BadgeHundredCards({ size }: { size: number }) {
  function Hilt({ rotate }: { rotate: number }) {
    return (
      <g transform={`translate(32 32) rotate(${rotate})`}>
        <rect x="-9.5" y="-1.8" width="2.2" height="3.6" fill={AMBER} />
        <rect x="-7.3" y="-2.2" width="11" height="4.4" fill={AMBER} />
        <line x1="-5" y1="-2.2" x2="-5" y2="2.2" stroke={PANEL} strokeWidth="0.6" />
        <line x1="-3" y1="-2.2" x2="-3" y2="2.2" stroke={PANEL} strokeWidth="0.6" />
        <line x1="-1" y1="-2.2" x2="-1" y2="2.2" stroke={PANEL} strokeWidth="0.6" />
        <circle cx="-1" cy="-3.2" r="0.7" fill={AMBER} />
        <rect x="3.7" y="-2.8" width="2.2" height="5.6" fill={AMBER} />
        <line x1="6" y1="0" x2="9.5" y2="0" stroke={AMBER} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <HexFrame size={size}>
      <Hilt rotate={-32} />
      <Hilt rotate={ 32} />
      <circle cx="32" cy="32" r="1.6" fill={AMBER} stroke={PANEL} strokeWidth="0.5" />
    </HexFrame>
  );
}

// ── 9. five_hundred_cards — "War Chest" — supply crate ───────────────────────

function BadgeFiveHundredCards({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <path d="M14 24 L50 24 L52 46 L12 46 Z" fill={PANEL2} stroke={AMBER} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M14 24 L50 24 L48 21 L16 21 Z" fill={PANEL} stroke={AMBER} strokeWidth="1.1" strokeLinejoin="round" />
      <line x1="22" y1="24" x2="22" y2="46" stroke={AMBER} strokeWidth="0.7" opacity="0.7" />
      <line x1="42" y1="24" x2="42" y2="46" stroke={AMBER} strokeWidth="0.7" opacity="0.7" />
      <circle cx="32" cy="35" r="5" fill={AMBER} />
      <circle cx="32" cy="35" r="3" fill={PANEL} />
      <line x1="32" y1="29" x2="32" y2="32" stroke={AMBER} strokeWidth="0.7" />
      <line x1="32" y1="38" x2="32" y2="41" stroke={AMBER} strokeWidth="0.7" />
      <line x1="26" y1="35" x2="29" y2="35" stroke={AMBER} strokeWidth="0.7" />
      <line x1="35" y1="35" x2="38" y2="35" stroke={AMBER} strokeWidth="0.7" />
      {([[15,26],[49,26],[14,44],[50,44]] as [number,number][]).map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="0.7" fill={AMBER} />
      ))}
      <line x1="12" y1="48" x2="52" y2="48" stroke={AMBER} strokeWidth="0.6" opacity="0.45" />
    </HexFrame>
  );
}

// ── 10. first_wishlist — "Target Acquired" ────────────────────────────────────

function BadgeFirstWishlist({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <CardGlyph cx={32} cy={33} w={14} h={20} fill={PANEL} stroke={INK3} strokeWidth={0.8} accent={false} />
      <circle cx="32" cy="32" r="11" stroke={AMBER} strokeWidth="1.2" fill="none" />
      <circle cx="32" cy="32" r="7"  stroke={AMBER} strokeWidth="0.7" fill="none" strokeOpacity="0.55" />
      <line x1="32" y1="17" x2="32" y2="22" stroke={AMBER} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="32" y1="42" x2="32" y2="47" stroke={AMBER} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="17" y1="32" x2="22" y2="32" stroke={AMBER} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="42" y1="32" x2="47" y2="32" stroke={AMBER} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="1.4" fill={AMBER} />
      {([[21,21,1,1],[43,21,-1,1],[21,43,1,-1],[43,43,-1,-1]] as [number,number,number,number][]).map(([x,y,dx,dy],i) => (
        <path key={i} d={`M${x} ${y+3*dy} L${x} ${y} L${x+3*dx} ${y}`} stroke={AMBER} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      ))}
    </HexFrame>
  );
}

// ── 11–14. Rank gates — K1 Cadet → K4 Squadron ───────────────────────────────
// 3×2 grid of rebel-style rank squares, accumulating fills.

function RankGrid({ fills, label }: { fills: (string | null)[]; label?: string }) {
  const s = 6;
  const gap = 1.5;
  const x0 = 32 - (3*s + 2*gap)/2;
  const y0 = 33 - (2*s + gap)/2 - 1;
  const positions: [number, number][] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      positions.push([x0 + c*(s+gap), y0 + r*(s+gap)]);
    }
  }
  return (
    <g>
      <rect x={x0 - 2} y={y0 - 2} width={3*s + 2*gap + 4} height={2*s + gap + 4} fill={PANEL} stroke={LINE2} strokeWidth="0.6" />
      {positions.map(([x, y], i) => (
        <RankSquare key={i} x={x} y={y} s={s} fill={fills[i] ?? null} />
      ))}
      {label && (
        <text x="32" y={y0 + 2*s + gap + 6.5}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="4" fontWeight="700"
          letterSpacing="0.5"
          fill={AMBER}>{label}</text>
      )}
    </g>
  );
}

function BadgeRankK1({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <RankGrid fills={[ASPECT.command, null, null, null, null, null]} label="K-1" />
    </HexFrame>
  );
}

function BadgeRankK2({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <RankGrid fills={[ASPECT.command, ASPECT.command, null, null, null, null]} label="K-2" />
    </HexFrame>
  );
}

function BadgeRankK3({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <RankGrid fills={[ASPECT.vigilance, ASPECT.command, ASPECT.cunning, null, null, null]} label="K-3" />
    </HexFrame>
  );
}

function BadgeRankK4({ size }: { size: number }) {
  return (
    <HexFrame size={size}>
      <path d="M32 11 L33.2 13.5 L36 13.9 L34 15.8 L34.4 18.5 L32 17.2 L29.6 18.5 L30 15.8 L28 13.9 L30.8 13.5 Z"
            fill={AMBER} />
      <path d="M14 33 L20 31 L20 33 L14 35 Z" fill={AMBER} opacity="0.8" />
      <path d="M14 37 L20 35 L20 37 L14 39 Z" fill={AMBER} opacity="0.55" />
      <path d="M50 33 L44 31 L44 33 L50 35 Z" fill={AMBER} opacity="0.8" />
      <path d="M50 37 L44 35 L44 37 L50 39 Z" fill={AMBER} opacity="0.55" />
      <RankGrid fills={[AMBER, AMBER, AMBER, AMBER, AMBER, AMBER]} label="K-4" />
    </HexFrame>
  );
}

// ── Badge dispatcher ──────────────────────────────────────────────────────────

const BADGE_COMPONENTS: Record<string, React.ComponentType<{ size: number }>> = {
  first_deck:         BadgeFirstDeck,
  three_decks:        BadgeThreeDecks,
  ten_decks:          BadgeTenDecks,
  all_aspects:        BadgeAllAspects,
  first_share:        BadgeFirstShare,
  first_card:         BadgeFirstCard,
  fifty_cards:        BadgeFiftyCards,
  hundred_cards:      BadgeHundredCards,
  five_hundred_cards: BadgeFiveHundredCards,
  first_wishlist:     BadgeFirstWishlist,
  rank_k1:            BadgeRankK1,
  rank_k2:            BadgeRankK2,
  rank_k3:            BadgeRankK3,
  rank_k4:            BadgeRankK4,
};

// ── Public API ────────────────────────────────────────────────────────────────

export interface AchievementBadgeProps {
  /** Achievement key, e.g. "first_deck", "rank_k2" */
  name: string;
  /** Rendered size in px. SVG viewbox is always 64×64. Default: 64 */
  size?: number;
  /** When true, applies grayscale + opacity to indicate locked state */
  locked?: boolean;
  className?: string;
}

export function AchievementBadge({ name, size = 64, locked = false, className = "" }: AchievementBadgeProps) {
  const Comp = BADGE_COMPONENTS[name];
  if (!Comp) return null;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        opacity: locked ? 0.35 : 1,
        filter: locked ? "grayscale(0.85)" : "none",
        transition: "opacity 0.2s, filter 0.2s",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <Comp size={size} />
    </span>
  );
}
