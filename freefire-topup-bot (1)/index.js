require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { runTopup } = require('./garenaAutomation');
const { parseVoucher } = require('./utils');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// States for each user: store current step and data
const users = {};

// Welcome image path
const WELCOME_IMAGE_PATH = path.join(__dirname, 'welcome.jpg'); // You should add an image here

// Free Fire top-up amounts with callback_data
const topUpOptions = [
  [{ text: "25 Diamond", callback_data: "amount_25" }],
  [{ text: "50 Diamond", callback_data: "amount_50" }],
  [{ text: "115 Diamond", callback_data: "amount_115" }],
  [{ text: "240 Diamond", callback_data: "amount_240" }],
  [{ text: "610 Diamond", callback_data: "amount_610" }],
  [{ text: "1240 Diamond", callback_data: "amount_1240" }],
  [{ text: "2530 Diamond", callback_data: "amount_2530" }],
  [{ text: "Weekly Membership", callback_data: "amount_weekly" }],
  [{ text: "Monthly Membership", callback_data: "amount_monthly" }],
];

// Payment options buttons
const paymentOptions = [
  [{ text: "UniPin Voucher", callback_data: "pay_unipin" }],
  [{ text: "UP Gift Card", callback_data: "pay_upcard" }],
];

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  users[chatId] = { step: 'waiting_uid' };

  // Send welcome image with message
  bot.sendPhoto(chatId, WELCOME_IMAGE_PATH, {
    caption: "Welcome to Free Fire Top-up Bot!\nPlease send your Free Fire UID to proceed."
  });
});

// Listen for text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!users[chatId]) {
    return bot.sendMessage(chatId, 'Please use /start to begin.');
  }

  const state = users[chatId];

  // Step: Waiting for UID
  if (state.step === 'waiting_uid') {
    if (!text || !/^\d{8,}$/.test(text)) {
      return bot.sendMessage(chatId, 'Please send a valid numeric Free Fire UID (at least 8 digits).');
    }
    state.uid = text;
    state.step = 'waiting_amount';

    // Show top-up amounts
    return bot.sendMessage(chatId, `UID received: ${text}\nSelect Amount:`, {
      reply_markup: { inline_keyboard: topUpOptions }
    });
  }

  // Step: Waiting for voucher Serial+PIN
  if (state.step === 'waiting_voucher') {
    if (!text) return bot.sendMessage(chatId, 'Please send the Serial + PIN.');

    const { serial, pin } = parseVoucher(text);
    if (serial.length !== 14 || pin.length !== 16) {
      return bot.sendMessage(chatId, 'Invalid Serial or PIN format. Please send again.');
    }

    state.serial = serial;
    state.pin = pin;

    bot.sendMessage(chatId, 'Processing your top-up, please wait...');

    try {
      const result = await runTopup(state.uid, state.amount, state.paymentMethod, serial, pin);

      if (result.success) {
        await bot.sendPhoto(chatId, result.screenshotBuffer, {
          caption: `Top-up successful!\nUID: ${state.uid}\nAmount: ${state.amountText}\nPayment: ${state.paymentMethod === 'pay_unipin' ? 'UniPin Voucher' : 'UP Gift Card'}`
        });
      } else {
        bot.sendMessage(chatId, `Failed: ${result.error}`);
      }
    } catch (error) {
      bot.sendMessage(chatId, `An error occurred: ${error.message}`);
    }

    // Reset conversation
    delete users[chatId];
    return;
  }
});

// Callback query handler for inline buttons (amount + payment)
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (!users[chatId]) {
    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Please start with /start' });
  }

  const state = users[chatId];

  // Amount selection
  if (data.startsWith('amount_') && state.step === 'waiting_amount') {
    state.amount = data;
    state.amountText = callbackQuery.message.reply_markup?.inline_keyboard
      ?.flat()
      .find(b => b.callback_data === data)?.text || data;
    state.step = 'waiting_payment';

    await bot.editMessageText(`Amount selected: ${state.amountText}\nSelect Payment Channel:`, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: { inline_keyboard: paymentOptions }
    });

    return bot.answerCallbackQuery(callbackQuery.id);
  }

  // Payment method selection
  if ((data === 'pay_unipin' || data === 'pay_upcard') && state.step === 'waiting_payment') {
    state.paymentMethod = data;
    state.step = 'waiting_voucher';

    await bot.editMessageText(`Payment method selected: ${data === 'pay_unipin' ? 'UniPin Voucher' : 'UP Gift Card'}\n\nPlease send your Serial and PIN voucher.\nExample:\nBD123456789012+ABCD-EFGH-IJKL-MNOP`, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
    });

    return bot.answerCallbackQuery(callbackQuery.id);
  }

  bot.answerCallbackQuery(callbackQuery.id, { text: 'Invalid action or out of sequence' });
});