import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { saveLists, type MemberLists } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const emptyLists: MemberLists = {
  podcastAlerts: true,
  showLetter: false,
  merchLetter: false,
};

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lists, setLists] = useState<MemberLists>(emptyLists);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      if (mode === "up") {
        const { error: signUpError } = await authClient.signUp.email({
          name: name.trim() || "Listener",
          email: email.trim(),
          password,
        });
        if (signUpError) throw new Error(friendly(signUpError.message));
        await saveLists({ data: lists });
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (signInError) throw new Error(friendly(signInError.message));
      }
      await navigate({ to: "/account" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t go through.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <p className="caption-box">The booth</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">
        {mode === "up" ? "Create an account" : "Sign in"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Listeners pick podcast alerts, the newsletter, and merch drops. New accounts
        are listeners. The shop isn’t open yet.
      </p>
      <div className="mt-6 flex gap-2">
        <Button type="button" size="sm" variant={mode === "up" ? "primary" : "ghost"} onClick={() => setMode("up")}>
          Sign up
        </Button>
        <Button type="button" size="sm" variant={mode === "in" ? "primary" : "ghost"} onClick={() => setMode("in")}>
          Sign in
        </Button>
      </div>
      <form onSubmit={submit} className="panel mt-6 space-y-4 p-5 sm:p-6">
        {mode === "up" ? (
          <label className="block space-y-2">
            <span className="font-display text-lg tracking-wide">Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </label>
        ) : null}
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
        <label className="block space-y-2">
          <span className="font-display text-lg tracking-wide">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            required
            minLength={8}
          />
        </label>
        {mode === "in" ? (
          <p className="text-sm">
            <Link
              to="/reset-password"
              search={{ token: "", error: "" }}
              className="text-crimson hover:underline"
            >
              Forgot password?
            </Link>
          </p>
        ) : null}
        {mode === "up" ? (
          <fieldset className="space-y-3">
            <legend className="font-display text-lg tracking-wide">Lists</legend>
            <ListToggle
              checked={lists.podcastAlerts}
              onChange={(podcastAlerts) => setLists({ ...lists, podcastAlerts })}
              title="Podcast alerts"
              detail="A morning note on a scheduled show day, and another when the episode is posted."
            />
            <ListToggle
              checked={lists.showLetter}
              onChange={(showLetter) => setLists({ ...lists, showLetter })}
              title="Newsletter"
              detail="Show news, comics, and what John and Dan are reading."
            />
            <ListToggle
              checked={lists.merchLetter}
              onChange={(merchLetter) => setLists({ ...lists, merchLetter })}
              title="Merch drops"
              detail="First in line when the shop opens."
            />
          </fieldset>
        ) : null}
        {error ? <p className="text-sm text-crimson">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Hold on" : mode === "up" ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        <Link to="/podcast" className="text-crimson hover:underline">
          Back to the episodes
        </Link>
      </p>
    </div>
  );
}

function ListToggle({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex items-start gap-3 border-4 border-ink bg-paper px-3 py-3">
      <input
        type="checkbox"
        className="mt-1 size-5 accent-[#9b1b30]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-display text-xl tracking-wide">{title}</span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
    </label>
  );
}

function friendly(message: string | undefined) {
  const text = message ?? "That didn’t go through.";
  if (/already|exist/i.test(text)) return "That email already has an account. Sign in.";
  if (/invalid|credential|password/i.test(text)) return "Email or password didn’t match.";
  return text;
}
