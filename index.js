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

// NEW: Broadcast State
let broadcastMessageIds = new Map(); 

// --- ADMIN SECURITY ---
const adminUsernames = ['disturbor', 'madciara'];
const adminIds = [6146191046, 206240767]; 
const groupPinModes = new Map(); 
const groupActionState = new Map(); // Tracks group-specific conversations like /time

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
    const mode = groupPinModes.get(chatId);
    if (mode && mode.refreshTimer) clearInterval(mode.refreshTimer); // Clear auto-refresh if week expires
    groupPinModes.delete(chatId); 
  }, oneWeekMs);
}

listenerBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const chatType = msg.chat.type;

  const rawUsername = msg.from?.username || '';
  const senderUsername = rawUsername.replace('@', '').toLowerCase();
  const senderId = msg.from?.id;

  const isAdmin = adminUsernames.includes(senderUsername) || adminIds.includes(senderId);
  const isDisturbor = senderUsername === 'disturbor' || senderId === 6146191046; 

  if (chatType === 'private') {
    console.log(`[DM Received] ID: ${senderId} | Username: ${senderUsername || 'NONE SET'} | IsAdmin: ${isAdmin}`);
  }

  // --- 1. ADMIN COMMANDS (PRIVATE CHAT ONLY) ---
  if (chatType === 'private' && isAdmin) {
    
    if (text === '/make') {
      if (!isDisturbor) return listenerBot.sendMessage(chatId, "❌ Only @disturbor can use the /make command.");
      currentAction = 'make_broadcast';
      return listenerBot.sendMessage(chatId, "Boss, send the paragraph you want to broadcast. I will send it to all active groups.");
    }

    if (text === '/remove') {
      if (!isDisturbor) return listenerBot.sendMessage(chatId, "❌ Only @disturbor can use the /remove command.");
      if (broadcastMessageIds.size === 0) return listenerBot.sendMessage(chatId, "No active broadcast found to remove.");
      
      let deletedCount = 0;
      for (const [groupName, msgId] of broadcastMessageIds.entries()) {
        try {
          await listenerBot.deleteMessage(`@${groupName}`, msgId);
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete broadcast in @${groupName}`, err.message);
        }
      }
      broadcastMessageIds.clear(); 
      return listenerBot.sendMessage(chatId, `🗑️ Broadcast successfully removed from ${deletedCount} groups.`);
    }

    if (currentAction === 'make_broadcast' && !text.startsWith('/')) {
      if (!isDisturbor) return; 
      currentAction = null;
      broadcastMessageIds.clear(); 

      if (activeGroups.size === 0) {
        return listenerBot.sendMessage(chatId, "You haven't added any groups to the active list yet! Use /start first.");
      }

      let successCount = 0;
      const broadcastText = `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> ${text}`;
      listenerBot.sendMessage(chatId, `Deploying broadcast to ${activeGroups.size} groups...`);

      for (const group of activeGroups) {
        try {
          const sentMsg = await listenerBot.sendMessage(`@${group}`, broadcastText, { parse_mode: 'HTML' });
          broadcastMessageIds.set(group, sentMsg.message_id); 
          successCount++;
        } catch (error) {
          console.error(`Failed to broadcast to @${group}:`, error.message);
        }
      }
      return listenerBot.sendMessage(chatId, `✅ Broadcast successfully sent to ${successCount} groups! Type /remove to delete them all.`);
    }

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
          return listenerBot.sendMessage(chatId, `I couldn't find @${groupName} in the active list.`);
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

  // --- 2. ADMIN PIN & TIME COMMANDS (DIRECTLY IN GROUPS) ---
  if ((chatType === 'group' || chatType === 'supergroup') && isAdmin) {
    
    // NEW: /time Refresh Command
    if (text === '/time') {
      if (!groupPinModes.has(chatId)) return listenerBot.sendMessage(chatId, "Activate /ciarapin1 or /ciarapin2 first!");
      groupActionState.set(chatId, 'awaiting_time');
      return listenerBot.sendMessage(chatId, "How many minutes?");
    }

    // Processing the /time minutes reply
    if (groupActionState.get(chatId) === 'awaiting_time' && !text.startsWith('/')) {
      const mins = parseInt(text.trim());
      if (isNaN(mins) || mins <= 0) return listenerBot.sendMessage(chatId, "Please send a valid number of minutes.");
      
      groupActionState.delete(chatId);
      const pinMode = groupPinModes.get(chatId);
      
      // Clear old timer if setting a new one
      if (pinMode.refreshTimer) clearInterval(pinMode.refreshTimer);
      
      // Background loop for deleting and re-sending
      pinMode.refreshTimer = setInterval(async () => {
        const currentMode = groupPinModes.get(chatId);
        
        // If slot is claimed (null) or mode cancelled, pause and do nothing this cycle
        if (!currentMode || !currentMode.announcementMsgId) return; 
        
        // Delete old
        listenerBot.deleteMessage(chatId, currentMode.announcementMsgId).catch(() => {});
        
        // Send new
        const announcementText = currentMode.type === 1 
             ? `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for an Hour <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>)`
             : `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for 2 hour then <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>)`;
             
        try {
          const newAnnouncement = await listenerBot.sendMessage(chatId, announcementText, { parse_mode: 'HTML' });
          currentMode.announcementMsgId = newAnnouncement.message_id;
        } catch (err) {
          console.error("Failed to refresh announcement.", err.message);
        }
      }, mins * 60 * 1000);
      
      return listenerBot.sendMessage(chatId, `✅ Announcement will now refresh every ${mins} minute(s) until someone posts!`);
    }

    if (text === '/ciarapin1') {
      if (groupPinModes.has(chatId)) {
        clearTimeout(groupPinModes.get(chatId).weekTimer);
        if (groupPinModes.get(chatId).refreshTimer) clearInterval(groupPinModes.get(chatId).refreshTimer);
      }
      const weekTimer = startWeekTimer(chatId);
      const announcement = await listenerBot.sendMessage(chatId, `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for an Hour <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>)`, { parse_mode: 'HTML' });
      groupPinModes.set(chatId, { type: 1, weekTimer, announcementMsgId: announcement.message_id });
      return;
    }
    
    if (text === '/ciarapin2') {
      if (groupPinModes.has(chatId)) {
        clearTimeout(groupPinModes.get(chatId).weekTimer);
        if (groupPinModes.get(chatId).refreshTimer) clearInterval(groupPinModes.get(chatId).refreshTimer);
      }
      const weekTimer = startWeekTimer(chatId);
      const announcement = await listenerBot.sendMessage(chatId, `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for 2 hour then <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>)`, { parse_mode: 'HTML' });
      groupPinModes.set(chatId, { type: 2, weekTimer, announcementMsgId: announcement.message_id });
      return;
    }

    if (text === '/cancelpin') {
      if (groupPinModes.has(chatId)) {
        const pinMode = groupPinModes.get(chatId);
        clearTimeout(pinMode.weekTimer);
        if (pinMode.refreshTimer) clearInterval(pinMode.refreshTimer); // Kill the background loop
        groupPinModes.delete(chatId);
        return listenerBot.sendMessage(chatId, "Pinning mode cancelled.");
      }
    }
  }

  // --- 3. AUTO-REACTION & AUTO-PIN LOGIC FOR GROUPS ---
  if (chatType === 'group' || chatType === 'supergroup') {
    
    const currentGroupUsername = msg.chat.username?.toLowerCase();
    
    if (currentGroupUsername && activeGroups.has(currentGroupUsername)) {
      triggerReactions(chatId, msg.message_id); 
    }

    if (groupPinModes.has(chatId) && !text.startsWith('/')) {
      const pinMode = groupPinModes.get(chatId);

      try {
        const member = await listenerBot.getChatMember(chatId, msg.from.id);
        
        if (member.status !== 'administrator' && member.status !== 'creator' && pinMode.announcementMsgId) {
          
          await listenerBot.pinChatMessage(chatId, msg.message_id);

          listenerBot.deleteMessage(chatId, pinMode.announcementMsgId).catch(() => {});
          pinMode.announcementMsgId = null; // Claims slot (this auto-pauses the /time refresh loop)
          
          const replyMsg = await listenerBot.sendMessage(chatId, `your post is pinned for ${pinMode.type} hour enjoy <tg-emoji emoji-id="5845860062232318025">🔥</tg-emoji>`, {
            reply_to_message_id: msg.message_id,
            parse_mode: 'HTML'
          });

          setTimeout(() => {
            listenerBot.deleteMessage(chatId, replyMsg.message_id).catch(() => {});
          }, 120000); 

          const unpinDelayMs = pinMode.type * 60 * 60 * 1000;
          
          setTimeout(async () => {
            await listenerBot.unpinChatMessage(chatId, msg.message_id).catch(() => {});
            
            if (groupPinModes.has(chatId)) {
              const currentMode = groupPinModes.get(chatId);
              
              if (!currentMode.announcementMsgId) {
                const announcementText = currentMode.type === 1 
                  ? `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for an Hour <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>)`
                  : `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for 2 hour then <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>)`;
                
                try {
                  const newAnnouncement = await listenerBot.sendMessage(chatId, announcementText, { parse_mode: 'HTML' });
                  currentMode.announcementMsgId = newAnnouncement.message_id; // Re-opens slot (resumes the /time loop)
                } catch (err) {
                  console.error("Failed to re-send announcement.", err.message);
                }
              }
            }
          }, unpinDelayMs);
        }
      } catch (err) {
        console.error("Failed to pin/delete message or fetch chat member.", err.message);
      }
    }
  }
});

// --- ANTI-CRASH SHIELD ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
