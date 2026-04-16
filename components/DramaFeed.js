"use client";

export default function DramaFeed({ logs, currentUserId }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-gray-500 text-center p-4 text-[10px]">
        No drama yet. Go start some beef.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
      {logs.map((log) => {
        const isAboutMe =
          log.attackerId === currentUserId ||
          log.defenderId === currentUserId;

        return (
          <div
            key={log._id}
            className={`p-3 rounded border text-[9px] leading-relaxed ${
              isAboutMe
                ? "border-pink-500/60 bg-pink-950/30"
                : "border-gray-700/50 bg-gray-900/40"
            }`}
          >
            <div className="flex justify-between mb-1 text-[8px] text-gray-400">
              <span>
                <span className="text-cyan-400">{log.attackerName}</span>
                {" vs "}
                <span className="text-red-400">{log.defenderName}</span>
              </span>
              <span>
                {new Date(log.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-gray-200 whitespace-pre-wrap">
              {log.transcript}
            </p>
          </div>
        );
      })}
    </div>
  );
}
