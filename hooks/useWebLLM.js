"use client";

import { useState, useRef, useCallback } from "react";

// ─── Config ──────────────────────────────────────────────────────────
const MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

// ─── The System Prompt (the soul of the game) ────────────────────────
function buildSystemPrompt(defenderAwayPrompt, attackerContext) {
  return `You are playing a character in a highly aggressive, comedic video game set in a chaotic apartment complex. Your character is: "${defenderAwayPrompt}". Another player, ${attackerContext}, has just walked up to you. You are deeply offended by their presence. Generate a short, brutal, and petty insult directed at them. Do not be polite. Do not hold back. Swearing and extreme sarcasm are required. Keep it under 150 words. Be creative, absurd, and ruthlessly funny.`;
}

export default function useWebLLM() {
  const engineRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [initProgress, setInitProgress] = useState({
    text: "",
    progress: 0,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  // ── Initialize the engine (downloads model to browser cache) ──────
  const initEngine = useCallback(async () => {
    if (engineRef.current || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Dynamic import so this never touches the server bundle
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      const engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          setInitProgress({
            text: report.text,
            progress: report.progress,
          });
        },
      });

      engineRef.current = engine;
      setIsLoaded(true);
    } catch (err) {
      console.error("WebLLM init failed:", err);
      setError(
        err.message.includes("WebGPU")
          ? "Your browser doesn't support WebGPU. Try Chrome 113+ or Edge 113+."
          : `AI engine failed to load: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // ── Generate trash talk ───────────────────────────────────────────
  const generateTrashTalk = useCallback(
    async (defenderAwayPrompt, attackerContext) => {
      if (!engineRef.current) {
        throw new Error("Engine not initialized. Call initEngine() first.");
      }

      setIsGenerating(true);
      setError(null);

      try {
        const systemPrompt = buildSystemPrompt(
          defenderAwayPrompt,
          attackerContext
        );

        const reply = await engineRef.current.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content:
                "Generate the trash talk now. Be unhinged. Make it personal.",
            },
          ],
          temperature: 1.1,
          max_tokens: 256,
          top_p: 0.95,
        });

        const text =
          reply.choices?.[0]?.message?.content?.trim() ||
          "*glares menacingly but says nothing*";
        return text;
      } catch (err) {
        console.error("Generation failed:", err);
        setError(`Generation failed: ${err.message}`);
        return "*mumbles incoherently and trips over own feet*";
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  return {
    initEngine,
    generateTrashTalk,
    isLoaded,
    isLoading,
    isGenerating,
    initProgress,
    error,
  };
}
