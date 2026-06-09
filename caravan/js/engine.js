function caravanLastEffectiveSuit(caravan) {
  if (caravan.rows.length === 0) return null;
  const row = caravan.rows[caravan.rows.length - 1];
  for (let i = row.attached.length - 1; i >= 0; i--) { if (row.attached[i].rank === 'Q') return row.attached[i].suit; }
  return row.number.suit;
}

function caravanTotal(caravan) {
  let total = 0;
  for (const row of caravan.rows) {
    let v = row.number.value;
    for (const f of row.attached) { if (f.rank === 'K') v *= 2; }
    total += v;
  }
  return total;
}

function computeDirection(caravan) {
  if (caravan.rows.length < 2) return null;
  let dir = null;
  for (let i = 1; i < caravan.rows.length; i++) {
    const prev = caravan.rows[i - 1].number.value;
    const cur = caravan.rows[i].number.value;
    dir = cur > prev ? 'up' : 'down';
    const queens = caravan.rows[i].attached.filter(a => a.rank === 'Q').length;
    for (let q = 0; q < queens; q++) dir = (dir === 'up') ? 'down' : 'up';
  }
  return dir;
}

function makeCaravan() { return { rows: [], direction: null, suit: null }; }

function makeInitialState({
  aiDifficulty = 'medium',
  bet = 0,
  mode = 'singleplayer',
  playerDeckDescriptors = null,
  settlements = 'california',
} = {}) {
  const deck0Raw = playerDeckDescriptors && playerDeckDescriptors.length > 0
    ? buildDeckFromDescriptors(playerDeckDescriptors, 0)
    : buildStandardDeck(0);
  const deck0 = shuffle(deck0Raw);
  const deck1 = aiDifficulty === 'hard'
    ? shuffle(deck0.map(c => makeCard(c.rank, c.suit, 1)))
    : shuffle(buildStandardDeck(1));
  const hand0 = deck0.splice(0, 8);
  const hand1 = deck1.splice(0, 8);
  const allNames = shuffle(SETTLEMENTS[settlements] || SETTLEMENTS.california);
  const opponentNames = allNames.slice(0, 3);
  const playerNames = allNames.slice(3, 6);
  let opponentName = 'P2';
  if (mode === 'singleplayer') opponentName = pickCpuName(aiDifficulty);
  else if (mode === 'online') opponentName = 'P2';
  const startingTurn = mode === 'online' ? (Math.random() < 0.5 ? 0 : 1) : 0;
  return {
    players: [
      {
        name: mode === 'singleplayer' ? 'YOU' : 'P1',
        caravans: [makeCaravan(), makeCaravan(), makeCaravan()],
        caravanNames: playerNames,
        hand: hand0, deck: deck0,
      },
      {
        name: opponentName,
        caravans: [makeCaravan(), makeCaravan(), makeCaravan()],
        caravanNames: opponentNames,
        hand: hand1, deck: deck1,
      },
    ],
    aiDifficulty,
    bet,
    lastEffect: null,
    log: [],
    mode,
    openingPlaced: [0, 0],
    phase: 'opening',
    turn: startingTurn,
    winner: null,
  };
}

