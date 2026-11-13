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

// Custom Default Emojis for Reactions
const allowedEmojis = ['💋', '⚡', '😭', '😁', '💘', '❤️', '🍓', '❤️‍🔥', '😂'];

// --- CUTE CIARA LINES & EMOJIS ---
const cuteLines = [
  "Fun fact: The name Ciara means 'dark-haired' or 'bright and shining' in Irish, and she definitely lights up every room she walks into!",
  "this Ciara is the kind of person whose smile can instantly turn a bad day into the best day ever",
  "Warning: Hanging out with Ciara may cause excessive smiling, uncontrollable laughter, and instant happiness",
  "Everyone needs a Ciara in their life—she has the purest heart and the best energy",
  "If kindness and cuteness were a person, their name would definitely be Ciara",
  "Ciara isn't just a pretty name; she's literally everyone's favorite person to be around"
];

const premiumCuteEmojis = [
  "5792166502811571030", "5792016234790785290", "5791912352416798142", 
  "5792101077574751961", "5792000665534337611", "5792133470218097977", 
  "5794440108174217537", "5791945161671973018", "5791992127139353477", 
  "5791728935838423081", "5794222529425973097"
];

function getRandomCuteLine() {
  const line = cuteLines[Math.floor(Math.random() * cuteLines.length)];
  const e1 = premiumCuteEmojis[Math.floor(Math.random() * premiumCuteEmojis.length)];
  const e2 = premiumCuteEmojis[Math.floor(Math.random() * premiumCuteEmojis.length)];
  return `<tg-emoji emoji-id="${e1}">✨</tg-emoji> ${line} @madciara :) <tg-emoji emoji-id="${e2}">✨</tg-emoji>`;
}

// --- STATE MANAGEMENT ---
let reactionGroups = new Set(); // For 20-bot auto reactions
let broadcastGroups = new Set(); // For /make and /cute broadcasts
let currentAction = null; 
let pendingReactChatId = null;
let pendingReactMessageId = null;
let broadcastMessageIds = new Map(); 

// --- ADMIN SECURITY ---
const adminUsernames = ['disturbor', 'madciara'];
const adminIds = [6146191046, 206240767]; 
const groupPinModes = new Map(); 
const groupActionState = new Map(); 

// Premium Text Templates
const getAnnouncementText = (type) => {
  if (type === 1) {
    return `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for an Hour <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>) made by cute @madciara <tg-emoji emoji-id="6314110509377398413">✅</tg-emoji>`;
  } else {
    return `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> Next post will be pinned for 2 hour <tg-emoji emoji-id="5274126849151101077">📌</tg-emoji> (except admins <tg-emoji emoji-id="6314110509377398413">👑</tg-emoji>) made by cute @madciara <tg-emoji emoji-id="6314110509377398413">✅</tg-emoji>`;
  }
};

console.log("Kiara Main Listener is online...");

// --- BUTTON CALLBACKS FOR /ciaradelete ---
listenerBot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  const senderUsername = (query.from.username || '').replace('@', '').toLowerCase();
  const senderId = query.from.id;
  const isAdmin = adminUsernames.includes(senderUsername) || adminIds.includes(senderId);

  if (!isAdmin) {
    return listenerBot.answerCallbackQuery(query.id, { text: "❌ Only admins can click this.", show_alert: true });
  }

  // MASS PURGE EXECUTION
  if (data.startsWith('del_yes_')) {
    const parts = data.split('_');
    const targetMsgId = parseInt(parts[2]);
    const commandMsgId = parseInt(parts[3]);
    
    listenerBot.answerCallbackQuery(query.id, { text: "Deleting all messages..." });

    // Loops through and deletes everything from the target message up to the command
    for (let i = targetMsgId; i <= commandMsgId; i++) {
      listenerBot.deleteMessage(chatId, i).catch(() => {});
    }
    listenerBot.deleteMessage(chatId, query.message.message_id).catch(() => {}); // Deletes the yes/no prompt

  } else if (data.startsWith('del_no_')) {
    try {
      await listenerBot.deleteMessage(chatId, query.message.message_id); 
      listenerBot.answerCallbackQuery(query.id, { text: "Cancelled." });
    } catch (err) {}
  }
});

