"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Grid from "@/components/Grid";
import DramaFeed from "@/components/DramaFeed";
import LoadingScreen from "@/components/LoadingScreen";
import Paywall from "@/components/Paywall";
import useWebLLM from "@/hooks/useWebLLM";

const EMOJIS = ["😤", "👊", "🔥", "💀", "🐍", "🦈", "👹", "🤡", "💣", "⚡"];

export default function Home() {
  // ── Auth state ─────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // true until cookie check done
  const [loginForm, setLoginForm] = useState({
    username: "",
    floor: 1,
    emoji: "😤",
  });
  const [loginError, setLoginError] = useState("");

  // ── Game state ─────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState([]);
  const [dramaLogs, setDramaLogs] = useState([]);
  const [encounterTarget, setEncounterTarget] = useState(null);
  const [currentDrama, setCurrentDrama] = useState("");
  const [showDrama, setShowDrama] = useState(false);
  const [awayPrompt, setAwayPrompt] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState("grid");
  const [showTutorial, setShowTutorial] = useState(false);

  // ── Subscription state ─────────────────────────────────────────
  const [subStatus, setSubStatus] = useState(null);
  const [subChecked, setSubChecked] = useState(false);

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

  // ══════════════════════════════════════════════════════════════════
  //  AUTO-LOGIN: check cookie on page load
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    async function autoLogin() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setAwayPrompt(data.user.awayPrompt || "");
          }
        }
      } catch (e) {
        console.error("Auto-login failed:", e);
      }
      setAuthLoading(false);
    }
    autoLogin();
  }, []);

  // ── Also persist to sessionStorage for Stripe redirect ─────────
  useEffect(() => {
    if (user) {
      sessionStorage.setItem("fightclub_user", JSON.stringify(user));
    }
  }, [user]);

  // ── Restore from sessionStorage if cookie check returned null ──
  // (handles the Stripe redirect case where cookie might not be set yet)
  useEffect(() => {
    if (!authLoading && !user) {
      try {
        const saved = sessionStorage.getItem("fightclub_user");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?._id) setUser(parsed);
        }
      } catch {}
    }
  }, [authLoading, user]);

  // ══════════════════════════════════════════════════════════════════
  //  SUBSCRIPTION CHECK
  // ══════════════════════════════════════════════════════════════════
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
        setSubStatus({ isActive: true }); // fail open
      }
      setSubChecked(true);
    }

    checkSub();

    // Handle return from Stripe Checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      const sessionId = params.get("session_id");
      window.history.replaceState({}, "", "/");

      if (sessionId) {
        fetch("/api/stripe/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, userId: user._id }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              setSubStatus({ isActive: true });
              setSubChecked(true);
            } else {
              setTimeout(checkSub, 2000);
            }
          })
          .catch(() => setTimeout(checkSub, 2000));
      }
    }
  }, [user]);

  // ── Start AI engine once subscription is confirmed ─────────────
  useEffect(() => {
    if (user && subStatus?.isActive && !isLoaded && !isLoading) {
      initEngine();
    }
  }, [user, subStatus, isLoaded, isLoading, initEngine]);

  // ══════════════════════════════════════════════════════════════════
  //  POLLING
  // ══════════════════════════════════════════════════════════════════
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setAllUsers(await res.json());
    } catch (e) {
      console.error("Failed to fetch users:", e);
    }
  }, []);

  const fetchDrama = useCallback(async () => {
    try {
      const res = await fetch("/api/drama");
      if (res.ok) setDramaLogs(await res.json());
    } catch (e) {
      console.error("Failed to fetch drama:", e);
    }
  }, []);

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

  // ══════════════════════════════════════════════════════════════════
  //  LOGIN / LOGOUT
  // ══════════════════════════════════════════════════════════════════
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
      setShowTutorial(true); // show tutorial for new users
    } catch (err) {
      setLoginError("Network error. Try again.");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    setSubStatus(null);
    setSubChecked(false);
    sessionStorage.removeItem("fightclub_user");
  }

  // ══════════════════════════════════════════════════════════════════
  //  MOVEMENT
  // ══════════════════════════════════════════════════════════════════
  const moveUser = useCallback(
    async (dx, dy) => {
      if (!user || !user.isOnline || moveThrottleRef.current || isGenerating) return;
      moveThrottleRef.current = true;

      const newX = Math.max(0, Math.min(19, user.x + dx));
      const newY = Math.max(0, Math.min(19, user.y + dy));

      if (newX === user.x && newY === user.y) {
        moveThrottleRef.current = false;
        return;
      }

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

      checkEncounters(newX, newY);

      setTimeout(() => {
        moveThrottleRef.current = false;
      }, 120);
    },
    [user, allUsers, isGenerating, isLoaded, showDrama]
  );

  // ══════════════════════════════════════════════════════════════════
  //  ENCOUNTER DETECTION & AI FIGHT
  // ══════════════════════════════════════════════════════════════════
  function checkEncounters(px, py) {
    if (isGenerating || showDrama || !isLoaded) return;

    const adjacent = allUsers.find((u) => {
      if (u._id === user._id) return false;
      if (u.isOnline) return false;
      const dx = Math.abs(u.x - px);
      const dy = Math.abs(u.y - py);
      return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
    });

    if (adjacent) {
      triggerEncounter(adjacent);
    }
  }

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

      fetchDrama();
    } catch (err) {
      setCurrentDrama("*The AI choked on its own insult and passed out*");
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  KEYBOARD HANDLER
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;

    function handleKey(e) {
      const moves = {
        ArrowUp: [0, -1], w: [0, -1],
        ArrowDown: [0, 1], s: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0],
      };
      const m = moves[e.key];
      if (m) {
        e.preventDefault();
        moveUser(m[0], m[1]);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [user, moveUser]);

  // ══════════════════════════════════════════════════════════════════
  //  AWAY PROMPT + ONLINE/OFFLINE TOGGLE
  // ══════════════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════

  // ── Initial auth loading ───────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <h1 className="text-pink-500 text-lg mb-3">IDLE FIGHT CLUB</h1>
          <p className="text-gray-500 text-[10px] animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Paywall ────────────────────────────────────────────────────
  if (user && subChecked && !subStatus?.isActive) {
    return <Paywall userId={user._id} />;
  }

  // ── Sub check loading ─────────────────────────────────────────
  if (user && !subChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-[10px] animate-pulse">Checking subscription...</p>
      </div>
    );
  }

  // ── WebLLM Loading Screen ─────────────────────────────────────
  if (user && isLoading) {
    return <LoadingScreen progress={initProgress} />;
  }

  // ── Login Screen ───────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-pink-500 text-xl mb-1 text-center">
          IDLE FIGHT CLUB
        </h1>
        <p className="text-gray-500 text-[9px] mb-6 text-center max-w-sm">
          The AI-powered drama engine for your apartment complex.
        </p>

        {/* How it works */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 w-full max-w-sm mb-4 space-y-2">
          <p className="text-cyan-400 text-[9px] font-bold mb-2">HOW IT WORKS</p>
          <div className="flex items-start gap-2">
            <span className="text-pink-400 text-[10px]">1.</span>
            <p className="text-gray-400 text-[9px]">Pick a name, floor & avatar. No real names.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-pink-400 text-[10px]">2.</span>
            <p className="text-gray-400 text-[9px]">Move around the grid with arrow keys or WASD.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-pink-400 text-[10px]">3.</span>
            <p className="text-gray-400 text-[9px]">Walk next to an offline player's avatar to trigger an AI fight.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-pink-400 text-[10px]">4.</span>
            <p className="text-gray-400 text-[9px]">Go offline with a custom personality — your AI avatar roams and fights for you.</p>
          </div>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-gray-900 border border-pink-800/50 rounded-lg p-6 w-full max-w-sm space-y-4"
        >
          <div>
            <label className="block text-[9px] text-gray-400 mb-1">USERNAME</label>
            <input
              type="text"
              maxLength={24}
              value={loginForm.username}
              onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-cyan-400 text-xs focus:border-pink-500 focus:outline-none"
              placeholder="xX_FloorBoss_Xx"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[9px] text-gray-400 mb-1">FLOOR (1-7)</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setLoginForm((prev) => ({ ...prev, floor: f }))}
                  className={`flex-1 py-2 rounded text-xs transition-colors ${
                    loginForm.floor === f
                      ? "bg-pink-700 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[9px] text-gray-400 mb-1">AVATAR</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((em) => (
                <button
                  type="button"
                  key={em}
                  onClick={() => setLoginForm((f) => ({ ...f, emoji: em }))}
                  className={`text-xl p-1 rounded transition-all ${
                    loginForm.emoji === em
                      ? "bg-pink-900 ring-2 ring-pink-400 scale-110"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {loginError && <p className="text-red-400 text-[9px]">{loginError}</p>}

          <button
            type="submit"
            className="w-full bg-pink-600 hover:bg-pink-500 text-white py-3 rounded text-xs transition-colors"
          >
            ENTER THE COMPLEX
          </button>
        </form>

        <p className="text-gray-600 text-[8px] mt-3 text-center">
          Requires Chrome 113+ with WebGPU
        </p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  MAIN GAME SCREEN
  // ══════════════════════════════════════════════════════════════════
  const offlineCount = allUsers.filter((u) => !u.isOnline).length;
  const onlineCount = allUsers.filter((u) => u.isOnline).length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="flex items-center justify-between p-3 border-b border-pink-900/40">
        <div className="flex items-center gap-3">
          <h1 className="text-pink-500 text-xs">IDLE FIGHT CLUB</h1>
          <span className="text-[8px] text-gray-500">
            {onlineCount} online / {offlineCount} sleeping
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${user.isOnline ? "bg-green-400" : "bg-gray-600"}`} />
          <span className="text-[9px] text-cyan-400">{user.username}</span>
          <span className="text-[9px] text-gray-500">F{user.floor}</span>
          <span className="text-[8px] text-gray-600">W:{user.wins || 0} L:{user.losses || 0}</span>
          {isLoaded && <span className="text-[8px] text-green-500">AI READY</span>}
          {llmError && <span className="text-[8px] text-red-400" title={llmError}>AI ERR</span>}
          <button onClick={() => setShowTutorial(true)} className="text-[9px] text-gray-500 hover:text-cyan-400" title="How to play">?</button>
          <button onClick={handleLogout} className="text-[9px] text-gray-500 hover:text-red-400" title="Logout">EXIT</button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-gray-800">
        {[
          { id: "grid", label: "THE GRID" },
          { id: "feed", label: `DRAMA FEED (${dramaLogs.length})` },
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

      {/* ── Content ── */}
      <div className="flex-1 p-4">
        {/* ── Grid Tab ── */}
        {tab === "grid" && (
          <div className="flex flex-col items-center gap-4">
            {/* Status banner */}
            {!user.isOnline && (
              <div className="w-full max-w-[600px] bg-purple-950/50 border border-purple-600/50 rounded p-3 text-center">
                <p className="text-purple-300 text-[10px]">
                  You are OFFLINE — your AI avatar is roaming the grid and fighting for you.
                </p>
                <button onClick={toggleOnline} className="text-[9px] text-cyan-400 mt-1 underline">
                  Go back online
                </button>
              </div>
            )}

            {!isLoaded && !isLoading && !llmError && (
              <div className="w-full max-w-[600px] bg-yellow-950/30 border border-yellow-600/30 rounded p-2 text-center">
                <p className="text-yellow-400 text-[9px]">AI engine loading... encounters will trigger once ready.</p>
              </div>
            )}

            <Grid
              users={allUsers}
              currentUserId={user._id}
              encounterTargetId={encounterTarget?._id}
            />

            {/* ── Controls ── */}
            {user.isOnline && (
              <p className="text-[8px] text-gray-500 text-center">
                Use arrow keys / WASD to move. Walk next to a sleeping avatar to start a fight.
              </p>
            )}

            {/* Mobile D-pad — always show on small screens */}
            {user.isOnline && (
              <div className="grid grid-cols-3 gap-1 w-36 md:hidden">
                <div />
                <button onClick={() => moveUser(0, -1)} className="bg-gray-800 rounded p-3 text-center text-sm active:bg-pink-800">▲</button>
                <div />
                <button onClick={() => moveUser(-1, 0)} className="bg-gray-800 rounded p-3 text-center text-sm active:bg-pink-800">◄</button>
                <div className="bg-gray-900 rounded p-3 text-center text-lg">{user.emoji}</div>
                <button onClick={() => moveUser(1, 0)} className="bg-gray-800 rounded p-3 text-center text-sm active:bg-pink-800">►</button>
                <div />
                <button onClick={() => moveUser(0, 1)} className="bg-gray-800 rounded p-3 text-center text-sm active:bg-pink-800">▼</button>
                <div />
              </div>
            )}

            {/* ── Action buttons ── */}
            <div className="flex gap-2 flex-wrap justify-center">
              {user.isOnline ? (
                <button
                  onClick={toggleOnline}
                  className="text-[10px] px-4 py-2 rounded border border-purple-600 text-purple-400 hover:bg-purple-950 transition-colors"
                >
                  GO OFFLINE — let your AI fight for you
                </button>
              ) : (
                <button
                  onClick={toggleOnline}
                  className="text-[10px] px-4 py-2 rounded border border-green-600 text-green-400 hover:bg-green-950 transition-colors"
                >
                  GO ONLINE — take back control
                </button>
              )}
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="text-[10px] px-4 py-2 rounded border border-cyan-600 text-cyan-400 hover:bg-cyan-950 transition-colors"
              >
                {showSettings ? "CLOSE" : "EDIT PERSONALITY"}
              </button>
            </div>

            {/* ── Away Prompt editor ── */}
            {showSettings && (
              <div className="w-full max-w-md bg-gray-900 border border-cyan-800/50 rounded-lg p-4 space-y-3">
                <label className="block text-[9px] text-cyan-400 font-bold">
                  YOUR AI PERSONALITY
                </label>
                <p className="text-[8px] text-gray-500">
                  This is who your avatar becomes when you go offline. Other players will trigger AI fights with this character.
                </p>
                <textarea
                  value={awayPrompt}
                  onChange={(e) => setAwayPrompt(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-cyan-300 text-[10px] focus:border-cyan-500 focus:outline-none resize-none"
                  placeholder="Example: I'm a Floor 3 night owl who blasts music at 2am and thinks everyone else is a tourist in MY building..."
                />
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-gray-500">{awayPrompt.length}/500</span>
                  <button
                    onClick={saveAwayPrompt}
                    className="text-[9px] px-4 py-1 bg-cyan-600 hover:bg-cyan-500 rounded transition-colors"
                  >
                    SAVE PERSONALITY
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Drama Feed Tab ── */}
        {tab === "feed" && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-pink-400 text-xs mb-3">LATEST DRAMA (COMPLEX-WIDE)</h2>
            {dramaLogs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-[10px]">No drama yet.</p>
                <p className="text-gray-600 text-[9px] mt-1">Go find a sleeping avatar and start some beef!</p>
              </div>
            ) : (
              <DramaFeed logs={dramaLogs} currentUserId={user._id} />
            )}
          </div>
        )}

        {/* ── My Drama Tab ── */}
        {tab === "my-drama" && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-pink-400 text-xs mb-3">YOUR BEEF HISTORY</h2>
            <DramaFeed
              logs={dramaLogs.filter(
                (l) => l.attackerId === user._id || l.defenderId === user._id
              )}
              currentUserId={user._id}
            />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  DRAMA ENCOUNTER MODAL                                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showDrama && (
        <div className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-950 border-2 border-red-600 rounded-lg p-6 w-full max-w-md space-y-4 animate-glitch">
            <h2 className="text-red-500 text-sm text-center">ENCOUNTER!</h2>
            <div className="text-[9px] text-gray-400 text-center">
              <span className="text-cyan-400">{user.username}</span>
              {" walked up to "}
              <span className="text-red-400">{encounterTarget?.username}</span>
              {"'s sleeping avatar..."}
            </div>

            {isGenerating ? (
              <div className="text-center py-6">
                <p className="text-yellow-400 text-[10px] animate-pulse">AI is generating insults...</p>
                <p className="text-gray-600 text-[8px] mt-2">(running locally in your browser)</p>
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

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  TUTORIAL MODAL                                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="bg-gray-950 border-2 border-cyan-600 rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-cyan-400 text-sm text-center">HOW TO PLAY</h2>

            <div className="space-y-3 text-[10px] text-gray-300 leading-relaxed">
              <div className="flex gap-3 items-start">
                <span className="text-2xl">🫵</span>
                <div>
                  <p className="text-cyan-400 font-bold">THAT'S YOU</p>
                  <p className="text-gray-400">The cyan-highlighted avatar on the grid. Move with arrow keys or WASD (or the D-pad on mobile).</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-2xl">😤</span>
                <div>
                  <p className="text-green-400 font-bold">ONLINE PLAYERS</p>
                  <p className="text-gray-400">Other players who are currently active. You can see them moving around.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-2xl">💤</span>
                <div>
                  <p className="text-purple-400 font-bold">OFFLINE PLAYERS (TARGETS)</p>
                  <p className="text-gray-400">Players who went offline. Walk next to one to trigger an AI-generated fight! The AI uses their custom personality to roast you.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-2xl">🧠</span>
                <div>
                  <p className="text-pink-400 font-bold">GO OFFLINE</p>
                  <p className="text-gray-400">Set your personality prompt and go offline. Your AI avatar will roam the grid automatically, and other players can fight it. Check the Drama Feed to see what happened while you were away!</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-2xl">📜</span>
                <div>
                  <p className="text-yellow-400 font-bold">DRAMA FEED</p>
                  <p className="text-gray-400">All fights are saved. Check "My Beef" to see encounters involving your avatar.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowTutorial(false)}
              className="w-full bg-cyan-700 hover:bg-cyan-600 py-2 rounded text-[10px] transition-colors"
            >
              GOT IT — LET'S FIGHT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
