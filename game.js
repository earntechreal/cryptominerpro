document.addEventListener("DOMContentLoaded", function () {
  const root = document.getElementById("crypto-miner-game-root");
  if (!root) return;

  const STORAGE_KEY = "CryptoMinerProV2";

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
    activeScreen: "home",
    nickname: "Guest Miner"
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
      if (!state.nickname) {
        state.nickname = "Guest Miner";
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

    const oldLevel = state.level;
    const oldValue = getPortfolioValue();

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
            <span class="cmg-tag green">Rigs bought: ${state.stats.rigsBought || 0}</span>
          </div>
        </div>

        <div class="cmg-card">
          <h3>🎁 Daily Gift</h3>
          <div class="cmg-row">
            <span class="cmg-tag green">Streak: ${state.daily.streak || 0} day(s)</span>
            <span class="cmg-tag">${state.daily.claimedToday ? "Already claimed" : "Tap to collect!"}</span>
          </div>
          <div class="cmg-buttons">
            <button class="cmg-btn small" id="cmg-daily-btn" ${(!state.daily.claimedToday && state.daily.lastDate === todayString()) ? "" : "disabled"}>
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
            Prestige resets your run but makes all future mining stronger forever.
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
            </div>
          </div>
          <div class="cmg-buttons">
            <button class="cmg-btn" id="cmg-mine-btn">⛏ Tap to Mine</button>
            <button class="cmg-btn small secondary" id="cmg-sell-half-btn">Sell 50% ${state.activeCoin}</button>
            <button class="cmg-btn small secondary" id="cmg-sell-all-btn">Sell ALL ${state.activeCoin}</button>
          </div>
        </div>

        <div class="cmg-card">
          <h3>🪙 Silly Coins</h3>
          <div class="cmg-coins-list">
            ${coinsHtml}
          </div>
        </div>

        <div class="cmg-card">
          <h3>📜 Mine Notes</h3>
          <div class="cmg-log">
            ${logHtml}
          </div>
        </div>
      </div>
    `;
  }

  function renderShop() {
    let rigsHtml = "";
    rigsCatalog.forEach(r => {
      const owned = state.rigs[r.id]?.owned || 0;
      const cost = r.baseCost * Math.pow(1.25, owned);
      rigsHtml += `
        <div class="cmg-rig-item">
          <div>
            <div class="cmg-rig-name">${r.name}</div>
            <div class="cmg-rig-meta">+${fmt(r.hashPower, 0)} H/s · ${r.description}</div>
            <div class="cmg-rig-meta">Owned: <strong>${owned}</strong></div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.7rem;margin-bottom:3px;">Cost: <strong>$${fmt(cost, 2)}</strong></div>
            <button class="cmg-btn small" data-buy-rig="${r.id}">Buy</button>
          </div>
        </div>
      `;
    });

    return `
      <div class="cmg-screen" data-screen="shop">
        <div class="cmg-card">
          <h3>🛒 Candy Shop</h3>
          <div style="font-size:0.72rem;color:var(--cms-text-muted);margin-bottom:4px;">
            Spend your fake cash on cute mining machines to boost your hash power.
          </div>
          <div class="cmg-rigs-list">
            ${rigsHtml}
          </div>
        </div>

        <div class="cmg-ad-slot">
          Optional shop banner area. Any real ads here must be passive only
          (no in-game rewards for viewing or clicking).
        </div>
      </div>
    `;
  }

  function renderProfile() {
    const portfolio = getPortfolioValue();
    const totalRigs = rigsCatalog.reduce((sum, r) => sum + (state.rigs[r.id]?.owned || 0), 0);

    return `
      <div class="cmg-screen" data-screen="profile">
        <div class="cmg-card">
          <h3>👤 Miner Profile</h3>
          <div class="cmg-row" style="align-items:center;">
            <div class="cmg-avatar">⛏️</div>
            <div>
              <div style="font-weight:700;font-size:0.9rem;">${state.nickname}</div>
              <div style="font-size:0.72rem;color:var(--cms-text-muted);">
                Level ${state.level} · ${fmt(portfolio, 0)} fake credits
              </div>
            </div>
          </div>
          <div class="cmg-row">
            <span class="cmg-tag blue">Sessions played: ${state.stats.sessions || 0}</span>
            <span class="cmg-tag green">Prestiges: ${state.stats.prestiges || 0}</span>
          </div>
          <div class="cmg-row">
            <span class="cmg-tag">Rigs owned: ${totalRigs}</span>
            <span class="cmg-tag">Manual taps: ${state.stats.manualClicks || 0}</span>
          </div>
          <div class="cmg-buttons">
            <button class="cmg-btn small ghost" id="cmg-change-name-btn">✏️ Change Nickname</button>
          </div>
        </div>

        <div class="cmg-card">
          <h3>📅 Daily Progress</h3>
          <div class="cmg-row">
            <span class="cmg-tag green">Streak: ${state.daily.streak || 0} day(s)</span>
            <span class="cmg-tag">${state.daily.claimedToday ? "Today's gift claimed" : "Gift waiting on Home tab"}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--cms-text-muted);margin-top:4px;">
            Tip: Open the game every day to increase your streak and boost your early fake earnings.
          </div>
        </div>
      </div>
    `;
  }

  function renderStats() {
    let missionsHtml = "";
    missionsDef.forEach(m => {
      const progress = getMissionProgress(m);
      const claimed = !!state.missionsClaimed[m.id];
      const done = progress >= m.target;
      const pct = Math.min(100, (progress / m.target) * 100);
      missionsHtml += `
        <div class="cmg-mission-item">
          <div class="cmg-mission-title">${m.title}</div>
          <div class="cmg-mission-meta">
            <span>${m.desc}</span>
            <span>${Math.min(progress, m.target)}/${m.target}</span>
          </div>
          <div class="cmg-progress-bar" style="margin-top:3px;">
            <div class="cmg-progress-inner" style="width:${pct}%;"></div>
          </div>
          <div class="cmg-buttons" style="justify-content:space-between;margin-top:4px;">
            <div>
              <span class="cmg-tag green">+$${m.cash}</span>
              <span class="cmg-tag blue">+${m.xp} XP</span>
            </div>
            <button class="cmg-btn small ghost"
              data-mission="${m.id}"
              ${!done || claimed ? "disabled" : ""}>
              ${claimed ? "Claimed" : "Claim Reward"}
            </button>
          </div>
        </div>
      `;
    });

    let achievementsHtml = "";
    achievementsDef.forEach(a => {
      const status = state.achievements[a.id];
      const unlocked = status && status.unlocked;
      achievementsHtml += `
        <div class="cmg-achievement-item">
          <div class="cmg-achievement-main">
            <strong>${a.title}</strong>
            <span>${a.desc}</span>
          </div>
          <div class="cmg-achievement-state">
            ${unlocked ? '<span class="cmg-tag gold">Unlocked</span>' : '<span class="cmg-tag">Locked</span>'}
          </div>
        </div>
      `;
    });

    return `
      <div class="cmg-screen" data-screen="stats">
        <div class="cmg-card">
          <h3>🎯 Missions</h3>
          <div style="font-size:0.72rem;color:var(--cms-text-muted);margin-bottom:4px;">
            Complete tasks to earn extra fake cash and XP. All rewards stay inside this browser only.
          </div>
          <div class="cmg-mission-list">
            ${missionsHtml}
          </div>
        </div>

        <div class="cmg-card">
          <h3>🏆 Achievements</h3>
          <div class="cmg-achievements-list">
            ${achievementsHtml}
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- MAIN RENDER ---------- */

  function render() {
    const portfolio = getPortfolioValue();
    const nowMultiplier = getGlobalMultiplier();

    let screenHtml = "";
    if (state.activeScreen === "home") screenHtml = renderHome();
    else if (state.activeScreen === "mine") screenHtml = renderMine();
    else if (state.activeScreen === "shop") screenHtml = renderShop();
    else if (state.activeScreen === "profile") screenHtml = renderProfile();
    else if (state.activeScreen === "stats") screenHtml = renderStats();

    root.innerHTML = `
      <div class="cmg-app-shell">
        <div class="cmg-header">
          <div class="cmg-header-top">
            <div>
              <div class="cmg-title">Crypto Miner Pro</div>
              <div class="cmg-subtitle">Tap, upgrade & learn — all fake, all fun.</div>
            </div>
            <div class="cmg-pill">
              💼 <span>Portfolio</span> $${fmt(portfolio, 2)}
            </div>
          </div>
          <div class="cmg-header-bottom">
            <div class="cmg-chip">⭐ Lv. ${state.level}</div>
            <div class="cmg-chip">🔁 Prestige: ${state.prestigePoints || 0}</div>
            <div class="cmg-chip">⚙️ Boost: ${fmt((nowMultiplier - 1) * 100, 1)}%</div>
          </div>
        </div>

        <div class="cmg-main">
          ${screenHtml}
        </div>

        <div class="cmg-bottom-nav">
          <button class="cmg-nav-item ${state.activeScreen === "home" ? "active" : ""}" data-screen="home">
            <div class="cmg-nav-icon">🏠</div>
            <span>Home</span>
          </button>
          <button class="cmg-nav-item ${state.activeScreen === "mine" ? "active" : ""}" data-screen="mine">
            <div class="cmg-nav-icon">⛏</div>
            <span>Mine</span>
          </button>
          <button class="cmg-nav-item ${state.activeScreen === "shop" ? "active" : ""}" data-screen="shop">
            <div class="cmg-nav-icon">🛒</div>
            <span>Shop</span>
          </button>
          <button class="cmg-nav-item ${state.activeScreen === "profile" ? "active" : ""}" data-screen="profile">
            <div class="cmg-nav-icon">👤</div>
            <span>Profile</span>
          </button>
          <button class="cmg-nav-item ${state.activeScreen === "stats" ? "active" : ""}" data-screen="stats">
            <div class="cmg-nav-icon">📊</div>
            <span>Stats</span>
          </button>
        </div>
      </div>
    `;

    /* NAV */
    root.querySelectorAll(".cmg-nav-item").forEach(btn => {
      btn.addEventListener("click", function () {
        const scr = this.getAttribute("data-screen");
        if (!scr) return;
        state.activeScreen = scr;
        render();
        saveState();
      });
    });

    /* HOME */
    const dailyBtn = document.getElementById("cmg-daily-btn");
    if (dailyBtn) dailyBtn.addEventListener("click", claimDaily);

    const prestigeBtn = document.getElementById("cmg-prestige-btn");
    if (prestigeBtn) prestigeBtn.addEventListener("click", doPrestige);

    const softResetBtn = document.getElementById("cmg-soft-reset-btn");
    if (softResetBtn) softResetBtn.addEventListener("click", softReset);

    /* MINE */
    const mineBtn = document.getElementById("cmg-mine-btn");
    if (mineBtn) mineBtn.addEventListener("click", clickMineBurst);

    const sellHalfBtn = document.getElementById("cmg-sell-half-btn");
    if (sellHalfBtn) sellHalfBtn.addEventListener("click", () => sellCoin(0.5));

    const sellAllBtn = document.getElementById("cmg-sell-all-btn");
    if (sellAllBtn) sellAllBtn.addEventListener("click", () => sellCoin(1));

    root.querySelectorAll("[data-coin]").forEach(el => {
      el.addEventListener("click", function () {
        const id = this.getAttribute("data-coin");
        if (!id) return;
        state.activeCoin = id;
        pushLog("Switched target coin to " + id + ".");
        render();
        saveState();
      });
    });

    /* SHOP */
    root.querySelectorAll("[data-buy-rig]").forEach(btn => {
      btn.addEventListener("click", function () {
        const id = this.getAttribute("data-buy-rig");
        if (!id) return;
        buyRig(id);
      });
    });

    /* STATS (missions) */
    root.querySelectorAll("[data-mission]").forEach(btn => {
      btn.addEventListener("click", function () {
        const id = this.getAttribute("data-mission");
        if (!id) return;
        claimMission(id);
      });
    });

    /* PROFILE nickname */
    const nameBtn = document.getElementById("cmg-change-name-btn");
    if (nameBtn) {
      nameBtn.addEventListener("click", function () {
        const current = state.nickname || "Guest Miner";
        const next = prompt("Enter your miner nickname:", current);
        if (!next) return;
        state.nickname = String(next).slice(0, 20);
        pushLog("Nickname changed to " + state.nickname + ".");
        render();
        saveState();
      });
    }
  }

  /* ---------- INITIALISE GAME ---------- */

  loadState();
  if (!state.coins || Object.keys(state.coins).length === 0) initCoinsAndRigs();
  if (!state.rigs || Object.keys(state.rigs).length === 0) initCoinsAndRigs();
  recalcHashPower();
  initDaily();
  state.stats.sessions = (state.stats.sessions || 0) + 1;

  const nowMs = Date.now();
  processOffline(nowMs);
  state.lastTimestamp = nowMs;

  pushLog("Game loaded. Session #" + state.stats.sessions + " started. 🎮");
  checkAchievements();
  render();
  saveState();

  /* GAME LOOP */
  setInterval(function () {
    simulatePrices();
    autoMine(1);
    state.lastTimestamp = Date.now();
    render();
    saveState();
  }, 1000);
});

