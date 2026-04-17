"use client";

import { memo } from "react";

/*
  PixelAvatar – renders a 16x16-style pixel character as an inline SVG.

  Props:
    avatar: { bodyColor, hairStyle, hairColor, eyeStyle, mouthStyle, outfitColor, accessory }
    size: pixel dimensions (default 64)
    isOnline: boolean (adds sleep effect if false)
    glow: optional glow color string
    className: extra classes
*/

// Each "pixel" in our 16x16 grid
const P = 1; // unit size in SVG viewBox (viewBox is 16x16)

// ── HAIR STYLES ──────────────────────────────────────────────────
const HAIR = [
  // 0: Buzz cut
  (c) => <><rect x="4" y="1" width="8" height="2" fill={c} rx="1"/></>,
  // 1: Spiky
  (c) => <>
    <rect x="4" y="2" width="8" height="1" fill={c}/>
    <rect x="4" y="1" width="2" height="1" fill={c}/>
    <rect x="7" y="0" width="2" height="2" fill={c}/>
    <rect x="10" y="1" width="2" height="1" fill={c}/>
  </>,
  // 2: Long sides
  (c) => <>
    <rect x="4" y="1" width="8" height="2" fill={c} rx="1"/>
    <rect x="3" y="3" width="2" height="4" fill={c}/>
    <rect x="11" y="3" width="2" height="4" fill={c}/>
  </>,
  // 3: Mohawk
  (c) => <>
    <rect x="7" y="0" width="2" height="1" fill={c}/>
    <rect x="6" y="1" width="4" height="1" fill={c}/>
    <rect x="5" y="2" width="6" height="1" fill={c}/>
  </>,
  // 4: Beanie / cap
  (c) => <>
    <rect x="3" y="1" width="10" height="3" fill={c} rx="1"/>
    <rect x="2" y="3" width="12" height="1" fill={c}/>
  </>,
  // 5: Afro
  (c) => <>
    <rect x="3" y="0" width="10" height="2" fill={c} rx="1"/>
    <rect x="2" y="1" width="12" height="3" fill={c} rx="1"/>
    <rect x="3" y="3" width="10" height="1" fill={c}/>
  </>,
  // 6: Side part
  (c) => <>
    <rect x="4" y="1" width="8" height="2" fill={c}/>
    <rect x="3" y="2" width="2" height="3" fill={c}/>
  </>,
  // 7: Bald (no hair)
  () => null,
];

// ── EYE STYLES ──────────────────────────────────────────────────
const EYES = [
  // 0: Normal dots
  () => <>
    <rect x="5" y="5" width="2" height="1" fill="#111"/>
    <rect x="9" y="5" width="2" height="1" fill="#111"/>
  </>,
  // 1: Angry
  () => <>
    <rect x="5" y="5" width="2" height="1" fill="#FF1744"/>
    <rect x="9" y="5" width="2" height="1" fill="#FF1744"/>
    <rect x="5" y="4" width="1" height="1" fill="#111" opacity="0.5"/>
    <rect x="10" y="4" width="1" height="1" fill="#111" opacity="0.5"/>
  </>,
  // 2: Wide eyes
  () => <>
    <rect x="5" y="4" width="2" height="2" fill="#FFF"/>
    <rect x="9" y="4" width="2" height="2" fill="#FFF"/>
    <rect x="5" y="5" width="1" height="1" fill="#111"/>
    <rect x="10" y="5" width="1" height="1" fill="#111"/>
  </>,
  // 3: Shifty
  () => <>
    <rect x="5" y="5" width="2" height="1" fill="#FFF"/>
    <rect x="9" y="5" width="2" height="1" fill="#FFF"/>
    <rect x="6" y="5" width="1" height="1" fill="#111"/>
    <rect x="9" y="5" width="1" height="1" fill="#111"/>
  </>,
  // 4: X eyes (dead)
  () => <>
    <rect x="5" y="4" width="1" height="1" fill="#FF1744"/>
    <rect x="6" y="5" width="1" height="1" fill="#FF1744"/>
    <rect x="5" y="5" width="1" height="1" fill="#FF1744" opacity="0.3"/>
    <rect x="6" y="4" width="1" height="1" fill="#FF1744"/>
    <rect x="9" y="4" width="1" height="1" fill="#FF1744"/>
    <rect x="10" y="5" width="1" height="1" fill="#FF1744"/>
    <rect x="9" y="5" width="1" height="1" fill="#FF1744" opacity="0.3"/>
    <rect x="10" y="4" width="1" height="1" fill="#FF1744"/>
  </>,
  // 5: Sunglasses
  () => <>
    <rect x="4" y="4" width="4" height="2" fill="#111" rx="0.5"/>
    <rect x="8" y="4" width="4" height="2" fill="#111" rx="0.5"/>
    <rect x="8" y="4.5" width="0.5" height="1" fill="#111"/>
    <rect x="5" y="5" width="2" height="0.5" fill="#4FC3F7" opacity="0.4"/>
    <rect x="9" y="5" width="2" height="0.5" fill="#4FC3F7" opacity="0.4"/>
  </>,
];

