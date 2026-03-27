// ========== ИМПОРТЫ ==========
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource
} = require('@discordjs/voice');
const fetch = require('node-fetch');
const fs = require('fs');
const express = require('express');
const http = require('http');

let opus;
try { opus = require('@discordjs/opus'); } catch { opus = require('opusscript'); }

// ========== НАСТРОЙКИ ==========
const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '!';
const MIN_BET = 25;
const JACKPOT_START = 0;
const CASINO_COOLDOWN = 120000;
const ROBBERY_COOLDOWN = 1800000;
const DUEL_COOLDOWN = 300000;
const SCENARIO_COOLDOWN = 1800000;
const QUEST_COOLDOWN = 10800000;
const BINARY_COOLDOWN = 300000;
const WIN_CHANCE = 0.2;
const JACKPOT_SLOT_CHANCE = 0.02;
const MIN_CT_RATE = 0.0005;
const MAX_CT_RATE = 0.002;
const BOOST_CHANCE = 0.05;
const SNIPER_PRICE = 20000;
const SNIPER_SELL_PRICE = 17000;
const DAILY_REWARD = 50;
const DAILY_STREAK_BONUS = 500;
const MAX_NFT_INVENTORY = 3;
const NFT_SELL_RETURN = 0.2;
const RPS_COOLDOWN = 180000; // 3 минуты

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// ========== ХРАНИЛИЩА ==========
const voiceConnections = new Map();
let voiceStartTime = new Map();
let economy = new Map();
let warnings = new Map();
let achievements = new Map();
let userQuests = new Map();
let userQuestProgress = new Map();
let casinoWinCount = new Map();
let jackpot = JACKPOT_START;
let casinoSpent = new Map();
let oneTimeSpent = new Map();
let transfersMade = new Map();
let top1Weeks = new Map();
let messageCount = new Map();
let casinoCooldown = new Map();
let robberyCooldown = new Map();
let duelCooldown = new Map();
let scenarioCooldown = new Map();
let binaryCooldown = new Map();
let casinoCooldownAttempts = new Map();
let russianRouletteTimeoutCount = new Map();
let voiceStreakStart = new Map();
let binaryGames = new Map();
let userWeapons = new Map();
let userShield = new Map();
let userProperties = new Map();
let lastIncomeTime = new Map();
let userCrypto = new Map();
let traderStats = new Map();
let sellRequests = new Map();
let minePrisoners = new Map();
let activeBoosts = new Map();
let hackGames = new Map();
let userNFTs = new Map();
let lastBoostCheck = Date.now();
let sniperGames = new Map();
let dailyClaims = new Map();
let lastNewsTime = 0;
let pendingNFTTrades = new Map();
let rpsCooldown = new Map();

// ========== КУРС CT → РУБЛЬ ==========
let ctRate = 0.001;
let marketVolume = 0;
let marketHistory = [];

// ========== БИРЖА (ТВОИ КУРСЫ) ==========
let cryptoPrices = {
    'e-corp': { price: 9379, history: [], name: 'E-Corp', emoji: '🏢', minPrice: 40, nextUpdate: Date.now(), lastUpdate: Date.now() },
    'Nb': { price: 302, history: [], name: 'Nb', emoji: '💎', minPrice: 30, nextUpdate: Date.now(), lastUpdate: Date.now() },
    'Fsociety': { price: 45, history: [], name: 'Fsociety', emoji: '🤖', minPrice: 40, nextUpdate: Date.now(), lastUpdate: Date.now() },
    'KobyCoin': { price: 510, history: [], name: 'KobyCoin', emoji: '🐫', minPrice: 75, nextUpdate: Date.now(), lastUpdate: Date.now() }
};

// ========== НОВОСТИ ДЛЯ БИРЖИ ==========
const CRYPTO_NEWS = [
    { text: "E-Corp замешан в скандале с данными!", effect: "down", percent: 5 },
    { text: "Fsociety выпустила новый эксплойт!", effect: "up", percent: 8 },
    { text: "Белая Роза инвестирует в Nb", effect: "up", percent: 4 },
    { text: "Правительство расследует KobyCoin", effect: "down", percent: 6 },
    { text: "Dark Army взломала биржу!", effect: "down", percent: 10 },
    { text: "Мистер Робот поддерживает Fsociety", effect: "up", percent: 7 },
    { text: "E-Corp отчитался о прибыли", effect: "up", percent: 3 },
    { text: "Хакеры украли 1000 KobyCoin", effect: "down", percent: 8 },
    { text: "Новый патч безопасности для Nb", effect: "up", percent: 5 },
    { text: "Elliot Alderson разоблачил коррупцию", effect: "up", percent: 12 }
];

// ========== ОРУЖИЕ ==========
const WEAPONS = {
    'бита': { price: 3000, chance: 0.45, emoji: '🏏', name: 'Бита', sellPrice: 2550 },
    'нож': { price: 6000, chance: 0.55, emoji: '🔪', name: 'Нож', sellPrice: 5100 },
    'пистолет': { price: 11000, chance: 0.7, emoji: '🔫', name: 'Пистолет', sellPrice: 9350 },
    'снайперка': { price: SNIPER_PRICE, chance: 1.0, emoji: '🎯', name: 'Снайперка', sellPrice: SNIPER_SELL_PRICE, requiresGame: true }
};

// ========== НЕДВИЖИМОСТЬ ==========
const PROPERTIES = {
    'хибара': { price: 5000, income: 50, cooldown: 5 * 3600000, emoji: '🏚️', name: 'Хибара', sellPrice: 3500 },
    'квартира': { price: 15000, income: 150, cooldown: 6 * 3600000, emoji: '🏢', name: 'Квартира', sellPrice: 10500 },
    'дом': { price: 50000, income: 500, cooldown: 8 * 3600000, emoji: '🏠', name: 'Дом', sellPrice: 35000 },
    'особняк': { price: 150000, income: 1500, cooldown: 12 * 3600000, emoji: '🏰', name: 'Особняк', sellPrice: 105000 },
    'будка': { price: 1000, income: 10, cooldown: 10 * 3600000, emoji: '🏪', name: 'Будка', sellPrice: 700 },
    'подвал': { price: 7500, income: 75, cooldown: 5 * 3600000, emoji: '🏚️', name: 'Подвал', sellPrice: 5250 },
    'замок': { price: 200000, income: 2000, cooldown: 5 * 3600000, emoji: '🏰', name: 'Замок', sellPrice: 140000 }
};

// ========== NFT КОЛЛЕКЦИЯ ==========
const NFT_COLLECTION = {
    'common': [
        { id: 'elliot_common', name: 'Эллиот (обычный)', rarity: 'common', bonus: '+2% к сценариям', price: 1000, emoji: '🧢' },
        { id: 'darlene_common', name: 'Дарлин (обычная)', rarity: 'common', bonus: '+2% к ограблениям', price: 1000, emoji: '👩‍💻' },
        { id: 'mrrobot_common', name: 'Мистер Робот (обычный)', rarity: 'common', bonus: '+2% к казино', price: 1000, emoji: '🎭' },
        { id: 'fsociety_common', name: 'Fsociety (обычный)', rarity: 'common', bonus: '+2% ко всему', price: 1000, emoji: '🤖' }
    ],
    'rare': [
        { id: 'elliot_rare', name: 'Эллиот (редкий)', rarity: 'rare', bonus: '+5% к сценариям', price: 5000, emoji: '🧢✨' },
        { id: 'tyrell_rare', name: 'Тайрел (редкий)', rarity: 'rare', bonus: '+5% к казино', price: 5000, emoji: '👔' },
        { id: 'whiterose_rare', name: 'Белая Роза (редкая)', rarity: 'rare', bonus: '+5% к бирже', price: 5000, emoji: '🌹' }
    ],
    'epic': [
        { id: 'elliot_epic', name: 'Эллиот (эпический)', rarity: 'epic', bonus: '+10% к сценариям', price: 20000, emoji: '🧢🌟' },
        { id: 'mrrobot_epic', name: 'Мистер Робот (эпический)', rarity: 'epic', bonus: '+10% к ограблениям', price: 20000, emoji: '🎭🌟' }
    ],
    'legendary': [
        { id: 'elliot_legendary', name: 'Эллиот (легендарный)', rarity: 'legendary', bonus: '+20% к сценариям', price: 50000, emoji: '🧢💎' },
        { id: 'fsociety_legendary', name: 'Fsociety (легендарный)', rarity: 'legendary', bonus: '+20% ко всему', price: 50000, emoji: '🤖💎' }
    ],
    'mythic': [
        { id: 'elliot_mythic', name: 'Эллиот (мифический)', rarity: 'mythic', bonus: '+50% ко всему', price: 150000, emoji: '🧢👑' }
    ],
    'special': [
        { id: 'fsociety_mask', name: 'Маска Fsociety', rarity: 'special', bonus: '+15% к ограблениям', price: 8000, emoji: '🎭' },
        { id: 'ecorp_keycard', name: 'Ключ-карта E-Corp', rarity: 'special', bonus: '+15% к бирже', price: 8000, emoji: '💳' },
        { id: 'dark_army_usb', name: 'USB Dark Army', rarity: 'special', bonus: '+15% к взлому', price: 8000, emoji: '💽' },
        { id: 'elliot_journal', name: 'Дневник Эллиота', rarity: 'special', bonus: '+15% к сценариям', price: 8000, emoji: '📓' },
        { id: 'whiterose_clock', name: 'Часы Белой Розы', rarity: 'special', bonus: '+15% ко всему', price: 12000, emoji: '⏰' }
    ]
};

// ========== СЦЕНАРИИ ==========
const SCENARIOS = [
    { text: "Ты взломал E Corp и украл", min: 200, max: 800, success: true },
    { text: "Ты встретил Мистера Робота, он дал тебе", min: 100, max: 400, success: true },
    { text: "Белая Роза стёрла твои данные — ты потерял", min: 200, max: 600, success: false },
    { text: "Ты взломал систему безопасности и получил", min: 300, max: 900, success: true },
    { text: "Ты попался на уязвимости — заплатил", min: 150, max: 500, success: false },
    { text: "Ты помог fsociety, они отблагодарили тебя", min: 400, max: 1000, success: true },
    { text: "Твои данные продали на чёрном рынке — ты потерял", min: 300, max: 700, success: false },
    { text: "Ты нашёл уязвимость нулевого дня и продал её", min: 500, max: 1500, success: true },
    { text: "Ты попал в ловушку White Rose — потерял", min: 400, max: 1000, success: false },
    { text: "Ты взломал банк и вывел деньги", min: 600, max: 2000, success: true },
    { text: "ФБР вышло на твой след — ты заплатил", min: 500, max: 1200, success: false },
    { text: "Ты дешифровал секретный файл и получил", min: 300, max: 800, success: true },
    { text: "Твой компьютер заразили трояном — ты потерял", min: 200, max: 600, success: false },
    { text: "Ты помог Дарлин, она дала тебе", min: 250, max: 700, success: true },
    { text: "Тайрел Уэллик предложил сделку — ты получил", min: 800, max: 2000, success: true },
    { text: "Ты попал под расследование — потерял", min: 300, max: 900, success: false },
    { text: "Ты взломал темную сеть и нашёл биткоины", min: 1000, max: 3000, success: true },
    { text: "Твоя личность раскрыта — заплатил", min: 600, max: 1500, success: false },
    { text: "Ты стал легендой в хакерском сообществе", min: 500, max: 1200, success: true },
    { text: "Эллиот ничего не понимает...", min: 7000, max: 7000, success: true, rare: true, chance: 0.003 },
    { text: "Dark Army перехватила твой трафик", min: 300, max: 800, success: false },
    { text: "Ты встретил Тайрела в баре", min: 200, max: 600, success: true },
    { text: "Белая Роза предложила сделку", min: 1000, max: 3000, success: true },
    { text: "Твой аккаунт взломали", min: 400, max: 1000, success: false },
    { text: "Ты продал эксплойт на чёрном рынке", min: 1500, max: 4000, success: true }
];

// ========== АЧИВКИ ==========
const ALL_ACHIEVEMENTS = {
    'bankomat': { name: 'Банкомат!', desc: 'Накопить 2000 CT', check: (ct) => ct >= 2000, reward: 0 },
    'gambler': { name: 'Многовато!', desc: 'Потратить в казино 5000 CT', check: (spent) => spent >= 5000, reward: 0 },
    'fool': { name: 'Дурачок...', desc: 'Потратить за один раз в казино 1500 CT', check: (oneTime) => oneTime >= 1500, reward: 0 },
    'savior': { name: 'Спаситель', desc: 'Перевести любому человеку 100+ CT', check: (transferred) => transferred >= 100, reward: 0 },
    'talkative': { name: 'Разговорчивый', desc: 'Написать больше 300 сообщений', check: (msgs) => msgs >= 300, reward: 0 },
    'role_collector': { name: 'Куда так много?', desc: 'Иметь больше 7 ролей за раз', check: (roles) => roles >= 7, reward: 0 },
    'trader': { name: 'Крипто-кит', desc: 'Заработать на бирже 5000 CT', check: (profit) => profit >= 5000, reward: 0 },
    'jackpot_winner': { name: 'Джекпот-хантер', desc: 'Выиграть джекпот', check: (jp) => jp >= 1, reward: 0 },
    'wash': { name: 'Иди помойся!', desc: 'Просидеть в войсе 10 часов не выходя', check: (voiceStreak) => voiceStreak >= 10, reward: 0 },
    'unluck': { name: 'Unluck...', desc: 'Попасть в тайм-аут при помощи бесплатной рулетки 5 раз', check: (rrTimeout) => rrTimeout >= 5, reward: 0 },
    'lucky': { name: 'А ты везунчик!', desc: 'Выбить джекпот 3 раза', check: (jpWins) => jpWins >= 3, reward: 0 },
    'genius': { name: 'ты слишком гениален ХАХАХ...', desc: 'Попытаться сыграть в казино 5 раз когда оно в КД', check: (cdAttempts) => cdAttempts >= 5, reward: 0 },
    'property_owner': { name: 'Домовладелец', desc: 'Купить любую недвижимость', check: (prop) => prop !== null, reward: 0 },
    'rich': { name: 'Богач', desc: 'Накопить 50000 CT', check: (ct) => ct >= 50000, reward: 0 },
    'armed': { name: 'Вооружён', desc: 'Купить оружие', check: (weapon) => weapon !== null, reward: 0 },
    'binary_master': { name: 'Бинарный гений', desc: 'Победить в бинарном коде 10 раз', check: (wins) => wins >= 10, reward: 0 },
    'nft_collector': { name: 'Коллекционер', desc: 'Собрать 10 NFT', check: (nfts) => nfts >= 10, reward: 0 },
    'hacker': { name: 'Легенда взлома', desc: 'Взломать 5 серверов', check: (hacks) => hacks >= 5, reward: 0 },
    'jackpot_king': { name: 'Король джекпота', desc: 'Выиграть джекпот 5 раз', check: (jpWins) => jpWins >= 5, reward: 0 }
};

// ========== СЛОВАРЬ ИМЁН ==========
const REAL_NAME_TO_NICK = {
    "данила": "yba4kafn", "данил": "yba4kafn",
    "артём": "fixyalex", "артема": "fixyalex",
    "макс": "zxc_neovosh", "максим": "zxc_neovosh",
    "ваня": "xomyak_gg1_04481", "ваню": "xomyak_gg1_04481",
    "саня": "spyoichi_123765", "саню": "spyoichi_123765",
    "гришу": "noobandnoob.", "гриша": "noobandnoob."
};

