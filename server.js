// Movie Night API Server - SQLite Only (no data.json)
// Auto-deployed via FluxCD + GitHub Actions
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite DB - single source of truth
const db = require('./db/database');

app.use(express.json());
app.use(express.static('public'));

// Trakt routes (after middleware)
const traktAuth = require('./trakt/auth');
traktAuth.registerRoutes(app);

// CORS for Stremio
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ─── Helper Functions ────────────────────────────────────────────────────────

// Get current week number (ISO 8601)
const getWeekNumber = (d = new Date()) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

// Determine current phase based on day/time
const getCurrentPhase = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = now.getHours();
  
  // Monday (1) - Thursday (4): Nomination
  if (day >= 1 && day <= 4) {
    return 'nomination';
  }
  
  // Friday (5) before 18:00: Voting
  if (day === 5 && hour < 18) {
    return 'voting';
  }
  
  // Friday 18:00 onwards - Sunday: Results
  return 'results';
};

// Get voting deadline (Friday 18:00)
const getVotingDeadline = () => {
  const now = new Date();
  const friday = new Date(now);
  
  const daysUntilFriday = (5 - now.getDay() + 7) % 7;
  if (daysUntilFriday === 0 && now.getDay() === 5 && now.getHours() >= 18) {
    friday.setDate(now.getDate() + 7);
  } else {
    friday.setDate(now.getDate() + daysUntilFriday);
  }
  
  friday.setHours(18, 0, 0, 0);
  return friday.toISOString();
};

// ─── MDBList Integration ─────────────────────────────────────────────────────

