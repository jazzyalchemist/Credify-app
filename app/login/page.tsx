import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <AppShell
      eyebrow="Authentication"
      title="Your investigations stay private."
      subtitle="Credify separates public methodology from private evidence and investigation state."
    >
      <Suspense fallback={<div className="loginCard">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </AppShell>
  );
}