// ========== КВЕСТЫ ==========
const ALL_QUESTS = [
    { type: 'msg', target: 10, reward: 25, desc: 'Отправить 10 сообщений' },
    { type: 'msg', target: 25, reward: 50, desc: 'Отправить 25 сообщений' },
    { type: 'msg', target: 50, reward: 100, desc: 'Отправить 50 сообщений' },
    { type: 'msg', target: 100, reward: 150, desc: 'Отправить 100 сообщений' },
    { type: 'voice', target: 10, reward: 10, desc: 'Провести 10 мин в войсе' },
    { type: 'voice', target: 60, reward: 100, desc: 'Провести 1 час в войсе' },
    { type: 'voice', target: 120, reward: 200, desc: 'Провести 2 часа в войсе' },
    { type: 'casino', target: 5, reward: 100, desc: 'Сыграть 5 раз в казино' },
    { type: 'casino', target: 10, reward: 300, desc: 'Сыграть 10 раз в казино' },
    { type: 'casino_win', target: 3, reward: 150, desc: 'Выиграть 3 раза в казино' },
    { type: 'transfer', target: 3, reward: 100, desc: 'Перевести CT 3 раза' },
    { type: 'transfer', target: 10, reward: 500, desc: 'Перевести CT 10 раз' },
    { type: 'crypto_trade', target: 5, reward: 150, desc: 'Сделать 5 сделок на бирже' },
    { type: 'crypto_trade', target: 20, reward: 600, desc: 'Сделать 20 сделок на бирже' },
    { type: 'rps', target: 3, reward: 75, desc: 'Выиграть 3 раза в КНБ' },
    { type: 'rps', target: 10, reward: 300, desc: 'Выиграть 10 раз в КНБ' },
    { type: 'raffle', target: 1, reward: 50, desc: 'Выиграть в розыгрыше' },
    { type: 'raffle', target: 5, reward: 300, desc: 'Выиграть в розыгрыше 5 раз' },
    { type: 'duel', target: 3, reward: 200, desc: 'Выиграть в дуэли 3 раза' },
    { type: 'rob', target: 5, reward: 250, desc: 'Успешно ограбить 5 раз' },
    { type: 'crypto_profit', target: 1000, reward: 500, desc: 'Заработать на бирже 1000 CT' },
    { type: 'binary_win', target: 3, reward: 150, desc: 'Победить в бинарном коде 3 раза' },
    { type: 'hack_win', target: 3, reward: 200, desc: 'Успешно взломать сервер 3 раза' }
];

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
async function findMemberByName(guild, name) {
    if (!guild || !name) return null;
    const search = name.toLowerCase().trim();
    if (REAL_NAME_TO_NICK[search]) {
        const nick = REAL_NAME_TO_NICK[search].toLowerCase();
        return guild.members.cache.find(m => 
            m?.user?.username?.toLowerCase() === nick ||
            (m?.nickname && m.nickname.toLowerCase() === nick)
        );
    }
    return guild.members.cache.find(m => 
        m?.user?.username?.toLowerCase()?.includes(search) ||
        (m?.nickname && m.nickname.toLowerCase().includes(search))
    );
}

async function findChannelByName(guild, name) {
    if (!guild || !name) return null;
    return guild.channels.cache.find(c => 
        c?.type === 2 && c?.name?.toLowerCase()?.includes(name.toLowerCase())
    );
}

function isAdmin(member) {
    return member?.permissions?.has('Administrator') || false;
}

async function speakText(guild, text) {
    const conn = voiceConnections.get(guild.id);
    if (!conn) return false;
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ru&client=tw-ob`;
    const player = createAudioPlayer();
    const resource = createAudioResource(url);
    player.play(resource);
    conn.subscribe(player);
    return true;
}

function getCT(userId) { 
    const balance = economy.get(userId);
    return (balance === undefined || balance === null || balance < 0) ? 0 : balance;
}

function addCT(userId, amount) { 
    const boost = activeBoosts.get(userId);
    let multiplier = 1;
    if (boost && boost.until > Date.now() && (boost.type === 'all' || boost.type === 'exchange')) {
        multiplier = boost.multiplier;
    }
    const finalAmount = amount * multiplier;
    economy.set(userId, (economy.get(userId) || 0) + finalAmount); 
    saveData();
    checkAchievements(userId);
}

function removeCT(userId, amount) { 
    const cur = getCT(userId);
    if (cur >= amount) { 
        economy.set(userId, cur - amount); 
        saveData(); 
        checkAchievements(userId);
        return true; 
    } 
    return false; 
}

function setCT(userId, amount) { 
    economy.set(userId, Math.max(0, amount)); 
    saveData(); 
    checkAchievements(userId); 
}

function getWeapon(userId) {
    const weaponName = userWeapons.get(userId);
    return weaponName ? WEAPONS[weaponName] : null;
}

function getUserNFTBonuses(userId) {
    const nfts = userNFTs.get(userId) || [];
    let bonuses = { scenario: 0, robbery: 0, casino: 0, exchange: 0, hack: 0, all: 0 };
    nfts.forEach(nft => {
        let bonusValue = 0;
        if (nft.rarity === 'mythic') bonusValue = 0.5;
        else if (nft.rarity === 'legendary') bonusValue = 0.2;
        else if (nft.rarity === 'epic') bonusValue = 0.1;
        else if (nft.rarity === 'rare') bonusValue = 0.05;
        else if (nft.rarity === 'special') bonusValue = 0.15;
        else bonusValue = 0.02;
        
        if (nft.name.includes('сценариям')) bonuses.scenario += bonusValue;
        else if (nft.name.includes('ограблениям')) bonuses.robbery += bonusValue;
        else if (nft.name.includes('казино')) bonuses.casino += bonusValue;
        else if (nft.name.includes('бирже')) bonuses.exchange += bonusValue;
        else if (nft.name.includes('взлому')) bonuses.hack += bonusValue;
        else if (nft.name.includes('всему')) bonuses.all += bonusValue;
    });
    return bonuses;
}

function openLootbox(userId) {
    const nfts = userNFTs.get(userId) || [];
    if (nfts.length >= MAX_NFT_INVENTORY) {
        return { success: false, reason: `У вас уже ${MAX_NFT_INVENTORY} NFT! Продайте лишние, чтобы открыть новый лутбокс.` };
    }
    
    const random = Math.random();
    let nft;
    if (random < 0.01) {
        const mythicList = NFT_COLLECTION.mythic;
        nft = { ...mythicList[Math.floor(Math.random() * mythicList.length)] };
    } else if (random < 0.05) {
        const legendaryList = NFT_COLLECTION.legendary;
        nft = { ...legendaryList[Math.floor(Math.random() * legendaryList.length)] };
    } else if (random < 0.12) {
        const epicList = NFT_COLLECTION.epic;
        nft = { ...epicList[Math.floor(Math.random() * epicList.length)] };
    } else if (random < 0.22) {
        const rareList = NFT_COLLECTION.rare;
        nft = { ...rareList[Math.floor(Math.random() * rareList.length)] };
    } else if (random < 0.35) {
        const specialList = NFT_COLLECTION.special;
        nft = { ...specialList[Math.floor(Math.random() * specialList.length)] };
    } else {
        const commonList = NFT_COLLECTION.common;
        nft = { ...commonList[Math.floor(Math.random() * commonList.length)] };
    }
    
    nft.id = `${nft.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    nft.obtainedAt = Date.now();
    
    userNFTs.set(userId, [...nfts, nft]);
    saveData();
    return { success: true, nft };
}

function sellNFT(userId, nftId) {
    const nfts = userNFTs.get(userId) || [];
    const nftIndex = nfts.findIndex(n => n.id === nftId);
    if (nftIndex === -1) return { success: false, reason: "NFT не найдена" };
    
    const nft = nfts[nftIndex];
    const sellPrice = Math.floor(nft.price * NFT_SELL_RETURN);
    
    nfts.splice(nftIndex, 1);
    userNFTs.set(userId, nfts);
    addCT(userId, sellPrice);
    saveData();
    
    return { success: true, nft, sellPrice };
}

function getNFTsList(userId) {
    return userNFTs.get(userId) || [];
}

// ========== NFT БОНУСЫ В ИГРЫ ==========
function getWinChance(userId) {
    const boost = activeBoosts.get(userId);
    const nftBonuses = getUserNFTBonuses(userId);
    let nftBonus = nftBonuses.casino + nftBonuses.all;
    
    let chance = WIN_CHANCE + nftBonus;
    
    if (boost && boost.until > Date.now() && (boost.type === 'casino' || boost.type === 'all')) {
        chance = 0.4 + nftBonus;
    }
    
    return Math.min(0.8, chance);
}

function getScenarioMultiplier(userId) {
    const boost = activeBoosts.get(userId);
    const nftBonuses = getUserNFTBonuses(userId);
    let nftBonus = 1 + nftBonuses.scenario + nftBonuses.all;
    
    let multiplier = 1;
    if (boost && boost.until > Date.now() && (boost.type === 'scenario' || boost.type === 'all')) {
        multiplier = boost.multiplier;
    }
    
    return multiplier * nftBonus;
}

function getRobberyChance(userId) {
    const weapon = getWeapon(userId);
    const nftBonuses = getUserNFTBonuses(userId);
    let nftBonus = nftBonuses.robbery + nftBonuses.all;
    
    let baseChance = weapon ? weapon.chance : 0.3;
    return Math.min(0.95, baseChance + nftBonus);
}

function getExchangeMultiplier(userId) {
    const boost = activeBoosts.get(userId);
    const nftBonuses = getUserNFTBonuses(userId);
    let nftBonus = 1 + nftBonuses.exchange + nftBonuses.all;
    
    let multiplier = 1;
    if (boost && boost.until > Date.now() && (boost.type === 'exchange' || boost.type === 'all')) {
        multiplier = boost.multiplier;
    }
    
    return multiplier * nftBonus;
}

function getHackBonus(userId) {
    const nftBonuses = getUserNFTBonuses(userId);
    return 1 + nftBonuses.hack + nftBonuses.all;
}

// ========== ЕЖЕДНЕВНЫЙ БОНУС ==========
function getDailyReward(userId) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const claimData = dailyClaims.get(userId);
    const lastClaim = claimData?.lastClaim || 0;
    const streak = claimData?.streak || 0;
    
    if (lastClaim >= today) {
        const nextClaim = new Date(today + 86400000);
        return { success: false, nextClaim, streak };
    }
    
    const yesterday = today - 86400000;
    let newStreak = 1;
    if (lastClaim >= yesterday) {
        newStreak = streak + 1;
    }
    
    let reward = DAILY_REWARD;
    let bonusText = "";
    
    if (newStreak >= 7) {
        reward += DAILY_STREAK_BONUS;
        bonusText = ` + бонус за 7 дней! +${DAILY_STREAK_BONUS} CT`;
        newStreak = 0;
    } else if (newStreak > 1) {
        bonusText = ` (${newStreak}-дневный стрик!)`;
    }
    
    addCT(userId, reward);
    dailyClaims.set(userId, { lastClaim: today, streak: newStreak });
    saveData();
    
    return { success: true, reward, streak: newStreak, bonusText };
}

// ========== БИРЖЕВЫЕ НОВОСТИ ==========
async function sendCryptoNews(guild) {
    const now = Date.now();
    if (now - lastNewsTime < 1800000) return;
    
    const channel = guild.channels.cache.find(c => c.name === 'основа');
    if (!channel) return;
    
    const news = CRYPTO_NEWS[Math.floor(Math.random() * CRYPTO_NEWS.length)];
    const cryptoNames = Object.keys(cryptoPrices);
    const selectedCrypto = cryptoNames[Math.floor(Math.random() * cryptoNames.length)];
    const cryptoData = cryptoPrices[selectedCrypto];
    
    let priceChange = 0;
    if (news.effect === "up") {
        priceChange = news.percent;
        cryptoData.price = Math.floor(cryptoData.price * (1 + priceChange / 100));
    } else {
        priceChange = -news.percent;
        cryptoData.price = Math.floor(cryptoData.price * (1 - priceChange / 100));
    }
    
    cryptoData.price = Math.max(cryptoData.minPrice, cryptoData.price);
    cryptoData.history.push({ price: cryptoData.price, time: now });
    if (cryptoData.history.length > 50) cryptoData.history.shift();
    
    const emoji = priceChange > 0 ? "📈" : "📉";
    await channel.send(`📰 **БИРЖЕВЫЕ НОВОСТИ**\n${news.text}\n\n${cryptoData.emoji} **${cryptoData.name}** ${emoji} ${Math.abs(priceChange)}%!\nНовая цена: ${cryptoData.price} CT`);
    
    lastNewsTime = now;
    saveData();
}

// ========== ГРАФИКИ ==========
async function getCryptoChart(cryptoKey, cryptoName) {
    const crypto = cryptoPrices[cryptoKey];
    if (!crypto || crypto.history.length < 2) return null;
    
    const prices = crypto.history.map(h => h.price);
    const labels = crypto.history.map((_, i) => i + 1);
    
    const chartUrl = `https://quickchart.io/chart?c={
        type: 'line',
        data: {
            labels: [${labels.join(',')}],
            datasets: [{ 
                label: '${cryptoName} (CT)',
                data: [${prices.join(',')}],
                borderColor: '#0f0',
                backgroundColor: 'rgba(0,255,0,0.1)',
                fill: true
            }]
        },
        options: {
            title: { display: true, text: '${cryptoName} - История цены' },
            scales: { y: { beginAtZero: false } }
        }
    }`;
    
    return chartUrl;
}

// ========== БИНАРНЫЙ КОД ==========
function generateBinarySequence(length = 7) {
    let seq = '';
    for (let i = 0; i < length; i++) {
        seq += Math.random() < 0.5 ? '0' : '1';
    }
    return seq;
}

function getNextBinaryDigit() {
    return Math.random() < 0.5 ? '0' : '1';
}

function startBinaryGame(userId, bet) {
    const sequence = generateBinarySequence(7);
    binaryGames.set(userId, { sequence, bet, correctGuesses: 0, gameOver: false });
    return { sequence, bet };
}

function checkBinaryGuess(userId, guess) {
    const game = binaryGames.get(userId);
    if (!game || game.gameOver) return { success: false, error: 'Нет активной игры' };
    const expected = getNextBinaryDigit();
    if (guess === expected) {
        game.correctGuesses++;
        game.sequence = game.sequence.slice(1) + guess;
        if (game.correctGuesses >= 3) {
            const winAmount = game.bet * 2;
            addCT(userId, winAmount);
            binaryGames.delete(userId);
            return { success: true, win: winAmount, message: '🎉 Поздравляем! Вы угадали 3 раза подряд и выиграли!' };
        }
        binaryGames.set(userId, game);
        const nextSequence = game.sequence;
        return { success: true, correct: true, nextSequence, guesses: game.correctGuesses, message: `✅ Правильно! Осталось угадать: ${3 - game.correctGuesses} раз` };
    } else {
        binaryGames.delete(userId);
        return { success: false, lose: true, message: `💥 Неправильно! Вы проиграли ${game.bet} CT` };
    }
}

function checkBinaryCooldown(userId) {
    const end = binaryCooldown.get(userId);
    if (end && Date.now() < end) {
        const remaining = Math.ceil((end - Date.now()) / 1000);
        return { onCooldown: true, remaining, minutes: Math.floor(remaining/60), seconds: remaining%60 };
    }
    return { onCooldown: false };
}
function setBinaryCooldown(userId) {
    binaryCooldown.set(userId, Date.now() + BINARY_COOLDOWN);
    setTimeout(() => binaryCooldown.delete(userId), BINARY_COOLDOWN);
}

// ========== ИГРА "ВЗЛОМ" ==========
class HackGame {
    constructor(userId, bet) {
        this.userId = userId;
        this.bet = bet;
        this.servers = ['E Corp', 'Dark Army', 'FBI', 'FSociety', 'White Rose'];
        this.currentServer = this.servers[Math.floor(Math.random() * this.servers.length)];
        this.steps = ['scan', 'exploit', 'clean'];
        this.currentStep = 0;
        this.tools = {
            scan: ['nmap', 'masscan', 'zmap', 'rustscan'],
            exploit: ['metasploit', 'sqlmap', 'hydra', 'exploit-db'],
            clean: ['rm -rf', 'shred', 'wipe', 'clear_logs']
        };
        this.success = true;
    }
    
    processStep(choice) {
        const validTools = this.tools[this.steps[this.currentStep]];
        if (validTools.includes(choice)) {
            this.currentStep++;
            if (this.currentStep === 3) {
                const hackBonus = getHackBonus(this.userId);
                const winMultiplier = (this.currentServer === 'E Corp' ? 3 :
                                     this.currentServer === 'Dark Army' ? 4 :
                                     this.currentServer === 'FBI' ? 5 :
                                     this.currentServer === 'FSociety' ? 2 : 6) * hackBonus;
                const win = this.bet * winMultiplier;
                addCT(this.userId, win);
                return { success: true, win, message: `🎉 Взлом **${this.currentServer}** успешен! +${win} CT! ${hackBonus > 1 ? `(x${hackBonus} NFT бонус)` : ''}` };
            }
            return { success: true, message: `✅ ${this.steps[this.currentStep - 1].toUpperCase()} пройден! Следующий шаг: ${this.steps[this.currentStep]}` };
        } else {
            this.success = false;
            return { success: false, message: `💥 Ошибка! Инструмент "${choice}" не подходит. Вас обнаружили! Потеряно ${this.bet} CT` };
        }
    }
}

// ========== ШАХТА ==========
function startMinePunishment(userId, guild) {
    minePrisoners.set(userId, { required: 10, progress: 0, lastMineCall: Date.now(), active: true });
    
    const interval = setInterval(async () => {
        const prisoner = minePrisoners.get(userId);
        if (!prisoner || !prisoner.active) {
            clearInterval(interval);
            return;
        }
        
        const user = await guild.members.fetch(userId).catch(() => null);
        if (user) {
            const channel = guild.channels.cache.find(c => c.name === 'основа');
            if (channel) {
                await channel.send(`⛏️ ${user.displayName}, **КОПАЙ!** Напиши "вскопал" в течение 30 секунд!`);
                
                prisoner.lastMineCall = Date.now();
                prisoner.expectedResponse = true;
                
                setTimeout(() => {
                    if (prisoner.expectedResponse && prisoner.active) {
                        prisoner.progress = 0;
                        channel.send(`😢 ${user.displayName} не ответил! Прогресс сброшен. Нужно ответить на 10 вызовов.`);
                    }
                }, 30000);
            }
        }
    }, Math.floor(Math.random() * (10 - 5 + 1) + 5) * 60000);
    
    minePrisoners.get(userId).interval = interval;
}

