"use client";

import { useCallback, useRef } from "react";
import { isSupabaseConfigured } from "./config";
import { getSupabaseBrowserClient } from "./supabase-browser";

/**
 * Lazily establishes an identity at the moment it's first needed.
 *
 * Nothing happens on page load. The first time a visitor taps "Contribute",
 * this signs them in anonymously so their pledge has somewhere to attach. They
 * are never shown a signup form, never asked for an email, and never blocked.
 *
 * In demo mode this is a no-op: the server mints an identity cookie when the
 * pledge request arrives.
 */
export function useIdentity() {
  // De-duplicates concurrent calls, so double-tapping the contribute button
  // can't race two anonymous sign-ins into existence.
  const inFlight = useRef<Promise<boolean> | null>(null);

  const ensureIdentity = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) return true;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return true;

    if (inFlight.current) return inFlight.current;

    inFlight.current = (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) return true;

        const captchaToken = await requestCaptchaToken();
        const { error } = await supabase.auth.signInAnonymously(
          captchaToken ? { options: { captchaToken } } : undefined,
        );

        return !error;
      } finally {
        inFlight.current = null;
      }
    })();

    return inFlight.current;
  }, []);

  return { ensureIdentity };
}

/**
 * Resolves a Turnstile token invisibly.
 *
 * Uses the managed widget in its invisible mode so the common case shows the
 * user nothing at all; Cloudflare only renders an interactive challenge for
 * traffic it finds suspicious.
 */
async function requestCaptchaToken(): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey || typeof window === "undefined") return null;

  try {
    await loadTurnstileScript();
    const turnstile = (window as unknown as { turnstile?: TurnstileApi })
      .turnstile;
    if (!turnstile) return null;

    return await new Promise<string | null>((resolve) => {
      const host = document.createElement("div");
      host.style.display = "none";
      document.body.appendChild(host);

      const cleanup = () => host.remove();
      const timeout = window.setTimeout(() => {
        cleanup();
        resolve(null);
      }, 8000);

      turnstile.render(host, {
        sitekey: siteKey,
        size: "invisible",
        callback: (token: string) => {
          window.clearTimeout(timeout);
          cleanup();
          resolve(token);
        },
        "error-callback": () => {
          window.clearTimeout(timeout);
          cleanup();
          resolve(null);
        },
      });
    });
  } catch {
    return null;
  }
}

interface TurnstileApi {
  render(
    el: HTMLElement,
    options: {
      sitekey: string;
      size?: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
    },
  ): string;
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-turnstile]",
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile-script-failed"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}
