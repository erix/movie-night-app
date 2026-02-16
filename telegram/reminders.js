// Scheduled reminders for Movie Night Telegram bot
const cron = require('node-cron');
const { sendGroupMessage } = require('./bot');

let dataHelpers = null;

const initReminders = (helpers) => {
  dataHelpers = helpers;

  if (!process.env.TELEGRAM_GROUP_ID) {
    console.log('⚠️ TELEGRAM_GROUP_ID not set - reminders disabled');
    return;
  }

  console.log('📅 Setting up Movie Night reminders...');

  // Monday 9am - Nomination phase starts
  cron.schedule('0 9 * * 1', async () => {
    console.log('🔔 Sending Monday nomination reminder');
    await sendGroupMessage(
      `📝 *Nomination Phase Started!*\n\n` +
      `Time to pick your movie for this week!\n\n` +
      `Use /nominate <movie> to search and nominate.\n\n` +
      `_Voting starts Thursday_`
    );
  }, { timezone: 'Europe/Berlin' });

  // Wednesday 8pm - Reminder if not everyone nominated
  cron.schedule('0 20 * * 3', async () => {
    if (!dataHelpers) return;
    
    const data = dataHelpers.readData();
    const users = Object.keys(data.users);
    const nominated = data.currentWeek.nominations.map(n => n.proposedBy);
    const missing = users.filter(u => !nominated.includes(u));

    if (missing.length > 0) {
      console.log('🔔 Sending Wednesday nomination nudge');
      await sendGroupMessage(
        `⏰ *Nomination closes tonight!*\n\n` +
        `Still waiting for: ${missing.join(', ')}\n\n` +
        `Use /nominate <movie> now!`
      );
    }
  }, { timezone: 'Europe/Berlin' });

  // Thursday 9am - Voting phase starts
  cron.schedule('0 9 * * 4', async () => {
    if (!dataHelpers) return;
    
    const data = dataHelpers.readData();
    const movies = data.currentWeek.nominations;
    
    let msg = `🗳️ *Voting Phase Started!*\n\n`;
    
    if (movies.length > 0) {
      msg += `*This week's nominees:*\n`;
      movies.forEach((m, i) => {
        msg += `${i + 1}. ${m.title} _(${m.proposedBy})_\n`;
      });
      msg += `\nUse /vote to pick your favorites!\n`;
      msg += `_Voting closes Friday noon_`;
    } else {
      msg += `No movies nominated this week 😢`;
    }

    console.log('🔔 Sending Thursday voting reminder');
    await sendGroupMessage(msg);
  }, { timezone: 'Europe/Berlin' });

  // Friday 11am - Last hour warning
  cron.schedule('0 11 * * 5', async () => {
    if (!dataHelpers) return;
    
    const data = dataHelpers.readData();
    const users = Object.keys(data.users);
    const voted = Object.keys(data.currentWeek.votes);
    const missing = users.filter(u => !voted.includes(u));

    console.log('🔔 Sending Friday 1-hour warning');
    
    let msg = `⏰ *Voting closes in 1 hour!*\n\n`;
    
    if (missing.length > 0) {
      msg += `Haven't voted yet: ${missing.join(', ')}\n\n`;
    }
    
    msg += `Use /vote now!`;
    
    await sendGroupMessage(msg);
  }, { timezone: 'Europe/Berlin' });

  // Friday 12:30pm - Results announcement
  cron.schedule('30 12 * * 5', async () => {
    if (!dataHelpers) return;
    
    const data = dataHelpers.readData();
    const nominations = [...data.currentWeek.nominations];
    
    if (nominations.length === 0) {
      await sendGroupMessage(`😢 No movies this week. Nominate next Monday!`);
      return;
    }

    // Sort by votes
    nominations.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    
    const winner = nominations[0];
    const runnerUp = nominations[1];

    console.log('🔔 Announcing Friday results');
    
    let msg = `🏆 *The Results Are In!*\n\n`;
    msg += `🥇 *WINNER:* ${winner.title}\n`;
    msg += `   👤 Nominated by ${winner.proposedBy}\n`;
    msg += `   👍 ${winner.votes || 0} votes\n\n`;
    
    if (runnerUp) {
      msg += `🥈 *Runner-up:* ${runnerUp.title}\n`;
      msg += `   👤 ${runnerUp.proposedBy} | 👍 ${runnerUp.votes || 0} votes\n\n`;
    }
    
    msg += `🎬 Tonight's movie: *${winner.title}*\n`;
    msg += `Enjoy movie night! 🍿`;

    await sendGroupMessage(msg);
  }, { timezone: 'Europe/Berlin' });

  // Sunday 8pm - Week summary
  cron.schedule('0 20 * * 0', async () => {
    console.log('🔔 Sending Sunday week summary');
    await sendGroupMessage(
      `📊 *Week Summary*\n\n` +
      `New week starts tomorrow!\n` +
      `Get ready to nominate your next movie pick. 🎬\n\n` +
      `_Nominations open Monday 9am_`
    );
  }, { timezone: 'Europe/Berlin' });

  console.log('✅ Reminders scheduled (Europe/Berlin timezone)');
};

module.exports = { initReminders };
