// Telegram Bot for Movie Night
const { Bot, InlineKeyboard } = require('grammy');
const fetch = require('node-fetch');

let dataHelpers = null;
let bot = null;

// Initialize the bot with data helpers from server.js
const initBot = (helpers) => {
  dataHelpers = helpers;
  
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN not set - Telegram bot disabled');
    return null;
  }

  bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

  // /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `🎬 *Welcome to Movie Night Bot!*\n\n` +
      `I help your family pick movies together.\n\n` +
      `*Commands:*\n` +
      `/nominate <movie> - Propose a movie\n` +
      `/vote - Vote on this week's movies\n` +
      `/status - See current week status\n` +
      `/movies - List this week's nominations\n` +
      `/help - Show this message\n\n` +
      `🌐 Web app: https://movies.erix-homelab.site`,
      { parse_mode: 'Markdown' }
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `🎬 *Movie Night Commands*\n\n` +
      `/nominate <movie> - Search and nominate a movie\n` +
      `/mynomination - View/change your nomination\n` +
      `/vote - Vote on nominated movies\n` +
      `/status - Current phase and countdown\n` +
      `/movies - List this week's nominations\n` +
      `/whoami - Check your linked account\n\n` +
      `🌐 https://movies.erix-homelab.site`,
      { parse_mode: 'Markdown' }
    );
  });

  // /status command
  bot.command('status', async (ctx) => {
    const data = dataHelpers.readData();
    const phase = dataHelpers.getCurrentPhase();
    const week = data.currentWeek;
    
    const phaseEmoji = {
      nomination: '📝',
      voting: '🗳️',
      results: '🏆'
    };
    
    const phaseText = {
      nomination: 'Nomination Phase',
      voting: 'Voting Phase',
      results: 'Results'
    };

    let statusMsg = `${phaseEmoji[phase]} *${phaseText[phase]}*\n\n`;
    
    if (phase === 'nomination') {
      const nominated = week.nominations.map(n => n.proposedBy);
      const users = Object.keys(data.users);
      const missing = users.filter(u => !nominated.includes(u));
      
      statusMsg += `*Nominations:* ${week.nominations.length}/${users.length}\n`;
      if (missing.length > 0) {
        statusMsg += `*Waiting for:* ${missing.join(', ')}\n`;
      }
      statusMsg += `\n_Nomination closes Wednesday night_`;
    } else if (phase === 'voting') {
      const deadline = new Date(week.votingDeadline);
      const now = new Date();
      const hoursLeft = Math.max(0, Math.round((deadline - now) / (1000 * 60 * 60)));
      
      statusMsg += `*Movies to vote on:* ${week.nominations.length}\n`;
      statusMsg += `*Votes cast:* ${Object.keys(week.votes).length}\n`;
      statusMsg += `⏰ *${hoursLeft}h* until voting closes`;
    } else {
      // Results phase - show winner
      const sorted = [...week.nominations].sort((a, b) => 
        (b.votes || 0) - (a.votes || 0)
      );
      
      if (sorted.length > 0) {
        const winner = sorted[0];
        statusMsg += `🥇 *Winner:* ${winner.title}\n`;
        statusMsg += `   Nominated by ${winner.proposedBy}\n`;
        if (sorted.length > 1) {
          statusMsg += `🥈 *Runner-up:* ${sorted[1].title}`;
        }
      } else {
        statusMsg += `No movies nominated this week`;
      }
    }

    await ctx.reply(statusMsg, { parse_mode: 'Markdown' });
  });

  // /movies command - list this week's nominations with clickable buttons
  bot.command('movies', async (ctx) => {
    const data = dataHelpers.readData();
    const nominations = data.currentWeek.nominations;

    if (nominations.length === 0) {
      await ctx.reply('No movies nominated yet this week. Use /nominate to add one!');
      return;
    }

    let msg = `🎬 *This Week's Movies*\n\n`;
    const keyboard = new InlineKeyboard();
    
    nominations.forEach((movie, i) => {
      const votes = movie.votes || 0;
      msg += `${i + 1}. *${movie.title}* (${movie.year || 'N/A'})\n`;
      msg += `   👤 ${movie.proposedBy} | 👍 ${votes} votes\n\n`;
      
      // Add clickable button for each movie
      const tmdbId = movie.tmdbId || movie.id;
      keyboard.text(`🎬 ${movie.title.substring(0, 25)}`, `movie:${tmdbId}`);
      if (i % 1 === 0) keyboard.row(); // One button per row
    });

    msg += `_Tap a movie for details & trailer_`;

    await ctx.reply(msg, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
  });

  // Handle movie detail button clicks - show description + trailer
  bot.callbackQuery(/^movie:(\d+)$/, async (ctx) => {
    const tmdbId = ctx.match[1];
    
    try {
      // Fetch movie details and videos from TMDb
      const [movie, videos] = await Promise.all([
        fetchTMDBMovie(tmdbId),
        fetchTMDBVideos(tmdbId)
      ]);

      // Find YouTube trailer
      const trailer = videos.results?.find(v => 
        v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
      );

      let msg = `🎬 *${movie.title}* (${movie.release_date?.split('-')[0] || '?'})\n\n`;
      msg += `⭐ ${movie.vote_average?.toFixed(1) || 'N/A'}/10\n`;
      msg += `🎭 ${movie.genres?.map(g => g.name).join(', ') || 'N/A'}\n`;
      msg += `⏱ ${movie.runtime || '?'} min\n\n`;
      msg += `${movie.overview || 'No description available.'}\n`;

      const keyboard = new InlineKeyboard();
      
      if (trailer) {
        keyboard.url('🎬 Watch Trailer', `https://www.youtube.com/watch?v=${trailer.key}`);
      }
      
      // Add TMDb link
      keyboard.row().url('📖 More Info', `https://www.themoviedb.org/movie/${tmdbId}`);

      await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Movie details error:', error);
      await ctx.answerCallbackQuery({ text: '❌ Failed to load movie details', show_alert: true });
    }
  });

  // /nominate command
  bot.command('nominate', async (ctx) => {
    const phase = dataHelpers.getCurrentPhase();
    
    if (phase !== 'nomination') {
      await ctx.reply(
        `❌ Nominations are closed!\n\n` +
        `Current phase: *${phase}*\n` +
        `Nominations open Monday.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const query = ctx.message.text.replace('/nominate', '').trim();
    
    if (!query) {
      await ctx.reply(
        '🔍 *How to nominate:*\n\n' +
        '`/nominate The Matrix`\n' +
        '`/nominate Inception 2010`\n\n' +
        'I\'ll search and show you options to pick from.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Search TMDB
    try {
      const results = await searchTMDB(query);
      
      if (results.length === 0) {
        await ctx.reply(`No movies found for "${query}". Try a different search.`);
        return;
      }

      // Show top 3 results with inline buttons
      const keyboard = new InlineKeyboard();
      
      let msg = `🔍 *Search results for "${query}"*\n\n`;
      
      results.slice(0, 3).forEach((movie, i) => {
        const year = movie.release_date?.split('-')[0] || '?';
        msg += `${i + 1}. *${movie.title}* (${year})\n`;
        if (movie.overview) {
          msg += `   _${movie.overview.substring(0, 80)}..._\n\n`;
        }
        
        keyboard.text(`${i + 1}. ${movie.title.substring(0, 20)}`, `nom:${movie.id}`);
        if (i < 2) keyboard.row();
      });

      keyboard.row().text('❌ Cancel', 'nom:cancel');

      await ctx.reply(msg, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      });

    } catch (error) {
      console.error('TMDB search error:', error);
      await ctx.reply('❌ Search failed. Try again later.');
    }
  });

  // Handle nomination button clicks
  bot.callbackQuery(/^nom:(.+)$/, async (ctx) => {
    const tmdbId = ctx.match[1];
    
    if (tmdbId === 'cancel') {
      await ctx.editMessageText('Nomination cancelled.');
      return;
    }

    const telegramUser = getTelegramUserName(ctx);
    const familyUser = findFamilyUser(telegramUser, dataHelpers.readData());

    if (!familyUser) {
      await ctx.answerCallbackQuery({
        text: '❌ Your Telegram account isn\'t linked to a family member',
        show_alert: true
      });
      return;
    }

    try {
      // Fetch full movie details
      const movie = await fetchTMDBMovie(tmdbId);
      const data = dataHelpers.readData();
      
      // Check if user already nominated
      const existing = data.currentWeek.nominations.find(n => n.proposedBy === familyUser);
      if (existing) {
        await ctx.answerCallbackQuery({
          text: `❌ You already nominated "${existing.title}" this week`,
          show_alert: true
        });
        return;
      }

      // Add nomination
      const nomination = {
        id: movie.id,
        title: movie.title,
        year: movie.release_date?.split('-')[0],
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        overview: movie.overview,
        proposedBy: familyUser,
        votes: 0
      };

      data.currentWeek.nominations.push(nomination);
      dataHelpers.writeData(data);

      await ctx.editMessageText(
        `✅ *${familyUser}* nominated:\n\n` +
        `🎬 *${movie.title}* (${nomination.year})\n\n` +
        `_${movie.overview?.substring(0, 150)}..._`,
        { parse_mode: 'Markdown' }
      );

      // Notify group if all nominations are in
      const users = Object.keys(data.users);
      if (data.currentWeek.nominations.length >= users.length && process.env.TELEGRAM_GROUP_ID) {
        await bot.api.sendMessage(
          process.env.TELEGRAM_GROUP_ID,
          `🎉 All nominations are in! Voting starts Thursday.\n\n` +
          `Use /movies to see this week's lineup.`
        );
      }

    } catch (error) {
      console.error('Nomination error:', error);
      await ctx.answerCallbackQuery({ text: '❌ Failed to nominate', show_alert: true });
    }
  });

  // /vote command
  bot.command('vote', async (ctx) => {
    const phase = dataHelpers.getCurrentPhase();
    
    if (phase !== 'voting') {
      await ctx.reply(
        `❌ Voting is not open!\n\n` +
        `Current phase: *${phase}*\n` +
        `Voting opens Thursday.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const telegramUser = getTelegramUserName(ctx);
    const data = dataHelpers.readData();
    const familyUser = findFamilyUser(telegramUser, data);

    if (!familyUser) {
      await ctx.reply(
        '❌ Your Telegram isn\'t linked to a family account.\n\n' +
        'Ask Erik to link your username in the web app.'
      );
      return;
    }

    const nominations = data.currentWeek.nominations;
    
    if (nominations.length === 0) {
      await ctx.reply('No movies to vote on this week.');
      return;
    }

    // Filter out user's own nomination
    const votable = nominations.filter(n => n.proposedBy !== familyUser);
    
    if (votable.length === 0) {
      await ctx.reply('No movies to vote on (you can\'t vote for your own nomination).');
      return;
    }

    // Check if user already voted
    const existingVote = data.currentWeek.votes[familyUser];
    
    const keyboard = new InlineKeyboard();
    let msg = `🗳️ *Vote for your favorite!*\n\n`;
    
    votable.forEach((movie, i) => {
      const voted = existingVote?.includes(movie.id) ? '✅ ' : '';
      msg += `${voted}*${movie.title}* (${movie.year})\n`;
      msg += `   👤 ${movie.proposedBy}\n\n`;
      
      keyboard.text(movie.title.substring(0, 25), `vote:${movie.id}`);
      if (i % 2 === 1) keyboard.row();
    });

    if (existingVote?.length >= 2) {
      msg += `\n_You've already voted for 2 movies._`;
    } else {
      msg += `\n_You can vote for up to 2 movies._`;
    }

    await ctx.reply(msg, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
  });

  // Handle vote button clicks
  bot.callbackQuery(/^vote:(\d+)$/, async (ctx) => {
    const movieId = parseInt(ctx.match[1]);
    const telegramUser = getTelegramUserName(ctx);
    const data = dataHelpers.readData();
    const familyUser = findFamilyUser(telegramUser, data);

    if (!familyUser) {
      await ctx.answerCallbackQuery({ text: '❌ Account not linked', show_alert: true });
      return;
    }

    // Initialize votes array
    if (!data.currentWeek.votes[familyUser]) {
      data.currentWeek.votes[familyUser] = [];
    }

    const userVotes = data.currentWeek.votes[familyUser];
    const movie = data.currentWeek.nominations.find(n => n.id === movieId);

    if (!movie) {
      await ctx.answerCallbackQuery({ text: '❌ Movie not found', show_alert: true });
      return;
    }

    // Toggle vote
    const voteIndex = userVotes.indexOf(movieId);
    
    if (voteIndex > -1) {
      // Remove vote
      userVotes.splice(voteIndex, 1);
      movie.votes = Math.max(0, (movie.votes || 1) - 1);
      await ctx.answerCallbackQuery({ text: `Removed vote for ${movie.title}` });
    } else {
      // Add vote (max 2)
      if (userVotes.length >= 2) {
        await ctx.answerCallbackQuery({ 
          text: '❌ You can only vote for 2 movies. Remove a vote first.',
          show_alert: true 
        });
        return;
      }
      
      userVotes.push(movieId);
      movie.votes = (movie.votes || 0) + 1;
      await ctx.answerCallbackQuery({ text: `✅ Voted for ${movie.title}!` });
    }

    dataHelpers.writeData(data);

    // Update message to show new vote status
    await ctx.editMessageText(
      `✅ *Vote updated!*\n\n` +
      `Your votes: ${userVotes.map(id => {
        const m = data.currentWeek.nominations.find(n => n.id === id);
        return m?.title || 'Unknown';
      }).join(', ') || 'None'}\n\n` +
      `Use /vote to change your votes.`,
      { parse_mode: 'Markdown' }
    );
  });

  // /whoami command - check account linking
  bot.command('whoami', async (ctx) => {
    const telegramUser = getTelegramUserName(ctx);
    const data = dataHelpers.readData();
    const familyUser = findFamilyUser(telegramUser, data);

    if (familyUser) {
      const userInfo = data.users[familyUser];
      await ctx.reply(
        `✅ You are *${familyUser}* ${userInfo?.icon || ''}\n\n` +
        `Telegram: @${ctx.from.username || ctx.from.first_name}`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(
        `❌ Your Telegram isn't linked to any family account.\n\n` +
        `Your Telegram: @${ctx.from.username || ctx.from.first_name}\n\n` +
        `Ask Erik to set up the account linking.`
      );
    }
  });

  // /mynomination command - view and change your nomination
  bot.command('mynomination', async (ctx) => {
    const telegramUser = getTelegramUserName(ctx);
    const data = dataHelpers.readData();
    const familyUser = findFamilyUser(telegramUser, data);

    if (!familyUser) {
      await ctx.reply('❌ Your Telegram isn\'t linked to a family account.');
      return;
    }

    const myNomination = data.currentWeek.nominations.find(n => n.proposedBy === familyUser);
    const phase = dataHelpers.getCurrentPhase();

    if (!myNomination) {
      if (phase === 'nomination') {
        await ctx.reply(
          `📝 *${familyUser}*, you haven't nominated a movie yet!\n\n` +
          `Use /nominate <movie> to pick one.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(`You didn't nominate a movie this week.`);
      }
      return;
    }

    const keyboard = new InlineKeyboard();
    
    // Only allow changes during nomination phase
    if (phase === 'nomination') {
      keyboard.text('🔄 Change nomination', `change:${myNomination.tmdbId || myNomination.id}`);
      keyboard.row();
    }
    
    const tmdbId = myNomination.tmdbId || myNomination.id;
    keyboard.text('🎬 View details', `movie:${tmdbId}`);

    await ctx.reply(
      `🎬 *Your nomination:*\n\n` +
      `*${myNomination.title}* (${myNomination.year || '?'})\n\n` +
      `${myNomination.overview?.substring(0, 150) || ''}...` +
      (phase === 'nomination' ? `\n\n_You can change it until Thursday_` : ''),
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  });

  // Handle change nomination button
  bot.callbackQuery(/^change:(\d+)$/, async (ctx) => {
    const phase = dataHelpers.getCurrentPhase();
    
    if (phase !== 'nomination') {
      await ctx.answerCallbackQuery({ 
        text: '❌ Can only change during nomination phase', 
        show_alert: true 
      });
      return;
    }

    const telegramUser = getTelegramUserName(ctx);
    const data = dataHelpers.readData();
    const familyUser = findFamilyUser(telegramUser, data);

    if (!familyUser) {
      await ctx.answerCallbackQuery({ text: '❌ Account not linked', show_alert: true });
      return;
    }

    // Remove current nomination
    const nomIndex = data.currentWeek.nominations.findIndex(n => n.proposedBy === familyUser);
    if (nomIndex > -1) {
      data.currentWeek.nominations.splice(nomIndex, 1);
      dataHelpers.writeData(data);
    }

    await ctx.editMessageText(
      `🔄 *Nomination removed!*\n\n` +
      `Use /nominate <movie> to pick a new one.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Error handler
  bot.catch((err) => {
    console.error('Telegram bot error:', err);
  });

  return bot;
};

// Start the bot
const startBot = async () => {
  if (!bot) return;
  
  try {
    await bot.start({
      onStart: (botInfo) => {
        console.log(`🤖 Telegram bot started: @${botInfo.username}`);
      }
    });
  } catch (error) {
    console.error('Failed to start Telegram bot:', error);
  }
};

// Get telegram username or name
const getTelegramUserName = (ctx) => {
  return ctx.from?.username || ctx.from?.first_name || 'Unknown';
};

// Find family user by telegram username
// Simple mapping - can be enhanced to store in data.json
const findFamilyUser = (telegramUser, data) => {
  const mapping = {
    'erix_12': 'Erik',
    'erix12': 'Erik',
    'Erik': 'Erik',
    'Timea': 'Timea',
    'timea': 'Timea',
    'Jazmin': 'Jázmin',
    'jazmin': 'Jázmin',
    'Jázmin': 'Jázmin',
    'jazmin_': 'Jázmin',
    'Niki': 'Niki',
    'niki': 'Niki'
  };
  
  // Check direct mapping first
  if (mapping[telegramUser]) {
    return mapping[telegramUser];
  }
  
  // Check if telegram username matches a family user (case insensitive)
  const users = Object.keys(data.users);
  const match = users.find(u => 
    u.toLowerCase() === telegramUser.toLowerCase() ||
    telegramUser.toLowerCase().includes(u.toLowerCase())
  );
  
  return match || null;
};

// TMDB search
const searchTMDB = async (query) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB_API_KEY not configured');
  
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`;
  const res = await fetch(url);
  const json = await res.json();
  return json.results || [];
};

// Fetch single movie from TMDB
const fetchTMDBMovie = async (tmdbId) => {
  const apiKey = process.env.TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`;
  const res = await fetch(url);
  return res.json();
};

// Fetch movie videos/trailers from TMDB
const fetchTMDBVideos = async (tmdbId) => {
  const apiKey = process.env.TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${apiKey}`;
  const res = await fetch(url);
  return res.json();
};

// Send message to group (for reminders)
const sendGroupMessage = async (message) => {
  if (!bot || !process.env.TELEGRAM_GROUP_ID) return;
  
  try {
    await bot.api.sendMessage(process.env.TELEGRAM_GROUP_ID, message, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Failed to send group message:', error);
  }
};

// Get bot instance
const getBot = () => bot;

module.exports = {
  initBot,
  startBot,
  sendGroupMessage,
  getBot
};
