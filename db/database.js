const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const DB_FILE = path.join(DATA_DIR, 'movie-night.db');

let db;

const getDb = () => {
  if (!db) {
    db = new Database(DB_FILE);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
};

const initSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      icon TEXT DEFAULT '🎬',
      pin TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trakt_auth (
      user_id INTEGER PRIMARY KEY,
      trakt_username TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at DATETIME,
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS nominations (
      id INTEGER PRIMARY KEY,
      week TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      year TEXT,
      poster_path TEXT,
      backdrop_path TEXT,
      overview TEXT,
      rating REAL,
      imdb_id TEXT,
      proposed_by INTEGER NOT NULL,
      proposed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (proposed_by) REFERENCES users(id),
      UNIQUE(week, proposed_by)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY,
      nomination_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      week TEXT NOT NULL,
      voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(nomination_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      tmdb_id INTEGER NOT NULL,
      title TEXT,
      watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      rating INTEGER,
      week TEXT,
      synced_to_trakt INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, tmdb_id)
    );

    CREATE TABLE IF NOT EXISTS week_results (
      id INTEGER PRIMARY KEY,
      week TEXT UNIQUE NOT NULL,
      first_place_tmdb INTEGER,
      second_place_tmdb INTEGER,
      first_place_title TEXT,
      second_place_title TEXT,
      finalized_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

// ─── Users ───────────────────────────────────────────────────────────────────

const getUsers = () => {
  return getDb().prepare('SELECT * FROM users ORDER BY id').all();
};

const getUserByName = (name) => {
  return getDb().prepare('SELECT * FROM users WHERE name = ?').get(name);
};

const upsertUser = (name, icon, pin) => {
  return getDb().prepare(`
    INSERT INTO users (name, icon, pin) VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      icon = COALESCE(excluded.icon, icon),
      pin  = COALESCE(excluded.pin,  pin)
  `).run(name, icon, pin);
};

const updateUserIcon = (name, icon) => {
  return getDb().prepare('UPDATE users SET icon = ? WHERE name = ?').run(icon, name);
};

const updateUserPin = (name, pin) => {
  return getDb().prepare('UPDATE users SET pin = ? WHERE name = ?').run(pin, name);
};

// ─── Nominations ─────────────────────────────────────────────────────────────

const getNominations = (week) => {
  return getDb().prepare(`
    SELECT n.*, u.name AS proposed_by_name, u.icon AS proposed_by_icon,
           COUNT(v.id) AS vote_count
    FROM nominations n
    JOIN users u ON n.proposed_by = u.id
    LEFT JOIN votes v ON v.nomination_id = n.id
    WHERE n.week = ?
    GROUP BY n.id
    ORDER BY n.proposed_at
  `).all(week);
};

const getNominationByUser = (week, userName) => {
  return getDb().prepare(`
    SELECT n.* FROM nominations n
    JOIN users u ON n.proposed_by = u.id
    WHERE n.week = ? AND u.name = ?
  `).get(week, userName);
};

const addNomination = (week, tmdbId, title, year, posterPath, backdropPath, overview, rating, imdbId, userName) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  return getDb().prepare(`
    INSERT INTO nominations (week, tmdb_id, title, year, poster_path, backdrop_path, overview, rating, imdb_id, proposed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(week, tmdbId, title, year, posterPath, backdropPath, overview, rating, imdbId, user.id);
};

const removeNomination = (week, userName) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  return getDb().prepare('DELETE FROM nominations WHERE week = ? AND proposed_by = ?').run(week, user.id);
};

// ─── Votes ───────────────────────────────────────────────────────────────────

const getVotesForWeek = (week) => {
  return getDb().prepare(`
    SELECT v.*, u.name AS voter_name, n.tmdb_id, n.title
    FROM votes v
    JOIN users u ON v.user_id = u.id
    JOIN nominations n ON v.nomination_id = n.id
    WHERE v.week = ?
  `).all(week);
};

const getUserVotes = (week, userName) => {
  const user = getUserByName(userName);
  if (!user) return [];
  return getDb().prepare(`
    SELECT v.*, n.tmdb_id, n.title FROM votes v
    JOIN nominations n ON v.nomination_id = n.id
    WHERE v.week = ? AND v.user_id = ?
  `).all(week, user.id);
};

const addVote = (week, nominationId, userName) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  return getDb().prepare(`
    INSERT OR IGNORE INTO votes (nomination_id, user_id, week) VALUES (?, ?, ?)
  `).run(nominationId, user.id, week);
};

const removeVote = (week, nominationId, userName) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  return getDb().prepare(`
    DELETE FROM votes WHERE nomination_id = ? AND user_id = ? AND week = ?
  `).run(nominationId, user.id, week);
};

// ─── Watch History ───────────────────────────────────────────────────────────

const getWatchHistory = (userName) => {
  const user = getUserByName(userName);
  if (!user) return [];
  return getDb().prepare(`
    SELECT * FROM watch_history WHERE user_id = ? ORDER BY watched_at DESC
  `).all(user.id);
};

const hasWatched = (userName, tmdbId) => {
  const user = getUserByName(userName);
  if (!user) return false;
  const row = getDb().prepare('SELECT id FROM watch_history WHERE user_id = ? AND tmdb_id = ?').get(user.id, tmdbId);
  return !!row;
};

const markWatched = (userName, tmdbId, title, week, rating = null) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  return getDb().prepare(`
    INSERT INTO watch_history (user_id, tmdb_id, title, week, rating)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tmdb_id) DO UPDATE SET
      watched_at = CURRENT_TIMESTAMP,
      rating = COALESCE(excluded.rating, rating)
  `).run(user.id, tmdbId, title, week, rating);
};

// ─── Trakt Auth ───────────────────────────────────────────────────────────────

const getTraktAuth = (userName) => {
  const user = getUserByName(userName);
  if (!user) return null;
  return getDb().prepare('SELECT * FROM trakt_auth WHERE user_id = ?').get(user.id);
};

const saveTraktAuth = (userName, traktUsername, accessToken, refreshToken, expiresAt) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  return getDb().prepare(`
    INSERT INTO trakt_auth (user_id, trakt_username, access_token, refresh_token, expires_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      trakt_username = excluded.trakt_username,
      access_token   = excluded.access_token,
      refresh_token  = excluded.refresh_token,
      expires_at     = excluded.expires_at,
      linked_at      = CURRENT_TIMESTAMP
  `).run(user.id, traktUsername, accessToken, refreshToken, expiresAt);
};

const removeTraktAuth = (userName) => {
  const user = getUserByName(userName);
  if (!user) return;
  return getDb().prepare('DELETE FROM trakt_auth WHERE user_id = ?').run(user.id);
};

// ─── Week Results / History ──────────────────────────────────────────────────

const getWeekResults = (week) => {
  return getDb().prepare('SELECT * FROM week_results WHERE week = ?').get(week);
};

const getAllWeekResults = () => {
  return getDb().prepare('SELECT * FROM week_results ORDER BY week DESC').all();
};

const saveWeekResults = (week, firstPlaceTmdb, firstPlaceTitle, secondPlaceTmdb, secondPlaceTitle) => {
  return getDb().prepare(`
    INSERT INTO week_results (week, first_place_tmdb, first_place_title, second_place_tmdb, second_place_title)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(week) DO UPDATE SET
      first_place_tmdb = excluded.first_place_tmdb,
      first_place_title = excluded.first_place_title,
      second_place_tmdb = excluded.second_place_tmdb,
      second_place_title = excluded.second_place_title,
      finalized_at = CURRENT_TIMESTAMP
  `).run(week, firstPlaceTmdb, firstPlaceTitle, secondPlaceTmdb, secondPlaceTitle);
};

// ─── Additional Helpers ──────────────────────────────────────────────────────

const getNominationById = (id) => {
  return getDb().prepare(`
    SELECT n.*, u.name AS proposed_by_name 
    FROM nominations n
    JOIN users u ON n.proposed_by = u.id
    WHERE n.id = ?
  `).get(id);
};

const getUsersAsObject = () => {
  const users = getUsers();
  const obj = {};
  users.forEach(u => {
    obj[u.name] = { icon: u.icon, pin: u.pin };
  });
  return obj;
};

const getVotesAsObject = (week) => {
  const nominations = getNominations(week);
  const votes = {};
  nominations.forEach(nom => {
    const nomVotes = getDb().prepare(`
      SELECT u.name FROM votes v
      JOIN users u ON v.user_id = u.id
      WHERE v.nomination_id = ?
    `).all(nom.id);
    votes[nom.id] = {};
    nomVotes.forEach(v => {
      votes[nom.id][v.name] = true;
    });
  });
  return votes;
};

const updateWatchRating = (userName, tmdbId, rating) => {
  const user = getUserByName(userName);
  if (!user) throw new Error(`User not found: ${userName}`);
  return getDb().prepare(`
    UPDATE watch_history SET rating = ? WHERE user_id = ? AND tmdb_id = ?
  `).run(rating, user.id, tmdbId);
};

const getWatchRating = (userName, tmdbId) => {
  const user = getUserByName(userName);
  if (!user) return null;
  const row = getDb().prepare('SELECT rating FROM watch_history WHERE user_id = ? AND tmdb_id = ?').get(user.id, tmdbId);
  return row ? row.rating : null;
};

module.exports = {
  getDb,
  // Users
  getUsers, getUserByName, upsertUser, updateUserIcon, updateUserPin, getUsersAsObject,
  // Nominations
  getNominations, getNominationByUser, getNominationById, addNomination, removeNomination,
  // Votes
  getVotesForWeek, getUserVotes, addVote, removeVote, getVotesAsObject,
  // Watch history
  getWatchHistory, hasWatched, markWatched, updateWatchRating, getWatchRating,
  // Week results / History
  getWeekResults, getAllWeekResults, saveWeekResults,
  // Trakt auth
  getTraktAuth, saveTraktAuth, removeTraktAuth,
};
