const UI = (function() {
  const tc = document.getElementById('toast-container');
  const gl = document.getElementById('global-loading');
  const glt = document.getElementById('global-loading-text');

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function(s) {
      s.classList.remove('active');
      s.style.display = 'none';
    });
    const t = document.getElementById(id);
    if (t) {
      t.style.display = 'flex';
      requestAnimationFrame(function() {
        t.classList.add('active');
        t.classList.add('fade-in');
        setTimeout(function() { t.classList.remove('fade-in'); }, 400);
      });
    }
  }

  function showToast(m, ty, d) {
    if (ty === undefined) ty = 'info';
    if (d === undefined) d = 3000;
    const el = document.createElement('div');
    el.className = 'toast ' + ty;
    el.textContent = m;
    tc.appendChild(el);
    setTimeout(function() { el.remove(); }, d + 300);
  }

  function showLoading(t) {
    if (t === undefined) t = '加载中...';
    glt.textContent = t;
    gl.style.display = 'flex';
  }

  function hideLoading() {
    gl.style.display = 'none';
  }

  function showModal(id) {
    if (typeof id !== 'string') return;
    const m = document.getElementById(id);
    if (m) {
      m.classList.add('active');
    } else {
      // 降级为toast（传入的可能是消息字符串而非元素id）
      showToast(id, 'warning');
    }
  }

  function hideModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  }

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(function(b) {
    b.addEventListener('click', function() {
      const m = b.closest('.modal');
      if (m) m.classList.remove('active');
    });
  });

  // 点击模态框背景关闭（一次性委托，避免重复注册）
  document.addEventListener('click', function(e) {
    const m = e.target.closest('.modal');
    if (m && e.target === m && m.classList.contains('active') && m.querySelector('.modal-close')) {
      m.classList.remove('active');
    }
  });

  function animateElement(el, cls, dur) {
    if (dur === undefined) dur = 500;
    return new Promise(function(r) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) { r(); return; }
      el.classList.add(cls);
      setTimeout(function() {
        el.classList.remove(cls);
        r();
      }, dur);
    });
  }

  function showFloatingText(c, t, ty) {
    if (ty === undefined) ty = 'damage';
    if (typeof c === 'string') c = document.querySelector(c);
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'floating-text ' + ty;
    el.textContent = t;
    const ox = (Math.random() - 0.5) * 40;
    el.style.left = 'calc(50% + ' + ox + 'px)';
    el.style.top = '30%';
    c.style.position = 'relative';
    c.appendChild(el);
    setTimeout(function() { el.remove(); }, 1000);
  }

  function animateBar(be, c, m, dur) {
    if (dur === undefined) dur = 600;
    if (!be) return;
    const p = Math.max(0, Math.min(100, (c / m) * 100));
    be.style.transition = 'width ' + dur + 'ms ease';
    be.style.width = p + '%';
  }

  // Web Audio sound effects
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null;

  function initAudio() {
    if (!ac && AC) ac = new AC();
  }

  function playSound(ty) {
    if (!ac) {
      initAudio();
      if (!ac) return;
    }
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g);
    g.connect(ac.destination);
    const n = ac.currentTime;

    switch (ty) {
      case 'click':
        o.type = 'sine';
        o.frequency.setValueAtTime(800, n);
        o.frequency.exponentialRampToValueAtTime(400, n + 0.1);
        g.gain.setValueAtTime(0.1, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + 0.1);
        o.start(n);
        o.stop(n + 0.1);
        break;

      case 'attack':
        o.type = 'square';
        o.frequency.setValueAtTime(200, n);
        o.frequency.exponentialRampToValueAtTime(50, n + 0.2);
        g.gain.setValueAtTime(0.1, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + 0.2);
        o.start(n);
        o.stop(n + 0.2);
        break;

      case 'damage':
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300, n);
        o.frequency.exponentialRampToValueAtTime(100, n + 0.3);
        g.gain.setValueAtTime(0.1, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + 0.3);
        o.start(n);
        o.stop(n + 0.3);
        break;

      case 'heal':
        o.type = 'sine';
        o.frequency.setValueAtTime(400, n);
        o.frequency.exponentialRampToValueAtTime(800, n + 0.3);
        g.gain.setValueAtTime(0.1, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + 0.3);
        o.start(n);
        o.stop(n + 0.3);
        break;

      case 'win':
        [523, 659, 784, 1047].forEach(function(f, i) {
          const os = ac.createOscillator();
          const gs = ac.createGain();
          os.connect(gs);
          gs.connect(ac.destination);
          os.frequency.setValueAtTime(f, n + i * 0.15);
          gs.gain.setValueAtTime(0.1, n + i * 0.15);
          gs.gain.exponentialRampToValueAtTime(0.01, n + i * 0.15 + 0.3);
          os.start(n + i * 0.15);
          os.stop(n + i * 0.15 + 0.3);
        });
        break;

      case 'lose':
        [400, 350, 300, 200].forEach(function(f, i) {
          const os = ac.createOscillator();
          const gs = ac.createGain();
          os.connect(gs);
          gs.connect(ac.destination);
          os.frequency.setValueAtTime(f, n + i * 0.2);
          gs.gain.setValueAtTime(0.1, n + i * 0.2);
          gs.gain.exponentialRampToValueAtTime(0.01, n + i * 0.2 + 0.3);
          os.start(n + i * 0.2);
          os.stop(n + i * 0.2 + 0.3);
        });
        break;

      case 'card_reveal':
        o.type = 'sine';
        o.frequency.setValueAtTime(600, n);
        o.frequency.exponentialRampToValueAtTime(1200, n + 0.4);
        g.gain.setValueAtTime(0.1, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + 0.5);
        o.start(n);
        o.stop(n + 0.5);
        break;
    }
  }

  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true });

  // Expose global shortcuts so callers can use showScreen() directly
  window.showScreen = showScreen;
  window.showToast = showToast;
  window.showLoading = showLoading;
  window.hideLoading = hideLoading;
  window.showModal = showModal;
  window.animateDamage = function(target, damage, isPlayer) {
    showFloatingText(target, '-' + damage, isPlayer ? 'damage-player' : 'damage-boss');
  };
  window.hideModal = hideModal;

  // ===== 冒险故事过场画面 =====
  let storyTypeInterval = null;
  let storyResolve = null;

  function showStoryOverlay(text, onComplete) {
    if (!text || typeof text !== 'string') text = '';
    let overlay = document.getElementById('story-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'story-overlay';
      overlay.innerHTML =
        '<div class="story-parchment">' +
          '<div class="story-text" id="story-text"></div>' +
          '<button class="story-continue" id="story-continue">点击继续 ▼</button>' +
        '</div>';
      document.body.appendChild(overlay);
      document.getElementById('story-continue').addEventListener('click', hideStoryOverlay);
    }
    overlay.classList.add('active');
    const textEl = document.getElementById('story-text');
    textEl.textContent = '';
    document.getElementById('story-continue').style.opacity = '0';
    document.getElementById('story-continue').style.pointerEvents = 'none';
    storyResolve = onComplete;

    // 打字机效果
    let i = 0;
    if (storyTypeInterval) clearInterval(storyTypeInterval);
    storyTypeInterval = setInterval(function() {
      if (i < text.length) {
        textEl.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(storyTypeInterval);
        storyTypeInterval = null;
        const btn = document.getElementById('story-continue');
        if (btn) {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
        }
      }
    }, 45); // 每字45ms
  }

  function hideStoryOverlay() {
    const overlay = document.getElementById('story-overlay');
    if (overlay) overlay.classList.remove('active');
    if (storyTypeInterval) { clearInterval(storyTypeInterval); storyTypeInterval = null; }
    if (typeof storyResolve === 'function') { storyResolve(); storyResolve = null; }
  }

  window.showStoryOverlay = showStoryOverlay;
  window.hideStoryOverlay = hideStoryOverlay;

  return {
    showScreen: showScreen,
    showToast: showToast,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showModal: showModal,
    hideModal: hideModal,
    animateElement: animateElement,
    showFloatingText: showFloatingText,
    animateBar: animateBar,
    shakeElement: function(e) { return animateElement(e, 'shake', 400); },
    pulseElement: function(e) { return animateElement(e, 'pulse', 500); },
    playSound: playSound
  };
})();