// ── MOUTH STYLES ─────────────────────────────────────────────────
const MOUTHS = [
  // 0: Smirk
  () => <>
    <rect x="7" y="7" width="3" height="1" fill="#111"/>
    <rect x="9" y="6" width="1" height="1" fill="#111"/>
  </>,
  // 1: Grin
  () => <>
    <rect x="6" y="7" width="4" height="1" fill="#111"/>
    <rect x="6" y="7" width="1" height="0.5" fill="#FFF"/>
    <rect x="9" y="7" width="1" height="0.5" fill="#FFF"/>
  </>,
  // 2: Frown
  () => <>
    <rect x="6" y="8" width="4" height="1" fill="#111"/>
    <rect x="6" y="7" width="1" height="1" fill="#111"/>
    <rect x="9" y="7" width="1" height="1" fill="#111"/>
  </>,
  // 3: Open mouth (shocked)
  () => <>
    <rect x="7" y="7" width="2" height="2" fill="#111" rx="0.5"/>
    <rect x="7" y="7" width="2" height="1" fill="#C62828"/>
  </>,
  // 4: Tongue out
  () => <>
    <rect x="6" y="7" width="4" height="1" fill="#111"/>
    <rect x="7" y="8" width="2" height="1" fill="#E91E63" rx="0.5"/>
  </>,
  // 5: Gritted teeth
  () => <>
    <rect x="6" y="7" width="4" height="1" fill="#111"/>
    <rect x="6" y="7" width="1" height="0.5" fill="#FFF"/>
    <rect x="7" y="7" width="1" height="0.5" fill="#111"/>
    <rect x="8" y="7" width="1" height="0.5" fill="#FFF"/>
    <rect x="9" y="7" width="1" height="0.5" fill="#111"/>
  </>,
];

// ── ACCESSORIES ──────────────────────────────────────────────────
const ACCESSORIES = [
  // 0: None
  () => null,
  // 1: Scar on cheek
  () => <>
    <rect x="3" y="5" width="1" height="3" fill="#C62828" opacity="0.6"/>
    <rect x="4" y="6" width="1" height="1" fill="#C62828" opacity="0.4"/>
  </>,
  // 2: Earring
  () => <>
    <circle cx="3.5" cy="6" r="0.7" fill="#FFD600" stroke="#FFA000" strokeWidth="0.2"/>
  </>,
  // 3: Band-aid
  () => <>
    <rect x="9" y="6" width="3" height="1.5" fill="#FFCC80" rx="0.3"/>
    <rect x="9.5" y="6.3" width="0.4" height="0.9" fill="#A1887F"/>
    <rect x="10.5" y="6.3" width="0.4" height="0.9" fill="#A1887F"/>
    <rect x="11" y="6.3" width="0.4" height="0.9" fill="#A1887F"/>
  </>,
  // 4: Headband
  () => <>
    <rect x="3" y="3" width="10" height="1" fill="#FF1744" opacity="0.8"/>
  </>,
  // 5: Chain necklace
  () => <>
    <rect x="5" y="9" width="6" height="0.5" fill="#FFD600"/>
    <circle cx="8" cy="10" r="0.8" fill="#FFD600" stroke="#FFA000" strokeWidth="0.2"/>
  </>,
  // 6: Face paint (war stripes)
  () => <>
    <rect x="4" y="5" width="1" height="0.5" fill="#111"/>
    <rect x="4" y="6" width="1" height="0.5" fill="#111"/>
    <rect x="11" y="5" width="1" height="0.5" fill="#111"/>
    <rect x="11" y="6" width="1" height="0.5" fill="#111"/>
  </>,
];

