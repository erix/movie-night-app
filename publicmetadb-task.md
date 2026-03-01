Read this task file and implement it.

Task: Integrate PublicMetaDB Community Ratings into the Movie Night app.

API: GET https://publicmetadb.com/api/external/ratings?tmdb_id=<ID>&media_type=movie
Auth header: Authorization: Bearer pm-9YqDNJ9lSSrcYGEbTUWsalzbphnumERJffgiptfKLPwU49JstmLsSQC6M0Hr

1. BACKEND (server.js): Add GET /api/ratings/:tmdbId endpoint that proxies PublicMetaDB ratings API with 10-min in-memory cache. Read the API key from process.env.PUBLICMETADB_API_KEY. Return {average, count} or null on error.

2. FRONTEND (public/index.html): Add a small purple/violet PMDB rating badge on all movie cards (nominations, search results, browse). Load lazily after cards render. Hide gracefully if no rating. Display score as percentage e.g. "87%".

3. Do NOT hardcode the API key. Add a comment that PUBLICMETADB_API_KEY must be added to the k8s secret movie-night-secrets.

Test: PORT=3003 PUBLICMETADB_API_KEY=pm-9YqDNJ9lSSrcYGEbTUWsalzbphnumERJffgiptfKLPwU49JstmLsSQC6M0Hr node server.js then curl http://localhost:3003/api/ratings/27205

When done: openclaw system event --text "Done: PublicMetaDB ratings integrated" --mode now
