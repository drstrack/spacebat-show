import { createFileRoute, Link } from "@tanstack/react-router";
import { loadAnalytics } from "@/lib/account.functions";

export const Route = createFileRoute("/admin")({
  loader: () => loadAnalytics(),
  component: AdminPage,
});

function AdminPage() {
  const stats = Route.useLoaderData();

  if (!stats) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <h1 className="font-display text-5xl tracking-wide">Crew only</h1>
        <p className="mt-3 text-sm text-muted">
          Sign in with a crew account to see listeners and visits.
        </p>
        <Link to="/login" className="mt-6 inline-block font-display text-xl text-crimson hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  const cards = [
    ["Listeners", stats.members],
    ["Podcast alerts", stats.podcastAlerts],
    ["The letter", stats.showLetter],
    ["Merch list", stats.merchLetter],
    ["Joined, 7 days", stats.joinedWeek],
    ["Visits, 7 days", stats.visitsWeek],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="caption-box">Crew desk</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">Analytics</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Who signed up, which lists they’re on, and which pages got a visit. A visit
        counts once per browser session.
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
        <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
          {stats.people.map((person) => (
            <li key={person.email} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-xl tracking-wide">{person.name || person.email}</span>
                <span className="text-xs uppercase tracking-[0.12em] text-muted">
                  {person.role} · {person.joined}
                </span>
              </div>
              <p className="text-sm text-muted">{person.email}</p>
              <p className="mt-1 text-sm text-ink">
                {[
                  person.podcastAlerts ? "Alerts" : null,
                  person.showLetter ? "Letter" : null,
                  person.merchLetter ? "Merch" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No lists"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