// --- REACTION SYSTEM ---
async function triggerReactions(chatId, messageId, specificEmoji = null) {
  for (let i = 0; i < 10; i++) {
    const token = tokens[i];
    if (!token) continue;
    const emojiToUse = specificEmoji || allowedEmojis[Math.floor(Math.random() * allowedEmojis.length)];
    try {
      await axios.post(`https://api.telegram.org/bot${token}/setMessageReaction`, { chat_id: chatId, message_id: messageId, reaction: [{ type: 'emoji', emoji: emojiToUse }] });
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {}
  }

  await new Promise(resolve => setTimeout(resolve, 60000));

  for (let i = 10; i < 20; i++) {
    const token = tokens[i];
    if (!token) continue;
    const emojiToUse = specificEmoji || allowedEmojis[Math.floor(Math.random() * allowedEmojis.length)];
    try {
      await axios.post(`https://api.telegram.org/bot${token}/setMessageReaction`, { chat_id: chatId, message_id: messageId, reaction: [{ type: 'emoji', emoji: emojiToUse }] });
      await new Promise(resolve => setTimeout(resolve, 1500)); 
    } catch (error) {}
  }
}

function startWeekTimer(chatId) {
  return setTimeout(() => {
    listenerBot.sendMessage(chatId, "you still wanna use 1 or change it to 2 hour ok");
    const mode = groupPinModes.get(chatId);
    if (mode && mode.refreshTimer) clearInterval(mode.refreshTimer); 
    groupPinModes.delete(chatId); 
  }, 7 * 24 * 60 * 60 * 1000);
}

listenerBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const chatType = msg.chat.type;
  const senderUsername = (msg.from?.username || '').replace('@', '').toLowerCase();
  const senderId = msg.from?.id;

  const isAdmin = adminUsernames.includes(senderUsername) || adminIds.includes(senderId);
  const isDisturbor = senderUsername === 'disturbor' || senderId === 6146191046; 

  // --- 1. ADMIN PRIVATE COMMANDS ---
  if (chatType === 'private' && isAdmin) {
    if (text === '/cute') {
      if (!isDisturbor) return listenerBot.sendMessage(chatId, "❌ Only @disturbor can use the /cute command.");
      if (broadcastGroups.size === 0) return listenerBot.sendMessage(chatId, "No active groups found to broadcast to.");
      
      const cuteBroadcast = getRandomCuteLine();
      listenerBot.sendMessage(chatId, "Broadcasting Ciara cuteness to all active groups!");
      
      for (const group of broadcastGroups) {
        try { await listenerBot.sendMessage(`@${group}`, cuteBroadcast, { parse_mode: 'HTML' }); } catch (error) {}
      }
      return;
    }

    if (text === '/make') {
      if (!isDisturbor) return listenerBot.sendMessage(chatId, "❌ Only @disturbor can use the /make command.");
      currentAction = 'make_broadcast';
      return listenerBot.sendMessage(chatId, "Boss, send the paragraph you want to broadcast.");
    }
    if (text === '/remove') {
      if (!isDisturbor) return listenerBot.sendMessage(chatId, "❌ Only @disturbor can use the /remove command.");
      if (broadcastMessageIds.size === 0) return listenerBot.sendMessage(chatId, "No active broadcast found.");
      for (const [groupName, msgId] of broadcastMessageIds.entries()) {
        try { await listenerBot.deleteMessage(`@${groupName}`, msgId); } catch (err) {}
      }
      broadcastMessageIds.clear(); 
      return listenerBot.sendMessage(chatId, `🗑️ Broadcast removed from all groups.`);
    }
    if (currentAction === 'make_broadcast' && !text.startsWith('/')) {
      if (!isDisturbor) return; 
      currentAction = null;
      broadcastMessageIds.clear(); 
      if (broadcastGroups.size === 0) return listenerBot.sendMessage(chatId, "No active broadcast groups.");
      
      const broadcastText = `<tg-emoji emoji-id="5362034620562940839">💎</tg-emoji> ${text}`;
      listenerBot.sendMessage(chatId, `Deploying broadcast...`);
      for (const group of broadcastGroups) {
        try {
          const sentMsg = await listenerBot.sendMessage(`@${group}`, broadcastText, { parse_mode: 'HTML' });
          broadcastMessageIds.set(group, sentMsg.message_id); 
        } catch (error) {}
      }
      return listenerBot.sendMessage(chatId, `✅ Broadcast sent!`);
    }

    if (text === '/start') {
      currentAction = 'add';
      return listenerBot.sendMessage(chatId, "Send the group username (e.g., @mygroup) to ADD to auto-react and broadcasts.");
    }
    if (text === '/cancel') {
      currentAction = 'cancel';
      return listenerBot.sendMessage(chatId, "Send the group username to REMOVE from all systems.");
    }
    if (text === '/check') {
      currentAction = null; 
      const reactList = Array.from(reactionGroups).map(g => `@${g}`).join(', ') || 'None';
      const broadcastList = Array.from(broadcastGroups).map(g => `@${g}`).join(', ') || 'None';
      return listenerBot.sendMessage(chatId, `**Status:**\nAuto-Reacting In: ${reactList}\nBroadcasting To: ${broadcastList}`, { parse_mode: 'Markdown' });
    }
    if (text.toLowerCase() === '/react' || text.toLowerCase() === 'react') {
      currentAction = 'react_link';
      return listenerBot.sendMessage(chatId, "Send the Telegram message link to react to.");
    }

    if (currentAction && !text.startsWith('/')) {
      const targetGroup = text.replace('@', '').toLowerCase();
      if (currentAction === 'add') {
        reactionGroups.add(targetGroup);
        broadcastGroups.add(targetGroup);
        currentAction = null;
        return listenerBot.sendMessage(chatId, `✅ Added to reactions and broadcasts!`);
      }
      if (currentAction === 'cancel') {
        reactionGroups.delete(targetGroup);
        broadcastGroups.delete(targetGroup);
        currentAction = null;
        return listenerBot.sendMessage(chatId, `🛑 Removed from all systems.`);
      }
      if (currentAction === 'react_link') {
        const match = text.match(/t\.me\/(?:c\/)?([a-zA-Z0-9_]+)\/(\d+)/);
        if (match) {
          pendingReactChatId = /^\d+$/.test(match[1]) ? `-100${match[1]}` : `@${match[1]}`;
          pendingReactMessageId = match[2];
          currentAction = 'react_emoji'; 
          return listenerBot.sendMessage(chatId, "Link saved! Send the ONE specific emoji (or type 'random').");
        } else return listenerBot.sendMessage(chatId, "Invalid link format.");
      }
      if (currentAction === 'react_emoji') {
        currentAction = null;
        triggerReactions(pendingReactChatId, pendingReactMessageId, text.trim().toLowerCase() === 'random' ? null : text.trim());
        return listenerBot.sendMessage(chatId, `Deploying reactions...`);
      }
    }
  }

  // --- 2. GROUP COMMANDS ---
  if (chatType === 'group' || chatType === 'supergroup') {
    
    // EVERYONE COMMAND: stealth cuteciara
    if (text === '/cuteciara') {
      listenerBot.deleteMessage(chatId, msg.message_id).catch(() => {}); // Deletes user command silently
      return listenerBot.sendMessage(chatId, getRandomCuteLine(), { parse_mode: 'HTML' });
    }

    // ADMIN ONLY GROUP COMMANDS
    if (isAdmin) {
      
      // CONNECT GROUP FOR BROADCASTS ONLY
      if (text === '/contact') {
        const currentGroupUsername = msg.chat.username?.toLowerCase();
        if (currentGroupUsername) {
          broadcastGroups.add(currentGroupUsername);
          return listenerBot.sendMessage(chatId, "✅ Group connected for Broadcasts! (Auto-reactions remain OFF)");
        } else {
          return listenerBot.sendMessage(chatId, "⚠️ This group needs a public username (@...) to be connected.");
        }
      }

      if (text === '/ciaradelete') {
        if (!msg.reply_to_message) {
          return listenerBot.sendMessage(chatId, "⚠️ Please reply to the message you want to delete with /ciaradelete");
        }
        const targetMsgId = msg.reply_to_message.message_id;
        return listenerBot.sendMessage(chatId, "Are you sure want to delete the text from replied message?", {
          reply_to_message_id: msg.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔵 Yes', callback_data: `del_yes_${targetMsgId}_${msg.message_id}` },
                { text: '🔴 No', callback_data: `del_no_` }
              ]
            ]
          }
        });
      }

      if (text === '/time') {
        if (!groupPinModes.has(chatId)) return listenerBot.sendMessage(chatId, "Activate /ciarapin1 or /ciarapin2 first!");
        groupActionState.set(chatId, 'awaiting_time');
        return listenerBot.sendMessage(chatId, "How many minutes?");
      }

      if (groupActionState.get(chatId) === 'awaiting_time' && !text.startsWith('/')) {
        const mins = parseInt(text.trim());
        if (isNaN(mins) || mins <= 0) return listenerBot.sendMessage(chatId, "Send a valid number.");
        groupActionState.delete(chatId);
        
        const pinMode = groupPinModes.get(chatId);
        if (pinMode.refreshTimer) clearInterval(pinMode.refreshTimer);
        
        pinMode.refreshTimer = setInterval(async () => {
          const currentMode = groupPinModes.get(chatId);
          if (!currentMode || !currentMode.announcementMsgId) return; 
          
          listenerBot.deleteMessage(chatId, currentMode.announcementMsgId).catch(() => {});
          try {
            const newAnnouncement = await listenerBot.sendMessage(chatId, getAnnouncementText(currentMode.type), { parse_mode: 'HTML' });
            currentMode.announcementMsgId = newAnnouncement.message_id;
          } catch (err) {}
        }, mins * 60 * 1000);
        
        return listenerBot.sendMessage(chatId, `✅ Announcement will refresh every ${mins} minute(s)!`);
      }

      if (text === '/ciarapin1' || text === '/ciarapin2') {
        if (groupPinModes.has(chatId)) {
          clearTimeout(groupPinModes.get(chatId).weekTimer);
          if (groupPinModes.get(chatId).refreshTimer) clearInterval(groupPinModes.get(chatId).refreshTimer);
        }
        const type = text === '/ciarapin1' ? 1 : 2;
        const weekTimer = startWeekTimer(chatId);
        const announcement = await listenerBot.sendMessage(chatId, getAnnouncementText(type), { parse_mode: 'HTML' });
        groupPinModes.set(chatId, { type, weekTimer, announcementMsgId: announcement.message_id });
        return;
      }

      if (text === '/cancelpin') {
        if (groupPinModes.has(chatId)) {
          const pinMode = groupPinModes.get(chatId);
          clearTimeout(pinMode.weekTimer);
          if (pinMode.refreshTimer) clearInterval(pinMode.refreshTimer); 
          groupPinModes.delete(chatId);
          return listenerBot.sendMessage(chatId, "Pinning mode cancelled.");
        }
      }
    }

    // AUTO-REACTION & AUTO-PIN INFINITE LOOP
    const currentGroupUsername = msg.chat.username?.toLowerCase();
    
    // Auto-react ONLY if it's in the reactionGroups list
    if (currentGroupUsername && reactionGroups.has(currentGroupUsername)) {
      triggerReactions(chatId, msg.message_id); 
    }

    if (groupPinModes.has(chatId) && !text.startsWith('/')) {
      const pinMode = groupPinModes.get(chatId);
      try {
        const member = await listenerBot.getChatMember(chatId, msg.from.id);
        
        if (member.status !== 'administrator' && member.status !== 'creator' && pinMode.announcementMsgId) {
          
          await listenerBot.pinChatMessage(chatId, msg.message_id);
          listenerBot.deleteMessage(chatId, pinMode.announcementMsgId).catch(() => {});
          pinMode.announcementMsgId = null; // Pauses the /time refresh
          
          // Send permanent reply (NOT deleted)
          await listenerBot.sendMessage(chatId, `your post is pinned for ${pinMode.type} hour enjoy <tg-emoji emoji-id="5845860062232318025">🔥</tg-emoji>`, {
            reply_to_message_id: msg.message_id,
            parse_mode: 'HTML'
          });

          // Unpin after exact time and instantly restart the loop
          const unpinDelayMs = pinMode.type * 60 * 60 * 1000;
          setTimeout(async () => {
            await listenerBot.unpinChatMessage(chatId, msg.message_id).catch(() => {});
            
            if (groupPinModes.has(chatId)) {
              const currentMode = groupPinModes.get(chatId);
              if (!currentMode.announcementMsgId) {
                try {
                  const newAnnouncement = await listenerBot.sendMessage(chatId, getAnnouncementText(currentMode.type), { parse_mode: 'HTML' });
                  currentMode.announcementMsgId = newAnnouncement.message_id; // Restarts the loop
                } catch (err) {}
              }
            }
          }, unpinDelayMs);
        }
      } catch (err) {}
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
