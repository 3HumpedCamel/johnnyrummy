const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'Joker': 15 };
const BOT_NAMES = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy"];

class Card {
    constructor(suit, rank, isJoker = false) {
        this.suit = suit;
        this.rank = rank;
        this.isJoker = isJoker;
        this.id = Math.random().toString(36).substr(2, 9);
    }
    get value() { return this.isJoker ? VALUES['Joker'] : VALUES[this.rank]; }
    get color() { return this.isJoker ? 'black' : ((this.suit === '♥' || this.suit === '♦') ? 'red' : 'black'); }
}

class GameState {
    constructor() {
        this.deck = [];
        this.players = [[], [], [], []]; 
        this.table = []; 
        this.scores = [0, 0, 0, 0];
        this.roundScores = []; // Add array to track scores per round
        this.startingPlayer = 0; 
        this.currentTurn = 0;
        this.round = 1;
        this.hasDrawnThisTurn = false;
        this.lastDrawnCardId = null;
        
        let availableNames = [...BOT_NAMES];
        let chosenBots = [];
        for (let i = 0; i < 3; i++) {
            chosenBots.push(availableNames.splice(Math.floor(Math.random() * availableNames.length), 1)[0]);
        }
        this.playerNames = ["You", ...chosenBots];
        
        this.initializeDeck();
        this.deal();
    }
    
    initializeDeck() {
        this.deck = [];
        for (let i = 0; i < 2; i++) {
            for (let suit of SUITS) {
                for (let rank of RANKS) this.deck.push(new Card(suit, rank));
            }
        }
        for (let i = 0; i < 4; i++) this.deck.push(new Card(null, 'Joker', true));
        this.shuffleDeck();
    }
    
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    
    deal() {
        this.players = [[], [], [], []];
        for (let i = 0; i < 13; i++) {
            for (let p = 0; p < 4; p++) this.players[p].push(this.deck.pop());
        }
        this.sortHand(0); 
    }
    
    sortHand(playerIndex) {
        this.players[playerIndex].sort((a, b) => {
            if (a.isJoker && !b.isJoker) return 1;
            if (!a.isJoker && b.isJoker) return -1;
            if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
            return RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
        });
    }

    drawCard(playerIndex) {
        if (this.deck.length === 0) return null;
        const card = this.deck.pop();
        this.players[playerIndex].push(card);
        this.sortHand(playerIndex);
        if (playerIndex === 0) this.lastDrawnCardId = card.id;
        return card;
    }
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}
function _isValidMeldBase(cards) {
    if (cards.length < 3) return false;
    let isBook = true;
    let nonJokers = cards.filter(c => !c.isJoker);
    
    if (nonJokers.length > 0) {
        let bookRank = nonJokers[0].rank;
        for (let c of nonJokers) if (c.rank !== bookRank) { isBook = false; break; }
    } else isBook = true; 

    if (isBook) return true;

    let isRun = true;
    if (nonJokers.length > 0) {
        let runSuit = nonJokers[0].suit;
        for (let c of nonJokers) if (c.suit !== runSuit) { isRun = false; break; }
    } else return true;

    if (isRun) {
        function checkRunSpread(ranksArray) {
            ranksArray.sort((a, b) => a - b);
            if (new Set(ranksArray).size !== ranksArray.length) return false;
            return (ranksArray[ranksArray.length - 1] - ranksArray[0]) < cards.length;
        }
        let ranksInRun = nonJokers.map(c => RANKS.indexOf(c.rank));
        let isValidLowAce = checkRunSpread([...ranksInRun]);
        let isValidHighAce = ranksInRun.includes(0) ? checkRunSpread(ranksInRun.map(r => r === 0 ? 13 : r)) : false;
        return isValidLowAce || isValidHighAce;
    }
    return false;
}

function isValidMeld(cards) {
    if (!_isValidMeldBase(cards)) return false;
    let nonJokers = cards.filter(c => !c.isJoker);
    let jokers = cards.filter(c => c.isJoker);
    if (jokers.length > 0 && nonJokers.length >= 3 && _isValidMeldBase(nonJokers)) return false;
    return true;
}

function isValidTable(table) {
    for (let meld of table) if (!isValidMeld(meld)) return false;
    return true;
}

let game = new GameState();

// UI Elements
let playerHandEl, meldsContainerEl, statusMsgEl, drawDeckEl, passCoinEl;
let preTurnState = null;
let isRoundEndState = false; // Add state tracker for modal behavior