// ========== БУСТЫ ==========
function checkAndGrantBoost(guild) {
    if (Date.now() - lastBoostCheck > 3600000) {
        lastBoostCheck = Date.now();
        
        if (Math.random() < BOOST_CHANCE) {
            const members = guild.members.cache.filter(m => !m.user.bot);
            if (members.size > 0) {
                const winner = members.random();
                const boostTypes = ['casino', 'exchange', 'all', 'quest', 'scenario'];
                const boostType = boostTypes[Math.floor(Math.random() * boostTypes.length)];
                const duration = 3600000;
                
                activeBoosts.set(winner.id, { type: boostType, multiplier: 2, until: Date.now() + duration });
                
                const channel = guild.channels.cache.find(c => c.name === 'основа');
                if (channel) {
                    let boostText = '';
                    switch(boostType) {
                        case 'casino': boostText = '🎰 **БУСТ КАЗИНО**! Шанс выигрыша увеличен до 40%!'; break;
                        case 'exchange': boostText = '📈 **БУСТ БИРЖИ**! Прибыль от продажи x2!'; break;
                        case 'all': boostText = '✨ **МЕГА-БУСТ**! Все доходы x2!'; break;
                        case 'quest': boostText = '📜 **БУСТ КВЕСТОВ**! Награда за квесты x2!'; break;
                        case 'scenario': boostText = '🎭 **БУСТ СЦЕНАРИЕВ**! Выигрыши в сценариях x2!'; break;
                    }
                    channel.send(`🎉 **${winner.displayName}** получил буст на 1 час!\n${boostText}`);
                }
            }
        }
    }
}

function getQuestMultiplier(userId) {
    const boost = activeBoosts.get(userId);
    if (boost && boost.until > Date.now() && (boost.type === 'quest' || boost.type === 'all')) {
        return boost.multiplier;
    }
    return 1;
}

// ========== СЦЕНАРИЙ ==========
function getScenario() {
    if (Math.random() < 0.003) {
        return SCENARIOS.find(s => s.text === "Эллиот ничего не понимает...");
    }
    const normalScenarios = SCENARIOS.filter(s => s.text !== "Эллиот ничего не понимает...");
    return normalScenarios[Math.floor(Math.random() * normalScenarios.length)];
}

// ========== КАЗИНО ==========
function casinoSlot(bet, userId) {
    const isWin = Math.random() < getWinChance(userId);
    const isJackpot = Math.random() < JACKPOT_SLOT_CHANCE;
    if (isJackpot) return { result: 'JACKPOT! 💎💎💎', win: jackpot, isJackpot: true };
    if (!isWin) return { result: 'LOSE', win: 0, isJackpot: false };
    const mult = Math.random() < 0.6 ? 2 : (Math.random() < 0.85 ? 3 : 5);
    return { result: 'WIN', win: bet * mult, multiplier: mult, isJackpot: false };
}

function diceGame(bet, userId) {
    const isWin = Math.random() < getWinChance(userId);
    if (!isWin) return { player: Math.floor(Math.random()*6)+1, bot: Math.floor(Math.random()*6)+1, win: 0 };
    const mult = Math.random() < 0.6 ? 2 : (Math.random() < 0.85 ? 3 : 5);
    return { player: Math.floor(Math.random()*6)+1, bot: Math.floor(Math.random()*6)+1, win: bet * mult, multiplier: mult };
}

function roulette(bet, choice, userId) {
    const isWin = Math.random() < getWinChance(userId);
    if (!isWin) return { number: Math.floor(Math.random() * 37), win: 0 };
    const mult = Math.random() < 0.6 ? 2 : (Math.random() < 0.85 ? 3 : 5);
    return { number: Math.floor(Math.random() * 37), win: bet * mult, multiplier: mult };
}

function russianRoulette() { return Math.random() < 0.1667; }
function coinFlip(bet = null, userId) {
    const result = Math.random() > 0.5 ? 'Орёл' : 'Решка';
    let win = 0;
    if (bet && Math.random() < getWinChance(userId)) {
        const mult = Math.random() < 0.6 ? 2 : (Math.random() < 0.85 ? 3 : 5);
        win = bet * mult;
    }
    return { result, win };
}

function checkCasinoCooldown(userId) {
    const end = casinoCooldown.get(userId);
    if (end && Date.now() < end) return { onCooldown: true, remaining: Math.ceil((end - Date.now()) / 1000) };
    return { onCooldown: false };
}
function setCasinoCooldown(userId) {
    casinoCooldown.set(userId, Date.now() + CASINO_COOLDOWN);
    setTimeout(() => casinoCooldown.delete(userId), CASINO_COOLDOWN);
}
function checkRobberyCooldown(userId) {
    const end = robberyCooldown.get(userId);
    if (end && Date.now() < end) {
        const r = Math.ceil((end - Date.now()) / 1000);
        return { onCooldown: true, remaining: r, minutes: Math.floor(r/60), seconds: r%60 };
    }
    return { onCooldown: false };
}
function setRobberyCooldown(userId) {
    robberyCooldown.set(userId, Date.now() + ROBBERY_COOLDOWN);
    setTimeout(() => robberyCooldown.delete(userId), ROBBERY_COOLDOWN);
}
function checkDuelCooldown(userId) {
    const end = duelCooldown.get(userId);
    if (end && Date.now() < end) {
        const r = Math.ceil((end - Date.now()) / 1000);
        return { onCooldown: true, remaining: r, minutes: Math.floor(r/60), seconds: r%60 };
    }
    return { onCooldown: false };
}
function setDuelCooldown(userId) {
    duelCooldown.set(userId, Date.now() + DUEL_COOLDOWN);
    setTimeout(() => duelCooldown.delete(userId), DUEL_COOLDOWN);
}
function checkScenarioCooldown(userId) {
    const end = scenarioCooldown.get(userId);
    if (end && Date.now() < end) {
        const r = Math.ceil((end - Date.now()) / 1000);
        return { onCooldown: true, remaining: r, minutes: Math.floor(r/60), seconds: r%60 };
    }
    return { onCooldown: false };
}
function setScenarioCooldown(userId) {
    scenarioCooldown.set(userId, Date.now() + SCENARIO_COOLDOWN);
    setTimeout(() => scenarioCooldown.delete(userId), SCENARIO_COOLDOWN);
}

// ========== НЕДВИЖИМОСТЬ ==========
function buyProperty(userId, propertyName) {
    const property = PROPERTIES[propertyName];
    if (!property) return { success: false, reason: 'Недвижимость не найдена' };
    if (getCT(userId) < property.price) return { success: false, reason: 'Недостаточно CT' };
    removeCT(userId, property.price);
    userProperties.set(userId, propertyName);
    lastIncomeTime.set(userId, Date.now());
    saveData();
    return { success: true, property: property };
}

function sellProperty(userId) {
    const propertyName = userProperties.get(userId);
    if (!propertyName) return { success: false, reason: 'У вас нет недвижимости' };
    const property = PROPERTIES[propertyName];
    addCT(userId, property.sellPrice);
    userProperties.delete(userId);
    lastIncomeTime.delete(userId);
    saveData();
    return { success: true, property: property, sellPrice: property.sellPrice };
}

function collectIncome(userId) {
    const propertyName = userProperties.get(userId);
    if (!propertyName) return { success: false, reason: 'Нет недвижимости' };
    const property = PROPERTIES[propertyName];
    const lastTime = lastIncomeTime.get(userId) || 0;
    const timePassed = Date.now() - lastTime;
    if (timePassed < property.cooldown) {
        const hoursLeft = Math.floor((property.cooldown - timePassed) / 3600000);
        const minutesLeft = Math.floor(((property.cooldown - timePassed) % 3600000) / 60000);
        return { success: false, reason: `Доход через ${hoursLeft} ч ${minutesLeft} мин` };
    }
    addCT(userId, property.income);
    lastIncomeTime.set(userId, Date.now());
    saveData();
    return { success: true, income: property.income, property: property };
}

function getProperty(userId) {
    const propName = userProperties.get(userId);
    return propName ? PROPERTIES[propName] : null;
}

// ========== ОРУЖИЕ ==========
function buyWeapon(userId, weaponName) {
    const weapon = WEAPONS[weaponName];
    if (!weapon) return { success: false, reason: 'Оружие не найдено' };
    if (getCT(userId) < weapon.price) return { success: false, reason: 'Недостаточно CT' };
    removeCT(userId, weapon.price);
    userWeapons.set(userId, weaponName);
    saveData();
    return { success: true, weapon: weapon };
}

function sellWeapon(userId) {
    const weaponName = userWeapons.get(userId);
    if (!weaponName) return { success: false, reason: 'У вас нет оружия' };
    const weapon = WEAPONS[weaponName];
    addCT(userId, weapon.sellPrice);
    userWeapons.delete(userId);
    saveData();
    return { success: true, weapon: weapon, sellPrice: weapon.sellPrice };
}

// ========== ЩИТ ==========
function buyShield(userId) {
    const SHIELD_PRICE = 1000;
    const SHIELD_DURATION = 6 * 3600000;
    if (getCT(userId) < SHIELD_PRICE) return { success: false, reason: 'Недостаточно CT' };
    removeCT(userId, SHIELD_PRICE);
    userShield.set(userId, { active: true, expires: Date.now() + SHIELD_DURATION });
    saveData();
    return { success: true };
}

function hasShield(userId) {
    const shield = userShield.get(userId);
    if (shield && shield.expires > Date.now()) return true;
    if (shield) userShield.delete(userId);
    return false;
}

// ========== БИРЖА ==========
function getRandomUpdateTime() {
    return Math.floor(Math.random() * (30 - 5 + 1) + 5) * 60000;
}

function updateCryptoPrices(guild) {
    const now = Date.now();
    const notifications = [];
    
    for (let crypto in cryptoPrices) {
        if (!cryptoPrices[crypto].nextUpdate) {
            cryptoPrices[crypto].nextUpdate = now + getRandomUpdateTime();
        }
        
        if (now >= cryptoPrices[crypto].nextUpdate) {
            const old = cryptoPrices[crypto].price;
            
            const isUp = Math.random() < 0.5;
            let percentChange;
            if (isUp) {
                percentChange = (Math.random() * 29) + 1;
            } else {
                percentChange = -(Math.random() * 19 + 1);
            }
            
            let newPrice = Math.floor(old * (1 + percentChange / 100));
            newPrice = Math.max(cryptoPrices[crypto].minPrice, newPrice);
            newPrice = Math.max(1, newPrice);
            
            if (isNaN(newPrice)) newPrice = old;
            
            cryptoPrices[crypto].history.push({ price: newPrice, time: Date.now() });
            if (cryptoPrices[crypto].history.length > 50) cryptoPrices[crypto].history.shift();
            cryptoPrices[crypto].price = newPrice;
            
            const arrow = percentChange > 0 ? '📈 +' : '📉 ';
            notifications.push({ 
                crypto, 
                name: cryptoPrices[crypto].name, 
                emoji: cryptoPrices[crypto].emoji, 
                oldPrice: old, 
                newPrice, 
                percent: Math.abs(percentChange).toFixed(1), 
                arrow 
            });
            
            cryptoPrices[crypto].nextUpdate = now + getRandomUpdateTime();
            cryptoPrices[crypto].lastUpdate = now;
        }
    }
    
    saveData();
    
    if (guild && notifications.length > 0) {
        const ch = guild.channels.cache.find(c => c.name === 'основа');
        if (ch) {
            notifications.forEach(n => {
                if (!isNaN(n.percent) && n.percent !== 'NaN') {
                    ch.send(`${n.emoji} **${n.name}** ${n.arrow}${n.percent}%! ${n.oldPrice} → ${n.newPrice} CT`);
                }
            });
        }
    }
}

function getNextUpdateTimeForCrypto(crypto) {
    if (!cryptoPrices[crypto] || !cryptoPrices[crypto].nextUpdate) return 0;
    const remaining = cryptoPrices[crypto].nextUpdate - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
}

// ========== КУРС CT → РУБЛЬ ==========
function updateCTRate() {
    const change = (Math.random() - 0.5) * 0.05;
    let newRate = ctRate * (1 + change);
    newRate = Math.max(MIN_CT_RATE, Math.min(MAX_CT_RATE, newRate));
    ctRate = newRate;
    marketHistory.push({ rate: ctRate, time: Date.now(), volume: marketVolume });
    if (marketHistory.length > 100) marketHistory.shift();
    marketVolume = 0;
}

// ========== КВЕСТЫ ==========
function getRandomQuests(count = 3) {
    const shuffled = [...ALL_QUESTS];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const timestamp = Date.now();
    return shuffled.slice(0, count).map((q, index) => ({
        ...q,
        id: `${timestamp}_${index}_${q.type}_${q.target}`,
        progress: 0,
        completed: false
    }));
}

function updateUserQuests(userId) {
    if (!userQuests.has(userId)) {
        userQuests.set(userId, { active: getRandomQuests(3), nextUpdate: Date.now() + QUEST_COOLDOWN });
        return;
    }
    const qData = userQuests.get(userId);
    if (Date.now() > qData.nextUpdate) {
        qData.active = getRandomQuests(3);
        qData.nextUpdate = Date.now() + QUEST_COOLDOWN;
        userQuests.set(userId, qData);
    }
}

function checkUserQuest(userId, type, amount = 1, guild = null) {
    updateUserQuests(userId);
    const qData = userQuests.get(userId);
    if (!qData || !qData.active) return 0;
    
    if (!userQuestProgress.has(userId)) userQuestProgress.set(userId, {});
    const prog = userQuestProgress.get(userId);
    
    let totalReward = 0;
    const multiplier = getQuestMultiplier(userId);
    
    for (let q of qData.active) {
        if (q.type === type) {
            const key = q.id;
            const currentProgress = prog[key] || 0;
            const newProgress = currentProgress + amount;
            
            if (newProgress >= q.target && !prog[`${key}_done`]) {
                prog[`${key}_done`] = true;
                const reward = q.reward * multiplier;
                addCT(userId, reward);
                totalReward += reward;
                
                if (guild) {
                    const ch = guild.channels.cache.find(c => c.name === 'основа');
                    if (ch) {
                        ch.send(`🎉 **${guild.members.cache.get(userId)?.displayName || userId}** выполнил квест: ${q.desc} и получил ${reward} CT! ${multiplier > 1 ? '(x2 буст)' : ''}`);
                    }
                }
            } else if (newProgress < q.target) {
                prog[key] = newProgress;
            }
        }
    }
    
    userQuestProgress.set(userId, prog);
    saveData();
    return totalReward;
}

// ========== ПРОВЕРКА АЧИВОК ==========
async function checkAchievements(userId, guild = null) {
    const ct = getCT(userId);
    const spent = casinoSpent.get(userId) || 0;
    const oneTime = oneTimeSpent.get(userId) || 0;
    const transferred = transfersMade.get(userId) || 0;
    const msgs = messageCount.get(userId) || 0;
    const roles = guild?.members?.cache?.get(userId)?.roles?.cache?.size || 0;
    const profit = traderStats.get(userId)?.profit || 0;
    const jpWins = casinoWinCount.get(userId) || 0;
    const voiceStreak = voiceStreakStart.has(userId) ? Math.floor((Date.now() - voiceStreakStart.get(userId)) / 3600000) : 0;
    const rrTimeouts = russianRouletteTimeoutCount.get(userId) || 0;
    const cdAttempts = casinoCooldownAttempts.get(userId) || 0;
    const hasProperty = userProperties.has(userId);
    const hasWeapon = userWeapons.has(userId);
    const nftCount = (userNFTs.get(userId) || []).length;
    let earned = achievements.get(userId);
    if (!earned || !Array.isArray(earned)) { earned = []; achievements.set(userId, earned); }
    for (let [key, ach] of Object.entries(ALL_ACHIEVEMENTS)) {
        if (earned.includes(key)) continue;
        let earnedNow = false;
        if (key === 'bankomat' && ach.check(ct)) earnedNow = true;
        else if (key === 'gambler' && ach.check(spent)) earnedNow = true;
        else if (key === 'fool' && ach.check(oneTime)) earnedNow = true;
        else if (key === 'savior' && ach.check(transferred)) earnedNow = true;
        else if (key === 'talkative' && ach.check(msgs)) earnedNow = true;
        else if (key === 'role_collector' && ach.check(roles)) earnedNow = true;
        else if (key === 'trader' && ach.check(profit)) earnedNow = true;
        else if (key === 'jackpot_winner' && ach.check(jpWins)) earnedNow = true;
        else if (key === 'wash' && ach.check(voiceStreak)) earnedNow = true;
        else if (key === 'unluck' && ach.check(rrTimeouts)) earnedNow = true;
        else if (key === 'lucky' && ach.check(jpWins)) earnedNow = true;
        else if (key === 'genius' && ach.check(cdAttempts)) earnedNow = true;
        else if (key === 'property_owner' && ach.check(hasProperty)) earnedNow = true;
        else if (key === 'rich' && ach.check(ct)) earnedNow = true;
        else if (key === 'armed' && ach.check(hasWeapon)) earnedNow = true;
        else if (key === 'nft_collector' && ach.check(nftCount)) earnedNow = true;
        else if (key === 'jackpot_king' && ach.check(jpWins)) earnedNow = true;
        if (earnedNow) {
            earned.push(key);
            achievements.set(userId, earned);
            saveData();
            if (guild) {
                const ch = guild.channels.cache.find(c => c.name === 'основа');
                if (ch) ch.send(`@everyone 🏆 **${guild.members.cache.get(userId)?.displayName || userId}** получил ачивку **${ach.name}**! 🏆`);
            }
        }
    }
}

