// --- GAME CONFIGURATION ---
const CONF = {
    autoSaveInterval: 10000, // 10 seconds
    priceUpdateInterval: 5000, // 5 seconds
    fps: 1, // Auto-mine tick rate
    baseCryptoPrice: 100
};

// --- INITIAL STATE ---
const defaultState = {
    cash: 0,
    crypto: 0,
    lifetimeCash: 0,
    hashPower: 1,
    level: 1,
    xp: 0,
    xpNeeded: 100,
    prestigeCount: 0,
    prestigeMult: 1,
    stats: {
        taps: 0,
        playtime: 0
    },
    rigs: {
        gpu1: 0,
        gpu2: 0,
        asic1: 0
    },
    achievements: [],
    missions: {
        taps100: false,
        earn1000: false
    }
};

// Shop Items Config
const shopItems = [
    { id: 'gpu1', name: 'Old Laptop', cost: 50, power: 1, icon: '💻' },
    { id: 'gpu2', name: 'Gaming GPU', cost: 250, power: 5, icon: '🎮' },
    { id: 'asic1', name: 'ASIC Miner', cost: 1000, power: 25, icon: '🔋' }
];

let state = JSON.parse(JSON.stringify(defaultState)); // Deep copy
let currentPrice = CONF.baseCryptoPrice;

// --- INITIALIZATION ---
function init() {
    loadGame();
    setupUI();
    setupNavigation();
    
    // Game Loops
    setInterval(gameLoop, 1000); // Core loop (1 sec)
    setInterval(fluctuatePrice, CONF.priceUpdateInterval);
    setInterval(saveGame, CONF.autoSaveInterval);
    
    fluctuatePrice(); // Set initial price
    renderShop();
    logEvent("Welcome to Crypto Miner Pro!");
}

// --- CORE MECHANICS ---

function gameLoop() {
    // Auto Mine
    const autoMineAmount = calculateAutoHash() / 1000; // Scale down for realism
    if (autoMineAmount > 0) {
        mineCrypto(autoMineAmount);
    }
    
    // Playtime
    state.stats.playtime++;
    
    checkMissions();
    updateUI();
}

function calculateAutoHash() {
    let power = 0;
    power += state.rigs.gpu1 * shopItems[0].power;
    power += state.rigs.gpu2 * shopItems[1].power;
    power += state.rigs.asic1 * shopItems[2].power;
    return power * state.prestigeMult;
}

function mineCrypto(amount) {
    state.crypto += amount;
}

function clickMine(e) {
    const tapPower = (state.hashPower * state.prestigeMult) / 500; 
    mineCrypto(tapPower);
    state.stats.taps++;
    addXP(1);
    
    // Floating Text Effect
    showFloatingText(e.clientX, e.clientY, `+${tapPower.toFixed(6)}`);
    
    updateUI();
}

function fluctuatePrice() {
    // Random movement -10% to +10%
    const change = (Math.random() * 0.2) - 0.1;
    currentPrice = currentPrice * (1 + change);
    // Clamp price
    if(currentPrice < 50) currentPrice = 50;
    if(currentPrice > 500) currentPrice = 500;
    
    updateUI();
}

function sellCrypto() {
    if (state.crypto <= 0) return;
    
    const value = state.crypto * currentPrice;
    state.cash += value;
    state.lifetimeCash += value;
    state.crypto = 0;
    
    logEvent(`Sold crypto for $${value.toFixed(2)}`);
    addXP(10);
    updateUI();
}

function buyItem(itemId) {
    const item = shopItems.find(i => i.id === itemId);
    // Cost formula: Base * (1.15 ^ quantity)
    const currentCost = Math.floor(item.cost * Math.pow(1.15, state.rigs[itemId]));
    
    if (state.cash >= currentCost) {
        state.cash -= currentCost;
        state.rigs[itemId]++;
        logEvent(`Bought ${item.name}`);
        renderShop(); // Re-render to update price
        updateUI();
    } else {
        alert("Not enough fake cash!");
    }
}

function addXP(amount) {
    state.xp += amount;
    if (state.xp >= state.xpNeeded) {
        state.level++;
        state.xp = 0;
        state.xpNeeded = Math.floor(state.xpNeeded * 1.5);
        logEvent(`Leveled up! Now Lvl ${state.level}`);
        showConfetti();
    }
}

function prestige() {
    if (state.lifetimeCash < 1000000) return;
    
    if(confirm("Reset progress for a permanent multiplier boost?")) {
        const bonus = Math.floor(state.lifetimeCash / 100000); // 1% per 100k
        state.prestigeMult += (bonus / 100);
        state.prestigeCount++;
        
        // Reset basics
        state.cash = 0;
        state.crypto = 0;
        state.lifetimeCash = 0;
        state.hashPower = 1;
        state.rigs = { gpu1: 0, gpu2: 0, asic1: 0 };
        state.level = 1;
        state.xp = 0;
        
        saveGame();
        location.reload();
    }
}

