document.addEventListener("DOMContentLoaded", function () {
  const root = document.getElementById("crypto-miner-game-root");
  if (!root) return;

  const STORAGE_KEY = "CryptoMinerProV1";

  const baseCoins = [
    { id: "BTC",  name: "BitBunny",   basePrice: 65000, difficulty: 1.0,  volatility: 0.9 },
    { id: "ETH",  name: "EtherKitty", basePrice: 3400,  difficulty: 0.7,  volatility: 1.1 },
    { id: "BNB",  name: "BunnyBNB",   basePrice: 500,   difficulty: 0.55, volatility: 1.0 },
    { id: "DOGE", name: "DogePuppy",  basePrice: 0.18,  difficulty: 0.35, volatility: 1.4 },
    { id: "SOL",  name: "SunnySol",   basePrice: 150,   difficulty: 0.6,  volatility: 1.3 }
  ];

  const rigsCatalog = [
    { id: "toycpu",   name: "Toy CPU Miner",      baseCost: 400,   hashPower: 4,    description: "Cute little brain chip." },
    { id: "toygpu",   name: "Candy GPU Rig",      baseCost: 2200,  hashPower: 35,   description: "Rainbow coloured GPU box." },
    { id: "duckasic", name: "Duck ASIC Machine",  baseCost: 9000,  hashPower: 160,  description: "Quacks out hash power." },
    { id: "farm",     name: "Cartoon Mining Farm",baseCost: 48000, hashPower: 1100, description: "Full fun-farm of miners." }
  ];

  const missionsDef = [
    {
      id: "clicks50",
      title: "Tap-Tap Beginner",
      desc: "Tap the Mine button 50 times.",
      type: "manualClicks",
      target: 50,
      xp: 50,
      cash: 150
    },
    {
      id: "rigs5",
      title: "Rig Collector",
      desc: "Own 5 total mining rigs.",
      type: "rigsOwned",
      target: 5,
      xp: 80,
      cash: 350
    },
    {
      id: "lvl5",
      title: "Level 5 Hero",
      desc: "Reach player level 5.",
      type: "level",
      target: 5,
      xp: 120,
      cash: 600
    }
  ];

  const achievementsDef = [
    { id: "lvl5",     title: "Rising Miner",    desc: "Reach level 5.",           type: "level",     threshold: 5 },
    { id: "lvl10",    title: "Pro Miner",       desc: "Reach level 10.",          type: "level",     threshold: 10 },
    { id: "rigs10",   title: "Hardware Hoarder",desc: "Own 10 total rigs.",       type: "rigsOwned", threshold: 10 },
    { id: "prestige1",title: "Second Life",     desc: "Prestige at least once.",  type: "prestige",  threshold: 1 }
  ];

  const state = {
    cash: 1000,
    coins: {},
    rigs: {},
    activeCoin: "BTC",
    totalHashPower: 0,
    tick: 0,
    log: [],
    level: 1,
    xp: 0,
    xpToNext: 100,
    prestigePoints: 0,
    stats: {
      manualClicks: 0,
      rigsBought: 0,
      sessions: 0,
      prestiges: 0
    },
    missionsClaimed: {},
    achievements: {},
    daily: {
      lastDate: null,
      streak: 0,
      claimedToday: false
    },
    lastTimestamp: null,
    activeScreen: "home"
  };

  /* ---------- UTILITIES ---------- */

  function fmt(num, decimals) {
    if (!isFinite(num)) return "0";
    return Number(num).toFixed(decimals);
  }

  function todayString() {
    return new Date().toISOString().slice(0, 10);
  }

  function getPortfolioValue() {
    let v = state.cash;
    Object.keys(state.coins).forEach(id => {
      const c = state.coins[id];
      v += c.amount * c.price;
    });
    return v;
  }

  function getGlobalMultiplier() {
    const p = state.prestigePoints || 0;
    return 1 + 0.15 * p;
  }

  function pushLog(msg) {
    const t = new Date();
    const timeStr = t.toLocaleTimeString();
    state.log.unshift({ time: timeStr, message: msg });
    state.log = state.log.slice(0, 60);
  }

  function calcXpToNext(level) {
    return 100 + Math.floor(level * level * 20);
  }

  /* ---------- INIT / STORAGE ---------- */

  function initCoinsAndRigs() {
    state.coins = {};
    baseCoins.forEach(c => {
      state.coins[c.id] = {
        id: c.id,
        name: c.name,
        amount: 0,
        totalMined: 0,
        price: c.basePrice,
        basePrice: c.basePrice,
        difficulty: c.difficulty,
        volatility: c.volatility,
        trendMomentum: 0
      };
    });
    state.rigs = {};
    rigsCatalog.forEach(r => {
      state.rigs[r.id] = {
        id: r.id,
        name: r.name,
        baseCost: r.baseCost,
        hashPower: r.hashPower,
        description: r.description,
        owned: 0
      };
    });
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        initCoinsAndRigs();
        return;
      }
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") {
        initCoinsAndRigs();
        return;
      }
      Object.assign(state, data);
      if (!state.coins || Object.keys(state.coins).length === 0) {
        initCoinsAndRigs();
      }
      if (!state.rigs || Object.keys(state.rigs).length === 0) {
        initCoinsAndRigs();
      }
      if (!state.stats) {
        state.stats = { manualClicks: 0, rigsBought: 0, sessions: 0, prestiges: 0 };
      }
      if (!state.daily) {
        state.daily = { lastDate: todayString(), streak: 1, claimedToday: false };
      }
    } catch (e) {
      initCoinsAndRigs();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function recalcHashPower() {
    let total = 0;
    rigsCatalog.forEach(r => {
      const owned = state.rigs[r.id]?.owned || 0;
      total += owned * r.hashPower;
    });
    state.totalHashPower = total * getGlobalMultiplier();
  }

  /* ---------- ECONOMY / MINING ---------- */

  function simulatePrices() {
    state.tick++;
    baseCoins.forEach(cdef => {
      const coin = state.coins[cdef.id];
      if (!coin) return;
      const drift = 0.0005;
      const randomShock = (Math.random() - 0.5) * 0.02 * coin.volatility;
      coin.trendMomentum = coin.trendMomentum * 0.92 + randomShock;
      let change = drift + coin.trendMomentum;
      change = Math.max(Math.min(change, 0.05), -0.05);
      const newPrice = coin.price * (1 + change);
      const minPrice = coin.basePrice * 0.2;
      const maxPrice = coin.basePrice * 3.5;
      coin.price = Math.max(minPrice, Math.min(maxPrice, newPrice));
    });
  }

  function autoMine(seconds) {
    if (state.totalHashPower <= 0) return;
    const coin = state.coins[state.activeCoin];
    if (!coin) return;
    const baseYield = 0.000002;
    const mined = (state.totalHashPower * baseYield * seconds) / (coin.difficulty || 1);
    coin.amount += mined;
    coin.totalMined += mined;
    grantXp(1);
  }

  function processOffline(nowMs) {
    if (!state.lastTimestamp) {
      state.lastTimestamp = nowMs;
      return;
    }
    const deltaMs = nowMs - state.lastTimestamp;
    if (deltaMs <= 2000) return;

    const maxMs = 2 * 60 * 60 * 1000; // credit up to 2h
    const effectiveMs = Math.min(deltaMs, maxMs);
    const seconds = Math.floor(effectiveMs / 1000);
    if (seconds <= 3 || state.totalHashPower <= 0) return;

    const coin = state.coins[state.activeCoin];
    if (!coin) return;

    const baseYield = 0.000002;
    const minedPerSec = (state.totalHashPower * baseYield * 0.35) / (coin.difficulty || 1);
    const mined = minedPerSec * seconds;
    if (mined <= 0) return;

    coin.amount += mined;
    coin.totalMined += mined;
    pushLog("While you were away (" + seconds + "s), you mined ≈ " + fmt(mined, 6) + " " + coin.id + ".");
  }

  function clickMineBurst() {
    const coin = state.coins[state.activeCoin];
    if (!coin) return;
    const burstRate = 0.00003;
    const mined = burstRate / (coin.difficulty || 1);
    coin.amount += mined;
    coin.totalMined += mined;
    state.stats.manualClicks = (state.stats.manualClicks || 0) + 1;
    grantXp(2);
    pushLog("Tap mining: +" + fmt(mined, 6) + " " + coin.id);
    checkAchievements();
    render();
    saveState();
  }

  function buyRig(rigId) {
    const rigDef = rigsCatalog.find(r => r.id === rigId);
    if (!rigDef) return;
    const current = state.rigs[rigId] || { owned: 0 };
    const owned = current.owned || 0;
    const cost = rigDef.baseCost * Math.pow(1.25, owned);

    if (state.cash < cost) {
      pushLog("Not enough candy coins to buy " + rigDef.name + ".");
      render();
      return;
    }

    state.cash -= cost;
    state.rigs[rigId].owned = owned + 1;
    state.stats.rigsBought = (state.stats.rigsBought || 0) + 1;
    recalcHashPower();
    grantXp(10);
    pushLog("Bought " + rigDef.name + " for $" + fmt(cost, 2));
    checkAchievements();
    render();
    saveState();
  }

  function sellCoin(percent) {
    const coin = state.coins[state.activeCoin];
    if (!coin) return;
    if (coin.amount <= 0) {
      pushLog("You don’t own any " + coin.id + " to sell.");
      render();
      return;
    }
    const amountToSell = coin.amount * percent;
    const revenue = amountToSell * coin.price;
    coin.amount -= amountToSell;
    state.cash += revenue;
    pushLog("Sold " + fmt(amountToSell, 6) + " " + coin.id + " for $" + fmt(revenue, 2));
    render();
    saveState();
  }

  /* ---------- XP / LEVEL / DAILY / MISSIONS / ACHIEVEMENTS ---------- */

  function grantXp(amount) {
    if (!amount || amount <= 0) return;
    state.xp += amount;
    let leveledUp = false;
    while (state.xp >= state.xpToNext) {
      state.xp -= state.xpToNext;
      state.level += 1;
      state.xpToNext = calcXpToNext(state.level);
      leveledUp = true;
      pushLog("Yay! You reached level " + state.level + " 🎉");
    }
    if (leveledUp) checkAchievements();
  }

  function initDaily() {
    const today = todayString();
    if (!state.daily) {
      state.daily = { lastDate: today, streak: 1, claimedToday: false };
      return;
    }
    if (!state.daily.lastDate) {
      state.daily.lastDate = today;
      state.daily.streak = 1;
      state.daily.claimedToday = false;
      return;
    }
    if (state.daily.lastDate === today) return;

    const prev = new Date(state.daily.lastDate);
    const now = new Date(today);
    const diffDays = Math.floor((now - prev) / 86400000);
    if (diffDays === 1) {
      state.daily.streak = (state.daily.streak || 0) + 1;
    } else {
      state.daily.streak = 1;
    }
    state.daily.lastDate = today;
    state.daily.claimedToday = false;
  }

  function claimDaily() {
    initDaily();
    if (state.daily.claimedToday) return;
    const streak = state.daily.streak || 1;
    const cashReward = 120 + streak * 60;
    const xpReward = 35 + streak * 12;
    state.cash += cashReward;
    grantXp(xpReward);
    state.daily.claimedToday = true;
    pushLog("Daily gift: streak " + streak + " · +" + cashReward + " cash, +" + xpReward + " XP 🎁");
    render();
    saveState();
  }

  function getMissionProgress(m) {
    if (m.type === "manualClicks") return state.stats.manualClicks || 0;
    if (m.type === "rigsOwned") {
      let total = 0;
      rigsCatalog.forEach(r => { total += state.rigs[r.id]?.owned || 0; });
      return total;
    }
    if (m.type === "level") return state.level || 1;
    return 0;
  }

  function claimMission(id) {
    const m = missionsDef.find(x => x.id === id);
    if (!m) return;
    const progress = getMissionProgress(m);
    if (progress < m.target) return;
    if (state.missionsClaimed[id]) return;

    state.missionsClaimed[id] = true;
    state.cash += m.cash;
    grantXp(m.xp);
    pushLog("Mission done: " + m.title + " · +" + m.cash + " cash, +" + m.xp + " XP 🎯");
    render();
    saveState();
  }

  function checkAchievements() {
    achievementsDef.forEach(a => {
      const already = state.achievements[a.id]?.unlocked;
      if (already) return;

      let value = 0;
      if (a.type === "level") {
        value = state.level || 1;
      } else if (a.type === "rigsOwned") {
        let t = 0;
        rigsCatalog.forEach(r => { t += state.rigs[r.id]?.owned || 0; });
        value = t;
      } else if (a.type === "prestige") {
        value = state.stats.prestiges || 0;
      }

      if (value >= a.threshold) {
        if (!state.achievements[a.id]) state.achievements[a.id] = {};
        state.achievements[a.id].unlocked = true;
        state.achievements[a.id].time = new Date().toLocaleString();
        pushLog("Achievement unlocked: " + a.title + " 🏆");
      }
    });
  }

  /* ---------- PRESTIGE / RESET ---------- */

  function canPrestige() {
    const lvlOk = state.level >= 10;
    const valueOk = getPortfolioValue() >= 50000;
    return lvlOk && valueOk;
  }

  function doPrestige() {
    if (!canPrestige()) return;
    if (!confirm("Prestige reset: start over but gain a permanent mining boost. Continue?")) return;

    state.prestigePoints = (state.prestigePoints || 0) + 1;
    state.stats.prestiges = (state.stats.prestiges || 0) + 1;

    const newP = state.prestigePoints;
    const oldLevel = state.level;
    const oldValue = getPortfolioValue();

    // reset run, keep prestige
    state.cash = 1000;
    Object.keys(state.coins).forEach(id => {
      state.coins[id].amount = 0;
      state.coins[id].totalMined = 0;
    });
    Object.keys(state.rigs).forEach(id => {
      state.rigs[id].owned = 0;
    });
    state.level = 1;
    state.xp = 0;
    state.xpToNext = calcXpToNext(1);
    state.missionsClaimed = {};
    initDaily();
    recalcHashPower();

    pushLog("Prestige! New permanent mining bonus: " +
      fmt((getGlobalMultiplier() - 1) * 100, 1) + "% 💫");
    pushLog("You prestiged from level " + oldLevel +
      " with $" + fmt(oldValue, 2) + " portfolio.");
    checkAchievements();
    render();
    saveState();
  }

  function softReset() {
    if (!confirm("Soft reset = restart coins, rigs, cash & level, but keep prestige bonus. Continue?")) return;

    const keepP = state.prestigePoints || 0;
    const keepPrestiges = state.stats.prestiges || 0;
    const keepSessions = state.stats.sessions || 1;

    state.cash = 1000;
    initCoinsAndRigs();
    state.activeCoin = "BTC";
    state.totalHashPower = 0;
    state.tick = 0;
    state.log = [];
    state.level = 1;
    state.xp = 0;
    state.xpToNext = calcXpToNext(1);
    state.prestigePoints = keepP;
    state.stats = {
      manualClicks: 0,
      rigsBought: 0,
      sessions: keepSessions,
      prestiges: keepPrestiges
    };
    state.missionsClaimed = {};
    state.achievements = state.achievements || {};
    state.daily = { lastDate: todayString(), streak: 1, claimedToday: false };
    state.lastTimestamp = Date.now();
    state.activeScreen = "home";

    recalcHashPower();
    pushLog("Soft reset done. Prestige bonus kept: " +
      fmt((getGlobalMultiplier() - 1) * 100, 1) + "% 🌟");
    render();
    saveState();
  }

  /* ---------- RENDER SCREENS ---------- */

  function renderHome() {
    const portfolio = getPortfolioValue();
    const xpPercent = Math.min(100, (state.xp / (state.xpToNext || 1)) * 100);
    const today = todayString();
    const dailyAvailable = !state.daily.claimedToday && state.daily.lastDate === today;

    return `
      <div class="cmg-screen" data-screen="home">
        <div class="cmg-card">
          <h3>📊 Town Hall</h3>
          <div class="cmg-row">
            <div class="cmg-stat-pill">💰 Cash: <strong>$${fmt(state.cash, 2)}</strong></div>
            <div class="cmg-stat-pill">🎒 Portfolio: <strong>$${fmt(portfolio, 2)}</strong></div>
          </div>
          <div class="cmg-row">
            <div class="cmg-stat-pill">⭐ Level: <strong>${state.level}</strong></div>
            <div class="cmg-stat-pill">🔁 Prestige: <strong>${state.prestigePoints || 0}</strong></div>
          </div>
          <div class="cmg-progress-wrap">
            <div class="cmg-progress-label">
              <span>XP to next level</span>
              <span>${fmt(state.xp, 0)} / ${fmt(state.xpToNext, 0)}</span>
            </div>
            <div class="cmg-progress-bar">
              <div class="cmg-progress-inner xp" style="width:${xpPercent}%;"></div>
            </div>
          </div>
          <div class="cmg-row" style="margin-top:4px;">
            <span class="cmg-tag blue">Manual taps: ${state.stats.manualClicks || 0}</span>
            <span class="cmg-tag green">Rigs: ${state.stats.rigsBought || 0} bought</span>
          </div>
        </div>

        <div class="cmg-card">
          <h3>🎁 Daily Gift</h3>
          <div class="cmg-row">
            <span class="cmg-tag green">Streak: ${state.daily.streak || 0} day(s)</span>
            <span class="cmg-tag">${state.daily.claimedToday ? "Already claimed" : "Tap to collect!"}</span>
          </div>
          <div class="cmg-buttons">
            <button class="cmg-btn small" id="cmg-daily-btn" ${dailyAvailable ? "" : "disabled"}>
              🎁 Claim Daily Reward
            </button>
          </div>
        </div>

        <div class="cmg-card">
          <h3>💫 Prestige Control</h3>
          <div class="cmg-row">
            <span class="cmg-tag gold">Bonus: ${fmt((getGlobalMultiplier() - 1) * 100, 1)}% extra mining power</span>
          </div>
          <div class="cmg-row" style="font-size:0.7rem;color:var(--cms-text-muted);">
            Prestige resets your run but makes ALL future mining stronger forever.
          </div>
          <div class="cmg-buttons">
            <button class="cmg-btn small danger" id="cmg-prestige-btn" ${canPrestige() ? "" : "disabled"}>
              🔁 Prestige Reset
            </button>
            <button class="cmg-btn small ghost" id="cmg-soft-reset-btn">
              🔄 Soft Reset (keep bonus)
            </button>
          </div>
        </div>

        <div class="cmg-ad-slot">
          Optional banner spot. You may place a normal ad here as a passive ad
          (no rewards or incentives).
        </div>

        <div class="cmg-footer-note">
          Crypto Miner Pro is a fictional simulator. All coins, prices and rewards are pretend and only for fun + learning.
        </div>
      </div>
    `;
  }

  function renderMine() {
    const activeCoin = state.coins[state.activeCoin];
    const miningEfficiency =
      state.totalHashPower > 0 && activeCoin
        ? Math.min(100, (state.totalHashPower / (activeCoin.difficulty * 800)) * 100)
        : 0;

    let coinsHtml = "";
    baseCoins.forEach(cdef => {
      const coin = state.coins[cdef.id];
      const active = cdef.id === state.activeCoin ? "active" : "";
      coinsHtml += `
        <div class="cmg-coin-item ${active}" data-coin="${cdef.id}">
          <div class="cmg-coin-main">
            <div class="cmg-coin-name">${coin.name}
              <span style="font-size:0.8em;opacity:0.6;">(${coin.id})</span>
            </div>
            <div class="cmg-coin-meta">Held: ${fmt(coin.amount, 6)} · Mined: ${fmt(coin.totalMined, 6)}</div>
          </div>
          <div class="cmg-coin-right">
            <div><strong>$${fmt(coin.price, coin.price < 1 ? 4 : 2)}</strong></div>
            <div style="color:var(--cms-text-muted);">Diff: ${fmt(coin.difficulty, 2)}</div>
          </div>
        </div>
      `;
    });

    let logHtml = "";
    state.log.forEach(entry => {
      logHtml += `<div class="cmg-log-entry">
        <span style="opacity:0.6;">[${entry.time}]</span> ${entry.message}
      </div>`;
    });
    if (!logHtml) {
      logHtml = `<div class="cmg-log-entry">Welcome to the mine! Tap ⛏ to start.</div>`;
    }

    return `
      <div class="cmg-screen" data-screen="mine">
        <div class="cmg-card">
          <h3>⛏ Mining Pit</h3>
          <div class="cmg-row">
            <div class="cmg-stat-pill">⚙️ Hash Power: <strong>${fmt(state.totalHashPower, 0)} H/s</strong></div>
            <div class="cmg-stat-pill">🎯 Focus: <strong>${activeCoin ? activeCoin.name : "-"}</strong></div>
          </div>
          <div class="cmg-progress-wrap">
            <div class="cmg-progress-label">
              <span>Mining Efficiency</span>
              <span>${fmt(miningEfficiency, 1)}%</span>
            </div>
            <div class="cmg-progress-bar">
              <div class="cmg-progress-inner" style="width:${miningEfficiency}%;"></div>
       