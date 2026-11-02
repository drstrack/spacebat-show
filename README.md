# SpaceBat

Site for the SpaceBat show. Comic-book catalog, hosts, and a podcast page.

Live: [www.spacebatshow.net](https://www.spacebatshow.net)

The conversation is comics, movies, tech, politics, markets, and finance. The NASA STS-119 bat is tongue-in-cheek inspiration, not the plot.

`/movies` lists movies and TV from `media_item`. Migration `0012_media.sql` creates that table, `media_rating`, and a `media_seed` marker, then inserts the 43 catalog titles once. Deleting a title does not bring it back. Admins edit the list at `/admin/movies`. Posters and details prefer TMDB when `TMDB_API_KEY` is set (a v3 api_key, or a v4 read-access token). Wikipedia and IMDb stay as backups. Without that key the seeded list still renders. John (`jack2ryan@aim.com`) and Dan (`dstrack@hotmail.com`) each set only their own rating.

`/comic/collection` is John's comic and movie collectibles. Migration `0011_memorabilia_frame_one.sql` inserts the first frame once, from `public/memorabilia/frame-01-batman-statue-v2.jpg`, and writes a `memorabilia_seed` marker. Deleting that frame does not bring it back. Admins can replace any frame's picture, edit its caption, or delete it. A static `/memorabilia/` file is never deleted from disk; only a Blob or a local upload file is removed when its picture is replaced.
