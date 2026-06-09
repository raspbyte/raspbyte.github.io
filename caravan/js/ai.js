function evaluatePosition(state, playerIdx, difficulty) {
  const opp = 1 - playerIdx;
  let score = 0;
  for (let ci = 0; ci < 3; ci++) {
    const myTotal = caravanTotal(state.players[playerIdx].caravans[ci]);
    const opTotal = caravanTotal(state.players[opp].caravans[ci]);
    const myValid = isValidTotal(myTotal);
    const opValid = isValidTotal(opTotal);
    if (myValid) score += 30 + (CARAVAN_MAX - myTotal) * -0.5;
    if (isBust(myTotal)) score -= 25;
    if (myTotal > 0 && myTotal < CARAVAN_MIN) score += Math.min(myTotal, 20) * 0.7;
    if (opValid) score -= 25;
    if (isBust(opTotal)) score += 15;
    if (opTotal > 0 && opTotal < CARAVAN_MIN) score -= Math.min(opTotal, 20) * 0.5;
    if (myValid && (isBust(opTotal) || opTotal < CARAVAN_MIN)) score += 15;
    if (myValid && opValid && myTotal > opTotal) score += 10;
    if (myValid && opValid && opTotal > myTotal) score -= 10;
  }
  const hand = state.players[playerIdx].hand;
  const jacks = hand.filter(c => c.rank === 'J').length;
  const jokers = hand.filter(c => c.rank === 'JK').length;
  score += jacks * 5;
  score += jokers * 12;
  if (difficulty === 'hard') {
    const faceInHand = hand.filter(c => c.isFace).length;
    score += faceInHand * 1.5;
  }
  return score;
}

