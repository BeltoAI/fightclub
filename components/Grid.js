"use client";

import { memo } from "react";

const GRID_SIZE = 20;

const FLOOR_COLORS = {
  1: "bg-red-900/70",
  2: "bg-orange-900/70",
  3: "bg-yellow-900/70",
  4: "bg-green-900/70",
  5: "bg-blue-900/70",
  6: "bg-indigo-900/70",
  7: "bg-purple-900/70",
};

const FLOOR_BORDERS = {
  1: "border-red-500",
  2: "border-orange-500",
  3: "border-yellow-500",
  4: "border-green-500",
  5: "border-blue-500",
  6: "border-indigo-500",
  7: "border-purple-500",
};

function Grid({ users, currentUserId, encounterTargetId }) {
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

      let cellClass =
        "grid-cell w-full aspect-square flex items-center justify-center text-xs border border-gray-800/40 transition-all duration-100 ";

      if (isMe) {
        cellClass += "ring-2 ring-cyan-400 bg-cyan-900/40 animate-pulse-fast ";
      } else if (isTarget) {
        cellClass += "ring-2 ring-red-500 bg-red-900/60 animate-glitch ";
      } else if (occupant) {
        cellClass += `${FLOOR_COLORS[occupant.floor] || "bg-gray-800/50"} `;
        if (!occupant.isOnline) cellClass += "opacity-50 ";
      } else {
        cellClass += "bg-gray-900/30 ";
      }

      cells.push(
        <div key={key} className={cellClass} title={occupant ? `${occupant.username} (Floor ${occupant.floor})${!occupant.isOnline ? " [OFFLINE]" : ""}` : ""}>
          {occupant && (
            <span className="select-none" style={{ fontSize: "1rem" }}>
              {isMe ? "🫵" : occupant.isOnline ? occupant.emoji : "💤"}
            </span>
          )}
        </div>
      );
    }
  }

  return (
    <div
      className="grid border-2 border-pink-600/60 rounded"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
        maxWidth: "600px",
      }}
    >
      {cells}
    </div>
  );
}

export default memo(Grid);
