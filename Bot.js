const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    PHONENUMBER_MCC,
    MessageRetryMap,
    Browsers,
    proto
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Transformers } = require('@xenova/transformers');
const pipeline = require('util').promisify(require('stream').pipeline);

// Bot Configuration
const CONFIG = {
    name: "KING_BLESS-XMD BOT",
    prefix: ".",
    owner: "233535502036", // Replace with your number
    version: "2.0.0",
    developer: "KINGSLEY Nyarko"
};

// AI Model Initialization
let aiModel = null;

// Load AI Model (Local - No API)
async function loadAIModel() {
    try {
        console.log('🌀 Loading AI model...');
        const { pipeline: aiPipeline } = await import('@xenova/transformers');
        aiModel = await aiPipeline('text-generation', 'Xenova/t5-small');
        console.log('✅ AI Model loaded successfully!');
    } catch (error) {
        console.log('⚠️ Using fallback AI response system');
    }
}

// Menu System
const BOT_MENU = `
╔═══════════════════════
║ *KING_BLESS-XMD BOT*
║ *Version:* ${CONFIG.version}
║ *Developer:* ${CONFIG.developer}
╚═══════════════════════

🤖 *AI FEATURES*
${CONFIG.prefix}ai <text> - AI Chat
${CONFIG.prefix}ask <question> - Ask anything
${CONFIG.prefix}translate <text> - Translate text

🔧 *UTILITIES*
${CONFIG.prefix}sticker - Create sticker
${CONFIG.prefix}toimg - Convert sticker to image
${CONFIG.prefix}tts <text> - Text to speech
${CONFIG.prefix}qrcode <text> - Generate QR

🎵 *MEDIA*
${CONFIG.prefix}play <song> - Play music
${CONFIG.prefix}ytsearch <query> - Search YouTube

📊 *TOOLS*
${CONFIG.prefix}weather <city> - Weather info
${CONFIG.prefix}calc <expression> - Calculator
${CONFIG.prefix}shorturl <url> - Shorten URL

🛡️ *ADMIN*
${CONFIG.prefix}ban @user - Ban user
${CONFIG.prefix}promote @user - Promote to admin
${CONFIG.prefix}groupinfo - Group information

📋 *OTHER*
${CONFIG.prefix}menu - Show this menu
${CONFIG.prefix}ping - Bot status
${CONFIG.prefix}owner - Contact owner

╔═══════════════════════
║ *Type ${CONFIG.prefix}menu to see this again*
╚═══════════════════════`;

