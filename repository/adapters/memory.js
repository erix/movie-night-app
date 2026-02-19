/**
 * Memory Adapter - In-memory implementation for testing
 * 
 * This adapter stores everything in memory.
 * Useful for unit tests where you don't want SQLite.
 */

// In-memory storage
const store = {
  users: [],
  nominations: [],
  votes: [],
  watchHistory: [],
  weekResults: [],
  traktAuth: [],
};

// Auto-increment IDs
let userId = 1;
let nominationId = 1;
let voteId = 1;
let watchId = 1;

// Reset store (for testing)
const reset = () => {
  store.users = [];
  store.nominations = [];
  store.votes = [];
  store.watchHistory = [];
  store.weekResults = [];
  store.traktAuth = [];
  userId = 1;
  nominationId = 1;
  voteId = 1;
  watchId = 1;
};

// ─── Users ───────────────────────────────────────────────────────────────────

const getUsers = () => [...store.users];

const getUserByName = (name) => store.users.find(u => u.name === name) || null;

const getUsersAsObject = () => {
  const obj = {};
  store.users.forEach(u => {
    obj[u.name] = { icon: u.icon, pin: u.pin };
  });
  return obj;
};

const upsertUser = (name, icon, pin) => {
  const existing = getUserByName(name);
  if (existing) {
    existing.icon = icon || existing.icon;
    existing.pin = pin !== undefined ? pin : existing.pin;
    return existing;
  }
  const user = { id: userId++, name, icon: icon || '🎬', pin: pin || null };
  store.users.push(user);
  return user;
};

const updateUserIcon = (name, icon) => {
  const user = getUserByName(name);
  if (user) user.icon = icon;
};

const updateUserPin = (name, pin) => {
  const user = getUserByName(name);
  if (user) user.pin = pin;
};

// ─── Nominations ─────────────────────────────────────────────────────────────

const getNominations = (week) => {
  return store.nominations
    .filter(n => n.week === week)
    .map(n => {
      const user = store.users.find(u => u.id === n.proposed_by);
      const voteCount = store.votes.filter(v => v.nomination_id === n.id).length;
      return {
        ...n,
        proposed_by_name: user?.name,
        proposed_by_icon: user?.icon,
        vote_count: voteCount
      };
    });
};

const getNominationByUser = (week, userName) => {
  const user = getUserByName(userName);
  if (!user) return null;
  return store.nominations.find(n => n.week === week && n.proposed_by === user.id) || null;
};

const getNominationById = (id) => {
  const nom = store.nominations.find(n => n.id === id);
  if (!nom) return null;
  const user = store.users.find(u => u.id === nom.proposed_by);
  return { ...nom, proposed_by_name: user?.name };
};

const addNomination = (week, tmdbId, title, year, posterPath, backdropPath, overview, rating, imdbId, userName) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  
  const nom = {
    id: nominationId++,
    week,
    tmdb_id: tmdbId,
    title,
    year,
    poster_path: posterPath,
    backdrop_path: backdropPath,
    overview,
    rating,
    imdb_id: imdbId,
    proposed_by: user.id,
    proposed_at: new Date().toISOString()
  };
  store.nominations.push(nom);
  return nom;
};

const removeNomination = (week, userName) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  const idx = store.nominations.findIndex(n => n.week === week && n.proposed_by === user.id);
  if (idx >= 0) store.nominations.splice(idx, 1);
};

// ─── Votes ───────────────────────────────────────────────────────────────────

const getVotesForWeek = (week) => {
  return store.votes.filter(v => v.week === week).map(v => {
    const user = store.users.find(u => u.id === v.user_id);
    const nom = store.nominations.find(n => n.id === v.nomination_id);
    return { ...v, voter_name: user?.name, tmdb_id: nom?.tmdb_id, title: nom?.title };
  });
};

const getVotesAsObject = (week) => {
  const nominations = getNominations(week);
  const votes = {};
  nominations.forEach(nom => {
    const nomVotes = store.votes.filter(v => v.nomination_id === nom.id);
    votes[nom.id] = {};
    nomVotes.forEach(v => {
      const user = store.users.find(u => u.id === v.user_id);
      if (user) votes[nom.id][user.name] = true;
    });
  });
  return votes;
};

const getUserVotes = (week, userName) => {
  const user = getUserByName(userName);
  if (!user) return [];
  return store.votes.filter(v => v.week === week && v.user_id === user.id);
};

const addVote = (week, nominationIdVal, userName) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  
  // Check if already voted
  const existing = store.votes.find(
    v => v.nomination_id === nominationIdVal && v.user_id === user.id
  );
  if (existing) return existing;
  
  const vote = {
    id: voteId++,
    nomination_id: nominationIdVal,
    user_id: user.id,
    week,
    voted_at: new Date().toISOString()
  };
  store.votes.push(vote);
  return vote;
};

