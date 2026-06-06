const Battle = {
  state: null,
  isPlayerTurn: false,
  _gameEndHandled: false,
  _cardImages: {},
  _processing: false,

  async start(team, boss, buffs, stage) {
    showLoading('战斗准备中...');
    this._gameEndHandled = false;
    this._processing = false;
    // 缓存卡牌图片，避免战斗状态反复传输巨大的 base64
    this._cardImages = {};
    (team || []).forEach(card => { if (card.id) this._cardImages[card.id] = card.image || card.sourceImage || ''; });
    if (boss && boss.id) this._cardImages[boss.id] = boss.image || boss.sourceImage || '';
    try {
      this.state = await API.startBattle(team, boss, buffs);
      hideLoading();
      document.getElementById('battle-stage-title').textContent = '第 ' + (stage || 1) + ' 层';
      showScreen('screen-battle');
      this.render();
    } catch (err) {
      hideLoading();
      showModal('战斗初始化失败: ' + (err.message || '未知错误'));
    }
  },

  render() {
    if (!this.state) return;
    var s = this.state;
    this.isPlayerTurn = (s.phase === 'player' && !s.gameEnded);

    document.getElementById('battle-round').textContent = '回合 ' + s.turn;
    var turnEl = document.getElementById('turn-indicator');
    turnEl.textContent = s.phase === 'player' ? '玩家回合' : '敌方回合';
    turnEl.className = 'turn-indicator ' + (s.phase === 'player' ? 'player-turn' : 'boss-turn');

    // Boss card
    var bossCard = document.getElementById('boss-card');
    bossCard.innerHTML = '';
    var bCard = createGameCard(s.boss, { clickable: false, imageOverride: this._cardImages[s.boss.id] });
    bossCard.appendChild(bCard);

    var bossHpPct = s.boss.maxHp > 0 ? Math.max(0, (s.boss.currentHp / s.boss.maxHp) * 100) : 0;
    var bossHpFill = document.getElementById('boss-hp-fill');
    bossHpFill.style.width = bossHpPct + '%';
    bossHpFill.classList.toggle('low-hp', bossHpPct > 0 && bossHpPct <= 25);
    document.getElementById('boss-hp-text').textContent = s.boss.currentHp + ' / ' + s.boss.maxHp;

    var bossStatus = document.getElementById('boss-status');
    bossStatus.innerHTML = '';
    (s.boss.statusEffects || []).forEach(function(e) {
      var badge = document.createElement('span');
      badge.className = 'status-badge status-' + e.type;
      var names = { poison: '☠️毒', weak: '💔虚', fear: '😰惧', sleep: '💤睡' };
      badge.textContent = (names[e.type] || e.type) + (e.duration > 0 ? ' ' + e.duration : '');
      bossStatus.appendChild(badge);
    });
    if (s.boss.isSleeping) {
      var badge = document.createElement('span');
      badge.className = 'status-badge status-sleep';
      badge.textContent = '💤睡';
      bossStatus.appendChild(badge);
    }

    // Player team - flip cards
    var pt = document.getElementById('player-team');
    pt.innerHTML = '';
    var self = this;
    s.playerTeam.forEach(function(card) {
      var flipCard = document.createElement('div');
      flipCard.className = 'battle-flip-card';
      if (card.isDead) flipCard.classList.add('is-dead');
      if (card.isSleeping) flipCard.classList.add('is-sleeping');
      flipCard.dataset.cardId = card.id;

      var inner = document.createElement('div');
      inner.className = 'battle-flip-inner';

      // Front - card image
      var front = document.createElement('div');
      front.className = 'battle-flip-front';
      var img = document.createElement('img');
      img.className = 'card-image';
      img.src = self._cardImages[card.id] || card.image || card.sourceImage || '';
      img.alt = card.name || '';
      front.appendChild(img);
      var info = document.createElement('div');
      info.className = 'card-info';
      var name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = card.name || '';
      info.appendChild(name);
      var stats = document.createElement('div');
      stats.className = 'card-stats';
      stats.innerHTML = '<span>' + (card.hp || card.maxHp || 0) + 'HP</span><span>' + (card.atk || 0) + 'ATK</span>';
      info.appendChild(stats);
      front.appendChild(info);

      // Click front to flip
      front.addEventListener('click', function() {
        if (!card.isDead && !card.isSleeping && Battle.isPlayerTurn && !s.gameEnded) {
          pt.querySelectorAll('.battle-flip-card.flipped').forEach(function(c) {
            if (c !== flipCard) c.classList.remove('flipped');
          });
          flipCard.classList.add('flipped');
        }
      });

      // Back - skills
      var back = document.createElement('div');
      back.className = 'battle-flip-back';

      (card.skills || []).forEach(function(skill) {
        var usedTurn = s.skillsUsedThisTurn.indexOf(skill.id) >= 0;
        var usedGame = skill.limit === 'per_game' && skill.usedThisGame;
        var canAfford = s.mp >= skill.cost;
        var disabled = !canAfford || usedTurn || usedGame;

        var btn = document.createElement('button');
        btn.className = 'battle-skill-btn skill-type-' + (skill.type || 'physical');
        if (usedTurn || usedGame) btn.classList.add('used');
        btn.disabled = disabled;
        btn.innerHTML = '<span class="bs-name">' + skill.name + '</span><span class="bs-cost">' + skill.cost + '💎</span>';

        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (!disabled) {
            Battle.useSkill(skill.id, card.id, flipCard);
          }
        });
        back.appendChild(btn);
      });

      // Click back blank area to flip back
      back.addEventListener('click', function(e) {
        if (e.target === back) {
          flipCard.classList.remove('flipped');
        }
      });

      inner.appendChild(front);
      inner.appendChild(back);
      flipCard.appendChild(inner);
      pt.appendChild(flipCard);
    });

    // Player stats
    var hpPct = s.teamMaxHp > 0 ? Math.max(0, (s.teamHp / s.teamMaxHp) * 100) : 0;
    var playerHpFill = document.getElementById('player-hp-fill');
    playerHpFill.style.width = hpPct + '%';
    playerHpFill.classList.toggle('low-hp', hpPct > 0 && hpPct <= 25);
    document.getElementById('player-hp-text').textContent = s.teamHp + ' / ' + s.teamMaxHp;
    document.getElementById('player-mp-text').textContent = s.mp + ' / ' + s.maxMp;
    var orbs = document.querySelectorAll('.mp-orb');
    orbs.forEach(function(orb) {
      var orbVal = parseInt(orb.dataset.mp, 10);
      var wasActive = orb.classList.contains('active');
      var isActive = orbVal <= s.mp;
      if (isActive && !wasActive) {
        orb.classList.add('active', 'recently-gained');
        setTimeout(function() { orb.classList.remove('recently-gained'); }, 400);
      } else if (!isActive) {
        orb.classList.remove('active');
      }
    });
    document.getElementById('defense-count').textContent = s.defenseLayers;

    // Player status effects
    var pStatus = document.getElementById('player-status');
    pStatus.innerHTML = '';
    (s.statusEffects || []).forEach(function(e) {
      var badge = document.createElement('span');
      badge.className = 'status-badge status-' + e.type;
      var names = { poison: '☠️毒', weak: '💔虚', fear: '😰惧', sleep: '💤睡' };
      badge.textContent = (names[e.type] || e.type) + (e.duration > 0 ? ' ' + e.duration : '');
      pStatus.appendChild(badge);
    });

    // Battle log
    var log = document.getElementById('battle-log');
    log.innerHTML = s.battleLog.slice(-30).map(function(entry) {
      var cls = 'log-entry';
      if (entry.indexOf('伤害') >= 0 || entry.indexOf('击败') >= 0) cls += ' log-damage';
      else if (entry.indexOf('恢复') >= 0 || entry.indexOf('治疗') >= 0 || entry.indexOf('HP') >= 0) cls += ' log-heal';
      else if (entry.indexOf('防御') >= 0) cls += ' log-buff';
      else if (entry.indexOf('中毒') >= 0 || entry.indexOf('虚弱') >= 0 || entry.indexOf('恐惧') >= 0 || entry.indexOf('睡眠') >= 0) cls += ' log-debuff';
      else if (entry.indexOf('回合') >= 0 || entry.indexOf('战斗') >= 0) cls += ' log-system';
      return '<div class="' + cls + '">' + entry + '</div>';
    }).join('');
    log.scrollTop = log.scrollHeight;

    if (s.gameEnded && !this._gameEndHandled) {
      this._gameEndHandled = true;
      setTimeout(function() { this.handleGameEnd(); }.bind(this), 1200);
    }
  },

  async useSkill(skillId, cardId, flipCardEl) {
    if (!this.isPlayerTurn || this.state.gameEnded || this._processing) return;
    this._processing = true;
    try {
      var res = await API.battleAction(this.state, skillId, cardId);
      if (res.success) {
        this.state = res.state;
        if (res.result && res.result.damage > 0) {
          animateDamage(document.querySelector('.boss-area'), res.result.damage, false);
        }
        if (flipCardEl) flipCardEl.classList.remove('flipped');
        this.render();
      } else {
        showToast(res.error || '无法使用技能', 'warning');
      }
    } catch (err) {
      showToast('技能使用失败: ' + (err.message || '未知错误'), 'error');
    } finally {
      this._processing = false;
    }
  },

  async handleDefense() {
    if (!this.isPlayerTurn || this.state.gameEnded || this._processing) return;
    if (this.state.mp < 1) { showToast('法力水晶不足！', 'warning'); return; }
    if (this.state.defenseLayers >= 4) { showToast('防御层数已达上限！', 'warning'); return; }
    this._processing = true;
    try {
      this.state.mp -= 1;
      this.state.defenseLayers += 1;
      this.state.battleLog.push('获得1层防御减伤！当前 ' + this.state.defenseLayers + ' 层');
      this.render();
    } finally {
      this._processing = false;
    }
  },

  async endTurn() {
    if (!this.isPlayerTurn || this.state.gameEnded || this._processing) return;
    this._processing = true;
    document.querySelectorAll('.battle-flip-card.flipped').forEach(function(c) { c.classList.remove('flipped'); });
    this.render();
    try {
      var res = await API.endBattleTurn(this.state);
      this.state = res.state;
      this.render();
    } catch (err) {
      showToast('回合处理失败: ' + (err.message || '未知错误'), 'error');
      this.render();
    } finally {
      this._processing = false;
    }
  },

  async handleGameEnd() {
    try {
      if (this.state.winner === 'player') {
        await Game.handleBattleWin(this.state.boss);
      } else {
        Game.handleBattleLoss();
      }
    } catch (err) {
      console.error('handleGameEnd error:', err);
      showModal('战斗结算出错: ' + (err.message || '未知错误'));
    }
  },

  retreat: function() {
    document.getElementById('modal-retreat').classList.add('active');
  },

  confirmRetreat: function() {
    document.getElementById('modal-retreat').classList.remove('active');
    Game.handleBattleLoss(true);
  },

  cancelRetreat: function() {
    document.getElementById('modal-retreat').classList.remove('active');
  }
};

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-defend').addEventListener('click', function() { Battle.handleDefense(); });
  document.getElementById('btn-end-turn').addEventListener('click', function() { Battle.endTurn(); });
  document.getElementById('btn-battle-retreat').addEventListener('click', function() { Battle.retreat(); });
  document.getElementById('btn-retreat-confirm').addEventListener('click', function() { Battle.confirmRetreat(); });
  document.getElementById('btn-retreat-cancel').addEventListener('click', function() { Battle.cancelRetreat(); });
});
