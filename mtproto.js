import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession("");

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5
});

(async () => {
  await client.start({
    phoneNumber: async () => await new Promise(resolve => {
      rl.question("Введи свій номер телефону (з кодом країни): ", resolve);
    }),
    password: async () => await new Promise(resolve => {
      rl.question("Якщо включена 2FA, введи пароль: ", resolve);
    }),
    phoneCode: async () => await new Promise(resolve => {
      rl.question("Введи код, який прийшов в Telegram: ", resolve);
    }),
    onError: (err) => console.log(err)
  });

  console.log("\n✅ TG_SESSION готовий!");
  console.log(client.session.save());
  rl.close();
})();
