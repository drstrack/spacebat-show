import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { fourthwallProductUrl, merch } from "@/data/merch";
import { loadMerchShop } from "@/lib/merch.functions";

export const Route = createFileRoute("/merch")({
  loader: () => loadMerchShop(),
  component: MerchPage,
});

function MerchPage() {
  const { shopUrl } = Route.useLoaderData();

  return (
    <article>
      <header className="mx-auto max-w-6xl px-3 pt-6 sm:px-5">
        <div className="panel bg-paper p-6 sm:p-10">
          <span className="caption-box w-fit">The shop</span>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-none tracking-wide sm:text-6xl">
            Wear the bat.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
            Two shirts and two hats, cut from the show’s mark. Fourthwall prints
            each one when you order and ships it. No pile of boxes in the booth.
          </p>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-4 px-3 py-6 sm:grid-cols-2 sm:px-5">
        {merch.map((piece) => {
          const buy = fourthwallProductUrl(shopUrl, piece.slug);
          return (
            <article key={piece.slug} className="panel overflow-hidden bg-paper">
              <figure className="border-b-4 border-ink bg-[#f4efe4]">
                <img
                  src={piece.image}
                  alt={piece.alt}
                  className="aspect-square w-full object-contain"
                />
              </figure>
              <div className="space-y-3 p-5">
                <p className="caption-box w-fit">{piece.kind}</p>
                <h2 className="font-display text-4xl leading-none tracking-wide">{piece.name}</h2>
                <p className="text-sm leading-relaxed text-muted">{piece.line}</p>
                {buy ? (
                  <Button asChild>
                    <a href={buy} target="_blank" rel="noreferrer">
                      Buy
                    </a>
                  </Button>
                ) : (
                  <Button asChild variant="secondary">
                    <Link to="/account">Get the drop</Link>
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <p className="mx-auto max-w-6xl px-3 pb-10 text-sm text-muted sm:px-5">
        {shopUrl
          ? "Size, price, and shipping are on the Fourthwall checkout."
          : "Fourthwall handles the checkout, the print, and the shipping. The buy buttons turn on when the shop is connected. Until then, the drop list on your account is the way to hear about it."}
      </p>
    </article>
  );
}
