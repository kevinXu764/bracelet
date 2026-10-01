(() => {
  'use strict';
  const D = window.HX_DATA;
  const $ = id => document.getElementById(id);
  const KEY = 'xianghui-atelier-v1';
  const TAB_TITLES = { customize: '合香珠定制', mine: '我的' };
  const PAGE_TITLES = { quiz: '寻香自测', orders: '我的定制申请', favorites: '我的收藏', measure: '如何测量手围', care: '佩戴与养护', about: '关于香慧' };
  const stepNames = ['', '选香方', '定手围', '选款式', '确认方案'];
  const defaults = () => ({ recipeId: null, styleId: null, wrist: 16, fit: 'comfort', diameter: 10, quantity: 17, autoQuantity: true, wristConfirmed: false });
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => {
    const paths = {
      check: '<path d="m5 12 4 4 10-10"/>',
      heart: '<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',
      leaf: '<path d="M19.5 3.5c-7-1-14 2-14 9 0 4 3 7 7 6.5 6-.5 8-8 7-15.5Z"/><path d="M4 21 16 8M8 17l-.5-5M12 13l5 .5"/>',
      bag: '<path d="M5 8.5h14l1 12H4l1-12Z"/><path d="M8.5 9V6a3.5 3.5 0 0 1 7 0v3"/>',
      chevron: '<path d="m14.5 5-7 7 7 7"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.leaf) + '</svg>';
  };

  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
  const plan = Object.assign(defaults(), stored.plan || {});
  if (!D.recipes.some(r => r.id === plan.recipeId)) plan.recipeId = null;
  if (!D.styles.some(s => s.id === plan.styleId)) plan.styleId = null;
  plan.wrist = Math.min(22, Math.max(13, Number(plan.wrist) || 16));
  plan.fit = D.fits.some(f => f.id === plan.fit) ? plan.fit : 'comfort';
  plan.diameter = [8, 10, 12, 15].includes(plan.diameter) ? plan.diameter : 10;
  plan.quantity = Math.min(150, Math.max(8, Number(plan.quantity) || 17));
  const savedAnswers = stored.quiz && Array.isArray(stored.quiz.answers) ? stored.quiz.answers : [];
  const answers = D.questions.map((_, i) => [1, 2, 3, 4, 5].includes(savedAnswers[i]) ? savedAnswers[i] : null);
  const state = {
    plan,
    favorites: Array.isArray(stored.favorites) ? stored.favorites.filter(id => D.recipes.some(r => r.id === id)) : [],
    orders: Array.isArray(stored.orders) ? stored.orders.filter(o => o && D.recipes.some(r => r.id === o.recipeId) && D.styles.some(s => s.id === o.styleId)).slice(0, 40) : [],
    quiz: { answers, index: Math.min(29, Math.max(0, Number(stored.quiz && stored.quiz.index) || 0)), complete: answers.every(a => a !== null) },
    quizView: 'question',
    series: 'premium', scent: '全部', query: '', recipeExpanded: false,
    styleCategory: 'single', styleExpanded: false,
    tab: ['home', 'customize', 'mine'].includes(stored.view && stored.view.tab) ? stored.view.tab : 'home',
    page: null,
    activeStep: [1, 2, 3, 4].includes(stored.view && stored.view.activeStep) ? stored.view.activeStep : 1,
    resumeStep: Number(stored.view && stored.view.resumeStep) || 0
  };
  let modalType = null, modalData = null, previousFocus = null, quizTimer = null, toastTimer = null, answerLocked = false, submitting = false;
  const dialog = $('experience-dialog');
  const recipe = () => D.recipes.find(r => r.id === state.plan.recipeId);
  const style = () => D.styles.find(s => s.id === state.plan.styleId);
  const fit = () => D.fits.find(f => f.id === state.plan.fit);
  const seriesName = id => (D.series.find(s => s.id === id) || {}).name || '';
  const categoryName = id => (D.styleCategories.find(s => s.id === id) || {}).name || '';
  const estimatedQuantity = () => { const s = style(); return s && s.fixed ? s.fixed : Math.max(8, Math.round((state.plan.wrist + fit().extra) * 10 / state.plan.diameter) * (s ? s.rings : 1)); };
  const price = () => { const r = recipe(), s = style(); if (!r) return 0; return Math.max(0, r.price + (s ? s.extra : 0) + ({ 8: -10, 10: 0, 12: 20, 15: 50 }[state.plan.diameter]) + Math.max(0, state.plan.quantity - 19) * 3); };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ version: 3, plan: state.plan, favorites: state.favorites, quiz: state.quiz, orders: state.orders, view: { tab: state.tab, activeStep: state.activeStep, resumeStep: state.resumeStep } })); return true; } catch (_) { return false; } };
  if (style() && !style().allowed.includes(plan.diameter)) plan.diameter = style().allowed[0];
  if (style() && style().fixed) plan.quantity = style().fixed;
  else if (plan.autoQuantity) plan.quantity = estimatedQuantity();

  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2700); }
  const availableStep = () => !recipe() ? 1 : !state.plan.wristConfirmed ? 2 : !style() ? 3 : 4;

  /* ---------------- navigation ---------------- */
  function goTab(tab, step) {
    state.page = null;
    state.tab = tab;
    if (tab === 'customize') state.activeStep = Math.min(4, Math.max(1, step || state.resumeStep || availableStep()));
    persist(); render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function jump(step) {
    const allowed = availableStep();
    if (step > allowed) { toast(allowed === 1 ? '请先选择一味香方' : allowed === 2 ? '请先确认手围与佩戴感' : '请先选择喜欢的款式'); step = allowed; }
    step = Math.min(4, Math.max(1, step));
    const changed = state.activeStep !== step || state.tab !== 'customize' || state.page;
    state.tab = 'customize'; state.page = null; state.activeStep = step; state.resumeStep = step; persist(); render();
    if (changed) { window.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => $('step-title-' + step).focus({ preventScroll: true })); }
  }
  function startCustomization() { goTab('customize'); }
  function advance() {
    if (state.activeStep === 1) { if (!recipe()) { toast('请先选择一味香方'); return; } jump(2); return; }
    if (state.activeStep === 2) { state.plan.wristConfirmed = true; persist(); render(); jump(3); return; }
    if (state.activeStep === 3) { if (!style()) { toast('请先选择喜欢的款式'); return; } jump(4); return; }
    submitOrder();
  }
  function openPage(page) {
    state.page = page; render();
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => { const f = $('page-body').querySelector('[data-page-focus]'); if (f) f.focus({ preventScroll: true }); });
  }
  function closePage() {
    clearTimeout(quizTimer); answerLocked = false;
    const leavingQuiz = state.page === 'quiz';
    state.page = null; render();
    if (leavingQuiz && !state.quiz.complete && state.quiz.answers.some(a => a !== null)) toast('已保留作答进度，随时可以继续');
  }
  function openQuiz() {
    if (state.quiz.complete) state.quizView = 'result';
    else if (state.quiz.answers.some(a => a !== null)) state.quizView = 'intro';
    else { state.quiz.index = 0; state.quizView = 'question'; }
    openPage('quiz');
  }

  /* ---------------- sheets ---------------- */
  function showModal(type, body, data = null) {
    if (!dialog.open) previousFocus = document.activeElement;
    modalType = type; modalData = data; dialog.className = 'sheet'; dialog.innerHTML = body;
    document.body.classList.add('no-scroll'); if (!dialog.open) dialog.showModal();
    const content = dialog.querySelector('.dialog-content'); if (content) content.scrollTop = 0;
    requestAnimationFrame(() => { const focus = dialog.querySelector('[data-dialog-focus]') || dialog.querySelector('.dialog-close'); if (focus) focus.focus({ preventScroll: true }); });
  }
  function closeModal() {
    if (dialog.open) dialog.close(); document.body.classList.remove('no-scroll');
    modalType = null; modalData = null;
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
  }
  const sheet = (title, content, footer = '') => '<div class="sheet-shell"><div class="sheet-grip"></div><div class="dialog-header"><h2 id="dialog-title">' + title + '</h2><button class="dialog-close" data-action="close" aria-label="关闭">×</button></div><div class="dialog-content">' + content + '</div>' + (footer ? '<div class="dialog-footer">' + footer + '</div>' : '') + '</div>';

  /* ---------------- customize tab: panels ---------------- */
  function renderRecipes() {
    $('recipe-tabs').innerHTML = D.series.map(s => '<button class="' + (!state.query && state.series === s.id ? 'active' : '') + '" data-action="series" data-id="' + s.id + '" aria-pressed="' + (!state.query && state.series === s.id) + '">' + s.name + '<small>' + D.recipes.filter(r => r.series === s.id).length + '</small></button>').join('');
    $('scent-tags').innerHTML = ['全部', '木香', '花香', '草本', '果香'].map(s => '<button class="' + (state.scent === s ? 'active' : '') + '" data-action="scent" data-id="' + s + '" aria-pressed="' + (state.scent === s) + '">' + s + '</button>').join('');
    const query = state.query.trim().toLowerCase();
    const list = D.recipes.filter(r => (query || r.series === state.series) && (state.scent === '全部' || r.scent === state.scent) && (!query || [r.name, r.notes, r.ingredients, r.scene, r.description, seriesName(r.series)].join(' ').toLowerCase().includes(query)));
    const shown = state.recipeExpanded || query ? list : list.slice(0, 6);
    $('recipe-result-count').textContent = (query ? '全系列搜索' : seriesName(state.series)) + ' · ' + list.length + ' 味香方';
    $('search-clear').hidden = !state.query;
    $('recipe-grid').innerHTML = shown.length ? shown.map(r => {
      const selected = state.plan.recipeId === r.id, favorite = state.favorites.includes(r.id);
      return '<article class="product-card ' + (selected ? 'selected' : '') + '" data-recipe="' + r.id + '"><button class="product-favorite ' + (favorite ? 'active' : '') + '" data-action="favorite" data-id="' + r.id + '" aria-label="' + (favorite ? '取消收藏' : '收藏') + r.name + '" aria-pressed="' + favorite + '">' + icon('heart') + '</button><button class="product-picture" data-action="recipe-detail" data-id="' + r.id + '" aria-label="查看' + r.name + '香方详情"><img src="' + r.image + '" alt="' + r.name + '合香珠参考图" loading="lazy"><span class="product-badge">' + r.scent + '</span></button><div class="product-body"><h3 class="product-title">' + r.name + '</h3><p class="product-note">' + r.notes + '</p><div class="product-bottom"><span class="price"><small>¥</small>' + r.price + '</span><button class="select-product" data-action="select-recipe" data-id="' + r.id + '" aria-pressed="' + selected + '">' + (selected ? icon('check') + '已选择' : '选这味') + '</button></div></div></article>';
    }).join('') : '<div class="empty-state">' + icon('leaf') + '<h3>还没有找到这味香</h3><p>试试“桂花”“木香”或“放松”。</p><button data-action="reset-search">查看全部香方</button></div>';
    $('recipe-more').hidden = list.length <= 6 || !!query;
    $('recipe-more').textContent = state.recipeExpanded ? '收起香方 −' : '展开全部 ' + list.length + ' 味香方 +';
    const r = recipe();
    $('recipe-selected-note').classList.toggle('unselected', !r);
    $('recipe-selected-note').innerHTML = r ? icon('check') + '<div><small>已选香方</small><strong>' + r.name + '</strong><p>' + r.notes + '</p></div><button class="text-button" data-action="recipe-detail" data-id="' + r.id + '">查看已选</button>' : '<span class="status-circle">1</span><div><strong>还未选择香方</strong><p>在下方找到喜欢的香，点击「选这味」。</p></div>';
  }
  function renderFit() {
    $('wrist-value').innerHTML = state.plan.wrist.toFixed(1) + '<small>cm</small>';
    $('wrist-range').value = state.plan.wrist;
    const percent = (state.plan.wrist - 13) / 9 * 100; $('wrist-range').style.background = 'linear-gradient(to right,var(--wine) ' + percent + '%,#eae2d7 ' + percent + '%)';
    $('wrist-presets').innerHTML = [14, 15, 16, 17, 18].map(n => '<button class="' + (state.plan.wrist === n ? 'active' : '') + '" data-action="wrist-preset" data-value="' + n + '" aria-pressed="' + (state.plan.wrist === n) + '">' + n + ' cm</button>').join('');
    $('fit-options').innerHTML = D.fits.map(f => '<button class="' + (state.plan.fit === f.id ? 'active' : '') + '" data-action="fit" data-id="' + f.id + '" aria-pressed="' + (state.plan.fit === f.id) + '">' + (state.plan.fit === f.id ? '<span class="choice-check">✓</span>' : '') + f.name + '<small>' + f.note + '</small></button>').join('');
    const confirmed = state.plan.wristConfirmed;
    $('fit-selection-state').classList.toggle('unselected', !confirmed);
    $('fit-selection-state').innerHTML = (confirmed ? icon('check') : '<span class="status-circle">2</span>') + '<div><strong>' + (confirmed ? '尺寸已确认' : '当前尺寸与佩戴感待确认') + '</strong><p>' + (confirmed ? '修改后，在下方再次确认。' : '调整好后，在下方确认并继续。') + '</p></div>';
    $('fit-hint').textContent = '已为' + fit().name + '佩戴预留 ' + fit().extra.toFixed(1) + ' cm 余量。';
  }
  function renderSpecs() {
    const s = style();
    $('spec-panel').hidden = !s; $('spec-placeholder').hidden = !!s;
    const names = { 8: '小巧细致 · 适合叠戴', 10: '温润适中 · 日常推荐', 12: '饱满圆润 · 木质感更强', 15: '厚实大珠 · 更显质感' };
    $('diameter-description').textContent = names[state.plan.diameter];
    $('diameter-options').innerHTML = [8, 10, 12, 15].map(n => { const disabled = !!(s && !s.allowed.includes(n)); return '<button class="' + (state.plan.diameter === n ? 'active' : '') + '" data-action="diameter" data-value="' + n + '" ' + (disabled ? 'disabled' : '') + ' aria-label="' + n + '毫米珠径' + (disabled ? '，当前款式不支持' : '') + '" aria-pressed="' + (state.plan.diameter === n) + '">' + (state.plan.diameter === n ? '<span class="choice-check">✓</span>' : '') + '<span class="bead-dot" style="width:' + (n + 3) + 'px;height:' + (n + 3) + 'px"></span><span>' + n + ' mm</span></button>'; }).join('');
    $('quantity-value').textContent = state.plan.quantity;
    $('quantity-note').textContent = s && s.fixed ? '本款式固定 ' + s.fixed + ' 颗' : (s ? s.rings : 1) + ' 圈 · 按手围估算，可微调';
    const fixed = !!(s && s.fixed);
    document.querySelector('[data-action="quantity-down"]').disabled = fixed || state.plan.quantity <= 8;
    document.querySelector('[data-action="quantity-up"]').disabled = fixed || state.plan.quantity >= 150;
    $('spec-hint').hidden = !s;
    if (s) $('spec-hint').textContent = '当前选定「' + s.name + '」 · 适配 ' + s.allowed.join(' / ') + ' mm' + (s.fixed ? ' · 固定 ' + s.fixed + ' 颗' : '');
  }
  function renderStyles() {
    $('style-tabs').innerHTML = D.styleCategories.map(c => '<button class="' + (state.styleCategory === c.id ? 'active' : '') + '" data-action="style-category" data-id="' + c.id + '" aria-pressed="' + (state.styleCategory === c.id) + '">' + c.name + '<small>' + D.styles.filter(s => s.category === c.id).length + '</small></button>').join('');
    const list = D.styles.filter(s => s.category === state.styleCategory), shown = state.styleExpanded ? list : list.slice(0, 6);
    $('style-result-count').textContent = '正在浏览 ' + categoryName(state.styleCategory) + ' · ' + list.length + ' 款';
    $('style-grid').innerHTML = shown.length ? shown.map(s => {
      const selected = s.id === state.plan.styleId;
      return '<article class="product-card style-card ' + (selected ? 'selected' : '') + '" data-style="' + s.id + '"><button class="product-picture" data-action="style-detail" data-id="' + s.id + '" aria-label="查看' + s.name + '款式大图"><img src="' + s.image + '" alt="' + s.name + '款式参考图" loading="lazy"><span class="product-badge">' + (s.allowed.length === 1 ? '仅 ' + s.allowed[0] + ' mm' : s.allowed.join(' / ') + ' mm') + '</span></button><div class="product-body"><h3 class="product-title">' + s.name + '</h3><p class="product-note">' + s.description + '</p><div class="product-bottom"><span class="price style-price">' + (s.extra ? '<small>配饰</small>+¥' + s.extra : '基础款') + '</span><button class="select-product" data-action="select-style" data-id="' + s.id + '" aria-pressed="' + selected + '">' + (selected ? icon('check') + '已选择' : '选这款') + '</button></div></div></article>';
    }).join('') : '<div class="empty-state">' + icon('leaf') + '<h3>这一系列，正在准备</h3><p>先去看看其他款式，或选择108颗长串。</p><button data-action="style-category" data-id="long">看看108颗系列 ↗</button></div>';
    $('style-more').hidden = list.length <= 6; $('style-more').textContent = state.styleExpanded ? '收起款式 −' : '展开全部 ' + list.length + ' 款 +';
    const s = style();
    $('style-selected-note').classList.toggle('unselected', !s);
    $('style-selected-note').innerHTML = s ? icon('check') + '<div><small>已选款式</small><strong>' + s.name + '</strong><p>' + state.plan.diameter + ' mm · ' + state.plan.quantity + ' 颗 · ' + categoryName(s.category) + '</p></div><button class="text-button" data-action="spec">调整规格 ↓</button>' : '<span class="status-circle">3</span><div><strong>还未选择款式</strong><p>浏览分类后点击「选这款」，再调整规格。</p></div>';
  }
  function renderSummary() {
    const r = recipe(), s = style();
    if (!r || !s) { $('summary-card').innerHTML = '<div class="summary-empty">' + icon('leaf').replace('<svg', '<svg style="width:26px;height:26px;margin:0 auto 13px;color:#ae9074"') + '<h3>先让心意，慢慢成形</h3><p>' + (r ? '已选「' + r.name + '」，再挑一款心动的造型。' : '选一味香方，再挑一款喜欢的造型。') + '</p><button class="text-button" data-action="jump" data-step="' + (r ? 3 : 1) + '">' + (r ? '去选款式' : '去选香方') + ' ↗</button></div>'; return; }
    $('summary-card').innerHTML = '<div class="summary-top"><img src="' + s.image + '" alt="已选款式' + s.name + '"><div><span class="inline-badge">为你定制</span><h3>' + s.name + '</h3><p>' + r.name + ' · ' + r.notes + '</p><button data-action="style-detail" data-id="' + s.id + '">查看款式细节 ↗</button></div></div><dl class="summary-params"><div><dt>手围</dt><dd>' + (s.fixed ? '长串 / 手持' : state.plan.wrist.toFixed(1) + ' cm') + '</dd></div><div><dt>佩戴感</dt><dd>' + (s.fixed ? '固定颗数' : fit().name) + '</dd></div><div><dt>珠径</dt><dd>' + state.plan.diameter + ' mm</dd></div><div><dt>颗数</dt><dd>' + state.plan.quantity + ' 颗</dd></div><div><dt>香方系列</dt><dd>' + seriesName(r.series) + '</dd></div><div><dt>款式系列</dt><dd>' + categoryName(s.category) + '</dd></div></dl><div class="summary-edit-row"><button data-action="jump" data-step="1">修改香方</button><button data-action="jump" data-step="2">修改手围</button><button data-action="jump" data-step="3">修改款式 / 规格</button></div><div class="summary-total"><span>预计定制价格</span><strong><small>¥</small>' + price() + '</strong></div><p class="summary-tip">参考价格，以实际定制确认为准。</p>';
  }

  /* ---------------- chrome ---------------- */
  function renderHeader() {
    const back = state.page ? '<button class="header-back" data-action="page-back" aria-label="返回上一级">' + icon('chevron').replace('stroke-width="1.5"', 'stroke-width="1.8"') + '</button>' : '';
    let title = '', side = '';
    if (state.page) title = '<h1 class="page-title">' + PAGE_TITLES[state.page] + '</h1>';
    else if (state.tab === 'home') title = '<button class="brand" data-action="tab" data-id="home" aria-label="香慧首页"><span class="brand-seal" aria-hidden="true">香</span><span class="brand-type"><strong>香慧</strong><small>HEXIANG ATELIER</small></span></button>';
    else { title = '<h1 class="page-title">' + TAB_TITLES[state.tab] + '</h1>'; if (state.tab === 'customize') side = '<span class="header-note">第 ' + state.activeStep + ' 步 / 共 4 步</span>'; }
    $('page-header').innerHTML = '<div class="header-left">' + back + title + '</div><div class="header-side">' + side + '</div>';
  }
  function renderTabBar() {
    document.querySelectorAll('.tab-item').forEach(b => {
      const active = b.dataset.id === state.tab;
      b.classList.toggle('active', active);
      if (active && !state.page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const started = !!(state.plan.recipeId || state.plan.styleId || state.plan.wristConfirmed);
    $('dot-customize').hidden = !(started && !(state.plan.recipeId && state.plan.styleId && state.plan.wristConfirmed));
    $('badge-mine').hidden = !state.orders.length;
    $('badge-mine').textContent = state.orders.length;
  }
  function renderHome() {
    const r = recipe(), s = style(), started = !!(r || s || state.plan.wristConfirmed);
    $('hero-start').innerHTML = (started ? '继续我的定制' : '开始我的定制') + ' <span aria-hidden="true">→</span>';
    $('entry-customize-note').textContent = r ? (s ? r.name + ' · ' + s.name : r.name + ' · 待选款式') : '4 步，做一串属于你的香';
    const answered = state.quiz.answers.filter(a => a !== null).length;
    $('entry-quiz-note').textContent = state.quiz.complete ? '已寻到：' + calculateResult().profile.name : answered ? '已答 ' + answered + ' / 30 题' : '30 道轻问答，凭心意寻香';
    const resume = Math.min(availableStep(), state.resumeStep || availableStep());
    $('resume-plan').hidden = !r;
    if (r) $('resume-plan').innerHTML = icon('check') + '<div><strong>进行到第 ' + resume + ' 步 · ' + stepNames[resume] + '</strong><p>' + r.name + (s ? ' · ' + s.name : ' · 还没选款式') + '</p></div>';
    const picks = ['木香', '花香', '草本', '果香'].map(scent => D.recipes.find(x => x.scent === scent) || D.recipes[0]);
    $('featured-grid').innerHTML = picks.map(r => '<article class="product-card"><button class="product-picture" data-action="recipe-detail" data-id="' + r.id + '" aria-label="查看' + r.name + '香方详情"><img src="' + r.image + '" alt="' + r.name + '合香珠参考图" loading="lazy"><span class="product-badge">' + r.scent + '</span></button><div class="product-body"><h3 class="product-title">' + r.name + '</h3><p class="product-note">' + r.notes + '</p><div class="product-bottom"><span class="price"><small>¥</small>' + r.price + '</span><button class="select-product" data-action="recipe-detail" data-id="' + r.id + '">看这味</button></div></div></article>').join('');
  }
  function renderMine() {
    const last = state.orders[0];
    $('mine-profile').innerHTML = '<span class="avatar" aria-hidden="true">' + (last ? esc(String(last.name).slice(0, 1)) : '香') + '</span><div class="mine-id"><h2>' + (last ? esc(last.name) : '你好，初次见面') + '</h2></div>';
    $('mine-ongoing').textContent = r || s || state.plan.wristConfirmed ? '第 ' + availableStep() + ' 步 · ' + stepNames[availableStep()] : '去开始';
    $('mine-orders').textContent = state.orders.length + ' 条';
    $('mine-favorites').textContent = state.favorites.length + ' 味';
    const answered = state.quiz.answers.filter(a => a !== null).length;
    $('mine-result').textContent = state.quiz.complete ? calculateResult().profile.name : answered ? '已答 ' + answered + ' 题' : '还未自测';
  }

  /* ---------------- pushed pages ---------------- */
  function quizIntroMarkup() {
    const answered = state.quiz.answers.filter(a => a !== null).length;
    return '<div class="page-center">' +
      '<div class="resume-symbol" aria-hidden="true">香</div>' +
      '<h2 class="page-h2">还没遇见合心的香</h2>' +
      '<p class="page-p">30 道轻问答，凭第一感觉作答，让心意带你寻香。' + (answered ? '你已完成 ' + answered + ' / 30 题。' : '') + '</p>' +
      '<button class="primary-button wide" data-action="quiz-' + (answered ? 'continue' : 'start') + '">' + (answered ? '继续作答' : '开始寻香自测') + ' <span aria-hidden="true">→</span></button>' +
      (answered ? '<button class="secondary-button wide" data-action="quiz-restart">重新开始</button>' : '') +
      '<p class="page-note">自测用于寻香体验，采用演示规则，不用于体质诊断。</p></div>';
  }
  function quizQuestionMarkup() {
    const q = D.questions[state.quiz.index];
    const groupStart = D.questions.findIndex(x => x.group === q.group), groupSize = D.questions.filter(x => x.group === q.group).length;
    return '<div class="quiz-page">' +
      '<div class="quiz-meta"><span>' + q.group + ' · ' + (state.quiz.index - groupStart + 1) + ' / ' + groupSize + '</span><strong>' + String(state.quiz.index + 1).padStart(2, '0') + '<small>/ 30</small></strong></div>' +
      '<div class="progress-track"><span style="width:' + state.quiz.index / 30 * 100 + '%"></span></div>' +
      '<div class="quiz-question-nav"><button data-action="quiz-back" ' + (state.quiz.index === 0 ? 'disabled' : '') + '>‹ 上一题</button><span>凭第一感觉作答</span></div>' +
      '<h3 class="quiz-question" tabindex="-1" data-page-focus>' + q.text + '</h3>' +
      '<p class="quiz-subtext">回想平时的感受，选最贴近你的答案。</p>' +
      '<div class="quiz-answers">' + D.answerLabels.map((label, i) => '<button data-action="answer" data-value="' + (i + 1) + '" class="' + (state.quiz.answers[state.quiz.index] === i + 1 ? 'selected' : '') + '" aria-pressed="' + (state.quiz.answers[state.quiz.index] === i + 1) + '"><span>' + label + '</span><span class="answer-dot"></span></button>').join('') + '</div>' +
      '<p class="quiz-footnote">随时可以返回上一题，退出后也会保留进度。</p></div>';
  }
  function resultMarkup() {
    const result = calculateResult();
    const card = (r, label, reason) => '<button class="recommend-card" data-action="result-recipe-detail" data-id="' + r.id + '"><img src="' + r.image + '" alt="' + r.name + '参考图"><div><p class="eyebrow">' + label + '</p><h5>' + r.name + '</h5><p>' + reason + '</p><span class="price">¥ ' + r.price + '</span></div><span class="recommend-arrow">↗</span></button>';
    return '<div class="result-page">' +
      '<div class="result-hero"><p class="eyebrow">YOUR SCENT PORTRAIT / 自测参考倾向</p><h3>' + result.profile.name + '</h3><p>' + result.profile.subtitle + '<br>' + result.profile.description + '</p></div>' +
      '<div class="result-body-title"><h4>为你寻到的香</h4><span>一份参考，听从心意</span></div>' +
      card(result.primary, '依据问答倾向推荐', '与你本次自测倾向对应') +
      card(result.secondary, '依据香味偏好推荐', '你更偏爱' + result.preferred + '气息') +
      '<p class="result-note">自测用于寻香体验，采用演示规则，不用于体质诊断。香方名称与价格为体验数据；喜欢哪味香，最终由你决定。</p>' +
      '<button class="primary-button wide" data-action="use-recipe" data-id="' + result.primary.id + '">选用「' + result.primary.name + '」 <span aria-hidden="true">→</span></button>' +
      '<button class="secondary-button wide" data-action="result-browse">按喜好再挑选</button>' +
      '<button class="text-button center" data-action="quiz-restart">重新自测</button></div>';
  }
  function ordersMarkup() {
    if (!state.orders.length) return '<div class="empty-state">' + icon('bag') + '<h3>还没有定制申请</h3><p>从一味喜欢的香，开始你的第一串。</p><button data-action="start">去开启定制 ↗</button></div>';
    return state.orders.map(o => {
      const s = D.styles.find(s => s.id === o.styleId);
      return '<article class="order-history-card"><div class="history-meta"><span>' + esc(o.date) + '</span><span class="status-chip">本机已保存</span></div><div class="history-product"><img src="' + s.image + '" alt="' + esc(o.styleName) + '"><div><h3>' + esc(o.styleName) + '</h3><p>' + esc(o.recipeName) + ' · ' + esc(o.diameter) + ' mm · ' + esc(o.quantity) + ' 颗</p><strong>¥ ' + esc(o.price) + '</strong></div></div><div class="history-actions"><button data-action="order-detail" data-id="' + esc(o.id) + '">查看详情</button><button data-action="reuse-order" data-id="' + esc(o.id) + '">再次搭配</button></div></article>';
    }).join('') + '<p class="page-note">记录仅保存在当前浏览器，换设备后不会同步。</p>';
  }
  function favoritesMarkup() {
    const list = state.favorites.map(id => D.recipes.find(r => r.id === id)).filter(Boolean);
    if (!list.length) return '<div class="empty-state">' + icon('heart') + '<h3>还没有收藏的香</h3><p>在香方卡片右上角点亮心形，就能收在这里。</p><button data-action="start">去逛香方 ↗</button></div>';
    return '<div class="recipe-grid">' + list.map(r => {
      const selected = state.plan.recipeId === r.id;
      return '<article class="product-card ' + (selected ? 'selected' : '') + '"><button class="product-favorite active" data-action="favorite" data-id="' + r.id + '" aria-label="取消收藏' + r.name + '" aria-pressed="true">' + icon('heart') + '</button><button class="product-picture" data-action="recipe-detail" data-id="' + r.id + '" aria-label="查看' + r.name + '香方详情"><img src="' + r.image + '" alt="' + r.name + '合香珠参考图" loading="lazy"><span class="product-badge">' + r.scent + '</span></button><div class="product-body"><h3 class="product-title">' + r.name + '</h3><p class="product-note">' + r.notes + '</p><div class="product-bottom"><span class="price"><small>¥</small>' + r.price + '</span><button class="select-product" data-action="select-recipe" data-id="' + r.id + '" aria-pressed="' + selected + '">' + (selected ? icon('check') + '已选择' : '选这味') + '</button></div></div></article>';
    }).join('') + '</div>';
  }
  function infoMarkup(type) {
    if (type === 'measure') return '<div class="info-content"><div class="measure-illustration"><svg viewBox="0 0 280 110" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M28 58c20-28 42-30 67-23l104 15c14 2 22 18 10 27-7 5-19 2-29 1l-63-7c-7 14-24 18-38 13L29 71"/><path d="M96 37c-17 0-23 6-22 22 0 11 4 22 16 26M113 39c-15 0-23 4-23 21 0 10 4 20 14 22"/><path d="M81 46h18M79 53h17M78 61h17M81 70h15"/><path d="M124 26h95M124 22v8M219 22v8"/><text x="145" y="18" font-size="12" fill="currentColor" stroke="none">软尺贴合手腕</text><path d="m168 30 0 11" stroke-dasharray="3 3"/></svg></div><h3>刚好贴合，不紧不松。</h3><div class="info-row"><span>01</span><div><h4>找到佩戴的位置</h4><p>用软尺在平时戴手串的位置绕一圈，自然贴合皮肤。</p></div></div><div class="info-row"><span>02</span><div><h4>没有软尺，也没关系</h4><p>用纸条或细绳绕一圈，标记交叠处，再用直尺量长度。</p></div></div><div class="info-row"><span>03</span><div><h4>直接填写测量值</h4><p>先填写实际手围，再选择佩戴感。页面会为你预留相应余量。</p></div></div></div>';
    if (type === 'care') return '<div class="info-content"><h3>一点照顾，一份长久。</h3><div class="info-row"><span>01</span><div><h4>少沾水，保持干燥</h4><p>洗手、洗澡和运动大量出汗前，先取下合香珠。沾水后用柔软干布轻拭，自然阴干。</p></div></div><div class="info-row"><span>02</span><div><h4>远离浓烈的其他气味</h4><p>避免接触香水、酒精、洗涤剂和油脂，让原本的香韵自然呈现。</p></div></div><div class="info-row"><span>03</span><div><h4>不佩戴时，妥善收纳</h4><p>放在干燥、通风、避光处，使用独立收纳袋，轻拿轻放。</p></div></div></div>';
    return '<div class="info-content"><p class="eyebrow">HEXIANG ATELIER</p><h3>一珠一香方，<br>一串一个你。</h3><p>合香，是把草木的气息，凝成可以随身相伴的一颗珠。我们希望让选择香气这件事，回到简单而自然的心意。</p><div class="info-row"><span>香</span><div><h4>先寻一味喜欢的香</h4><p>从木香、花香、草本与果香中，寻找与你相契的气息。</p></div></div><div class="info-row"><span>形</span><div><h4>再选一种自在的模样</h4><p>单圈的简洁、双圈的层次，或一串沉静的长珠，由你决定。</p></div></div><div class="info-row"><span>你</span><div><h4>让每一处，都贴近自己</h4><p>从手围到珠径，从佩戴感到颗数，慢慢完成属于你的定制方案。</p></div></div></div>';
  }
  function renderPage() {
    if (state.page === 'quiz') $('page-body').innerHTML = state.quizView === 'result' ? resultMarkup() : state.quizView === 'intro' ? quizIntroMarkup() : quizQuestionMarkup();
    else if (state.page === 'orders') $('page-body').innerHTML = ordersMarkup();
    else if (state.page === 'favorites') $('page-body').innerHTML = favoritesMarkup();
    else $('page-body').innerHTML = infoMarkup(state.page);
  }

  /* ---------------- orchestration ---------------- */
  function render() {
    document.body.classList.toggle('page-open', !!state.page);
    $('tab-home').hidden = state.page ? true : state.tab !== 'home';
    $('tab-customize').hidden = state.page ? true : state.tab !== 'customize';
    $('tab-mine').hidden = state.page ? true : state.tab !== 'mine';
    $('page-view').hidden = !state.page;
    renderHeader(); renderTabBar();
    if (state.tab === 'home') renderHome();
    if (state.tab === 'mine') renderMine();
    renderRecipes(); renderFit(); renderSpecs(); renderStyles(); renderSummary(); renderFlow();
    if (state.page) renderPage();
  }
  function renderFlow() {
    const r = recipe(), s = style(), n = state.activeStep, allowed = availableStep();
    document.querySelectorAll('[data-section]').forEach(section => { section.hidden = Number(section.dataset.section) !== n; });
    document.querySelectorAll('.step').forEach(b => {
      const number = Number(b.dataset.step), done = number === 1 ? !!r : number === 2 ? state.plan.wristConfirmed : number === 3 ? !!s : false, active = number === n;
      b.classList.toggle('active', active); b.classList.toggle('completed', done); b.disabled = number > allowed;
      b.querySelector('.step-number').innerHTML = done ? icon('check') : number;
      b.querySelector('small').textContent = active ? '当前步骤' : done ? (number === 2 ? '已确认' : '已选择') : number === 4 && allowed === 4 ? '待提交' : '待完成';
      b.setAttribute('aria-label', '第' + number + '步，' + stepNames[number] + '，' + (active ? '当前步骤' : done ? '已完成' : '待完成'));
      if (active) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    $('cta-1').disabled = !r;
    $('cta-3').disabled = !s;
  }

  /* ---------------- actions ---------------- */
  function selectRecipe(id, goNext = false) { const r = D.recipes.find(r => r.id === id); if (!r) return; state.plan.recipeId = id; state.resumeStep = 2; persist(); if (dialog.open) closeModal(); if (goNext) goTab('customize', 2); else render(); toast('已选用「' + r.name + '」'); }
  function selectStyle(id, goNext = false) {
    const s = D.styles.find(s => s.id === id); if (!s) return; const previous = state.plan.diameter;
    state.plan.styleId = id; if (!s.allowed.includes(state.plan.diameter)) state.plan.diameter = s.allowed[0]; state.plan.autoQuantity = true; state.plan.quantity = estimatedQuantity();
    state.resumeStep = recipe() ? 4 : 3; persist();
    if (dialog.open) closeModal();
    if (goNext) goTab('customize', recipe() ? 4 : 1); else render();
    toast('已选定「' + s.name + '」' + (previous !== state.plan.diameter ? '，珠径已适配为 ' + state.plan.diameter + ' mm' : ''));
  }
  function updateFit(wrist, fitId) { if (wrist != null) state.plan.wrist = Math.min(22, Math.max(13, Math.round(Number(wrist) * 2) / 2)); if (fitId) state.plan.fit = fitId; state.plan.wristConfirmed = false; state.plan.autoQuantity = true; state.plan.quantity = estimatedQuantity(); persist(); render(); }
  function toggleFavorite(id) { state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : state.favorites.concat(id); persist(); renderRecipes(); renderTabBar(); if (state.page === 'favorites') renderPage(); if (state.tab === 'mine') renderMine(); toast(state.favorites.includes(id) ? '已收藏这味香方' : '已取消收藏'); }

  function showRecipe(id, origin = 'catalog') {
    const r = D.recipes.find(r => r.id === id); if (!r) return;
    const body = '<img class="detail-image" src="' + r.image + '" alt="' + r.name + '合香珠参考图"><p class="detail-eyebrow">' + seriesName(r.series) + ' / ' + r.scent + '</p><div class="detail-title-row"><h3>' + r.name + '</h3><strong>¥ ' + r.price + '</strong></div><p class="detail-description">' + r.description + '</p><dl class="detail-specs"><div><dt>香调</dt><dd>' + r.notes + '</dd></div><div><dt>香材灵感</dt><dd>' + r.ingredients + '</dd></div><div><dt>推荐场景</dt><dd>' + r.scene + '</dd></div><div><dt>搭配方式</dt><dd>可与喜欢的款式组合定制</dd></div></dl><p class="detail-compatibility">图片用于款式与香韵展示，最终外观以你选定的造型和规格为准。</p>';
    const footer = '<button class="secondary-button" data-action="' + (origin === 'result' ? 'page-back' : 'favorite') + '" data-id="' + id + '">' + (origin === 'result' ? '返回结果' : state.favorites.includes(id) ? '已收藏' : '收藏香方') + '</button><button class="primary-button" data-action="use-recipe" data-id="' + id + '">选用这味香方 <span>→</span></button>';
    showModal('recipe', sheet('一味合心的香', body, footer), { id, origin });
  }
  function showStyle(id) {
    const s = D.styles.find(s => s.id === id); if (!s) return;
    const body = '<img class="detail-image" src="' + s.image + '" alt="' + s.name + '款式大图"><p class="detail-eyebrow">' + categoryName(s.category) + ' / HANDCRAFTED</p><div class="detail-title-row"><h3>' + s.name + '</h3><strong>' + (s.extra ? '+¥ ' + s.extra : '基础款') + '</strong></div><p class="detail-description">' + s.description + '。让喜欢的香气，融入属于你的形状。</p><dl class="detail-specs"><div><dt>适配珠径</dt><dd>' + s.allowed.join(' / ') + ' mm</dd></div><div><dt>颗数</dt><dd>' + (s.fixed ? s.fixed + ' 颗固定' : s.rings + ' 圈，按手围估算') + '</dd></div><div><dt>已选香方</dt><dd>' + (recipe() ? recipe().name : '尚未选择，可稍后选香方') + '</dd></div></dl><p class="detail-compatibility">' + (s.allowed.length === 1 ? '选用此款后，珠径将设为 ' + s.allowed[0] + ' mm。' : '可按手围与喜欢的珠径调整。') + (s.fixed ? '此系列固定 ' + s.fixed + ' 颗。' : '') + '</p>';
    showModal('style', sheet('款式细节', body, '<button class="primary-button" data-action="use-style" data-id="' + id + '">' + (state.plan.styleId === id ? '确认此款，查看方案' : '选用此款，查看方案') + ' <span>→</span></button>'), { id });
  }
  function answerQuestion(value, button) {
    if (answerLocked) return; answerLocked = true; const index = state.quiz.index; state.quiz.answers[index] = value;
    button.classList.add('selected'); $('page-body').querySelectorAll('[data-action="answer"]').forEach(b => b.disabled = true);
    if (index < 29) state.quiz.index = index + 1; else state.quiz.complete = true; persist();
    quizTimer = setTimeout(() => {
      if (state.page !== 'quiz' || modalType === 'recipe') return;
      if (state.quiz.complete) { state.quizView = 'result'; renderPage(); renderHome(); renderMine(); } else { renderPage(); }
      if (window.scrollY > 24) window.scrollTo({ top: 0, behavior: 'instant' });
      requestAnimationFrame(() => { const f = $('page-body').querySelector('[data-page-focus]'); if (f) f.focus({ preventScroll: true }); });
    }, 190);
  }
  function calculateResult() {
    const totals = {}; D.questions.forEach((q, i) => { if (!q.dimension) return; if (!totals[q.dimension]) totals[q.dimension] = { sum: 0, count: 0 }; const value = state.quiz.answers[i] || 3; totals[q.dimension].sum += q.inverse ? 6 - value : value; totals[q.dimension].count++; });
    const ranked = Object.entries(totals).map(([key, x]) => ({ key, value: x.sum / x.count })).sort((a, b) => b.value - a.value);
    const key = ranked.length && ranked[0].value >= 3.5 ? ranked[0].key : 'balanced';
    const preferred = D.questions.filter(q => q.scent).map(q => ({ scent: q.scent, value: state.quiz.answers[q.id] || 3 })).sort((a, b) => b.value - a.value)[0].scent;
    const profile = D.profiles[key], primary = D.recipes.find(r => r.name === profile.recipe), secondary = D.recipes.find(r => r.series === 'natural' && r.scent === preferred) || D.recipes.find(r => r.name === '白檀');
    return { profile, primary, secondary, preferred };
  }

  function orderText(o) { return ['香慧 · 合香珠定制申请', '申请编号：' + o.id, '香方：' + o.recipeName, '款式：' + o.styleName, '手围：' + (o.fixed ? '长串 / 手持' : Number(o.wrist).toFixed(1) + ' cm'), '佩戴感：' + o.fitName, '珠径：' + o.diameter + ' mm', '颗数：' + o.quantity + ' 颗', '预计价格：¥ ' + o.price, '称呼：' + o.name, '手机号：' + o.phone, '备注：' + (o.note || '无'), '创建时间：' + o.date, '体验申请仅保存在当前浏览器，不产生真实付款。'].join('\n'); }
  function showOrder(o, success = false) {
    const content = '<div class="order-success">' + (success ? '<div class="success-icon">' + icon('check') + '</div>' : '') + '<h3>' + (success ? '心意，已为你记下' : '你的专属定制申请') + '</h3><p>' + (success ? '这一串的香与形，已保存为定制申请。<br>你可以复制方案，或随时回来查看。' : '申请保存在当前浏览器，可复制或下载留存。') + '</p><div class="order-number">' + esc(o.id) + ' · ' + esc(o.date) + '</div><div class="success-plan"><div><span>香方</span><strong>' + esc(o.recipeName) + '</strong></div><div><span>款式</span><strong>' + esc(o.styleName) + '</strong></div><div><span>规格</span><strong>' + esc(o.diameter) + ' mm · ' + esc(o.quantity) + ' 颗</strong></div><div><span>手围 / 佩戴感</span><strong>' + (o.fixed ? '长串 / 手持' : esc(Number(o.wrist).toFixed(1)) + ' cm · ' + esc(o.fitName)) + '</strong></div><div><span>参考价格</span><strong>¥ ' + esc(o.price) + '</strong></div><div><span>联系信息</span><strong>' + esc(o.name) + ' · ' + esc(o.phone) + '</strong></div>' + (o.note ? '<p>备注：' + esc(o.note) + '</p>' : '') + '</div><button class="primary-button" data-action="copy-order" data-id="' + esc(o.id) + '">复制定制方案 <span>↗</span></button><button class="secondary-button" data-action="download-order" data-id="' + esc(o.id) + '">下载方案文本</button><button class="text-button center" style="margin-top:17px" data-action="orders">查看我的申请 →</button><p style="font-size:12px;margin-top:15px">体验申请不会发给商家，也不会产生付款。</p></div>';
    showModal(success ? 'success' : 'order-detail', sheet(success ? '定制申请已保存' : '定制申请详情', content), o);
  }
  function submitOrder(event) {
    if (event) event.preventDefault(); if (submitting) return;
    $('form-error').hidden = true; const r = recipe(), s = style();
    if (!r) { toast('先选一味合心的香方'); jump(1); return; } if (!state.plan.wristConfirmed) { toast('请先确认手围与佩戴感'); jump(2); return; } if (!s) { toast('再选一款喜欢的造型'); jump(3); return; }
    const name = $('contact-name').value.trim(), phone = $('contact-phone').value.trim(), note = $('contact-note').value.trim();
    ['name', 'phone'].forEach(field => { $(field + '-error').hidden = true; $('contact-' + field).removeAttribute('aria-invalid'); });
    const invalidName = !name, invalidPhone = !/^1[3-9]\d{9}$/.test(phone);
    if (invalidName || invalidPhone) {
      if (invalidName) { $('name-error').textContent = '请留下你的称呼。'; $('name-error').hidden = false; $('contact-name').setAttribute('aria-invalid', 'true'); }
      if (invalidPhone) { $('phone-error').textContent = '请填写正确的11位手机号。'; $('phone-error').hidden = false; $('contact-phone').setAttribute('aria-invalid', 'true'); }
      $('form-error').textContent = '请完善上方标记的联系信息。'; $('form-error').hidden = false; jump(4);
      const field = $(invalidName ? 'contact-name' : 'contact-phone'); requestAnimationFrame(() => { field.scrollIntoView({ block: 'center', behavior: 'instant' }); field.focus({ preventScroll: true }); }); return;
    }
    if (!s.allowed.includes(state.plan.diameter) || (s.fixed && state.plan.quantity !== s.fixed)) { toast('规格需要与款式一致，请重新选定款式'); jump(3); return; }
    submitting = true; const now = new Date(); const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const id = 'XH' + String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + now.getTime().toString(36).slice(-5).toUpperCase();
    const o = { id, date, recipeId: r.id, styleId: s.id, recipeName: r.name, styleName: s.name, wrist: state.plan.wrist, fit: state.plan.fit, fitName: fit().name, diameter: state.plan.diameter, quantity: state.plan.quantity, fixed: s.fixed, price: price(), name, phone, note };
    state.orders.unshift(o); state.orders = state.orders.slice(0, 40); const saved = persist(); renderTabBar(); showOrder(o, true); submitting = false; if (!saved) toast('浏览器未允许持久保存，请复制或下载方案留存');
  }
  async function copyOrder(o) {
    const text = orderText(o);
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); toast('定制方案已复制'); return; } } catch (_) {}
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0'; (dialog.open ? dialog : document.body).appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} ta.remove();
    if (ok) { toast('定制方案已复制'); return; }
    showModal('copy', sheet('复制你的定制方案', '<p class="copy-note">请选择下方文本并复制，也可以下载方案留存。</p><textarea class="copy-area" id="manual-copy" readonly>' + esc(text) + '</textarea>', '<button class="primary-button" data-action="download-order" data-id="' + esc(o.id) + '">下载方案文本 <span>↗</span></button>')); $('manual-copy').select();
  }
  function downloadOrder(o) { const blob = new Blob(['\ufeff' + orderText(o)], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = o.id + '-定制方案.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('方案文本已开始下载'); }

  /* ---------------- events ---------------- */
  document.addEventListener('click', event => {
    const b = event.target.closest('[data-action]'); if (!b || b.disabled) return; const action = b.dataset.action, id = b.dataset.id, value = Number(b.dataset.value);
    if (action === 'tab') { if (state.tab !== id || state.page) goTab(id); return; }
    if (action === 'page') { openPage(id); return; }
    if (action === 'page-back') { if (dialog.open) closeModal(); else closePage(); return; }
    if (action === 'start') { goTab('customize'); return; }
    if (action === 'open-quiz') { openQuiz(); return; }
    if (action === 'jump') { jump(Number(b.dataset.step)); return; }
    if (action === 'prev') { if (state.activeStep <= 1) goTab('home'); else jump(state.activeStep - 1); return; }
    if (action === 'next') { advance(); return; }
    if (action === 'spec') { const target = $('spec-title'); target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); return; }
    if (action === 'series') { state.series = id; state.query = ''; $('recipe-search').value = ''; state.recipeExpanded = false; renderRecipes(); return; }
    if (action === 'scent') { state.scent = id; state.recipeExpanded = false; renderRecipes(); return; }
    if (action === 'clear-search' || action === 'reset-search') { state.query = ''; state.scent = '全部'; $('recipe-search').value = ''; state.recipeExpanded = false; renderRecipes(); if (action === 'clear-search') $('recipe-search').focus(); return; }
    if (action === 'more-recipes') { state.recipeExpanded = !state.recipeExpanded; renderRecipes(); return; }
    if (action === 'favorite') { toggleFavorite(id); if (dialog.open && modalType === 'recipe') showRecipe(id, modalData.origin); return; }
    if (action === 'recipe-detail') { showRecipe(id); return; }
    if (action === 'select-recipe') { selectRecipe(id); return; }
    if (action === 'use-recipe') { selectRecipe(id, true); return; }
    if (action === 'style-category') { state.styleCategory = id; state.styleExpanded = false; renderStyles(); return; }
    if (action === 'more-styles') { state.styleExpanded = !state.styleExpanded; renderStyles(); return; }
    if (action === 'style-detail') { showStyle(id); return; }
    if (action === 'select-style') { selectStyle(id); return; }
    if (action === 'use-style') { selectStyle(id, true); return; }
    if (action === 'wrist-preset') { updateFit(value); return; }
    if (action === 'wrist-down' || action === 'wrist-up') { updateFit(state.plan.wrist + (action === 'wrist-up' ? .5 : -.5)); return; }
    if (action === 'fit') { updateFit(null, id); return; }
    if (action === 'diameter') { if (style() && !style().allowed.includes(value)) return; state.plan.diameter = value; state.plan.autoQuantity = true; state.plan.quantity = estimatedQuantity(); persist(); render(); return; }
    if (action === 'quantity-down' || action === 'quantity-up') { if (style() && style().fixed) return; state.plan.quantity = Math.min(150, Math.max(8, state.plan.quantity + (action === 'quantity-up' ? 1 : -1))); state.plan.autoQuantity = false; persist(); render(); return; }
    if (action === 'close') { closeModal(); return; }
    if (action === 'quiz-start') { state.quiz.index = 0; state.quizView = 'question'; renderPage(); return; }
    if (action === 'quiz-continue') { state.quizView = 'question'; renderPage(); return; }
    if (action === 'quiz-restart') { clearTimeout(quizTimer); state.quiz = { answers: D.questions.map(() => null), index: 0, complete: false }; state.quizView = 'question'; persist(); render(); return; }
    if (action === 'quiz-back') { if (state.quiz.index > 0) { clearTimeout(quizTimer); state.quiz.index--; persist(); renderPage(); } return; }
    if (action === 'answer') { answerQuestion(value, b); return; }
    if (action === 'result-recipe-detail') { showRecipe(id, 'result'); return; }
    if (action === 'result-browse') { goTab('customize', 1); return; }
    if (action === 'measure' || action === 'about' || action === 'care') { openPage(action); return; }
    if (action === 'orders') { if (dialog.open) closeModal(); openPage('orders'); return; }
    if (action === 'order-detail') { const o = state.orders.find(o => o.id === id); if (o) showOrder(o); return; }
    if (action === 'copy-order') { const o = state.orders.find(o => o.id === id); if (o) copyOrder(o); return; }
    if (action === 'download-order') { const o = state.orders.find(o => o.id === id); if (o) downloadOrder(o); return; }
    if (action === 'reuse-order') {
      const o = state.orders.find(o => o.id === id); if (!o) return; Object.assign(state.plan, { recipeId: o.recipeId, styleId: o.styleId, wrist: o.wrist, fit: o.fit, diameter: o.diameter, quantity: o.quantity, autoQuantity: false, wristConfirmed: true }); state.series = recipe().series; state.styleCategory = style().category; state.resumeStep = 4; persist(); goTab('customize', 4); toast('已带入原方案，可以继续调整'); return;
    }
    if (action === 'reset-plan') {
      Object.assign(state.plan, defaults()); state.series = 'premium'; state.styleCategory = 'single'; state.scent = '全部'; state.query = ''; state.recipeExpanded = false; state.styleExpanded = false; $('recipe-search').value = ''; $('form-error').hidden = true; ['name', 'phone'].forEach(field => { $(field + '-error').hidden = true; $('contact-' + field).removeAttribute('aria-invalid'); }); state.resumeStep = 1; persist(); render(); jump(1); toast('已开启新的搭配，申请记录仍保留');
    }
  });
  $('recipe-search').addEventListener('input', event => { state.query = event.target.value; state.recipeExpanded = false; renderRecipes(); });
  $('wrist-range').addEventListener('input', event => updateFit(event.target.value));
  $('order-form').addEventListener('submit', submitOrder);
  $('contact-phone').addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 11); $('form-error').hidden = true; $('phone-error').hidden = true; event.target.removeAttribute('aria-invalid'); });
  $('contact-name').addEventListener('input', event => { $('form-error').hidden = true; $('name-error').hidden = true; event.target.removeAttribute('aria-invalid'); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) closeModal(); });

  if (state.activeStep > availableStep()) state.activeStep = availableStep();
  render(); persist();
})();
