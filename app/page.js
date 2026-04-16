"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Grid from "@/components/Grid";
import DramaFeed from "@/components/DramaFeed";
import LoadingScreen from "@/components/LoadingScreen";
import Paywall from "@/components/Paywall";
import useWebLLM from "@/hooks/useWebLLM";

const EMOJIS = ["😤", "👊", "🔥", "💀", "🐍", "🦈", "👹", "🤡", "💣", "⚡"];

export default function Home() {
  // ── Auth state (restore from sessionStorage on page reload / Stripe redirect) ──
  const [user, setUser] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("fightclub_user");
        return saved ? JSON.parse(saved) : null;
      } catch { return null; }
    }
    return null;
  });
  const [loginForm, setLoginForm] = useState({
    username: "",
    floor: 1,
    emoji: "😤",
  });
  const [loginError, setLoginError] = useState("");

  // ── Game state ──────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState([]);
  const [dramaLogs, setDramaLogs] = useState([]);
  const [encounterTarget, setEncounterTarget] = useState(null);
  const [currentDrama, setCurrentDrama] = useState("");
  const [showDrama, setShowDrama] = useState(false);
  const [awayPrompt, setAwayPrompt] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState("grid"); // "grid" | "feed" | "my-drama"

  // ── Subscription state ─────────────────────────────────────────
  const [subStatus, setSubStatus] = useState(null); // null = loading, object = loaded
  const [subChecked, setSubChecked] = useState(false);

  // ── Persist user to sessionStorage (survives Stripe redirect) ──
  useEffect(() => {
    if (user) {
      sessionStorage.setItem("fightclub_user", JSON.stringify(user));
    }
  }, [user]);

  // ── WebLLM ─────────────────────────────────────────────────────
  const {
    initEngine,
    generateTrashTalk,
    isLoaded,
    isLoading,
    isGenerating,
    initProgress,
    error: llmError,
  } = useWebLLM();

  const moveThrottleRef = useRef(false);

  // ── Fetch all users (polling) ──────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (e) {
      console.error("Failed to fetch users:", e);
    }
  }, []);

  // ── Fetch drama logs ───────────────────────────────────────────
  const fetchDrama = useCallback(async () => {
    try {
      const res = await fetch("/api/drama");
      if (res.ok) setDramaLogs(await res.json());
    } catch (e) {
      console.error("Failed to fetch drama:", e);
    }
  }, []);

  // ── Start AI engine once subscription is confirmed ──────────────
  useEffect(() => {
    if (user && subStatus?.isActive && !isLoaded && !isLoading) {
      initEngine();
    }
  }, [user, subStatus, isLoaded, isLoading, initEngine]);

  // ── Polling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchUsers();
    fetchDrama();
    const interval = setInterval(() => {
      fetchUsers();
      fetchDrama();
    }, 3000);
    return () => clearInterval(interval);
  }, [user, fetchUsers, fetchDrama]);

  // ── Check subscription after login ──────────────────────────────
  useEffect(() => {
    if (!user) return;

    async function checkSub() {
      try {
        const res = await fetch(`/api/stripe/status?userId=${user._id}`);
        if (res.ok) {
          const data = await res.json();
          setSubStatus(data);
        }
      } catch (e) {
        console.error("Subscription check failed:", e);
        // Let them through on error (fail open for now)
        setSubStatus({ isActive: true });
      }
      setSubChecked(true);
    }

    checkSub();

    // Handle return from Stripe Checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      const sessionId = params.get("session_id");
      // Clean URL immediately
      window.history.replaceState({}, "", "/");

      if (sessionId) {
        // Verify the session directly with Stripe (don't wait for webhook)
        fetch("/api/stripe/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, userId: user._id }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setSubStatus({ isActive: true });
              setSubChecked(true);
            } else {
              // Fallback: re-check status after delay
              setTimeout(checkSub, 2000);
            }
          })
          .catch(() => setTimeout(checkSub, 2000));
      } else {
        setTimeout(checkSub, 2000);
      }
    }
  }, [user]);

  // ── Login / Register ───────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");

    if (loginForm.username.length < 2) {
      setLoginError("Username must be at least 2 characters");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      if (!res.ok) {
        const data = await res.json();
        setLoginError(data.error || "Login failed");
        return;
      }

      const data = await res.json();
      setUser(data);
      setAwayPrompt(data.awayPrompt || "");

      // Don't init AI engine yet — wait for subscription check
    } catch (err) {
      setLoginError("Network error. Try again.");
    }
  }

  // ── Movement ───────────────────────────────────────────────────
  const moveUser = useCallback(
    async (dx, dy) => {
      if (!user || moveThrottleRef.current || isGenerating) return;
      moveThrottleRef.current = true;

      const newX = Math.max(0, Math.min(19, user.x + dx));
      const newY = Math.max(0, Math.min(19, user.y + dy));

      if (newX === user.x && newY === user.y) {
        moveThrottleRef.current = false;
        return;
      }

      // Optimistic update
      setUser((prev) => ({ ...prev, x: newX, y: newY }));

      try {
        const res = await fetch("/api/users/move", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user._id, x: newX, y: newY }),
        });
        if (res.ok) {
          const updated = await res.json();
          setUser((prev) => ({ ...prev, ...updated }));
        }
      } catch (e) {
        console.error("Move failed:", e);
      }

      // Check for adjacent offline users
      checkEncounters(newX, newY);

      setTimeout(() => {
        moveThrottleRef.current = false;
      }, 120);
    },
    [user, allUsers, isGenerating]
  );

  // ── Encounter detection ────────────────────────────────────────
  function checkEncounters(px, py) {
    if (isGenerating || showDrama) return;

    const adjacent = allUsers.find((u) => {
      if (u._id === user._id) return false;
      if (u.isOnline) return false; // only fight offline users
      const dx = Math.abs(u.x - px);
      const dy = Math.abs(u.y - py);
      return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
    });

    if (adjacent && isLoaded) {
      triggerEncounter(adjacent);
    }
  }

  // ── Trigger AI encounter ───────────────────────────────────────
  async function triggerEncounter(target) {
    setEncounterTarget(target);
    setCurrentDrama("");
    setShowDrama(true);

    const attackerContext = `${user.username} from Floor ${user.floor}, a brazen troublemaker who just invaded your personal space`;
    const defenderPrompt =
      target.awayPrompt || "I'm just a chill resident. Don't start nothing.";

    try {
      const transcript = await generateTrashTalk(defenderPrompt, attackerContext);
      setCurrentDrama(transcript);

      // Save to DB
      await fetch("/api/drama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attackerId: user._id,
          attackerName: user.username,
          defenderId: target._id,
          defenderName: target.username,
          transcript,
          floor: target.floor,
        }),
      });

      // Refresh drama feed
      fetchDrama();
    } catch (err) {
      setCurrentDrama("*The AI choked on its own insult and passed out*");
    }
  }

  // ── Keyboard handler ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    function handleKey(e) {
      switch (e.key) {
        case "ArrowUp":
        case "w":
          e.preventDefault();
          moveUser(0, -1);
          break;
        case "ArrowDown":
        case "s":
          e.preventDefault();
          moveUser(0, 1);
          break;
        case "ArrowLeft":
        case "a":
          e.preventDefault();
          moveUser(-1, 0);
          break;
        case "ArrowRight":
        case "d":
          e.preventDefault();
          moveUser(1, 0);
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [user, moveUser]);

  // ── Update away prompt ─────────────────────────────────────────
  async function saveAwayPrompt() {
    if (!user) return;
    try {
      const res = await fetch("/api/users/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user._id, awayPrompt }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser((prev) => ({ ...prev, ...updated }));
        setShowSettings(false);
      }
    } catch (e) {
      console.error("Failed to save prompt:", e);
    }
  }

  // ── Toggle online/offline ──────────────────────────────────────
  async function toggleOnline() {
    if (!user) return;
    try {
      const res = await fetch("/api/users/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user._id, isOnline: !user.isOnline }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser((prev) => ({ ...prev, ...updated }));
      }
    } catch (e) {
      console.error("Failed to toggle status:", e);
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════

  // ── Paywall Gate ────────────────────────────────────────────────
  if (user && subChecked && !subStatus?.isActive) {
    return <Paywall userId={user._id} />;
  }

  // ── Loading sub check ─────────────────────────────────────────
  if (user && !subChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-[10px] animate-pulse">Checking subscription...</p>
      </div>
    );
  }

  // ── Loading Screen (WebLLM downloading) ────────────────────────
  if (user && isLoading) {
    return <LoadingScreen progress={initProgress} />;
  }

  // ── Login Screen ───────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-pink-500 text-xl mb-2 text-center">
          IDLE FIGHT CLUB
        </h1>
        <p className="text-gray-500 text-[9px] mb-8 text-center max-w-sm">
          An async, AI-powered drama engine for your apartment complex.
          <br />
          Pick a name. Pick a floor. Start beef.
        </p>

        <form
          onSubmit={handleLogin}
          className="bg-gray-900 border border-pink-800/50 rounded-lg p-6 w-full max-w-sm space-y-4"
        >
          <div>
            <label className="block text-[9px] text-gray-400 mb-1">
              USERNAME (no real names)
            </label>
            <input
              type="text"
              maxLength={24}
              value={loginForm.username}
              onChange={(e) =>
                setLoginForm((f) => ({ ...f, username: e.target.value }))
              }
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-cyan-400 text-xs focus:border-pink-500 focus:outline-none"
              placeholder="xX_FloorBoss_Xx"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[9px] text-gray-400 mb-1">
              FLOOR (1-7)
            </label>
            <select
              value={loginForm.floor}
              onChange={(e) =>
                setLoginForm((f) => ({
                  ...f,
                  floor: parseInt(e.target.value),
                }))
              }
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-cyan-400 text-xs focus:border-pink-500 focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((f) => (
                <option key={f} value={f}>
                  Floor {f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] text-gray-400 mb-1">
              AVATAR
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((em) => (
                <button
                  type="button"
                  key={em}
                  onClick={() => setLoginForm((f) => ({ ...f, emoji: em }))}
                  className={`text-xl p-1 rounded ${
                    loginForm.emoji === em
                      ? "bg-pink-900 ring-2 ring-pink-400"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {loginError && (
            <p className="text-red-400 text-[9px]">{loginError}</p>
          )}

          <button
            type="submit"
            className="w-full bg-pink-600 hover:bg-pink-500 text-white py-2 rounded text-xs transition-colors"
          >
            ENTER THE COMPLEX
          </button>
        </form>

        <p className="text-gray-600 text-[8px] mt-4 text-center">
          Requires Chrome 113+ with WebGPU support
        </p>
      </div>
    );
  }

  // ── Main Game Screen ───────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b border-pink-900/40">
        <div className="flex items-center gap-3">
          <h1 className="text-pink-500 text-xs">IDLE FIGHT CLUB</h1>
          <span className="text-[8px] text-gray-500">
            {allUsers.length} residents
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              user.isOnline ? "bg-green-400" : "bg-gray-600"
            }`}
          />
          <span className="text-[9px] text-cyan-400">{user.username}</span>
          <span className="text-[9px] text-gray-500">F{user.floor}</span>
          {isLoaded && (
            <span className="text-[8px] text-green-500">AI READY</span>
          )}
          {llmError && (
            <span className="text-[8px] text-red-400">AI ERROR</span>
          )}
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-gray-800">
        {[
          { id: "grid", label: "THE GRID" },
          { id: "feed", label: "DRAMA FEED" },
          { id: "my-drama", label: "MY BEEF" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[9px] transition-colors ${
              tab === t.id
                ? "text-pink-400 border-b-2 border-pink-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 p-4">
        {/* ── Grid Tab ── */}
        {tab === "grid" && (
          <div className="flex flex-col items-center gap-4">
            <Grid
              users={allUsers}
              currentUserId={user._id}
              encounterTargetId={encounterTarget?._id}
            />

            {/* Controls hint */}
            <p className="text-[8px] text-gray-500 text-center">
              Arrow keys or WASD to move. Walk next to a 💤 offline user to
              start drama.
            </p>

            {/* Mobile D-pad */}
            <div className="grid grid-cols-3 gap-1 w-32 md:hidden">
              <div />
              <button
                onClick={() => moveUser(0, -1)}
                className="bg-gray-800 rounded p-2 text-center text-xs active:bg-pink-800"
              >
                ▲
              </button>
              <div />
              <button
                onClick={() => moveUser(-1, 0)}
                className="bg-gray-800 rounded p-2 text-center text-xs active:bg-pink-800"
              >
                ◄
              </button>
              <div className="bg-gray-900 rounded p-2 text-center text-[8px] text-gray-600">
                {user.emoji}
              </div>
              <button
                onClick={() => moveUser(1, 0)}
                className="bg-gray-800 rounded p-2 text-center text-xs active:bg-pink-800"
              >
                ►
              </button>
              <div />
              <button
                onClick={() => moveUser(0, 1)}
                className="bg-gray-800 rounded p-2 text-center text-xs active:bg-pink-800"
              >
                ▼
              </button>
              <div />
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                onClick={toggleOnline}
                className={`text-[9px] px-3 py-1 rounded border transition-colors ${
                  user.isOnline
                    ? "border-green-600 text-green-400 hover:bg-green-950"
                    : "border-gray-600 text-gray-400 hover:bg-gray-800"
                }`}
              >
                {user.isOnline ? "GO OFFLINE (be a target)" : "GO ONLINE"}
              </button>
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="text-[9px] px-3 py-1 rounded border border-purple-600 text-purple-400 hover:bg-purple-950 transition-colors"
              >
                AWAY PROMPT
              </button>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className="w-full max-w-md bg-gray-900 border border-purple-800/50 rounded-lg p-4 space-y-3">
                <label className="block text-[9px] text-gray-400">
                  YOUR AWAY PROMPT (this is your AI character when offline):
                </label>
                <textarea
                  value={awayPrompt}
                  onChange={(e) => setAwayPrompt(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-purple-400 text-[10px] focus:border-purple-500 focus:outline-none resize-none"
                  placeholder="I am an aggressive Floor 2 resident who hates noise..."
                />
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-gray-500">
                    {awayPrompt.length}/500
                  </span>
                  <button
                    onClick={saveAwayPrompt}
                    className="text-[9px] px-4 py-1 bg-purple-600 hover:bg-purple-500 rounded transition-colors"
                  >
                    SAVE
                  </button>
                </div>
              </div>
            )}

            {/* Scoreboard mini */}
            <div className="text-[8px] text-gray-500 flex gap-4">
              <span>W: {user.wins || 0}</span>
              <span>L: {user.losses || 0}</span>
            </div>
          </div>
        )}

        {/* ── Drama Feed Tab ── */}
        {tab === "feed" && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-pink-400 text-xs mb-3">
              LATEST DRAMA (COMPLEX-WIDE)
            </h2>
            <DramaFeed logs={dramaLogs} currentUserId={user._id} />
          </div>
        )}

        {/* ── My Drama Tab ── */}
        {tab === "my-drama" && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-pink-400 text-xs mb-3">YOUR BEEF HISTORY</h2>
            <DramaFeed
              logs={dramaLogs.filter(
                (l) =>
                  l.attackerId === user._id || l.defenderId === user._id
              )}
              currentUserId={user._id}
            />
          </div>
        )}
      </div>

      {/* ── Drama Encounter Modal ── */}
      {showDrama && (
        <div className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-950 border-2 border-red-600 rounded-lg p-6 w-full max-w-md space-y-4 animate-glitch">
            <h2 className="text-red-500 text-sm text-center">
              ENCOUNTER!
            </h2>
            <div className="text-[9px] text-gray-400 text-center">
              <span className="text-cyan-400">{user.username}</span>
              {" walked up to "}
              <span className="text-red-400">
                {encounterTarget?.username}
              </span>
              {"'s sleeping avatar..."}
            </div>

            {isGenerating ? (
              <div className="text-center py-6">
                <p className="text-yellow-400 text-[10px] animate-pulse">
                  AI is generating insults...
                </p>
                <p className="text-gray-600 text-[8px] mt-2">
                  (running locally in your browser)
                </p>
              </div>
            ) : (
              <div className="bg-black rounded p-4 border border-red-900/50">
                <p className="text-[10px] text-red-200 whitespace-pre-wrap leading-relaxed">
                  {currentDrama || "*crickets*"}
                </p>
              </div>
            )}

            {!isGenerating && (
              <button
                onClick={() => {
                  setShowDrama(false);
                  setEncounterTarget(null);
                  setCurrentDrama("");
                }}
                className="w-full bg-red-700 hover:bg-red-600 py-2 rounded text-[10px] transition-colors"
              >
                WALK AWAY (for now...)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
