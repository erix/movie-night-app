require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static('public'));

// Helper to get current week number
const getWeekNumber = (d = new Date()) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

// Helper to determine current phase
const getCurrentPhase = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = now.getHours();
  
  // Monday (1) - Wednesday (3): Nomination
  if (day >= 1 && day <= 3) {
    return 'nomination';
  }
  
  // Thursday (4) or Friday (5) before noon: Voting
  if (day === 4 || (day === 5 && hour < 12)) {
    return 'voting';
  }
  
  // Friday noon onwards - Sunday: Results
  return 'results';
};

// Helper to get voting deadline (Friday noon)
const getVotingDeadline = () => {
  const now = new Date();
  const friday = new Date(now);
  
  // Find next Friday
  const daysUntilFriday = (5 - now.getDay() + 7) % 7;
  if (daysUntilFriday === 0 && now.getDay() === 5 && now.getHours() >= 12) {
    // If it's Friday after noon, get next Friday
    friday.setDate(now.getDate() + 7);
  } else {
    friday.setDate(now.getDate() + daysUntilFriday);
  }
  
  friday.setHours(12, 0, 0, 0);
  return friday.toISOString();
};

// Initialize or migrate data file
const initData = () => {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      currentWeek: {
        weekNumber: getWeekNumber(),
        phase: getCurrentPhase(),
        votingDeadline: getVotingDeadline(),
        nominations: [],
        votes: {}
      },
      history: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
};

initData();

// Helper to read/write data
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// Check and update phase/week
const checkAndUpdatePhase = (data) => {
  const currentWeek = getWeekNumber();
  const currentPhase = getCurrentPhase();
  
  // New week - archive old week and reset
  if (data.currentWeek.weekNumber !== currentWeek) {
    if (data.currentWeek.nominations.length > 0) {
      // Archive the old week
      const nominations = data.currentWeek.nominations;
      const voteCounts = {};
      nominations.forEach(nom => {
        voteCounts[nom.id] = Object.values(data.currentWeek.votes[nom.id] || {}).filter(v => v).length;
      });
      
      const sorted = nominations.sort((a, b) => voteCounts[b.id] - voteCounts[a.id]);
      
      data.history.unshift({
        weekNumber: data.currentWeek.weekNumber,
        firstPlace: sorted[0] || null,
        secondPlace: sorted[1] || null,
        allMovies: nominations,
        votes: data.currentWeek.votes
      });
      
      // Keep only last 12 weeks
      if (data.history.length > 12) {
        data.history = data.history.slice(0, 12);
      }
    }
    
    // Reset for new week
    data.currentWeek = {
      weekNumber: currentWeek,
      phase: currentPhase,
      votingDeadline: getVotingDeadline(),
      nominations: [],
      votes: {}
    };
    
    writeData(data);
    return data;
  }
  
  // Update phase if changed
  if (data.currentWeek.phase !== currentPhase) {
    // Auto-advance from nomination to voting if all 4 nominated
    if (currentPhase === 'nomination' && data.currentWeek.nominations.length === 4) {
      data.currentWeek.phase = 'voting';
    } else {
      data.currentWeek.phase = currentPhase;
    }
    writeData(data);
  }
  
  // Check if all 4 nominated - auto-advance to voting
  if (data.currentWeek.phase === 'nomination' && data.currentWeek.nominations.length === 4) {
    data.currentWeek.phase = 'voting';
    writeData(data);
  }
  
  return data;
};

// Get current state
app.get('/api/state', (req, res) => {
  let data = readData();
  data = checkAndUpdatePhase(data);
  res.json({
    week: data.currentWeek.weekNumber,
    phase: data.currentWeek.phase,
    votingDeadline: data.currentWeek.votingDeadline,
    nominations: data.currentWeek.nominations,
    votes: data.currentWeek.votes
  });
});

// Get history
app.get('/api/history', (req, res) => {
  const data = readData();
  res.json(data.history);
});