// ========== ТОП ==========
function getTopCT() {
    return Array.from(economy.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id,ct],i)=>`${i+1}. <@${id}> — ${ct} CT`).join('\n');
}

function getTopTraders() {
    return Array.from(traderStats.entries()).filter(([_,s])=>s.profit>0).sort((a,b)=>b[1].profit - a[1].profit).slice(0,10).map(([id,s],i)=>`${i+1}. <@${id}> — прибыль: ${s.profit} CT (${s.trades} сделок)`).join('\n');
}

function getTopNFT() {
    const nftCounts = Array.from(userNFTs.entries()).map(([id, nfts]) => ({ id, count: nfts.length }));
    nftCounts.sort((a,b) => b.count - a.count);
    return nftCounts.slice(0,10).map(({id, count}, i) => `${i+1}. <@${id}> — ${count} NFT`).join('\n');
}

function getExtendedLeaderboard(guild) {
    const stats = {
        richest: Array.from(economy.entries()).sort((a,b) => b[1] - a[1]).slice(0,5),
        casino: Array.from(casinoWinCount.entries()).sort((a,b) => b[1] - a[1]).slice(0,5),
        trader: Array.from(traderStats.entries()).sort((a,b) => b[1].profit - a[1].profit).slice(0,5),
        active: Array.from(messageCount.entries()).sort((a,b) => b[1] - a[1]).slice(0,5),
        voice: Array.from(voiceStartTime.entries()).sort((a,b) => (b[1] || 0) - (a[1] || 0)).slice(0,5),
        property: Array.from(userProperties.entries()).map(([id, prop]) => ({ id, prop })).sort((a,b) => PROPERTIES[b.prop]?.price - PROPERTIES[a.prop]?.price).slice(0,5),
        nft: Array.from(userNFTs.entries()).map(([id, nfts]) => ({ id, count: nfts.length })).sort((a,b) => b.count - a.count).slice(0,5)
    };
    return stats;
}

// ========== ВЕБ-СЕРВЕР ==========
const app = express();
const server = http.createServer(app);

app.use(express.json());

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Elliot Bot - Status</title>
            <style>
                body { background: #0a0a0f; color: #0f0; font-family: monospace; padding: 20px; text-align: center; }
                h1 { color: #ff0000; }
            </style>
        </head>
        <body>
            <h1>🤖 ELLIOT BOT</h1>
            <p>Bot is online and running!</p>
            <p>Commands: !помощь</p>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`📊 Web-сервер запущен на порту ${PORT}`);
});

// ========== ЗАГРУЗКА/СОХРАНЕНИЕ ==========
function loadData() {
    try { economy = new Map(Object.entries(JSON.parse(fs.readFileSync('economy.json')))); } catch(e) {}
    try { warnings = new Map(Object.entries(JSON.parse(fs.readFileSync('warnings.json')))); } catch(e) {}
    try { achievements = new Map(Object.entries(JSON.parse(fs.readFileSync('achievements.json')))); } catch(e) {}
    try { userQuests = new Map(Object.entries(JSON.parse(fs.readFileSync('userQuests.json')))); } catch(e) {}
    try { userQuestProgress = new Map(Object.entries(JSON.parse(fs.readFileSync('userQuestProgress.json')))); } catch(e) {}
    try { casinoWinCount = new Map(Object.entries(JSON.parse(fs.readFileSync('casinoWins.json')))); } catch(e) {}
    try { casinoSpent = new Map(Object.entries(JSON.parse(fs.readFileSync('casinoSpent.json')))); } catch(e) {}
    try { oneTimeSpent = new Map(Object.entries(JSON.parse(fs.readFileSync('oneTimeSpent.json')))); } catch(e) {}
    try { transfersMade = new Map(Object.entries(JSON.parse(fs.readFileSync('transfersMade.json')))); } catch(e) {}
    try { top1Weeks = new Map(Object.entries(JSON.parse(fs.readFileSync('top1Weeks.json')))); } catch(e) {}
    try { messageCount = new Map(Object.entries(JSON.parse(fs.readFileSync('messageCount.json')))); } catch(e) {}
    try { userCrypto = new Map(Object.entries(JSON.parse(fs.readFileSync('userCrypto.json')))); } catch(e) {}
    try { traderStats = new Map(Object.entries(JSON.parse(fs.readFileSync('traderStats.json')))); } catch(e) {}
    try { casinoCooldownAttempts = new Map(Object.entries(JSON.parse(fs.readFileSync('casinoCooldownAttempts.json')))); } catch(e) {}
    try { russianRouletteTimeoutCount = new Map(Object.entries(JSON.parse(fs.readFileSync('russianRouletteTimeoutCount.json')))); } catch(e) {}
    try { voiceStreakStart = new Map(Object.entries(JSON.parse(fs.readFileSync('voiceStreakStart.json')))); } catch(e) {}
    try { userWeapons = new Map(Object.entries(JSON.parse(fs.readFileSync('userWeapons.json')))); } catch(e) {}
    try { userShield = new Map(Object.entries(JSON.parse(fs.readFileSync('userShield.json')))); } catch(e) {}
    try { userProperties = new Map(Object.entries(JSON.parse(fs.readFileSync('userProperties.json')))); } catch(e) {}
    try { lastIncomeTime = new Map(Object.entries(JSON.parse(fs.readFileSync('lastIncomeTime.json')))); } catch(e) {}
    try { sellRequests = new Map(Object.entries(JSON.parse(fs.readFileSync('sellRequests.json')))); } catch(e) {}
    try { binaryGames = new Map(Object.entries(JSON.parse(fs.readFileSync('binaryGames.json')))); } catch(e) {}
    try { binaryCooldown = new Map(Object.entries(JSON.parse(fs.readFileSync('binaryCooldown.json')))); } catch(e) {}
    try { activeBoosts = new Map(Object.entries(JSON.parse(fs.readFileSync('activeBoosts.json')))); } catch(e) {}
    try { userNFTs = new Map(Object.entries(JSON.parse(fs.readFileSync('userNFTs.json')))); } catch(e) {}
    try { dailyClaims = new Map(Object.entries(JSON.parse(fs.readFileSync('dailyClaims.json')))); } catch(e) {}
    try { 
        const rateData = JSON.parse(fs.readFileSync('ctRate.json'));
        ctRate = rateData.rate || 0.001;
        marketHistory = rateData.history || [];
    } catch(e) {}
    try { const jp = JSON.parse(fs.readFileSync('jackpot.json')); jackpot = jp.jackpot || JACKPOT_START; } catch(e) {}
    try { const prices = JSON.parse(fs.readFileSync('cryptoPrices.json')); for (let c in prices) cryptoPrices[c] = prices[c]; } catch(e) {}
    
    // ТВОИ КУРСЫ (принудительно)
    cryptoPrices['e-corp'].price = 9379;
    cryptoPrices['Nb'].price = 302;
    cryptoPrices['Fsociety'].price = 45;
    cryptoPrices['KobyCoin'].price = 510;
    
    for (let crypto in cryptoPrices) {
        if (!cryptoPrices[crypto].history) cryptoPrices[crypto].history = [];
        if (!cryptoPrices[crypto].nextUpdate) cryptoPrices[crypto].nextUpdate = Date.now() + getRandomUpdateTime();
        if (!cryptoPrices[crypto].minPrice) {
            if (crypto === 'KobyCoin') cryptoPrices[crypto].minPrice = 75;
            else if (crypto === 'e-corp') cryptoPrices[crypto].minPrice = 40;
            else if (crypto === 'Nb') cryptoPrices[crypto].minPrice = 30;
            else if (crypto === 'Fsociety') cryptoPrices[crypto].minPrice = 40;
        }
    }
    for (let [id, bal] of economy) if (bal < 0) economy.set(id, 0);
    saveData();
}

function saveData() {
    fs.writeFileSync('economy.json', JSON.stringify(Object.fromEntries(economy), null, 2));
    fs.writeFileSync('warnings.json', JSON.stringify(Object.fromEntries(warnings), null, 2));
    fs.writeFileSync('achievements.json', JSON.stringify(Object.fromEntries(achievements), null, 2));
    fs.writeFileSync('userQuests.json', JSON.stringify(Object.fromEntries(userQuests), null, 2));
    fs.writeFileSync('userQuestProgress.json', JSON.stringify(Object.fromEntries(userQuestProgress), null, 2));
    fs.writeFileSync('casinoWins.json', JSON.stringify(Object.fromEntries(casinoWinCount), null, 2));
    fs.writeFileSync('casinoSpent.json', JSON.stringify(Object.fromEntries(casinoSpent), null, 2));
    fs.writeFileSync('oneTimeSpent.json', JSON.stringify(Object.fromEntries(oneTimeSpent), null, 2));
    fs.writeFileSync('transfersMade.json', JSON.stringify(Object.fromEntries(transfersMade), null, 2));
    fs.writeFileSync('top1Weeks.json', JSON.stringify(Object.fromEntries(top1Weeks), null, 2));
    fs.writeFileSync('messageCount.json', JSON.stringify(Object.fromEntries(messageCount), null, 2));
    fs.writeFileSync('userCrypto.json', JSON.stringify(Object.fromEntries(userCrypto), null, 2));
    fs.writeFileSync('traderStats.json', JSON.stringify(Object.fromEntries(traderStats), null, 2));
    fs.writeFileSync('casinoCooldownAttempts.json', JSON.stringify(Object.fromEntries(casinoCooldownAttempts), null, 2));
    fs.writeFileSync('russianRouletteTimeoutCount.json', JSON.stringify(Object.fromEntries(russianRouletteTimeoutCount), null, 2));
    fs.writeFileSync('voiceStreakStart.json', JSON.stringify(Object.fromEntries(voiceStreakStart), null, 2));
    fs.writeFileSync('userWeapons.json', JSON.stringify(Object.fromEntries(userWeapons), null, 2));
    fs.writeFileSync('userShield.json', JSON.stringify(Object.fromEntries(userShield), null, 2));
    fs.writeFileSync('userProperties.json', JSON.stringify(Object.fromEntries(userProperties), null, 2));
    fs.writeFileSync('lastIncomeTime.json', JSON.stringify(Object.fromEntries(lastIncomeTime), null, 2));
    fs.writeFileSync('sellRequests.json', JSON.stringify(Object.fromEntries(sellRequests), null, 2));
    fs.writeFileSync('binaryGames.json', JSON.stringify(Object.fromEntries(binaryGames), null, 2));
    fs.writeFileSync('binaryCooldown.json', JSON.stringify(Object.fromEntries(binaryCooldown), null, 2));
    fs.writeFileSync('activeBoosts.json', JSON.stringify(Object.fromEntries(activeBoosts), null, 2));
    fs.writeFileSync('userNFTs.json', JSON.stringify(Object.fromEntries(userNFTs), null, 2));
    fs.writeFileSync('dailyClaims.json', JSON.stringify(Object.fromEntries(dailyClaims), null, 2));
    fs.writeFileSync('ctRate.json', JSON.stringify({ rate: ctRate, history: marketHistory }, null, 2));
    fs.writeFileSync('jackpot.json', JSON.stringify({ jackpot }, null, 2));
    fs.writeFileSync('cryptoPrices.json', JSON.stringify(cryptoPrices, null, 2));
}

// ========== ОСНОВНОЙ ОБРАБОТЧИК ==========
client.once('ready', () => {
    console.log(`✅ Бот запущен: ${client.user.tag}`);
    loadData();
    client.user.setActivity('!помощь | Хаос-токены');
    const guild = client.guilds.cache.first();
    
    setInterval(() => {
        updateCryptoPrices(guild);
        updateCTRate();
        checkAndGrantBoost(guild);
        sendCryptoNews(guild);
        const top = getTopCT().split('\n');
        if (top[0]) {
            const id = top[0].match(/<@(\d+)>/)?.[1];
            if (id) top1Weeks.set(id, (top1Weeks.get(id)||0)+1/168);
            saveData();
        }
    }, 10000);
    
    setInterval(() => saveData(), 3600000);
});

