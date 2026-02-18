// Trakt API client
const fetch = require('node-fetch');
const { decrypt } = require('../utils/encryption');
const db = require('../db/database');

const TRAKT_API = 'https://api.trakt.tv';
const CLIENT_ID = process.env.TRAKT_CLIENT_ID;

// Make an authenticated Trakt API request
const traktRequest = async (userName, method, endpoint, body = null) => {
  const auth = db.getTraktAuth(userName);
  if (!auth) throw new Error('Trakt not linked');

  const accessToken = decrypt(auth.access_token);
  if (!accessToken) throw new Error('Failed to decrypt token');

  const res = await fetch(`${TRAKT_API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) throw new Error('Trakt token expired');
  if (!res.ok) throw new Error(`Trakt API error: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
};

// Get Trakt user profile
const getProfile = async (userName) => {
  return traktRequest(userName, 'GET', '/users/me?extended=full');
};

// Get full watched movie history from Trakt
const getWatchedMovies = async (userName) => {
  return traktRequest(userName, 'GET', '/sync/watched/movies');
};

// Mark movie as watched on Trakt
const markWatched = async (userName, tmdbId, watchedAt = null) => {
  return traktRequest(userName, 'POST', '/sync/history', {
    movies: [{
      watched_at: watchedAt || new Date().toISOString(),
      ids: { tmdb: tmdbId }
    }]
  });
};

// Sync rating to Trakt
const syncRating = async (userName, tmdbId, rating) => {
  return traktRequest(userName, 'POST', '/sync/ratings', {
    movies: [{
      rated_at: new Date().toISOString(),
      rating,
      ids: { tmdb: tmdbId }
    }]
  });
};

// Get user's watchlist
const getWatchlist = async (userName) => {
  return traktRequest(userName, 'GET', '/sync/watchlist/movies');
};

// Sync all watched movies from Trakt into local DB
const syncWatchedFromTrakt = async (userName) => {
  const watched = await getWatchedMovies(userName);
  let count = 0;
  for (const entry of (watched || [])) {
    try {
      const movie = entry.movie;
      const tmdbId = movie.ids?.tmdb;
      if (!tmdbId) continue;
      db.markWatched(userName, tmdbId, movie.title, null, null);
      count++;
    } catch (e) { /* skip */ }
  }
  return count;
};

// Push any locally unwatched/unsynced entries to Trakt
const syncWatchedToTrakt = async (userName) => {
  const user = db.getUserByName(userName);
  if (!user) return 0;

  const unsynced = db.getDb().prepare(`
    SELECT * FROM watch_history WHERE user_id = ? AND synced_to_trakt = 0
  `).all(user.id);

  if (!unsynced.length) return 0;

  await traktRequest(userName, 'POST', '/sync/history', {
    movies: unsynced.map(row => ({
      watched_at: row.watched_at,
      ids: { tmdb: row.tmdb_id }
    }))
  });

  // Mark as synced
  const ids = unsynced.map(r => r.id);
  db.getDb().prepare(`
    UPDATE watch_history SET synced_to_trakt = 1 WHERE id IN (${ids.map(() => '?').join(',')})
  `).run(...ids);

  return unsynced.length;
};

module.exports = {
  getProfile,
  getWatchedMovies,
  markWatched,
  syncRating,
  getWatchlist,
  syncWatchedFromTrakt,
  syncWatchedToTrakt
};
