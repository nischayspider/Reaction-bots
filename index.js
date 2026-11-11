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

// NEW: Multiple Admins
const admins = ['disturbor', 'madciara'];

// NEW: Auto-Pin State Management (Tracks per group)
// Structure: { chatId: { durationHours: 1|2, expiry: timestamp } }
let autoPinGroups = {}; 

console.log("Kiara Main Listener is online...");

// Reaction Logic with Custom Emoji Support & 1-Minute Delay
async function triggerReactions(chatId, messageId, specificEmoji = null) {
  // 1. First 10 Bots React (Bots 1-10)
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

  // 2. Wait exactly 1 minute
  console.log("First 10 done. Waiting 1 minute before next batch...");
  await new Promise(resolve => setTimeout(resolve, 60000));

  // 3. Last 10 Bots React (Bots 11-20)
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

listenerBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const senderUsername = msg.from?.username?.toLowerCase();
  const chatType = msg.chat.type;
  
  const isAdmin = admins.includes(senderUsername);

  // --- 1. ADMIN COMMANDS IN PRIVATE CHAT (Reactions Setup) ---
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
      if (activeGroups.size === 0) {
        return listenerBot.sendMessage(chatId, "The bots are currently NOT active in any groups.");
      }
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

      // STEP 1 of /react: Process the link
      if (currentAction === 'react_link') {
        const linkRegex = /t\.me\/(?:c\/)?([a-zA-Z0-9_]+)\/(\d+)/;
        const match = text.match(linkRegex);

        if (match) {
          let targetChatId = match[1];
          const targetMessageId = match[2];

          if (/^\d+$/.test(targetChatId)) {
            targetChatId = `-100${targetChatId}`; 
          } else {
            targetChatId = `@${targetChatId}`;
          }

          pendingReactChatId = targetChatId;
          pendingReactMessageId = targetMessageId;
          currentAction = 'react_emoji'; 

          return listenerBot.sendMessage(chatId, "Link saved! Now send me the ONE specific emoji you want all bots to use (e.g., ❤️ or 😂).\n\nOr type 'random' to use the default mixed emojis.");
        } else {
          return listenerBot.sendMessage(chatId, "Invalid link format. Try again with /react.");
        }
      }

      // STEP 2 of /react: Process the custom emoji and trigger
      if (currentAction === 'react_emoji') {
        currentAction = null;
        let chosenEmoji = text.trim();
        if (chosenEmoji.toLowerCase() === 'random') {
          chosenEmoji = null; 
        }

        listenerBot.sendMessage(chatId, `Command accepted! Kiara is deploying staggered reactions...`);
        triggerReactions(pendingReactChatId, pendingReactMessageId, chosenEmoji)
          .then(() => listenerBot.sendMessage(chatId, "✅ All staggered reactions finished!"))
          .catch(() => listenerBot.sendMessage(chatId, "⚠️ Finished, but check Render logs for any failures."));
        return;
      }
    }
  }

  // --- 2. PIN COMMANDS (Allowed in Groups or Private, but intended for Groups) ---
  if (isAdmin) {
    if (text.startsWith('/ciarapin1')) {
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      autoPinGroups[chatId] = { durationHours: 1, expiry: Date.now() + oneWeekMs };
      
      const reply = `<tg-emoji emoji-id="5362034620562940839">👑</tg-emoji> Next post will be pinned for an Hour <tg-emoji emoji-id="5274126849151101077">⭐</tg-emoji> (except admins then premium <tg-emoji emoji-id="6314110509377398413">🌟</tg-emoji>)`;
      return listenerBot.sendMessage(chatId, reply, { parse_mode: 'HTML' });
    }

    if (text.startsWith('/ciarapin2')) {
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      autoPinGroups[chatId] = { durationHours: 2, expiry: Date.now() + oneWeekMs };
      
      const reply = `<tg-emoji emoji-id="5362034620562940839">👑</tg-emoji> Next post will be pinned for 2 hour then <tg-emoji emoji-id="5274126849151101077">⭐</tg-emoji> (except admins premium <tg-emoji emoji-id="6314110509377398413">🌟</tg-emoji>)`;
      return listenerBot.sendMessage(chatId, reply, { parse_mode: 'HTML' });
    }

    if (text.startsWith('/cancelpin')) {
      if (autoPinGroups[chatId]) {
        delete autoPinGroups[chatId];
        return listenerBot.sendMessage(chatId, "🛑 Auto-pinning has been disabled for this chat.");
      }
    }
  }

  // --- 3. AUTO-REACTION & AUTO-PIN LOGIC FOR GROUPS ---
  if (chatType === 'group' || chatType === 'supergroup') {
    const currentGroupUsername = msg.chat.username?.toLowerCase();
    
    // Check Auto-Reaction
    if (currentGroupUsername && activeGroups.has(currentGroupUsername)) {
      triggerReactions(chatId, msg.message_id); 
    }

    // Check Auto-Pin Logic
    if (autoPinGroups[chatId]) {
      const pinSettings = autoPinGroups[chatId];
      
      // Check if 1 week has passed
      if (Date.now() > pinSettings.expiry) {
        delete autoPinGroups[chatId];
        return listenerBot.sendMessage(chatId, "Your 1-week pin session ended. Do you still wanna use /ciarapin1 or change it to /ciarapin2 ok?");
      }

      // Process pinning if sender is NOT an admin
      try {
        const chatMember = await listenerBot.getChatMember(chatId, msg.from.id);
        const isGroupAdmin = ['creator', 'administrator'].includes(chatMember.status);

        if (!isGroupAdmin) {
          // Pin the message
          await listenerBot.pinChatMessage(chatId, msg.message_id);
          
          // Send instant reply
          const replyText = `your post is pinned for ${pinSettings.durationHours} hour enjoy <tg-emoji emoji-id="5845860062232318025">📌</tg-emoji>`;
          await listenerBot.sendMessage(chatId, replyText, { 
            parse_mode: 'HTML', 
            reply_to_message_id: msg.message_id 
          });

          // Schedule unpinning
          const unpinDelayMs = pinSettings.durationHours * 60 * 60 * 1000;
          setTimeout(() => {
            listenerBot.unpinChatMessage(chatId, { message_id: msg.message_id })
              .catch(err => console.log("Failed to unpin message (might already be unpinned):", err.message));
          }, unpinDelayMs);
        }
      } catch (error) {
        console.error("Auto-pin logic failed (check bot permissions):", error.message);
      }
    }
  }
});
