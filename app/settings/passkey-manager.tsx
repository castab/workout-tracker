"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PasskeyManager() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddPasskey() {
    setPending(true);
    setError(null);

    try {
      const optionsResponse = await fetch("/api/passkeys/register/options", {
        method: "POST",
      });

      if (!optionsResponse.ok) {
        throw new Error("options_failed");
      }

      const { options } = await optionsResponse.json();
      const registrationResponse = await startRegistration({ optionsJSON: options });

      const verifyResponse = await fetch("/api/passkeys/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: registrationResponse, nickname }),
      });

      if (!verifyResponse.ok) {
        throw new Error("verify_failed");
      }

      setNickname("");
      router.refresh();
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : "";

      if (name === "NotAllowedError") {
        setError("Passkey setup was cancelled.");
      } else {
        setError("Could not add passkey. Try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="font-black">Add passkey</h3>

      {error ? (
        <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <input
          className="h-12 min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-base text-zinc-50 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
          type="text"
          placeholder="Nickname (optional)"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
        <button
          type="button"
          onClick={handleAddPasskey}
          disabled={pending}
          className="h-12 shrink-0 rounded-2xl bg-lime-300 px-4 text-sm font-black text-zinc-950 transition hover:bg-lime-200 disabled:opacity-60"
        >
          {pending ? "Waiting…" : "Add passkey"}
        </button>
      </div>
    </div>
  );
}