// ========== ОБРАБОТЧИК СООБЩЕНИЙ ==========
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Проверка шахты
    if (minePrisoners.has(message.author.id)) {
        const prisoner = minePrisoners.get(message.author.id);
        if (message.content.toLowerCase() === 'вскопал' && prisoner.expectedResponse) {
            prisoner.progress++;
            prisoner.expectedResponse = false;
            
            if (prisoner.progress >= prisoner.required) {
                clearInterval(prisoner.interval);
                minePrisoners.delete(message.author.id);
                message.reply(`🎉 **Вы освободились из шахты!** Успешно ответили на ${prisoner.required} вызовов!`);
            } else {
                message.reply(`✅ Прогресс: ${prisoner.progress}/${prisoner.required}. Осталось ответить на ${prisoner.required - prisoner.progress} вызовов.`);
            }
            return;
        } else if (message.content.startsWith(PREFIX)) {
            return message.reply(`⛏️ Вы в шахте! Нельзя использовать команды, пока не освободитесь. Напишите "вскопал" когда бот скажет "КОПАЙ!"`);
        }
    }
    
    messageCount.set(message.author.id, (messageCount.get(message.author.id)||0)+1);
    checkAchievements(message.author.id, message.guild);
    checkUserQuest(message.author.id, 'msg', 1, message.guild);
    
    if (message.mentions.has(client.user)) {
        const content = message.content.replace(/<@!?\d+>/g, '').trim();
        if (!content) return message.reply('Чего хочешь? !помощь');
        const phrases = ["Привет, друг.", "Мы - fsociety.", "Система пала.", "Я - вирус."];
        return message.reply(phrases[Math.floor(Math.random()*phrases.length)]);
    }
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ========== КОМАНДЫ ==========
    
    if (command === 'ежедневный' || command === 'бонус') {
        const result = getDailyReward(message.author.id);
        if (!result.success) {
            const hoursLeft = Math.ceil((result.nextClaim - Date.now()) / 3600000);
            message.reply(`⏰ Вы уже получали бонус сегодня! Следующий через ${hoursLeft} ч. Текущий стрик: ${result.streak} дней.`);
        } else {
            message.reply(`🎁 **ЕЖЕДНЕВНЫЙ БОНУС!**\n+${result.reward} CT${result.bonusText}\n🔥 Стрик: ${result.streak} дней!`);
        }
    }
    
    else if (command === 'джекпот') {
        message.reply(`💰 **ТЕКУЩИЙ ДЖЕКПОТ**: ${jackpot} CT! 🎰\nШанс выиграть: 2% в слотах!`);
    }
    
    else if (command === 'график') {
        const cryptoName = args[0]?.toLowerCase();
        let cryptoKey = null;
        if (cryptoName === 'e-corp' || cryptoName === 'ecorp') cryptoKey = 'e-corp';
        else if (cryptoName === 'nb') cryptoKey = 'Nb';
        else if (cryptoName === 'fsociety') cryptoKey = 'Fsociety';
        else if (cryptoName === 'kobycoin' || cryptoName === 'kbc') cryptoKey = 'KobyCoin';
        
        if (!cryptoKey) {
            return message.reply('❌ Доступно: e-corp, Nb, Fsociety, KobyCoin\nПример: `!график e-corp`');
        }
        
        const chartUrl = await getCryptoChart(cryptoKey, cryptoPrices[cryptoKey].name);
        if (!chartUrl) {
            return message.reply('❌ Недостаточно данных для графика. Подождите немного.');
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`📈 График ${cryptoPrices[cryptoKey].name}`)
            .setImage(chartUrl)
            .setColor(0x00ff00)
            .setFooter({ text: `Текущая цена: ${cryptoPrices[cryptoKey].price} CT` });
        
        message.reply({ embeds: [embed] });
    }
    
    else if (command === 'топ_nft') {
        const top = getTopNFT();
        message.reply(`🃏 **ТОП КОЛЛЕКЦИОНЕРОВ NFT**\n${top || 'Нет данных'}`);
    }
    
    else if (command === 'продать_nft') {
        const nftId = args[0];
        if (!nftId) {
            const nfts = getNFTsList(message.author.id);
            if (nfts.length === 0) return message.reply('❌ У вас нет NFT');
            const list = nfts.map((n, i) => `${i+1}. ID: \`${n.id}\` — ${n.emoji} ${n.name} (продажа: ${Math.floor(n.price * NFT_SELL_RETURN)} CT)`).join('\n');
            return message.reply(`🃏 **Ваши NFT**\n${list}\n\n!продать_nft [ID]`);
        }
        
        const result = sellNFT(message.author.id, nftId);
        if (!result.success) {
            message.reply(`❌ ${result.reason}`);
        } else {
            message.reply(`💰 Продана **${result.nft.emoji} ${result.nft.name}** за ${result.sellPrice} CT! (-80% от стоимости)`);
        }
    }
    
    else if (command === 'обменять_nft') {
        const target = await findMemberByName(message.guild, args[0]);
        const nftId = args[1];
        
        if (!target || !nftId) {
            return message.reply('❌ !обменять_nft @пользователь [ID_nft]\n\nПосмотреть ID NFT: `!коллекция`');
        }
        
        if (target.id === message.author.id) return message.reply('❌ Нельзя обменяться с собой');
        
        const nfts = getNFTsList(message.author.id);
        const nft = nfts.find(n => n.id === nftId);
        if (!nft) return message.reply('❌ У вас нет такого NFT');
        
        pendingNFTTrades.set(target.id, { fromUserId: message.author.id, nftId, nftData: nft, timestamp: Date.now() });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_trade_${message.author.id}`)
                    .setLabel('✅ Принять обмен')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_trade_${message.author.id}`)
                    .setLabel('❌ Отклонить')
                    .setStyle(ButtonStyle.Danger)
            );
        
        message.reply(`🔄 **ЗАПРОС НА ОБМЕН NFT**\n${target.displayName}, пользователь ${message.author.displayName} хочет обменять:\n${nft.emoji} **${nft.name}** (${nft.rarity})\n\nВыберите действие:`, { components: [row] });
    }
    
    else if (command === 'инфо') {
        const target = await findMemberByName(message.guild, args.join(' ')) || message.member;
        const userId = target.id;
        const weapon = getWeapon(userId);
        const prop = getProperty(userId);
        const nftCount = (userNFTs.get(userId) || []).length;
        const wins = casinoWinCount.get(userId) || 0;
        const spent = casinoSpent.get(userId) || 0;
        const dailyData = dailyClaims.get(userId);
        const streak = dailyData?.streak || 0;
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 Информация о ${target.displayName}`)
            .setColor(0x00ff00)
            .addFields(
                { name: '💰 Баланс', value: `${getCT(userId)} CT`, inline: true },
                { name: '🏆 Побед в казино', value: `${wins}`, inline: true },
                { name: '🎰 Потрачено в казино', value: `${spent} CT`, inline: true },
                { name: '🔫 Оружие', value: weapon ? `${weapon.emoji} ${weapon.name}` : 'нет', inline: true },
                { name: '🏠 Недвижимость', value: prop ? `${prop.emoji} ${prop.name}` : 'нет', inline: true },
                { name: '🃏 NFT', value: `${nftCount} карточек`, inline: true },
                { name: '🔥 Стрик', value: `${streak} дней`, inline: true }
            );
        
        message.reply({ embeds: [embed] });
    }
    
    // ========== КНБ С КД 3 МИНУТЫ ==========
    else if (command === 'кнб') {
        const cd = rpsCooldown.get(message.author.id);
        if (cd && Date.now() < cd) {
            const remaining = Math.ceil((cd - Date.now()) / 1000);
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            return message.reply(`⏰ Подождите ${minutes} мин ${seconds} сек перед новой игрой в КНБ!`);
        }
        
        const choice = args[0];
        if (!choice) return message.reply('❌ !кнб камень/ножницы/бумага');
        const bot = ['камень','ножницы','бумага'][Math.floor(Math.random()*3)];
        let res = choice===bot?'Ничья':((choice==='камень'&&bot==='ножницы')||(choice==='ножницы'&&bot==='бумага')||(choice==='бумага'&&bot==='камень'))?'✅ Вы выиграли':'❌ Я выиграл';
        if (res === '✅ Вы выиграли') checkUserQuest(message.author.id, 'rps', 1, message.guild);
        message.reply(`Я выбрал **${bot}**. ${res}`);
        
        rpsCooldown.set(message.author.id, Date.now() + RPS_COOLDOWN);
        setTimeout(() => rpsCooldown.delete(message.author.id), RPS_COOLDOWN);
    }
    
    // ========== ОСТАЛЬНЫЕ КОМАНДЫ ==========
    else if (command === 'войс') {
        if (!message.member.voice.channel) return message.reply('❌ Ты не в войсе');
        let conn = voiceConnections.get(message.guild.id);
        if (conn) conn.destroy();
        conn = joinVoiceChannel({ channelId: message.member.voice.channel.id, guildId: message.guild.id, adapterCreator: message.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
        voiceConnections.set(message.guild.id, conn);
        message.reply(`✅ Подключился к ${message.member.voice.channel.name}`);
        if (!voiceStreakStart.has(message.author.id)) voiceStreakStart.set(message.author.id, Date.now());
    }
    else if (command === 'покинуть') {
        const conn = voiceConnections.get(message.guild.id);
        if (conn) { conn.destroy(); voiceConnections.delete(message.guild.id); message.reply('👋 Отключился'); }
        else message.reply('❌ Я не в войсе');
        voiceStreakStart.delete(message.author.id);
    }
    else if (command === 'скажи') {
        const text = args.join(' ');
        if (!text) return message.reply('❌ !скажи привет');
        if (!voiceConnections.get(message.guild.id)) return message.reply('❌ Бот не в войсе');
        await speakText(message.guild, text);
        message.react('🔊');
    }
    else if (command === 'замутить') {
        if (!isAdmin(message.member)) return message.reply('❌ Только админы');
        const member = await findMemberByName(message.guild, args.join(' '));
        if (!member) return message.reply('❌ Не найден');
        if (!member.voice.channel) return message.reply('❌ Не в войсе');
        await member.voice.setMute(true);
        message.reply(`🔇 ${member.displayName} замучен`);
    }
    else if (command === 'размутить') {
        if (!isAdmin(message.member)) return message.reply('❌ Только админы');
        const member = await findMemberByName(message.guild, args.join(' '));
        if (!member) return message.reply('❌ Не найден');
        await member.voice.setMute(false);
        message.reply(`🔊 ${member.displayName} размучен`);
    }
    else if (command === 'забань') {
        if (!isAdmin(message.member)) return message.reply('❌ Только админы');
        const member = await findMemberByName(message.guild, args.join(' '));
        if (!member) return message.reply('❌ Не найден');
        const mins = parseInt(args[1]) || 10;
        await member.timeout(mins*60000);
        message.reply(`🔇 ${member.displayName} в тайм-ауте ${mins} мин`);
    }
    else if (command === 'разбань') {
        if (!isAdmin(message.member)) return message.reply('❌ Только админы');
        const member = await findMemberByName(message.guild, args.join(' '));
        if (!member) return message.reply('❌ Не найден');
        await member.timeout(null);
        message.reply(`✅ ${member.displayName} разбанен`);
    }
    else if (command === 'отключи') {
        if (!isAdmin(message.member)) return message.reply('❌ Только админы');
        const member = await findMemberByName(message.guild, args.join(' '));
        if (!member) return message.reply('❌ Не найден');
        if (!member.voice.channel) return message.reply('❌ Не в войсе');
        await member.voice.disconnect();
        message.reply(`🔌 ${member.displayName} отключён`);
        voiceStreakStart.delete(member.id);
    }
    else if (command === 'перекинь') {
        const match = args.join(' ').match(/(.+?)\s+в\s+(.+)/i);
        if (!match) return message.reply('❌ !перекинь вася в общий');
        const member = await findMemberByName(message.guild, match[1].trim());
        if (!member) return message.reply('❌ Не найден');
        const ch = await findChannelByName(message.guild, match[2].trim());
        if (!ch) return message.reply('❌ Канал не найден');
        if (!member.voice.channel) return message.reply('❌ Не в войсе');
        await member.voice.setChannel(ch);
        message.reply(`🔄 ${member.displayName} → ${ch.name}`);
    }
    else if (command === 'брось_кубик') { message.reply(`🎲 ${Math.floor(Math.random()*6)+1}`); }
    else if (command === 'монетка') { message.reply(`🪙 ${Math.random()>0.5?'Орёл':'Решка'}`); }
    else if (command === 'монетка_ставка') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet < MIN_BET) return message.reply(`❌ Минимальная ставка ${MIN_BET} CT`);
        const cd = checkCasinoCooldown(message.author.id);
        if (cd.onCooldown) {
            casinoCooldownAttempts.set(message.author.id, (casinoCooldownAttempts.get(message.author.id)||0)+1);
            checkAchievements(message.author.id, message.guild);
            return message.reply(`⏰ Подождите ${cd.remaining} сек`);
        }
        if (!removeCT(message.author.id, bet)) return message.reply('❌ Недостаточно CT');
        setCasinoCooldown(message.author.id);
        const { result, win } = coinFlip(bet, message.author.id);
        addCT(message.author.id, win);
        checkUserQuest(message.author.id, 'casino', 1, message.guild);
        if (win > 0) checkUserQuest(message.author.id, 'casino_win', 1, message.guild);
        message.reply(`🪙 ${result}\n${win>0?`Выигрыш ${win} CT`:`Проигрыш ${bet} CT`}`);
    }
    else if (command === 'картинка') { message.reply({ embeds:[{image:{url:"https://media.giphy.com/media/3o7abB06u9bNzA8LC8/giphy.gif"}}] }); }
    else if (command === 'погода') {
        const city = args.join(' ') || 'Москва';
        try {
            const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%t+%c+%w+%h&lang=ru`);
            const data = await res.text();
            message.reply(`🌍 **${city}**: ${data}`);
        } catch { message.reply('❌ Не удалось получить погоду'); }
    }
    else if (command === 'твит') {
        try {
            const res = await fetch('https://lenta.ru/rss/news');
            const txt = await res.text();
            const titles = txt.match(/<title>(.*?)<\/title>/g);
            if (titles && titles.length > 1) {
                const news = titles.slice(1,5).map((t,i)=>`${i+1}. ${t.replace(/<\/?title>/g,'')}`).join('\n');
                message.reply(`📰 **Новости**\n${news}`);
            } else message.reply('❌ Не удалось загрузить новости');
        } catch { message.reply('❌ Ошибка загрузки новостей'); }
    }
    else if (command === 'розыгрыш') {
        const botVc = message.guild.members.me.voice.channel;
        if (!botVc) return message.reply('❌ Бот не в войсе, используй !войс');
        const members = botVc.members.filter(m => !m.user.bot);
        if (!members.size) return message.reply('❌ Нет участников');
        const winner = members.random();
        addCT(winner.id, 50);
        message.reply(`🎉 Победитель: ${winner.displayName} +50 CT!`);
        checkUserQuest(message.author.id, 'raffle', 1, message.guild);
    }
    else if (command === 'курс_ct') {
        const ctPerRub = Math.floor(1 / ctRate);
        const rubPer1000Ct = (1000 * ctRate).toFixed(2);
        message.reply(`💰 **Курс Хаос-токена**:\n1 ₽ = **${ctPerRub} CT**\n1000 CT = **${rubPer1000Ct} ₽**\n📊 Объём торгов за день: ${marketVolume} CT\n📈 История: ${marketHistory.slice(-5).map(h=>`${(1/h.rate).toFixed(0)} CT/₽`).join(' → ')}`);
    }
    else if (command === 'продать_ct') {
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 50) return message.reply('❌ Минимальная продажа 50 CT');
        if (getCT(message.author.id) < amount) return message.reply('❌ Недостаточно CT');
        const revenue = amount * ctRate;
        sellRequests.set(message.author.id, { amount, revenue, type: 'sell', date: Date.now(), status: 'pending' });
        saveData();
        message.reply(`✅ Заявка на продажу **${amount} CT** создана!\n💰 Вы получите: ${revenue.toFixed(2)} ₽\n📩 Админ свяжется с тобой`);
        const adminChannel = message.guild.channels.cache.find(c => c.name === 'админ-чат');
        if (adminChannel) adminChannel.send(`🔔 **НОВАЯ ЗАЯВКА!**\n👤 ${message.author.tag}\n📤 Продажа ${amount} CT (${revenue.toFixed(2)} ₽)\n!обработать ${message.author.id} продать ${amount}`);
    }
    else if (command === 'недвижимость') {
        const list = Object.entries(PROPERTIES).map(([k, p]) => `${p.emoji} **${p.name}** — ${p.price} CT (доход: ${p.income} CT/${Math.floor(p.cooldown/3600000)}ч, продажа: ${p.sellPrice} CT)`).join('\n');
        message.reply(`🏠 **НЕДВИЖИМОСТЬ**\n${list}\n\n!купить_дом [название]\n!собрать_доход\n!продать_дом`);
    }
    else if (command === 'купить_дом') {
        const propName = args.join(' ');
        let key = null;
        for (let k in PROPERTIES) {
            if (PROPERTIES[k].name.toLowerCase() === propName.toLowerCase()) key = k;
        }
        if (!key) return message.reply('❌ Доступно: хибара, квартира, дом, особняк, будка, подвал, замок');
        const result = buyProperty(message.author.id, key);
        if (result.success) {
            message.reply(`🏠 Вы купили **${result.property.name}** ${result.property.emoji} за ${result.property.price} CT!\n💰 Доход: ${result.property.income} CT каждые ${Math.floor(result.property.cooldown/3600000)} ч`);
            checkAchievements(message.author.id, message.guild);
        } else {
            message.reply(`❌ ${result.reason}`);
        }
    }
    else if (command === 'собрать_доход') {
        const result = collectIncome(message.author.id);
        if (result.success) {
            message.reply(`🏠 Вы собрали доход с **${result.property.name}**: +${result.income} CT!`);
        } else {
            message.reply(`❌ ${result.reason}`);
        }
    }
    else if (command === 'продать_дом') {
        const result = sellProperty(message.author.id);
        if (result.success) {
            message.reply(`🏠 Вы продали **${result.property.name}** за ${result.sellPrice} CT! (-30% от стоимости покупки)`);
        } else {
            message.reply(`❌ ${result.reason}`);
        }
    }
    else if (command === 'моя_недвижимость') {
        const prop = getProperty(message.author.id);
        if (!prop) return message.reply('🏠 У вас нет недвижимости');
        const lastIncome = lastIncomeTime.get(message.author.id) || 0;
        const timeLeft = Math.max(0, prop.cooldown - (Date.now() - lastIncome));
        const hoursLeft = Math.floor(timeLeft / 3600000);
        const minutesLeft = Math.floor((timeLeft % 3600000) / 60000);
        message.reply(`🏠 **Ваша недвижимость**: ${prop.emoji} ${prop.name}\n💰 Доход: ${prop.income} CT/${Math.floor(prop.cooldown/3600000)}ч\n⏰ Следующий доход через: ${hoursLeft} ч ${minutesLeft} мин`);
    }
    else if (command === 'оружие') {
        const list = Object.entries(WEAPONS).map(([k, w]) => `${w.emoji} **${w.name}** — ${w.price} CT (шанс успеха: ${w.chance*100}%, продажа: ${w.sellPrice} CT)`).join('\n');
        message.reply(`🔫 **ОРУЖИЕ**\n${list}\n\n!купить_оружие [название]\n!продать_оружие\n!моё_оружие`);
    }
    else if (command === 'купить_оружие') {
        const weaponName = args[0]?.toLowerCase();
        if (!weaponName || !WEAPONS[weaponName]) return message.reply('❌ Доступно: бита, нож, пистолет, снайперка');
        const result = buyWeapon(message.author.id, weaponName);
        if (result.success) {
            message.reply(`🔫 Вы купили **${result.weapon.name}** ${result.weapon.emoji} за ${result.weapon.price} CT!\n🎯 Шанс успеха при ограблении: ${result.weapon.chance*100}%`);
            checkAchievements(message.author.id, message.guild);
        } else {
            message.reply(`❌ ${result.reason}`);
        }
    }
    else if (command === 'продать_оружие') {
        const result = sellWeapon(message.author.id);
        if (result.success) {
            message.reply(`🔫 Вы продали **${result.weapon.name}** за ${result.sellPrice} CT! (-15% от стоимости покупки)`);
        } else {
            message.reply(`❌ ${result.reason}`);
        }
    }
    else if (command === 'моё_оружие') {
        const weapon = getWeapon(message.author.id);
        if (!weapon) return message.reply('🔫 У вас нет оружия');
        message.reply(`🔫 Ваше оружие: ${weapon.emoji} **${weapon.name}** (шанс успеха: ${weapon.chance*100}%)`);
    }
    else if (command === 'щит') {
        const shield = userShield.get(message.author.id);
        if (shield && shield.expires > Date.now()) {
            const hoursLeft = Math.floor((shield.expires - Date.now()) / 3600000);
            const minutesLeft = Math.floor(((shield.expires - Date.now()) % 3600000) / 60000);
            message.reply(`🛡️ У вас активен щит! Защита от ограблений. Осталось: ${hoursLeft} ч ${minutesLeft} мин`);
        } else {
            message.reply(`🛡️ У вас нет щита. Купить за 1000 CT: !купить_щит (защита на 6 часов)`);
        }
    }
    else if (command === 'купить_щит') {
        const result = buyShield(message.author.id);
        if (result.success) {
            message.reply(`🛡️ Вы купили щит за 1000 CT! Он защитит вас от ограблений в течение 6 часов.`);
        } else {
            message.reply(`❌ ${result.reason}`);
        }
    }
    else if (command === 'биржа') {
        const action = args[0]?.toLowerCase();
        const crypto = args[1]?.toLowerCase();
        const amount = parseInt(args[2]);
        if (!action) {
            const prices = Object.entries(cryptoPrices).map(([k,d])=>`${d.emoji} **${d.name}**: ${d.price} CT`).join('\n');
            const updatesInfo = Object.entries(cryptoPrices).map(([k,d]) => {
                const sec = getNextUpdateTimeForCrypto(k);
                const minutes = Math.floor(sec / 60);
                const seconds = sec % 60;
                return `${d.emoji} ${d.name}: ${minutes} мин ${seconds} сек`;
            }).join('\n');
            return message.reply(`📈 **Курсы крипты**\n${prices}\n\n⏰ **Следующие обновления:**\n${updatesInfo}\n\n!биржа купить e-corp 100\n!биржа продать Nb 50\n!биржа баланс\n!биржа топ`);
        }
        if (action === 'топ') return message.reply(`🏆 **Топ трейдеров**\n${getTopTraders() || 'Нет данных'}`);
        if (action === 'баланс') {
            const uc = userCrypto.get(message.author.id) || { 'e-corp':0, 'Nb':0, 'Fsociety':0, 'KobyCoin':0 };
            const bal = Object.entries(uc).map(([n,a])=>`${cryptoPrices[n]?.emoji} ${cryptoPrices[n]?.name}: ${a} (≈${a*(cryptoPrices[n]?.price||0)} CT)`).join('\n');
            return message.reply(`💰 **Крипто-портфель**\n${bal}\nОбщая стоимость: ${Object.entries(uc).reduce((s,[n,a])=>s+a*(cryptoPrices[n]?.price||0),0)} CT`);
        }
        let key = null;
        if (crypto === 'e-corp' || crypto === 'ecorp') key = 'e-corp';
        else if (crypto === 'nb') key = 'Nb';
        else if (crypto === 'fsociety') key = 'Fsociety';
        else if (crypto === 'kobycoin' || crypto === 'kbc') key = 'KobyCoin';
        if (!key) return message.reply('❌ Доступно: e-corp, Nb, Fsociety, KobyCoin');
        if (action === 'купить') {
            if (isNaN(amount) || amount < 1) return message.reply('❌ Укажите количество');
            const cost = amount * cryptoPrices[key].price;
            if (getCT(message.author.id) < cost) return message.reply(`❌ Недостаточно CT, нужно ${cost}`);
            removeCT(message.author.id, cost);
            const uc = userCrypto.get(message.author.id) || { 'e-corp':0, 'Nb':0, 'Fsociety':0, 'KobyCoin':0 };
            uc[key] = (uc[key]||0) + amount;
            userCrypto.set(message.author.id, uc);
            const stats = traderStats.get(message.author.id) || { profit:0, trades:0 };
            stats.trades++;
            traderStats.set(message.author.id, stats);
            saveData();
            message.reply(`✅ Куплено ${amount} ${cryptoPrices[key].name} за ${cost} CT`);
            checkUserQuest(message.author.id, 'crypto_trade', 1, message.guild);
        } else if (action === 'продать') {
            if (isNaN(amount) || amount < 1) return message.reply('❌ Укажите количество');
            const uc = userCrypto.get(message.author.id) || { 'e-corp':0, 'Nb':0, 'Fsociety':0, 'KobyCoin':0 };
            if ((uc[key]||0) < amount) return message.reply('❌ Нет столько');
            const revenue = amount * cryptoPrices[key].price;
            uc[key] -= amount;
            userCrypto.set(message.author.id, uc);
            const multiplier = getExchangeMultiplier(message.author.id);
            const finalRevenue = revenue * multiplier;
            addCT(message.author.id, finalRevenue);
            const stats = traderStats.get(message.author.id) || { profit:0, trades:0 };
            stats.trades++;
            stats.profit += finalRevenue - (amount * (cryptoPrices[key].history[cryptoPrices[key].history.length-2]?.price || cryptoPrices[key].price));
            traderStats.set(message.author.id, stats);
            saveData();
            message.reply(`✅ Продано ${amount} ${cryptoPrices[key].name} за ${finalRevenue} CT! ${multiplier > 1 ? `(x${multiplier} ${multiplier > 2 ? 'NFT бонус + буст' : 'бонус'})` : ''}`);
            checkUserQuest(message.author.id, 'crypto_trade', 1, message.guild);
            checkUserQuest(message.author.id, 'crypto_profit', finalRevenue - (amount * (cryptoPrices[key].history[cryptoPrices[key].history.length-2]?.price || cryptoPrices[key].price)), message.guild);
            checkAchievements(message.author.id, message.guild);
        }
    }
    else if (command === 'бинарный_код') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet < MIN_BET) return message.reply(`❌ Минимальная ставка ${MIN_BET} CT`);
        if (getCT(message.author.id) < bet) return message.reply('❌ Недостаточно CT');
        
        const cd = checkBinaryCooldown(message.author.id);
        if (cd.onCooldown) {
            return message.reply(`⏰ Подождите **${cd.minutes} мин ${cd.seconds} сек** перед следующей игрой в бинарный код!`);
        }
        
        if (binaryGames.has(message.author.id)) {
            return message.reply('❌ У вас уже есть активная игра! Закончите её командой !угадать [0/1]');
        }
        
        removeCT(message.author.id, bet);
        const { sequence, bet: gameBet } = startBinaryGame(message.author.id, bet);
        setBinaryCooldown(message.author.id);
        message.reply(`🔢 **БИНАРНЫЙ КОД**\nСтавка: ${gameBet} CT\n\nПоследовательность: \`${sequence}\`\n\nКакой следующий бит? (0 или 1)\nОтветьте: \`!угадать 0\` или \`!угадать 1\``);
    }
    else if (command === 'угадать') {
        const guess = args[0];
        if (!binaryGames.has(message.author.id)) return message.reply('❌ Нет активной игры. Начните новую: !бинарный_код [ставка]');
        if (guess !== '0' && guess !== '1') return message.reply('❌ Угадывать нужно 0 или 1');
        
        const result = checkBinaryGuess(message.author.id, guess);
        if (result.error) return message.reply(result.error);
        if (result.lose) {
            message.reply(result.message);
        } else if (result.win) {
            message.reply(`${result.message}\n💰 Выигрыш: ${result.win} CT`);
            checkUserQuest(message.author.id, 'binary_win', 1, message.guild);
        } else {
            message.reply(`${result.message}\n\nНовая последовательность: \`${result.nextSequence}\`\nОсталось угадать: ${result.guesses}/3`);
        }
    }
    else if (command === 'взлом') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet < MIN_BET) return message.reply(`❌ Минимальная ставка ${MIN_BET} CT`);
        if (getCT(message.author.id) < bet) return message.reply('❌ Недостаточно CT');
        
        if (hackGames.has(message.author.id)) return message.reply('❌ У вас уже активна игра во взлом!');
        
        removeCT(message.author.id, bet);
        const game = new HackGame(message.author.id, bet);
        hackGames.set(message.author.id, game);
        
        const validTools = game.tools.scan.join(', ');
        message.reply(`💻 **НАЧАЛО ВЗЛОМА**\nЦель: ${game.currentServer}\nСтавка: ${bet} CT\n\nШаг 1: СКАНИРОВАНИЕ (scan)\nИспользуйте инструменты: ${validTools}\n\nПример: \`!сканировать nmap\``);
    }
    else if (command === 'сканировать' || command === 'эксплуатировать' || command === 'очистить') {
        const game = hackGames.get(message.author.id);
        if (!game) return message.reply('❌ Нет активной игры! Начните новую: !взлом 100');
        
        const choice = args[0]?.toLowerCase();
        if (!choice) return message.reply(`❌ Укажите инструмент. Доступно: ${game.tools[game.steps[game.currentStep]].join(', ')}`);
        
        const result = game.processStep(choice);
        if (result.success) {
            if (result.win) {
                hackGames.delete(message.author.id);
                message.reply(`${result.message}\n💰 Выигрыш: ${result.win} CT`);
                checkUserQuest(message.author.id, 'hack_win', 1, message.guild);
            } else {
                message.reply(result.message);
            }
        } else {
            hackGames.delete(message.author.id);
            message.reply(result.message);
        }
    }
    else if (command === 'лутбокс') {
        const price = 500;
        if (getCT(message.author.id) < price) return message.reply(`❌ Недостаточно CT! Нужно ${price} CT`);
        removeCT(message.author.id, price);
        const result = openLootbox(message.author.id);
        if (!result.success) {
            message.reply(`❌ ${result.reason}`);
        } else {
            message.reply(`🎁 **Вы открыли лутбокс!**\n📦 Получено: ${result.nft.emoji} **${result.nft.name}** (${result.nft.rarity})\n✨ Бонус: ${result.nft.bonus}\n💰 Стоимость: ${result.nft.price} CT`);
            checkAchievements(message.author.id, message.guild);
        }
    }
    else if (command === 'коллекция') {
        const nfts = userNFTs.get(message.author.id) || [];
        if (nfts.length === 0) return message.reply('❌ У вас нет NFT-карточек');
        
        const byRarity = {
            mythic: nfts.filter(n => n.rarity === 'mythic'),
            legendary: nfts.filter(n => n.rarity === 'legendary'),
            epic: nfts.filter(n => n.rarity === 'epic'),
            special: nfts.filter(n => n.rarity === 'special'),
            rare: nfts.filter(n => n.rarity === 'rare'),
            common: nfts.filter(n => n.rarity === 'common')
        };
        
        const embed = {
            title: '🃏 ВАША NFT КОЛЛЕКЦИЯ',
            color: 0xffd700,
            fields: [
                { name: '👑 Мифические', value: byRarity.mythic.map(n => `${n.emoji} ${n.name} (ID: \`${n.id}\`)`).join('\n') || 'Нет', inline: true },
                { name: '💎 Легендарные', value: byRarity.legendary.map(n => `${n.emoji} ${n.name} (ID: \`${n.id}\`)`).join('\n') || 'Нет', inline: true },
                { name: '✨ Эпические', value: byRarity.epic.map(n => `${n.emoji} ${n.name} (ID: \`${n.id}\`)`).join('\n') || 'Нет', inline: true },
                { name: '⭐ Специальные', value: byRarity.special.map(n => `${n.emoji} ${n.name} (ID: \`${n.id}\`)`).join('\n') || 'Нет', inline: true },
                { name: '🎴 Редкие', value: byRarity.rare.map(n => `${n.emoji} ${n.name} (ID: \`${n.id}\`)`).join('\n') || 'Нет', inline: true },
                { name: '📦 Обычные', value: byRarity.common.map(n => `${n.emoji} ${n.name} (ID: \`${n.id}\`)`).join('\n') || 'Нет', inline: true }
            ],
            footer: { text: `Всего карточек: ${nfts.length} / ${MAX_NFT_INVENTORY} (макс)` }
        };
        message.reply({ embeds: [embed] });
    }
    else if (command === 'бонусы_nft') {
        const bonuses = getUserNFTBonuses(message.author.id);
        const embed = {
            title: '✨ АКТИВНЫЕ БОНУСЫ NFT',
            color: 0x00ff00,
            fields: [
                { name: '🎭 Сценарии', value: `+${Math.round((bonuses.scenario + bonuses.all) * 100)}%`, inline: true },
                { name: '🏴‍☠️ Ограбления', value: `+${Math.round((bonuses.robbery + bonuses.all) * 100)}%`, inline: true },
                { name: '🎰 Казино', value: `+${Math.round((bonuses.casino + bonuses.all) * 100)}%`, inline: true },
                { name: '📈 Биржа', value: `+${Math.round((bonuses.exchange + bonuses.all) * 100)}%`, inline: true },
                { name: '💻 Взлом', value: `+${Math.round((bonuses.hack + bonuses.all) * 100)}%`, inline: true }
            ]
        };
        message.reply({ embeds: [embed] });
    }
    else if (command === 'слоты') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet < MIN_BET) return message.reply(`❌ Минимальная ставка ${MIN_BET} CT`);
        const cd = checkCasinoCooldown(message.author.id);
        if (cd.onCooldown) {
            casinoCooldownAttempts.set(message.author.id, (casinoCooldownAttempts.get(message.author.id)||0)+1);
            checkAchievements(message.author.id, message.guild);
            return message.reply(`⏰ Подождите ${cd.remaining} сек`);
        }
        if (!removeCT(message.author.id, bet)) return message.reply('❌ Недостаточно CT');
        setCasinoCooldown(message.author.id);
        casinoSpent.set(message.author.id, (casinoSpent.get(message.author.id)||0)+bet);
        oneTimeSpent.set(message.author.id, (oneTimeSpent.get(message.author.id)||0)+bet);
        const { result, win, isJackpot } = casinoSlot(bet, message.author.id);
        addCT(message.author.id, win);
        if (win === 0 && !isJackpot) jackpot += Math.floor(bet*0.05);
        else if (isJackpot) { jackpot = JACKPOT_START; casinoWinCount.set(message.author.id, (casinoWinCount.get(message.author.id)||0)+1); checkAchievements(message.author.id, message.guild); }
        else checkUserQuest(message.author.id, 'casino_win', 1, message.guild);
        if (oneTimeSpent.get(message.author.id) >= 1500) checkAchievements(message.author.id, message.guild);
        if (isJackpot) message.reply(`🎰 **JACKPOT!** Вы выиграли ${win} CT!`);
        else message.reply(`${result === 'WIN' ? '🎉' : '😢'} Результат: ${result}\n${win>0?`Выигрыш ${win} CT`:`Проигрыш ${bet} CT`}${win===0 && !isJackpot ? `\n💰 +${Math.floor(bet*0.05)} CT в джекпот` : ''}`);
        checkUserQuest(message.author.id, 'casino', 1, message.guild);
        oneTimeSpent.set(message.author.id, 0);
    }
    else if (command === 'кости') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet < MIN_BET) return message.reply(`❌ Минимальная ставка ${MIN_BET} CT`);
        const cd = checkCasinoCooldown(message.author.id);
        if (cd.onCooldown) {
            casinoCooldownAttempts.set(message.author.id, (casinoCooldownAttempts.get(message.author.id)||0)+1);
            checkAchievements(message.author.id, message.guild);
            return message.reply(`⏰ Подождите ${cd.remaining} сек`);
        }
        if (!removeCT(message.author.id, bet)) return message.reply('❌ Недостаточно CT');
        setCasinoCooldown(message.author.id);
        casinoSpent.set(message.author.id, (casinoSpent.get(message.author.id)||0)+bet);
        oneTimeSpent.set(message.author.id, (oneTimeSpent.get(message.author.id)||0)+bet);
        const { player, bot, win, multiplier } = diceGame(bet, message.author.id);
        addCT(message.author.id, win);
        if (win === 0) jackpot += Math.floor(bet*0.05);
        else checkUserQuest(message.author.id, 'casino_win', 1, message.guild);
        if (oneTimeSpent.get(message.author.id) >= 1500) checkAchievements(message.author.id, message.guild);
        message.reply(`🎲 Вы: ${player}, Бот: ${bot}\nМножитель: x${multiplier||0}\n${win>0?`Выигрыш ${win} CT`:`Проигрыш ${bet} CT`}`);
        checkUserQuest(message.author.id, 'casino', 1, message.guild);
        oneTimeSpent.set(message.author.id, 0);
    }
    else if (command === 'рулетка') {
        const bet = parseInt(args[0]);
        const choice = args[1];
        if (isNaN(bet) || bet < MIN_BET || !choice) return message.reply('❌ !рулетка 50 красное');
        const cd = checkCasinoCooldown(message.author.id);
        if (cd.onCooldown) {
            casinoCooldownAttempts.set(message.author.id, (casinoCooldownAttempts.get(message.author.id)||0)+1);
            checkAchievements(message.author.id, message.guild);
            return message.reply(`⏰ Подождите ${cd.remaining} сек`);
        }
        if (!removeCT(message.author.id, bet)) return message.reply('❌ Недостаточно CT');
        setCasinoCooldown(message.author.id);
        casinoSpent.set(message.author.id, (casinoSpent.get(message.author.id)||0)+bet);
        oneTimeSpent.set(message.author.id, (oneTimeSpent.get(message.author.id)||0)+bet);
        const { number, win, multiplier } = roulette(bet, choice.toLowerCase(), message.author.id);
        addCT(message.author.id, win);
        if (win === 0) jackpot += Math.floor(bet*0.05);
        else checkUserQuest(message.author.id, 'casino_win', 1, message.guild);
        if (oneTimeSpent.get(message.author.id) >= 1500) checkAchievements(message.author.id, message.guild);
        message.reply(`🎡 Выпало: ${number}\nМножитель: x${multiplier||0}\n${win>0?`Выигрыш ${win} CT`:`Проигрыш ${bet} CT`}`);
        checkUserQuest(message.author.id, 'casino', 1, message.guild);
        oneTimeSpent.set(message.author.id, 0);
    }
    else if (command === 'русская_рулетка') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet < MIN_BET) return message.reply(`❌ Минимальная ставка ${MIN_BET} CT`);
        const cd = checkCasinoCooldown(message.author.id);
        if (cd.onCooldown) {
            casinoCooldownAttempts.set(message.author.id, (casinoCooldownAttempts.get(message.author.id)||0)+1);
            checkAchievements(message.author.id, message.guild);
            return message.reply(`⏰ Подождите ${cd.remaining} сек`);
        }
        if (!removeCT(message.author.id, bet)) return message.reply('❌ Недостаточно CT');
        setCasinoCooldown(message.author.id);
        casinoSpent.set(message.author.id, (casinoSpent.get(message.author.id)||0)+bet);
        oneTimeSpent.set(message.author.id, (oneTimeSpent.get(message.author.id)||0)+bet);
        const dead = russianRoulette();
        if (dead) { jackpot += Math.floor(bet*0.05); message.reply(`💥 БАХ! Вы проиграли ${bet} CT`); }
        else { const reward = bet*2; addCT(message.author.id, reward); message.reply(`🍀 Клик! Вы выжили и выиграли ${reward} CT`); checkUserQuest(message.author.id, 'casino', 1, message.guild); }
        if (oneTimeSpent.get(message.author.id) >= 1500) checkAchievements(message.author.id, message.guild);
        oneTimeSpent.set(message.author.id, 0);
    }
    else if (command === 'рулетка_бесплатно') {
        const cd = checkCasinoCooldown(message.author.id);
        if (cd.onCooldown) {
            casinoCooldownAttempts.set(message.author.id, (casinoCooldownAttempts.get(message.author.id)||0)+1);
            checkAchievements(message.author.id, message.guild);
            return message.reply(`⏰ Подождите ${cd.remaining} сек`);
        }
        setCasinoCooldown(message.author.id);
        const dead = russianRoulette();
        if (dead) {
            await message.member.timeout(10*60000);
            const cnt = (russianRouletteTimeoutCount.get(message.author.id)||0)+1;
            russianRouletteTimeoutCount.set(message.author.id, cnt);
            checkAchievements(message.author.id, message.guild);
            message.reply(`💥 БАХ! Тайм-аут 10 мин (${cnt}/5)`);
        } else { addCT(message.author.id, 50); message.reply(`🍀 Выжил +50 CT`); checkUserQuest(message.author.id, 'casino', 1, message.guild); }
    }
    else if (command === 'сценарий') {
        const cd = checkScenarioCooldown(message.author.id);
        if (cd.onCooldown) return message.reply(`⏰ Подождите ${cd.minutes} мин ${cd.seconds} сек`);
        const sc = getScenario();
        const minAmount = 150;
        const maxAmount = sc.max;
        const amt = Math.floor(Math.random() * (maxAmount - minAmount + 1) + minAmount);
        const multiplier = getScenarioMultiplier(message.author.id);
        const finalAmt = sc.success ? amt * multiplier : amt;
        
        if (sc.success) {
            addCT(message.author.id, finalAmt);
            if (sc.rare) {
                message.reply(`🎭 **СЕКРЕТНЫЙ СЦЕНАРИЙ!**\n${sc.text} +${finalAmt} CT! ${multiplier > 1 ? `(x${multiplier} бонус)` : ''}`);
            } else {
                message.reply(`🎬 ${sc.text} **${finalAmt} CT**! ${multiplier > 1 ? `(x${multiplier} бонус)` : ''}`);
            }
        } else {
            if (removeCT(message.author.id, finalAmt)) {
                message.reply(`💀 ${sc.text} **${finalAmt} CT**! ${multiplier > 1 ? `(x${multiplier} бонус)` : ''}`);
            } else {
                message.reply(`💀 ${sc.text} **${getCT(message.author.id)} CT** (всё сгорело)!`);
                setCT(message.author.id, 0);
            }
        }
        setScenarioCooldown(message.author.id);
    }
    else if (command === 'дуэль') {
        const target = await findMemberByName(message.guild, args[0]);
        const bet = parseInt(args[1]);
        if (!target || isNaN(bet) || bet < MIN_BET) return message.reply('❌ !дуэль @игрок ставка');
        if (target.id === message.author.id) return message.reply('❌ Нельзя с собой');
        const cd = checkDuelCooldown(message.author.id);
        if (cd.onCooldown) return message.reply(`⏰ Подождите ${cd.minutes} мин ${cd.seconds} сек`);
        if (!removeCT(message.author.id, bet)) return message.reply('❌ Недостаточно CT');
        if (!removeCT(target.id, bet)) { addCT(message.author.id, bet); return message.reply(`❌ У ${target.displayName} недостаточно CT`); }
        const d1 = russianRoulette(), d2 = russianRoulette();
        if (d1 && d2) { jackpot += bet*2; message.reply(`💥 Оба погибли! Ставки в джекпот`); }
        else if (d1) { addCT(target.id, bet*2); message.reply(`💀 ${message.author.displayName} погиб! ${target.displayName} забирает ${bet*2} CT`); checkUserQuest(message.author.id, 'duel', 1, message.guild); }
        else if (d2) { addCT(message.author.id, bet*2); message.reply(`💀 ${target.displayName} погиб! ${message.author.displayName} забирает ${bet*2} CT`); checkUserQuest(message.author.id, 'duel', 1, message.guild); }
        else { addCT(message.author.id, bet); addCT(target.id, bet); message.reply(`🍀 Оба выжили! Ставки возвращены`); }
        setDuelCooldown(message.author.id);
    }
    else if (command === 'ограбить') {
        const target = await findMemberByName(message.guild, args[0]);
        if (!target) return message.reply('❌ !ограбить @игрок');
        if (target.id === message.author.id) return message.reply('❌ Нельзя себя');
        if (hasShield(target.id)) return message.reply(`🛡️ У ${target.displayName} активен щит!`);
        const cd = checkRobberyCooldown(message.author.id);
        if (cd.onCooldown) return message.reply(`⏰ Подождите ${cd.minutes} мин ${cd.seconds} сек`);
        const targetCT = getCT(target.id);
        const robberCT = getCT(message.author.id);
        if (targetCT < 100) return message.reply(`❌ У ${target.displayName} меньше 100 CT`);
        if (robberCT < 50) return message.reply('❌ У тебя меньше 50 CT');
        const weapon = getWeapon(message.author.id);
        
        if (weapon && weapon.name === 'Снайперка') {
            if (sniperGames.has(message.author.id)) {
                return message.reply('❌ У вас уже активна игра в снайперку!');
            }
            const bet = 500;
            if (getCT(message.author.id) < bet) return message.reply('❌ Недостаточно CT для игры');
            
            class SniperGame {
                constructor(userId, bet) {
                    this.userId = userId;
                    this.bet = bet;
                    this.startTime = Date.now();
                    this.target = Math.floor(Math.random() * 8);
                    this.attempts = 0;
                    this.maxAttempts = 3;
                    this.gameOver = false;
                }
                
                shoot(guess) {
                    if (this.gameOver) return { success: false, message: "Игра окончена" };
                    if (Date.now() - this.startTime > 120000) {
                        this.gameOver = true;
                        return { success: false, message: "Время вышло! (2 минуты)" };
                    }
                    
                    this.attempts++;
                    
                    if (guess === this.target) {
                        this.gameOver = true;
                        const winAmount = this.bet * 2;
                        return { success: true, win: winAmount, message: `🎯 Точное попадание! Цифра была ${this.target}` };
                    } else {
                        if (this.attempts >= this.maxAttempts) {
                            this.gameOver = true;
                            return { success: false, message: `💥 Промах! Цифра была ${this.target}. Вы проиграли ${this.bet} CT` };
                        }
                        const hint = guess < this.target ? 'больше' : 'меньше';
                        return { success: false, message: `❌ Не угадал! Цифра ${hint}. Осталось попыток: ${this.maxAttempts - this.attempts}` };
                    }
                }
            }
            
            const game = new SniperGame(message.author.id, bet);
            sniperGames.set(message.author.id, game);
            return message.reply(`🎯 **МИНИ-ИГРА: СНАЙПЕРКА**\nСтавка: ${bet} CT\n\nЦифра загадана от 0 до 7.\nУ вас 3 попытки и 2 минуты.\n\nВведите: \`!выстрел [число]\``);
        }
        
        const successChance = getRobberyChance(message.author.id);
        const success = Math.random() < successChance;
        
        if (success) {
            const stolen = Math.floor(targetCT * (0.1 + Math.random() * 0.2));
            removeCT(target.id, stolen);
            addCT(message.author.id, stolen);
            message.reply(`🏴‍☠️ Успех! ${weapon ? `С ${weapon.emoji} ${weapon.name} ` : ''}Ты украл ${stolen} CT у ${target.displayName}!`);
            checkUserQuest(message.author.id, 'rob', 1, message.guild);
        } else {
            const lost = Math.floor(robberCT * 0.1);
            removeCT(message.author.id, lost);
            addCT(target.id, lost);
            message.reply(`😵 Провал! ${weapon ? `Даже ${weapon.name} не помог... ` : ''}Ты потерял ${lost} CT и отдал ${target.displayName}!`);
        }
        setRobberyCooldown(message.author.id);
    }
    else if (command === 'выстрел') {
        const guess = parseInt(args[0]);
        if (isNaN(guess) || guess < 0 || guess > 7) return message.reply('❌ Введите число от 0 до 7');
        
        const game = sniperGames.get(message.author.id);
        if (!game) return message.reply('❌ Нет активной игры. Используйте !ограбить с оружием "Снайперка"');
        
        const result = game.shoot(guess);
        if (result.success) {
            sniperGames.delete(message.author.id);
            addCT(message.author.id, result.win);
            message.reply(`${result.message}\n💰 Выигрыш: ${result.win} CT!`);
        } else if (result.message.includes("Промах") || result.message.includes("Время вышло")) {
            sniperGames.delete(message.author.id);
            message.reply(result.message);
        } else {
            message.reply(result.message);
        }
    }
    else if (command === 'шахта' && isAdmin(message.member)) {
        const target = message.mentions.members.first() || await findMemberByName(message.guild, args[0]);
        if (!target) return message.reply('❌ Укажите пользователя');
        if (minePrisoners.has(target.id)) return message.reply(`⛏️ ${target.displayName} уже в шахте!`);
        
        startMinePunishment(target.id, message.guild);
        message.reply(`⛏️ **${target.displayName}** отправлен в шахту! Бот будет рандомно требовать "КОПАЙ!". Нужно ответить "вскопал" 10 раз. За каждый пропуск прогресс сбрасывается.`);
    }
    else if (command === 'обнулить_джекпот' && isAdmin(message.member)) { jackpot = JACKPOT_START; saveData(); message.reply(`🎰 Джекпот сброшен`); }
    else if (command === 'обнулить_траты' && isAdmin(message.member)) {
        const target = message.mentions.members.first() || await findMemberByName(message.guild, args[0]);
        if (!target) return message.reply('❌ Укажите пользователя');
        casinoSpent.set(target.id, 0);
        saveData();
        message.reply(`✅ Обнулены траты для ${target.displayName}`);
    }
    else if (command === 'выдать_акции' && isAdmin(message.member)) {
        const target = message.mentions.members.first() || await findMemberByName(message.guild, args[0]);
        const crypto = args[1]?.toLowerCase();
        const amount = parseInt(args[2]);
        if (!target || !crypto || isNaN(amount)) return message.reply('❌ !выдать_акции @user валюта количество');
        let key = null;
        if (crypto === 'e-corp' || crypto === 'ecorp') key = 'e-corp';
        else if (crypto === 'nb') key = 'Nb';
        else if (crypto === 'fsociety') key = 'Fsociety';
        else if (crypto === 'kobycoin' || crypto === 'kbc') key = 'KobyCoin';
        if (!key) return message.reply('❌ Доступно: e-corp, Nb, Fsociety, KobyCoin');
        const uc = userCrypto.get(target.id) || { 'e-corp':0, 'Nb':0, 'Fsociety':0, 'KobyCoin':0 };
        uc[key] = (uc[key]||0) + amount;
        userCrypto.set(target.id, uc);
        saveData();
        message.reply(`✅ Выдано ${amount} ${cryptoPrices[key].name} ${target.displayName}`);
    }
    else if (command === 'забрать_акции' && isAdmin(message.member)) {
        const target = message.mentions.members.first() || await findMemberByName(message.guild, args[0]);
        const crypto = args[1]?.toLowerCase();
        const amount = parseInt(args[2]);
        if (!target || !crypto || isNaN(amount)) return message.reply('❌ !забрать_акции @user валюта количество');
        let key = null;
        if (crypto === 'e-corp' || crypto === 'ecorp') key = 'e-corp';
        else if (crypto === 'nb') key = 'Nb';
        else if (crypto === 'fsociety') key = 'Fsociety';
        else if (crypto === 'kobycoin' || crypto === 'kbc') key = 'KobyCoin';
        if (!key) return message.reply('❌ Доступно: e-corp, Nb, Fsociety, KobyCoin');
        const uc = userCrypto.get(target.id) || { 'e-corp':0, 'Nb':0, 'Fsociety':0, 'KobyCoin':0 };
        if ((uc[key]||0) < amount) return message.reply('❌ У пользователя нет столько');
        uc[key] -= amount;
        userCrypto.set(target.id, uc);
        saveData();
        message.reply(`✅ Забрано ${amount} ${cryptoPrices[key].name} у ${target.displayName}`);
    }
    else if (command === 'обработать' && isAdmin(message.member)) {
        const userId = args[0];
        const type = args[1];
        const amount = parseInt(args[2]);
        if (!userId || !type || isNaN(amount)) return message.reply('❌ !обработать @user продать количество');
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Пользователь не найден');
        if (type === 'продать') {
            const request = sellRequests.get(target.id);
            if (!request) return message.reply('❌ Нет активной заявки');
            if (getCT(target.id) < amount) return message.reply('❌ У пользователя недостаточно CT');
            removeCT(target.id, amount);
            marketVolume += amount;
            sellRequests.delete(target.id);
            message.reply(`✅ Заявка обработана! У ${target.displayName} списано ${amount} CT`);
            target.send(`✅ Ваша заявка на продажу ${amount} CT обработана! Деньги будут переведены в ближайшее время.`);
        }
    }
    else if (command === 'установить_курс' && isAdmin(message.member)) {
        const newRate = parseFloat(args[0]);
        if (isNaN(newRate) || newRate < MIN_CT_RATE || newRate > MAX_CT_RATE) return message.reply(`❌ Курс должен быть от ${MIN_CT_RATE} до ${MAX_CT_RATE} ₽`);
        ctRate = newRate;
        saveData();
        message.reply(`💰 Курс CT установлен: 1 CT = ${ctRate.toFixed(4)} ₽ (1000 CT = ${(1000 * ctRate).toFixed(2)} ₽)`);
    }
    else if (command === 'топ') { message.reply(`🏆 **Топ по CT**\n${getTopCT()}`); }
    else if (command === 'топ_трейдеров') { message.reply(`🏆 **Топ трейдеров**\n${getTopTraders() || 'Нет данных'}`); }
    else if (command === 'топ_полный') {
        const stats = getExtendedLeaderboard(message.guild);
        const embed = {
            title: '🏆 ПОЛНАЯ ТАБЛИЦА ЛИДЕРОВ',
            color: 0xffd700,
            fields: [
                { name: '💰 БОГАТЫЕ', value: stats.richest.map(([id, ct], i) => `${i+1}. <@${id}>: ${ct} CT`).join('\n') || 'Нет данных', inline: true },
                { name: '🎰 КАЗИНО', value: stats.casino.map(([id, wins], i) => `${i+1}. <@${id}>: ${wins} побед`).join('\n') || 'Нет данных', inline: true },
                { name: '📈 ТРЕЙДЕРЫ', value: stats.trader.map(([id, s], i) => `${i+1}. <@${id}>: ${s.profit} CT`).join('\n') || 'Нет данных', inline: true },
                { name: '💬 АКТИВНЫЕ', value: stats.active.map(([id, msgs], i) => `${i+1}. <@${id}>: ${msgs} сообщ`).join('\n') || 'Нет данных', inline: true },
                { name: '🎤 ВОЙС', value: stats.voice.map(([id, time], i) => `${i+1}. <@${id}>: ${Math.floor(time/3600000)}ч`).join('\n') || 'Нет данных', inline: true },
                { name: '🏠 МАГНАТЫ', value: stats.property.map(({id, prop}, i) => `${i+1}. <@${id}>: ${PROPERTIES[prop]?.name}`).join('\n') || 'Нет данных', inline: true },
                { name: '🃏 КОЛЛЕКЦИОНЕРЫ', value: stats.nft.map(({id, count}, i) => `${i+1}. <@${id}>: ${count} NFT`).join('\n') || 'Нет данных', inline: true }
            ],
            footer: { text: 'Обновляется в реальном времени' }
        };
        message.reply({ embeds: [embed] });
    }
    else if (command === 'бусты') {
        const boost = activeBoosts.get(message.author.id);
        if (!boost || boost.until <= Date.now()) {
            return message.reply('❌ У вас нет активных бустов');
        }
        const timeLeft = Math.ceil((boost.until - Date.now()) / 60000);
        let boostText = '';
        switch(boost.type) {
            case 'casino': boostText = '🎰 Казино (шанс выигрыша 40%)'; break;
            case 'exchange': boostText = '📈 Биржа (x2 прибыль)'; break;
            case 'all': boostText = '✨ Все доходы (x2)'; break;
            case 'quest': boostText = '📜 Квесты (x2 награда)'; break;
            case 'scenario': boostText = '🎭 Сценарии (x2 выигрыш)'; break;
        }
        message.reply(`✨ **Активный буст:** ${boostText}\n⏰ Осталось: ${timeLeft} минут`);
    }
    else if (command === 'квесты') {
        updateUserQuests(message.author.id);
        const q = userQuests.get(message.author.id);
        if (!q) return message.reply('❌ Ошибка');
        const prog = userQuestProgress.get(message.author.id) || {};
        const list = q.active.map(qq => {
            const key = qq.id;
            const cur = prog[key] || 0;
            const done = prog[`${key}_done`];
            return `${done?'✅':'⬜'} ${qq.desc} (${cur}/${qq.target}) +${qq.reward} CT`;
        }).join('\n');
        const hours = Math.max(0, Math.round((q.nextUpdate - Date.now())/3600000));
        message.reply(`📜 **Квесты** (обновятся через ${hours}ч)\n${list}`);
    }
    else if (command === 'ачивки') {
        const earned = achievements.get(message.author.id) || [];
        if (!earned.length) return message.reply('🏅 Нет ачивок');
        message.reply(`🏅 **Ваши ачивки**\n${earned.map(k => `🏆 ${ALL_ACHIEVEMENTS[k]?.name}`).join('\n')}`);
    }
    else if (command === 'баланс') { 
        const weapon = getWeapon(message.author.id);
        const prop = getProperty(message.author.id);
        const voiceStreak = voiceStreakStart.has(message.author.id) ? Math.floor((Date.now() - voiceStreakStart.get(message.author.id)) / 3600000) : 0;
        const boost = activeBoosts.get(message.author.id);
        const nftCount = (userNFTs.get(message.author.id) || []).length;
        message.reply(`💰 **Баланс**: ${getCT(message.author.id)} CT\n🔫 **Оружие**: ${weapon ? `${weapon.emoji} ${weapon.name}` : 'нет'}\n🏠 **Недвижимость**: ${prop ? `${prop.emoji} ${prop.name}` : 'нет'}\n🎰 Потрачено в казино: ${casinoSpent.get(message.author.id)||0} CT\n🎤 Сессия в войсе: ${voiceStreak} ч\n✨ Буст: ${boost && boost.until > Date.now() ? `${boost.type === 'casino' ? '🎰' : boost.type === 'exchange' ? '📈' : boost.type === 'all' ? '✨' : boost.type === 'quest' ? '📜' : '🎭'} активен` : 'нет'}\n🃏 NFT: ${nftCount}/${MAX_NFT_INVENTORY} карточек`);
    }
    else if (command === 'передать') {
        const targetName = args[0];
        const amount = parseInt(args[1]);
        if (!targetName || isNaN(amount) || amount < 100) return message.reply('❌ !передать имя 100');
        const target = await findMemberByName(message.guild, targetName);
        if (!target) return message.reply('❌ Пользователь не найден');
        if (!removeCT(message.author.id, amount)) return message.reply('❌ Недостаточно CT');
        addCT(target.id, amount);
        transfersMade.set(message.author.id, (transfersMade.get(message.author.id)||0)+amount);
        checkAchievements(message.author.id, message.guild);
        message.reply(`✅ Передано ${amount} CT ${target.displayName}`);
        checkUserQuest(message.author.id, 'transfer', 1, message.guild);
    }
    else if (command === 'магазин') {
        const list = Array.from(SHOP_ROLES.values()).filter(r=>r.id).map(r=>`${r.name} — ${r.price} CT`).join('\n');
        message.reply(`🛒 **Магазин ролей**\n${list || 'Роли не добавлены'}`);
    }
    else if (command === 'купить') {
        const roleName = args.join(' ');
        const roleData = Array.from(SHOP_ROLES.values()).find(r=>r.name === roleName);
        if (!roleData) return message.reply('❌ Роль не найдена');
        if (!roleData.id) return message.reply('❌ ID роли не установлен');
        const ct = getCT(message.author.id);
        if (ct < roleData.price) return message.reply(`❌ Нужно ${roleData.price} CT, у вас ${ct}`);
        const role = message.guild.roles.cache.get(roleData.id);
        if (!role) return message.reply('❌ Роль не найдена на сервере');
        removeCT(message.author.id, roleData.price);
        await message.member.roles.add(role);
        if (message.member.roles.cache.size >= 7) checkAchievements(message.author.id, message.guild);
        message.reply(`✅ Куплена роль ${role.name}`);
    }
    else if (command === 'добавить_роль' && isAdmin(message.member)) {
        const role = message.mentions.roles.first();
        const price = parseInt(args[1]);
        if (!role || isNaN(price)) return message.reply('❌ !добавить_роль @роль цена');
        SHOP_ROLES.set(role.name, { id: role.id, price, name: role.name });
        saveData();
        message.reply(`✅ Роль ${role.name} добавлена за ${price} CT`);
    }
    else if (command === 'выдать_монеты' && isAdmin(message.member)) {
        const target = message.mentions.members.first() || await findMemberByName(message.guild, args[0]);
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount)) return message.reply('❌ !выдать_монеты @user сумма');
        addCT(target.id, amount);
        message.reply(`✅ Выдано ${amount} CT ${target.displayName}`);
    }
    else if (command === 'снять_монеты' && isAdmin(message.member)) {
        const target = message.mentions.members.first() || await findMemberByName(message.guild, args[0]);
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount)) return message.reply('❌ !снять_монеты @user сумма');
        if (removeCT(target.id, amount)) message.reply(`✅ Снято ${amount} CT у ${target.displayName}`);
        else message.reply(`❌ У ${target.displayName} недостаточно CT`);
    }
    else if (command === 'установить_монеты' && isAdmin(message.member)) {
        const target = message.mentions.members.first() || await findMemberByName(message.guild, args[0]);
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount)) return message.reply('❌ !установить_монеты @user сумма');
        setCT(target.id, amount);
        message.reply(`✅ У ${target.displayName} установлено ${amount} CT`);
    }
    else if (command === 'статус_бота') {
        const vc = message.guild.members.me.voice;
        message.reply(vc.channelId ? `Канал: ${vc.channel?.name}\nЗамьючен: ${vc.serverMute?'✅':'❌'}` : '❌ Бот не в войсе');
    }
    else if (command === 'размьють_бота') {
        const vc = message.guild.members.me.voice;
        if (vc.channelId) { await vc.setMute(false); await vc.setDeaf(false); message.reply('✅ Бот размьючен'); }
        else message.reply('❌ Бот не в войсе');
    }
    else if (command === 'помощь') {
        const embed = new EmbedBuilder()
            .setTitle('🤖 ПОМОЩЬ ПО ЭЛЛИОТУ')
            .setColor(0xff0000)
            .addFields(
                { name: '🎤 Голос', value: '!войс, !покинуть, !скажи' },
                { name: '💰 Экономика', value: '!ежедневный, !баланс, !передать, !джекпот' },
                { name: '🎰 Казино', value: '!слоты, !кости, !рулетка, !русская_рулетка, !рулетка_бесплатно' },
                { name: '🔢 Бинарный код', value: '!бинарный_код [ставка] — угадай 3 бита подряд (x2)' },
                { name: '💻 Взлом', value: '!взлом [ставка] — взломай сервер' },
                { name: '🏠 Недвижимость', value: '!недвижимость, !купить_дом, !собрать_доход, !продать_дом' },
                { name: '🔫 Оружие', value: '!оружие, !купить_оружие, !продать_оружие, !щит' },
                { name: '🃏 NFT', value: '!лутбокс, !коллекция, !бонусы_nft, !продать_nft, !обменять_nft, !топ_nft' },
                { name: '📈 Биржа', value: '!биржа — курсы, !график e-corp, !топ_трейдеров' },
                { name: '🎭 События', value: '!дуэль, !сценарий, !ограбить' },
                { name: '✨ Бусты', value: '!бусты — активные бонусы' },
                { name: '📜 Квесты', value: '!квесты — обновление каждые 3 часа' },
                { name: '🏆 Топы', value: '!топ, !топ_трейдеров, !топ_полный, !топ_nft' },
                { name: '🏅 Ачивки', value: '!ачивки' },
                { name: '📊 Инфо', value: '!инфо @user — статистика игрока' },
                { name: '👑 Админ', value: '!замутить, !размутить, !забань, !выдать_монеты, !установить_курс и др.' }
            )
            .setFooter({ text: '🎰 Шанс выигрыша 20% | NFT дают бонусы | Максимум 3 NFT в инвентаре' });
        
        message.reply({ embeds: [embed] });
    }
});

