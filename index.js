require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

// --- 24/7 KEEP-ALIVE SERVER FOR RENDER ---
const app = express();
app.get('/', (req, res) => res.send('Irshaa Bot is running 24/7!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server is awake.'));

// Tokens loaded from environment variables in Render
const tokens = [
  process.env.LISTENER_BOT_TOKEN, // irshaa bot
  process.env.TOKEN_2, process.env.TOKEN_3, process.env.TOKEN_4,
  process.env.TOKEN_5, process.env.TOKEN_6, process.env.TOKEN_7,
  process.env.TOKEN_8, process.env.TOKEN_9, process.env.TOKEN_10
];

const listenerBot = new TelegramBot(tokens[0], { polling: true });
const allowedEmojis = ['⚡', '💅🏻', '😭', '😁', '❤️‍🔥', '❤️️', '❤️', '❤️', '❤️', '❤️'];

let activeGroupUsername = null;
let awaitingGroupInput = false;
const adminUsername = 'disturbor';

console.log("Irshaa listener bot is running...");

listenerBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const senderUsername = msg.from?.username?.toLowerCase();
  const chatType = msg.chat.type;

  // 1. Private chat command by @Disturbor
  if (chatType === 'private') {
    if (text === '/start' && senderUsername === adminUsername) {
      awaitingGroupInput = true;
      return listenerBot.sendMessage(chatId, "Hello Boss! Please send the username of the group (e.g., @mygroup) where you want the bots to react.");
    }

    if (awaitingGroupInput && senderUsername === adminUsername && !text.startsWith('/')) {
      activeGroupUsername = text.replace('@', '').toLowerCase();
      awaitingGroupInput = false;
      return listenerBot.sendMessage(chatId, `Got it! The 10 bots will now react to messages in @${activeGroupUsername}.\n\nPlease ensure all bots are members of that group!`);
    }
  }

  // 2. Reaction logic in the active group
  if (chatType === 'group' || chatType === 'supergroup') {
    const currentGroupUsername = msg.chat.username?.toLowerCase();

    if (activeGroupUsername && currentGroupUsername === activeGroupUsername) {
      const messageId = msg.message_id;

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token) continue; 

        const randomEmoji = allowedEmojis[Math.floor(Math.random() * allowedEmojis.length)];
        const url = `https://api.telegram.org/bot${token}/setMessageReaction`;

        try {
          await axios.post(url, {
            chat_id: chatId,
            message_id: messageId,
            reaction: [{ type: 'emoji', emoji: randomEmoji }]
          });

          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.error(`Bot ${i + 1} failed:`, error.response?.data?.description || error.message);
        }
      }
    }
  }
});
