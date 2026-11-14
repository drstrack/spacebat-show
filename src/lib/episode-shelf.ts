/**
 * Episodes revealed on the podcast shelf before the next "More episodes" click.
 *
 * The Podhome feed currently has eight published episodes, and each card is a
 * full-width panel. A first page of twelve would include the whole catalog and
 * leave the bottom of the list with nowhere to go. Six is a recent run; each
 * click reveals the next six, and the button leaves once every episode is shown.
 */
export const EPISODE_PAGE_SIZE = 6;

export function visibleEpisodeCount(
  total: number,
  pages: number,
  pageSize = EPISODE_PAGE_SIZE,
) {
  return Math.min(Math.max(0, total), Math.max(0, pages) * Math.max(1, pageSize));
}

export function episodeShelfHasMore(
  total: number,
  pages: number,
  pageSize = EPISODE_PAGE_SIZE,
) {
  return visibleEpisodeCount(total, pages, pageSize) < Math.max(0, total);
}

const INSTANCE_ID = /^[A-Za-z][\w:-]*$/;

/**
 * DOM ids for one shelf. The podcast page keeps the original ids (`episode-list`,
 * `episode-shelf-count`, `episode-card-*`). Another shelf on a different route
 * passes its own instance id so `aria-controls` never points at the wrong list.
 */
export function episodeShelfDomIds(instanceId = "episode") {
  const safe = INSTANCE_ID.test(instanceId) ? instanceId : "episode";
  return {
    listId: `${safe}-list`,
    countId: `${safe}-shelf-count`,
    cardId: (slug: string) => `${safe}-card-${slug}`,
  };
}
