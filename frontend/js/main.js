const Game = {
  state: 'login',
  currentRun: null,
  currentRound: 0,
  buffs: [],
  tempCard: null,
  tempBoss: null,
  tempPhoto: null,
  selectedReward: null,
  lastMode: 'pve', // 'pve' | 'pvp'

  async init() {
    // 检查登录状态
    const user = API.getUser();
    const token = API.getToken();
    if (user && token) {
      // 验证 token 是否有效
      try {
        const me = await API.getMe();
        if (me) {
          this.showStartScreen();
          await Cards.loadCollection();
          try {
            const progress = await API.getGameState();
            if (progress && progress.currentRun) {
              this.currentRun = progress.currentRun;
              this.currentRound = progress.currentRun.currentRound || 0;
              this.buffs = progress.currentRun.buffs || [];
            }
          } catch (err) {
            console.warn('Failed to load game state:', err);
          }
          this.bindEvents();
          return;
        }
      } catch {
        // token 无效，继续显示登录
      }
    }
    // 未登录
    this.bindEvents();
    showScreen('screen-login');
  },

  bindEvents() {
    document.getElementById('btn-login').addEventListener('click', () => this.handleLogin());
    document.getElementById('login-nickname').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });

    document.getElementById('btn-start-game').addEventListener('click', () => this.startNewGame());
    document.getElementById('btn-pvp-mode').addEventListener('click', () => showScreen('screen-pvp-lobby'));
    document.getElementById('btn-collection').addEventListener('click', () => this.openCollection());
    document.getElementById('btn-logout').addEventListener('click', () => {
      API.logout();
      location.reload();
    });
    document.getElementById('btn-reveal-continue').addEventListener('click', () => this.confirmCard());
    document.getElementById('btn-reveal-collection').addEventListener('click', () => this.openCollection());
    document.getElementById('btn-setup-back').addEventListener('click', () => showScreen('screen-start'));
    document.getElementById('btn-start-battle').addEventListener('click', () => this.goToStageMap());
    document.getElementById('btn-map-back').addEventListener('click', () => showScreen('screen-team-setup'));
    document.getElementById('btn-map-start').addEventListener('click', () => {
      const stage = this.currentRound + 1;
      if (stage <= 5) this.selectStage(stage);
    });
    document.querySelectorAll('.stage-node').forEach(node => {
      node.addEventListener('click', () => {
        if (node.classList.contains('active')) {
          const stage = parseInt(node.dataset.stage, 10);
          this.selectStage(stage);
        }
      });
    });
    document.getElementById('btn-collection-back').addEventListener('click', () => showScreen('screen-start'));
    document.getElementById('btn-empty-camera').addEventListener('click', () => { showScreen('screen-start'); this.startNewGame(); });
    document.getElementById('btn-result-continue').addEventListener('click', () => this.nextAfterResult());
    document.getElementById('btn-result-home').addEventListener('click', () => showScreen('screen-start'));
  },

  async handleLogin() {
    const input = document.getElementById('login-nickname');
    const nickname = input.value.trim();
    if (!nickname) {
      showToast('请输入昵称', 'warning');
      return;
    }
    showLoading('登录中...');
    try {
      await API.login(nickname);
      hideLoading();
      input.value = '';
      await Cards.loadCollection();
      try {
        const progress = await API.getGameState();
        if (progress && progress.currentRun) {
          this.currentRun = progress.currentRun;
          this.currentRound = progress.currentRun.currentRound || 0;
          this.buffs = progress.currentRun.buffs || [];
        }
      } catch (err) {
        console.warn('Failed to load game state:', err);
      }
      this.showStartScreen();
    } catch (err) {
      hideLoading();
      showToast(err.message || '登录失败', 'error');
    }
  },

  showStartScreen() {
    const user = API.getUser();
    // 在开始界面显示用户信息
    let infoEl = document.getElementById('user-info-bar');
    if (!infoEl) {
      const startContent = document.querySelector('.start-content');
      if (startContent) {
        infoEl = document.createElement('div');
        infoEl.id = 'user-info-bar';
        infoEl.className = 'user-info';
        startContent.insertBefore(infoEl, startContent.children[2]);
      }
    }
    if (infoEl && user) {
      infoEl.innerHTML = '<span>👤 当前玩家：</span><span class="user-name">' + user.nickname + '</span>';
    }
    showScreen('screen-start');
  },

  async startNewGame() {
    this.currentRun = null;
    this.currentRound = 0;
    this.buffs = [];
    this.tempCard = null;
    this.tempBoss = null;
    this.tempPhoto = null;
    Cards.clearTeam();
    try {
      await API.resetRun();
    } catch (err) {
      console.warn('Reset run failed:', err);
    }
    this.state = 'camera_initial';
    Camera.setOnConfirm((a, photo) => this.handleInitialPhoto(a, photo));
    Camera.retake();
    showScreen('screen-camera');
  },

  async handleInitialPhoto(analysis, photo) {
    showLoading('生成卡牌中...');
    try {
      const card = await API.generateCard(analysis);
      if (photo) {
        card.sourceImage = photo;
        card.image = photo;
      }
      this.tempCard = card;
      await Cards.saveToCollection(card);
      hideLoading();
      this.showCardReveal(card);
    } catch (err) {
      hideLoading();
      showModal('生成失败: ' + (err.message || '未知错误'));
    }
  },

  showCardReveal(card) {
    const container = document.getElementById('revealed-card');
    container.innerHTML = '';
    const el = createGameCard(card, { clickable: false });
    el.classList.add('card-flip-reveal');
    container.appendChild(el);
    showScreen('screen-card-reveal');
  },

  async confirmCard() {
    if (!this.tempCard) return;

    // 初始拍照流程：强制全新开始，防止旧 run 状态残留
    if (this.state === 'camera_initial') {
      this.currentRun = null;
      Cards.clearTeam();
    }

    if (!this.currentRun) {
      try {
        this.currentRun = await API.startRun(this.tempCard);
        this.currentRun.team = [this.tempCard];
      } catch (err) {
        console.warn('Start run via API failed, using local fallback:', err);
        this.currentRun = {
          id: Date.now().toString(),
          team: [this.tempCard],
          currentRound: 0,
          maxRounds: 5,
          buffs: [],
          battleHistory: [],
          adventureStory: [],
          status: 'active',
          startedAt: new Date().toISOString()
        };
      }
      this.currentRound = 0;
      this.buffs = [];
    }
    this.tempCard = null;
    this.goToTeamSetup();
  },

  goToTeamSetup() {
    this.state = 'team_select';
    Cards.currentTeam = this.currentRun ? [...this.currentRun.team] : [];
    Cards.updateTeamSlots();
    const pool = document.getElementById('setup-collection');
    if (pool) {
      pool.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">击败Boss后，新伙伴会自动加入队伍</p>';
    }
    showScreen('screen-team-setup');
  },

  async goToStageMap() {
    if (Cards.currentTeam.length === 0) {
      showToast('请至少选择一名角色', 'warning');
      return;
    }
    const isFirstEntry = this.currentRun && (!this.currentRun.adventureStory || this.currentRun.adventureStory.length === 0);
    if (this.currentRun) {
      this.currentRun.team = [...Cards.currentTeam];
      // 保存进度时剥离 base64 图片数据，避免传输几 MB 的 JSON
      const slimRun = this._stripImages(this.currentRun);
      showLoading('保存进度...');
      try {
        await API.saveGameState({ currentRun: slimRun, history: [] });
      } catch (err) {
        console.warn('Save game state failed:', err);
      } finally {
        hideLoading();
      }
    }
    // 首次进入地图：生成冒险故事开头并显示过场
    if (isFirstEntry && this.currentRun) {
      const firstMember = this.currentRun.team[0];
      try {
        showLoading('编织冒险故事...');
        const storyRes = await API.generateStory({
          team: this.currentRun.team,
          newMember: firstMember,
          round: 1,
          previousStory: [],
          isFirst: true
        });
        hideLoading();
        if (storyRes && storyRes.segment) {
          this.currentRun.adventureStory = [storyRes.segment];
          try { await API.saveGameState({ currentRun: this._stripImages(this.currentRun), history: [] }); }
          catch (e) { console.warn('Save story failed:', e); }
          return new Promise(function(resolve) {
            showStoryOverlay(storyRes.segment, function() {
              Game.updateStageMap();
              showScreen('screen-stage-map');
              resolve();
            });
          });
        }
      } catch (err) {
        hideLoading();
        console.warn('Story generation failed:', err);
      }
    }
    this.updateStageMap();
    showScreen('screen-stage-map');
  },

  // 剥离对象中的 base64 图片字段，用于数据库保存
  _stripImages(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this._stripImages(item));
    const result = {};
    for (const key in obj) {
      if (key === 'image' || key === 'sourceImage') continue;
      result[key] = this._stripImages(obj[key]);
    }
    return result;
  },

  updateStageMap() {
    const nodes = document.querySelectorAll('.stage-node');
    const currentStage = this.currentRound + 1;

    nodes.forEach(function(node, i) {
      const stageNum = i + 1;
      node.classList.remove('completed', 'active');
      if (stageNum < currentStage) {
        node.classList.add('completed');
      } else if (stageNum === currentStage && currentStage <= 5) {
        node.classList.add('active');
      }
    });

    // 控制 SVG 激活曲线路径
    const curveSegments = [
      '',
      'M 60 50 C 140 50 140 150 220 150',
      'M 60 50 C 140 50 140 150 220 150 C 300 150 300 50 380 50',
      'M 60 50 C 140 50 140 150 220 150 C 300 150 300 50 380 50 C 460 50 460 150 540 150',
      'M 60 50 C 140 50 140 150 220 150 C 300 150 300 50 380 50 C 460 50 460 150 540 150 C 620 150 620 50 700 50'
    ];
    const curveActive = document.getElementById('curve-active');
    if (curveActive) {
      curveActive.setAttribute('d', curveSegments[this.currentRound] || '');
    }

    const startBtn = document.getElementById('btn-map-start');
    if (currentStage <= 5) {
      startBtn.textContent = '挑战第 ' + currentStage + ' 层';
      startBtn.disabled = false;
    } else {
      startBtn.textContent = '恭喜通关！';
      startBtn.disabled = true;
    }

    const hint = document.querySelector('.stage-hint');
    if (hint) {
      if (currentStage <= 5) {
        hint.textContent = '点击高亮的关卡节点进行挑战';
      } else {
        hint.textContent = '你已完成所有5层挑战！';
      }
    }
  },

  selectStage(stageNum) {
    this.state = 'camera_boss';
    Camera.setOnConfirm((a, photo) => this.handleBossPhoto(a, photo));
    Camera.retake();
    showScreen('screen-camera');
  },

  async startBattlePhase() {
    // 保留此方法兼容旧调用，实际流程从地图触发
    const stage = this.currentRound + 1;
    if (stage <= 5) {
      this.selectStage(stage);
    }
  },

  async handleBossPhoto(analysis, photo) {
    showLoading('生成Boss中...');
    try {
      const boss = await API.generateBoss(analysis, this.currentRound);
      if (photo) {
        boss.sourceImage = photo;
        boss.image = photo;
      }
      this.tempBoss = boss;
      this.tempPhoto = photo;
      hideLoading();
      const team = this.currentRun ? [...this.currentRun.team] : [...Cards.currentTeam];
      await Battle.start(team, boss, this.buffs, this.currentRound + 1);
    } catch (err) {
      hideLoading();
      showModal('生成Boss失败: ' + (err.message || '未知错误'));
    }
  },

  async handleBattleWin(boss) {
    this.currentRound++;
    const weakened = {
      ...boss,
      id: boss.id + '_card',
      hp: Math.round((boss.hp || boss.maxHp) / (boss.bossMultiplier || 1)),
      maxHp: Math.round(boss.maxHp / (boss.bossMultiplier || 1)),
      atk: Math.round(boss.atk / (boss.bossMultiplier || 1)),
      skills: (boss.skills || []).slice(0, 2),
      isBoss: false,
      obtainedAt: new Date().toISOString()
    };
    // 重新生成普通卡牌名字（去掉 Boss 后缀，加上角色后缀）
    const roleSuffixes = {
      '物理输出': ['·战士', '·猎手', '·剑客', '·刺客', '·狂战'],
      '魔法输出': ['·法师', '·学者', '·术士', '·元素使', '·咒师'],
      '坦克': ['·守卫', '·盾卫', '·堡垒', '·守护者', '·铁壁'],
      '辅助': ['·祭司', '·吟游者', '·导师', '·先知', '·援护'],
      '治疗': ['·医者', '·圣手', '·灵愈师', '·守护天使', '·复苏者'],
      '平衡': ['·行者', '·旅者', '·探索者', '·漫游者']
    };
    const baseName = weakened.objectName || weakened.name.replace(/·.+$/, '');
    const suffixes = roleSuffixes[weakened.role] || roleSuffixes['平衡'];
    weakened.name = baseName + suffixes[Math.floor(Math.random() * suffixes.length)];

    if (this.tempPhoto && !weakened.image) {
      weakened.sourceImage = this.tempPhoto;
      weakened.image = this.tempPhoto;
    }
    await Cards.saveToCollection(weakened);
    // 同时更新 Cards.currentTeam，避免 goToStageMap() 覆盖时丢失新伙伴
    Cards.currentTeam.push(weakened);
    Cards.updateTeamSlots();

    // 生成冒险故事新段落
    let newSegment = null;
    if (this.currentRun) {
      this.currentRun.currentRound = this.currentRound;
      this.currentRun.team.push(weakened);
      const previousStory = this.currentRun.adventureStory || [];
      try {
        const storyRes = await API.generateStory({
          team: this.currentRun.team,
          newMember: weakened,
          round: this.currentRound,
          previousStory: previousStory,
          isFirst: false
        });
        if (storyRes && storyRes.segment) {
          newSegment = storyRes.segment;
          this.currentRun.adventureStory = [...previousStory, newSegment];
        }
      } catch (err) {
        console.warn('Story generation failed:', err);
      }
      try {
        await API.addBoss(this._stripImages(this.currentRun));
      } catch (err) {
        console.warn('Add boss to run failed:', err);
      }
    }
    this.tempBoss = null;
    this.tempPhoto = null;

    // 显示故事过场（如果有新段落）
    var self = this;
    if (newSegment) {
      return new Promise(function(resolve) {
        showStoryOverlay(newSegment, function() {
          if (self.currentRound >= 5) {
            self._handleEndingAndVictory(resolve);
          } else {
            self.showRewardScreen();
            resolve();
          }
        });
      });
    }

    if (this.currentRound >= 5) {
      this._handleEndingAndVictory(function() {});
    } else {
      this.showRewardScreen();
    }
  },

  // 通关：生成结局故事 → 显示过场 → 胜利画面
  async _handleEndingAndVictory(onDone) {
    if (this.currentRun && !this.currentRun.hasEndingStory) {
      try {
        showLoading('书写结局...');
        const storyRes = await API.generateStory({
          team: this.currentRun.team,
          round: 5,
          previousStory: this.currentRun.adventureStory || [],
          isEnding: true
        });
        hideLoading();
        if (storyRes && storyRes.segment) {
          this.currentRun.adventureStory = [...(this.currentRun.adventureStory || []), storyRes.segment];
          this.currentRun.hasEndingStory = true;
          var self = this;
          showStoryOverlay(storyRes.segment, function() {
            self._showVictoryResult();
            if (typeof onDone === 'function') onDone();
          });
          return;
        }
      } catch (err) {
        hideLoading();
        console.warn('Ending story failed:', err);
      }
    }
    this._showVictoryResult();
    if (typeof onDone === 'function') onDone();
  },

  handleBattleLoss(retreated) {
    const title = retreated ? '撤退了' : '战斗失败';
    document.getElementById('result-icon').textContent = '💀';
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-title').className = 'result-title defeat';
    document.getElementById('result-desc').textContent = '你的队伍全军覆没...';
    document.getElementById('result-stats').innerHTML =
      '<div class="stat-row"><span>到达层数</span><span>' + (this.currentRound + 1) + '</span></div>';
    this.saveRunToHistory('lost');
    showScreen('screen-result');
  },

  async showRewardScreen() {
    showLoading('生成奖励...');
    try {
      const choices = await API.getBuffChoices();
      hideLoading();
      const container = document.getElementById('reward-cards');
      container.innerHTML = '';
      this.selectedReward = null;
      choices.forEach(ch => {
        const el = document.createElement('div');
        el.className = 'reward-card';
        const rarityName = { common: '普通', rare: '稀有', legendary: '传说', curse: '诅咒' }[ch.rarity] || ch.rarity;
        el.innerHTML = '<h4>' + ch.name + ' <span style="font-size:12px;color:var(--text-muted);">[' + rarityName + ']</span></h4><p>' + ch.description + '</p>';
        el.addEventListener('click', () => {
          document.querySelectorAll('.reward-card').forEach(x => x.style.borderColor = '');
          el.style.borderColor = 'var(--accent-gold)';
          this.selectedReward = ch;
          setTimeout(() => this.applyReward(), 400);
        });
        container.appendChild(el);
      });
      showScreen('screen-reward');
    } catch (err) {
      hideLoading();
      showToast('奖励生成失败: ' + (err.message || '未知错误'), 'error');
    }
  },

  async applyReward() {
    if (!this.selectedReward) return;
    this.buffs.push(this.selectedReward);
    if (this.currentRun) this.currentRun.buffs = this.buffs;
    try {
      await API.applyBuff(this.selectedReward);
    } catch (err) {
      console.warn('Apply buff failed:', err);
    }
    this.selectedReward = null;
    this.goToStageMap();
  },

  showVictoryScreen() {
    this._handleEndingAndVictory(function() {});
  },

  _showVictoryResult() {
    document.getElementById('result-icon').textContent = '🏆';
    document.getElementById('result-title').textContent = '恭喜通关！';
    document.getElementById('result-title').className = 'result-title victory';
    document.getElementById('result-desc').textContent = '你击败了所有5个Boss！';
    const team = this.currentRun ? this.currentRun.team : Cards.currentTeam;
    document.getElementById('result-stats').innerHTML =
      '<div class="stat-row"><span>队伍人数</span><span>' + team.length + '</span></div>' +
      '<div class="stat-row"><span>获得增益</span><span>' + this.buffs.length + '</span></div>';
    this.saveRunToHistory('won');
    showScreen('screen-result');
  },

  nextAfterResult() {
    if (this.lastMode === 'pvp') {
      this.lastMode = 'pve';
      showScreen('screen-start');
      return;
    }
    // 战斗失败后 currentRun 为 null，返回开始页面
    if (!this.currentRun || this.currentRound >= 5) {
      showScreen('screen-start');
    } else {
      this.goToStageMap();
    }
  },

  async saveRunToHistory(status) {
    if (this.currentRun) {
      this.currentRun.status = status;
      this.currentRun.endedAt = new Date().toISOString();
      try {
        const progress = await API.getGameState();
        progress.history = progress.history || [];
        progress.history.push(this._stripImages(this.currentRun));
        progress.currentRun = null;
        await API.saveGameState(this._stripImages(progress));
      } catch (err) {
        console.warn('Save run history failed:', err);
      }
      this.currentRun = null;
    }
  },

  async openCollection() {
    await Cards.loadCollection();
    Cards.renderCollection('collection-grid');
    showScreen('screen-collection');
  },

  addToTeam(card) {
    if (Cards.currentTeam.length >= Cards.maxTeamSize) {
      showToast('队伍已满', 'warning');
      return;
    }
    if (!Cards.currentTeam.find(c => c.id === card.id)) {
      Cards.currentTeam.push(card);
      Cards.updateTeamSlots();
    }
  },

  removeFromTeam(index) {
    if (index >= 0 && index < Cards.currentTeam.length) {
      Cards.currentTeam.splice(index, 1);
      Cards.updateTeamSlots();
    }
  }
};

window.Game = Game;
document.addEventListener('DOMContentLoaded', () => Game.init());
