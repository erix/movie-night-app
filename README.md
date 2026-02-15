# 🍿 MOVIE NIGHT - Family Voting App

A Netflix-inspired family movie voting app with weekly phases, PIN authentication, live search, rating system, and cinematic UI.

![Movie Night Logo](https://img.shields.io/badge/Movie-Night-E50914?style=for-the-badge&logo=netflix)

## ✨ Features

### 🔐 PIN Authentication
- Each family member sets a unique 4-digit PIN
- Auto-login with session persistence
- Personal user icons (60+ emoji options)
- Secure, simple, no passwords needed

### 📅 Weekly Phase System
- **Monday-Wednesday: Nomination Phase** 🎬
  - Each person nominates 1 movie
  - Auto-advances when all 4 nominate
  - Browse 16+ genre categories
  
- **Thursday-Friday noon: Voting Phase** 🗳️
  - Everyone votes for their top 2 picks
  - Can't vote for own nomination
  - Live countdown timer to deadline
  
- **Friday evening-Sunday: Results Phase** 🏆
  - 🥇 1st place = Friday movie
  - 🥈 2nd place = Saturday movie
  - Special gold/silver styling

- **Auto-reset every Monday** - Previous weeks archived

### 🎬 Netflix-Style UI
- Horizontal scrolling movie rows
- Big cinematic 16:9 banners
- TMDb ratings & metadata
- Smooth hover animations
- Dark theme optimized for viewing
- Mobile-responsive design

### 🔍 Live Search & Browse
- **Live autocomplete** - Suggestions appear as you type
- **16 Genre Categories**: Action, Comedy, Thriller, Crime, Drama, Romance, Horror, Sci-Fi, Fantasy, Animation, Family, Mystery, and more
- **Search categories**: Trending, Popular, Top Rated, In Theaters
- Movie banners with ratings and years

### ⭐ Post-Watch Rating System
- Rate movies 1-5 stars after watching
- See average ratings from all family members
- "My Ratings" tab shows your personal rating history
- Track what everyone thought of each movie

### 📊 History & Archive
- View past winners & votes
- Week-by-week history
- Rate previous weeks' movies
- Keep track of what you've watched

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- TMDb API key (free)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/erix/movie-night-app.git
   cd movie-night-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Get a TMDb API key**:
   - Go to https://www.themoviedb.org/settings/api
   - Sign up for a free account
   - Copy your API key

4. **Create .env file**:
   ```bash
   cp .env.example .env
   ```
   
5. **Add your TMDb API key** to `.env`:
   ```env
   TMDB_API_KEY=your_actual_key_here
   PORT=3000
   ```

6. **Start the server**:
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

7. **Open in browser**:
   ```
   http://localhost:3000
   ```

## 📱 Access from Mobile

**On your local network:**
```
http://192.168.1.100:3000  (wired)
http://192.168.1.101:3000  (wireless)
```

Everyone can vote from their phones, tablets, or computers!

## 🎮 How to Use

### First Time Setup
1. Open the app
2. Click "First time? Set up your PIN"
3. Select your name
4. Create a 4-digit PIN
5. Choose your personal icon

### Weekly Flow

#### Nomination Phase (Mon-Wed)
1. Log in with your PIN
2. Browse movie categories or search by title
3. Click a movie to see details
4. Click "Nominate This Movie"
5. Wait for others to nominate

#### Voting Phase (Thu-Fri noon)
1. Log in
2. Vote for your top 2 picks (can't vote for your own)
3. Watch the countdown timer
4. Change votes anytime before deadline

#### Results Phase (Fri evening-Sun)
1. See the winners:
   - 🥇 Gold = Friday movie
   - 🥈 Silver = Saturday movie
2. Watch your movies!
3. Rate them 1-5 stars after watching
4. Check "Previous Weeks" tab for history

## 👥 Default Users

- Erik
- Timea
- Jázmin
- Niki

_(Configured in `server.js` - customize for your family!)_

## 🗂️ Data Storage

All data stored in `data.json`:
- User PINs and icons
- Current week nominations & votes
- Movie ratings
- Previous weeks archive (last 12 weeks)
- No database required!

## 🎨 Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **APIs**: 
  - TMDb (search, browse, metadata)
  - RPDB (high-quality movie posters)
- **Storage**: JSON file
- **Fonts**: Bebas Neue (Google Fonts)

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

Every Monday at midnight, the system:
1. Archives last week's data to history
2. Calculates final ratings
3. Resets nominations & votes
4. Starts new nomination phase
5. Keeps last 12 weeks of history

## 🎯 Rules

- 1 nomination per person per week
- Must vote for exactly 2 movies
- Can't vote for your own nomination
- Voting closes Friday at noon
- Winners determined by vote count
- Rate movies anytime after watching

## 🎬 Features in Detail

### Live Search
- Type to search - suggestions appear instantly
- 300ms debounce for smooth typing
- Up to 8 suggestions with movie banners
- Click any suggestion to view details

### Genre Categories
Action, Comedy, Thriller, Crime, Drama, Romance, Horror, Sci-Fi, Fantasy, Animation, Family, Mystery, Trending, Popular, Top Rated, In Theaters

### Rating System
- Click 1-5 stars to rate
- See average rating + number of votes
- "My Ratings" tab shows your history
- Ratings persist across weeks

### Mobile Optimization
- Touch-friendly buttons (44px+)
- Responsive grid layouts
- Optimized font sizes
- Proper viewport settings
- Works on phones, tablets, desktops

## 🛠️ Configuration

### Port
Change in `.env`:
```env
PORT=8080
```

### Family Members
Edit `server.js` to add/remove users:
```javascript
const initialData = {
  users: {
    'Your Name': { icon: '👤', pin: null },
    // ... add more
  },
  // ...
};
```

## 📸 Screenshots

### Main Screen
- Netflix-style logo with popcorn bucket
- Phase indicator banner
- Nominated movies grid
- Browse categories

### Search
- Live autocomplete dropdown
- Movie banners with ratings
- Click to view details

### History
- Previous weeks archive
- Star ratings
- Average ratings display

## 🤝 Contributing

This is a personal family project, but feel free to fork and customize for your own family!

## 📝 License

MIT License - Feel free to use and modify for your family!

## 🎉 Enjoy your movie nights!

Built with ❤️ for family movie time 🍿🎬

---

**Version 2.0** - Netflix UI + Weekly Phases + PIN Auth + Ratings
