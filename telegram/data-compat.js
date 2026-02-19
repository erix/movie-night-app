/**
 * Data Compatibility Layer for Telegram Bot
 * 
 * This bridges the old readData/writeData interface to the new repository.
 * Allows telegram bot to work without major refactoring.
 */

const repo = require('../repository');

// Get week number (same as server.js)
const getWeekNumber = (d = new Date()) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

// Get current phase
const getCurrentPhase = () => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  
  if (day >= 1 && day <= 4) return 'nomination';
  if (day === 5 && hour < 18) return 'voting';
  return 'results';
};

// Get voting deadline
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

// Read data in legacy format (for bot compatibility)
const readData = () => {
  const week = getWeekNumber();
  const nominations = repo.getNominations(week);
  const votes = repo.getVotesAsObject(week);
  const users = repo.getUsersAsObject();
  
  // Convert nominations to legacy format
  const legacyNominations = nominations.map(n => ({
    id: n.tmdb_id,
    tmdbId: n.tmdb_id,
    title: n.title,
    year: n.year,
    poster: n.poster_path ? `https://image.tmdb.org/t/p/w500${n.poster_path}` : null,
    posterPath: n.poster_path,
    overview: n.overview,
    proposedBy: n.proposed_by_name,
    votes: n.vote_count || 0,
    nominationId: n.id  // Keep DB id for voting
  }));
  
  // Convert votes to legacy format
  const legacyVotes = {};
  for (const [nomId, voters] of Object.entries(votes)) {
    const nom = nominations.find(n => n.id === parseInt(nomId));
    if (nom) {
      for (const voter of Object.keys(voters)) {
        if (!legacyVotes[voter]) legacyVotes[voter] = [];
        legacyVotes[voter].push(nom.tmdb_id);
      }
    }
  }
  
  return {
    users,
    currentWeek: {
      weekNumber: week,
      phase: getCurrentPhase(),
      votingDeadline: getVotingDeadline(),
      nominations: legacyNominations,
      votes: legacyVotes
    }
  };
};

// Write data - maps legacy operations to repository
// Note: Most writes are now handled via API calls, but we keep this for compatibility
const writeData = (data) => {
  // This is a no-op now since operations go through API
  // The bot should use API calls instead of direct writes
  console.log('⚠️ writeData called from bot - operations should use API');
};

module.exports = {
  readData,
  writeData,
  getCurrentPhase,
  getWeekNumber,
  getVotingDeadline
};