const removeVote = (week, nominationIdVal, userName) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  const idx = store.votes.findIndex(
    v => v.nomination_id === nominationIdVal && v.user_id === user.id && v.week === week
  );
  if (idx >= 0) store.votes.splice(idx, 1);
};

// ─── Watch History ───────────────────────────────────────────────────────────

const getWatchHistory = (userName) => {
  const user = getUserByName(userName);
  if (!user) return [];
  return store.watchHistory.filter(w => w.user_id === user.id);
};

const hasWatched = (userName, tmdbId) => {
  const user = getUserByName(userName);
  if (!user) return false;
  return store.watchHistory.some(w => w.user_id === user.id && w.tmdb_id === tmdbId);
};

const markWatched = (userName, tmdbId, title, week, rating = null) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  
  const existing = store.watchHistory.find(w => w.user_id === user.id && w.tmdb_id === tmdbId);
  if (existing) {
    existing.rating = rating !== null ? rating : existing.rating;
    existing.watched_at = new Date().toISOString();
    return existing;
  }
  
  const entry = {
    id: watchId++,
    user_id: user.id,
    tmdb_id: tmdbId,
    title,
    week,
    rating,
    watched_at: new Date().toISOString()
  };
  store.watchHistory.push(entry);
  return entry;
};

const updateWatchRating = (userName, tmdbId, rating) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  const entry = store.watchHistory.find(w => w.user_id === user.id && w.tmdb_id === tmdbId);
  if (entry) entry.rating = rating;
};

const getWatchRating = (userName, tmdbId) => {
  const user = getUserByName(userName);
  if (!user) return null;
  const entry = store.watchHistory.find(w => w.user_id === user.id && w.tmdb_id === tmdbId);
  return entry?.rating || null;
};

// ─── Week Results ────────────────────────────────────────────────────────────

const getWeekResults = (week) => {
  return store.weekResults.find(r => r.week === week) || null;
};

const getAllWeekResults = () => {
  return [...store.weekResults].sort((a, b) => b.week.localeCompare(a.week));
};

const saveWeekResults = (week, firstPlaceTmdb, firstPlaceTitle, secondPlaceTmdb, secondPlaceTitle) => {
  const existing = getWeekResults(week);
  if (existing) {
    existing.first_place_tmdb = firstPlaceTmdb;
    existing.first_place_title = firstPlaceTitle;
    existing.second_place_tmdb = secondPlaceTmdb;
    existing.second_place_title = secondPlaceTitle;
    existing.finalized_at = new Date().toISOString();
    return existing;
  }
  
  const result = {
    week,
    first_place_tmdb: firstPlaceTmdb,
    first_place_title: firstPlaceTitle,
    second_place_tmdb: secondPlaceTmdb,
    second_place_title: secondPlaceTitle,
    finalized_at: new Date().toISOString()
  };
  store.weekResults.push(result);
  return result;
};

// ─── Trakt Auth ──────────────────────────────────────────────────────────────

const getTraktAuth = (userName) => {
  const user = getUserByName(userName);
  if (!user) return null;
  return store.traktAuth.find(a => a.user_id === user.id) || null;
};

const saveTraktAuth = (userName, traktUsername, accessToken, refreshToken, expiresAt) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  
  const existing = store.traktAuth.find(a => a.user_id === user.id);
  if (existing) {
    existing.trakt_username = traktUsername;
    existing.access_token = accessToken;
    existing.refresh_token = refreshToken;
    existing.expires_at = expiresAt;
    existing.linked_at = new Date().toISOString();
    return existing;
  }
  
  const auth = {
    user_id: user.id,
    trakt_username: traktUsername,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    linked_at: new Date().toISOString()
  };
  store.traktAuth.push(auth);
  return auth;
};

const removeTraktAuth = (userName) => {
  const user = getUserByName(userName);
  if (!user) return;
  const idx = store.traktAuth.findIndex(a => a.user_id === user.id);
  if (idx >= 0) store.traktAuth.splice(idx, 1);
};

// ─── Export ──────────────────────────────────────────────────────────────────

module.exports = {
  // Testing helper
  reset,
  
  // Users
  getUsers,
  getUserByName,
  getUsersAsObject,
  upsertUser,
  updateUserIcon,
  updateUserPin,
  
  // Nominations
  getNominations,
  getNominationByUser,
  getNominationById,
  addNomination,
  removeNomination,
  
  // Votes
  getVotesForWeek,
  getVotesAsObject,
  getUserVotes,
  addVote,
  removeVote,
  
  // Watch history
  getWatchHistory,
  hasWatched,
  markWatched,
  updateWatchRating,
  getWatchRating,
  
  // Week results
  getWeekResults,
  getAllWeekResults,
  saveWeekResults,
  
  // Trakt auth
  getTraktAuth,
  saveTraktAuth,
  removeTraktAuth,
};