const addToMDBList = async (tmdbId, imdbId, title) => {
  if (!process.env.MDBLIST_API_KEY || !process.env.MDBLIST_LIST_ID) {
    console.log('MDBList not configured - skipping');
    return false;
  }

  try {
    const movieId = imdbId || `tmdb:${tmdbId}`;
    const url = `https://api.mdblist.com/lists/${process.env.MDBLIST_LIST_ID}/items`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.MDBLIST_API_KEY
      },
      body: JSON.stringify({ items: [movieId] })
    });

    if (response.ok) {
      console.log(`✅ Added to MDBList: ${title} (${movieId})`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ MDBList error for ${title}:`, error);
      return false;
    }
  } catch (error) {
    console.error('MDBList API error:', error);
    return false;
  }
};

// ─── Week Transition Logic ───────────────────────────────────────────────────

// Check if we need to archive the previous week's results
const checkWeekTransition = () => {
  const currentWeek = getWeekNumber();
  
  // Get previous week
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const lastWeek = getWeekNumber(d);
  
  // Check if last week needs archiving
  const lastWeekResult = db.getWeekResults(lastWeek);
  if (lastWeekResult) return; // Already archived
  
  const lastWeekNominations = db.getNominations(lastWeek);
  if (lastWeekNominations.length === 0) return; // Nothing to archive
  
  // Sort by vote count and archive
  const sorted = lastWeekNominations.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
  const first = sorted[0];
  const second = sorted[1];
  
  // Save results
  db.saveWeekResults(
    lastWeek,
    first?.tmdb_id, first?.title,
    second?.tmdb_id, second?.title
  );
  
  // Add winners to MDBList
  if (first) addToMDBList(first.tmdb_id, first.imdb_id, first.title);
  if (second) addToMDBList(second.tmdb_id, second.imdb_id, second.title);
  
  console.log(`📦 Archived week ${lastWeek}: ${first?.title} (1st), ${second?.title} (2nd)`);
};

// Format nomination for API response
const formatNomination = (n) => ({
  id: n.id,
  tmdbId: n.tmdb_id,
  title: n.title,
  year: n.year,
  posterPath: n.poster_path,
  backdropPath: n.backdrop_path,
  overview: n.overview,
  rating: n.rating,
  imdbId: n.imdb_id,
  proposedBy: n.proposed_by_name,
  proposedAt: n.proposed_at
});

// ─── API Endpoints ───────────────────────────────────────────────────────────

// Get current state
app.get('/api/state', (req, res) => {
  checkWeekTransition();
  
  const week = getWeekNumber();
  const nominations = db.getNominations(week);
  let phase = getCurrentPhase();
  
  // Auto-advance to voting if all 4 nominated
  if (phase === 'nomination' && nominations.length === 4) {
    phase = 'voting';
  }
  
  res.json({
    week,
    phase,
    votingDeadline: getVotingDeadline(),
    nominations: nominations.map(formatNomination),
    votes: db.getVotesAsObject(week),
    users: db.getUsersAsObject()
  });
});

// Get history
app.get('/api/history', (req, res) => {
  const results = db.getAllWeekResults();
  
  // Convert to legacy format for compatibility
  const history = results.map(r => ({
    weekNumber: r.week,
    firstPlace: r.first_place_tmdb ? { tmdbId: r.first_place_tmdb, title: r.first_place_title } : null,
    secondPlace: r.second_place_tmdb ? { tmdbId: r.second_place_tmdb, title: r.second_place_title } : null
  }));
  
  res.json(history);
});

// TMDb browse endpoints
app.get('/api/browse/:category', async (req, res) => {
  const { category } = req.params;
  
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'TMDb API key not configured' });
  }
  
  const genreIds = {
    action: 28, comedy: 35, crime: 80, drama: 18, thriller: 53,
    horror: 27, romance: 10749, scifi: 878, fantasy: 14,
    animation: 16, family: 10751, mystery: 9648
  };
  
  const today = new Date().toISOString().split('T')[0];
  const baseDiscover = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&with_release_type=4|5|6&release_date.lte=${today}&region=DE`;
  
  const categoryParams = {
    trending: `&sort_by=popularity.desc&vote_count.gte=50`,
    popular: `&sort_by=popularity.desc&vote_count.gte=20`,
    topRated: `&sort_by=vote_average.desc&vote_count.gte=100`,
    nowPlaying: `&sort_by=release_date.desc&vote_count.gte=10`,
    action: `&with_genres=${genreIds.action}&sort_by=popularity.desc`,
    comedy: `&with_genres=${genreIds.comedy}&sort_by=popularity.desc`,
    drama: `&with_genres=${genreIds.drama}&sort_by=popularity.desc`,
    horror: `&with_genres=${genreIds.horror}&sort_by=popularity.desc`,
    scifi: `&with_genres=${genreIds.scifi}&sort_by=popularity.desc`,
    thriller: `&with_genres=${genreIds.thriller}&sort_by=popularity.desc`,
    romance: `&with_genres=${genreIds.romance}&sort_by=popularity.desc`,
    animation: `&with_genres=${genreIds.animation}&sort_by=popularity.desc`,
    family: `&with_genres=${genreIds.family}&sort_by=popularity.desc`
  };
  
  const params = categoryParams[category];
  if (!params) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  
  try {
    const response = await fetch(`${baseDiscover}${params}`);
    const data = await response.json();
    res.json(data.results || []);
  } catch (error) {
    console.error('TMDb browse error:', error);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Search movies
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query required' });
  }
  
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'TMDb API key not configured' });
  }
  
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(q)}&include_adult=false`
    );
    const data = await response.json();
    res.json(data.results || []);
  } catch (error) {
    console.error('TMDb search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get movie details
app.get('/api/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'TMDb API key not configured' });
  }
  
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=external_ids,videos`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('TMDb movie details error:', error);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// Nominate a movie
app.post('/api/nominate', async (req, res) => {
  const { tmdbId, user } = req.body;
  
  if (!tmdbId || !user) {
    return res.status(400).json({ error: 'Missing tmdbId or user' });
  }
  
  const week = getWeekNumber();
  const nominations = db.getNominations(week);
  
  // Check if already nominated
  const existing = db.getNominationByUser(week, user);
  if (existing) {
    return res.status(400).json({ error: 'You already nominated a movie this week' });
  }
  
  // Check if 4 nominations reached
  if (nominations.length >= 4) {
    return res.status(400).json({ error: 'Maximum nominations reached' });
  }
  
  // Check if movie already nominated
  if (nominations.some(n => n.tmdb_id === tmdbId)) {
    return res.status(400).json({ error: 'Movie already nominated this week' });
  }
  
  try {
    // Fetch movie details from TMDb
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=external_ids`
    );
    const movie = await response.json();
    
    db.addNomination(
      week,
      tmdbId,
      movie.title,
      movie.release_date?.split('-')[0],
      movie.poster_path,
      movie.backdrop_path,
      movie.overview,
      movie.vote_average,
      movie.external_ids?.imdb_id,
      user
    );
    
    res.json({ success: true, message: `${movie.title} nominated!` });
  } catch (error) {
    console.error('Nomination error:', error);
    res.status(500).json({ error: 'Failed to nominate movie' });
  }
});

// Withdraw nomination
app.post('/api/withdraw-nomination', (req, res) => {
  const { user } = req.body;
  
  if (!user) {
    return res.status(400).json({ error: 'Missing user' });
  }
  
  const week = getWeekNumber();
  
  try {
    db.removeNomination(week, user);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Vote for a movie
app.post('/api/vote', (req, res) => {
  const { nominationId, user, vote } = req.body;
  
  if (!nominationId || !user) {
    return res.status(400).json({ error: 'Missing nominationId or user' });
  }
  
  const week = getWeekNumber();
  
  // Check nomination exists
  const nomination = db.getNominationById(nominationId);
  if (!nomination) {
    return res.status(400).json({ error: 'Nomination not found' });
  }
  
  // Can't vote for own nomination
  if (nomination.proposed_by_name === user) {
    return res.status(400).json({ error: "Can't vote for your own nomination" });
  }
  
  try {
    if (vote) {
      db.addVote(week, nominationId, user);
    } else {
      db.removeVote(week, nominationId, user);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user votes
app.get('/api/votes/:user', (req, res) => {
  const { user } = req.params;
  const week = getWeekNumber();
  
  const votes = db.getUserVotes(week, user);
  const votedIds = votes.map(v => v.nomination_id);
  
  res.json(votedIds);
});

// Rate a watched movie
app.post('/api/rate', (req, res) => {
  const { tmdbId, user, rating } = req.body;
  
  if (!tmdbId || !user || rating === undefined) {
    return res.status(400).json({ error: 'Missing tmdbId, user, or rating' });
  }
  
  try {
    db.updateWatchRating(user, tmdbId, rating);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user ratings
app.get('/api/user/:user/ratings', (req, res) => {
  const { user } = req.params;
  
  const history = db.getWatchHistory(user);
  const ratings = {};
  
  history.forEach(h => {
    if (h.rating) {
      ratings[h.tmdb_id] = h.rating;
    }
  });
  
  res.json(ratings);
});

// Update user icon
app.post('/api/user/icon', (req, res) => {
  const { user, icon } = req.body;
  
  if (!user || !icon) {
    return res.status(400).json({ error: 'Missing user or icon' });
  }
  
  try {
    db.updateUserIcon(user, icon);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'User not found' });
  }
});

// Set user PIN
app.post('/api/user/pin', (req, res) => {
  const { user, pin } = req.body;
  
  if (!user) {
    return res.status(400).json({ error: 'Missing user' });
  }
  
  try {
    db.updateUserPin(user, pin || null);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'User not found' });
  }
});

// Login (verify PIN)
app.post('/api/login', (req, res) => {
  const { user, pin } = req.body;
  
  if (!user) {
    return res.status(400).json({ error: 'Missing user' });
  }
  
  const dbUser = db.getUserByName(user);
  if (!dbUser) {
    return res.status(400).json({ error: 'User not found' });
  }
  
  // No PIN set - allow login
  if (!dbUser.pin) {
    return res.json({ success: true });
  }
  
  // Verify PIN
  if (dbUser.pin === pin) {
    return res.json({ success: true });
  }
  
  res.status(401).json({ error: 'Invalid PIN' });
});

// MDBList add
app.post('/api/mdblist/add', async (req, res) => {
  const { tmdbId, imdbId, title } = req.body;
  
  if (!tmdbId) {
    return res.status(400).json({ error: 'Missing tmdbId' });
  }
  
  const success = await addToMDBList(tmdbId, imdbId, title);
  res.json({ success });
});

// MDBList status
app.get('/api/mdblist/status', (req, res) => {
  res.json({
    configured: !!(process.env.MDBLIST_API_KEY && process.env.MDBLIST_LIST_ID),
    listId: process.env.MDBLIST_LIST_ID || null
  });
});

// ─── Stremio Addon Endpoints ─────────────────────────────────────────────────

const formatMetaPreview = (movie, metadata = {}) => ({
  id: `tmdb:${movie.tmdb_id || movie.tmdbId}`,
  type: 'movie',
  name: movie.title,
  poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
  description: movie.overview,
  ...metadata
});

// Stremio manifest
app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'family.movie.night',
    version: '1.0.0',
    name: 'Family Movie Night',
    description: 'Family voting history and watch tracking',
    resources: ['catalog', 'meta'],
    types: ['movie'],
    catalogs: [
      { type: 'movie', id: 'nominations', name: "This Week's Nominations" },
      { type: 'movie', id: 'winners', name: 'Movie Night Winners' },
      { type: 'movie', id: 'watched', name: 'Watched Together' }
    ]
  });
});

// Stremio catalog
app.get('/catalog/:type/:id.json', (req, res) => {
  const { type, id } = req.params;
  
  if (type !== 'movie') {
    return res.status(400).json({ error: 'Only movie type supported' });
  }
  
  const week = getWeekNumber();
  const metas = [];
  
  try {
    if (id === 'nominations') {
      const nominations = db.getNominations(week);
      nominations.forEach(n => {
        metas.push(formatMetaPreview(n, {
          description: `${n.overview}\n\nNominated by: ${n.proposed_by_name}`
        }));
      });
    } else if (id === 'winners') {
      const results = db.getAllWeekResults();
      results.forEach(r => {
        if (r.first_place_tmdb) {
          metas.push({
            id: `tmdb:${r.first_place_tmdb}`,
            type: 'movie',
            name: r.first_place_title,
            description: `🏆 First Place - Week ${r.week}`
          });
        }
        if (r.second_place_tmdb) {
          metas.push({
            id: `tmdb:${r.second_place_tmdb}`,
            type: 'movie',
            name: r.second_place_title,
            description: `🥈 Second Place - Week ${r.week}`
          });
        }
      });
    } else if (id === 'watched') {
      // Get all users' watch history
      const users = db.getUsers();
      const watchedMap = {};
      
      users.forEach(u => {
        const history = db.getWatchHistory(u.name);
        history.forEach(h => {
          if (!watchedMap[h.tmdb_id]) {
            watchedMap[h.tmdb_id] = { ...h, watchers: [] };
          }
          watchedMap[h.tmdb_id].watchers.push(u.name);
        });
      });
      
      Object.values(watchedMap).forEach(w => {
        metas.push({
          id: `tmdb:${w.tmdb_id}`,
          type: 'movie',
          name: w.title,
          description: `Watched by: ${w.watchers.join(', ')}`
        });
      });
    } else {
      return res.status(404).json({ error: 'Catalog not found' });
    }
    
    res.json({ metas });
  } catch (error) {
    console.error('Catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// Stremio meta
app.get('/meta/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  
  if (type !== 'movie') {
    return res.status(400).json({ error: 'Only movie type supported' });
  }
  
  const tmdbId = id.startsWith('tmdb:') ? id.substring(5) : id;
  
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'TMDB API key not configured' });
  }
  
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=external_ids,credits`
    );
    
    if (!response.ok) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    const movie = await response.json();
    const week = getWeekNumber();
    
    // Get custom metadata
    const nominations = db.getNominations(week);
    const nomination = nominations.find(n => n.tmdb_id.toString() === tmdbId);
    
    let customDescription = movie.overview;
    if (nomination) {
      customDescription += `\n\n📋 Nominated by: ${nomination.proposed_by_name}`;
      customDescription += `\n🗳️ Votes: ${nomination.vote_count || 0}`;
    }
    
    res.json({
      meta: {
        id: `tmdb:${tmdbId}`,
        type: 'movie',
        name: movie.title,
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
        background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : undefined,
        description: customDescription,
        releaseInfo: movie.release_date?.split('-')[0],
        imdbRating: movie.vote_average?.toFixed(1),
        runtime: movie.runtime ? `${movie.runtime} min` : undefined,
        genres: movie.genres?.map(g => g.name)
      }
    });
  } catch (error) {
    console.error('Meta error:', error);
    res.status(500).json({ error: 'Failed to fetch meta' });
  }
});