if (typeof document !== 'undefined') {
    playerHandEl = document.getElementById('player-hand');
    meldsContainerEl = document.getElementById('melds-container');
    statusMsgEl = document.getElementById('status-message');
    drawDeckEl = document.getElementById('draw-deck');
    passCoinEl = document.getElementById('pass-coin');
}

function savePreTurnState() {
    preTurnState = {
        hand: JSON.parse(JSON.stringify(game.players[0])),
        table: JSON.parse(JSON.stringify(game.table))
    };
}

function restorePreTurnState() {
    if (preTurnState) {
        game.players[0] = preTurnState.hand.map(c => Object.assign(new Card(c.suit, c.rank, c.isJoker), c));
        game.table = preTurnState.table.map(meld => meld.map(c => Object.assign(new Card(c.suit, c.rank, c.isJoker), c)));
        render();
        updateStatus("Reset to start of turn.");
    }
}

function updateStatus(msg) {
    if (statusMsgEl) statusMsgEl.textContent = msg;
}

// --- Custom Pointer Event Dragging ---
let draggingCardEl = null;
let dragGhostEl = null;
let dragStartX = 0, dragStartY = 0;
let dragLastX = 0;
let currentDraggedCardId = null;
let currentDraggedSource = null;
let hasMoved = false; // Add movement tracking

// --- Save State & High Score Utilities ---
function saveGameToStorage() {
    const stateToSave = {
        game: game,
        preTurnState: preTurnState,
        isRoundEndState: isRoundEndState
    };
    localStorage.setItem('johnnyRummySave', JSON.stringify(stateToSave));
}

function loadGameFromStorage() {
    const saved = localStorage.getItem('johnnyRummySave');
    if (!saved) return false;
    try {
        const parsed = JSON.parse(saved);
        Object.assign(game, parsed.game);
        
        const rehydrateCard = (c) => {
            let card = new Card(c.suit, c.rank, c.isJoker);
            card.id = c.id;
            card.isNewFromBot = c.isNewFromBot;
            return card;
        };

        game.deck = game.deck.map(rehydrateCard);
        game.players = game.players.map(hand => hand.map(rehydrateCard));
        game.table = game.table.map(meld => meld.map(rehydrateCard));

        preTurnState = parsed.preTurnState;
        if (preTurnState) {
            preTurnState.hand = preTurnState.hand.map(rehydrateCard);
            preTurnState.table = preTurnState.table.map(meld => meld.map(rehydrateCard));
        }
        
        isRoundEndState = parsed.isRoundEndState;
        document.getElementById('round-number').textContent = Math.min(game.round, 8);
        return true;
    } catch (e) {
        console.error("Save state corrupted", e);
        return false;
    }
}

async function saveHighScore(score) {
    // Prompt the player for their name to display on the leaderboard
    const playerName = prompt(`Game Over! You scored ${score}. Enter your name for the global leaderboard:`, "Player");
    
    // If they cancel or leave it blank, skip saving
    if (!playerName || playerName.trim() === "") return; 

    try {
        await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_name: playerName.trim().substring(0, 20), score: score })
        });
    } catch (err) {
        console.error("Failed to save global score:", err);
    }
}

async function renderHighScores() {
    const list = document.getElementById('high-scores-list');
    list.innerHTML = "<li>Loading global scores...</li>";
    
    try {
        const response = await fetch('/api/scores');
        if (!response.ok) throw new Error("Network response was not ok");
        
        const scores = await response.json();
        
        if (scores.length === 0) {
            list.innerHTML = "<li>No global scores yet. Be the first!</li>";
        } else {
            list.innerHTML = scores.map(s => `<li><strong>${s.score}</strong> points - ${escapeHTML(s.player_name)} (${s.play_date})</li>`).join('');
        }
    } catch (err) {
        console.error("Failed to fetch global scores:", err);
        list.innerHTML = "<li>Unable to load leaderboard.</li>";
    }
}

