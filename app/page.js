"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Grid from "@/components/Grid";
import DramaFeed from "@/components/DramaFeed";
import LoadingScreen from "@/components/LoadingScreen";
import Paywall from "@/components/Paywall";
import PixelAvatar from "@/components/PixelAvatar";
import AvatarCreator from "@/components/AvatarCreator";
import useWebLLM from "@/hooks/useWebLLM";

const DEFAULT_AVATAR = {
  bodyColor: "#4FC3F7",
  hairStyle: 0,
  hairColor: "#222222",
  eyeStyle: 0,
  mouthStyle: 0,
  outfitColor: "#E91E63",
  accessory: 0,
};

export default function Home() {
  // ── Auth state ─────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authTab, setAuthTab] = useState("login"); // "login" | "signup"
  const [authForm, setAuthForm] = useState({
    username: "",
    password: "",
    floor: 1,
    avatar: { ...DEFAULT_AVATAR },
  });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

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
  const [selectedUser, setSelectedUser] = useState(null); // for profile popup

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
  const encounterCooldownRef = useRef(false);

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

  // ── Persist to sessionStorage for Stripe redirect ─────────────
  useEffect(() => {
    if (user) {
      sessionStorage.setItem("fightclub_user", JSON.stringify(user));
    }
  }, [user]);

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
        setSubStatus({ isActive: true });
      }
      setSubChecked(true);
    }

    checkSub();

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

  // ── Start AI engine once subscription confirmed ────────────────
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
    } catch {}
  }, []);

  const fetchDrama = useCallback(async () => {
    try {
      const res = await fetch("/api/drama");
      if (res.ok) setDramaLogs(await res.json());
    } catch {}
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
  //  AUTH: SIGN UP / SIGN IN
  // ══════════════════════════════════════════════════════════════════
  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");
    setAuthBusy(true);

    const endpoint =
      authTab === "signup" ? "/api/auth/register" : "/api/auth/login";
    const body =
      authTab === "signup"
        ? {
            username: authForm.username,
            password: authForm.password,
            floor: authForm.floor,
            avatar: authForm.avatar,
          }
        : { username: authForm.username, password: authForm.password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Something went wrong");
        setAuthBusy(false);
        return;
      }

      setUser(data);
      setAwayPrompt(data.awayPrompt || "");
      if (authTab === "signup") setShowTutorial(true);
    } catch {
      setAuthError("Network error. Try again.");
    }
    setAuthBusy(false);
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
      if (!user || !user.isOnline || moveThrottleRef.current || isGenerating)
        return;
      moveThrottleRef.current = true;

      const newX = Math.max(0, Math.min(19, user.x + dx));
      const newY = Math.max(0, Math.min(19, user.y + dy));

      if (newX === user.x && newY === user.y) {
        moveThrottleRef.current = false;
        return;
      }

      setUser((prev) => ({ ...prev, x: newX, y: newY }));

      try {
        await fetch("/api/users/move", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user._id, x: newX, y: newY }),
        });
      } catch {}

      // Check encounters after moving
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
    if (isGenerating || showDrama || !isLoaded || encounterCooldownRef.current)
      return;

    const adjacent = allUsers.find((u) => {
      if (u._id === user._id) return false;
      if (u.isOnline) return false; // can only fight offline avatars
      const dx = Math.abs(u.x - px);
      const dy = Math.abs(u.y - py);
      return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
    });

    if (adjacent) {
      triggerEncounter(adjacent);
    }
  }

  function handleCellClick(occupant) {
    if (occupant._id === user?._id) return;
    if (!occupant.isOnline && isLoaded && !isGenerating && !showDrama) {
      // Click on offline user = trigger fight
      triggerEncounter(occupant);
    } else {
      // Show profile popup
      setSelectedUser(occupant);
    }
  }

  async function triggerEncounter(target) {
    if (encounterCooldownRef.current) return;
    encounterCooldownRef.current = true;

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
    } catch {
      setCurrentDrama("*The AI choked on its own insult and passed out*");
    }

    // Cooldown to prevent spam
    setTimeout(() => {
      encounterCooldownRef.current = false;
    }, 5000);
  }

  // ══════════════════════════════════════════════════════════════════
  //  KEYBOARD HANDLER
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;

    function handleKey(e) {
      // Don't capture if user is typing in an input
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA"
      )
        return;

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
    } catch {}
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
    } catch {}
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: AUTH LOADING
  // ══════════════════════════════════════════════════════════════════
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <h1 className="text-pink-500 text-lg mb-3">IDLE FIGHT CLUB</h1>
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-[10px]">Checking subscription...</p>
        </div>
      </div>
    );
  }

  // ── WebLLM Loading ────────────────────────────────────────────
  if (user && isLoading) {
    return <LoadingScreen progress={initProgress} />;
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: LOGIN / SIGNUP SCREEN
  // ══════════════════════════════════════════════════════════════════
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0a0a0f]">
        <h1 className="text-pink-500 text-2xl mb-1 text-center tracking-widest">
          IDLE FIGHT CLUB
        </h1>
        <p className="text-gray-500 text-[10px] mb-6 text-center max-w-sm">
          AI-powered apartment complex drama engine
        </p>

        {/* Auth tab switcher */}
        <div className="flex mb-4 bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
          <button
            onClick={() => {
              setAuthTab("login");
              setAuthError("");
            }}
            className={`px-6 py-2 text-xs transition-colors ${
              authTab === "login"
                ? "bg-pink-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            SIGN IN
          </button>
          <button
            onClick={() => {
              setAuthTab("signup");
              setAuthError("");
            }}
            className={`px-6 py-2 text-xs transition-colors ${
              authTab === "signup"
                ? "bg-pink-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            SIGN UP
          </button>
        </div>

        <form
          onSubmit={handleAuth}
          className="bg-gray-900/80 border border-pink-800/40 rounded-lg p-6 w-full max-w-sm space-y-4"
        >
          {/* Username */}
          <div>
            <label className="block text-[9px] text-gray-400 mb-1">
              USERNAME
            </label>
            <input
              type="text"
              maxLength={24}
              value={authForm.username}
              onChange={(e) =>
                setAuthForm((f) => ({ ...f, username: e.target.value }))
              }
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-cyan-400 text-xs focus:border-pink-500 focus:outline-none"
              placeholder="xX_FloorBoss_Xx"
              autoFocus
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[9px] text-gray-400 mb-1">
              PASSWORD
            </label>
            <input
              type="password"
              value={authForm.password}
              onChange={(e) =>
                setAuthForm((f) => ({ ...f, password: e.target.value }))
              }
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-cyan-400 text-xs focus:border-pink-500 focus:outline-none"
              placeholder={
                authTab === "signup" ? "Pick something memorable" : "Your password"
              }
            />
          </div>

          {/* Sign-up only fields */}
          {authTab === "signup" && (
            <>
              {/* Floor selection */}
              <div>
                <label className="block text-[9px] text-gray-400 mb-1">
                  YOUR FLOOR (1-7)
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((f) => (
                    <button
                      type="button"
                      key={f}
                      onClick={() =>
                        setAuthForm((prev) => ({ ...prev, floor: f }))
                      }
                      className={`flex-1 py-2 rounded text-xs transition-colors ${
                        authForm.floor === f
                          ? "bg-pink-700 text-white"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar Creator */}
              <div>
                <label className="block text-[9px] text-gray-400 mb-2">
                  CREATE YOUR FIGHTER
                </label>
                <AvatarCreator
                  value={authForm.avatar}
                  onChange={(av) =>
                    setAuthForm((f) => ({ ...f, avatar: av }))
                  }
                />
              </div>
            </>
          )}

          {authError && (
            <p className="text-red-400 text-[10px] bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={authBusy}
            className={`w-full py-3 rounded text-xs font-bold transition-colors ${
              authBusy
                ? "bg-gray-700 text-gray-400 cursor-wait"
                : "bg-pink-600 hover:bg-pink-500 text-white"
            }`}
          >
            {authBusy
              ? "LOADING..."
              : authTab === "signup"
              ? "CREATE ACCOUNT & ENTER"
              : "SIGN IN"}
          </button>

          <p className="text-[8px] text-gray-600 text-center">
            {authTab === "login"
              ? "Don't have an account? Click SIGN UP above."
              : "Already have an account? Click SIGN IN above."}
          </p>
        </form>

        {/* How it works (below form) */}
        <div className="mt-6 bg-gray-900/40 border border-gray-800 rounded-lg p-4 w-full max-w-sm">
          <p className="text-cyan-400 text-[9px] font-bold mb-3">HOW IT WORKS</p>
          <div className="space-y-2 text-[9px] text-gray-400">
            <p>
              <span className="text-pink-400 mr-1">1.</span>
              Sign up with a username, password, and custom pixel avatar.
            </p>
            <p>
              <span className="text-pink-400 mr-1">2.</span>
              Move around the 20x20 grid with arrow keys, WASD, or tap.
            </p>
            <p>
              <span className="text-pink-400 mr-1">3.</span>
              Walk next to (or click) an offline player to trigger an AI trash talk fight.
            </p>
            <p>
              <span className="text-pink-400 mr-1">4.</span>
              Set a personality prompt and go offline — your avatar roams and fights for you.
            </p>
            <p>
              <span className="text-pink-400 mr-1">5.</span>
              Come back and check the Drama Feed to see what your AI said while you slept.
            </p>
          </div>
        </div>

        <p className="text-gray-600 text-[8px] mt-3 text-center">
          Requires Chrome 113+ with WebGPU
        </p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: MAIN GAME SCREEN
  // ══════════════════════════════════════════════════════════════════
  const offlineUsers = allUsers.filter((u) => !u.isOnline);
  const onlineUsers = allUsers.filter((u) => u.isOnline);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      {/* ── Header ── */}
      <header className="flex items-center justify-between p-3 border-b border-pink-900/40 bg-gray-950/80">
        <div className="flex items-center gap-3">
          <h1 className="text-pink-500 text-xs tracking-widest">
            IDLE FIGHT CLUB
          </h1>
          <span className="text-[8px] text-gray-500">
            <span className="text-green-400">{onlineUsers.length}</span> online
            {" / "}
            <span className="text-purple-400">{offlineUsers.length}</span>{" "}
            sleeping
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PixelAvatar avatar={user.avatar} size={20} />
          <span className="text-[9px] text-cyan-400">{user.username}</span>
          <span className="text-[9px] text-gray-500">F{user.floor}</span>
          <span className="text-[8px] text-gray-600">
            W:{user.wins || 0} L:{user.losses || 0}
          </span>
          {isLoaded && (
            <span className="text-[8px] text-green-500 bg-green-950/40 px-1.5 py-0.5 rounded">
              AI READY
            </span>
          )}
          {llmError && (
            <span
              className="text-[8px] text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded"
              title={llmError}
            >
              AI ERR
            </span>
          )}
          <button
            onClick={() => setShowTutorial(true)}
            className="text-[9px] text-gray-500 hover:text-cyan-400 bg-gray-800 rounded px-1.5 py-0.5"
            title="How to play"
          >
            ?
          </button>
          <button
            onClick={handleLogout}
            className="text-[9px] text-gray-500 hover:text-red-400 bg-gray-800 rounded px-1.5 py-0.5"
            title="Sign out"
          >
            EXIT
          </button>
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
            {/* Offline banner */}
            {!user.isOnline && (
              <div className="w-full max-w-[600px] bg-purple-950/40 border border-purple-600/40 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <PixelAvatar avatar={user.avatar} size={28} isOnline={false} />
                  <p className="text-purple-300 text-[10px]">
                    You are <strong>OFFLINE</strong> — your AI avatar is roaming
                    and fighting for you.
                  </p>
                </div>
                <button
                  onClick={toggleOnline}
                  className="text-[9px] text-cyan-400 mt-1 underline hover:text-cyan-300"
                >
                  Go back online
                </button>
              </div>
            )}

            {/* AI not ready banner */}
            {!isLoaded && !isLoading && !llmError && (
              <div className="w-full max-w-[600px] bg-yellow-950/30 border border-yellow-600/30 rounded p-2 text-center">
                <p className="text-yellow-400 text-[9px]">
                  AI engine loading... encounters will trigger once ready.
                </p>
              </div>
            )}

            {/* The Grid */}
            <Grid
              users={allUsers}
              currentUserId={user._id}
              encounterTargetId={encounterTarget?._id}
              onCellClick={handleCellClick}
            />

            {/* Controls hint */}
            {user.isOnline && (
              <p className="text-[8px] text-gray-500 text-center max-w-md">
                Move with <span className="text-cyan-400">arrow keys</span> or{" "}
                <span className="text-cyan-400">WASD</span>. Walk next to a
                sleeping avatar (or click one) to start a fight.
              </p>
            )}

            {/* Mobile D-pad */}
            {user.isOnline && (
              <div className="grid grid-cols-3 gap-1 w-32 md:hidden">
                <div />
                <button
                  onClick={() => moveUser(0, -1)}
                  className="bg-gray-800 rounded p-2 text-center text-sm active:bg-pink-800"
                >
                  ▲
                </button>
                <div />
                <button
                  onClick={() => moveUser(-1, 0)}
                  className="bg-gray-800 rounded p-2 text-center text-sm active:bg-pink-800"
                >
                  ◄
                </button>
                <div className="bg-gray-900 rounded p-1 flex items-center justify-center">
                  <PixelAvatar avatar={user.avatar} size={20} />
                </div>
                <button
                  onClick={() => moveUser(1, 0)}
                  className="bg-gray-800 rounded p-2 text-center text-sm active:bg-pink-800"
                >
                  ►
                </button>
                <div />
                <button
                  onClick={() => moveUser(0, 1)}
                  className="bg-gray-800 rounded p-2 text-center text-sm active:bg-pink-800"
                >
                  ▼
                </button>
                <div />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap justify-center">
              {user.isOnline ? (
                <button
                  onClick={toggleOnline}
                  className="text-[10px] px-4 py-2 rounded border border-purple-600 text-purple-400 hover:bg-purple-950 transition-colors flex items-center gap-2"
                >
                  <span>GO OFFLINE</span>
                  <span className="text-[8px] text-gray-500">
                    (let your AI fight)
                  </span>
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

            {/* Away Prompt editor */}
            {showSettings && (
              <div className="w-full max-w-md bg-gray-900 border border-cyan-800/50 rounded-lg p-4 space-y-3">
                <label className="block text-[9px] text-cyan-400 font-bold">
                  YOUR AI PERSONALITY
                </label>
                <p className="text-[8px] text-gray-500">
                  This is who your avatar becomes when you go offline. Other
                  players will trigger AI fights with this character.
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
                  <span className="text-[8px] text-gray-500">
                    {awayPrompt.length}/500
                  </span>
                  <button
                    onClick={saveAwayPrompt}
                    className="text-[9px] px-4 py-1 bg-cyan-600 hover:bg-cyan-500 rounded transition-colors"
                  >
                    SAVE
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Drama Feed Tab ── */}
        {tab === "feed" && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-pink-400 text-xs mb-3">
              LATEST DRAMA (COMPLEX-WIDE)
            </h2>
            {dramaLogs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-[10px]">No drama yet.</p>
                <p className="text-gray-600 text-[9px] mt-1">
                  Go find a sleeping avatar and start some beef!
                </p>
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
            {dramaLogs.filter(
              (l) => l.attackerId === user._id || l.defenderId === user._id
            ).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-[10px]">
                  No beef involving you yet.
                </p>
                <p className="text-gray-600 text-[9px] mt-1">
                  Go pick a fight or go offline and let others fight your AI!
                </p>
              </div>
            ) : (
              <DramaFeed
                logs={dramaLogs.filter(
                  (l) =>
                    l.attackerId === user._id || l.defenderId === user._id
                )}
                currentUserId={user._id}
              />
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  ENCOUNTER MODAL                                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showDrama && (
        <div className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-950 border-2 border-red-600 rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-red-500 text-sm text-center tracking-widest">
              ENCOUNTER!
            </h2>

            {/* VS display */}
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <PixelAvatar avatar={user.avatar} size={48} glow="#00BCD4" />
                <p className="text-cyan-400 text-[9px] mt-1">{user.username}</p>
              </div>
              <span className="text-red-500 text-lg font-bold">VS</span>
              <div className="text-center">
                <PixelAvatar
                  avatar={encounterTarget?.avatar}
                  size={48}
                  isOnline={false}
                  glow="#F44336"
                />
                <p className="text-red-400 text-[9px] mt-1">
                  {encounterTarget?.username}
                </p>
              </div>
            </div>

            {isGenerating ? (
              <div className="text-center py-4">
                <p className="text-yellow-400 text-[10px] animate-pulse">
                  AI is generating insults...
                </p>
                <p className="text-gray-600 text-[8px] mt-2">
                  (running locally in your browser via WebGPU)
                </p>
              </div>
            ) : (
              <div className="bg-black rounded-lg p-4 border border-red-900/50 max-h-48 overflow-y-auto">
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
      {/*  PLAYER PROFILE POPUP                                         */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-gray-950 border border-gray-700 rounded-lg p-5 w-full max-w-xs space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <PixelAvatar
                avatar={selectedUser.avatar}
                size={56}
                isOnline={selectedUser.isOnline}
              />
              <div>
                <p className="text-cyan-400 text-sm">{selectedUser.username}</p>
                <p className="text-gray-500 text-[9px]">
                  Floor {selectedUser.floor}
                </p>
                <p className="text-gray-500 text-[8px]">
                  W:{selectedUser.wins || 0} L:{selectedUser.losses || 0}
                </p>
                <p
                  className={`text-[8px] mt-1 ${
                    selectedUser.isOnline ? "text-green-400" : "text-purple-400"
                  }`}
                >
                  {selectedUser.isOnline ? "ONLINE" : "OFFLINE (AI active)"}
                </p>
              </div>
            </div>

            {!selectedUser.isOnline && isLoaded && (
              <button
                onClick={() => {
                  setSelectedUser(null);
                  triggerEncounter(selectedUser);
                }}
                className="w-full bg-red-700 hover:bg-red-600 py-2 rounded text-[10px] transition-colors"
              >
                START FIGHT
              </button>
            )}

            <button
              onClick={() => setSelectedUser(null)}
              className="w-full bg-gray-800 hover:bg-gray-700 py-1.5 rounded text-[9px] text-gray-400 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  TUTORIAL MODAL                                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="bg-gray-950 border-2 border-cyan-600 rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-cyan-400 text-sm text-center tracking-widest">
              HOW TO PLAY
            </h2>

            <div className="space-y-3 text-[10px] text-gray-300 leading-relaxed">
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0">
                  <PixelAvatar avatar={user.avatar} size={28} glow="#00BCD4" />
                </div>
                <div>
                  <p className="text-cyan-400 font-bold">THAT'S YOU</p>
                  <p className="text-gray-400">
                    The cyan-highlighted avatar. Move with arrow keys, WASD, or
                    the D-pad on mobile.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-7 h-7 bg-green-900/40 rounded flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div>
                  <p className="text-green-400 font-bold">ONLINE PLAYERS</p>
                  <p className="text-gray-400">
                    Other active players. You can see them moving around. Click
                    one to view their profile.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-7 h-7 bg-purple-900/40 rounded flex items-center justify-center">
                  <span className="text-purple-400 text-[8px] font-bold">
                    ZZZ
                  </span>
                </div>
                <div>
                  <p className="text-purple-400 font-bold">
                    OFFLINE PLAYERS (TARGETS)
                  </p>
                  <p className="text-gray-400">
                    Players who went offline. Walk next to one or click them to
                    trigger an AI trash talk fight!
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-7 h-7 bg-pink-900/40 rounded flex items-center justify-center">
                  <span className="text-pink-400 text-xs">AI</span>
                </div>
                <div>
                  <p className="text-pink-400 font-bold">GO OFFLINE</p>
                  <p className="text-gray-400">
                    Set your personality prompt and go offline. Your AI avatar
                    roams the grid automatically, and other players can fight it.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-7 h-7 bg-yellow-900/40 rounded flex items-center justify-center">
                  <span className="text-yellow-400 text-xs">!</span>
                </div>
                <div>
                  <p className="text-yellow-400 font-bold">DRAMA FEED</p>
                  <p className="text-gray-400">
                    All fights are saved. Check "MY BEEF" to see encounters
                    involving your avatar.
                  </p>
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