// ─── Watch History Endpoints ─────────────────────────────────────────────────

app.post('/api/watched', async (req, res) => {
  const { tmdbId, user, title } = req.body;
  
  if (!tmdbId || !user) {
    return res.status(400).json({ error: 'Missing tmdbId or user' });
  }
  
  const week = getWeekNumber();
  
  try {
    db.markWatched(user, tmdbId, title, week);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/watched/:user/:tmdbId', (req, res) => {
  const { user, tmdbId } = req.params;
  const watched = db.hasWatched(user, parseInt(tmdbId));
  res.json({ watched });
});

app.get('/api/watched/:user', (req, res) => {
  const { user } = req.params;
  const history = db.getWatchHistory(user);
  res.json(history.map(h => h.tmdb_id));
});

// ─── Export for external modules ─────────────────────────────────────────────

module.exports = {
  getWeekNumber,
  getCurrentPhase,
  getVotingDeadline,
  addToMDBList
};

// ─── Telegram Bot ────────────────────────────────────────────────────────────

if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_GROUP_ID) {
  console.log('🤖 Telegram bot enabled');
  const telegramBot = require('./telegram/bot');
  telegramBot.initBot();
  telegramBot.startBot().then(() => {
    console.log('🤖 Telegram bot started');
  }).catch(err => {
    console.error('Failed to start Telegram bot:', err);
  });
}

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Movie Night app running on http://localhost:${PORT}`);
  
  if (process.env.MDBLIST_API_KEY && process.env.MDBLIST_LIST_ID) {
    console.log(`✅ MDBList integration enabled (List: ${process.env.MDBLIST_LIST_ID})`);
  }
});