function attachPointerDrag(el, card, sourceInfo) {
    el.addEventListener('pointerdown', (e) => {
        if (game.currentTurn !== 0) return;
        
        e.preventDefault();
        hasMoved = false; // Reset on down
        
        currentDraggedCardId = card.id;
        currentDraggedSource = sourceInfo;
        draggingCardEl = el;
        
        const rect = el.getBoundingClientRect();
        
        dragGhostEl = document.createElement('div');
        dragGhostEl.className = `card ghost ${el.className.includes('in-hand') ? 'in-hand' : ''}`;
        dragGhostEl.style.cssText = el.style.cssText; 
        el.parentNode.insertBefore(dragGhostEl, el);
        
        el.style.position = 'fixed';
        el.style.left = rect.left + 'px';
        el.style.top = rect.top + 'px';
        el.style.margin = '0'; 
        el.style.transform = 'scale(1.05)';
        el.classList.add('is-dragging');
        
        dragStartX = e.clientX - rect.left;
        dragStartY = e.clientY - rect.top;
        dragLastX = e.clientX;
        
        el.setPointerCapture(e.pointerId);
    });
    
    el.addEventListener('pointermove', (e) => {
        if (!draggingCardEl || draggingCardEl !== el) return;
        hasMoved = true; // Mark that a drag occurred
        
        const x = e.clientX - dragStartX;
        const y = e.clientY - dragStartY;
        
        const vx = e.clientX - dragLastX;
        dragLastX = e.clientX;
        const tilt = Math.max(-15, Math.min(15, vx * 0.5));
        
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.transform = `scale(1.05) rotate(${tilt}deg)`;
    });
    
    el.addEventListener('pointerup', (e) => {
        if (!draggingCardEl || draggingCardEl !== el) return;
        el.releasePointerCapture(e.pointerId);
        
        let targetIndex = null;
        
        if (hasMoved) {
            el.style.display = 'none';
            const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
            el.style.display = 'flex';
            
            const meldTarget = dropTarget ? dropTarget.closest('.meld') : null;
            
            if (meldTarget) {
                targetIndex = meldTarget.dataset.index === 'new' ? game.table.length : parseInt(meldTarget.dataset.index);
            } else if (dropTarget && dropTarget.closest('#table-area')) {
                targetIndex = game.table.length;
            }
        } else {
            // Manual double-click detection
            const now = Date.now();
            const lastClick = el.dataset.lastClickTime ? parseInt(el.dataset.lastClickTime) : 0;
            
            if (now - lastClick < 300) {
                if (game.currentTurn === 0 && currentDraggedSource === 'hand') {
                    targetIndex = game.table.length; 
                }
            }
            el.dataset.lastClickTime = now;
        }
        
        if (dragGhostEl && dragGhostEl.parentNode) dragGhostEl.parentNode.removeChild(dragGhostEl);
        draggingCardEl = null;
        dragGhostEl = null;
        
        if (targetIndex !== null) {
            moveCard(currentDraggedCardId, currentDraggedSource, targetIndex);
        } else {
            render(); 
        }
    });

    // NEW: pointercancel listener added here to catch OS-level touch interruptions
    el.addEventListener('pointercancel', (e) => {
        if (!draggingCardEl || draggingCardEl !== el) return;
        el.releasePointerCapture(e.pointerId);
        
        // Clean up the ghost card
        if (dragGhostEl && dragGhostEl.parentNode) {
            dragGhostEl.parentNode.removeChild(dragGhostEl);
        }
        draggingCardEl = null;
        dragGhostEl = null;
        
        // Snap everything back to the pre-drag state
        render(); 
    });
}

function createCardElement(card, sourceInfo) {
    const el = document.createElement('div');
    el.classList.add('card');
    if (card.color === 'red') el.classList.add('red');
    if (card.color === 'black') el.classList.add('black');
    if (card.suit === '♣') el.classList.add('suit-clubs'); // Add this line
    if (card.isNewFromBot) el.classList.add('bot-highlight');
    
    // Highlight the newly drawn card in the player's hand
    if (sourceInfo === 'hand' && card.id === game.lastDrawnCardId) {
        el.classList.add('player-highlight');
    }
    
    el.dataset.id = card.id;
    
    if (card.isJoker) {
        el.innerHTML = `<div class="corner top-left"><div class="val">J</div><div class="suit">★</div></div><div class="center-joker">JOKER</div><div class="corner bottom-right"><div class="val">J</div><div class="suit">★</div></div>`;
    } else {
        el.innerHTML = `<div class="corner top-left"><div class="val">${card.rank}</div><div class="suit">${card.suit}</div></div><div class="center-suit">${card.suit}</div><div class="corner bottom-right"><div class="val">${card.rank}</div><div class="suit">${card.suit}</div></div>`;
    }
    
    attachPointerDrag(el, card, sourceInfo);
    
    return el;
}