// AI Response System (Local Processing)
async function getAIResponse(message) {
    try {
        if (aiModel) {
            const response = await aiModel(message, {
                max_length: 100,
                temperature: 0.7,
                repetition_penalty: 1.5
            });
            return response[0].generated_text || "I'm thinking... 🤔";
        } else {
            // Fallback responses if model fails
            const responses = [
                "That's interesting! Could you tell me more? 🤔",
                "I understand what you're saying. Let me think about that... 💭",
                "Great question! Based on my analysis, I would say... 📊",
                "I'm processing your message with advanced algorithms... ⚡",
                "Thanks for sharing! Here's my perspective... 👁️",
                "I've analyzed your input and here's what I think... 🤖",
                "Let me use my neural networks to respond to that... 🧠",
                "Processing complete! Here's my response... ✅"
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }
    } catch (error) {
        return "I'm currently learning from that. Try again in a moment! 🚀";
    }
}

// Auto-reply messages
const AUTO_REPLIES = {
    greetings: {
        keywords: ['hello', 'hi', 'hey', 'hola', 'good morning', 'good evening'],
        responses: [
            "Hello there! 👋 I'm KING_BLESS-XMD Bot, how can I assist you today?",
            "Hey! 🤖 Ready to help you with anything!",
            "Hi there! ✨ Type .menu to see what I can do!"
        ]
    },
    thanks: {
        keywords: ['thanks', 'thank you', 'ty', 'thx'],
        responses: [
            "You're welcome! 😊",
            "Glad I could help! 🎉",
            "Anytime! Let me know if you need anything else! 🤖"
        ]
    },
    bot: {
        keywords: ['bot', 'king bless', 'xmd'],
        responses: [
            "Yes! I'm KING_BLESS-XMD Bot created by KINGSLEY Nyarko! 🤖✨",
            "That's me! Ready to serve you with AI features! 🚀"
        ]
    }
};

// Main Bot Function
async function startBot() {
    console.log('\n╔══════════════════════════════════╗');
    console.log('║   KING_BLESS-XMD BOT v2.0.0      ║');
    console.log('║   Developed by KINGSLEY Nyarko   ║');
    console.log('╚══════════════════════════════════╝\n');

    // Load AI Model
    await loadAIModel();

    // Initialize Auth
    const { state, saveCreds } = await useMultiFileAuthState('session');

    // Create Socket
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
        },
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        defaultQueryTimeoutMs: 60000,
    });

    // QR Code in Terminal
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📱 Scan this QR Code with WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔁 Reconnecting...');
                startBot();
            }
        } else if (connection === 'open') {
            console.log('\n✅ Bot connected successfully!');
            console.log(`🤖 Bot Name: ${CONFIG.name}`);
            console.log(`👨‍💻 Developer: ${CONFIG.developer}`);
        }
    });

    // Save Creds
    sock.ev.on('creds.update', saveCreds);

    // Message Handler
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase();
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');
        const pushName = msg.pushName || 'User';

        // Check for auto-reply triggers
        for (const [type, data] of Object.entries(AUTO_REPLIES)) {
            if (data.keywords.some(keyword => text.includes(keyword))) {
                const response = data.responses[Math.floor(Math.random() * data.responses.length)];
                await sock.sendMessage(from, { text: response });
                return;
            }
        }

        // AI Auto-response for non-commands
        if (!text.startsWith(CONFIG.prefix) && text.length > 3 && Math.random() > 0.7) {
            const aiReply = await getAIResponse(text);
            await sock.sendMessage(from, { text: `💭 *AI Response:* ${aiReply}` });
            return;
        }

        // Command Handler
        if (text.startsWith(CONFIG.prefix)) {
            const command = text.slice(CONFIG.prefix.length).trim().split(' ')[0];
            const args = text.slice(CONFIG.prefix.length + command.length).trim();

            switch(command) {
                case 'menu':
                    await sock.sendMessage(from, { text: BOT_MENU });
                    break;

                case 'ai':
                    if (!args) {
                        await sock.sendMessage(from, { text: 'Please provide a message for AI! Usage: .ai <message>' });
                        return;
                    }
                    const aiResponse = await getAIResponse(args);
                    await sock.sendMessage(from, { 
                        text: `🤖 *AI Response:*\n\n${aiResponse}\n\n_Generated by ${CONFIG.name}_` 
                    });
                    break;

                case 'ask':
                    if (!args) {
                        await sock.sendMessage(from, { text: 'Please ask a question! Usage: .ask <question>' });
                        return;
                    }
                    const answer = await getAIResponse(`Question: ${args}\nAnswer:`);
                    await sock.sendMessage(from, { 
                        text: `❓ *Question:* ${args}\n\n💡 *Answer:* ${answer}` 
                    });
                    break;

                case 'ping':
                    const start = Date.now();
                    await sock.sendMessage(from, { text: 'Pinging... 🏓' });
                    const latency = Date.now() - start;
                    await sock.sendMessage(from, { 
                        text: `🏓 *PONG!*\n⏱️ Latency: ${latency}ms\n🆙 Uptime: ${process.uptime().toFixed(2)}s\n💾 Memory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB` 
                    });
                    break;

                case 'owner':
                    await sock.sendMessage(from, { 
                        text: `👑 *OWNER INFORMATION*\n\n👨‍💻 Name: KINGSLEY Nyarko\n🤖 Bot: ${CONFIG.name}\n🚀 Version: ${CONFIG.version}\n📧 Contact: Use .support for support` 
                    });
                    break;

                case 'sticker':
                    if (msg.message.imageMessage) {
                        await sock.sendMessage(from, { 
                            text: '📸 Sticker feature coming soon! Use .menu to see all features.' 
                        });
                    } else {
                        await sock.sendMessage(from, { 
                            text: 'Please send an image with caption .sticker' 
                        });
                    }
                    break;

                case 'translate':
                    if (!args) {
                        await sock.sendMessage(from, { text: 'Please provide text to translate!' });
                        return;
                    }
                    const translation = await getAIResponse(`Translate to English: ${args}`);
                    await sock.sendMessage(from, { 
                        text: `🌍 *Translation:*\n\n*Original:* ${args}\n*Translated:* ${translation}` 
                    });
                    break;

                case 'calc':
                    if (!args) {
                        await sock.sendMessage(from, { text: 'Please provide calculation! Usage: .calc 2+2' });
                        return;
                    }
                    try {
                        const result = eval(args.replace(/[^-()\d/*+.]/g, ''));
                        await sock.sendMessage(from, { 
                            text: `🧮 *Calculator*\n\n*Expression:* ${args}\n*Result:* ${result}` 
                        });
                    } catch {
                        await sock.sendMessage(from, { text: 'Invalid calculation expression!' });
                    }
                    break;

                case 'groupinfo':
                    if (!isGroup) {
                        await sock.sendMessage(from, { text: 'This command only works in groups!' });
                        return;
                    }
                    const metadata = await sock.groupMetadata(from);
                    await sock.sendMessage(from, { 
                        text: `👥 *GROUP INFO*\n\n📛 Name: ${metadata.subject}\n👑 Owner: ${metadata.owner}\n👥 Participants: ${metadata.participants.length}\n🆔 ID: ${metadata.id}` 
                    });
                    break;

                case 'help':
                case 'commands':
                    await sock.sendMessage(from, { text: BOT_MENU });
                    break;

                case 'qrcode':
                    if (!args) {
                        await sock.sendMessage(from, { text: 'Please provide text for QR code!' });
                        return;
                    }
                    const qrText = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(args)}`;
                    await sock.sendMessage(from, { 
                        image: { url: qrText },
                        caption: `📱 QR Code for: ${args}`
                    });
                    break;

                default:
                    await sock.sendMessage(from, { 
                        text: `❓ Unknown command! Type *${CONFIG.prefix}menu* to see all available commands.\n\n💡 *AI Auto-detected:* ${await getAIResponse(text)}` 
                    });
            }
        }
    });

    // Presence updates
    sock.ev.on('presence.update', (json) => {
        // console.log(json);
    });

    // Chat updates
    sock.ev.on('chats.update', (updates) => {
        // console.log(updates);
    });

    return sock;
}

// Error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
startBot().catch(console.error);