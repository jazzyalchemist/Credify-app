"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to sign in.");
      setBusy(false);
      return;
    }

    router.replace(search.get("next") || "/investigations");
    router.refresh();
  }

  return (
    <form className="loginCard" onSubmit={submit}>
      <div>
        <p className="kicker">Private workspace</p>
        <h2>Enter your Credify access key</h2>
        <p>
          v0.1 uses a private, server-configured access key. The key is never
          stored in the browser; a signed HttpOnly session cookie is issued instead.
        </p>
      </div>
      <input
        type="password"
        autoComplete="current-password"
        value={accessKey}
        onChange={(event) => setAccessKey(event.target.value)}
        placeholder="Access key"
        aria-label="Credify access key"
      />
      {error ? <p className="formError">{error}</p> : null}
      <button className="primaryButton" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Open Credify"}
      </button>
    </form>
  );
}