function renderBotAreas() {
    const cluster = document.getElementById('bot-cluster');
    if (!cluster) return;
    cluster.innerHTML = '';
    
    for (let i = 1; i <= 3; i++) {
        const botName = game.playerNames[i];
        const initial = botName.charAt(0);
        const cardCount = game.players[i].length;
        
        const avatarEl = document.createElement('div');
        avatarEl.className = 'bot-avatar-container';
        avatarEl.innerHTML = `
            <div class="bot-avatar">
                ${initial}
                <div class="bot-badge">${cardCount}</div>
            </div>
            <div class="bot-name">${botName}</div>
        `;
        cluster.appendChild(avatarEl);
    }
}

function adjustTableScale() {
    const scaler = document.getElementById('table-scaler');
    const area = document.getElementById('table-area');
    const container = document.getElementById('melds-container');
    if (!scaler || !area || !container) return;
    
    scaler.style.transform = 'none';
    const cRect = container.getBoundingClientRect();
    const aRect = area.getBoundingClientRect();
    
    if (cRect.width > aRect.width || cRect.height > aRect.height) {
        const scaleX = aRect.width / (cRect.width + 40);
        const scaleY = aRect.height / (cRect.height + 40);
        const scale = Math.min(scaleX, scaleY, 1); // Never scale up
        scaler.style.transform = `scale(${scale})`;
    }
}

function sortMeldForDisplay(meldCards) {
    if (meldCards.length === 0) return meldCards;
    let cards = [...meldCards];
    let nonJokers = cards.filter(c => !c.isJoker);
    if (nonJokers.length > 0) {
        let firstSuit = nonJokers[0].suit;
        let isRun = nonJokers.every(c => c.suit === firstSuit) && !nonJokers.every(c => c.rank === nonJokers[0].rank);
        if (isRun) {
            let ranksInRun = nonJokers.map(c => RANKS.indexOf(c.rank));
            let isHighAce = ranksInRun.includes(0) && ranksInRun.some(r => r > 9);
            cards.sort((a, b) => {
                if (a.isJoker && !b.isJoker) return 1;
                if (!a.isJoker && b.isJoker) return -1;
                if (a.isJoker && b.isJoker) return 0;
                let valA = RANKS.indexOf(a.rank);
                let valB = RANKS.indexOf(b.rank);
                if (isHighAce) { if (valA === 0) valA = 13; if (valB === 0) valB = 13; }
                return valA - valB;
            });
            let sortedWithJokers = [];
            let jokers = cards.filter(c => c.isJoker);
            let regularCards = cards.filter(c => !c.isJoker);
            if (regularCards.length > 0) {
                sortedWithJokers.push(regularCards[0]);
                for (let i = 1; i < regularCards.length; i++) {
                    let prevVal = RANKS.indexOf(regularCards[i-1].rank);
                    let currVal = RANKS.indexOf(regularCards[i].rank);
                    if (isHighAce) { if (prevVal === 0) prevVal = 13; if (currVal === 0) currVal = 13; }
                    let diff = currVal - prevVal;
                    while (diff > 1 && jokers.length > 0) { sortedWithJokers.push(jokers.pop()); diff--; }
                    sortedWithJokers.push(regularCards[i]);
                }
                sortedWithJokers.push(...jokers);
                return sortedWithJokers;
            }
        } else {
            cards.sort((a, b) => {
                if (a.isJoker) return 1; if (b.isJoker) return -1;
                return a.suit.localeCompare(b.suit);
            });
        }
    }
    return cards;
}

