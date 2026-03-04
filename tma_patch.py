import re

with open('/workspace/tma.html', 'r') as f:
    html = f.read()

# 1. Добавим CSS для онбординга и фиксов чата — вставим перед закрывающим </style>
onboarding_css = """
/* ═══ ONBOARDING ═══ */
.onboarding-wrap {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity .4s ease, transform .4s ease;
}
.onboarding-wrap.hidden {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.97);
}
.ob-slides {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}
.ob-slide {
  min-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 28px 0;
  transition: transform .4s cubic-bezier(.25,.46,.45,.94);
  text-align: center;
}
.ob-visual {
  width: 220px;
  height: 220px;
  border-radius: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
  position: relative;
}
.ob-visual-1 {
  background: linear-gradient(135deg, rgba(153,69,255,0.2), rgba(25,251,155,0.08));
  border: 1px solid rgba(153,69,255,0.25);
}
.ob-visual-2 {
  background: linear-gradient(135deg, rgba(255,107,53,0.15), rgba(255,51,102,0.1));
  border: 1px solid rgba(255,107,53,0.2);
}
.ob-visual-3 {
  background: linear-gradient(135deg, rgba(25,251,155,0.12), rgba(69,170,242,0.08));
  border: 1px solid rgba(25,251,155,0.2);
}
.ob-visual::before {
  content: '';
  position: absolute;
  inset: -30px;
  background: inherit;
  filter: blur(40px);
  opacity: 0.4;
  border-radius: 50%;
  z-index: -1;
}
.ob-emoji { font-size: 80px; line-height: 1; }
.ob-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.8px;
  margin-bottom: 12px;
  line-height: 1.2;
}
.ob-desc {
  font-size: 15px;
  color: var(--text2);
  line-height: 1.65;
  max-width: 300px;
}
.ob-bottom {
  padding: 20px 24px;
  padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
}
.ob-dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-bottom: 20px;
}
.ob-dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: var(--border2);
  transition: width .3s cubic-bezier(.25,.46,.45,.94), background .3s;
}
.ob-dot.active {
  width: 22px;
  background: var(--accent);
}
.ob-btn {
  width: 100%;
  padding: 17px;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  font-family: inherit;
  background: linear-gradient(135deg, #9945FF, #7B2FE0);
  color: #fff;
  box-shadow: 0 4px 24px rgba(153,69,255,0.4);
  transition: transform .15s, box-shadow .15s, opacity .15s;
  letter-spacing: 0.2px;
}
.ob-btn:active { transform: scale(0.97); box-shadow: 0 2px 12px rgba(153,69,255,0.3); }
.ob-skip {
  text-align: center;
  margin-top: 12px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
}

/* ═══ NAV HIGHLIGHT ═══ */
.nav-btn::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  transition: width .25s cubic-bezier(.25,.46,.45,.94);
}
.nav-btn.active::after { width: 20px; }
.nav-btn { transition: color .2s, transform .1s; }
.nav-btn:active { transform: scale(0.9); }

/* ═══ CHAT FIX ═══ */
#s-chat > div { height: 100dvh; max-height: 100dvh; }
.chat-preview-area {
  flex: 1;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 55%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 0%, black 55%, transparent 100%);
  min-height: 0;
}
"""

html = html.replace('</style>', onboarding_css + '</style>', 1)

