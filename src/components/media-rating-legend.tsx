import { MEDIA_RATING_CYCLE, formatRating } from "@/lib/media";

/** The rating scale, high to low, then "not rated yet". */
export function MediaRatingLegend() {
  return (
    <fieldset className="mt-4 border-4 border-ink bg-paper px-3 py-3">
      <legend className="px-1 font-display text-lg tracking-wide">Ratings</legend>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {MEDIA_RATING_CYCLE.map((choice) => (
          <li key={choice}>{formatRating(choice)}</li>
        ))}
      </ul>
    </fieldset>
  );
}
