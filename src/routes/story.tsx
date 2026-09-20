import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { storyLegend, storyRecord } from "@/data/show";

export const Route = createFileRoute("/story")({ component: StoryPage });

function StoryPage() {
  return (
    <article>
      <header className="mx-auto max-w-6xl px-3 pt-6 sm:px-5">
        <div className="panel overflow-hidden md:grid md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.1fr)]">
          <img
            src="/images/issue-cover.webp"
            alt="Tongue-in-cheek SpaceBat mascot — a bat in a foam cape punching toward camera."
            className="aspect-[3/4] max-h-[52dvh] w-full object-cover object-top md:max-h-none md:aspect-auto md:h-full md:min-h-[32rem] md:border-r-4 md:border-ink"
          />
          <div className="flex flex-col justify-end bg-paper p-6 sm:p-10">
            <span className="caption-box w-fit">The name</span>
            <h1 className="mt-4 max-w-xl font-display text-5xl leading-none tracking-wide sm:text-6xl">
              We stole it from a bat.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              Pad 39A, March 15, 2009. A free-tailed bat on Discovery’s orange
              tank. NASA lost him after the tower. We took the name, drew him
              a cape, and went back to arguing about comics, movies, tech,
              politics, and markets.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="font-display text-3xl leading-snug tracking-wide text-ink">
          The real one first. Then the wink.
        </p>

        <div className="mt-10 flex items-center gap-3">
          <span className="caption-box">STS-119</span>
          <h2 className="font-display text-4xl tracking-wide">The record</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          What launched. What clung. What the cameras actually showed.
        </p>

        <div className="mt-8 grid gap-4">
          {storyRecord.map((beat, i) => (
            <section
              key={beat.title}
              className={`panel bg-paper p-5 sm:p-6 ${i % 2 ? "md:ml-8" : "md:mr-8"}`}
            >
              <p className="caption-box text-sm">{beat.kicker}</p>
              <h3 className="mt-3 font-display text-3xl tracking-wide">{beat.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-muted">{beat.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <figure className="panel overflow-hidden">
            <img
              src="/images/spacebat-closeup.webp"
              alt="Close NASA still of the bat on the orange foam."
              className="aspect-[4/3] w-full object-cover"
            />
            <figcaption className="border-t-4 border-ink bg-caption px-3 py-2 text-xs uppercase tracking-[0.12em]">
              NASA · On the foam
            </figcaption>
          </figure>
          <figure className="panel overflow-hidden">
            <img
              src="/images/bat-liftoff.webp"
              alt="The bat still clinging as Discovery lifts off."
              className="aspect-[4/3] w-full object-cover"
            />
            <figcaption className="border-t-4 border-ink bg-caption px-3 py-2 text-xs uppercase tracking-[0.12em]">
              NASA · Past the tower
            </figcaption>
          </figure>
        </div>

        <blockquote className="panel mt-10 bg-ink p-6 text-caption sm:p-10">
          <p className="font-display text-3xl leading-snug tracking-wide sm:text-4xl">
            NASA’s line: the animal likely perished quickly during the climb to
            orbit.
          </p>
          <footer className="mt-4 text-sm uppercase tracking-[0.12em] text-caption/70">
            After the tower · the cameras lost him
          </footer>
        </blockquote>

        <div className="mt-14 flex items-center gap-3">
          <span className="caption-box">The wink</span>
          <h2 className="font-display text-4xl tracking-wide">Not the show</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          We like to imagine he got powers. That’s mascot work. The podcast is
          the five beats.
        </p>

        <div className="mt-8 grid gap-4">
          {storyLegend.map((beat, i) => (
            <section
              key={beat.title}
              className={`panel bg-paper p-5 sm:p-6 ${i % 2 ? "md:mr-8" : "md:ml-8"}`}
            >
              <p className="caption-box text-sm">{beat.kicker}</p>
              <h3 className="mt-3 font-display text-3xl tracking-wide">{beat.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-muted">{beat.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <figure className="panel overflow-hidden">
            <img
              src="/images/origin-powers.webp"
              alt="Tongue-in-cheek drawing of the bat picking up a cape in orbit."
              className="aspect-video w-full object-cover"
            />
            <figcaption className="border-t-4 border-ink bg-caption px-3 py-2 text-xs uppercase tracking-[0.12em]">
              The drawing, not the documentary
            </figcaption>
          </figure>
          <figure className="panel overflow-hidden">
            <img
              src="/images/cover-splash.webp"
              alt="SpaceBat the mascot flying over a climbing shuttle."
              className="aspect-video w-full object-cover object-top"
            />
            <figcaption className="border-t-4 border-ink bg-caption px-3 py-2 text-xs uppercase tracking-[0.12em]">
              Hold on
            </figcaption>
          </figure>
        </div>

        <blockquote className="panel mt-10 bg-caption p-6 sm:p-10">
          <p className="font-display text-3xl leading-snug tracking-wide text-ink sm:text-4xl">
            “Goodbye and godspeed, magnificent Spacebat.”
          </p>
          <footer className="mt-4 text-sm uppercase tracking-[0.12em] text-ink/70">
            Gizmodo · March 2009 · we kept the name
          </footer>
        </blockquote>

        <p className="mt-10 text-base leading-relaxed text-muted">
          John and Dan from a diner booth: comics, movies, tech, politics, and
          markets.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/podcast">The podcast</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/subscribe">Get notified</Link>
          </Button>
        </div>

        <aside className="panel mt-12 bg-paper p-5 text-sm leading-relaxed text-muted">
          <p className="font-display text-lg tracking-wide text-ink">Sources</p>
          <p className="mt-2">
            NASA / Kennedy Space Center launch imagery and memos for STS-119;
            contemporaneous reporting from Space.com, Universe Today, CNN, ABC
            News, The Guardian, and Gizmodo. Photographs of the bat and of
            Discovery’s liftoff are NASA public-domain images. The cape is
            ours. The show is independent of NASA.
          </p>
        </aside>
      </div>
    </article>
  );
}
