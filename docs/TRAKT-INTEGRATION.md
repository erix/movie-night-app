# Trakt Integration Architecture

## Overview
Add per-user Trakt integration to sync watch history, ratings, and watchlists.

## Database: SQLite

### Schema

```sql
-- Users table (migrate from JSON)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  icon TEXT,
  pin TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trakt OAuth tokens (encrypted)
CREATE TABLE trakt_auth (
  user_id INTEGER PRIMARY KEY,
  trakt_user TEXT,              -- Trakt username
  access_token TEXT NOT NULL,   -- Encrypted
  refresh_token TEXT NOT NULL,  -- Encrypted
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Weekly nominations (migrate from JSON)
CREATE TABLE nominations (
  id INTEGER PRIMARY KEY,
  week TEXT NOT NULL,           -- e.g., "2026-W08"
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  year TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  overview TEXT,
  rating REAL,
  proposed_by INTEGER NOT NULL,
  proposed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposed_by) REFERENCES users(id)
);

-- Votes
CREATE TABLE votes (
  id INTEGER PRIMARY KEY,
  nomination_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  week TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nomination_id) REFERENCES nominations(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(nomination_id, user_id, week)
);

-- Watch history (synced with Trakt)
CREATE TABLE watch_history (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tmdb_id INTEGER NOT NULL,
  trakt_id INTEGER,
  watched_at DATETIME,
  rating INTEGER,               -- 1-10
  synced_to_trakt BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Week results history
CREATE TABLE week_history (
  id INTEGER PRIMARY KEY,
  week TEXT UNIQUE NOT NULL,
  first_place_id INTEGER,
  second_place_id INTEGER,
  watched_on DATETIME,
  FOREIGN KEY (first_place_id) REFERENCES nominations(id),
  FOREIGN KEY (second_place_id) REFERENCES nominations(id)
);
```

## Trakt OAuth Flow

### 1. Setup
- Create Trakt API app at https://trakt.tv/oauth/applications
- Get `client_id` and `client_secret`
- Set redirect URI: `https://movies.erix-homelab.site/auth/trakt/callback`

### 2. Link Account Flow

```
User clicks "Link Trakt" 
    → Redirect to Trakt authorization
    → User approves
    → Redirect back with code
    → Exchange code for tokens
    → Store encrypted tokens
    → Fetch Trakt profile
```

### 3. API Endpoints

```
GET  /auth/trakt/login?user=Erik     → Redirect to Trakt OAuth
GET  /auth/trakt/callback            → Handle OAuth callback
POST /auth/trakt/unlink              → Remove Trakt connection
GET  /api/trakt/status/:user         → Check if linked
POST /api/trakt/sync/:user           → Manual sync trigger
```

## Token Encryption

Use AES-256-GCM with a secret key stored in environment:

```javascript
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.TRAKT_ENCRYPTION_KEY; // 32 bytes

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted) {
  const [ivHex, tagHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

## Trakt API Integration

### Mark as Watched
```javascript
POST https://api.trakt.tv/sync/history
{
  "movies": [{
    "ids": { "tmdb": 12345 }
  }]
}
```

### Get Watch History
```javascript
GET https://api.trakt.tv/users/me/watched/movies
```

### Sync Ratings
```javascript
POST https://api.trakt.tv/sync/ratings
{
  "movies": [{
    "ids": { "tmdb": 12345 },
    "rating": 8
  }]
}
```

## UI Changes

### Settings Panel (per user)
- "Link Trakt Account" button
- Show connected Trakt username
- "Sync Now" button
- "Unlink" option

### Movie Cards
- 👁️ indicator if already watched (from Trakt)
- "Mark Watched" button syncs to Trakt

### Nominations
- Import from Trakt watchlist option

## Migration Plan

1. Add SQLite alongside JSON (read from both)
2. Migrate existing data to SQLite
3. Add Trakt OAuth endpoints
4. Add token storage
5. Implement sync features
6. Remove JSON dependency

## Environment Variables

```
TRAKT_CLIENT_ID=your_client_id
TRAKT_CLIENT_SECRET=your_client_secret
TRAKT_ENCRYPTION_KEY=32_byte_random_key
```

## File Structure

```
movie-night/
├── server.js
├── db/
│   ├── database.js      # SQLite connection & migrations
│   ├── schema.sql       # Table definitions
│   └── migrate.js       # JSON → SQLite migration
├── trakt/
│   ├── auth.js          # OAuth flow
│   ├── api.js           # Trakt API calls
│   └── sync.js          # Sync logic
├── utils/
│   └── encryption.js    # Token encryption
└── movie-night.db       # SQLite database file
```

## Phase Implementation

### Phase 1: SQLite Migration
- Set up SQLite
- Migrate users, nominations, votes, history
- Keep JSON as backup

### Phase 2: Trakt OAuth
- Add OAuth endpoints
- Token storage with encryption
- Link/unlink UI

### Phase 3: Sync Features
- Mark watched → Trakt
- Import watch history
- Sync ratings

### Phase 4: Advanced
- Watchlist import
- "Already watched" indicators
- Automatic background sync