// ========== КНОПКИ ДЛЯ ОБМЕНА NFT ==========
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const [action, fromUserId] = interaction.customId.split('_');
    const trade = pendingNFTTrades.get(interaction.user.id);
    
    if (!trade || trade.fromUserId !== fromUserId) {
        return interaction.reply({ content: '❌ Запрос на обмен устарел или не найден.', ephemeral: true });
    }
    
    if (action === 'accept') {
        const fromUser = await interaction.guild.members.fetch(trade.fromUserId);
        const toUser = interaction.member;
        
        const fromNFTs = userNFTs.get(trade.fromUserId) || [];
        const toNFTs = userNFTs.get(toUser.id) || [];
        
        const nftToSend = fromNFTs.find(n => n.id === trade.nftId);
        if (!nftToSend) {
            return interaction.reply({ content: '❌ NFT больше нет у отправителя.', ephemeral: true });
        }
        
        // Проверка лимита у получателя
        if (toNFTs.length >= MAX_NFT_INVENTORY) {
            return interaction.reply({ content: `❌ У ${toUser.displayName} уже ${MAX_NFT_INVENTORY} NFT! Не может принять больше.`, ephemeral: true });
        }
        
        // Проверка лимита у отправителя (после отправки)
        const newFromNFTs = fromNFTs.filter(n => n.id !== trade.nftId);
        
        // Обмен
        userNFTs.set(trade.fromUserId, newFromNFTs);
        userNFTs.set(toUser.id, [...toNFTs, nftToSend]);
        saveData();
        
        pendingNFTTrades.delete(interaction.user.id);
        
        await interaction.reply({ content: `✅ **ОБМЕН УСПЕШЕН!**\n${fromUser.displayName} → ${toUser.displayName}\n${nftToSend.emoji} **${nftToSend.name}**` });
        
        const channel = interaction.guild.channels.cache.find(c => c.name === 'основа');
        if (channel) channel.send(`🔄 **ОБМЕН NFT**\n${fromUser.displayName} обменял ${nftToSend.emoji} **${nftToSend.name}** с ${toUser.displayName}!`);
        
    } else if (action === 'reject') {
        pendingNFTTrades.delete(interaction.user.id);
        await interaction.reply({ content: '❌ Вы отклонили обмен.', ephemeral: true });
        
        const fromUser = await interaction.guild.members.fetch(trade.fromUserId);
        const channel = interaction.guild.channels.cache.find(c => c.name === 'основа');
        if (channel) channel.send(`❌ ${fromUser.displayName}, пользователь ${interaction.user.displayName} отклонил обмен NFT.`);
    }
});