const Engine = {
  caravanOwnership(state, caravanIdx) {
    const t0 = caravanTotal(state.players[0].caravans[caravanIdx]);
    const t1 = caravanTotal(state.players[1].caravans[caravanIdx]);
    const v0 = isValidTotal(t0);
    const v1 = isValidTotal(t1);
    if (v0 && !v1) return 0;
    if (!v0 && v1) return 1;
    if (v0 && v1) {
      if (t0 > t1) return 0;
      if (t1 > t0) return 1;
      return null;
    }
    return null;
  },

  checkEnd(state) {
    const owners = [0, 1, 2].map(i => this.caravanOwnership(state, i));
    const ownsByP0 = owners.filter(o => o === 0).length;
    const ownsByP1 = owners.filter(o => o === 1).length;
    if (ownsByP0 >= 2 && state.turn === 0) {
      state.phase = 'ended';
      state.winner = 0;
      return;
    }
    if (ownsByP1 >= 2 && state.turn === 1) {
      state.phase = 'ended';
      state.winner = 1;
      return;
    }
    const bothEmpty = state.players[0].deck.length === 0 && state.players[1].deck.length === 0;
    if (bothEmpty) {
      state.phase = 'ended';
      state.winner = ownsByP0 > ownsByP1 ? 0 : (ownsByP1 > ownsByP0 ? 1 : null);
    }
  },

  discardCard(state, playerIdx, cardId) {
    if (state.turn !== playerIdx) throw new Error("Not your turn");
    const player = state.players[playerIdx];
    if (state.phase === 'opening') {
      const hasNumber = player.hand.some(c => c.isNumber);
      if (hasNumber) throw new Error("Opening — play a number card on an empty caravan");
    }
    const idx = player.hand.findIndex(c => c.id === cardId);
    if (idx < 0) throw new Error("Card not found");
    const c = player.hand.splice(idx, 1)[0];
    if (player.deck.length > 0) player.hand.push(player.deck.pop());
    state.log.push(`${player.name} discarded a card`);
    state.lastEffect = { kind: 'discardCard', byPlayer: playerIdx, cardRank: c.rank };
    state.turn = 1 - state.turn;
    if (state.phase === 'opening' && state.openingPlaced[state.turn] >= 3) state.turn = 1 - state.turn;
    this.checkEnd(state);
    return state;
  },

  discardCaravan(state, playerIdx, caravanIdx) {
    if (state.phase === 'opening') throw new Error("Opening — cannot discard a caravan");
    if (state.turn !== playerIdx) throw new Error("Not your turn");
    const player = state.players[playerIdx];
    const caravan = player.caravans[caravanIdx];
    if (caravan.rows.length === 0) throw new Error("Caravan is already empty");
    const removedRows = caravan.rows.map((row, rowIdx) => ({ playerIdx, caravanIdx, rowIdx, row }));
    player.caravans[caravanIdx] = makeCaravan();
    state.log.push(`${player.name} discarded ${poss(player.name, player.name)} caravan ${caravanIdx + 1}`);
    state.lastEffect = { kind: 'discardCaravan', byPlayer: playerIdx, targetPlayer: playerIdx, caravanIdx, removedRows };
    state.turn = 1 - state.turn;
    this.checkEnd(state);
    return state;
  },

  isValidPlay(state, playerIdx, card, target) {
    if (state.turn !== playerIdx) return { ok: false, why: "Not your turn" };
    if (state.phase === 'ended') return { ok: false, why: "Game over" };
    const player = state.players[playerIdx];
    if (state.phase === 'opening') {
      if (card.isFace) return { ok: false, why: "Opening — cannot play face cards" };
      if (target.playerIdx !== playerIdx) return { ok: false, why: "Number cards go on your own caravans" };
      const caravan = player.caravans[target.caravanIdx];
      if (caravan.rows.length > 0) return { ok: false, why: "Already started that caravan" };
      return { ok: true };
    }
    if (card.isNumber) {
      if (target.playerIdx !== playerIdx) return { ok: false, why: "Number cards go on your own caravans" };
      const caravan = player.caravans[target.caravanIdx];
      if (caravan.rows.length === 0) return { ok: true };
      const last = caravan.rows[caravan.rows.length - 1].number;
      if (last.value === card.value) return { ok: false, why: "Cannot play same value as previous" };
      const prevDir = computeDirection(caravan);
      const goingUp = card.value > last.value;
      const sameSuit = caravanLastEffectiveSuit(caravan) === card.suit;
      if (prevDir === null) return { ok: true };
      if (goingUp && prevDir === 'up') return { ok: true };
      if (!goingUp && prevDir === 'down') return { ok: true };
      if (sameSuit) return { ok: true };
      return { ok: false, why: "Wrong direction and suit" };
    }
    if (card.isFace) {
      if (target.rowIdx === undefined || target.rowIdx === null) return { ok: false, why: "Pick a card to attach to" };
      const opp = state.players[target.playerIdx];
      const caravan = opp.caravans[target.caravanIdx];
      const row = caravan.rows[target.rowIdx];
      if (!row) return { ok: false, why: "No card there" };
      if (card.rank === 'Q') {
        if (target.rowIdx !== caravan.rows.length - 1) {
          return { ok: false, why: "Queens can only be placed on the top card of a caravan" };
        }
        if (caravan.rows.length < 2) {
          return { ok: false, why: "Queens need a caravan with at least two cards" };
        }
      }
      return { ok: true };
    }
    return { ok: false, why: "Unknown card type" };
  },

  faceTargets(state, playerIdx, card) {
    const targets = [];
    for (let p = 0; p < 2; p++) {
      for (let ci = 0; ci < 3; ci++) {
        const caravan = state.players[p].caravans[ci];
        for (let ri = 0; ri < caravan.rows.length; ri++) {
          const target = { playerIdx: p, caravanIdx: ci, rowIdx: ri };
          if (this.isValidPlay(state, playerIdx, card, target).ok) targets.push(target);
        }
      }
    }
    return targets;
  },

  playCard(state, playerIdx, cardId, target) {
    const player = state.players[playerIdx];
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx < 0) throw new Error("Card not in hand");
    const card = player.hand[cardIdx];
    const v = this.isValidPlay(state, playerIdx, card, target);
    if (!v.ok) throw new Error(v.why);
    player.hand.splice(cardIdx, 1);
    state.lastEffect = null;
    if (card.isNumber) {
      const caravan = state.players[target.playerIdx].caravans[target.caravanIdx];
      caravan.rows.push({ number: card, attached: [] });
      state.log.push(`${player.name} played ${cardLabel(card)} — ${poss(player.name, player.name)} caravan ${target.caravanIdx + 1}`);
    } else {
      const opp = state.players[target.playerIdx];
      const caravan = state.players[target.playerIdx].caravans[target.caravanIdx];
      const row = caravan.rows[target.rowIdx];
      const targetCard = row.number;
      const targetId = targetCard.id;
      const isAce = targetCard.rank === 'A';
      if (card.rank === 'J') {
        const removedRow = caravan.rows[target.rowIdx];
        caravan.rows.splice(target.rowIdx, 1);
        state.log.push(`${player.name} ${FACE_VERB.J} ${cardLabel(targetCard)} — ${poss(opp.name, player.name)} caravan ${target.caravanIdx + 1}`);
        state.lastEffect = {
          kind: 'jack',
          byPlayer: playerIdx,
          targetPlayer: target.playerIdx,
          caravanIdx: target.caravanIdx,
          removedRows: [{
            playerIdx: target.playerIdx,
            caravanIdx: target.caravanIdx,
            rowIdx: target.rowIdx,
            row: removedRow,
          }],
        };
      } else if (card.rank === 'Q') {
        row.attached.push(card);
        state.log.push(`${player.name} ${FACE_VERB.Q} ${cardLabel(targetCard)} — ${poss(opp.name, player.name)} caravan ${target.caravanIdx + 1}`);
        state.lastEffect = { kind: 'queen', byPlayer: playerIdx, targetPlayer: target.playerIdx, caravanIdx: target.caravanIdx, rowIdx: target.rowIdx };
      } else if (card.rank === 'K') {
        row.attached.push(card);
        state.log.push(`${player.name} ${FACE_VERB.K} ${cardLabel(targetCard)} — ${poss(opp.name, player.name)} caravan ${target.caravanIdx + 1}`);
        state.lastEffect = { kind: 'king', byPlayer: playerIdx, targetPlayer: target.playerIdx, caravanIdx: target.caravanIdx, rowIdx: target.rowIdx };
      } else if (card.rank === 'JK') {
        row.attached.push(card);
        const removed = [];
        const affected = new Set();
        for (let p = 0; p < 2; p++) {
          for (let ci = 0; ci < 3; ci++) {
            const carv2 = state.players[p].caravans[ci];
            const newRows = [];
            carv2.rows.forEach((r, ri) => {
              if (r.number.id === targetId) {
                newRows.push(r);
                return;
              }
              let kill = false;
              if (isAce) {
                if (r.number.suit === targetCard.suit && r.number.isNumber) kill = true;
              } else {
                if (r.number.value === targetCard.value) kill = true;
              }
              if (kill) {
                removed.push({ playerIdx: p, caravanIdx: ci, rowIdx: ri, row: r, label: cardLabel(r.number) });
                affected.add(`${p}-${ci}`);
              } else {
                newRows.push(r);
              }
            });
            carv2.rows = newRows;
          }
        }
        state.log.push(`${player.name} ${FACE_VERB.JK} ${cardLabel(targetCard)} — ${poss(opp.name, player.name)} caravan ${target.caravanIdx + 1}`);
        state.log.push(`└─ Removed ${removed.length} cards`);
        state.lastEffect = {
          kind: 'joker',
          byPlayer: playerIdx,
          targetPlayer: target.playerIdx,
          caravanIdx: target.caravanIdx,
          rowIdx: target.rowIdx,
          targetCardLabel: cardLabel(targetCard),
          removedCount: removed.length,
          removedRows: removed,
          affectedCaravans: Array.from(affected),
        };
      }
    }
    if (state.phase !== 'opening' && player.deck.length > 0) { player.hand.push(player.deck.pop()); }
    if (state.phase === 'opening' && target.playerIdx === playerIdx && card.isNumber) {
      state.openingPlaced[playerIdx] = state.players[playerIdx].caravans.filter(c => c.rows.length > 0).length;
      if (state.openingPlaced[0] >= 3 && state.openingPlaced[1] >= 3) { state.phase = 'play'; }
    }
    state.turn = 1 - state.turn;
    if (state.phase === 'opening' && state.openingPlaced[state.turn] >= 3) { state.turn = 1 - state.turn; }
    this.checkEnd(state);
    return state;
  },

  applyMove(state, playerIdx, move) {
    if (move.type === 'discardCard') return this.discardCard(state, playerIdx, move.cardId);
    if (move.type === 'discardCaravan') return this.discardCaravan(state, playerIdx, move.caravanIdx);
    if (move.type === 'play') return this.playCard(state, playerIdx, move.cardId, move.target);
    throw new Error("Unknown move type: " + move.type);
  },
};