// Global card rendering helpers
function createGameCard(card, options) {
  if (options === undefined) options = {};
  const el = document.createElement('div');
  el.className = 'game-card';
  if (options.selected) el.classList.add('selected');
  if (!options.clickable) el.style.cursor = 'default';

  const img = document.createElement('img');
  img.className = 'card-image';
  img.src = options.imageOverride || card.image || card.sourceImage || '';
  img.alt = card.name || '';
  el.appendChild(img);

  const info = document.createElement('div');
  info.className = 'card-info';

  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = card.name || '';
  info.appendChild(name);

  const stats = document.createElement('div');
  stats.className = 'card-stats';
  stats.innerHTML = '<span>' + (card.hp || card.maxHp || 0) + ' HP</span><span>' + (card.atk || 0) + ' ATK</span>';
  info.appendChild(stats);
  el.appendChild(info);

  const rarity = document.createElement('div');
  rarity.className = 'card-rarity rarity-common';
  el.appendChild(rarity);

  const skillsWrap = document.createElement('div');
  skillsWrap.className = 'card-skills-preview';
  if (card.skills && card.skills.length) {
    card.skills.slice(0, 2).forEach(function(skill) {
      const row = document.createElement('div');
      row.className = 'card-skill-row';
      row.innerHTML = '<span class="skill-icon type-' + (skill.type || 'physical') + '"></span>' +
        '<span class="cs-name">' + (skill.name || '') + '</span>' +
        '<span class="cs-cost">' + skill.cost + '💎</span>';
      skillsWrap.appendChild(row);
    });
  }
  el.appendChild(skillsWrap);

  if (options.clickable && options.onClick) {
    el.addEventListener('click', function() { options.onClick(card); });
  }
  return el;
}

