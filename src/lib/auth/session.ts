import "server-only";

import { cookies } from "next/headers";
import { store } from "@/lib/data";
import { DEMO_UID_COOKIE, isSupabaseConfigured } from "./config";
import { getSupabaseServerClient } from "./supabase-server";

export interface SessionUser {
  id: string;
  /** True until an email or OAuth identity is linked. */
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
}

/**
 * Reads the current visitor, if there is one.
 *
 * Returns null for a brand-new visitor who hasn't tapped anything yet. This is
 * the normal case on a shared link: public pages render fully without an
 * identity, and one is only minted at the first pledge intent.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseServerClient();
    if (!supabase) return null;

    // getUser() revalidates the JWT with Supabase rather than trusting the
    // cookie, which is the difference between a session check and a guess.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    return {
      id: data.user.id,
      isAnonymous: data.user.is_anonymous ?? false,
      email: data.user.email ?? null,
      displayName:
        (data.user.user_metadata?.full_name as string | undefined) ??
        (data.user.user_metadata?.name as string | undefined) ??
        null,
    };
  }

  const cookieStore = await cookies();
  const demoUid = cookieStore.get(DEMO_UID_COOKIE)?.value;
  if (!demoUid) return null;

  return { id: demoUid, isAnonymous: true, email: null, displayName: null };
}

/**
 * Returns the current visitor, minting a demo identity if none exists.
 *
 * Only callable from a route handler or server action, since it may set a
 * cookie. In Supabase mode the browser has already called signInAnonymously()
 * before reaching here, so this just reads the resulting session.
 */
export async function getOrCreateSessionUser(): Promise<SessionUser | null> {
  const existing = await getSessionUser();
  if (existing) {
    await store.ensureUser(existing.id, {
      isAnonymous: existing.isAnonymous,
      email: existing.email,
      displayName: existing.displayName,
    });
    return existing;
  }

  // In Supabase mode we never mint identities server-side: anonymous sign-in
  // must go through the browser client so the captcha token can be attached
  // and the session cookies are written correctly.
  if (isSupabaseConfigured) return null;

  const cookieStore = await cookies();
  const id = crypto.randomUUID();

  cookieStore.set(DEMO_UID_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  await store.ensureUser(id, { isAnonymous: true });

  return { id, isAnonymous: true, email: null, displayName: null };
}
