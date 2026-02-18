// Trakt Device OAuth flow
const fetch = require('node-fetch');
const { encrypt, decrypt } = require('../utils/encryption');
const db = require('../db/database');

const TRAKT_API = 'https://api.trakt.tv';
const CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET;

// Step 1: Request a device code
const requestDeviceCode = async () => {
  const res = await fetch(`${TRAKT_API}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID })
  });
  if (!res.ok) throw new Error('Failed to get device code');
  return res.json();
  // Returns: { device_code, user_code, verification_url, expires_in, interval }
};

// Step 2: Poll for token after user approves
const pollForToken = async (deviceCode, interval = 5, expiresIn = 600) => {
  const deadline = Date.now() + expiresIn * 1000;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, interval * 1000));

    const res = await fetch(`${TRAKT_API}/oauth/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: deviceCode,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    });

    if (res.status === 200) return res.json(); // Success!
    if (res.status === 400) continue;          // Pending approval
    if (res.status === 404) throw new Error('Invalid device code');
    if (res.status === 409) throw new Error('Already approved');
    if (res.status === 410) throw new Error('Device code expired');
    if (res.status === 418) throw new Error('User denied access');
    if (res.status === 429) { await new Promise(r => setTimeout(r, 1000)); continue; }
  }

  throw new Error('Device code expired');
};

// Refresh an expired access token
const refreshAccessToken = async (userName) => {
  const auth = db.getTraktAuth(userName);
  if (!auth) throw new Error('No Trakt auth found');

  const oldRefreshToken = decrypt(auth.refresh_token);
  const res = await fetch(`${TRAKT_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: oldRefreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });

  if (!res.ok) throw new Error('Token refresh failed');
  const tokens = await res.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  db.saveTraktAuth(
    userName,
    auth.trakt_username,
    encrypt(tokens.access_token),
    encrypt(tokens.refresh_token),
    expiresAt
  );

  return tokens;
};

// In-progress device flows: deviceCode → { userName, expires }
const pendingFlows = new Map();

// Register routes on Express app
const registerRoutes = (app) => {

  // ── Always-available endpoints ──────────────────────────────────────────────

  app.get('/api/trakt/status/:user', (req, res) => {
    const auth = db.getTraktAuth(req.params.user);
    if (!auth) return res.json({ linked: false });
    res.json({ linked: true, username: auth.trakt_username, linked_at: auth.linked_at });
  });

  app.get('/api/trakt/watched/:user', (req, res) => {
    res.json(db.getWatchHistory(req.params.user));
  });

  // ── OAuth endpoints (require credentials) ──────────────────────────────────

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('⚠️  TRAKT_CLIENT_ID/SECRET not set - Trakt OAuth disabled');
    return;
  }

  // Start device flow - returns user_code + verification_url
  app.post('/api/trakt/link/start', async (req, res) => {
    const { user } = req.body;
    if (!user) return res.status(400).json({ error: 'Missing user' });

    try {
      const deviceFlow = await requestDeviceCode();
      // Store pending flow
      pendingFlows.set(deviceFlow.device_code, {
        userName: user,
        expires: Date.now() + deviceFlow.expires_in * 1000
      });

      // Start polling in background
      pollForToken(deviceFlow.device_code, deviceFlow.interval, deviceFlow.expires_in)
        .then(async (tokens) => {
          const pending = pendingFlows.get(deviceFlow.device_code);
          if (!pending) return;
          pendingFlows.delete(deviceFlow.device_code);

          // Get Trakt username
          const profileRes = await fetch(`${TRAKT_API}/users/me`, {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
              'trakt-api-version': '2',
              'trakt-api-key': CLIENT_ID
            }
          });
          const profile = await profileRes.json();
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          db.saveTraktAuth(
            pending.userName,
            profile.username,
            encrypt(tokens.access_token),
            encrypt(tokens.refresh_token),
            expiresAt
          );
          console.log(`✅ Trakt linked: ${pending.userName} → @${profile.username}`);
        })
        .catch(e => console.log(`Trakt device flow ended: ${e.message}`));

      res.json({
        user_code: deviceFlow.user_code,
        verification_url: deviceFlow.verification_url,
        expires_in: deviceFlow.expires_in
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Poll link status (frontend polls this after showing code to user)
  app.get('/api/trakt/link/status/:user', (req, res) => {
    const auth = db.getTraktAuth(req.params.user);
    if (!auth) return res.json({ linked: false });
    res.json({ linked: true, username: auth.trakt_username });
  });

  // Unlink Trakt
  app.post('/api/trakt/unlink', (req, res) => {
    const { user } = req.body;
    if (!user) return res.status(400).json({ error: 'Missing user' });
    db.removeTraktAuth(user);
    res.json({ success: true });
  });

  // Manual sync
  app.post('/api/trakt/sync/:user', async (req, res) => {
    const { user } = req.params;
    try {
      const traktApi = require('./api');
      const fromTrakt = await traktApi.syncWatchedFromTrakt(user);
      const toTrakt = await traktApi.syncWatchedToTrakt(user);
      res.json({ success: true, fromTrakt, toTrakt });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get user's Trakt watchlist (with TMDb poster data)
  app.get('/api/trakt/watchlist/:user', async (req, res) => {
    const { user } = req.params;
    try {
      const traktApi = require('./api');
      const watchlist = await traktApi.getWatchlist(user);

      // Enrich with TMDb poster paths (batch, max 20)
      const enriched = await Promise.all(
        (watchlist || []).slice(0, 40).map(async entry => {
          const tmdbId = entry.movie?.ids?.tmdb;
          if (tmdbId && process.env.TMDB_API_KEY) {
            try {
              const r = await fetch(
                `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`
              );
              const tmdb = await r.json();
              entry.movie.poster_path = tmdb.poster_path;
              entry.movie.backdrop_path = tmdb.backdrop_path;
            } catch (e) { /* skip */ }
          }
          return entry;
        })
      );

      res.json(enriched);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log('✅ Trakt routes registered');
};

module.exports = { requestDeviceCode, pollForToken, refreshAccessToken, registerRoutes };
