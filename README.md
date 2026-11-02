# SpaceBat

Site for the SpaceBat show. Comic-book catalog, hosts, and a podcast page.

Live: [www.spacebatshow.net](https://www.spacebatshow.net)

The conversation is comics, movies, tech, politics, markets, and finance. The NASA STS-119 bat is tongue-in-cheek inspiration, not the plot.

`/movies` lists movies and TV from `media_item`. Migration `0012_media.sql` creates that table, `media_rating`, and a `media_seed` marker, then inserts the original 43 catalog titles once. Migration `0013_media_space_odyssey.sql` adds 2001: A Space Odyssey once. Migration `0014_media_rescan.sql` adds the 2026-11-01 rescan titles once. Both run on a database that already has the earlier titles, and neither changes existing rows or ratings. Deleting a title does not bring it back. Admins edit the list at `/admin/movies`. Posters and details prefer TMDB when `TMDB_API_KEY` is set. That value is a v4 read-access token sent as a bearer, unless it is a 32-character hex v3 api_key. Wikipedia and IMDb stay as backups. Without that key the seeded list still renders. John (`jack2ryan@aim.com`) and Dan (`dstrack@hotmail.com`) each set only their own rating.

`/comic/collection` is John's comic and movie collectibles. Migration `0011_memorabilia_frame_one.sql` inserts the first frame once, from `public/memorabilia/frame-01-batman-statue-v2.jpg`, and writes a `memorabilia_seed` marker. Deleting that frame does not bring it back. Admins can replace any frame's picture, edit its caption, or delete it. A static `/memorabilia/` file is never deleted from disk; only a Blob or a local upload file is removed when its picture is replaced.
