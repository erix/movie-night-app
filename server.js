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

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ movies: [] }, null, 2));
}

// Helper to read/write data
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// Get all movies
app.get('/api/movies', (req, res) => {
  const data = readData();
  res.json(data.movies);
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

// Propose a movie
app.post('/api/propose', (req, res) => {
  const { tmdbId, title, year, imdbId, proposedBy } = req.body;
  const data = readData();
  
  // Check if user already proposed this week
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const userProposals = data.movies.filter(
    m => m.proposedBy === proposedBy && new Date(m.proposedAt).getTime() > oneWeekAgo
  );
  
  if (userProposals.length >= 1) {
    return res.status(400).json({ error: 'You can only propose one movie per week' });
  }
  
  // Check if movie already exists
  if (data.movies.find(m => m.tmdbId === tmdbId)) {
    return res.status(400).json({ error: 'Movie already proposed' });
  }
  
  const newMovie = {
    id: Date.now().toString(),
    tmdbId,
    title,
    year,
    imdbId,
    proposedBy,
    proposedAt: new Date().toISOString(),
    votes: { Erik: false, Timea: false, Jázmin: false, Niki: false },
    watched: false
  };
  
  data.movies.push(newMovie);
  writeData(data);
  res.json(newMovie);
});

// Toggle vote
app.post('/api/vote', (req, res) => {
  const { movieId, user } = req.body;
  const data = readData();
  
  const movie = data.movies.find(m => m.id === movieId);
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  
  // Can't vote on your own movie
  if (movie.proposedBy === user) {
    return res.status(400).json({ error: "Can't vote on your own proposal" });
  }
  
  movie.votes[user] = !movie.votes[user];
  writeData(data);
  res.json(movie);
});

// Mark as watched
app.post('/api/watched', (req, res) => {
  const { movieId } = req.body;
  const data = readData();
  
  const movie = data.movies.find(m => m.id === movieId);
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  
  movie.watched = !movie.watched;
  writeData(data);
  res.json(movie);
});

app.listen(PORT, () => {
  console.log(`Movie Night app running on http://localhost:${PORT}`);
});
