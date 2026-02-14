# 🍿 Movie Night Voting App

A simple family movie voting system where everyone can propose movies and vote on what to watch.

## Features

- **4 Users**: Erik, Timea, Jázmin, Niki
- **Movie Search**: Search TMDb database for movies
- **Proposal Limits**: Each person can propose 1 movie per week
- **Voting System**: Upvote others' suggestions (can't vote on your own)
- **Watched Tracking**: Mark movies as watched (grayed out but still visible)
- **Pick Tonight**: Shows the highest-voted unwatched movie
- **Beautiful UI**: Movie posters from RPDB, clean card layout

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Get a TMDb API key**:
   - Go to https://www.themoviedb.org/settings/api
   - Sign up for a free account
   - Copy your API key

3. **Create .env file**:
   ```bash
   cp .env.example .env
   ```
   
4. **Add your TMDb API key** to `.env`:
   ```
   TMDB_API_KEY=your_actual_key_here
   ```

5. **Start the server**:
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

6. **Open in browser**:
   ```
   http://localhost:3000
   ```

## How to Use

1. **Select your name** from the dropdown
2. **Propose a movie**: Click "Propose Movie", search, and select
3. **Vote**: Click the heart button on movies you'd like to watch (can't vote on your own)
4. **Pick Tonight**: Click to see the highest-voted movie
5. **Mark as Watched**: Click the checkmark to mark a movie as watched

## Data Storage

All data is stored in `data.json` in the project root. No database required!

## Port Configuration

Default port is 3000. Change it in `.env`:
```
PORT=8080
```

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **APIs**: TMDb (search), RPDB (posters)
- **Storage**: JSON file

## Family Members

Erik, Timea, Jázmin, Niki

Enjoy your movie nights! 🎬
