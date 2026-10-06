import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    error: typeof search.error === "string" ? search.error : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  if (error === "INVALID_TOKEN") return <Expired />;
  if (token) return <ChoosePassword token={token} />;
  return <RequestLink />;
}

function RequestLink() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: "/reset-password",
        }),
      });
      if (!response.ok) throw new Error("We couldn’t send that just yet.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t send that just yet.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <p className="caption-box">The booth</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">Forgot password</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        We’ll email a reset link if that address has an account. It expires in an hour.
      </p>
      {sent ? (
        <p className="panel mt-6 bg-paper p-5 text-sm leading-relaxed">
          If that email has an account, the reset link is on its way. Check the inbox,
          including spam.
        </p>
      ) : (
        <form onSubmit={submit} className="panel mt-6 space-y-4 p-5 sm:p-6">
          <label className="block space-y-2">
            <span className="font-display text-lg tracking-wide">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {error ? <p className="text-sm text-crimson">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Hold on" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted">
        <Link to="/login" className="text-crimson hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

function ChoosePassword({ token }: { token: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don’t match.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password, token }),
      });
      if (!response.ok) throw new Error("That link is no good. Ask for a new one.");
      await navigate({ to: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That link is no good. Ask for a new one.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <p className="caption-box">The booth</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">New password</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Choose a new password. You’ll sign in with it next.
      </p>
      <form onSubmit={submit} className="panel mt-6 space-y-4 p-5 sm:p-6">
        <label className="block space-y-2">
          <span className="font-display text-lg tracking-wide">New password</span>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>
        <label className="block space-y-2">
          <span className="font-display text-lg tracking-wide">Again</span>
          <Input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>
        {error ? <p className="text-sm text-crimson">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Hold on" : "Save password"}
        </Button>
      </form>
    </div>
  );
}

function Expired() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <p className="caption-box">The booth</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">Link expired</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        That reset link is used up or too old. Ask for another.
      </p>
      <p className="mt-6">
        <Button asChild>
          <Link to="/reset-password" search={{ token: "", error: "" }}>Forgot password</Link>
        </Button>
      </p>
    </div>
  );
}
