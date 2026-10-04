import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { loadAnalytics, updateMember, type MemberLists } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  loader: () => loadAnalytics(),
  component: AdminPage,
});

function AdminPage() {
  const stats = Route.useLoaderData();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  if (!stats) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <h1 className="font-display text-5xl tracking-wide">Crew only</h1>
        <p className="mt-3 text-sm text-muted">
          Sign in as spacebatshow@gmail.com to open the back end.
        </p>
        <Link to="/login" className="mt-6 inline-block font-display text-xl text-crimson hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  async function run(id: string, work: () => Promise<unknown>) {
    setError("");
    setBusy(id);
    try {
      await work();
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t save.");
    } finally {
      setBusy("");
    }
  }

  const cards = [
    ["Accounts", stats.members],
    ["Podcast alerts", stats.podcastAlerts],
    ["Newsletter", stats.showLetter],
    ["Merch drops", stats.merchLetter],
    ["Joined, 7 days", stats.joinedWeek],
    ["Visits, 7 days", stats.visitsWeek],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="caption-box">Back end</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">Analytics</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        New accounts are listeners. They choose podcast alerts, the newsletter, and merch
        drops. spacebatshow@gmail.com stays the admin.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
            <p className="mt-2 font-display text-5xl leading-none">{value}</p>
          </div>
        ))}
      </div>
      <section className="mt-10">
        <h2 className="font-display text-3xl tracking-wide">Pages</h2>
        {stats.pages.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No visits recorded this week.</p>
        ) : (
          <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
            {stats.pages.map((page) => (
              <li key={page.path} className="flex items-center justify-between gap-4 py-3">
                <span className="font-display text-xl tracking-wide">{page.path}</span>
                <span className="text-sm text-muted">{page.visits}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-10">
        <h2 className="font-display text-3xl tracking-wide">Accounts</h2>
        {error ? <p className="mt-3 text-sm text-crimson">{error}</p> : null}
        <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
          {stats.people.map((person) => (
            <li key={person.userId} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-xl tracking-wide">{person.name || person.email}</span>
                <span className="text-xs uppercase tracking-[0.12em] text-muted">
                  {person.role === "admin" ? "Admin" : "Listener"} · {person.joined}
                </span>
              </div>
              <p className="text-sm text-muted">{person.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ListChip
                  label="Alerts"
                  checked={person.podcastAlerts}
                  disabled={busy === person.userId}
                  onChange={(podcastAlerts) =>
                    run(person.userId, () =>
                      updateMember({
                        data: { userId: person.userId, lists: listsOf(person, { podcastAlerts }) },
                      }),
                    )
                  }
                />
                <ListChip
                  label="Newsletter"
                  checked={person.showLetter}
                  disabled={busy === person.userId}
                  onChange={(showLetter) =>
                    run(person.userId, () =>
                      updateMember({
                        data: { userId: person.userId, lists: listsOf(person, { showLetter }) },
                      }),
                    )
                  }
                />
                <ListChip
                  label="Merch"
                  checked={person.merchLetter}
                  disabled={busy === person.userId}
                  onChange={(merchLetter) =>
                    run(person.userId, () =>
                      updateMember({
                        data: { userId: person.userId, lists: listsOf(person, { merchLetter }) },
                      }),
                    )
                  }
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {person.locked ? (
                  <span className="text-sm text-ink">Show admin. This one stays.</span>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy === person.userId}
                      onClick={() =>
                        run(person.userId, () =>
                          updateMember({
                            data: {
                              userId: person.userId,
                              role: person.role === "admin" ? "listener" : "admin",
                            },
                          }),
                        )
                      }
                    >
                      {person.role === "admin" ? "Make listener" : "Make admin"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy === person.userId}
                      onClick={() =>
                        run(person.userId, () =>
                          updateMember({ data: { userId: person.userId, remove: true } }),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function listsOf(
  person: { podcastAlerts: boolean; showLetter: boolean; merchLetter: boolean },
  patch: Partial<MemberLists>,
): MemberLists {
  return {
    podcastAlerts: person.podcastAlerts,
    showLetter: person.showLetter,
    merchLetter: person.merchLetter,
    ...patch,
  };
}

function ListChip({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 border-4 border-ink bg-paper px-3 py-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-[#9b1b30]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
