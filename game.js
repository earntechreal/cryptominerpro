// --- GAME CONFIGURATION ---
const CONF = {
    autoSaveInterval: 10000,
    priceUpdateInterval: 5000,
    baseCryptoPrice: 100
};

// --- STATE ---
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
    stats: { taps: 0, playtime: 0 },
    rigs: { gpu1: 0, gpu2: 0, asic1: 0 },
    achievements: []
};

const shopItems = [
    { id: 'gpu1', name: 'Starter Laptop', cost: 50, power: 1, icon: '💻' },
    { id: 'gpu2', name: 'Gaming Rig', cost: 250, power: 5, icon: '🖥️' },
    { id: 'asic1', name: 'ASIC Farm', cost: 1000, power: 25, icon: '🏭' }
];

let state = JSON.parse(JSON.stringify(defaultState));
let currentPrice = CONF.baseCryptoPrice;

// --- INIT ---
function init() {
    loadGame();
    setupUI();
    setupSidebar();
    
    setInterval(gameLoop, 1000);
    setInterval(fluctuatePrice, CONF.priceUpdateInterval);
    setInterval(saveGame, CONF.autoSaveInterval);
    
    fluctuatePrice();
    renderShop();
    updateUI();
}

// --- CORE MECHANICS ---
function gameLoop() {
    // Auto Mine
    const autoMineAmount = calculateAutoHash() / 1000;
    if (autoMineAmount > 0) mineCrypto(autoMineAmount);
    
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
    // Base click is 1% of total hash or min 0.001
    const baseTap = 0.001;
    const powerBonus = (state.hashPower * state.prestigeMult) / 2000;
    const amount = baseTap + powerBonus;
    
    mineCrypto(amount);
    state.stats.taps++;
    addXP(1);
    
    // Calculate position for visual effect
    let x = e.clientX;
    let y = e.clientY;
    
    // If it's a touch event, fix coordinates
    if(!x && e.touches && e.touches.length > 0) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    }

    // Default center if undefined
    if(!x) {
        const rect = document.getElementById('click-miner').getBoundingClientRect();
        x = rect.left + rect.width/2;
        y = rect.top + rect.height/2;
    }

    showFloatingText(x, y, `+${amount.toFixed(5)}`);
    updateUI();
}

function fluctuatePrice() {
    const change = (Math.random() * 0.3) - 0.15; // +/- 15% volatility
    currentPrice = currentPrice * (1 + change);
    if(currentPrice < 20) currentPrice = 20;
    if(currentPrice > 1000) currentPrice = 1000;
    updateUI();
}

function sellCrypto() {
    if (state.crypto <= 0) return;
    const value = state.crypto * currentPrice;
    state.cash += value;
    state.lifetimeCash += value;
    state.crypto = 0;
    logEvent(`Sold Assets: +$${value.toFixed(2)}`);
    addXP(10);
    updateUI();
}

function buyItem(itemId) {
    const item = shopItems.find(i => i.id === itemId);
    const currentCost = Math.floor(item.cost * Math.pow(1.15, state.rigs[itemId]));
    
    if (state.cash >= currentCost) {
        state.cash -= currentCost;
        state.rigs[itemId]++;
        logEvent(`Acquired: ${item.name}`);
        renderShop();
        updateUI();
    }
}

function addXP(amount) {
    state.xp += amount;
    if (state.xp >= state.xpNeeded) {
        state.level++;
        state.xp = 0;
        state.xpNeeded = Math.floor(state.xpNeeded * 1.5);
        logEvent(`Level Up! reached Lvl ${state.level}`);
    }
}