function render() {
    // FLIP Prep: measure old positions
    const prevRects = new Map();
    document.querySelectorAll('.card:not(.ghost)').forEach(el => {
        if (el.dataset.id) prevRects.set(el.dataset.id, el.getBoundingClientRect());
    });

    // Render Hand
    playerHandEl.innerHTML = '';
    const handCount = game.players[0].length;
    const maxRot = 25; 
    
    game.players[0].forEach((card, index) => {
        const el = createCardElement(card, 'hand');
        let rotation = 0, yOffset = 0;
        
        if (handCount > 1) {
            let pct = index / (handCount - 1);
            rotation = (pct * (maxRot * 2)) - maxRot;
            let x = (pct * 2) - 1;
            yOffset = (x * x) * 15; 
        }
        
        el.classList.add('in-hand');
        el.style.setProperty('--rot', `${rotation}deg`);
        el.style.setProperty('--y-offset', `${yOffset}px`);
        playerHandEl.appendChild(el);
    });
    
    // Render Table
    meldsContainerEl.innerHTML = '';
    game.table.forEach((meld, index) => {
        const meldEl = document.createElement('div');
        meldEl.classList.add('meld');
        meldEl.dataset.index = index;
        
        sortMeldForDisplay(meld).forEach(card => meldEl.appendChild(createCardElement(card, `meld-${index}`)));
        meldsContainerEl.appendChild(meldEl);
    });
    
    // Inside render()...
    const newMeldEl = document.createElement('div');
    newMeldEl.classList.add('meld');
    newMeldEl.dataset.index = 'new';
    newMeldEl.style.border = "2px dashed rgba(255,255,255,0.4)";
    newMeldEl.style.display = "flex";
    newMeldEl.style.alignItems = "center";
    newMeldEl.style.justifyContent = "center";
    newMeldEl.style.color = "rgba(255,255,255,0.5)";
    newMeldEl.style.fontSize = "12px";
    newMeldEl.textContent = "New Meld";
    meldsContainerEl.appendChild(newMeldEl);
    
    renderBotAreas();
    adjustTableScale();
    
    // Setup Controls
    if (game.currentTurn === 0) {
        drawDeckEl.classList.remove('disabled');
        passCoinEl.classList.remove('disabled');
    } else {
        drawDeckEl.classList.add('disabled');
        passCoinEl.classList.add('disabled');
    }

    // FLIP Execute: animate smoothly from old positions
    requestAnimationFrame(() => {
        document.querySelectorAll('.card:not(.ghost)').forEach(el => {
            if (el.dataset.id && prevRects.has(el.dataset.id)) {
                const prev = prevRects.get(el.dataset.id);
                const curr = el.getBoundingClientRect();
                const dx = prev.left - curr.left;
                const dy = prev.top - curr.top;
                
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                    const baseTransform = el.classList.contains('in-hand') 
                        ? `translateY(var(--y-offset, 0px)) rotate(var(--rot, 0deg))` 
                        : 'none';
                    
                    el.style.transition = 'none';
                    el.style.transform = `translate(${dx}px, ${dy}px) ${baseTransform !== 'none' ? baseTransform : ''}`;
                    
                    requestAnimationFrame(() => {
                        el.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                        el.style.transform = baseTransform;
                        setTimeout(() => el.style.transition = '', 400); // cleanup inline transition
                    });
                }
            }
        });
    });
    saveGameToStorage(); //
}

function findCardById(id, source) {
    if (source === 'hand') {
        const idx = game.players[0].findIndex(c => c.id === id);
        if (idx !== -1) return { card: game.players[0][idx], list: game.players[0], idx };
    } else if (source.startsWith('meld-')) {
        const mIdx = parseInt(source.split('-')[1]);
        const idx = game.table[mIdx].findIndex(c => c.id === id);
        if (idx !== -1) return { card: game.table[mIdx][idx], list: game.table[mIdx], idx, mIdx };
    }
    return null;
}

function moveCard(cardId, source, targetMeldIndex) {
    game.table.forEach(m => m.forEach(c => c.isNewFromBot = false));
    const cardInfo = findCardById(cardId, source);
    if (!cardInfo) { render(); return; } 
    
    cardInfo.list.splice(cardInfo.idx, 1);
    
    if (targetMeldIndex >= game.table.length) {
        game.table.push([cardInfo.card]);
    } else {
        game.table[targetMeldIndex].push(cardInfo.card);
    }
    
    game.table = game.table.filter(m => m.length > 0);
    if (source === 'hand') game.lastDrawnCardId = null;
    
    render();
}

