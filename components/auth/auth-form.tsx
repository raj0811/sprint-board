"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) setError(result.error ?? "Unable to continue. Please try again.");
      else router.replace("/");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10 relative">
    <ThemeToggle className="absolute right-4 top-4" />
    <section className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-6 shadow-[0_12px_40px_#28243d0a] sm:p-9">
      <div className="mb-8 flex items-center gap-2.5 text-[21px] font-bold tracking-[-.8px]"><span className="grid size-8 place-items-center rounded-[10px] bg-brand-500 text-white"><Icon name="spark" size={19} /></span>orbit</div>
      <p className="mb-2 text-[10px] font-bold tracking-[1.1px] text-brand-500">YOUR WORKSPACE</p>
      <h1 className="m-0 text-[25px] font-bold tracking-[-.7px] text-ink">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="mb-7 mt-2 text-sm text-muted">{mode === "login" ? "Sign in to continue to your projects." : "Create an account to access your workspace."}</p>
      <form onSubmit={submit} className="grid gap-4">
        {mode === "register" && <div><label htmlFor="name" className="mb-1.5 block text-xs font-semibold text-ink-soft">Name</label><input id="name" name="name" autoComplete="name" required className="h-12 w-full rounded-xl border border-line px-3 text-base outline-none sm:h-11 sm:text-sm focus:border-brand-200 focus:ring-2 focus:ring-brand-100" placeholder="Your name" /></div>}
        <div><label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-ink-soft">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="h-12 w-full rounded-xl border border-line px-3 text-base outline-none sm:h-11 sm:text-sm focus:border-brand-200 focus:ring-2 focus:ring-brand-100" placeholder="you@company.com" /></div>
        <div><label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-ink-soft">Password</label><div className="relative"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} required className="h-12 w-full rounded-xl border border-line pl-3 pr-12 text-base outline-none sm:h-11 sm:text-sm focus:border-brand-200 focus:ring-2 focus:ring-brand-100" placeholder={mode === "register" ? "At least 8 characters" : "Your password"} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"><Icon name={showPassword ? "eyeOff" : "eye"} size={18} /></button></div></div>
        {error && <p role="alert" className="m-0 rounded-lg bg-danger-soft px-3 py-2.5 text-xs text-danger-ink">{error}</p>}
        <button disabled={busy} className="mt-1 flex h-12 items-center justify-center rounded-xl bg-brand-500 sm:h-11 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="mb-0 mt-6 text-center text-xs text-muted">{mode === "login" ? "New to Orbit?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="font-semibold text-brand-600 hover:underline">{mode === "login" ? "Create an account" : "Sign in"}</button></p>
    </section>
  </main>;
}
