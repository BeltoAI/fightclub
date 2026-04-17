"use client";

import { useState, useCallback } from "react";
import PixelAvatar, { AVATAR_OPTIONS } from "./PixelAvatar";

export default function AvatarCreator({ value, onChange }) {
  const [section, setSection] = useState("body");

  const update = useCallback(
    (key, val) => {
      onChange({ ...value, [key]: val });
    },
    [value, onChange]
  );

  const sections = [
    { id: "body", label: "SKIN" },
    { id: "hair", label: "HAIR" },
    { id: "eyes", label: "EYES" },
    { id: "mouth", label: "MOUTH" },
    { id: "outfit", label: "OUTFIT" },
    { id: "acc", label: "EXTRA" },
  ];

  function ColorRow({ colors, activeColor, onPick }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className={`w-7 h-7 rounded border-2 transition-all ${
              activeColor === c
                ? "border-white scale-110 ring-1 ring-white/50"
                : "border-gray-700 hover:border-gray-500"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    );
  }

  function StyleRow({ items, activeId, onPick }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id)}
            className={`px-3 py-1.5 rounded text-[9px] border transition-all ${
              activeId === item.id
                ? "border-pink-400 bg-pink-900/40 text-pink-300"
                : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
    );
  }

  function randomize() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    onChange({
      bodyColor: pick(AVATAR_OPTIONS.bodyColors),
      hairStyle: pick(AVATAR_OPTIONS.hairStyles).id,
      hairColor: pick(AVATAR_OPTIONS.hairColors),
      eyeStyle: pick(AVATAR_OPTIONS.eyeStyles).id,
      mouthStyle: pick(AVATAR_OPTIONS.mouthStyles).id,
      outfitColor: pick(AVATAR_OPTIONS.outfitColors),
      accessory: pick(AVATAR_OPTIONS.accessories).id,
    });
  }

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className="flex items-center justify-center gap-4">
        <div className="bg-gray-900 border-2 border-pink-600/60 rounded-lg p-3">
          <PixelAvatar avatar={value} size={80} glow="#E91E63" />
        </div>
        <div className="text-left">
          <p className="text-[9px] text-gray-500 mb-2">YOUR FIGHTER</p>
          <button
            type="button"
            onClick={randomize}
            className="text-[9px] px-3 py-1 rounded bg-gray-800 border border-gray-600 text-cyan-400 hover:bg-gray-700 transition-colors"
          >
            RANDOMIZE
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 flex-wrap justify-center">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`px-2 py-1 rounded text-[8px] transition-colors ${
              section === s.id
                ? "bg-pink-700 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="min-h-[48px]">
        {section === "body" && (
          <ColorRow
            colors={AVATAR_OPTIONS.bodyColors}
            activeColor={value.bodyColor}
            onPick={(c) => update("bodyColor", c)}
          />
        )}
        {section === "hair" && (
          <div className="space-y-2">
            <StyleRow
              items={AVATAR_OPTIONS.hairStyles}
              activeId={value.hairStyle}
              onPick={(id) => update("hairStyle", id)}
            />
            <ColorRow
              colors={AVATAR_OPTIONS.hairColors}
              activeColor={value.hairColor}
              onPick={(c) => update("hairColor", c)}
            />
          </div>
        )}
        {section === "eyes" && (
          <StyleRow
            items={AVATAR_OPTIONS.eyeStyles}
            activeId={value.eyeStyle}
            onPick={(id) => update("eyeStyle", id)}
          />
        )}
        {section === "mouth" && (
          <StyleRow
            items={AVATAR_OPTIONS.mouthStyles}
            activeId={value.mouthStyle}
            onPick={(id) => update("mouthStyle", id)}
          />
        )}
        {section === "outfit" && (
          <ColorRow
            colors={AVATAR_OPTIONS.outfitColors}
            activeColor={value.outfitColor}
            onPick={(c) => update("outfitColor", c)}
          />
        )}
        {section === "acc" && (
          <StyleRow
            items={AVATAR_OPTIONS.accessories}
            activeId={value.accessory}
            onPick={(id) => update("accessory", id)}
          />
        )}
      </div>
    </div>
  );
}
