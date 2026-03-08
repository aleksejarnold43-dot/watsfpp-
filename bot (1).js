// ============================================================
//  WhatsApp AI Бот — whatsapp-web.js + Google Gemini
//  Установка: npm install whatsapp-web.js @google/generative-ai qrcode-terminal dotenv
// ============================================================

require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BOT_NAME       = process.env.BOT_NAME || "Ассистент";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const SYSTEM = `Ты — вежливый и дружелюбный ИИ-ассистент по имени ${BOT_NAME}.
Твои задачи:
1. Отвечать на вопросы клиентов
2. Помогать оформлять заказы и заявки
3. При заказе собирать: имя, что нужно, удобное время
4. Говорить что менеджер скоро свяжется
Стиль: коротко, дружелюбно, без лишних слов.
Язык: отвечай на том языке на котором пишет клиент.`;

const chats = {};

async function askAI(userId, userMessage) {
  if (!chats[userId]) {
    chats[userId] = model.startChat({
      history: [],
      generationConfig: { maxOutputTokens: 500 },
      systemInstruction: SYSTEM,
    });
  }
  try {
    const result = await chats[userId].sendMessage(userMessage);
    return result.response.text();
  } catch (e) {
    console.error("❌ AI ошибка:", e.message);
    return "Извините, произошла ошибка. Попробуйте позже.";
  }
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ],
  },
});

client.on("qr", (qr) => {
  console.log("\n📱 Сканируй QR-код своим WhatsApp:\n");
  qrcode.generate(qr, { small: true });
  console.log("\nWhatsApp → Связанные устройства → Привязать устройство\n");
});

client.on("ready", () => {
  console.log("✅ Бот запущен!");
  console.log(`🤖 Имя: ${BOT_NAME}`);
});

client.on("auth_failure", () => {
  console.error("❌ Ошибка авторизации.");
});

client.on("disconnected", (reason) => {
  console.log("⚠️ Отключился:", reason);
});

client.on("message", async (msg) => {
  if (msg.fromMe) return;
  if (msg.from.includes("@g.us")) return;

  const text = msg.body?.trim();
  if (!text) return;

  console.log(`📩 ${msg.from}: ${text}`);

  const greetings = ["привет", "hello", "hi", "start", "хай", "сәлем", "салем"];
  if (greetings.includes(text.toLowerCase())) {
    await msg.reply(
      `👋 Привет! Я ${BOT_NAME} — ваш автоматический ассистент.\n\nМогу помочь:\n• 📦 Оформить заказ\n• ❓ Ответить на вопросы\n• 💬 Проконсультировать\n\nНапишите что вас интересует!`
    );
    return;
  }

  const chat = await msg.getChat();
  await chat.sendStateTyping();

  const reply = await askAI(msg.from, text);
  await msg.reply(reply);
});

console.log("🚀 Запуск бота...");
client.initialize();
