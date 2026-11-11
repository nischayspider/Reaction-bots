require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

// --- 24/7 KEEP-ALIVE SERVER ---
const app = express();
app.get('/', (req, res) => res.send('Kiara Agent is running 24/7!'));
app.listen(process.env.PORT || 3000, () => console.log('Kiara Web server is awake.'));

// Array of all 20 tokens
const tokens = [
  process.env.LISTENER_BOT_TOKEN, process.env.TOKEN_2, process.env.TOKEN_3, process.env.TOKEN_4, process.env.TOKEN_5, 
  process.env.TOKEN_6, process.env.TOKEN_7, process.env.TOKEN_8, process.env.TOKEN_9, process.env.TOKEN_10,
  process.env.TOKEN_11, process.env.TOKEN_12, process.env.TOKEN_13, process.env.TOKEN_14, process.env.TOKEN_15,
  process.env.TOKEN_16, process.env.TOKEN_17, process.env.TOKEN_18, process.env.TOKEN_19, process.env.TOKEN_20
];

const listenerBot = new TelegramBot(tokens[0], { polling: true });

// NEW EMOJI LIST PERMANENTLY UPDATED
const allowedEmojis = ['💋', '⚡', '😭', '😁', '💘', '❤️', '🍓', '❤️‍🔥', '😂'];

// --- MULTIPLE GROUPS & STATE MANAGEMENT ---
let activeGroups = new Set(); 
let currentAction = null; 
let pendingReactChatId = null;
let pendingReactMessageId = null;

// NEW: Multiple Admins & Pin State Tracking
const adminUsernames = ['disturbor', 'madciara'];
const groupPinModes = new Map(); // Tracks { type: 1|2, weekTimer } per chat

console.log("Kiara Main Listener is online...");

// Reaction Logic with Custom Emoji Support & 1-Minute Delay
async function triggerReactions(chatId, messageId, specificEmoji = null) {
  for (let i = 0; i < 10; i++) {
    const token = tokens[i];
    if (!token) continue;

    const emojiToUse = specificEmoji || allowedEmojis[Math.floor(Math.random() * allowedEmojis.length)];
    const url = `https://api.telegram.org/bot${token}/setMessageReaction`;

    try {
      await axios.post(url, { chat_id: chatId, message_id: messageId, reaction: [{ type: 'emoji', emoji: emojiToUse }] });
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(`Bot ${i + 1} failed:`, error?.response?.data?.description || error.message);
    }
  }

  console.log("First 10 done. Waiting 1 minute before next batch...");
  await new Promise(resolve => setTimeout(resolve, 60000));

  for (let i = 10; i < 20; i++) {
    const token = tokens[i];
    if (!token) continue;

    const emojiToUse = specificEmoji || allowedEmojis[Math.floor(Math.random() * allowedEmojis.length)];
    const url = `https://api.telegram.org/bot${token}/setMessageReaction`;

    try {
      await axios.post(url, { chat_id: chatId, message_id: messageId, reaction: [{ type: 'emoji', emoji: emojiToUse }] });
      await new Promise(resolve => setTimeout(resolve, 1500)); 
    } catch (error) {
      console.error(`Bot ${i + 1} failed:`, error?.response?.data?.description || error.message);
    }
  }
}

// Start 1-week expiration timer for pinning mode
function startWeekTimer(chatId) {
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  return setTimeout(() => {
    listenerBot.sendMessage(chatId, "you still wanna use 1 or change it to 2 hour ok");
    groupPinModes.delete(chatId); // Deactivates pin mode after 1 week
  }, oneWeekMs);
}

listenerBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const senderUsername = msg.from?.username?.toLowerCase();
  const chatType = msg.chat.type;

  const isAdmin = adminUsernames.includes(senderUsername);

  // --- 1. ADMIN COMMANDS (AUTO-REACT SETUP IN PRIVATE CHAT) ---
  if (chatType === 'private' && isAdmin) {
    if (text === '/start') {
      currentAction = 'add';
      return listenerBot.sendMessage(chatId, "Boss, send the username of the group (e.g., @mygroup) to ADD to the auto-react list.");
    }
    if (text === '/cancel') {
      currentAction = 'cancel';
      return listenerBot.sendMessage(chatId, "Boss, send the username of the group you want to REMOVE from the auto-react list.");
    }
    if (text === '/check') {
      currentAction = null; 
      if (activeGroups.size === 0) return listenerBot.sendMessage(chatId, "The bots are currently NOT active in any groups.");
      const groupList = Array.from(activeGroups).map(g => `@${g}`).join('\n');
      return listenerBot.sendMessage(chatId, `Currently active in these groups:\n${groupList}`);
    }
    if (text.toLowerCase() === '/react' || text.toLowerCase() === 'react') {
      currentAction = 'react_link';
      return listenerBot.sendMessage(chatId, "Send me the Telegram message link to react to.\n(Format: https://t.me/groupname/123)");
    }

    if (currentAction && !text.startsWith('/')) {
      if (currentAction === 'add') {
        const groupName = text.replace('@', '').toLowerCase();
        activeGroups.add(groupName);
        currentAction = null;
        return listenerBot.sendMessage(chatId, `✅ Added! Bots will now auto-react in @${groupName}.`);
      }
      if (currentAction === 'cancel') {
        const groupName = text.replace('@', '').toLowerCase();
        if (activeGroups.has(groupName)) {
          activeGroups.delete(groupName);
          currentAction = null;
          return listenerBot.sendMessage(chatId, `🛑 Canceled. Bots will no longer react in @${groupName}.`);
        } else {
          return listenerBot.sendMessage(chatId, `I couldn't find @${groupName} in the active list. Type /check to see active groups.`);
        }
      }
      if (currentAction === 'react_link') {
        const linkRegex = /t\.me\/(?:c\/)?([a-zA-Z0-9_]+)\/(\d+)/;
        const match = text.match(linkRegex);
        if (match) {
          let targetChatId = match[1];
          if (/^\d+$/.test(targetChatId)) targetChatId = `-100${targetChatId}`; 
          else targetChatId = `@${targetChatId}`;
          pendingReactChatId = targetChatId;
          pendingReactMessageId = match[2];
          currentAction = 'react_emoji'; 
          return listenerBot.sendMessage(chatId, "Link saved! Now send me the ONE specific emoji you want all bots to use (e.g., ❤️ or 😂).\n\nOr type 'random' to use the default mixed emojis.");
        } else {
          return listenerBot.sendMessage(chatId, "Invalid link format. Try again with /react.");
        }
      }
      if (currentAction === 'react_emoji') {
        currentAction = null;
        let chosenEmoji = text.trim();
        if (chosenEmoji.toLowerCase() === 'random') chosenEmoji = null;
        listenerBot.sendMessage(chatId, `Command accepted! Kiara is deploying staggered reactions...`);
        triggerReactions(pendingReactChatId, pendingReactMessageId, chosenEmoji)
          .then(() => listenerBot.sendMessage(chatId, "✅ All staggered reactions finished!"))
          .catch(() => listenerBot.sendMessage(chatId, "⚠️ Finished, but check Render logs for any failures."));
        return;
      }
    }
  }

  // --- 2. ADMIN PIN COMMANDS (CAN BE USED DIRECTLY IN GROUPS) ---
  if (isAdmin && text.startsWith('/ciarapin')) {
    if (groupPinModes.has(chatId)) clearTimeout(groupPinModes.get(chatId).weekTimer);

    if (text === '/ciarapin1') {
      const weekTimer = startWeekTimer(chatId);
      groupPinModes.set(chatId, { type: 1, weekTimer });
      return listenerBot.sendMessage(chatId, `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for an Hour <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>)`, { parse_mode: 'HTML' });
    }
    
    if (text === '/ciarapin2') {
      const weekTimer = startWeekTimer(chatId);
      groupPinModes.set(chatId, { type: 2, weekTimer });
      return listenerBot.sendMessage(chatId, `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for 2 hour then <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>)`, { parse_mode: 'HTML' });
    }
  }

  if (isAdmin && text === '/cancelpin') {
    if (groupPinModes.has(chatId)) {
      clearTimeout(groupPinModes.get(chatId).weekTimer);
      groupPinModes.delete(chatId);
      return listenerBot.sendMessage(chatId, "Pinning mode cancelled.");
    }
  }

  // --- 3. AUTO-REACTION & AUTO-PIN LOGIC FOR GROUPS ---
  if (chatType === 'group' || chatType === 'supergroup') {
    
    // Auto-React
    const currentGroupUsername = msg.chat.username?.toLowerCase();
    if (currentGroupUsername && activeGroups.has(currentGroupUsername)) {
      triggerReactions(chatId, msg.message_id); 
    }

    // Auto-Pin Non-Admin Posts
    if (groupPinModes.has(chatId) && !text.startsWith('/')) {
      const pinMode = groupPinModes.get(chatId);

      try {
        const member = await listenerBot.getChatMember(chatId, msg.from.id);
        
        // Only pin if user is NOT an admin or creator
        if (member.status !== 'administrator' && member.status !== 'creator') {
          
          await listenerBot.pinChatMessage(chatId, msg.message_id);
          
          await listenerBot.sendMessage(chatId, `your post is pinned for ${pinMode.type} hour enjoy <tg-emoji emoji-id="5845860062232318025">🔥</tg-emoji>`, {
            reply_to_message_id: msg.message_id,
            parse_mode: 'HTML'
          });

          // Unpin automatically after 1 or 2 hours
          const unpinDelayMs = pinMode.type * 60 * 60 * 1000;
          setTimeout(() => {
            listenerBot.unpinChatMessage(chatId, msg.message_id).catch(() => {});
          }, unpinDelayMs);
        }
      } catch (err) {
        console.error("Failed to pin message or fetch chat member. Ensure bot is an Admin.", err.message);
      }
    }
  }
});