function createCardDetailHTML(card) {
  var skillsHtml = (card.skills || []).map(function(s) {
    return '<div class="detail-skill">' +
      '<span class="skill-icon type-' + (s.type || 'physical') + '"></span>' +
      '<div class="skill-body">' +
        '<div class="ds-header"><span class="ds-name">' + s.name + '</span><span class="ds-cost">' + s.cost + '💎</span></div>' +
        '<p>' + (s.description || '') + '</p>' +
      '</div></div>';
  }).join('');

  return '<div class="detail-card-preview">' +
    '<img class="detail-card-image" src="' + (card.image || card.sourceImage || '') + '" alt="' + (card.name || '') + '">' +
    '<div class="detail-card-name">' + (card.name || '') + '</div>' +
    '<div class="detail-card-stats"><span>' + (card.hp || card.maxHp || 0) + ' HP</span><span>' + (card.atk || 0) + ' ATK</span></div>' +
    '</div>' +
    '<div class="detail-section-title">⚔️ 技能</div>' +
    '<div class="card-detail-skills">' + skillsHtml + '</div>' +
    '<div class="detail-section-title">📋 信息</div>' +
    '<div class="detail-card-info">' +
    '<div class="detail-info-row"><span>类别</span><span>' + (card.category || '未知') + '</span></div>' +
    '<div class="detail-info-row"><span>体型</span><span>' + (card.size || '中等') + '</span></div>' +
    '<div class="detail-info-row"><span>定位</span><span>' + (card.role || '未知') + '</span></div>' +
    '</div>';
}
