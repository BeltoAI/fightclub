"use client";

import { memo } from "react";
import PixelAvatar from "./PixelAvatar";

const GRID_SIZE = 20;

const FLOOR_BG = {
  1: "#3e1111", 2: "#3e2511", 3: "#3e3511", 4: "#113e1a",
  5: "#11243e", 6: "#1f113e", 7: "#2e113e",
};

function Grid({ users, currentUserId, encounterTargetId, onCellClick }) {
  // Build a lookup map: "x,y" -> user
  const posMap = {};
  users.forEach((u) => {
    posMap[`${u.x},${u.y}`] = u;
  });

  const cells = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = `${col},${row}`;
      const occupant = posMap[key];
      const isMe = occupant && occupant._id === currentUserId;
      const isTarget = occupant && occupant._id === encounterTargetId;

      let bgColor = "transparent";
      let borderColor = "rgba(255,255,255,0.04)";
      let glowColor = undefined;

      if (isMe) {
        bgColor = "rgba(0,188,212,0.15)";
        borderColor = "rgba(0,188,212,0.6)";
        glowColor = "#00BCD4";
      } else if (isTarget) {
        bgColor = "rgba(244,67,54,0.2)";
        borderColor = "rgba(244,67,54,0.7)";
        glowColor = "#F44336";
      } else if (occupant) {
        bgColor = FLOOR_BG[occupant.floor] || "rgba(255,255,255,0.03)";
        borderColor = "rgba(255,255,255,0.06)";
      }

      cells.push(
        <div
          key={key}
          onClick={() => occupant && !isMe && onCellClick?.(occupant)}
          style={{
            backgroundColor: bgColor,
            borderColor: borderColor,
            borderWidth: "1px",
            borderStyle: "solid",
          }}
          className={`grid-cell w-full aspect-square flex items-center justify-center transition-all duration-100 ${
            occupant && !isMe ? "cursor-pointer hover:brightness-125" : ""
          } ${isTarget ? "animate-glitch" : ""} ${isMe ? "animate-pulse-fast" : ""}`}
          title={
            occupant
              ? `${occupant.username} (Floor ${occupant.floor})${
                  !occupant.isOnline ? " [OFFLINE]" : ""
                } W:${occupant.wins || 0} L:${occupant.losses || 0}`
              : ""
          }
        >
          {occupant && (
            <PixelAvatar
              avatar={occupant.avatar || {}}
              size={24}
              isOnline={occupant.isOnline}
              glow={glowColor}
            />
          )}
        </div>
      );
    }
  }

  return (
    <div
      className="grid border-2 border-pink-600/60 rounded bg-gray-950"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
        maxWidth: "600px",
        width: "100%",
      }}
    >
      {cells}
    </div>
  );
}

export default memo(Grid);