function prestige() {
    if (state.lifetimeCash < 1000000) return;
    if(confirm("Prestige Reset: Are you sure?")) {
        const bonus = Math.floor(state.lifetimeCash / 100000);
        state.prestigeMult += (bonus / 100);
        state.prestigeCount++;
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

// --- UI & HELPERS ---
function updateUI() {
    document.getElementById('ui-cash').innerText = state.cash.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('ui-crypto').innerText = state.crypto.toFixed(6);
    document.getElementById('ui-level').innerText = state.level;
    
    // Home
    const marketEl = document.getElementById('ui-market-price');
    marketEl.innerText = currentPrice.toFixed(2);
    marketEl.style.color = currentPrice >= CONF.baseCryptoPrice ? '#10b981' : '#ef4444';

    // Mine
    const totalHash = calculateAutoHash();
    document.getElementById('ui-hashrate').innerText = totalHash;
    document.getElementById('ui-auto-mining').innerText = totalHash > 0 ? "ACTIVE" : "OFF";
    
    // Profile
    document.getElementById('ui-xp').innerText = state.xp;
    document.getElementById('ui-xp-needed').innerText = state.xpNeeded;
    document.getElementById('ui-xp-bar').style.width = `${(state.xp/state.xpNeeded)*100}%`;
    document.getElementById('ui-prestige-mult').innerText = Math.round((state.prestigeMult - 1) * 100);
    document.getElementById('btn-prestige').disabled = state.lifetimeCash < 1000000;
    
    // Stats
    document.getElementById('stat-taps').innerText = state.stats.taps;
    document.getElementById('stat-total-cash').innerText = state.lifetimeCash.toLocaleString();
    document.getElementById('stat-prestiges').innerText = state.prestigeCount;
    document.getElementById('stat-playtime').innerText = state.stats.playtime;
}

function renderShop() {
    const container = document.getElementById('shop-container');
    container.innerHTML = '';
    shopItems.forEach(item => {
        const quantity = state.rigs[item.id];
        const cost = Math.floor(item.cost * Math.pow(1.15, quantity));
        const canAfford = state.cash >= cost;
        
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = `
            <div>
                <div style="font-weight:bold; font-size:1.1rem">${item.icon} ${item.name}</div>
                <div style="color:#94a3b8; font-size:0.8rem">+${item.power} H/s • Owned: ${quantity}</div>
            </div>
            <button class="buy-btn" style="opacity:${canAfford?1:0.5}" onclick="buyItem('${item.id}')">$${cost}</button>
        `;
        container.appendChild(el);
    });
}

function checkMissions() {
    const list = document.getElementById('mission-list');
    list.innerHTML = '';
    const missions = [
        { txt: 'Tap 100 times', done: state.stats.taps >= 100 },
        { txt: 'Earn $1,000 Lifetime', done: state.lifetimeCash >= 1000 },
        { txt: 'Reach Level 5', done: state.level >= 5 }
    ];
    missions.forEach(m => {
        const li = document.createElement('li');
        li.style.cssText = `padding:8px; border-bottom:1px solid rgba(255,255,255,0.05); color:${m.done?'#10b981':'#94a3b8'}`;
        li.innerHTML = `${m.done ? '✓' : '○'} ${m.txt}`;
        list.appendChild(li);
    });
}

function logEvent(msg) {
    const list = document.getElementById('event-log');
    const item = document.createElement('li');
    item.innerText = `> ${msg}`;
    list.insertBefore(item, list.firstChild);
    if(list.children.length > 6) list.removeChild(list.lastChild);
}

function showFloatingText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

// --- SIDEBAR & NAVIGATION ---
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-sidebar');

    function toggleSidebar() {
        const isOpen = sidebar.classList.contains('open');
        if(isOpen) {
            sidebar.classList.remove('open');
            overlay.classList.add('hidden');
        } else {
            sidebar.classList.add('open');
            overlay.classList.remove('hidden');
        }
    }

    menuBtn.addEventListener('click', toggleSidebar);
    closeBtn.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);
}

// Exposed to global scope for HTML onclick
window.openModal = function(modalId) {
    document.querySelectorAll('.modal-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(modalId).classList.remove('hidden');
    document.getElementById('modal-container').classList.remove('hidden');
    
    // Close sidebar if open
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.add('hidden');
}

window.closeModal = function() {
    document.getElementById('modal-container').classList.add('hidden');
}

function setupUI() {
    const navs = document.querySelectorAll('.nav-btn');
    navs.forEach(btn => {
        btn.addEventListener('click', () => {
            navs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    document.getElementById('btn-sell-all').addEventListener('click', sellCrypto);
    document.getElementById('btn-prestige').addEventListener('click', prestige);
    
    const miner = document.getElementById('click-miner');
    miner.addEventListener('mousedown', clickMine);
    miner.addEventListener('touchstart', (e) => { e.preventDefault(); clickMine(e); });
}

// --- SAVE SYSTEM ---
function saveGame() { localStorage.setItem('cryptoPro_v2', JSON.stringify(state)); }
function loadGame() {
    const saved = localStorage.getItem('cryptoPro_v2');
    if (saved) state = { ...defaultState, ...JSON.parse(saved), rigs: { ...defaultState.rigs, ...JSON.parse(saved).rigs } };
}

window.onload = init;