// ========== ОТСЛЕЖИВАНИЕ ВОЙСА ==========
client.on('voiceStateUpdate', async (oldState, newState) => {
    const uid = newState.member.user.id;
    
    if (newState.channelId && !oldState.channelId) {
        voiceStartTime.set(uid, Date.now());
        if (!voiceStreakStart.has(uid)) voiceStreakStart.set(uid, Date.now());
    }
    if (!newState.channelId && oldState.channelId) {
        const start = voiceStartTime.get(uid);
        if (start) {
            const minutes = Math.floor((Date.now() - start) / 60000);
            if (minutes > 0) {
                checkUserQuest(uid, 'voice', minutes, newState.guild);
            }
            voiceStartTime.delete(uid);
        }
        voiceStreakStart.delete(uid);
    }
});

// ========== МАГАЗИН РОЛЕЙ ==========
const SHOP_ROLES = new Map([
    ['The legend 🏆', { id: null, price: 11000, name: 'The legend 🏆' }],
    ['я ща трусы сниму нахуй', { id: null, price: 2000, name: 'я ща трусы сниму нахуй' }],
    ['лютий носочек', { id: null, price: 360, name: 'лютий носочек' }],
    ['dEpre??ed (•_•)', { id: null, price: 4000, name: 'dEpre??ed (•_•)' }],
    ['поднога носочку', { id: null, price: 361, name: 'поднога носочку' }],
    ['Кефтеме👞', { id: null, price: 700, name: 'Кефтеме👞' }],
    ['билоран', { id: null, price: 200, name: 'билоран' }],
    ['повар семейный', { id: null, price: 400, name: 'повар семейный' }],
    ['Бананчик', { id: null, price: 250, name: 'Бананчик' }],
    ['Дотер💀', { id: null, price: 1, name: 'Дотер💀' }],
    ['бомбадир миллиардер семга бой', { id: null, price: 120, name: 'бомбадир миллиардер семга бой' }],
    ['Мои Сигмы😎', { id: null, price: 9000, name: 'Мои Сигмы😎' }],
    ['Горячая японочка', { id: null, price: 499, name: 'Горячая японочка' }],
    ['Главным по жизниным советам', { id: null, price: 2000, name: 'Главным по жизниным советам' }],
    ['Сосите сосииите 🤐', { id: null, price: 400, name: 'Сосите сосииите 🤐' }],
    ['эгоист', { id: null, price: 999, name: 'эгоист' }],
    ['микролонивка', { id: null, price: 1, name: 'микролонивка' }],
    ['Пахан🧔', { id: null, price: 1899, name: 'Пахан🧔' }],
    ['Moderator ❤︎', { id: null, price: 7899, name: 'Moderator ❤︎' }],
    ['Главный по цитатам', { id: null, price: 1000, name: 'Главный по цитатам' }],
    ['Zov', { id: null, price: 199, name: 'Zov' }],
    ['неопознаный людишка', { id: null, price: 399, name: 'неопознаный людишка' }],
    ['душка с любовью', { id: null, price: 49, name: 'душка с любовью' }],
    ['m0nesy ☜(ﾟヮﾟ☜)', { id: null, price: 613, name: 'm0nesy ☜(ﾟヮﾟ☜)' }],
    ['¯\\_(ツ)_/¯   HeHe', { id: null, price: 1200, name: '¯\\_(ツ)_/¯   HeHe' }],
    ['сын миража', { id: null, price: 300, name: 'сын миража' }],
    ['༼ つ ◕_◕ ༽つ', { id: null, price: 599, name: '༼ つ ◕_◕ ༽つ' }],
    ['овош🥬', { id: null, price: 1234, name: 'овош🥬' }],
    ['модер санчес 2.0', { id: null, price: 3499, name: 'модер санчес 2.0' }]
]);

client.login(TOKEN).catch(console.error);