function PixelAvatar({
  avatar = {},
  size = 64,
  isOnline = true,
  glow,
  className = "",
}) {
  const {
    bodyColor = "#4FC3F7",
    hairStyle = 0,
    hairColor = "#222222",
    eyeStyle = 0,
    mouthStyle = 0,
    outfitColor = "#E91E63",
    accessory = 0,
  } = avatar;

  const hairFn = HAIR[hairStyle] || HAIR[0];
  const eyeFn = EYES[eyeStyle] || EYES[0];
  const mouthFn = MOUTHS[mouthStyle] || MOUTHS[0];
  const accFn = ACCESSORIES[accessory] || ACCESSORIES[0];

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      style={{
        imageRendering: "pixelated",
        filter: glow ? `drop-shadow(0 0 3px ${glow})` : undefined,
        opacity: isOnline ? 1 : 0.55,
      }}
    >
      {/* Background glow for online */}
      {glow && (
        <rect x="0" y="0" width="16" height="16" fill={glow} opacity="0.08" rx="2"/>
      )}

      {/* ── Head (skin) ── */}
      <rect x="4" y="2" width="8" height="7" fill={bodyColor} rx="1"/>

      {/* ── Hair ── */}
      {hairFn(hairColor)}

      {/* ── Eyes ── */}
      {eyeFn()}

      {/* ── Mouth ── */}
      {mouthFn()}

      {/* ── Body / Torso ── */}
      <rect x="3" y="9" width="10" height="4" fill={outfitColor} rx="1"/>

      {/* ── Arms ── */}
      <rect x="1" y="9" width="2" height="4" fill={bodyColor} rx="0.5"/>
      <rect x="13" y="9" width="2" height="4" fill={bodyColor} rx="0.5"/>

      {/* ── Legs ── */}
      <rect x="5" y="13" width="2" height="3" fill={outfitColor} opacity="0.7" rx="0.5"/>
      <rect x="9" y="13" width="2" height="3" fill={outfitColor} opacity="0.7" rx="0.5"/>

      {/* ── Accessory ── */}
      {accFn()}

      {/* ── Offline ZZZ overlay ── */}
      {!isOnline && (
        <g>
          <text x="12" y="3" fontSize="2.5" fill="#A78BFA" fontWeight="bold" fontFamily="monospace">Z</text>
          <text x="13" y="1.5" fontSize="2" fill="#A78BFA" fontWeight="bold" fontFamily="monospace" opacity="0.7">z</text>
          <text x="14" y="0.5" fontSize="1.5" fill="#A78BFA" fontWeight="bold" fontFamily="monospace" opacity="0.4">z</text>
        </g>
      )}
    </svg>
  );
}

export default memo(PixelAvatar);

// ── Export config constants for the avatar creator ───────────────
export const AVATAR_OPTIONS = {
  bodyColors: ["#4FC3F7", "#FFCC80", "#A1887F", "#CE93D8", "#80CBC4", "#EF9A9A", "#FFF59D", "#C5E1A5", "#90CAF9", "#F48FB1"],
  hairStyles: [
    { id: 0, name: "Buzz" },
    { id: 1, name: "Spiky" },
    { id: 2, name: "Long" },
    { id: 3, name: "Mohawk" },
    { id: 4, name: "Beanie" },
    { id: 5, name: "Afro" },
    { id: 6, name: "Side Part" },
    { id: 7, name: "Bald" },
  ],
  hairColors: ["#222222", "#5D4037", "#FF8A65", "#FFD54F", "#E0E0E0", "#B71C1C", "#1565C0", "#4CAF50", "#E91E63", "#9C27B0"],
  eyeStyles: [
    { id: 0, name: "Normal" },
    { id: 1, name: "Angry" },
    { id: 2, name: "Wide" },
    { id: 3, name: "Shifty" },
    { id: 4, name: "Dead" },
    { id: 5, name: "Shades" },
  ],
  mouthStyles: [
    { id: 0, name: "Smirk" },
    { id: 1, name: "Grin" },
    { id: 2, name: "Frown" },
    { id: 3, name: "Shocked" },
    { id: 4, name: "Tongue" },
    { id: 5, name: "Gritted" },
  ],
  outfitColors: ["#E91E63", "#9C27B0", "#3F51B5", "#009688", "#FF5722", "#607D8B", "#212121", "#FF6F00", "#1B5E20", "#B71C1C"],
  accessories: [
    { id: 0, name: "None" },
    { id: 1, name: "Scar" },
    { id: 2, name: "Earring" },
    { id: 3, name: "Band-aid" },
    { id: 4, name: "Headband" },
    { id: 5, name: "Chain" },
    { id: 6, name: "War Paint" },
  ],
};
