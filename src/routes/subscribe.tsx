import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlist } from "@/lib/waitlist";

const KEY = "spacebat-waitlist";

export const Route = createFileRoute("/subscribe")({ component: SubscribePage });

function SubscribePage() {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      setSaved(localStorage.getItem(KEY));
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value || !value.includes("@")) return;
    setError(null);
    setPending(true);
    try {
      await joinWaitlist({ data: { email: value } });
      try {
        localStorage.setItem(KEY, value);
      } catch {
        /* ignore */
      }
      setSaved(value);
      setEmail("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send that signup. Try again in a moment.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <span className="caption-box">The list</span>
      <h1 className="mt-4 font-display text-5xl tracking-wide">Hold on with us.</h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
        Comics, movies, tech, politics, markets — from the booth. Named for a
        bat that held on. Leave an email and we’ll ping you when the first
        episode lands.
      </p>

      {saved ? (
        <p className="panel mt-8 bg-caption px-5 py-4 text-sm text-ink">
          You’re on the list as{" "}
          <span className="font-display text-lg text-crimson">{saved}</span>.
          We’ll use it when the next episode drops.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sm:flex-1"
          />
          <Button type="submit" size="lg" className="sm:w-44" disabled={pending}>
            {pending ? "Sending…" : "Notify me"}
          </Button>
        </form>
      )}
      {error ? (
        <p className="mt-4 text-sm text-crimson" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
