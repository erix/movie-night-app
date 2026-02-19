/**
 * Data Repository - Abstract interface for persistence
 * 
 * This module provides a clean abstraction over the storage layer.
 * To switch backends, just change the adapter import below.
 * 
 * Available adapters:
 *   - ./adapters/sqlite.js (default)
 *   - ./adapters/memory.js (for testing)
 */

const adapter = require('./adapters/sqlite');

// ─── Users ───────────────────────────────────────────────────────────────────

/**
 * Get all users
 * @returns {Array<{id: number, name: string, icon: string, pin: string|null}>}
 */
const getUsers = () => adapter.getUsers();

/**
 * Get user by name
 * @param {string} name
 * @returns {{id: number, name: string, icon: string, pin: string|null}|null}
 */
const getUserByName = (name) => adapter.getUserByName(name);

/**
 * Get users as object (for API compatibility)
 * @returns {Object<string, {icon: string, pin: string|null}>}
 */
const getUsersAsObject = () => adapter.getUsersAsObject();

/**
 * Create or update user
 * @param {string} name
 * @param {string} icon
 * @param {string|null} pin
 */
const upsertUser = (name, icon, pin) => adapter.upsertUser(name, icon, pin);

/**
 * Update user icon
 * @param {string} name
 * @param {string} icon
 */
const updateUserIcon = (name, icon) => adapter.updateUserIcon(name, icon);

/**
 * Update user PIN
 * @param {string} name
 * @param {string|null} pin
 */
const updateUserPin = (name, pin) => adapter.updateUserPin(name, pin);

// ─── Nominations ─────────────────────────────────────────────────────────────

/**
 * Get nominations for a week
 * @param {string} week - ISO week (e.g., "2026-W08")
 * @returns {Array<Nomination>}
 */
const getNominations = (week) => adapter.getNominations(week);

/**
 * Get nomination by user for a week
 * @param {string} week
 * @param {string} userName
 * @returns {Nomination|null}
 */
const getNominationByUser = (week, userName) => adapter.getNominationByUser(week, userName);

/**
 * Get nomination by ID
 * @param {number} id
 * @returns {Nomination|null}
 */
const getNominationById = (id) => adapter.getNominationById(id);

/**
 * Add a nomination
 * @param {string} week
 * @param {number} tmdbId
 * @param {string} title
 * @param {string} year
 * @param {string} posterPath
 * @param {string} backdropPath
 * @param {string} overview
 * @param {number} rating
 * @param {string} imdbId
 * @param {string} userName
 */
const addNomination = (week, tmdbId, title, year, posterPath, backdropPath, overview, rating, imdbId, userName) =>
  adapter.addNomination(week, tmdbId, title, year, posterPath, backdropPath, overview, rating, imdbId, userName);

/**
 * Remove a nomination
 * @param {string} week
 * @param {string} userName
 */
const removeNomination = (week, userName) => adapter.removeNomination(week, userName);

// ─── Votes ───────────────────────────────────────────────────────────────────

/**
 * Get all votes for a week
 * @param {string} week
 * @returns {Array<Vote>}
 */
const getVotesForWeek = (week) => adapter.getVotesForWeek(week);

/**
 * Get votes as object (for API compatibility)
 * @param {string} week
 * @returns {Object<nominationId, Object<userName, boolean>>}
 */
const getVotesAsObject = (week) => adapter.getVotesAsObject(week);

/**
 * Get user's votes for a week
 * @param {string} week
 * @param {string} userName
 * @returns {Array<Vote>}
 */
const getUserVotes = (week, userName) => adapter.getUserVotes(week, userName);

/**
 * Add a vote
 * @param {string} week
 * @param {number} nominationId
 * @param {string} userName
 */
const addVote = (week, nominationId, userName) => adapter.addVote(week, nominationId, userName);

/**
 * Remove a vote
 * @param {string} week
 * @param {number} nominationId
 * @param {string} userName
 */
const removeVote = (week, nominationId, userName) => adapter.removeVote(week, nominationId, userName);

// ─── Watch History ───────────────────────────────────────────────────────────

/**
 * Get watch history for a user
 * @param {string} userName
 * @returns {Array<WatchEntry>}
 */
const getWatchHistory = (userName) => adapter.getWatchHistory(userName);

/**
 * Check if user has watched a movie
 * @param {string} userName
 * @param {number} tmdbId
 * @returns {boolean}
 */
const hasWatched = (userName, tmdbId) => adapter.hasWatched(userName, tmdbId);

/**
 * Mark a movie as watched
 * @param {string} userName
 * @param {number} tmdbId
 * @param {string} title
 * @param {string} week
 * @param {number|null} rating
 */
const markWatched = (userName, tmdbId, title, week, rating) =>
  adapter.markWatched(userName, tmdbId, title, week, rating);

/**
 * Update watch rating
 * @param {string} userName
 * @param {number} tmdbId
 * @param {number} rating
 */
const updateWatchRating = (userName, tmdbId, rating) => adapter.updateWatchRating(userName, tmdbId, rating);

/**
 * Get watch rating
 * @param {string} userName
 * @param {number} tmdbId
 * @returns {number|null}
 */
const getWatchRating = (userName, tmdbId) => adapter.getWatchRating(userName, tmdbId);

// ─── Week Results / History ──────────────────────────────────────────────────

/**
 * Get results for a specific week
 * @param {string} week
 * @returns {WeekResult|null}
 */
const getWeekResults = (week) => adapter.getWeekResults(week);

/**
 * Get all week results (history)
 * @returns {Array<WeekResult>}
 */
const getAllWeekResults = () => adapter.getAllWeekResults();

/**
 * Save week results
 * @param {string} week
 * @param {number} firstPlaceTmdb
 * @param {string} firstPlaceTitle
 * @param {number} secondPlaceTmdb
 * @param {string} secondPlaceTitle
 */
const saveWeekResults = (week, firstPlaceTmdb, firstPlaceTitle, secondPlaceTmdb, secondPlaceTitle) =>
  adapter.saveWeekResults(week, firstPlaceTmdb, firstPlaceTitle, secondPlaceTmdb, secondPlaceTitle);

// ─── Trakt Auth ──────────────────────────────────────────────────────────────

/**
 * Get Trakt auth for a user
 * @param {string} userName
 * @returns {TraktAuth|null}
 */
const getTraktAuth = (userName) => adapter.getTraktAuth(userName);

/**
 * Save Trakt auth for a user
 * @param {string} userName
 * @param {string} traktUsername
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {string} expiresAt
 */
const saveTraktAuth = (userName, traktUsername, accessToken, refreshToken, expiresAt) =>
  adapter.saveTraktAuth(userName, traktUsername, accessToken, refreshToken, expiresAt);

/**
 * Remove Trakt auth for a user
 * @param {string} userName
 */
const removeTraktAuth = (userName) => adapter.removeTraktAuth(userName);

// ─── Export ──────────────────────────────────────────────────────────────────

module.exports = {
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
