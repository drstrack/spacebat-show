import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { signOut } from "@/lib/auth/client";
import { loadAccount, saveLists, type MemberLists } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/account")({
  loader: () => loadAccount(),
  component: AccountPage,
});

function AccountPage() {
  const account = Route.useLoaderData();
  const navigate = useNavigate();
  const [lists, setLists] = useState<MemberLists | null>(account?.lists ?? null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!account || !lists) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <h1 className="font-display text-5xl tracking-wide">Sign in first</h1>
        <p className="mt-3 text-sm text-muted">Accounts hold podcast alerts, the newsletter, and merch drops.</p>
        <Button asChild className="mt-6">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!lists) return;
    setPending(true);
    setError("");
    setSaved(false);
    try {
      await saveLists({ data: lists });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save that.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <p className="caption-box">{account.role === "admin" ? "Crew" : "Listener"}</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">{account.name}</h1>
      <p className="mt-2 text-sm text-muted">{account.email}</p>
      {!account.durable ? (
        <p className="mt-4 border-4 border-ink bg-caption px-4 py-3 text-sm text-ink">
          Accounts on this host aren’t being stored yet. A Postgres database still has to
          be connected before sign-ups stick.
        </p>
      ) : null}
      <form onSubmit={save} className="mt-8 space-y-3">
        <Toggle
          checked={lists.podcastAlerts}
          onChange={(podcastAlerts) => {
            setSaved(false);
            setLists({ ...lists, podcastAlerts });
          }}
          title="Podcast alerts"
          detail="A note when a new episode is posted."
        />
        <Toggle
          checked={lists.showLetter}
          onChange={(showLetter) => {
            setSaved(false);
            setLists({ ...lists, showLetter });
          }}
          title="Newsletter"
          detail="Show news, comics, and what John and Dan are reading."
        />
        <Toggle
          checked={lists.merchLetter}
          onChange={(merchLetter) => {
            setSaved(false);
            setLists({ ...lists, merchLetter });
          }}
          title="Merch drops"
          detail="The shop isn’t open. This list is first when it is."
        />
        {error ? <p className="text-sm text-crimson">{error}</p> : null}
        {saved ? <p className="text-sm text-ink">Saved.</p> : null}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save lists"}
          </Button>
          {account.role === "admin" ? (
            <Button asChild variant="secondary">
              <Link to="/admin">Back end</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void signOut("/").then(() => navigate({ to: "/" }));
            }}
          >
            Sign out
          </Button>
        </div>
      </form>
    </div>
  );
}

function Toggle({
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
    <label className="flex items-start gap-3 border-4 border-ink bg-surface px-4 py-4">
      <input
        type="checkbox"
        className="mt-1 size-5 accent-[#9b1b30]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-display text-2xl tracking-wide">{title}</span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
    </label>
  );
}
