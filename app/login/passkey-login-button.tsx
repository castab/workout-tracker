"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";

export function PasskeyLoginButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);

    try {
      const optionsResponse = await fetch("/api/passkeys/login/options", {
        method: "POST",
      });

      if (!optionsResponse.ok) {
        throw new Error("options_failed");
      }

      const { options } = await optionsResponse.json();
      const authenticationResponse = await startAuthentication({ optionsJSON: options });

      const verifyResponse = await fetch("/api/passkeys/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authenticationResponse }),
      });

      if (!verifyResponse.ok) {
        throw new Error("verify_failed");
      }

      window.location.href = "/";
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : "";

      if (name === "NotAllowedError") {
        setError("Passkey sign-in was cancelled.");
      } else {
        setError("Passkey sign-in failed. Try again or use your password.");
      }

      setPending(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">or</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="h-14 w-full rounded-2xl bg-zinc-50 px-5 text-base font-black text-zinc-950 transition hover:bg-white disabled:opacity-60"
      >
        {pending ? "Waiting for passkey…" : "Sign in with a passkey"}
      </button>
    </div>
  );
}
