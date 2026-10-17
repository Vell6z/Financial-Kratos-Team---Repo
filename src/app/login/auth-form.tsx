"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Input, PasswordInput, api } from "@/components/ui";
import { HOME } from "@/lib/nav";
import type { AccountRole } from "@/lib/registration";
import { validateEmail } from "@/lib/validators";

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const emailError = submitted ? validateEmail(email) : null;
  const passwordError = submitted && !password ? "Ingresa tu contraseña" : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    if (validateEmail(email) || !password) return;
    setBusy(true);
    try {
      const user = await api<{ role: AccountRole }>("/api/auth/login", { email, password });
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : HOME[user.role]);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md self-center p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Bienvenido de nuevo</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Ingresa con tu correo y contraseña.</p>
      {next && !error && (
        <div className="mb-4">
          <Alert tone="info">Inicia sesión para continuar.</Alert>
        </div>
      )}
      <form onSubmit={submit} noValidate className="space-y-4">
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="nombre@correo.com"
          value={email}
          onChange={(e) => (setEmail(e.target.value), setError(""))}
          error={emailError}
          autoComplete="email"
          autoFocus
        />
        <PasswordInput
          label="Contraseña"
          value={password}
          onChange={(e) => (setPassword(e.target.value), setError(""))}
          error={passwordError}
          autoComplete="current-password"
        />
        {error && (
          <Alert tone="error" title="No pudimos iniciar sesión">
            {error}
          </Alert>
        )}
        <Button type="submit" loading={busy} className="w-full py-2.5">
          {busy ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-mint underline">
          Crear cuenta
        </Link>
      </p>
    </Card>
  );
}
