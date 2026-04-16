"use client";

export default function LoadingScreen({ progress }) {
  const pct = Math.round((progress.progress || 0) * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-8">
      {/* ASCII skull */}
      <pre className="text-pink-500 text-[8px] leading-tight mb-6 animate-pulse">
        {`
    ░██████╗░██████╗░░█████╗░██╗███╗░░██╗
    ██╔════╝░██╔══██╗██╔══██╗██║████╗░██║
    ██║░░██╗░██████╔╝███████║██║██╔██╗██║
    ██║░░╚██╗██╔══██╗██╔══██║██║██║╚████║
    ╚██████╔╝██║░░██║██║░░██║██║██║░╚███║
    ░╚═════╝░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝╚═╝░░╚══╝
        `}
      </pre>

      <h2 className="text-cyan-400 text-sm mb-2 text-center">
        DOWNLOADING AI BRAIN
      </h2>
      <p className="text-gray-400 text-[9px] mb-6 text-center max-w-md">
        This takes a minute but saves us server costs!
        <br />
        The model caches in your browser — next time is instant.
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-md h-6 bg-gray-900 border-2 border-pink-600 rounded overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-400 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-[8px] text-gray-500 text-center max-w-md truncate">
        {progress.text || "Initializing WebGPU..."}
      </p>

      <p className="text-yellow-500 text-[8px] mt-4 text-center">
        {pct}% — {pct < 30 ? "Warming up the insult engine..." : pct < 70 ? "Teaching AI to be petty..." : pct < 95 ? "Almost ready to start drama..." : "LET'S GO"}
      </p>
    </div>
  );
}
