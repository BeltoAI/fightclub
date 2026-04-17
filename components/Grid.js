"use client";

import { memo } from "react";
import PixelAvatar from "./PixelAvatar";

const GRID_SIZE = 10;

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

      let cellClasses = "relative flex flex-col items-center justify-center transition-all duration-150 ";
      let cellStyle = {
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "rgba(255,255,255,0.05)",
        backgroundColor: "rgba(255,255,255,0.01)",
      };

      if (isMe) {
        cellStyle.backgroundColor = "rgba(0, 255, 255, 0.12)";
        cellStyle.borderColor = "#00e5ff";
        cellStyle.borderWidth = "2px";
        cellStyle.boxShadow = "0 0 12px rgba(0,229,255,0.4), inset 0 0 8px rgba(0,229,255,0.15)";
        cellClasses += "z-10 ";
      } else if (isTarget) {
        cellStyle.backgroundColor = "rgba(255, 23, 68, 0.15)";
        cellStyle.borderColor = "#ff1744";
        cellStyle.borderWidth = "2px";
        cellStyle.boxShadow = "0 0 12px rgba(255,23,68,0.5)";
        cellClasses += "animate-glitch ";
      } else if (occupant && !occupant.isOnline) {
        cellStyle.backgroundColor = "rgba(156, 39, 176, 0.1)";
        cellStyle.borderColor = "rgba(156, 39, 176, 0.3)";
        cellClasses += "cursor-pointer hover:brightness-150 ";
      } else if (occupant) {
        cellStyle.backgroundColor = "rgba(76, 175, 80, 0.08)";
        cellStyle.borderColor = "rgba(76, 175, 80, 0.2)";
        cellClasses += "cursor-pointer hover:brightness-125 ";
      }

      cells.push(
        <div
          key={key}
          onClick={() => occupant && onCellClick?.(occupant)}
          style={cellStyle}
          className={cellClasses}
          title={
            occupant
              ? `${occupant.username} (Floor ${occupant.floor})${
                  !occupant.isOnline ? " — OFFLINE, click to fight!" : ""
                }`
              : ""
          }
        >
          {occupant && (
            <>
              <PixelAvatar
                avatar={occupant.avatar || {}}
                size={isMe ? 40 : 36}
                isOnline={occupant.isOnline}
                glow={isMe ? "#00e5ff" : isTarget ? "#ff1744" : undefined}
              />
              {/* Name label */}
              <span
                className={`absolute -bottom-0.5 left-0 right-0 text-center truncate leading-none ${
                  isMe
                    ? "text-cyan-300 font-bold"
                    : occupant.isOnline
                    ? "text-green-300"
                    : "text-purple-300"
                }`}
                style={{ fontSize: "7px" }}
              >
                {isMe ? "YOU" : occupant.username.slice(0, 6)}
              </span>
              {/* Offline ZZZ badge */}
              {!occupant.isOnline && !isMe && (
                <span
                  className="absolute -top-1 -right-1 bg-purple-700 text-white rounded-full flex items-center justify-center"
                  style={{ fontSize: "6px", width: "14px", height: "14px" }}
                >
                  ZZ
                </span>
              )}
            </>
          )}
        </div>
      );
    }
  }

  return (
    <div
      className="grid border-2 rounded-lg bg-gray-950/80"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
        maxWidth: "560px",
        width: "100%",
        borderColor: "#e91e63",
        gap: "2px",
        padding: "2px",
      }}
    >
      {cells}
    </div>
  );
}

export default memo(Grid);
