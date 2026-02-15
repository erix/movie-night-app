// Movie Night API Server - Auto-deployed via FluxCD + GitHub Actions
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');

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

// Helper to read/write data
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// Initialize or migrate data file
const initData = () => {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  // Check if data file exists and is actually a file (not a directory)
  const fileExists = fs.existsSync(DATA_FILE) && fs.statSync(DATA_FILE).isFile();
  
  if (!fileExists) {
    const initialData = {
      users: {
        'Erik': { icon: '👨‍💼', pin: null },
        'Timea': { icon: '👩‍🦰', pin: null },
        'Jázmin': { icon: '👧', pin: null },
        'Niki': { icon: '🧒', pin: null }
      },
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
  } else {
    // Migrate old data to add users section if missing
    const data = readData();
    if (!data.users) {
      data.users = {
        'Erik': { icon: '👨‍💼', pin: null },
        'Timea': { icon: '👩‍🦰', pin: null },
        'Jázmin': { icon: '👧', pin: null },
        'Niki': { icon: '🧒', pin: null }
      };
      writeData(data);
    }
    // Add pin field to existing users if missing
    Object.keys(data.users).forEach(user => {
      if (!('pin' in data.users[user])) {
        data.users[user].pin = null;
      }
    });
    writeData(data);
  }
};

initData();

// MDBList integration helper
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
      body: JSON.stringify({
        items: [movieId]
      })
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
      
      // Add winning movies to MDBList
      if (sorted[0]) {
        addToMDBList(sorted[0].tmdbId, sorted[0].imdbId, sorted[0].title);
      }
      if (sorted[1]) {
        addToMDBList(sorted[1].tmdbId, sorted[1].imdbId, sorted[1].title);
      }
      
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
    votes: data.currentWeek.votes,
    users: data.users || {}
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
  
  // Genre IDs from TMDb
  const genreIds = {
    action: 28,
    comedy: 35,
    crime: 80,
    drama: 18,
    thriller: 53,
    horror: 27,
    romance: 10749,
    scifi: 878,
    fantasy: 14,
    animation: 16,
    family: 10751,
    mystery: 9648
  };
  
  const endpoints = {
    trending: '/trending/movie/week',
    popular: '/movie/popular',
    topRated: '/movie/top_rated',
    nowPlaying: '/movie/now_playing',
    upcoming: '/movie/upcoming'
  };
  
  let url = '';
  if (endpoints[category]) {
    url = `https://api.themoviedb.org/3${endpoints[category]}?api_key=${process.env.TMDB_API_KEY}`;
  } else if (genreIds[category]) {
    url = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&with_genres=${genreIds[category]}&sort_by=popularity.desc`;
  } else {
    return res.status(400).json({ error: 'Invalid category' });
  }
  
  try {
    const response = await fetch(url);
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

// Add or update rating for a movie
app.post('/api/rate', (req, res) => {
  const { movieId, user, rating, weekNumber } = req.body;
  
  if (!user || rating === undefined || (rating < 1 || rating > 5)) {
    return res.status(400).json({ error: 'Invalid rating (must be 1-5)' });
  }
  
  let data = readData();
  let movie = null;
  let targetWeek = null;
  
  // Check current week first
  if (data.currentWeek.weekNumber === weekNumber) {
    movie = data.currentWeek.nominations.find(m => m.id === movieId);
    targetWeek = data.currentWeek;
  } else {
    // Check history
    targetWeek = data.history.find(w => w.weekNumber === weekNumber);
    if (targetWeek) {
      movie = targetWeek.allMovies.find(m => m.id === movieId);
    }
  }
  
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  
  // Initialize ratings object if it doesn't exist
  if (!movie.ratings) {
    movie.ratings = {};
  }
  
  movie.ratings[user] = rating;
  writeData(data);
  
  // Calculate average
  const ratings = Object.values(movie.ratings);
  const average = ratings.length > 0 
    ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
    : 0;
  
  res.json({ 
    success: true, 
    ratings: movie.ratings,
    average: parseFloat(average)
  });
});

// Get user's personal ratings
app.get('/api/user/:user/ratings', (req, res) => {
  const { user } = req.params;
  const data = readData();
  
  const ratedMovies = [];
  
  // Check current week
  data.currentWeek.nominations.forEach(movie => {
    if (movie.ratings && movie.ratings[user]) {
      ratedMovies.push({
        ...movie,
        userRating: movie.ratings[user],
        weekNumber: data.currentWeek.weekNumber
      });
    }
  });
  
  // Check history
  data.history.forEach(week => {
    week.allMovies.forEach(movie => {
      if (movie.ratings && movie.ratings[user]) {
        ratedMovies.push({
          ...movie,
          userRating: movie.ratings[user],
          weekNumber: week.weekNumber
        });
      }
    });
  });
  
  res.json(ratedMovies);
});

// Update user icon
app.post('/api/user/icon', (req, res) => {
  const { user, icon } = req.body;
  
  if (!user || !icon) {
    return res.status(400).json({ error: 'Missing user or icon' });
  }
  
  const data = readData();
  
  if (!data.users) {
    data.users = {};
  }
  
  if (!data.users[user]) {
    data.users[user] = {};
  }
  
  data.users[user].icon = icon;
  writeData(data);
  
  res.json({ success: true, icon });
});

// Set user PIN
app.post('/api/user/pin', (req, res) => {
  const { user, pin } = req.body;
  
  if (!user || !pin) {
    return res.status(400).json({ error: 'Missing user or PIN' });
  }
  
  // PIN must be 4 digits
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4 digits' });
  }
  
  const data = readData();
  
  // Check if PIN already used by another user
  const existingUser = Object.keys(data.users).find(u => u !== user && data.users[u].pin === pin);
  if (existingUser) {
    return res.status(400).json({ error: 'PIN already in use' });
  }
  
  if (!data.users[user]) {
    data.users[user] = { icon: '👤' };
  }
  
  data.users[user].pin = pin;
  writeData(data);
  
  res.json({ success: true });
});

// Login with PIN
app.post('/api/login', (req, res) => {
  const { pin } = req.body;
  
  if (!pin) {
    return res.status(400).json({ error: 'Missing PIN' });
  }
  
  const data = readData();
  
  // Find user with this PIN
  const user = Object.keys(data.users).find(u => data.users[u].pin === pin);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }
  
  res.json({ 
    success: true, 
    user,
    icon: data.users[user].icon
  });
});

// Manually add a movie to MDBList
app.post('/api/mdblist/add', async (req, res) => {
  const { tmdbId, imdbId, title } = req.body;
  
  if (!tmdbId && !imdbId) {
    return res.status(400).json({ error: 'Missing tmdbId or imdbId' });
  }
  
  const success = await addToMDBList(tmdbId, imdbId, title || 'Unknown');
  
  if (success) {
    res.json({ success: true, message: 'Added to MDBList' });
  } else {
    res.status(500).json({ error: 'Failed to add to MDBList' });
  }
});

// Get MDBList configuration status
app.get('/api/mdblist/status', (req, res) => {
  res.json({
    configured: !!(process.env.MDBLIST_API_KEY && process.env.MDBLIST_LIST_ID),
    listId: process.env.MDBLIST_LIST_ID ? process.env.MDBLIST_LIST_ID.substring(0, 8) + '...' : null
  });
});

app.listen(PORT, () => {
  console.log(`Movie Night app running on http://localhost:${PORT}`);
  if (process.env.MDBLIST_API_KEY && process.env.MDBLIST_LIST_ID) {
    console.log(`✅ MDBList integration enabled (List: ${process.env.MDBLIST_LIST_ID})`);
  }
});