const AI = {
  adjustForJokerWaste(state, sim, playerIdx, move) {
    if (move.type !== 'play') return 0;
    const card = state.players[playerIdx].hand.find(c => c.id === move.cardId);
    if (!card || card.rank !== 'JK') return 0;
    const countRows = (st) => st.players.reduce(
      (n, p) => n + p.caravans.reduce((m, c) => m + c.rows.length, 0), 0);
    const removed = countRows(state) - countRows(sim);
    return removed <= 0 ? -100 : removed * 8;
  },

  adjustForSelfSabotage(state, sim, playerIdx, move) {
    if (move.type !== 'play' || !move.target || move.target.playerIdx !== playerIdx) return 0;
    const ci = move.target.caravanIdx;
    const card = state.players[playerIdx].hand.find(c => c.id === move.cardId);
    const beforeTotal = caravanTotal(state.players[playerIdx].caravans[ci]);
    const afterTotal = caravanTotal(sim.players[playerIdx].caravans[ci]);
    if (isBust(beforeTotal)) return -40;
    if (!isBust(beforeTotal) && isBust(afterTotal) && card && card.isNumber) return -30;
    return 0;
  },

  adjustForFaceCardOnOpponent(state, sim, playerIdx, move) {
    if (move.type !== 'play' || !move.target) return 0;
    if (move.target.playerIdx === undefined || move.target.playerIdx === playerIdx) return 0;
    const card = state.players[playerIdx].hand.find(c => c.id === move.cardId);
    if (!card || !card.isFace) return 0;
    const opp = move.target.playerIdx;
    const ci = move.target.caravanIdx;
    const beforeTotal = caravanTotal(state.players[opp].caravans[ci]);
    const afterTotal = caravanTotal(sim.players[opp].caravans[ci]);
    let delta = 0;
    if (isValidTotal(beforeTotal) && !isValidTotal(afterTotal)) delta += 50;
    else if (!isBust(beforeTotal) && isBust(afterTotal)) delta += 35;
    else if (isBust(beforeTotal) && !isBust(afterTotal)) delta -= 60;
    else if (!isValidTotal(beforeTotal) && isValidTotal(afterTotal)) delta -= 40;
    else if (isValidTotal(beforeTotal) && isValidTotal(afterTotal) && afterTotal > beforeTotal) delta -= 15;
    else if (afterTotal > beforeTotal && !isBust(afterTotal)) delta -= 8;
    else if (afterTotal === beforeTotal && card.rank === 'Q') delta -= 18;
    if (card.rank === 'K' && !isBust(afterTotal) && afterTotal > beforeTotal) delta -= 10;
    return delta;
  },

  legalMoves(state, playerIdx) {
    const moves = [];
    const player = state.players[playerIdx];
    for (const card of player.hand) {
      if (state.phase === 'opening') {
        if (card.isFace) continue;
        for (let ci = 0; ci < 3; ci++) {
          if (player.caravans[ci].rows.length === 0) {
            moves.push({ type: 'play', cardId: card.id, target: { playerIdx, caravanIdx: ci } });
          }
        }
      } else {
        if (card.isNumber) {
          for (let ci = 0; ci < 3; ci++) {
            const target = { playerIdx, caravanIdx: ci };
            if (Engine.isValidPlay(state, playerIdx, card, target).ok) {
              moves.push({ type: 'play', cardId: card.id, target });
            }
          }
        } else {
          for (const target of Engine.faceTargets(state, playerIdx, card)) {
            if (card.rank === 'J' && target.playerIdx === playerIdx) {
              const caravan = state.players[playerIdx].caravans[target.caravanIdx];
              if (caravan.rows.length === 1) continue;
            }
            moves.push({ type: 'play', cardId: card.id, target });
          }
        }
      }
    }
    if (state.phase !== 'opening') {
      for (const card of player.hand) moves.push({ type: 'discardCard', cardId: card.id });
      for (let ci = 0; ci < 3; ci++) {
        if (player.caravans[ci].rows.length > 0) moves.push({ type: 'discardCaravan', caravanIdx: ci });
      }
    } else if (moves.length === 0) {
      for (const card of player.hand) moves.push({ type: 'discardCard', cardId: card.id });
    }
    return moves;
  },

  candidates(state, playerIdx, difficulty) {
    let moves = this.legalMoves(state, playerIdx);
    if (difficulty !== 'easy') return moves;
    const player = state.players[playerIdx];
    if (Math.random() < 0.9) {
      const filtered = moves.filter(m => {
        if (m.type !== 'play' || !m.target || m.target.playerIdx === undefined) return true;
        if (m.target.playerIdx === playerIdx) return true;
        const card = player.hand.find(c => c.id === m.cardId);
        return !card || !card.isFace;
      });
      if (filtered.length > 0) moves = filtered;
    }
    if (Math.random() < 0.95) {
      const filtered = moves.filter(m => m.type !== 'discardCard' && m.type !== 'discardCaravan');
      if (filtered.length > 0) moves = filtered;
    }
    return moves;
  },

  pick(scored, difficulty) {
    if (difficulty === 'medium') {
      const top = scored.slice(0, Math.min(3, scored.length));
      return top[Math.floor(Math.random() * top.length)].m;
    }
    return scored[0].m;
  },

  score(state, playerIdx, move, difficulty) {
    const sim = JSON.parse(JSON.stringify(state));
    try { Engine.applyMove(sim, playerIdx, move); }
    catch (e) { return -Infinity; }
    let score = evaluatePosition(sim, playerIdx, difficulty);
    score += this.adjustForJokerWaste(state, sim, playerIdx, move);
    score += this.adjustForSelfSabotage(state, sim, playerIdx, move);
    score += this.adjustForFaceCardOnOpponent(state, sim, playerIdx, move);
    return score;
  },

  chooseMove(state, playerIdx, difficulty) {
    const candidates = this.candidates(state, playerIdx, difficulty);
    if (candidates.length === 0) {
      const hand = state.players[playerIdx].hand;
      if (hand.length > 0) return { type: 'discardCard', cardId: hand[0].id };
      return null;
    }
    if (difficulty === 'easy') {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    const scored = candidates.map(m => ({ m, s: this.score(state, playerIdx, m, difficulty) }));
    scored.sort((a, b) => b.s - a.s);
    return this.pick(scored, difficulty);
  },
};
