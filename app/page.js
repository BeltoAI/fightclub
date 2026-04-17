"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Grid from "@/components/Grid";
import DramaFeed from "@/components/DramaFeed";
import LoadingScreen from "@/components/LoadingScreen";
import Paywall from "@/components/Paywall";
import PixelAvatar from "@/components/PixelAvatar";
import AvatarCreator from "@/components/AvatarCreator";
import useWebLLM from "@/hooks/useWebLLM";

const GRID_MAX = 9; // 10x10 grid (0-9)

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
  const [authTab, setAuthTab] = useState("login");
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
  const [fightFeedback, setFightFeedback] = useState(""); // toast feedback

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
  //  AUTO-LOGIN
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

  useEffect(() => {
    if (user) sessionStorage.setItem("fightclub_user", JSON.stringify(user));
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
      } catch {
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
            } else setTimeout(checkSub, 2000);
          })
          .catch(() => setTimeout(checkSub, 2000));
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && subStatus?.isActive && !isLoaded && !isLoading) initEngine();
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
  //  AUTH
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
  //  MOVEMENT (10x10 grid)
  // ══════════════════════════════════════════════════════════════════
  const moveUser = useCallback(
    async (dx, dy) => {
      if (!user || !user.isOnline || moveThrottleRef.current || isGenerating)
        return;
      moveThrottleRef.current = true;

      const newX = Math.max(0, Math.min(GRID_MAX, user.x + dx));
      const newY = Math.max(0, Math.min(GRID_MAX, user.y + dy));

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

      checkEncounters(newX, newY);

      setTimeout(() => {
        moveThrottleRef.current = false;
      }, 120);
    },
    [user, allUsers, isGenerating, isLoaded, showDrama]
  );

  // ══════════════════════════════════════════════════════════════════
  //  ENCOUNTERS
  // ══════════════════════════════════════════════════════════════════
  function checkEncounters(px, py) {
    if (isGenerating || showDrama || !isLoaded || encounterCooldownRef.current)
      return;
    const adjacent = allUsers.find((u) => {
      if (u._id === user._id) return false;
      if (u.isOnline) return false;
      const dx = Math.abs(u.x - px);
      const dy = Math.abs(u.y - py);
      return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
    });
    if (adjacent) triggerEncounter(adjacent);
  }

  function handleCellClick(occupant) {
    if (!user) return;
    if (occupant._id === user._id) return; // clicking yourself
    if (!occupant.isOnline && isLoaded && !isGenerating && !showDrama) {
      triggerEncounter(occupant);
    } else if (!occupant.isOnline && !isLoaded) {
      showToast("AI still loading — wait for it to finish!");
    } else if (occupant.isOnline) {
      showToast(`${occupant.username} is online — you can only fight OFFLINE avatars!`);
    }
  }

  function showToast(msg) {
    setFightFeedback(msg);
    setTimeout(() => setFightFeedback(""), 3000);
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
      const transcript = await generateTrashTalk(
        defenderPrompt,
        attackerContext
      );
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

    setTimeout(() => {
      encounterCooldownRef.current = false;
    }, 5000);
  }

  // ══════════════════════════════════════════════════════════════════
  //  KEYBOARD
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;
    function handleKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
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
  //  AWAY / ONLINE TOGGLE
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
  //  RENDER: LOADING STATES
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

  if (user && subChecked && !subStatus?.isActive)
    return <Paywall userId={user._id} />;

  if (user && !subChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (user && isLoading) return <LoadingScreen progress={initProgress} />;

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: AUTH SCREEN
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

        {/* Tab switcher */}
        <div className="flex mb-4 bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
          <button
            onClick={() => { setAuthTab("login"); setAuthError(""); }}
            className={`px-6 py-2 text-xs transition-colors ${
              authTab === "login" ? "bg-pink-700 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            SIGN IN
          </button>
          <button
            onClick={() => { setAuthTab("signup"); setAuthError(""); }}
            className={`px-6 py-2 text-xs transition-colors ${
              authTab === "signup" ? "bg-pink-700 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            SIGN UP
          </button>
        </div>

        <form
          onSubmit={handleAuth}
          className="bg-gray-900/80 border border-pink-800/40 rounded-lg p-6 w-full max-w-sm space-y-4"
        >
          <div>
            <label className="block text-[9px] text-gray-400 mb-1">USERNAME</label>
            <input
              type="text"
              maxLength={24}
              value={authForm.username}
              onChange={(e) => setAuthForm((f) => ({ ...f, username: e.target.value }))}
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-cyan-400 text-xs focus:border-pink-500 focus:outline-none"
              placeholder="xX_FloorBoss_Xx"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[9px] text-gray-400 mb-1">PASSWORD</label>
            <input
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-cyan-400 text-xs focus:border-pink-500 focus:outline-none"
              placeholder={authTab === "signup" ? "Pick something memorable" : "Your password"}
            />
          </div>

          {authTab === "signup" && (
            <>
              <div>
                <label className="block text-[9px] text-gray-400 mb-1">YOUR FLOOR (1-7)</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((f) => (
                    <button
                      type="button"
                      key={f}
                      onClick={() => setAuthForm((prev) => ({ ...prev, floor: f }))}
                      className={`flex-1 py-2 rounded text-xs transition-colors ${
                        authForm.floor === f ? "bg-pink-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-gray-400 mb-2">CREATE YOUR FIGHTER</label>
                <AvatarCreator value={authForm.avatar} onChange={(av) => setAuthForm((f) => ({ ...f, avatar: av }))} />
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
              authBusy ? "bg-gray-700 text-gray-400 cursor-wait" : "bg-pink-600 hover:bg-pink-500 text-white"
            }`}
          >
            {authBusy ? "LOADING..." : authTab === "signup" ? "CREATE ACCOUNT & ENTER" : "SIGN IN"}
          </button>

          <p className="text-[8px] text-gray-600 text-center">
            {authTab === "login"
              ? "Don't have an account? Click SIGN UP above."
              : "Already have an account? Click SIGN IN above."}
          </p>
        </form>

        <div className="mt-6 bg-gray-900/40 border border-gray-800 rounded-lg p-4 w-full max-w-sm">
          <p className="text-cyan-400 text-[9px] font-bold mb-3">HOW IT WORKS</p>
          <div className="space-y-2 text-[9px] text-gray-400">
            <p><span className="text-pink-400 mr-1">1.</span>Sign up with a username, password, and custom pixel avatar.</p>
            <p><span className="text-pink-400 mr-1">2.</span>Move around the grid with arrow keys / WASD / D-pad.</p>
            <p><span className="text-pink-400 mr-1">3.</span>Click any sleeping (offline) avatar to start an AI trash talk fight.</p>
            <p><span className="text-pink-400 mr-1">4.</span>Set a personality & go offline — your AI avatar roams and fights for you.</p>
            <p><span className="text-pink-400 mr-1">5.</span>Come back to see what your AI said in the Drama Feed.</p>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: MAIN GAME
  // ══════════════════════════════════════════════════════════════════
  const otherUsers = allUsers.filter((u) => u._id !== user._id);
  const offlineTargets = otherUsers.filter((u) => !u.isOnline);
  const onlineOthers = otherUsers.filter((u) => u.isOnline);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      {/* ── Header ── */}
      <header className="flex items-center justify-between p-2 px-3 border-b border-pink-900/40 bg-gray-950/90">
        <div className="flex items-center gap-2">
          <h1 className="text-pink-500 text-[10px] tracking-widest">IDLE FIGHT CLUB</h1>
        </div>
        <div className="flex items-center gap-2">
          <PixelAvatar avatar={user.avatar} size={18} />
          <span className="text-[9px] text-cyan-400">{user.username}</span>
          <span className="text-[8px] text-gray-500">F{user.floor}</span>
          <span className="text-[8px] text-gray-600">W:{user.wins || 0} L:{user.losses || 0}</span>
          {isLoaded && <span className="text-[7px] text-green-400 bg-green-950/40 px-1 rounded">AI OK</span>}
          {llmError && <span className="text-[7px] text-red-400 bg-red-950/40 px-1 rounded">AI ERR</span>}
          <button onClick={() => setShowTutorial(true)} className="text-[8px] text-gray-500 hover:text-cyan-400 bg-gray-800 rounded px-1 py-0.5">?</button>
          <button onClick={handleLogout} className="text-[8px] text-gray-500 hover:text-red-400 bg-gray-800 rounded px-1 py-0.5">EXIT</button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-800">
        {[
          { id: "grid", label: "THE GRID" },
          { id: "feed", label: `DRAMA (${dramaLogs.length})` },
          { id: "my-drama", label: "MY BEEF" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[9px] transition-colors ${
              tab === t.id ? "text-pink-400 border-b-2 border-pink-500" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Toast feedback ── */}
      {fightFeedback && (
        <div className="bg-yellow-900/60 border-b border-yellow-600/40 py-1.5 px-3 text-center">
          <p className="text-yellow-300 text-[9px]">{fightFeedback}</p>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {/* ────── GRID TAB ────── */}
        {tab === "grid" && (
          <div className="p-3 space-y-3">
            {/* Status banners */}
            {!user.isOnline && (
              <div className="bg-purple-950/40 border border-purple-600/40 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PixelAvatar avatar={user.avatar} size={24} isOnline={false} />
                  <p className="text-purple-300 text-[10px]">
                    You're <strong>OFFLINE</strong> — your AI is roaming & fighting.
                  </p>
                </div>
                <button
                  onClick={toggleOnline}
                  className="text-[9px] bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-white"
                >
                  GO ONLINE
                </button>
              </div>
            )}

            {/* Grid + sidebar layout */}
            <div className="flex flex-col lg:flex-row gap-3 items-start">
              {/* Left: Grid */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <Grid
                  users={allUsers}
                  currentUserId={user._id}
                  encounterTargetId={encounterTarget?._id}
                  onCellClick={handleCellClick}
                />
                {/* Move hint */}
                {user.isOnline && (
                  <p className="text-[8px] text-gray-500 text-center">
                    <span className="text-cyan-400">Arrow keys / WASD</span> to move
                    {" — "}
                    <span className="text-pink-400">click a sleeping avatar</span> to fight
                  </p>
                )}
                {/* Mobile D-pad */}
                {user.isOnline && (
                  <div className="grid grid-cols-3 gap-1 w-28 md:hidden">
                    <div />
                    <button onClick={() => moveUser(0, -1)} className="bg-gray-800 rounded p-2 text-center text-xs active:bg-pink-800">▲</button>
                    <div />
                    <button onClick={() => moveUser(-1, 0)} className="bg-gray-800 rounded p-2 text-center text-xs active:bg-pink-800">◄</button>
                    <div className="bg-gray-900 rounded flex items-center justify-center">
                      <PixelAvatar avatar={user.avatar} size={16} />
                    </div>
                    <button onClick={() => moveUser(1, 0)} className="bg-gray-800 rounded p-2 text-center text-xs active:bg-pink-800">►</button>
                    <div />
                    <button onClick={() => moveUser(0, 1)} className="bg-gray-800 rounded p-2 text-center text-xs active:bg-pink-800">▼</button>
                    <div />
                  </div>
                )}
              </div>

              {/* Right: Players Panel */}
              <div className="w-full lg:w-64 space-y-3">
                {/* YOUR STATUS */}
                <div className="bg-gray-900 border border-cyan-800/40 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <PixelAvatar avatar={user.avatar} size={32} glow="#00e5ff" />
                    <div>
                      <p className="text-cyan-400 text-[10px] font-bold">{user.username}</p>
                      <p className="text-gray-500 text-[8px]">Floor {user.floor} — Position ({user.x}, {user.y})</p>
                      <p className={`text-[8px] ${user.isOnline ? "text-green-400" : "text-purple-400"}`}>
                        {user.isOnline ? "ONLINE (you're playing)" : "OFFLINE (AI is playing)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {user.isOnline ? (
                      <button
                        onClick={toggleOnline}
                        className="flex-1 text-[8px] px-2 py-1.5 rounded bg-purple-800 hover:bg-purple-700 text-purple-200 transition-colors"
                      >
                        GO OFFLINE (let AI play)
                      </button>
                    ) : (
                      <button
                        onClick={toggleOnline}
                        className="flex-1 text-[8px] px-2 py-1.5 rounded bg-green-800 hover:bg-green-700 text-green-200 transition-colors"
                      >
                        GO ONLINE
                      </button>
                    )}
                    <button
                      onClick={() => setShowSettings((s) => !s)}
                      className="text-[8px] px-2 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-cyan-400 transition-colors"
                    >
                      {showSettings ? "CLOSE" : "PERSONALITY"}
                    </button>
                  </div>
                </div>

                {/* PERSONALITY EDITOR */}
                {showSettings && (
                  <div className="bg-gray-900 border border-cyan-800/40 rounded-lg p-3 space-y-2">
                    <p className="text-cyan-400 text-[8px] font-bold">AI PERSONALITY</p>
                    <p className="text-[7px] text-gray-500">When you go offline, this is who your avatar becomes.</p>
                    <textarea
                      value={awayPrompt}
                      onChange={(e) => setAwayPrompt(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-cyan-300 text-[9px] focus:border-cyan-500 focus:outline-none resize-none"
                      placeholder="I'm a Floor 3 night owl who blasts music at 2am..."
                    />
                    <button
                      onClick={saveAwayPrompt}
                      className="w-full text-[8px] py-1 bg-cyan-700 hover:bg-cyan-600 rounded transition-colors"
                    >
                      SAVE
                    </button>
                  </div>
                )}

                {/* TARGETS: offline users you can fight */}
                <div className="bg-gray-900 border border-pink-800/30 rounded-lg p-3">
                  <p className="text-pink-400 text-[8px] font-bold mb-2">
                    TARGETS — OFFLINE AVATARS ({offlineTargets.length})
                  </p>
                  {offlineTargets.length === 0 ? (
                    <p className="text-gray-600 text-[8px]">No one is offline right now. Check back later!</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {offlineTargets.map((t) => (
                        <div
                          key={t._id}
                          className="flex items-center justify-between bg-gray-950/60 rounded px-2 py-1.5 border border-gray-800 hover:border-pink-600/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <PixelAvatar avatar={t.avatar} size={22} isOnline={false} />
                            <div>
                              <p className="text-gray-300 text-[8px]">{t.username}</p>
                              <p className="text-gray-600 text-[7px]">F{t.floor} W:{t.wins || 0} L:{t.losses || 0}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (!isLoaded) {
                                showToast("AI still loading...");
                                return;
                              }
                              if (isGenerating || showDrama) {
                                showToast("Already in a fight!");
                                return;
                              }
                              triggerEncounter(t);
                            }}
                            disabled={!isLoaded || isGenerating || showDrama}
                            className={`text-[7px] px-2 py-1 rounded font-bold transition-colors ${
                              isLoaded && !isGenerating && !showDrama
                                ? "bg-red-700 hover:bg-red-600 text-white cursor-pointer"
                                : "bg-gray-800 text-gray-600 cursor-not-allowed"
                            }`}
                          >
                            FIGHT
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ONLINE users */}
                {onlineOthers.length > 0 && (
                  <div className="bg-gray-900 border border-green-800/30 rounded-lg p-3">
                    <p className="text-green-400 text-[8px] font-bold mb-2">
                      ONLINE ({onlineOthers.length})
                    </p>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {onlineOthers.map((u) => (
                        <div key={u._id} className="flex items-center gap-2 py-0.5">
                          <PixelAvatar avatar={u.avatar} size={18} />
                          <p className="text-gray-400 text-[8px]">{u.username}</p>
                          <p className="text-gray-600 text-[7px]">F{u.floor}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ────── DRAMA FEED TAB ────── */}
        {tab === "feed" && (
          <div className="max-w-lg mx-auto p-4">
            <h2 className="text-pink-400 text-xs mb-3">LATEST DRAMA</h2>
            {dramaLogs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-[10px]">No drama yet.</p>
                <p className="text-gray-600 text-[9px] mt-1">Go fight an offline avatar!</p>
              </div>
            ) : (
              <DramaFeed logs={dramaLogs} currentUserId={user._id} />
            )}
          </div>
        )}

        {/* ────── MY BEEF TAB ────── */}
        {tab === "my-drama" && (
          <div className="max-w-lg mx-auto p-4">
            <h2 className="text-pink-400 text-xs mb-3">YOUR BEEF HISTORY</h2>
            {dramaLogs.filter((l) => l.attackerId === user._id || l.defenderId === user._id).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-[10px]">No beef involving you yet.</p>
                <p className="text-gray-600 text-[9px] mt-1">Go pick a fight!</p>
              </div>
            ) : (
              <DramaFeed
                logs={dramaLogs.filter((l) => l.attackerId === user._id || l.defenderId === user._id)}
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
            <h2 className="text-red-500 text-sm text-center tracking-widest">ENCOUNTER!</h2>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <PixelAvatar avatar={user.avatar} size={56} glow="#00BCD4" />
                <p className="text-cyan-400 text-[10px] mt-1 font-bold">{user.username}</p>
              </div>
              <span className="text-red-500 text-xl font-bold">VS</span>
              <div className="text-center">
                <PixelAvatar avatar={encounterTarget?.avatar} size={56} isOnline={false} glow="#F44336" />
                <p className="text-red-400 text-[10px] mt-1 font-bold">{encounterTarget?.username}</p>
              </div>
            </div>
            {isGenerating ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-yellow-400 text-[10px]">AI generating insults...</p>
                <p className="text-gray-600 text-[8px] mt-1">(running locally in your browser)</p>
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
                onClick={() => { setShowDrama(false); setEncounterTarget(null); setCurrentDrama(""); }}
                className="w-full bg-red-700 hover:bg-red-600 py-2 rounded text-[10px] transition-colors"
              >
                WALK AWAY
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
            <h2 className="text-cyan-400 text-sm text-center tracking-widest">HOW TO PLAY</h2>
            <div className="space-y-3 text-[10px] leading-relaxed">
              <div className="flex gap-3 items-center">
                <PixelAvatar avatar={user.avatar} size={36} glow="#00e5ff" />
                <div>
                  <p className="text-cyan-400 font-bold">THIS IS YOU</p>
                  <p className="text-gray-400">Cyan-glowing avatar labeled "YOU" on the grid. Move with arrow keys or WASD.</p>
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <div className="w-9 h-9 bg-purple-900/40 border border-purple-500/40 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-400 text-[8px] font-bold">ZZ</span>
                </div>
                <div>
                  <p className="text-purple-400 font-bold">OFFLINE = TARGETS</p>
                  <p className="text-gray-400">Faded avatars with a purple ZZ badge. Click one on the grid OR use the FIGHT button in the panel.</p>
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <div className="w-9 h-9 bg-red-900/40 border border-red-500/40 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-red-400 text-xs">AI</span>
                </div>
                <div>
                  <p className="text-red-400 font-bold">FIGHTS</p>
                  <p className="text-gray-400">An AI running in your browser generates trash talk using the target's personality. Results go in the Drama Feed.</p>
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <div className="w-9 h-9 bg-pink-900/40 border border-pink-500/40 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-pink-400 text-[8px]">OFF</span>
                </div>
                <div>
                  <p className="text-pink-400 font-bold">GO OFFLINE</p>
                  <p className="text-gray-400">Set your personality prompt, go offline. Others fight your AI. Come back to check what happened!</p>
                </div>
              </div>
            </div>
            <button onClick={() => setShowTutorial(false)} className="w-full bg-cyan-700 hover:bg-cyan-600 py-2 rounded text-[10px] transition-colors">
              GOT IT — LET'S FIGHT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