// Event Listeners
if (typeof document !== 'undefined') {

    drawDeckEl.addEventListener('click', () => {
        if (game.currentTurn !== 0 || drawDeckEl.classList.contains('disabled')) return;
        
        let handChanged = game.players[0].length < preTurnState.hand.length;
        if (handChanged) {
            updateStatus("You already played cards! Reset turn or Pass.");
            return;
        }
        game.drawCard(0);
        game.hasDrawnThisTurn = true;
        updateStatus("You drew a card.");
        
        if (JSON.stringify(game.table) === JSON.stringify(preTurnState.table)) {
            savePreTurnState(); 
        } else {
            preTurnState.hand = JSON.parse(JSON.stringify(game.players[0]));
        }
        render();
    });

    passCoinEl.addEventListener('click', () => {
        if (game.currentTurn !== 0 || passCoinEl.classList.contains('disabled')) return;
        
        game.table.forEach(m => m.forEach(c => c.isNewFromBot = false));
        
        let tableIsValid = true;
        game.table.forEach((meld, index) => {
            const meldEl = document.querySelector(`.meld[data-index="${index}"]`);
            if (!isValidMeld(meld)) {
                if (meldEl) meldEl.classList.add('invalid-meld');
                tableIsValid = false;
            } else {
                if (meldEl) meldEl.classList.remove('invalid-meld');
            }
        });

        if (!tableIsValid) {
            updateStatus("Invalid table configuration! Fix it or reset turn.");
            return;
        }
        
        let handChanged = game.players[0].length < preTurnState.hand.length;
        if (!handChanged && !game.hasDrawnThisTurn) {
            updateStatus("You must either play cards or draw a card!");
            return;
        }
        
        let winner = checkWinCondition();
        if (winner !== -1) { processRoundEnd(winner); return; }
        
        updateStatus("Turn ended.");
        game.currentTurn = 1; 
        render(); // update UI to disable buttons immediately
        setTimeout(botTurn, 800);
    });

    document.getElementById('reset-turn-btn').addEventListener('click', () => {
        if (game.currentTurn !== 0) return;
        restorePreTurnState();
        game.hasDrawnThisTurn = false;
        render();
    });

    document.getElementById('theme-select').addEventListener('change', (e) => {
        document.body.className = e.target.value;
    });

    document.getElementById('view-rules-btn').addEventListener('click', () => {
        document.getElementById('rules-modal').style.display = 'flex';
    });

    document.getElementById('close-rules-btn').addEventListener('click', () => {
        document.getElementById('rules-modal').style.display = 'none';
    });

    document.getElementById('view-scores-btn').addEventListener('click', () => {
        renderScoreboard(false);
        document.getElementById('scoreboard-modal').style.display = 'flex';
    });

    document.getElementById('restart-game-btn').addEventListener('click', () => {
        if (confirm("Are you sure you want to restart? Your current game will be lost.")) {
            localStorage.removeItem('johnnyRummySave');
            game = new GameState();
            preTurnState = null;
            isRoundEndState = false;
            document.getElementById('round-number').textContent = 1;
            savePreTurnState();
            render();
            updateStatus("Game restarted. Your turn!");
        }
    });

    document.getElementById('high-scores-btn').addEventListener('click', () => {
        renderHighScores();
        document.getElementById('highscores-modal').style.display = 'flex';
    });

    document.getElementById('close-highscores-btn').addEventListener('click', () => {
        document.getElementById('highscores-modal').style.display = 'none';
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('scoreboard-modal').style.display = 'none';
        
        if (isRoundEndState) {
            isRoundEndState = false;
            
            if (game.round > 8) {
                game = new GameState();
                preTurnState = null;
                document.getElementById('round-number').textContent = 1;
            } else {
                game.startingPlayer = (game.startingPlayer + 1) % 4; 
                game.initializeDeck();
                game.table = [];
                game.deal();
                game.currentTurn = game.startingPlayer; 
                game.hasDrawnThisTurn = false;
            }
            
            savePreTurnState();
            render();
            
            if (game.currentTurn === 0) {
                updateStatus(`Round ${game.round} starts! Your turn.`);
            } else {
                updateStatus(`Round ${game.round} starts! ${game.playerNames[game.currentTurn]} plays first.`);
                setTimeout(botTurn, 800);
            }
        }
    });
}

function checkWinCondition() {
    for (let i = 0; i < 4; i++) if (game.players[i].length === 0) return i;
    return -1;
}

function processRoundEnd(winnerIndex) {
    let roundPenalty = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        for (let card of game.players[i]) {
            roundPenalty[i] += card.value;
            game.scores[i] += card.value;
        }
    }
    game.roundScores.push(roundPenalty);
    game.round++;
    isRoundEndState = true;
    
    if (game.round > 8) {
        updateStatus(`Game Over! ${game.playerNames[winnerIndex]} went out!`);
        saveHighScore(game.scores[0]); 
        localStorage.removeItem('johnnyRummySave'); // Clear active save
    } else {
        updateStatus(`${game.playerNames[winnerIndex]} went out!`);
    }
    
    renderScoreboard(true);
    document.getElementById('scoreboard-modal').style.display = 'flex';
}

