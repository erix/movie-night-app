/**
 * SQLite Adapter - Implements repository interface using SQLite
 * 
 * This adapter uses better-sqlite3 for persistence.
 * All the actual SQL logic is in db/database.js.
 */

const db = require('../../db/database');

module.exports = {
  // Users
  getUsers: db.getUsers,
  getUserByName: db.getUserByName,
  getUsersAsObject: db.getUsersAsObject,
  upsertUser: db.upsertUser,
  updateUserIcon: db.updateUserIcon,
  updateUserPin: db.updateUserPin,
  
  // Nominations
  getNominations: db.getNominations,
  getNominationByUser: db.getNominationByUser,
  getNominationById: db.getNominationById,
  addNomination: db.addNomination,
  removeNomination: db.removeNomination,
  
  // Votes
  getVotesForWeek: db.getVotesForWeek,
  getVotesAsObject: db.getVotesAsObject,
  getUserVotes: db.getUserVotes,
  addVote: db.addVote,
  removeVote: db.removeVote,
  
  // Watch history
  getWatchHistory: db.getWatchHistory,
  hasWatched: db.hasWatched,
  markWatched: db.markWatched,
  updateWatchRating: db.updateWatchRating,
  getWatchRating: db.getWatchRating,
  
  // Week results
  getWeekResults: db.getWeekResults,
  getAllWeekResults: db.getAllWeekResults,
  saveWeekResults: db.saveWeekResults,
  
  // Trakt auth
  getTraktAuth: db.getTraktAuth,
  saveTraktAuth: db.saveTraktAuth,
  removeTraktAuth: db.removeTraktAuth,
};
