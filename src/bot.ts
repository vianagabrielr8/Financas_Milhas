import { Telegraf, Context } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Conecta ao seu novo banco do Supabase usando as chaves do .env
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
);

// Inicializa o Bot do Telegram com o seu Token Virtual
const bot = new Telegraf('8767778879:AAGy6mqZBkagMmEEa30OxkWyCV_v3zqJBho');

// Comando inicial do robô (/start)
// Comando inicial do robô (/start)
bot.start((ctx) => {
  ctx.reply(
    `👋 Olá, ${ctx.from.first_name}!\n\n` +
    `Eu sou o seu Assistente de Finanças Pessoais e Gestão Milhas.\n\n` +
    `🤖 Estou pronto para processar prints de faturas e cartões. O que vamos lançar hoje?`
  );
});

// Mensagem simples para testar se o bot está ouvindo
bot.on('text', async (ctx) => {
  const texto = ctx.message.text;
  ctx.reply(`Recebi o seu texto: "${texto}". O motor de IA do Gemini processará isso em breve.`);
});

// Liga o Bot de forma limpa
bot.launch().then(() => {
  console.log('🤖 Bot de Finanças e Milhas iniciado com sucesso no terminal!');
});

// Força o desligamento seguro se o terminal fechar
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));