// --- UI FUNCTIONS ---

function updateUI() {
    // Header
    document.getElementById('ui-cash').innerText = state.cash.toFixed(2);
    document.getElementById('ui-crypto').innerText = state.crypto.toFixed(6);
    document.getElementById('ui-level').innerText = state.level;
    
    // Home
    document.getElementById('ui-market-price').innerText = currentPrice.toFixed(2);
    const marketEl = document.getElementById('ui-market-price');
    marketEl.style.color = currentPrice >= CONF.baseCryptoPrice ? '#2ecc71' : '#e74c3c';

    // Mine
    const totalHash = calculateAutoHash();
    document.getElementById('ui-hashrate').innerText = totalHash;
    document.getElementById('ui-auto-mining').innerText = totalHash > 0 ? "ON" : "OFF";
    
    // Profile
    document.getElementById('ui-xp').innerText = state.xp;
    document.getElementById('ui-xp-needed').innerText = state.xpNeeded;
    const xpPct = (state.xp / state.xpNeeded) * 100;
    document.getElementById('ui-xp-bar').style.width = `${xpPct}%`;
    document.getElementById('ui-prestige-mult').innerText = Math.round((state.prestigeMult - 1) * 100);
    
    const prestigeBtn = document.getElementById('btn-prestige');
    prestigeBtn.disabled = state.lifetimeCash < 1000000;
    
    // Stats
    document.getElementById('stat-taps').innerText = state.stats.taps;
    document.getElementById('stat-total-cash').innerText = state.lifetimeCash.toFixed(0);
    document.getElementById('stat-prestiges').innerText = state.prestigeCount;
    document.getElementById('stat-playtime').innerText = state.stats.playtime;
}

function renderShop() {
    const container = document.getElementById('shop-container');
    container.innerHTML = '';
    
    shopItems.forEach(item => {
        const quantity = state.rigs[item.id];
        const cost = Math.floor(item.cost * Math.pow(1.15, quantity));
        
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = `
            <div class="shop-info">
                <h4>${item.icon} ${item.name}</h4>
                <small>+${item.power} H/s | Owned: ${quantity}</small>
            </div>
            <button class="buy-btn" onclick="buyItem('${item.id}')">$${cost}</button>
        `;
        container.appendChild(el);
    });
}

function checkMissions() {
    const list = document.getElementById('mission-list');
    list.innerHTML = '';
    
    const missions = [
        { id: 'taps100', txt: 'Tap 100 times', done: state.stats.taps >= 100 },
        { id: 'earn1000', txt: 'Earn $1,000 Lifetime', done: state.lifetimeCash >= 1000 }
    ];

    missions.forEach(m => {
        const li = document.createElement('li');
        li.style.color = m.done ? '#2ecc71' : '#aaa';
        li.innerHTML = `${m.done ? '✅' : '⬜'} ${m.txt}`;
        list.appendChild(li);
    });
}

function logEvent(msg) {
    const list = document.getElementById('event-log');
    const item = document.createElement('li');
    const time = new Date().toLocaleTimeString();
    item.innerText = `[${time}] ${msg}`;
    list.insertBefore(item, list.firstChild);
    if(list.children.length > 10) list.removeChild(list.lastChild);
}

function showFloatingText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function showConfetti() {
    // Simple visual feedback for level up
    document.body.style.backgroundColor = '#2a2a4a';
    setTimeout(() => document.body.style.backgroundColor = '#1a1a2e', 200);
}

// --- NAVIGATION & INPUT ---

function setupNavigation() {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Toggle active class on buttons
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle screens
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });
}

function setupUI() {
    document.getElementById('btn-sell-all').addEventListener('click', sellCrypto);
    document.getElementById('click-miner').addEventListener('mousedown', clickMine);
    // Touch support for mobile
    document.getElementById('click-miner').addEventListener('touchstart', (e) => {
        e.preventDefault(); // prevent mouse emulation
        clickMine(e.touches[0]);
    });
    
    document.getElementById('btn-prestige').addEventListener('click', prestige);
}

// --- PERSISTENCE ---

function saveGame() {
    localStorage.setItem('cryptoMinerPro_save', JSON.stringify(state));
}

function loadGame() {
    const saved = localStorage.getItem('cryptoMinerPro_save');
    if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with default to prevent breaking on updates
        state = { ...defaultState, ...parsed, rigs: { ...defaultState.rigs, ...parsed.rigs } };
    }
}

// Start
window.onload = init;