// TMDb browse endpoints
app.get('/api/browse/:category', async (req, res) => {
  const { category } = req.params;
  
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'TMDb API key not configured' });
  }
  
  const endpoints = {
    trending: '/trending/movie/week',
    popular: '/movie/popular',
    topRated: '/movie/top_rated',
    nowPlaying: '/movie/now_playing',
    upcoming: '/movie/upcoming'
  };
  
  const endpoint = endpoints[category];
  if (!endpoint) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3${endpoint}?api_key=${process.env.TMDB_API_KEY}`
    );
    const data = await response.json();
    res.json(data.results || []);
  } catch (error) {
    res.status(500).json({ error: 'Browse failed' });
  }
});

// Search TMDb
app.get('/api/search', async (req, res) => {
  const { query } = req.query;
  if (!query || !process.env.TMDB_API_KEY) {
    return res.status(400).json({ error: 'Missing query or API key' });
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    res.json(data.results || []);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get movie details (for IMDb ID)
app.get('/api/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }
  
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=external_ids`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

// Nominate a movie
app.post('/api/nominate', async (req, res) => {
  const { tmdbId, user } = req.body;
  let data = readData();
  data = checkAndUpdatePhase(data);
  
  // Check phase
  if (data.currentWeek.phase !== 'nomination') {
    return res.status(400).json({ error: 'Not in nomination phase' });
  }
  
  // Check if user already nominated
  if (data.currentWeek.nominations.find(n => n.proposedBy === user)) {
    return res.status(400).json({ error: 'You already nominated a movie this week' });
  }
  
  // Check if movie already nominated
  if (data.currentWeek.nominations.find(n => n.tmdbId === tmdbId)) {
    return res.status(400).json({ error: 'Movie already nominated' });
  }
  
  // Fetch movie details
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=external_ids`
    );
    const movie = await response.json();
    
    const nomination = {
      id: Date.now().toString(),
      tmdbId: movie.id,
      title: movie.title,
      year: movie.release_date ? movie.release_date.split('-')[0] : 'N/A',
      imdbId: movie.external_ids?.imdb_id || null,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      rating: movie.vote_average,
      overview: movie.overview,
      proposedBy: user,
      proposedAt: new Date().toISOString()
    };
    
    data.currentWeek.nominations.push(nomination);
    data.currentWeek.votes[nomination.id] = {};
    
    // Auto-advance if all 4 nominated
    if (data.currentWeek.nominations.length === 4) {
      data.currentWeek.phase = 'voting';
    }
    
    writeData(data);
    res.json(nomination);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// Vote
app.post('/api/vote', (req, res) => {
  const { movieId, user, value } = req.body;
  let data = readData();
  data = checkAndUpdatePhase(data);
  
  // Check phase
  if (data.currentWeek.phase !== 'voting') {
    return res.status(400).json({ error: 'Not in voting phase' });
  }
  
  const movie = data.currentWeek.nominations.find(m => m.id === movieId);
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  
  // Can't vote for your own nomination
  if (movie.proposedBy === user) {
    return res.status(400).json({ error: "Can't vote for your own nomination" });
  }
  
  // Set vote
  if (!data.currentWeek.votes[movieId]) {
    data.currentWeek.votes[movieId] = {};
  }
  data.currentWeek.votes[movieId][user] = value;
  
  // Validate: each user can only have 2 votes total
  const userVoteCount = Object.keys(data.currentWeek.votes).reduce((count, mId) => {
    return count + (data.currentWeek.votes[mId][user] ? 1 : 0);
  }, 0);
  
  if (userVoteCount > 2) {
    return res.status(400).json({ error: 'You can only vote for 2 movies' });
  }
  
  writeData(data);
  res.json({ success: true });
});

// Get current user's vote status
app.get('/api/votes/:user', (req, res) => {
  const { user } = req.params;
  let data = readData();
  data = checkAndUpdatePhase(data);
  
  const userVotes = {};
  Object.keys(data.currentWeek.votes).forEach(movieId => {
    userVotes[movieId] = data.currentWeek.votes[movieId][user] || false;
  });
  
  const voteCount = Object.values(userVotes).filter(v => v).length;
  
  res.json({
    votes: userVotes,
    count: voteCount
  });
});

app.listen(PORT, () => {
  console.log(`Movie Night app running on http://localhost:${PORT}`);
});
