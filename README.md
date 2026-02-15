# 🍿 Movie Night - Weekly Voting System

A Netflix-inspired family movie voting app with weekly phases, cinematic UI, and automatic scheduling.

## ✨ Features

### Weekly Phase System
- **Monday-Wednesday: Nomination Phase** 🎬
  - Each person nominates 1 movie
  - Auto-advances when all 4 nominate
  - Browse trending, popular, and top-rated movies
  
- **Thursday-Friday noon: Voting Phase** 🗳️
  - Everyone votes for their top 2 picks
  - Can't vote for own nomination
  - Live countdown timer to deadline
  
- **Friday evening-Sunday: Results Phase** 🏆
  - 🥇 1st place = Friday movie
  - 🥈 2nd place = Saturday movie
  - Special gold/silver styling

- **Auto-reset every Monday** - Previous weeks archived

### Netflix-Style UI
- Horizontal scrolling movie rows
- Big cinematic 16:9 banners
- TMDb ratings & metadata
- Smooth hover animations
- Dark theme optimized for viewing

### Browse & Discovery
- **Trending Now** - Hot movies this week
- **Popular** - All-time favorites
- **Top Rated** - Critically acclaimed
- **In Theaters** - Current releases

### Previous Weeks Archive
- View past winners & votes
- Week-by-week history
- Keep track of what you've watched

## 🚀 Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Get a TMDb API key**:
   - Go to https://www.themoviedb.org/settings/api
   - Sign up for free account
   - Copy your API key

3. **Create .env file**:
   ```bash
   cp .env.example .env
   ```
   
4. **Add your TMDb API key** to `.env`:
   ```
   TMDB_API_KEY=your_actual_key_here
   PORT=3000
   ```

5. **Start the server**:
   ```bash
   npm start
   ```
   
   Or for development:
   ```bash
   npm run dev
   ```

6. **Open in browser**:
   ```
   http://localhost:3000
   ```

## 📱 Access from Other Devices

**On your local network:**
```
http://192.168.1.100:3000  (wired)
http://192.168.1.101:3000  (wireless)
```

Everyone can vote from their phones, tablets, or computers!

## 🎮 How to Use

### Nomination Phase (Mon-Wed)
1. Select your name from dropdown
2. Browse movie categories
3. Click a movie to see details
4. Click "Nominate This Movie"
5. Wait for others to nominate

### Voting Phase (Thu-Fri noon)
1. Select your name
2. Vote for your top 2 picks (can't vote for your own)
3. Watch the countdown timer
4. Change votes anytime before deadline

### Results Phase (Fri evening-Sun)
1. See the winners:
   - 🥇 Gold = Friday movie
   - 🥈 Silver = Saturday movie
2. Check "Previous Weeks" tab for history

## 👥 Family Members

- Erik
- Timea
- Jázmin
- Niki

## 🗂️ Data Storage

All data stored in `data.json`:
- Current week nominations & votes
- Previous weeks archive (last 12 weeks)
- Auto-managed, no database needed

## 🎨 Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **APIs**: TMDb (search & browse), RPDB (posters)
- **Storage**: JSON file

## 📅 Phase Schedule

| Day | Phase | Actions |
|-----|-------|---------|
| Monday | Nomination | Propose 1 movie |
| Tuesday | Nomination | Propose 1 movie |
| Wednesday | Nomination | Propose 1 movie |
| Thursday | Voting | Vote for 2 movies |
| Friday (until noon) | Voting | Vote for 2 movies |
| Friday (afternoon) | Results | Winners announced |
| Saturday | Results | Movie night! |
| Sunday | Results | Archive & prepare reset |

## 🔄 Auto-Reset

Every Monday, the system:
1. Archives last week's data to history
2. Resets nominations & votes
3. Starts new nomination phase
4. Keeps last 12 weeks of history

## 🎯 Rules

- 1 nomination per person per week
- Must vote for exactly 2 movies
- Can't vote for your own nomination
- Voting closes Friday at noon
- Winners determined by vote count

## 🎬 Enjoy your movie nights!

---

**Version 2.0** - Netflix UI + Weekly Phases
