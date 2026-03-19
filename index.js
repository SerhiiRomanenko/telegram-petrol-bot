require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const fs = require("fs");
const path = require("path");

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.STRING_SESSION);

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// ==== кеш
let lastFuelData = null;

// ==== Парсинг
function extractFuelPrices(text) {
  if (!text) return null;

  const lines = text.split("\n").map(l => l.trim());

  const startIndex = lines.findIndex(line =>
    line.includes("Середні ціни на пальне")
  );

  if (startIndex === -1) return null;

  let fuelLines = [];

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (!line) continue;
    if (line.includes("Ціни на криптовалюту")) break;
    if (line.startsWith("А-92")) continue;

    fuelLines.push(line);
  }

  return fuelLines.length ? fuelLines : null;
}

// ==== Сортування
function sortFuel(lines) {
  const order = ["ДП","ДП+","А-98","А-95+","А-95","95 Євро5-E5","ГАЗ","AdBlue"];

  return lines.sort((a,b)=>{
    const aKey = order.findIndex(o=>a.startsWith(o));
    const bKey = order.findIndex(o=>b.startsWith(o));
    return (aKey===-1?999:aKey) - (bKey===-1?999:bKey);
  });
}

// ==== Telegram client (створюємо один раз)
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

// ==== Підключення
async function initClient() {
  await client.connect();
  console.log("✅ MTProto підключено");
}

// ==== Отримання пального
async function getFuel() {
  try {
    const messages = await client.getMessages("moneymaker_od", { limit: 10 });

    for (let msg of messages) {
      if (!msg.message) continue;

      const fuel = extractFuelPrices(msg.message);
      if (fuel) return sortFuel(fuel);
    }

    return null;
  } catch (err) {
    console.error("❌ Помилка MTProto:", err);
    return null;
  }
}

// ==== Формування повідомлення
function buildFuelMessage(fuelLines, isFallback = false) {
  return (
    `🛢️ <b>СЕРЕДНІ ЦІНИ НА ПАЛЬНЕ</b>\n\n` +
    fuelLines.join("\n") +
    (isFallback ? `\n\n⚠️ <i>Останні доступні дані</i>` : "")
  );
}

// ==== Відправка
async function sendFuel() {
  console.log("⏰ Отримуємо пальне...");

  let fuel = await getFuel();
  let isFallback = false;

  if (!fuel && lastFuelData) {
    console.log("⚠️ Використовуємо fallback");
    fuel = lastFuelData;
    isFallback = true;
  }

  if (!fuel) {
    console.log("❌ Не знайдено навіть fallback");
    return;
  }

  // ==== Вибираємо випадкову картинку
  const imagesFolder = path.join(__dirname, "images");
  const images = ["1.jpg", "2.jpg"].map(f => path.join(imagesFolder, f));
  const randomImage = images[Math.floor(Math.random() * images.length)];

  // ==== Відправляємо текст + картинку
  await bot.sendPhoto(
    CHAT_ID,
    randomImage,
    {
      caption: buildFuelMessage(fuel, isFallback),
      parse_mode: "HTML"
    }
  );

  lastFuelData = fuel;
  console.log("✅ Відправлено з випадковою картинкою");
}

// ==== Таймер (10:20 Київ)
let lastSentDate = null;

setInterval(async () => {
  const now = new Date();
  const kyivTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Kyiv" })
  );

  const hours = kyivTime.getHours();
  const minutes = kyivTime.getMinutes();
  const today = kyivTime.toISOString().split("T")[0];

  if (hours === 10 && minutes === 20 && lastSentDate !== today) {
    await sendFuel();
    lastSentDate = today;
  }
}, 60 * 1000);

// ==== Сервер
const app = express();
app.get("/", (req, res) => res.send("Бот працює 🚀"));

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Сервер запущено на порту ${PORT}`);
  await initClient();

  // тест при запуску
  await sendFuel();
});