function renderScoreboard(isEnd) {
    const container = document.getElementById('score-table-container');
    let html = '<table class="score-table"><tr><th>Round</th>';
    game.playerNames.forEach(name => html += `<th>${name}</th>`);
    html += '</tr>';

    game.roundScores.forEach((rs, idx) => {
        html += `<tr><td>${idx + 1}</td>`;
        rs.forEach(score => html += `<td>${score}</td>`);
        html += '</tr>';
    });

    html += '<tr><td><strong>Total</strong></td>';
    game.scores.forEach(score => html += `<td><strong>${score}</strong></td>`);
    html += '</tr></table>';

    container.innerHTML = html;
    document.getElementById('close-modal-btn').textContent = (game.round > 8) ? "Start New Game" : (isEnd ? "Continue to Next Round" : "Close");
}

function isBookMeld(meld) {
    if (meld.length < 3) return false;
    let nonJokers = meld.filter(c => !c.isJoker);
    if (nonJokers.length === 0) return true; 
    let rank = nonJokers[0].rank;
    return nonJokers.every(c => c.rank === rank);
}

function tryToPlayFromHand(botIndex) {
    let hand = game.players[botIndex];

    // Move 1: Form new 3-card base melds from hand (Brute force combinations of 3)
    for (let i = 0; i < hand.length - 2; i++) {
        for (let j = i + 1; j < hand.length - 1; j++) {
            for (let k = j + 1; k < hand.length; k++) {
                let testMeld = [hand[i], hand[j], hand[k]];
                if (isValidMeld(testMeld)) {
                    
                    // Prevent purely natural duplicate books to consolidate the board
                    if (isBookMeld(testMeld) && !testMeld.some(c => c.isJoker)) {
                        let rank = testMeld[0].rank;
                        let duplicateExists = game.table.some(m => isBookMeld(m) && m.some(c => !c.isJoker && c.rank === rank));
                        if (duplicateExists) continue; // Skip creating a new book, let Move 2 handle it
                    }

                    game.table.push(testMeld);
                    for (let c of testMeld) c.isNewFromBot = true;
                    // Splice backwards so indices don't shift during removal
                    hand.splice(k, 1);
                    hand.splice(j, 1);
                    hand.splice(i, 1);
                    return true;
                }
            }
        }
    }

    // Move 2: Add non-jokers to existing melds
    for (let i = hand.length - 1; i >= 0; i--) {
        let card = hand[i];
        if (card.isJoker) continue;
        for (let meld of game.table) {
            meld.push(card);
            if (isValidMeld(meld)) {
                card.isNewFromBot = true;
                hand.splice(i, 1);
                return true;
            }
            meld.pop(); 
        }
    }

    // Move 3: Add jokers to existing melds (excluding books, per rules)
    for (let i = hand.length - 1; i >= 0; i--) {
        let card = hand[i];
        if (!card.isJoker) continue; 
        for (let meld of game.table) {
            if (isBookMeld(meld)) continue;
            meld.push(card);
            if (isValidMeld(meld)) {
                card.isNewFromBot = true;
                hand.splice(i, 1);
                return true;
            }
            meld.pop(); 
        }
    }

    // Move 4: Joker Retrieval (Swap natural card from hand for Joker on table)
    for (let i = hand.length - 1; i >= 0; i--) {
        let card = hand[i];
        if (card.isJoker) continue; 
        for (let mIdx = 0; mIdx < game.table.length; mIdx++) {
            let meld = game.table[mIdx];
            let jokerIdx = meld.findIndex(c => c.isJoker);
            if (jokerIdx !== -1) {
                let jokerCard = meld[jokerIdx];
                meld[jokerIdx] = card; 
                if (isValidMeld(meld)) {
                    card.isNewFromBot = true; 
                    hand.splice(i, 1); 
                    hand.push(jokerCard); 
                    return true;
                }
                meld[jokerIdx] = jokerCard; 
            }
        }
    }

    // Move 5: Board-to-Board Joker Retrieval
    for (let mIdxA = 0; mIdxA < game.table.length; mIdxA++) {
        let meldA = game.table[mIdxA];
        let jokerIdxA = meldA.findIndex(c => c.isJoker);
        if (jokerIdxA !== -1) {
            // We found a Joker in Meld A. Look for a donor card in Meld B.
            for (let mIdxB = 0; mIdxB < game.table.length; mIdxB++) {
                if (mIdxA === mIdxB) continue; 
                let meldB = game.table[mIdxB];
                if (meldB.length <= 3) continue; // Donor meld must survive with at least 3 cards

                for (let cIdxB = 0; cIdxB < meldB.length; cIdxB++) {
                    let candidateCard = meldB[cIdxB];
                    if (candidateCard.isJoker) continue; 

                    // Temporarily remove candidate from Meld B
                    meldB.splice(cIdxB, 1);
                    
                    if (isValidMeld(meldB)) {
                        // Donor meld survives! Now swap candidate into Meld A's Joker spot
                        let jokerCard = meldA[jokerIdxA];
                        meldA[jokerIdxA] = candidateCard;
                        
                        if (isValidMeld(meldA)) {
                            // The heist is successful! 
                            candidateCard.isNewFromBot = true;
                            hand.push(jokerCard); // Bot acquires the Joker
                            return true; // Restart cascade
                        }
                        // Revert Meld A if invalid
                        meldA[jokerIdxA] = jokerCard;
                    }
                    // Revert Meld B if invalid or heist failed
                    meldB.splice(cIdxB, 0, candidateCard);
                }
            }
        }
    }

    // Move 6: Borrow a card (Steal from a table meld > 3 cards to form new meld with hand)
    for (let mIdx = 0; mIdx < game.table.length; mIdx++) {
        let meld = game.table[mIdx];
        if (meld.length <= 3) continue;

        for (let cIdx = 0; cIdx < meld.length; cIdx++) {
            let candidateCard = meld[cIdx];
            meld.splice(cIdx, 1); 
            
            if (isValidMeld(meld)) {
                let foundNewMeld = false;
                for (let i = 0; i < hand.length - 1; i++) {
                    for (let j = i + 1; j < hand.length; j++) {
                        let testMeld = [candidateCard, hand[i], hand[j]];
                        if (isValidMeld(testMeld)) {
                            game.table.push(testMeld);
                            hand[i].isNewFromBot = true;
                            hand[j].isNewFromBot = true;
                            
                            hand.splice(j, 1);
                            hand.splice(i, 1);
                            foundNewMeld = true;
                            break;
                        }
                    }
                    if (foundNewMeld) break;
                }
                if (foundNewMeld) return true; 
            }
            meld.splice(cIdx, 0, candidateCard); 
        }
    }
    
    return false; // Can't make any legal plays
}

