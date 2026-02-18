// Migration: JSON data.json → SQLite
// Run once: node db/migrate.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const db = require('./database');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const migrate = () => {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('No data.json found - nothing to migrate');
    return;
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log('📦 Starting migration from data.json → SQLite...\n');

  // ── 1. Users ──────────────────────────────────────────────────────────────
  console.log('👥 Migrating users...');
  const users = data.users || {};
  for (const [name, info] of Object.entries(users)) {
    db.upsertUser(name, info.icon || '🎬', info.pin || null);
    console.log(`  ✓ ${name} ${info.icon || ''}`);
  }

  // ── 2. Current week nominations ───────────────────────────────────────────
  const week = data.currentWeek?.weekNumber;
  if (week && data.currentWeek?.nominations?.length) {
    console.log(`\n🎬 Migrating nominations for ${week}...`);
    for (const nom of data.currentWeek.nominations) {
      try {
        db.addNomination(
          week,
          nom.tmdbId,
          nom.title,
          nom.year,
          nom.posterPath || null,
          nom.backdropPath || null,
          nom.overview || null,
          nom.rating || null,
          nom.imdbId || null,
          nom.proposedBy
        );
        console.log(`  ✓ ${nom.title} (by ${nom.proposedBy})`);
      } catch (e) {
        console.log(`  ⚠ Skipped ${nom.title}: ${e.message}`);
      }
    }
  }

  // ── 3. Votes ──────────────────────────────────────────────────────────────
  if (week && data.currentWeek?.votes) {
    console.log(`\n🗳️  Migrating votes for ${week}...`);
    const nominations = db.getNominations(week);

    for (const [voterName, votedIds] of Object.entries(data.currentWeek.votes)) {
      if (!Array.isArray(votedIds)) continue;
      for (const tmdbId of votedIds) {
        const nom = nominations.find(n => n.tmdb_id === tmdbId);
        if (nom) {
          try {
            db.addVote(week, nom.id, voterName);
            console.log(`  ✓ ${voterName} → ${nom.title}`);
          } catch (e) {
            console.log(`  ⚠ Skipped vote: ${e.message}`);
          }
        }
      }
    }
  }

  // ── 4. History ────────────────────────────────────────────────────────────
  if (data.history?.length) {
    console.log(`\n📚 Migrating ${data.history.length} history entries...`);
    for (const entry of data.history) {
      const weekNum = entry.weekNumber;
      for (const movie of entry.nominations || []) {
        // Mark as watched for all users (family watched it together)
        const users = db.getUsers();
        for (const user of users) {
          try {
            db.markWatched(user.name, movie.tmdbId, movie.title, weekNum);
          } catch (e) { /* ok */ }
        }
      }
    }
    console.log('  ✓ History migrated');
  }

  console.log('\n✅ Migration complete!');
  console.log(`   Database: ${path.join(DATA_DIR, 'movie-night.db')}`);
  console.log('\n💡 Tip: Keep data.json as backup for now.');
};

migrate();