# 2. Добавим онбординг HTML перед закрывающим </body>
onboarding_html = """
<!-- ═══ ONBOARDING OVERLAY ═══ -->
<div id="onboarding" class="onboarding-wrap">
  <!-- Orbs -->
  <div style="position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0">
    <div style="position:absolute;top:-100px;left:-80px;width:360px;height:360px;background:radial-gradient(circle,rgba(153,69,255,.2) 0%,transparent 70%);border-radius:50%"></div>
    <div style="position:absolute;bottom:100px;right:-80px;width:300px;height:300px;background:radial-gradient(circle,rgba(25,251,155,.1) 0%,transparent 70%);border-radius:50%"></div>
  </div>

  <div class="ob-slides" id="ob-slides" style="position:relative;z-index:1">
    <!-- Slide 1: Welcome -->
    <div class="ob-slide" id="ob-s1">
      <div class="ob-visual ob-visual-1">
        <span class="ob-emoji">🎯</span>
      </div>
      <div class="ob-title">PolyClawster</div>
      <div class="ob-desc">AI-агент, который торгует на Polymarket вместо тебя. Умные деньги, реальная прибыль — без усилий.</div>
    </div>
    <!-- Slide 2: Signals -->
    <div class="ob-slide" id="ob-s2" style="transform:translateX(100%)">
      <div class="ob-visual ob-visual-2">
        <span class="ob-emoji">⚡</span>
      </div>
      <div class="ob-title">Сигналы<br>умных денег</div>
      <div class="ob-desc">Следим за 53 лучшими трейдерами Polymarket. Как только они заходят в позицию — ты узнаёшь первым.</div>
    </div>
    <!-- Slide 3: Wallet -->
    <div class="ob-slide" id="ob-s3" style="transform:translateX(200%)">
      <div class="ob-visual ob-visual-3">
        <span class="ob-emoji">💎</span>
      </div>
      <div class="ob-title">Твой кошелёк,<br>твои деньги</div>
      <div class="ob-desc">Non-custodial кошелёк на Polygon. Депозит в USDC — AI торгует, ты платишь 5% только с прибыли.</div>
    </div>
  </div>

  <div class="ob-bottom" style="position:relative;z-index:1">
    <div class="ob-dots">
      <div class="ob-dot active" id="ob-dot-0"></div>
      <div class="ob-dot" id="ob-dot-1"></div>
      <div class="ob-dot" id="ob-dot-2"></div>
    </div>
    <button class="ob-btn" id="ob-next-btn" onclick="obNext()">Далее</button>
    <div class="ob-skip" id="ob-skip" onclick="obFinish()">Пропустить</div>
  </div>
</div>

<script>
// ══ ONBOARDING ══════════════════════════════════════════════════
(function() {
  var OB_KEY = 'pc_ob_done_v2';
  var cur = 0;
  var total = 3;
  var slides = ['ob-s1','ob-s2','ob-s3'];
  var startX = 0, isDragging = false;

  function alreadySeen() {
    try { return localStorage.getItem(OB_KEY) === '1'; } catch(e) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(OB_KEY, '1'); } catch(e) {}
  }

  function updateSlides(idx, dir) {
    slides.forEach(function(id, i) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.transition = 'transform .4s cubic-bezier(.25,.46,.45,.94)';
      el.style.transform = 'translateX(' + ((i - idx) * 100) + '%)';
    });
    // dots
    for (var i=0; i<total; i++) {
      var d = document.getElementById('ob-dot-'+i);
      if (d) d.className = 'ob-dot' + (i===idx?' active':'');
    }
    // button text
    var btn = document.getElementById('ob-next-btn');
    var skip = document.getElementById('ob-skip');
    if (btn) btn.textContent = (idx === total-1) ? 'Начать торговать 🚀' : 'Далее';
    if (skip) skip.style.visibility = (idx === total-1) ? 'hidden' : 'visible';
    // haptic
    var tgw = window.Telegram && window.Telegram.WebApp;
    if (tgw && tgw.HapticFeedback) tgw.HapticFeedback.impactOccurred('light');
  }

  window.obNext = function() {
    if (cur < total - 1) {
      cur++;
      updateSlides(cur);
    } else {
      obFinish();
    }
  };

  window.obFinish = function() {
    markSeen();
    var ob = document.getElementById('onboarding');
    if (ob) {
      ob.style.transition = 'opacity .35s ease, transform .35s ease';
      ob.classList.add('hidden');
      setTimeout(function() { ob.style.display='none'; }, 400);
    }
    var tgw = window.Telegram && window.Telegram.WebApp;
    if (tgw && tgw.HapticFeedback) tgw.HapticFeedback.notificationOccurred('success');
  };

  // Swipe support
  var ob = document.getElementById('onboarding');
  if (ob) {
    ob.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      isDragging = false;
    }, {passive:true});
    ob.addEventListener('touchmove', function(e) {
      isDragging = Math.abs(e.touches[0].clientX - startX) > 10;
    }, {passive:true});
    ob.addEventListener('touchend', function(e) {
      if (!isDragging) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (dx < -40 && cur < total-1) { cur++; updateSlides(cur); }
      else if (dx > 40 && cur > 0) { cur--; updateSlides(cur); }
    }, {passive:true});
  }

  // Show or hide
  if (alreadySeen()) {
    var ob2 = document.getElementById('onboarding');
    if (ob2) ob2.style.display = 'none';
  }
})();
</script>
"""

html = html.replace('</body>', onboarding_html + '\n</body>', 1)

with open('/workspace/tma.html', 'w') as f:
    f.write(html)

print("Done:", html.count('\n'), "lines")
