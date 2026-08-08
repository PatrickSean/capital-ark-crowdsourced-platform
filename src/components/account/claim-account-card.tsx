"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";

/**
 * The account offer, shown only after a pledge is recorded.
 *
 * Deliberately positioned as a reward rather than a gate: the contribution has
 * already counted by the time this appears, and dismissing it costs the user
 * nothing. Linking an email keeps the same underlying user id, so their pledge
 * history carries over without any migration.
 */
export function ClaimAccountCard() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (state === "sent") {
    return (
      <div className="rounded-xl bg-brand-50 p-4 ring-1 ring-inset ring-brand-200">
        <p className="text-sm font-semibold text-brand-900">Check your email</p>
        <p className="mt-1 text-sm text-brand-800">
          We sent a link to {email}. Open it and your pledge history is saved to
          your account.
        </p>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("busy");
    setMessage(null);

    try {
      const res = await fetch("/api/account/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(payload?.error?.message ?? "We couldn't send that link.");
        return;
      }

      setState("sent");
    } catch {
      setState("error");
      setMessage("We couldn't reach the server. Your contribution is still recorded.");
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl bg-ink-50 p-4 ring-1 ring-inset ring-ink-200"
    >
      <p className="text-sm font-semibold text-ink-900">
        Want to keep track of your pledges?
      </p>
      <p className="mt-1 text-xs text-ink-600">
        Add your email and we&rsquo;ll save this one and any future ones. No
        password to create.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 flex-1"
          aria-label="Email address"
        />
        <Button type="submit" loading={state === "busy"} className="sm:w-auto">
          Save my pledges
        </Button>
      </div>

      {message && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-700">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-2 text-xs font-medium text-ink-500 underline underline-offset-2 hover:text-ink-700"
      >
        No thanks
      </button>
    </form>
  );
}