function botTurn() {
    updateStatus(`${game.playerNames[game.currentTurn]} is thinking...`);
    
    setTimeout(() => {
        let hasPlayedThisTurn = false;
        let attempts = 0;
        
        // 1. Play as many cards as possible from the current hand (The Cascade)
        let madeAMove = true;
        while (madeAMove) {
            madeAMove = tryToPlayFromHand(game.currentTurn);
            if (madeAMove) hasPlayedThisTurn = true;
        }
        
        // 2. If the bot couldn't play anything, draw until it can (max 5 draws)
        while (!hasPlayedThisTurn && attempts < 5 && game.deck.length > 0) {
            game.drawCard(game.currentTurn);
            attempts++;
            
            // After drawing, try to play again (and cascade if successful)
            madeAMove = true;
            while (madeAMove) {
                madeAMove = tryToPlayFromHand(game.currentTurn);
                if (madeAMove) hasPlayedThisTurn = true;
            }
        }
        
        render(); 
        
        let winner = checkWinCondition();
        if (winner !== -1) { processRoundEnd(winner); return; }
        
        game.currentTurn = (game.currentTurn + 1) % 4;
        if (game.currentTurn === 0) {
            updateStatus("Your turn!");
            game.hasDrawnThisTurn = false;
            game.lastDrawnCardId = null; 
            savePreTurnState();
            render();
        } else {
            setTimeout(botTurn, 800);
        }
    }, 800);
}

if (typeof document !== 'undefined') {
    document.body.className = 'theme-default';
    
    if (!loadGameFromStorage()) {
        savePreTurnState();
    } else if (game.currentTurn !== 0 && !isRoundEndState) {
        // Resume bot turn if page was reloaded during their turn
        setTimeout(botTurn, 800); 
    }
    
    render();
}