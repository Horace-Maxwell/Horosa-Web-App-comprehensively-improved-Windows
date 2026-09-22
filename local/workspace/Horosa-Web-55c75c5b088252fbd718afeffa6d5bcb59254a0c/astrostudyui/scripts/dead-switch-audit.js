/* eslint-disable */
/**
 * 死开关运行时审计器 —— 粘进 dev 页面控制台即用(不参与打包,不被 umi 引用)。
 *
 * 为什么要运行时而不是纯静态分析:
 *   本仓的死开关病史里,静态分析与单元测试反复给出假绿——「引擎算得对/哨兵还守着,
 *   但数据被组包或渲染旁路、或选项间根本无差异」。只有真点一下、再比对盘面与右栏的
 *   实际 DOM,才能证明用户看得见变化。审计范围也不能只盯左栏:右栏控件、齿轮弹层、
 *   顶栏快捷开关同样会死。
 *
 * 🔴 三条使用铁律(全是踩过的坑,别省):
 *   ① 先自证:拿一个**已知有效**的开关跑一遍,必须报「有反应」。指纹范围不对时
 *      审计器会把整页开关全报成死的(实测:指纹漏了可见性过滤 → 14 个全假报)。
 *   ② 面板按 aria-controls 关联:antd 的 dropdown 是 portal 复用的,取「最后一个打开的
 *      dropdown」会点到别的 select 的面板上——不仅结论错,还会把参数改乱且无法复原。
 *   ③ 用 runAcrossTabs() 而非 run():改动不一定落在当前画面上(用户 2026-07-31 点出)。
 *      两层坑叠在一起:子 tab 惰性挂载(没点开过就不在 DOM),且**隐藏的 tab 不随开关重算**
 *      (内容冻在挂载那一刻)。所以只 mountAllTabs 仍不够,必须让每个页签轮流激活后各取一次样。
 *      实测:卜卦盘 29 控件「只看当前页」报 0 死开关、「挂载后仍只看当前页」反报 13 个无反应,
 *      两个数都不可信 —— 只有跨页签取样才作数。
 *   ④ 跑完核对复原:未复原项会污染后续每一项的基线。收起态可能显示 optionLabelProp
 *      短名(见 src/utils/shortOptionLabel.js),比对与复原都必须剥括号后比。
 *      ⚠ 更要命的是**跨轮次**的脏状态:审计器会把一批开关挨个关掉,若中途中止(超时/报错/abort),
 *      页面就停在「全关」态。之后你看到的空白盘面会被误读成新 bug —— 实测被神煞四组全关的
 *      残留骗过一次。每轮开跑前先 dumpState()、结束或中止后核对,别靠肉眼。
 *
 * v2(2026-09-14,全站选项五证网 N3(c)):
 *   · 控件种类从 6 类扩到:checkbox / switch / select(含多选)/ radio(组级;XQSegmented 也是 Radio.Group)/ chip / toggle /
 *     number(InputNumber)/ slider / date|time(antd 选择框)/ quicktime(时间字段触发点)/ text(只探登记了替代值的字段)/
 *     native-toggle(button[aria-pressed]、button.is-active)/ native-range / native-select / native-checkbox / native-radio。
 *     动作/页签类只登记(dumpControls)不拨。
 *   · 互斥组(radio / segmented)的复原=点回**原选中项**(铁律 14),不是再点一次。
 *   · 指纹再剔除「被测控件自身」(中栏控件否则每个都「有反应」);setProfile 可换指纹容器/左栏/等待档;
 *     画布页可挂 canvasHash 钩(宿主用截图 sha1 补指纹)。
 *   · dumpControls():把运行时真看见的控件(种类/标签/键/所在面板与页签/当前值/可达)机读导出 = 选项宇宙产地③。
 *   · 控制台用法零变(install/goto/expandAll/selfTest/run/report/runAcrossTabs/runPopovers/dumpState/diffState/mountAllTabs)。
 *
 * 用法:
 *   HDS.install();
 *   await HDS.goto('卜卦盘', '判读参数');     // 切页并核对身份(rail 项在辅盘内才有)
 *   await HDS.expandAll();                    // 折叠区宽高为 0 会被可见性过滤掉
 *   await HDS.selfTest('界限环');             // ① 自证:必须返回 true
 *   HDS.run('.horosa-horary-param-grid');     // 后台跑,避开控制台单次执行时限
 *   HDS.report();                             // 轮询取结果
 */
(function (root) {
	var HDS = { version: 2 };
	var HDS_hittable;

	function hash(s) {
		s = String(s || '');
		var a = 5381;
		for (var i = 0; i < s.length; i++) { a = ((a << 5) + a + s.charCodeAt(i)) | 0; }
		return a + '/' + s.length;
	}
	// 结构指纹归一:每次渲染现取的随机 id(SVG 箭头 / 宫格 clipPath 的 id 与 url(#…)、marker-end,antd 页签 / 下拉的 aria-controls 等)
	// 不进指纹 —— 否则任何触发重绘的控件都「有反应」(紫微 51/52、策天 17/17、金口诀 15/16 全是随机 id 换了、文本一字未变实抓)
	function normHtml(h) {
		return String(h || '')
			.replace(/\s(?:id|for|aria-controls|aria-owns|aria-activedescendant|aria-describedby|aria-labelledby|aria-details|aria-errormessage)="[^"]*"/g, '')
			.replace(/url\(\s*['"]?#[^)'"]*['"]?\s*\)/g, 'url(#)')
			.replace(/\s(xlink:href|href)="#[^"]*"/g, ' $1="#"');
	}
	function isVis(e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
	function vis(sel) {
		return [].slice.call(document.querySelectorAll(sel)).filter(function (e) { return e.getBoundingClientRect().width > 0; });
	}
	function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
	function txt(e) { return ((e && (e.innerText !== undefined ? e.innerText : e.textContent)) || '').trim(); }

	// 指纹取**可见的**盘面网格全量:右栏判读正文并不都在 .horosa-inspector-panel 内,
	// 只取 panel 会漏掉判读容器 → 一堆真开关被误判成死的(实测 10 个)。
	// 指纹取「可见主内容区,但**剔除左栏自身**」。
	//   · 不剔左栏 → 勾选态自己就会改 DOM,每个开关都「有反应」,审计等于没做。
	//   · 只认 .horosa-astro-redesign-grid → 只适用于西洋盘族;紫微/八字/六壬等各有各的容器,
	//     一律返回 '-' 而恒等,于是整页开关被误判成死的。故改为按一组候选容器兜底。
	//   · v2:再兜底 #mainContent(全站 30 页共有的主内容宿主),并剔除被测控件自身。
	var PROFILE = {
		mainSel: '.horosa-astro-redesign-grid, .horosa-ziwei-redesign-grid, .horosa-workspace-main, .ant-layout-content, #mainContent',
		leftSel: '.horosa-astro-input-panel, .horosa-astro-context-panel, .horosa-ziwei-input-panel, .horosa-side-input-section, .xq-side-section',
		stageSel: '.horosa-chart-stage, [class*="chart-stage"], [class*="chart-viewport"]',
		controlsSel: '.horosa-astro-input-panel, .horosa-astro-context-panel, .horosa-ziwei-input-panel, .horosa-side-input-section, .xq-side-section, .horosa-inspector-panel',
		tabScope: '.horosa-inspector-panel, .horosa-chart-stage',
		waitMs: 700,
		canvas: false,
		commitText: null,
		settleMaxMs: 8000,    // settle 时等 .ant-spin-spinning 消失的最长毫秒     // 「拨完要按一下才生效」的页(如带「重 算」钮的页):每次拨值/复原后点这个按钮再取指纹(按钮文本去空白比对)
		canvasHash: null,      // 宿主暴露的全局函数名(如 Playwright expose_function),返回画布区截图哈希
	};
	HDS.setProfile = function (p) { Object.keys(p || {}).forEach(function (k) { if (p[k] !== undefined && p[k] !== null) { PROFILE[k] = p[k]; } }); return PROFILE; };
	HDS.profile = function () { return PROFILE; };
	// 自由文本字段的有意义替代值(垃圾值被消费方忽略=假死):按 键名 或 标签片段 匹配
	var TEXT_ALT = { indiaVargaSet: '1,9', liunianSel: '2024', 流年: '2024', seed: '12345', 种子: '12345', 问题: '审计问句', question: '审计问句', 名: '审计', name: '审计', '人物 · 术数': '京房', 所占何事: '审计问事', 问事: '审计问事', 占事: '审计问事' };
	HDS.setTextAlt = function (m) { Object.keys(m || {}).forEach(function (k) { TEXT_ALT[k] = m[k]; }); return TEXT_ALT; };

	// 🔴 可交互命中测试。ant-popover-hidden 与 opacity 都不足以判定面板是否真能点:
	//    实测四个设置面板同时「未 hidden 且 opacity=1」,但只有一个在最顶层。
	//    若不做命中测试,另外三个面板里的控件会被点了个空 → 整批误判成死开关(27 个假报)。
	function hittable(el) {
		var r = el.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) { return false; }
		if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) { return false; }
		var x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
		var y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
		var top = document.elementFromPoint(x, y);
		if (!top) { return false; }
		if (top === el || el.contains(top) || top.contains(el)) { return true; }
		// 命中到已关闭 Modal 的 wrap 空壳时:它不拦真实点击(内容早已卸载),不该判为不可达。
		if (top.classList && top.classList.contains('ant-modal-wrap') && !modalOpen(top)) { return true; }
		return false;
	}
	HDS_hittable = hittable;

	// 收起态短名:剥「末尾一段平衡括号」(全/半角,支持嵌套)。
	// 比 src/utils/shortOptionLabel.js 的正则多认嵌套:择日「随流派（Dorotheus 三主（含共主））」这类选项
	// 收起态显示 optionLabelProp="随流派",旧正则剥不动嵌套括号 → 复原时找不到「随流派」选项 = 假「未复原」。
	function shortOf(s) {
		s = String(s == null ? '' : s).trim();
		var last = s.charAt(s.length - 1);
		if (last !== '）' && last !== ')') { return s; }
		var depth = 0;
		for (var i = s.length - 1; i >= 0; i--) {
			var ch = s.charAt(i);
			if (ch === '）' || ch === ')') { depth++; }
			else if (ch === '（' || ch === '(') { depth--; if (depth === 0) { var head = s.slice(0, i).trim(); return head || s; } }
		}
		return s;
	}
	function sameOption(a, b) {
		a = String(a || '').trim(); b = String(b || '').trim();
		if (a === b || shortOf(a) === shortOf(b) || shortOf(a) === b || a === shortOf(b)) { return true; }
		// 数值输入回读按数值等价(七政「盘面显示筛选」弹窗实抓:拨 11 回读「11.0」被判「选错」,七个容许度全成假选错)
		if (a !== '' && b !== '' && /^[-+]?\d*\.?\d+$/.test(a) && /^[-+]?\d*\.?\d+$/.test(b)) { return Number(a) === Number(b); }
		return false;
	}

	function setNative(input, v) {
		var proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
		var d = Object.getOwnPropertyDescriptor(proto, 'value');
		if (d && d.set) { d.set.call(input, v); } else { input.value = v; }
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}
	// 原生输入的替代值:数字 ±step(越界反向)/ 日期 +1 天 / 时间 +1 小时 / 日期时间 +1 天 / 颜色换一个
	function nativeAlt(el, kind, tryIdx) {
		var v = String(el.value || ''); tryIdx = tryIdx || 0;
		var pad = function (n) { return String(n).padStart(2, '0'); };
		if (kind === 'native-number') {
			var st = Number(el.step) || 1; var cur = v === '' ? (el.min !== '' ? Number(el.min) : 0) : Number(v);
			if (isNaN(cur)) { return null; }
			var alt = cur + st * (tryIdx + 1);
			if (el.max !== '' && alt > Number(el.max)) { alt = cur - st * (tryIdx + 1); }
			if (el.min !== '' && alt < Number(el.min)) { return null; }
			return String(Math.round(alt * 1e6) / 1e6);
		}
		if (kind === 'native-date' || kind === 'native-datetime') {
			var m = v.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/); if (!m) { return null; }
			var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); d.setUTCDate(d.getUTCDate() + 1 + tryIdx);
			return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + (m[4] || '');
		}
		if (kind === 'native-time') {
			var t = v.match(/^(\d{1,2}):(\d{2})(.*)$/); if (!t) { return null; }
			return pad((+t[1] + 1 + tryIdx) % 24) + ':' + t[2] + t[3];
		}
		if (kind === 'native-color') { return v.toLowerCase() === '#123456' ? '#654321' : '#123456'; }
		return null;
	}
	function key(el, k, code) { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, keyCode: code, which: code, bubbles: true, cancelable: true })); el.dispatchEvent(new KeyboardEvent('keyup', { key: k, keyCode: code, which: code, bubbles: true, cancelable: true })); }
	function mouse(el, type) { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); }
	async function settleAfter(ms) {
		await sleep(ms);
		var t0 = Date.now();
		var cap = PROFILE.settleMaxMs || 8000;   // 重算型页面(一次重算全部技法可达数十秒)由 profile 抬高上限
		var seen = 0;
		while (Date.now() - t0 < cap && vis('.ant-spin-spinning').length) { seen++; await sleep(150); }
		HDS.lastSettle = { spinSeen: seen > 0, waitedMs: Date.now() - t0 };   // 诊断:本次 settle 是否等到过加载态
		if (Date.now() - t0 >= 150) { await sleep(250); }
	}
	function clickEl(el) { try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) { /* 老内核 */ } mouse(el, 'mousedown'); mouse(el, 'mouseup'); el.click(); }

	// innerHTML 天然包含 display:none 的子树,所以**已挂载但不可见**的右栏 tab 也进指纹。
	// 但惰性 tab 若从未被点开就根本不在 DOM 里 —— 那部分要靠 mountAllTabs() 先撑起来。
	HDS.fp = function () {
		var g = vis(PROFILE.mainSel)[0];
		var st = vis(PROFILE.stageSel)[0];
		if (!g) { return { all: '-', stage: st ? hash(normHtml(st.innerHTML)) : '-' }; }
		// 行内 display:none 的整块(如三式合一右栏残留的隐藏旧控件块)不进指纹:里面的镜像控件随拨值变值/变禁用态 → 假「有反应」。
		// 只剔行内隐藏(style 属性),keep-alive 页签用 class 隐藏的内容照旧进指纹(跨页签判定靠它)。
		var hiddenLive = [].slice.call(g.querySelectorAll('[style*="display: none"], [style*="display:none"]'));
		hiddenLive.forEach(function (n) { n.setAttribute('data-hds-hidden', '1'); });
		var clone = g.cloneNode(true);
		hiddenLive.forEach(function (n) { n.removeAttribute('data-hds-hidden'); });
		clone.querySelectorAll(PROFILE.leftSel).forEach(function (n) { n.remove(); });
		clone.querySelectorAll('[data-hds-self], .hds-selftest-box, [data-hds-hidden]').forEach(function (n) { n.remove(); });
		return { all: hash(normHtml(clone.innerHTML)), stage: st ? hash(normHtml(st.innerHTML)) : '-', text: hash(clone.textContent) };
	};
	// v2:异步指纹 = 同步指纹 + 可选画布哈希(宿主钩)。run/selfTest 一律走它。
	// 画布哈希两种取法:① 页内全局函数 canvasHash(如 canvas.toDataURL 哈希);② 宿主握手 canvasHost=true —— 页面只登记一个请求
	//    (window.__hdsCanvasReq),宿主(Playwright 轮询)截图算哈希后写回 window.__hdsCanvasRes[id]。
	//    🔴 不能用 expose_binding 在回调里截图:同步 API 的回调不能再调页面方法(首跑某画布页整页挂死 40 分钟)。
	var canvasSeq = 0;
	HDS.fpx = async function () {
		var f = HDS.fp();
		if (PROFILE.canvas && PROFILE.canvasHash && typeof root[PROFILE.canvasHash] === 'function') {
			try { f.canvas = String(await root[PROFILE.canvasHash]()); } catch (e) { f.canvas = 'err'; }
		} else if (PROFILE.canvas && PROFILE.canvasHost) {
			var askHost = function () {
				var id = ++canvasSeq;
				root.__hdsCanvasReq = { id: id, at: Date.now() };
				return new Promise(function (res) {
					var t0 = Date.now();
					var poll = function () {
						var box = root.__hdsCanvasRes || {};
						if (box[id] !== undefined) { var v = box[id]; delete box[id]; res(String(v)); return; }
						if (Date.now() - t0 > 20000) { root.__hdsCanvasReq = null; res('timeout'); return; }
						setTimeout(poll, 40);
					};
					poll();
				});
			};
			// 稳定取样:连续两次同哈希才采信(画布异步重绘/过渡动画会让「拨值前」指纹停在上一行的中间态 → 假「有反应」)
			var prev = await askHost(); var tries = PROFILE.canvasStableTries || 4; var stable = false;
			for (var ti = 0; ti < tries; ti++) {
				await sleep(250);
				var cur = await askHost();
				if (cur === prev) { stable = true; break; }
				prev = cur;
			}
			f.canvas = prev; if (!stable) { f.canvasUnstable = true; }
		}
		return f;
	};
	// 非阻塞自证(画布页宿主握手需要事件循环空闲):结果落 HDS.selfTestOut,HDS.selfTestBusy 清零即完成
	HDS.selfTestStart = function (nameFragment, rootSel) {
		HDS.selfTestBusy = true; HDS.selfTestOut = null;
		HDS.selfTest(nameFragment, rootSel).then(function (r) { HDS.selfTestOut = r; HDS.selfTestBusy = false; }, function (e) { HDS.selfTestOut = { ok: false, why: String(e).slice(0, 80) }; HDS.selfTestBusy = false; });
		return 'selfTest started';
	};
	HDS.same = function (a, b) { return a.all === b.all && (a.canvas || '-') === (b.canvas || '-'); };
	function markSelf(el) { unmarkSelf(); if (el) { el.setAttribute('data-hds-self', '1'); } }
	function unmarkSelf() { document.querySelectorAll('[data-hds-self]').forEach(function (n) { n.removeAttribute('data-hds-self'); }); }

	// ── 控件发现 ──────────────────────────────────────────────────────────────
	function labelOf(el, inner) {
		var b = el.closest('.horosa-field-block');
		var l = b && b.querySelector('.horosa-field-label');
		if (l && txt(l)) { return txt(l); }
		var fi = el.closest('.ant-form-item');
		var fl = fi && fi.querySelector('.ant-form-item-label');
		if (fl && txt(fl)) { return txt(fl); }
		var lab = el.closest('label');
		if (lab && txt(lab)) { return txt(lab); }
		var a = el.getAttribute('aria-label') || el.getAttribute('title') || (inner && (inner.getAttribute('aria-label') || inner.getAttribute('placeholder') || inner.getAttribute('title')));
		if (a) { return a; }
		var own = txt(el);
		if (own) { return own; }
		var p = el.previousElementSibling; var n = 0;
		while (p && n < 3) { var t = txt(p); if (t && !p.querySelector('input,select,.ant-select,.ant-switch')) { return t; } p = p.previousElementSibling; n++; }
		var par = el.parentElement;
		if (par) { var first = [].slice.call(par.childNodes).filter(function (c) { return c.nodeType === 3 && c.textContent.trim(); })[0]; if (first) { return first.textContent.trim(); } var pt = txt(par); if (pt) { return pt; } }
		return '';
	}
	function keyOf(el, inner) {
		var cand = ['data-option', 'data-field', 'data-key', 'data-setting', 'data-ai-tech-field', 'name', 'id'];
		for (var i = 0; i < cand.length; i++) {
			var v = el.getAttribute(cand[i]) || (inner && inner.getAttribute(cand[i]));
			if (v && !/^rc_select_|^rc-|^ant-|^[0-9]+$/.test(v)) { return v; }
		}
		return null;
	}
	// 上下文路径:弹层 / 抽屉 / 弹窗 / 折叠区 / 页签 —— 定位控件「在哪个面板哪个页签」
	function contextOf(el) {
		var parts = [];
		var n = el;
		while (n && n !== document.body) {
			var c = n.classList || { contains: function () { return false; } };
			if (c.contains('ant-popover')) { var pt = n.querySelector('.ant-popover-title'); parts.unshift('popover:' + (pt ? txt(pt) : txt(n).split('\n')[0]).slice(0, 30)); }
			else if (c.contains('ant-drawer')) { var dt = n.querySelector('.ant-drawer-title'); parts.unshift('drawer:' + (dt ? txt(dt) : '').slice(0, 30)); }
			else if (c.contains('ant-modal')) { var mt = n.querySelector('.ant-modal-title'); parts.unshift('modal:' + (mt ? txt(mt) : '').slice(0, 30)); }
			else if (c.contains('xq-side-section')) { var st = n.querySelector('.xq-side-section-title'); parts.unshift('section:' + (st ? txt(st) : '').slice(0, 30)); }
			else if (c.contains('ant-collapse-item')) { var ch = n.querySelector('.ant-collapse-header'); parts.unshift('collapse:' + (ch ? txt(ch) : '').slice(0, 30)); }
			else if (c.contains('ant-tabs-tabpane')) { var lb = n.getAttribute('aria-labelledby'); var te = lb && document.getElementById(lb); parts.unshift('tab:' + (te ? txt(te) : '').slice(0, 30)); }
			else if (c.contains('ant-card')) { var ct = n.querySelector('.ant-card-head-title'); if (ct) { parts.unshift('card:' + txt(ct).slice(0, 30)); } }
			n = n.parentElement;
		}
		return parts.join(' > ');
	}
	var SWITCHABLE = ['checkbox', 'switch', 'select', 'radio', 'chip', 'toggle', 'number', 'slider', 'date', 'time', 'quicktime', 'text', 'native-toggle', 'native-range', 'native-select', 'native-checkbox', 'native-radio', 'native-number', 'native-date', 'native-time', 'native-datetime', 'native-color'];
	HDS.SWITCHABLE = SWITCHABLE;
	function push(out, seen, kind, el, inner, extra) {
		if (!el || seen.has(el)) { return; }
		if (el.closest('[data-hds-ignore]')) { return; }
		// 🔴 只收可见控件:根容器(尤其 #mainContent)里躺着 keep-alive 的其它页面 DOM(display:none),
		//    不过滤会把「占星/星运」的控件算进「黄历/天文馆」页 —— 折叠区内的控件也是 0 高,所以先 expandAll 再扫。
		if (!isVis(el)) { return; }
		seen.add(el);
		var c = { kind: kind, el: el, inner: inner || null, name: (labelOf(el, inner) || '').split('\n')[0].trim().slice(0, 40), key: keyOf(el, inner), ctx: contextOf(el) };
		if (extra) { Object.keys(extra).forEach(function (k) { c[k] = extra[k]; }); }
		out.push(c);
	}
	HDS.controls = function (rootSel) {
		var out = []; var seen = new Set();
		var roots = vis(rootSel || PROFILE.controlsSel);
		// 嵌套根去重:外层根已包含内层根时跳过内层
		roots = roots.filter(function (r) { return !roots.some(function (o) { return o !== r && o.contains(r); }); });
		roots.forEach(function (r) {
			r.querySelectorAll('input[type=checkbox]').forEach(function (el) {
				var w = el.closest('.ant-checkbox-wrapper');
				if (w) { push(out, seen, 'checkbox', w, el); } else if (!el.closest('.ant-switch')) { push(out, seen, 'native-checkbox', el, el); }
			});
			r.querySelectorAll('.ant-switch').forEach(function (el) { push(out, seen, 'switch', el, null); });
			r.querySelectorAll('.ant-select').forEach(function (el) { push(out, seen, 'select', el, el.querySelector('input'), { multiple: el.classList.contains('ant-select-multiple') }); });
			r.querySelectorAll('.ant-radio-group').forEach(function (el) {
				var items = [].slice.call(el.querySelectorAll('.ant-radio-button-wrapper, .ant-radio-wrapper')).filter(isVis);
				if (items.length) { push(out, seen, 'radio', el, null, { items: items, segmented: el.classList.contains('xq-segmented'), 取值数: items.length }); items.forEach(function (i) { seen.add(i); }); }
			});
			r.querySelectorAll('.ant-radio-button-wrapper, .ant-radio-wrapper').forEach(function (el) { if (!seen.has(el) && !el.closest('.ant-radio-group')) { push(out, seen, 'radio', el.parentElement || el, null, { items: [el], 取值数: 1 }); } });
			// 🔴 自研控件必须单列:左栏四个入口按钮弹出的设置面板里,开关根本不是 antd 的
			//    input[type=checkbox],而是 .xq-check-item / .xq-toggle 这类自研芯片。
			//    只扫 antd 选择器 = 整个弹层被当成「0 个控件」而静默跳过 —— 死开关最容易藏的就是这里。
			r.querySelectorAll('.xq-check-item').forEach(function (el) { push(out, seen, 'chip', el, null); });
			r.querySelectorAll('.xq-toggle').forEach(function (el) { push(out, seen, 'toggle', el, null); });
			r.querySelectorAll('.ant-input-number').forEach(function (el) { push(out, seen, 'number', el, el.querySelector('input')); });
			r.querySelectorAll('.ant-slider').forEach(function (el) { push(out, seen, 'slider', el, el.querySelector('[role=slider]')); });
			r.querySelectorAll('.ant-picker').forEach(function (el) {
				var inp = el.querySelector('input'); var v = inp ? inp.value : '';
				push(out, seen, (/^\d{1,2}:\d{2}/.test(v) || el.classList.contains('xq-time-picker')) ? 'time' : 'date', el, inp, { range: el.classList.contains('ant-picker-range') });
			});
			r.querySelectorAll('[data-quick-time-trigger="1"]').forEach(function (el) { push(out, seen, 'quicktime', el, null); });
			r.querySelectorAll('input.ant-input, textarea.ant-input, input[type=text], input:not([type])').forEach(function (el) {
				if (el.closest('.ant-select, .ant-picker, .ant-input-number, .ant-pagination, .ant-table-filter-dropdown')) { return; }
				if (el.getAttribute('data-quick-time-input') === '1') { return; }
				push(out, seen, 'text', el.closest('.ant-input-affix-wrapper') || el, el);
			});
			r.querySelectorAll('input[type=range]').forEach(function (el) { push(out, seen, 'native-range', el, el); });
			// 原生数字/日期/时间/颜色输入(自研面板里直接写 <input type="number|date|time|datetime-local|color">;此前整族不收 = 盲区)
			r.querySelectorAll('input[type=number]').forEach(function (el) { if (!el.closest('.ant-input-number')) { push(out, seen, 'native-number', el, el); } });
			r.querySelectorAll('input[type=date]').forEach(function (el) { push(out, seen, 'native-date', el, el); });
			r.querySelectorAll('input[type=time]').forEach(function (el) { push(out, seen, 'native-time', el, el); });
			r.querySelectorAll('input[type=datetime-local]').forEach(function (el) { push(out, seen, 'native-datetime', el, el); });
			r.querySelectorAll('input[type=color]').forEach(function (el) { push(out, seen, 'native-color', el, el); });
			r.querySelectorAll('select').forEach(function (el) { push(out, seen, 'native-select', el, el); });
			r.querySelectorAll('input[type=radio]').forEach(function (el) { if (!el.closest('.ant-radio-group, .ant-radio-wrapper, .ant-radio-button-wrapper')) { push(out, seen, 'native-radio', el.closest('label') || el, el); } });
			r.querySelectorAll('button[aria-pressed], button.is-active, [role=button].is-active, button[class*="is-active"]').forEach(function (el) { push(out, seen, 'native-toggle', el, null); });
			r.querySelectorAll('button, .ant-btn').forEach(function (el) {
				if (seen.has(el) || el.closest('.ant-select, .ant-picker, .ant-input-number, .ant-radio-group, .xq-side-section-header, .ant-tabs-nav, .hds-selftest-box')) { return; }
				if (el.classList.contains('xq-toggle') || el.classList.contains('xq-check-item') || el.hasAttribute('aria-pressed')) { return; }
				push(out, seen, 'action', el, null);
			});
			r.querySelectorAll('[role=tab], .ant-tabs-tab').forEach(function (el) { if (el.getAttribute('role') === 'tab' && el.closest('.ant-tabs-tab') && el.closest('.ant-tabs-tab') !== el) { return; } push(out, seen, 'tab', el, null); });
		});
		// 稳定身份(复原时控件被重挂载要按它找回新节点):同 kind+ctx 内序号 / 业务 class(horosa-*) / 根选择器
		var slots = {};
		out.forEach(function (c) {
			var sk = c.kind + '|' + (c.ctx || '');
			c.slot = slots[sk] = (slots[sk] === undefined ? 0 : slots[sk] + 1);
			c.cls = String((c.el && c.el.className && c.el.className.baseVal === undefined ? c.el.className : '') || '').split(/\s+/).filter(function (x) { return /^horosa-/.test(x); }).sort().join('.') || null;
			c.__root = rootSel || null;
		});
		return out;
	};

	// 🔴 铁律②:按 aria-controls 精确定位本 select 的面板。
	HDS.panelOf = function (sel) {
		var inp = sel.querySelector('input[aria-controls],input[aria-owns]');
		var id = inp && (inp.getAttribute('aria-controls') || inp.getAttribute('aria-owns'));
		if (!id) { return null; }
		var open = function (dd) { return dd && !dd.classList.contains('ant-select-dropdown-hidden') && isVis(dd); };
		var list = document.getElementById(id);
		var dd = list && list.closest('.ant-select-dropdown');
		if (open(dd)) { return dd; }
		// 表单字段名作 id(如 name='asporb' → asporb_list):keep-alive 的多个同构表单同时在 DOM 里,getElementById 取到的是
		// 隐藏页那份的列表 → 此前误判「面板未开/未关联」而整条跳过。按同 id 全量找,取正在展开的那份。
		var same = [].slice.call(document.querySelectorAll('[id="' + id.replace(/"/g, '\\"') + '"]'))
			.map(function (n) { return n.closest('.ant-select-dropdown'); }).filter(open);
		if (same.length === 1) { return same[0]; }
		return null;
	};
	function selOpen(sel) { var s = sel.querySelector('.ant-select-selector') || sel; mouse(s, 'mousedown'); mouse(s, 'mouseup'); }
	function selClose() { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); document.body.click(); }
	function selCur(sel) { return [].slice.call(sel.querySelectorAll('.ant-select-selection-item')).map(function (e) { return (e.getAttribute('title') || e.textContent || '').trim(); }).join('|'); }

	// ── 当前值(dumpState / 复原判据 / 导出)──
	function valueOf(c) {
		var el = c.el; var inner = c.inner;
		switch (c.kind) {
			case 'checkbox': case 'native-checkbox': return !!(inner || el).checked;
			case 'switch': return el.getAttribute('aria-checked') === 'true' || el.classList.contains('ant-switch-checked');
			case 'select': return selCur(el);
			case 'radio': { var ck = (c.items || []).filter(function (i) { return /checked/.test(i.className); })[0]; return ck ? txt(ck) : ''; }
			case 'chip': return el.classList.contains('xq-check-item-checked');
			case 'toggle': return el.classList.contains('xq-toggle-active');
			case 'number': case 'text': case 'date': case 'time': return inner ? inner.value : '';
			case 'slider': return inner ? inner.getAttribute('aria-valuenow') : '';
			case 'quicktime': return txt(el);
			case 'native-toggle': return el.hasAttribute('aria-pressed') ? el.getAttribute('aria-pressed') : String(el.classList.contains('is-active'));
			case 'native-range': case 'native-select': case 'native-number': case 'native-date': case 'native-time': case 'native-datetime': case 'native-color': return el.value;
			case 'native-radio': return !!(inner || el).checked;
			default: return null;
		}
	}
	HDS.valueOf = valueOf;

	// ── 拨值:返回 { from, to, picked, undo, skip } ──
	async function act(c, opts) {
		opts = opts || {};
		var waitMs = opts.waitMs || PROFILE.waitMs || 700;
		var tryIdx = opts.tryIdx || 0;
		var el = c.el; var inner = c.inner;
		var from = valueOf(c);
		var toggleUndo = function () { return async function () { clickEl(el); }; };
		switch (c.kind) {
			case 'checkbox': case 'native-checkbox': case 'switch': case 'chip': case 'toggle': case 'native-toggle': case 'native-radio': {
				if ((inner || el).disabled) { return { skip: 'disabled' }; }
				clickEl(c.kind === 'checkbox' ? (inner || el) : el); await settleAfter(waitMs);
				return { from: from, to: !from, picked: valueOf(c), undo: toggleUndo() };
			}
			case 'radio': {
				var items = c.items || [];
				var cur = items.filter(function (i) { return /checked/.test(i.className); })[0];
				var others = items.filter(function (i) { return i !== cur && !/disabled/.test(i.className) && isVis(i); });
				if (!others.length) { return { skip: '取值<2', n: items.length }; }
				var other = others[tryIdx % others.length];
				var toTxt = txt(other);
				clickEl(other); await settleAfter(waitMs);
				return { from: from, to: toTxt, picked: valueOf(c), 取值数: items.length, undo: async function () { var back = (c.items || []).filter(function (i) { return sameOption(txt(i), from); })[0] || cur; if (back) { clickEl(back); } } };
			}
			case 'select': {
				if (inner && inner.disabled) { return { skip: 'disabled' }; }
				selOpen(el); await sleep(300);
				var dd = HDS.panelOf(el);
				if (!dd) { selClose(); return { skip: '面板未开/未关联' }; }
				var optsEl = [].slice.call(dd.querySelectorAll('.ant-select-item-option')).filter(function (o) { return !o.classList.contains('ant-select-item-option-disabled'); });
				var cands = optsEl.filter(function (o) { return !o.classList.contains('ant-select-item-option-selected'); });
				// 「随流派 → X」:当前生效值 = X 时,拨到 X 必无变化(判别向量为零)→ 把与 X 同名的候选挪到最后
				var followHint = ((el.getAttribute('title') || (el.closest('[title]') && el.closest('[title]').getAttribute('title')) || '').match(/随流派\s*→\s*([^·]+)/) || [])[1];
				if (followHint) {
					var fh = followHint.trim();
					cands = cands.filter(function (o) { return !sameOption((o.getAttribute('title') || o.textContent), fh); }).concat(cands.filter(function (o) { return sameOption((o.getAttribute('title') || o.textContent), fh); }));
				}
				if (optsEl.length < 2 || !cands.length) { selClose(); return { skip: optsEl.length < 2 ? '取值<2' : '全为选中态', n: optsEl.length }; }
				// 复原按下拉里「选中项」的全文找回:收起态显示 optionLabelProp 短名(如「书法」)而选项全文是「书法·策天本法」时,
				// 按短名找不到 → 复原静默失败、后续控件都在错的模式下测(策天「算法」实抓)
				var selNow = optsEl.filter(function (o) { return o.classList.contains('ant-select-item-option-selected'); })[0];
				var fromFull = selNow ? (selNow.getAttribute('title') || selNow.textContent || '').trim() : null;
				var pick = cands[tryIdx % cands.length];
				var toTxt2 = (pick.getAttribute('title') || pick.textContent || '').trim();
				pick.click(); await settleAfter(waitMs);
				if (c.multiple) { selClose(); await sleep(150); }
				// 拨值可能让整块重挂载:旧节点脱离文档后 textContent 恒停在旧值 → 假「选错」;回读前先找回新节点
				var elNow = el.isConnected ? el : (((resolveFresh(c) || {}).el) || el);
				var picked = selCur(elNow);
				// optionLabelProp 短标签形态(M-182 形态②):收起态显示的是 label 属性(策天「旧口径」、世俗「Barbault」),选项全文是 children
				// (「顺从命·逆从身(旧)」「Barbault 周期」),按文本比对必假「选错」→ 另记下拉里带 selected 类的项全文(隐藏面板仍挂在 DOM、随值重渲染;
				// 读不到就在复原开面板时再读一次),「选对了」由 pickedOk 以它为准
				var selTxt = HDS.selectedTextIn(dd);
				var ret = {
					from: from, fromFull: fromFull, to: toTxt2, picked: picked, selTxt: selTxt, 取值数: optsEl.length,
					undo: async function () {
						selOpen(el); await sleep(300);
						var dd2 = HDS.panelOf(el);
						if (!dd2) { selClose(); return; }
						if (ret.selTxt == null) { ret.selTxt = HDS.selectedTextIn(dd2); }
						var list = [].slice.call(dd2.querySelectorAll('.ant-select-item-option'));
						var back = c.multiple
							? list.filter(function (o) { return sameOption((o.getAttribute('title') || o.textContent), toTxt2); })[0]   // 多选:再点同项=取消
							: ((fromFull && list.filter(function (o) { return String(o.getAttribute('title') || o.textContent || '').trim() === fromFull; })[0])
								|| list.filter(function (o) { return sameOption((o.getAttribute('title') || o.textContent), from); })[0]);
						if (back) { back.click(); } else { selClose(); }
						if (c.multiple) { await sleep(120); selClose(); }
					},
				};
				return ret;
			}
			case 'number': {
				if (!inner || inner.disabled) { return { skip: inner ? 'disabled' : '无输入框' }; }
				var step = Number(inner.getAttribute('step')) || 1;
				var min = inner.getAttribute('aria-valuemin'); var max = inner.getAttribute('aria-valuemax');
				var curN = from === '' ? null : Number(String(from).replace(/[^0-9.\-]/g, ''));
				var alt = curN === null || isNaN(curN) ? ((min !== null && min !== '' ? Number(min) : 0) + step) : curN + step;
				if (max !== null && max !== '' && alt > Number(max)) { alt = (curN === null || isNaN(curN) ? Number(max) : curN) - step; }
				if (tryIdx > 0) { alt = (curN === null || isNaN(curN) ? 0 : curN) - step * tryIdx; if (min !== null && min !== '' && alt < Number(min)) { alt = Number(min); } }
				var altS = String(Math.round(alt * 1e6) / 1e6);
				// 候选被夹到边界与当前值相同 = 空拨(主限「影响期(年)」min=0.25=当前值实抓「0.25→0.25」):首次即空拨记跳过,后几次空拨直接停(循环里 t>0 的 skip 不记 skip)
				if (curN !== null && !isNaN(curN) && Number(altS) === curN) { return { skip: '取值无变化(候选被夹到边界=当前值)' }; }
				inner.focus(); setNative(inner, altS); key(inner, 'Enter', 13); inner.blur(); inner.dispatchEvent(new FocusEvent('blur', { bubbles: true })); await settleAfter(waitMs);
				return { from: from, to: altS, picked: valueOf(c), undo: async function () { inner.focus(); setNative(inner, String(from)); key(inner, 'Enter', 13); inner.blur(); inner.dispatchEvent(new FocusEvent('blur', { bubbles: true })); } };
			}
			case 'slider': {
				if (!inner) { return { skip: '无滑块把手' }; }
				var now = Number(inner.getAttribute('aria-valuenow')); var vmax = Number(inner.getAttribute('aria-valuemax'));
				var fwd = !(now >= vmax);
				inner.focus(); key(inner, fwd ? 'ArrowRight' : 'ArrowLeft', fwd ? 39 : 37); await settleAfter(waitMs);
				return { from: from, to: inner.getAttribute('aria-valuenow'), picked: valueOf(c), undo: async function () { inner.focus(); key(inner, fwd ? 'ArrowLeft' : 'ArrowRight', fwd ? 37 : 39); } };
			}
			case 'date': case 'time': {
				if (!inner || inner.disabled) { return { skip: inner ? 'disabled' : '无输入框' }; }
				if (c.range) { return { skip: '区间选择框(只登记不拨)' }; }
				var v = inner.value; var altV = null;
				var md = v.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
				if (md) { var dt = new Date(Date.UTC(+md[1], +md[2] - 1, +md[3])); dt.setUTCDate(dt.getUTCDate() + 1 + tryIdx); altV = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0') + md[4]; }
				else { var mt = v.match(/^(\d{1,2}):(\d{2})(.*)$/); if (mt) { altV = String((+mt[1] + 1 + tryIdx) % 24).padStart(2, '0') + ':' + mt[2] + mt[3]; } }
				if (altV === null) { return { skip: v ? '未知日期格式:' + v.slice(0, 20) : '空值(未登记替代值)' }; }
				// M-187:全站 XQ 日期 / 时间框的输入框是只读的,antd 自己不认塞进去的文本;能拨动它的只有「快输数字」宿主(QuickDigitsHost:
				// 输入值为纯数字且够位 → input 事件即换算提交;不够位按回车 / 失焦提交)。旧写法把「13:00:00」整串塞进去 → 宿主不认(带冒号)、
				// antd 也不认(只读)→ hds5 全部分片 kind=time 37 条全「无反应+选错」、kind=date 零个有反应,全是仪器假报。
				// 有宿主(data-quick-digits-host="1")走纯数字;没宿主的裸 antd 选择框仍走整串 + 回车
				var qh = el.closest && el.closest('[data-quick-digits-host="1"]');
				var feed = function (s) { return qh ? String(s || '').replace(/\D+/g, '') : s; };
				var blurIt = function () { inner.blur(); inner.dispatchEvent(new FocusEvent('blur', { bubbles: true })); };
				inner.focus(); setNative(inner, feed(altV)); key(inner, 'Enter', 13); await settleAfter(waitMs); blurIt();
				return { from: v, to: altV, picked: valueOf(c), undo: async function () { inner.focus(); setNative(inner, feed(v)); key(inner, 'Enter', 13); await sleep(120); blurIt(); } };
			}
			case 'quicktime': {
				var digits = (txt(el).match(/\d+/g) || []).join('');
				if (digits.length < 8) { return { skip: '触发点文本非日期' }; }
				var d14 = (digits + '00000000000000').slice(0, 14);
				var altD = String(+d14.slice(0, 4) + 1 + tryIdx).padStart(4, '0') + d14.slice(4);
				var enter = async function (val) {
					mouse(el, 'mousedown'); mouse(el, 'mouseup'); el.click(); mouse(el, 'mousedown'); mouse(el, 'mouseup'); el.click(); mouse(el, 'dblclick'); await sleep(200);
					var inp = vis('[data-quick-time-input="1"]').filter(function (i) { return !i.closest('[data-quick-time-form]'); })[0];
					if (!inp) { return false; }
					inp.focus(); setNative(inp, val); await sleep(200);
					if (vis('[data-quick-time-input="1"]').length) { key(inp, 'Enter', 13); await sleep(200); }
					return true;
				};
				var digitsNow = function () { return (txt(el).match(/\d+/g) || []).join(''); };
				var waitDigits = async function (want, ms) { var t0 = Date.now(); while (Date.now() - t0 < ms) { if (digitsNow().indexOf(want.slice(0, digits.length)) === 0) { return true; } await sleep(150); } return digitsNow().indexOf(want.slice(0, digits.length)) === 0; };
				if (!(await enter(altD))) { return { skip: '双击未进键入态' }; }
				await waitDigits(altD, 10000); await settleAfter(waitMs);
				return { from: digits, to: altD, picked: digitsNow(), undo: async function () { await enter(d14); await waitDigits(d14, 10000); await settleAfter(waitMs * 0.5); } };
			}
			case 'text': {
				if (!inner || inner.disabled) { return { skip: 'disabled' }; }
				var kk = Object.keys(TEXT_ALT).filter(function (k) { return (c.key && c.key === k) || (c.name && c.name.indexOf(k) >= 0) || ((inner.getAttribute('placeholder') || '').indexOf(k) >= 0); })[0];
				if (!kk) { return { skip: '未登记替代值(text)' }; }
				var altT = String(TEXT_ALT[kk]);
				if (altT === from) { altT = altT + '1'; }
				inner.focus(); setNative(inner, altT); key(inner, 'Enter', 13); inner.blur(); inner.dispatchEvent(new FocusEvent('blur', { bubbles: true })); await settleAfter(waitMs);
				return { from: from, to: altT, picked: valueOf(c), undo: async function () { inner.focus(); setNative(inner, String(from)); key(inner, 'Enter', 13); inner.blur(); inner.dispatchEvent(new FocusEvent('blur', { bubbles: true })); } };
			}
			case 'native-range': {
				var st2 = Number(el.step) || 1; var cur2 = Number(el.value); var alt2 = cur2 + st2; if (el.max !== '' && alt2 > Number(el.max)) { alt2 = cur2 - st2; }
				setNative(el, String(alt2)); el.dispatchEvent(new Event('change', { bubbles: true })); await settleAfter(waitMs);
				return { from: from, to: String(alt2), picked: valueOf(c), undo: async function () { setNative(el, String(from)); el.dispatchEvent(new Event('change', { bubbles: true })); } };
			}
			case 'native-number': case 'native-date': case 'native-time': case 'native-datetime': case 'native-color': {
				if (el.disabled || el.readOnly) { return { skip: el.disabled ? 'disabled' : 'readonly' }; }
				var nv = nativeAlt(el, c.kind, tryIdx);
				if (nv === null) { return { skip: '无可替代值(' + c.kind + ':' + String(el.value).slice(0, 16) + ')' }; }
				var nfrom = el.value;
				el.focus(); setNative(el, nv); el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); await settleAfter(waitMs);
				return { from: nfrom, to: nv, picked: el.value, undo: async function () { el.focus(); setNative(el, nfrom); el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); } };
			}
			case 'native-select': {
				if (el.options.length < 2) { return { skip: '取值<2' }; }
				var idx0 = el.selectedIndex; var alt3 = (idx0 + 1 + tryIdx) % el.options.length; if (alt3 === idx0) { alt3 = (alt3 + 1) % el.options.length; }
				el.selectedIndex = alt3; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); await settleAfter(waitMs);
				// 原生 <select>:valueOf 回读的是 option 的 value(如「prefix」),to 记的是 option 文本(「前缀」)→ 按文本比对必假「选错」(M-182 形态③,名人库页实抓);
				// selTxt 记回读时选中项的文本,pickedOk 以它为准
				var selOpt = el.options[el.selectedIndex];
				return { from: from, to: el.options[alt3].text, picked: valueOf(c), selTxt: selOpt ? String(selOpt.text || '').trim() : null, 取值数: el.options.length, undo: async function () { el.selectedIndex = idx0; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); } };
			}
			default: return { skip: '不拨(' + c.kind + ')' };
		}
	}
	HDS.act = act;
	function restored(c, from) {
		if (c.el && c.el.isConnected === false) {
			// 节点已被重挂载:旧节点的值恒停在某个历史态(假「复原」/假「未复原」)→ 找回新节点再读;找不到 = 未复原
			var fc = resolveFresh(c);
			if (!fc || fc === c) { return false; }
			c.el = fc.el; c.inner = fc.inner; c.items = fc.items;
		}
		var now = valueOf(c); if (typeof from === 'boolean') { return now === from; } return sameOption(String(now == null ? '' : now), String(from == null ? '' : from));
	}

	// 保留旧 API:单个 select 差分(自含复原)
	HDS.sameOption = sameOption;   // 自证向量⑩(数值等价)用
	HDS.selectedTextIn = function (dd) {
		var o = dd ? [].slice.call(dd.querySelectorAll('.ant-select-item-option')).filter(function (x) { return x.classList.contains('ant-select-item-option-selected'); })[0] : null;
		return o ? String(o.getAttribute('title') || o.textContent || '').trim() : null;
	};
	// 「选对了」:收起态文本 = 目标(含括号短名 / 数值等价)→ 对;否则下拉里带 selected 类的项 = 目标 → 对(optionLabelProp 短标签,M-182 形态②);
	// 都不是 → 选错。读不到 selected 项不放水(仍按文本判)
	function pickedOk(r) {
		if (!r || r.to === undefined || r.picked === undefined) { return true; }
		if (sameOption(r.picked, r.to)) { return true; }
		return r.selTxt != null && r.selTxt !== '' && sameOption(r.selTxt, r.to);
	}
	HDS.pickedOk = pickedOk;   // 自证向量⑫(短标签选中项)用
	// 不可达分类(自证向量⑪):'unmounted'=节点已卸载或零尺寸(条件渲染行,不作废整页)/ 'covered'=有尺寸但被别的层盖住 / 'ok'=可命中
	HDS.unreachableKind = function (el) {
		if (!el || !el.isConnected) { return 'unmounted'; }
		var r = el.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) { return 'unmounted'; }
		return hittable(el) ? 'ok' : 'covered';
	};
	HDS.selectDiff = async function (sel, waitMs) {
		var c = { kind: 'select', el: sel, inner: sel.querySelector('input'), multiple: sel.classList.contains('ant-select-multiple') };
		var before = await HDS.fpx();
		var r = await act(c, { waitMs: waitMs || 700 });
		if (r.skip) { return r; }
		var after = await HDS.fpx();
		await r.undo(); await sleep(waitMs || 700);
		return { from: r.from, to: r.to, picked: r.picked, 选对了: pickedOk(r), 反应: !HDS.same(before, after), 面: before.stage !== after.stage ? '盘面' : '右栏', 复原: restored(c, r.from), 取值数: r.取值数 };
	};

	HDS.goto = async function (railName, expectSection) {
		var c = [].slice.call(document.querySelectorAll('*')).filter(function (e) {
			return e.children.length === 0 && e.textContent.trim() === railName && e.getBoundingClientRect().width > 0;
		});
		if (!c.length) { return { ok: false, why: 'rail 项未找到(是否还没切到对应大模块?)' }; }
		var el = c[c.length - 1];
		(el.closest('[role="tab"],li,button,a,div') || el).click(); el.click();
		await sleep(1400);
		var titles = vis('.horosa-astro-input-panel .xq-side-section, .horosa-astro-context-panel .xq-side-section').map(function (s) {
			return ((s.querySelector('.xq-side-section-title,[class*=title]') || {}).innerText || '').trim();
		});
		return { ok: !expectSection || titles.some(function (t) { return t.indexOf(expectSection) >= 0; }), titles: titles };
	};

	HDS.expandAll = async function () {
		var opened = 0;
		var secs = vis('.xq-side-section');
		for (var i = 0; i < secs.length; i++) {
			var s = secs[i];
			var body = s.querySelector('.xq-side-section-body,.xq-side-section-body-inner');
			if (s.classList.contains('xq-side-section-collapsed') || (body && body.getBoundingClientRect().height < 8)) {
				var head = s.querySelector('.xq-side-section-header,.xq-side-section-head,[class*=head]') || s.firstElementChild;
				if (head) { head.click(); opened++; await sleep(260); }
			}
		}
		var cols = vis('.ant-collapse-item:not(.ant-collapse-item-active) > .ant-collapse-header');
		for (var k = 0; k < cols.length; k++) { cols[k].click(); opened++; await sleep(200); }
		return opened;
	};

	// 提交钮:PROFILE.commitText 非空时,拨值后与复原后各点一次(文本去空白全等的可见 button),再等 settle
	async function commitIf(waitMs) {
		if (!PROFILE.commitText) { return false; }
		var want = String(PROFILE.commitText).replace(/\s+/g, '');
		// 前缀匹配:按钮在脏态会改文案(如「重算」→「重算（有改动待生效）」),整串全等会漏点
		var btn = vis('button').filter(function (b) { return (b.textContent || '').replace(/\s+/g, '').indexOf(want) === 0 && !b.disabled; })[0];
		if (!btn) { return false; }
		clickEl(btn); await settleAfter(waitMs);
		await HDS.acceptConfirm(waitMs);
		// 起盘/起课类提交会把左栏折叠区收起(实测遁甲/小六壬/小成图):不重新展开,后续控件全变「不可达」、找探针名单变空
		try { await HDS.expandAll(); } catch (e) { /* 展开失败不影响提交结果 */ }
		return true;
	}
	// 找回被重挂载的控件:业务 class → key → 同 kind+ctx 序号 → 同名;找不到返回 null
	function resolveFresh(c) {
		if (c.el && c.el.isConnected) { return c; }
		var all = HDS.controls(c.__root);
		var pick = function (f) { return all.filter(function (x) { return x.kind === c.kind && f(x); })[0] || null; };
		return (c.cls && pick(function (x) { return x.cls === c.cls; }))
			|| (c.key && pick(function (x) { return x.key === c.key; }))
			|| (typeof c.slot === 'number' && (all.filter(function (x) { return x.kind === c.kind && (x.ctx || '') === (c.ctx || ''); })[c.slot] || null))
			|| pick(function (x) { return x.name === c.name; });
	}
	// 在(可能是新的)控件节点上把值设回 from
	async function setTo(fc, from, waitMs) {
		switch (fc.kind) {
			case 'checkbox': case 'native-checkbox': case 'switch': case 'chip': case 'toggle': case 'native-toggle': case 'native-radio':
				if (valueOf(fc) !== from) { clickEl(fc.kind === 'checkbox' ? (fc.inner || fc.el) : fc.el); }
				return;
			case 'radio': {
				var back = (fc.items || []).filter(function (i) { return sameOption(txt(i), from); })[0];
				if (back) { clickEl(back); }
				return;
			}
			case 'select': {
				selOpen(fc.el); await sleep(300);
				var dd = HDS.panelOf(fc.el);
				if (!dd) { selClose(); return; }
				var opt = [].slice.call(dd.querySelectorAll('.ant-select-item-option')).filter(function (o) { return sameOption((o.getAttribute('title') || o.textContent), from); })[0];
				if (opt) { opt.click(); } else { selClose(); }
				return;
			}
			case 'native-number': case 'native-date': case 'native-time': case 'native-datetime': case 'native-color': {
				fc.el.focus(); setNative(fc.el, String(from)); fc.el.dispatchEvent(new Event('change', { bubbles: true })); fc.el.blur();
				return;
			}
			case 'number': case 'text': case 'date': case 'time': {
				var inp = fc.inner; if (!inp) { return; }
				inp.focus(); setNative(inp, String(from)); key(inp, 'Enter', 13); inp.blur(); inp.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
				return;
			}
			default: return;
		}
	}
	async function actC(c, opts) {
		var r = await act(c, opts);
		if (r.skip) { return r; }
		var waitMs = (opts && opts.waitMs) || PROFILE.waitMs;
		// 改值即自动发请求的控件(如返照页时区下拉)与提交钮并存时,先等自动请求落地再点提交:
		// 否则提交按改值前的状态重发,页面序号守卫只认后发请求 → 旧值胜出,真有效的控件被判「无反应」、复原被打回
		if (PROFILE.commitText) { await settleAfter(waitMs); }
		await commitIf(waitMs);
		var u = r.undo;
		r.undo = async function () {
			if (c.el && c.el.isConnected === false) {
				// 拨值让控件整块重挂载(如切换「体系」整栏换组件):旧节点上的 undo 是空操作 → 找回新节点再设回
				var fc = resolveFresh(c);
				if (fc) { await setTo(fc, (fc.kind === 'select' && r.fromFull) ? r.fromFull : r.from, waitMs); c.el = fc.el; c.inner = fc.inner; c.items = fc.items; r.undoVia = 'fresh'; } else { r.undoVia = 'lost'; }
			} else { await u(); }
			if (PROFILE.commitText) { await settleAfter(waitMs); }
			await commitIf(waitMs);
		};
		return r;
	}
	// 诊断探针:对单个控件跑一遍「指纹 → 拨值(+提交钮) → 指纹 → 复原(+提交钮) → 指纹」,把三份指纹与提交钮命中情况原样返回(定位假死/假活用)
	HDS.probe = async function (nameFragment, rootSel) {
		var c = HDS.controls(rootSel).filter(function (x) { return SWITCHABLE.indexOf(x.kind) >= 0 && x.name.indexOf(nameFragment) >= 0; })[0];
		if (!c) { return { ok: false, why: '未找到 ' + nameFragment }; }
		try { c.el.scrollIntoView({ block: 'center' }); } catch (e) { /* noop */ }
		await sleep(120); markSelf(c.el);
		var t0 = Date.now(); var waitMs = Math.max(PROFILE.waitMs, 800);
		var b = await HDS.fpx(); var tb = Date.now() - t0;
		var r = await actC(c, { waitMs: waitMs });
		if (r.skip) { unmarkSelf(); return { ok: false, why: '不可拨:' + r.skip }; }
		var want = PROFILE.commitText ? String(PROFILE.commitText).replace(/\s+/g, '') : null;
		var btns = want ? vis('button').filter(function (x) { return (x.textContent || '').replace(/\s+/g, '').indexOf(want) === 0; }).map(function (x) { return { text: (x.textContent || '').trim(), disabled: !!x.disabled, cls: String(x.className).slice(0, 60) }; }) : null;
		var committed = !!(btns && btns.length); var spin = vis('.ant-spin-spinning').length;
		var a = await HDS.fpx(); var ta = Date.now() - t0;
		await r.undo(); await sleep(waitMs);
		var back = await HDS.fpx(); unmarkSelf();
		var fresh = HDS.controls(rootSel).filter(function (x) { return x.kind === c.kind && x.name === c.name; })[0];
		return { ok: true, 开关: c.name, kind: c.kind, from: r.from, to: r.to, commitText: want, commitButtons: btns, committed: committed, spinnerAfterCommit: spin,
			elConnectedAfterUndo: !!(c.el && c.el.isConnected), undoVia: r.undoVia || 'direct', valueStaleEl: valueOf(c), valueFreshEl: fresh ? valueOf(fresh) : '(控件已不在)', freshIsSameEl: !!(fresh && fresh.el === c.el),
			before: b, after: a, back: back, 反应: !HDS.same(b, a), 复原: HDS.same(b, back) || restored(c, r.from), ms: { before: tb, after: ta, total: Date.now() - t0 } };
	};
	// 诊断:跨页签「文本行差分」—— 拨一个控件前后逐页签取主区文本,列出增删行(只产事实,不改判定)。
	// 用途:跨页签才有反应的控件,看清变的是算法结果行还是只有口径回显行(定性依据)。
	HDS.textAcrossTabs = async function (opts) {
		opts = opts || {};
		var roots = vis(opts.tabScope || PROFILE.tabScope);
		var tabs = [];
		roots.forEach(function (r) {
			[].slice.call(r.querySelectorAll('[role="tab"], .ant-tabs-tab'))
				.filter(function (e) { return e.getBoundingClientRect().width > 0; })
				.forEach(function (e) { if (tabs.indexOf(e) < 0) { tabs.push(e); } });
		});
		var textOf = function () {
			var g = vis(PROFILE.mainSel)[0];
			if (!g) { return ''; }
			var clone = g.cloneNode(true);
			clone.querySelectorAll(PROFILE.leftSel).forEach(function (n) { n.remove(); });
			clone.querySelectorAll('[data-hds-self], .hds-selftest-box').forEach(function (n) { n.remove(); });
			return (clone.innerText || clone.textContent || '');
		};
		if (tabs.length < 2) { return { '(单视图)': textOf() }; }
		var active = tabs.filter(function (e) { return (e.className || '').indexOf('active') >= 0; })[0] || tabs[0];
		var out = {};
		for (var i = 0; i < tabs.length; i++) {
			tabs[i].click(); await sleep(opts.tabMs || 400);
			out[(tabs[i].textContent || '').trim().slice(0, 16) + '#' + i] = textOf();
		}
		active.click(); await sleep(opts.tabMs || 400);
		return out;
	};
	HDS.probeText = async function (nameFragment, rootSel) {
		var c = HDS.controls(rootSel).filter(function (x) { return SWITCHABLE.indexOf(x.kind) >= 0 && x.name.indexOf(nameFragment) >= 0; })[0];
		if (!c) { return { ok: false, why: '未找到 ' + nameFragment }; }
		try { await HDS.mountAllTabs(); } catch (e) { /* 单视图 */ }
		var waitMs = Math.max(PROFILE.waitMs, 800);
		markSelf(c.el);
		// 跨页签指纹三拍:不拨值连拍两次(噪声)+ 拨值后一次;对照判定用的是哪一面在变
		var fp0 = await HDS.fpAcrossTabs({}); var b = await HDS.textAcrossTabs(); var fp1 = await HDS.fpAcrossTabs({});
		var r = await actC(c, { waitMs: waitMs });
		if (r.skip) { unmarkSelf(); return { ok: false, why: '不可拨:' + r.skip }; }
		var fpA = await HDS.fpAcrossTabs({});
		try { await HDS.waitStable(15000, 800); } catch (e) { /* noop */ }
		var a = await HDS.textAcrossTabs();
		await r.undo(); await sleep(waitMs);
		var fpBack = await HDS.fpAcrossTabs({}); unmarkSelf();
		var lines = function (t) { return String(t || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean); };
		var diffs = {};
		Object.keys(Object.assign({}, b, a)).forEach(function (k) {
			var lb = lines(b[k]), la = lines(a[k]);
			var sb = new Set(lb), sa = new Set(la);
			var removed = lb.filter(function (l) { return !sa.has(l); }), added = la.filter(function (l) { return !sb.has(l); });
			if (removed.length || added.length) { diffs[k] = { '-': removed.slice(0, 12), '+': added.slice(0, 12), nRemoved: removed.length, nAdded: added.length }; }
		});
		return { ok: true, 开关: c.name, from: r.from, to: r.to, diffs: diffs, fp: { noise: !HDS.same(fp0, fp1), reacted: !HDS.same(fp1, fpA), restored: HDS.same(fp1, fpBack), fp0: fp0, fp1: fp1, after: fpA, back: fpBack } };
	};
	// 诊断:结构指纹为何回不去 —— 拨值、复原后逐属性比主区 innerHTML,列出变了的属性名与样例(只产事实)
	HDS.probeStruct = async function (nameFragment, rootSel) {
		var c = HDS.controls(rootSel).filter(function (x) { return SWITCHABLE.indexOf(x.kind) >= 0 && x.name.indexOf(nameFragment) >= 0; })[0];
		if (!c) { return { ok: false, why: '未找到 ' + nameFragment }; }
		var htmlOf = function () {
			var g = vis(PROFILE.mainSel)[0];
			if (!g) { return ''; }
			var clone = g.cloneNode(true);
			clone.querySelectorAll(PROFILE.leftSel).forEach(function (n) { n.remove(); });
			clone.querySelectorAll('[data-hds-self], .hds-selftest-box').forEach(function (n) { n.remove(); });
			return normHtml(clone.innerHTML);   // 与指纹同一归一:列出的是归一后仍在变的属性
		};
		var tokens = function (h) { return (String(h).match(/[a-zA-Z_:][-a-zA-Z0-9_:.]*="[^"]*"/g) || []); };
		var waitMs = Math.max(PROFILE.waitMs, 800);
		markSelf(c.el);
		var h0 = htmlOf(); await sleep(waitMs); var h1 = htmlOf();
		var r = await actC(c, { waitMs: waitMs });
		if (r.skip) { unmarkSelf(); return { ok: false, why: '不可拨:' + r.skip }; }
		var hA = htmlOf();
		await r.undo(); await sleep(waitMs);
		try { await HDS.waitStable(15000, 800); } catch (e) { /* noop */ }
		var hB = htmlOf(); unmarkSelf();
		var tdiff = function (x, y) {
			var cx = {}, cy = {};
			tokens(x).forEach(function (t) { cx[t] = (cx[t] || 0) + 1; });
			tokens(y).forEach(function (t) { cy[t] = (cy[t] || 0) + 1; });
			var names = {}; var samples = [];
			Object.keys(Object.assign({}, cx, cy)).forEach(function (t) {
				if ((cx[t] || 0) !== (cy[t] || 0)) {
					var nm = t.split('=')[0]; names[nm] = (names[nm] || 0) + 1;
					if (samples.length < 16) { samples.push(t.slice(0, 90) + ' ×' + (cx[t] || 0) + '→' + (cy[t] || 0)); }
				}
			});
			return { attrNames: names, samples: samples, textSame: x.replace(/<[^>]*>/g, '') === y.replace(/<[^>]*>/g, '') };
		};
		return { ok: true, 开关: c.name, from: r.from, to: r.to, idle: tdiff(h0, h1), changed: tdiff(h1, hA), restored: tdiff(h1, hB) };
	};
	HDS.probeStructStart = function (nameFragment, rootSel) {
		HDS.probeBusy = true; HDS.probeOut = null;
		HDS.probeStruct(nameFragment, rootSel).then(function (r) { HDS.probeOut = r; HDS.probeBusy = false; }, function (e) { HDS.probeOut = { ok: false, why: String(e).slice(0, 120) }; HDS.probeBusy = false; });
		return 'probeStruct started';
	};
	HDS.probeTextStart = function (nameFragment, rootSel) {
		HDS.probeBusy = true; HDS.probeOut = null;
		HDS.probeText(nameFragment, rootSel).then(function (r) { HDS.probeOut = r; HDS.probeBusy = false; }, function (e) { HDS.probeOut = { ok: false, why: String(e).slice(0, 120) }; HDS.probeBusy = false; });
		return 'probeText started';
	};
	HDS.probeStart = function (nameFragment, rootSel) {
		HDS.probeBusy = true; HDS.probeOut = null;
		HDS.probe(nameFragment, rootSel).then(function (r) { HDS.probeOut = r; HDS.probeBusy = false; }, function (e) { HDS.probeOut = { ok: false, why: String(e).slice(0, 120) }; HDS.probeBusy = false; });
		return 'probe started';
	};
	// 就绪:指纹连续两次相同才开始审计(页面首屏异步重算未完时拍基线 = 后续每行都像「有反应/未复原」)
	HDS.waitStable = async function (maxMs, gapMs) {
		var t0 = Date.now(); gapMs = gapMs || 1200; maxMs = maxMs || 30000;
		var prev = await HDS.fpx(); var n = 0;
		while (Date.now() - t0 < maxMs) {
			await sleep(gapMs); var cur = await HDS.fpx(); n++;
			if (HDS.same(prev, cur)) { return { stable: true, ms: Date.now() - t0, samples: n + 1 }; }
			prev = cur;
		}
		return { stable: false, ms: Date.now() - t0, samples: n + 1 };
	};
	HDS.waitStableStart = function (maxMs, gapMs) {
		HDS.stableBusy = true; HDS.stableOut = null;
		HDS.waitStable(maxMs, gapMs).then(function (r) { HDS.stableOut = r; HDS.stableBusy = false; }, function (e) { HDS.stableOut = { stable: false, err: String(e).slice(0, 80) }; HDS.stableBusy = false; });
		return 'waitStable started';
	};
	// 提交钮确定性:连点两次提交钮,指纹必须不变;变了 = 提交会重新随机(随机起卦/掷棋),提交模式下「有反应」全部不可信
	HDS.commitNoise = async function () {
		if (!PROFILE.commitText) { return { deterministic: null, why: '无提交钮' }; }
		var w = Math.max(PROFILE.waitMs, 800);
		// 先热身提交一次(首屏可能从「未算」进入「已算」,这一跳不是随机性),再连点两次比指纹
		var c0 = await commitIf(w); await HDS.waitStable(20000, 1000);
		var a = await HDS.fpx(); var c1 = await commitIf(w); await HDS.waitStable(20000, 1000); var b = await HDS.fpx();
		var c2 = await commitIf(w); await HDS.waitStable(20000, 1000); var c = await HDS.fpx();
		return { deterministic: HDS.same(a, b) && HDS.same(b, c), found: c0 && c1 && c2, ab: HDS.same(a, b), bc: HDS.same(b, c) };
	};
	HDS.commitNoiseStart = function () {
		HDS.noiseBusy = true; HDS.noiseOut = null;
		HDS.commitNoise().then(function (r) { HDS.noiseOut = r; HDS.noiseBusy = false; }, function (e) { HDS.noiseOut = { deterministic: false, err: String(e).slice(0, 80) }; HDS.noiseBusy = false; });
		return 'commitNoise started';
	};
	// 可拨控件名单(找探针用):排除时间步长下拉与快捷时间入口
	HDS.switchableNames = function (rootSel) {
		return HDS.controls(rootSel).filter(function (c) { return SWITCHABLE.indexOf(c.kind) >= 0 && c.kind !== 'quicktime' && c.name && c.name !== '时间'; }).map(function (c) { return c.name; });
	};
	// 🔴 铁律①:自证。传一个已知有效开关的名字片段,必须返回 ok:true。
	HDS.selfTest = async function (nameFragment, rootSel) {
		var c = HDS.controls(rootSel).filter(function (x) { return SWITCHABLE.indexOf(x.kind) >= 0 && x.name.indexOf(nameFragment) >= 0; })[0];
		if (!c) { return { ok: false, why: '未找到自证开关 ' + nameFragment }; }
		try { c.el.scrollIntoView({ block: 'center' }); } catch (e) { /* noop */ }
		await sleep(120);
		markSelf(c.el);
		var b = await HDS.fpx();
		var r = await actC(c, { waitMs: Math.max(PROFILE.waitMs, 800) });
		if (r.skip) { unmarkSelf(); return { ok: false, why: '自证开关不可拨:' + r.skip, 开关: c.name }; }
		var a = await HDS.fpx();
		await r.undo(); await sleep(Math.max(PROFILE.waitMs, 700));
		var back = await HDS.fpx(); unmarkSelf();
		return { ok: !HDS.same(b, a), 复原: HDS.same(b, back) || restored(c, r.from), 开关: c.name, kind: c.kind, from: r.from, to: r.to };
	};

	// 🔴 跑之前必查全屏遮挡:导航弹窗(⌘K「选择功能模块」)之类的 modal 盖在整页上时,
	//    每个控件的命中测试都会失败,整批 23 个全报「不可达」—— 看起来像审计跑过了,其实一个都没测。
	//    宁可拒绝开跑并报错,也不要产出一份全是「不可达」的报告让人误以为页面没问题。
	// ⚠ 判据不能只看 .ant-modal-wrap 存在:antd 关闭 Modal 后 wrap 空壳会留在 DOM,
	//   仍是 1729×1111 / display:block / visibility:visible,界面上却早已关闭且不挡交互。
	//   真正的判据是「wrap 内有可见的 .ant-modal 内容」。
	function modalOpen(wrap) {
		var inner = wrap.querySelector('.ant-modal, .ant-drawer-content');
		if (!inner) { return false; }
		var r = inner.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) { return false; }
		var cs = getComputedStyle(inner);
		return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.1;
	}
	HDS.blockedBy = function () {
		var blockers = [].slice.call(document.querySelectorAll('.ant-modal-wrap, .ant-drawer'))
			.filter(function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && modalOpen(e); });
		if (!blockers.length) { return null; }
		return blockers.map(function (e) { return ((e.innerText || '').trim().split('\n')[0] || e.className); }).join(' / ');
	};
	// 改值 / 提交触发的确认框(如「区间过长,将被截断」):点主按钮继续,让这次计算真的发生;
	// 不点的话确认框一直挂着,后面的控件全判「被遮挡」、下一页整页开不了跑。标题记进 HDS.confirmsSeen 供产物诊断。
	HDS.confirmsSeen = [];
	HDS.acceptConfirm = async function (waitMs) {
		var box = [].slice.call(document.querySelectorAll('.ant-modal-confirm')).filter(function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })[0];
		if (!box) { return false; }
		var ok = box.querySelector('.ant-modal-confirm-btns .ant-btn-primary');
		if (!ok) { return false; }
		var title = ((box.querySelector('.ant-modal-confirm-title') || {}).textContent || '').trim();
		HDS.confirmsSeen.push(title);
		clickEl(ok); await settleAfter(waitMs || PROFILE.waitMs);
		return title || true;
	};
	// 页与页之间清场:残留确认框点非主按钮(取消)、弹窗 / 抽屉点关闭钮、再按 Escape;返回清场后仍在的遮挡(null = 已清)
	HDS.dismissBlockers = async function () {
		for (var k = 0; k < 3; k++) {
			if (!HDS.blockedBy()) { return null; }
			[].slice.call(document.querySelectorAll('.ant-modal-confirm-btns .ant-btn:not(.ant-btn-primary)')).forEach(function (b) { clickEl(b); });
			[].slice.call(document.querySelectorAll('.ant-modal-close, .ant-drawer-close')).forEach(function (b) { var r = b.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { clickEl(b); } });
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
			await sleep(600);
		}
		return HDS.blockedBy();
	};

	// ── 统一跑法:fpFn 决定单页签指纹还是跨页签指纹 ──
	function runImpl(rootSel, opts, fpFn, label) {
		opts = opts || {};
		var blocked = HDS.blockedBy();
		if (blocked && !opts.allowBlocked) {
			HDS.__runToken = (HDS.__runToken || 0) + 1;
			HDS.out = [{ n: '(未开跑)', k: '-', skip: '全屏遮挡:' + blocked + ' —— 先关掉再审计' }];
			HDS.busy = false; HDS.total = 0;
			return 'ABORTED: blocked by ' + blocked;
		}
		// 轮次令牌:外层超时置 abort 后紧接着开下一轮时,上一轮循环还停在 await 里;醒来后必须自行退出,
		// 不得把行推进下一轮的产物、也不得替下一轮清掉 busy(两轮交叠的假「跑完」曾让 25 个候选静默丢失)
		var runToken = HDS.__runToken = (HDS.__runToken || 0) + 1;
		var out = []; HDS.out = out; HDS.busy = true; HDS.abort = false;
		var blockedAtStart = HDS.blockedBy();
		// quicktime(时间字段触发点)缺省不拨:整盘随时间变是显然的,且该控件族由 audit_quick_time_entry.py 专项逐处压测;
		// 拨它只会把后端重算排队拖慢并留下脏时间(opts.kinds 显式含 'quicktime' 才拨)。
		var kinds = opts.kinds || SWITCHABLE.filter(function (k) { return k !== 'quicktime'; });
		var ctrls = HDS.controls(rootSel).filter(function (c) { return kinds.indexOf(c.kind) >= 0; });
		// opts.names:只跑名单内控件(分层审计:快轮单页签筛活者,只对无反应候选跨页签定罪;
		// 39 控件全量跨页签 ~50 分钟 → 候选数 × ~80s)
		if (opts.names && opts.names.length) {
			ctrls = ctrls.filter(function (c) { return opts.names.some(function (n) { return c.name.indexOf(n) >= 0 || (c.key && c.key === n); }); });
		}
		// opts.skipNames:整名跳过(如纪元 AD/BC 下拉:改纪元整块时间区重挂载、控件以当前值命名找不回,会连带后续控件全判「被遮挡」)
		if (opts.skipNames && opts.skipNames.length) {
			var skipped = ctrls.filter(function (c) { return opts.skipNames.indexOf(c.name) >= 0; });
			ctrls = ctrls.filter(function (c) { return opts.skipNames.indexOf(c.name) < 0; });
			skipped.forEach(function (c) { out.push({ n: c.name, k: c.kind, key: c.key, ctx: c.ctx, skip: 'profile 跳过(改值整块重挂载,另行核对)' }); });
		}
		HDS.total = ctrls.length;
		var waitMs = opts.waitMs || PROFILE.waitMs || 700;
		var tries = Math.max(1, opts.valueTries || 1);
		(async function () {
			for (var i = 0; i < ctrls.length; i++) {
				if (HDS.abort || HDS.__runToken !== runToken) { break; }
				var c = ctrls[i];
				var row = { n: c.name, k: c.kind, key: c.key, ctx: c.ctx };
				// 前面某个控件(如流派预设)拨值可能让面板重挂载或折叠区收起:本控件的旧节点已脱离文档或尺寸为 0,
				// 直接命中测试会打到页头 → 假「不可达」。先重新展开折叠区,再按业务 class / key / 同上下文序号找回新节点。
				var rr0 = c.el && c.el.isConnected ? c.el.getBoundingClientRect() : null;
				if (!rr0 || rr0.width < 2 || rr0.height < 2) {
					try { await HDS.expandAll(); } catch (e) { /* 展开失败按原节点继续 */ }
					var fresh0 = resolveFresh(Object.assign({}, c, { el: (c.el && c.el.isConnected && rr0 && rr0.width >= 2) ? c.el : null }));
					if (fresh0 && fresh0.el && fresh0.el !== c.el) { fresh0.__root = c.__root; fresh0.cls = c.cls; fresh0.slot = c.slot; c = fresh0; ctrls[i] = fresh0; row.refound = true; }
				}
				// 面板内多数控件要滚动才进视口:先滚到中间再做命中测试,否则「视口外」会被误记为不可达
				try { c.el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) { /* 老内核无 options */ }
				await sleep(150);
				// 时间输入旁的「步进单位」下拉(四分钟/年/月/日/时…):只改 ± 按钮一步走多少,不改排盘 → 记跳过并写明,不进无反应
				if (c.kind === 'select' && c.name === '时间' && /^(四分钟|分钟|秒|时|日|月|年|世纪|十年)$/.test(String(valueOf(c)))) { row.skip = '步进单位(只改时间 ± 步长,不改排盘)'; out.push(row); continue; }
				// 单选组的项节点必须现取:前一控件拨值/复原会让条件渲染的行整体重挂,采集期缓存的项节点
				// 已卸载(rect 全 0)→ 旧逻辑判「被遮挡」并令整页作废。
				if (c.kind === 'radio' && c.el && c.el.isConnected) {
					var liveItems = [].slice.call(c.el.querySelectorAll('.ant-radio-button-wrapper, .ant-radio-wrapper')).filter(isVis);
					if (liveItems.length) { c.items = liveItems; }
				}
				var hitEl = c.kind === 'radio' ? ((c.items || []).filter(function (x) { return !/checked/.test(x.className); })[0] || c.el) : c.el;
				if (!hittable(hitEl)) {
					var ukind = HDS.unreachableKind(hitEl);
					if (ukind === 'unmounted') {
						// 节点已卸载 / 零尺寸:不是遮挡,不作废整页;记为未测(进 unclassified 供定性:多为条件渲染行)
						row.skip = '不可见(节点已卸载/零尺寸,条件渲染行)'; row.unmounted = true;
						out.push(row); continue;
					}
					row.skip = '不可达(被遮挡/面板未真正在最顶层)';
					try { var rr = hitEl.getBoundingClientRect(); var topEl = document.elementFromPoint(Math.min(Math.max(rr.left + rr.width / 2, 1), innerWidth - 1), Math.min(Math.max(rr.top + rr.height / 2, 1), innerHeight - 1));
						row.coveredBy = topEl ? (topEl.tagName + '.' + String(topEl.className && topEl.className.baseVal === undefined ? topEl.className : '').split(/\s+/).slice(0, 3).join('.') + ' ' + (txt(topEl) || '').slice(0, 20)) : '(视口外)'; row.rect = [Math.round(rr.left), Math.round(rr.top), Math.round(rr.width), Math.round(rr.height)]; } catch (e) { /* 诊断失败不影响判定 */ }
					out.push(row); continue;
				}
				if ((c.inner || c.el).disabled) { row.skip = 'disabled'; out.push(row); continue; }
				try {
					markSelf(c.el);
					var hit = false; var last = null; var nTry = 0; var unrestored = false;
					for (var t = 0; t < tries && !hit; t++) {
						var b = await fpFn(opts);
						// 跨页签指纹噪声基线:逐页签点过去再取 innerHTML,有的页(三式合一)连拍两次结构哈希就不同而文本不变 →
						// 不设基线时每个候选都「有反应」(28/28 实抓假绿)。连拍两次:结构不稳文本稳 = 改按文本 / 盘面 / 画布判;文本也不稳 = 判不了,不记反应
						var noisy = false;
						if (fpFn === HDS.fpAcrossTabs) {
							await sleep(waitMs);   // 两拍间隔 = 拨值到取样的间隔:与判定同一时间尺度上的抖动才抓得到
							var b2 = await fpFn(opts);
							if (!HDS.same(b, b2)) { noisy = (b.text === b2.text && (b.stage || '-') === (b2.stage || '-')) ? 'all' : 'text'; }
							b = b2;
						}
						var sameFp = function (x, y) {
							if (noisy === 'all') { return x.text === y.text && (x.stage || '-') === (y.stage || '-') && (x.canvas || '-') === (y.canvas || '-'); }
							return HDS.same(x, y);
						};
						var r = await actC(c, { waitMs: waitMs, tryIdx: t });
						if (r.skip) { if (t === 0) { row.skip = r.skip; if (r.n !== undefined) { row.取值数 = r.n; } } break; }
						nTry++;
						var a = await fpFn(opts);
						if (sameFp(b, a) && opts.slowCheck !== false) {
							// 慢页兜底:指纹暂未变时等页面稳定(连续两次取样相同)再取一次 —— 整页重绘晚于等待档时(六壬起课后约 10 秒)
							// 不这样做就会把真有效的控件误判无反应(负载下六壬 7 项实抓)
							await HDS.waitStable(opts.stableMaxMs || 15000, 800);
							a = await fpFn(opts);
						}
						await r.undo(); await settleAfter(waitMs * 0.8);
						// M-188:有的控件拨值 / 复原会把页面带到别的模块页签(下拉联动跳到另一主页签),
						// 之后同页所有控件都在错的页签上测(节点已卸载 → 全记未测,终态脏「→ undefined」);驱动器按 profile 的 clickText 预动作
						// 登记 reenterText,每个控件复原后再点一次原页签(已在该页签时是空操作)
						if (PROFILE.reenterText && window.__dsp && window.__dsp.clickText) {
							try { var back0 = window.__dsp.clickText(PROFILE.reenterText); if (back0 === true) { await settleAfter(waitMs * 0.5); } } catch (e) { /* 页签找不到按原状继续 */ }
						}
						hit = noisy === 'text' ? false : !sameFp(b, a);
						if (noisy) { row.noise = noisy; }
						if (PROFILE.canvas) { row.canvasB = b.canvas; row.canvasA = a.canvas; row.settle = HDS.lastSettle; }   // 画布页诊断列
						last = r; row.from = r.from; row.to = r.to; row.picked = r.picked; if (r.取值数 !== undefined) { row.取值数 = r.取值数; }
						if (r.selTxt !== undefined && r.selTxt !== null) { row.selTxt = r.selTxt; }   // 诊断列:下拉里 selected 项全文(M-182 形态② 判据)
						row.面 = b.stage !== a.stage ? '盘面' : ((a.canvas || '-') !== (b.canvas || '-') ? '画布' : '右栏');
						// 复原双臂:值回原(铁律 8)+ 指纹回原(异步重算给第二次机会再取一次)
						var valueBack = restored(c, r.from);
						var fb = await fpFn(opts); var fpBack = sameFp(b, fb);
						if (!fpBack) { await settleAfter(waitMs); fb = await fpFn(opts); fpBack = sameFp(b, fb); }
						// 结构指纹回不去但文本回去了(重挂载改了 DOM 结构/随机 id)按复原论;文本也回不去 = 状态泄漏进中栏
						var textBack = fpBack || (!!b.text && fb.text === b.text);
						row.复原值 = valueBack; row.复原面 = fpBack; row.复原文 = textBack;
						if (!valueBack || !textBack) { unrestored = true; break; }
						// 逐次覆盖而不是只写 false:第一次拨错、后几次拨对时旧写法把 false 钉死在行上,而 to/picked 已被最后一次覆盖 → 产物「0.25≠0.25」自相矛盾(主限「影响期(年)」实抓)
						if (r.to !== undefined && r.picked !== undefined && typeof r.to === 'string' && typeof r.picked === 'string' && !c.multiple) { row.选对了 = pickedOk(r); }
					}
					if (!row.skip) { row.反应 = hit; row.tries = nTry; row.复原 = !unrestored; }
					// 拨值打开了弹窗 / 抽屉(如七政「神煞筛选」弹出「盘面显示筛选」):记下并关掉,否则后续控件全判被遮挡、跨页签整轮开不了跑
					if (!blockedAtStart && !opts.allowBlocked && HDS.blockedBy()) { row.openedOverlay = HDS.blockedBy(); await HDS.dismissBlockers(); }
					out.push(row);
				} catch (e) { row.err = String(e).slice(0, 80); out.push(row); }
				unmarkSelf();
				await sleep(120);
			}
			if (HDS.__runToken === runToken) { unmarkSelf(); HDS.busy = false; }
		})();
		return 'started' + (label ? ' (' + label + ')' : '') + ': ' + HDS.total + ' controls';
	}
	HDS.run = function (rootSel, opts) { return runImpl(rootSel, opts, HDS.fpx, ''); };
	HDS.runIn = function (containerSel, opts) { return runImpl(containerSel, Object.assign({ allowBlocked: true }, opts || {}), HDS.fpx, 'in ' + containerSel); };

	HDS.report = function () {
		var o = HDS.out || [];
		return {
			进度: o.length + '/' + HDS.total, 跑完: !HDS.busy,
			无反应: o.filter(function (r) { return r.反应 === false; }).map(function (r) { return r.n + ' [' + (r.from || '') + '→' + (r.to || '') + ']'; }),
			选错: o.filter(function (r) { return r.选对了 === false; }).map(function (r) { return r.n + ':' + r.to + '≠' + r.picked; }),
			跳过: o.filter(function (r) { return r.skip; }).map(function (r) { return r.n + ':' + r.skip; }),
			未复原: o.filter(function (r) { return r.复原 === false; }).map(function (r) { return r.n; }),
			出错: o.filter(function (r) { return r.err; }).map(function (r) { return r.n + ':' + r.err; }),
		};
	};

	// v2:运行时可见控件集导出(选项宇宙产地③)。不拨值、不开面板(select 取值数需开面板,留 null)。
	HDS.dumpControls = function (rootSel) {
		return HDS.controls(rootSel).map(function (c) {
			try { c.el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) { /* noop */ }
			var d = { kind: c.kind, name: c.name, key: c.key, ctx: c.ctx, value: valueOf(c), hittable: hittable(c.el), disabled: !!((c.inner || c.el).disabled) };
			if (c.取值数 !== undefined) { d.取值数 = c.取值数; }
			if (c.multiple) { d.multiple = true; }
			if (c.range) { d.range = true; }
			var r = c.el.getBoundingClientRect(); d.rect = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
			d.tag = c.el.tagName.toLowerCase() + (c.el.className && typeof c.el.className === 'string' ? '.' + c.el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
			return d;
		});
	};

	/**
	 * 多页批跑:在同一个大模块内沿 rail 逐页 goto→expandAll→selfTest→run。
	 * selfTest 失败的页面直接记为「审计器未自证」而不出结论 —— 未自证的绿色一文不值。
	 */
	HDS.runPages = function (pages, opts) {
		opts = opts || {};
		var pagesToken = HDS.__pagesToken = (HDS.__pagesToken || 0) + 1;
		HDS.pagesOut = {}; HDS.pagesBusy = true; HDS.abort = false;
		(async function () {
			for (var i = 0; i < pages.length; i++) {
				if (HDS.abort || HDS.__pagesToken !== pagesToken) { break; }
				var p = pages[i];
				var name = typeof p === 'string' ? p : p.rail;
				var g = await HDS.goto(name, typeof p === 'string' ? null : p.expect);
				if (!g.ok) { HDS.pagesOut[name] = { 跳过: g.why || '身份核对失败', 区: g.titles }; continue; }
				await HDS.expandAll();
				var probe = (typeof p === 'string' ? null : p.selfTest);
				var st = probe ? await HDS.selfTest(probe, opts.rootSel) : { ok: null };
				if (st.ok === false) { HDS.pagesOut[name] = { 审计器未自证: st.why || probe }; continue; }
				HDS.run(opts.rootSel, opts);
				while (HDS.busy) { await sleep(400); }
				HDS.pagesOut[name] = HDS.report();
			}
			if (HDS.__pagesToken === pagesToken) { HDS.pagesBusy = false; }
		})();
		return 'batch started: ' + pages.length + ' pages';
	};

	HDS.pagesReport = function () {
		var out = {};
		Object.keys(HDS.pagesOut || {}).forEach(function (k) {
			var r = HDS.pagesOut[k];
			out[k] = r.无反应 ? { 进度: r.进度, 死开关: r.无反应, 跳过: r.跳过 } : r;
		});
		return { 跑完: !HDS.pagesBusy, 结果: out };
	};

	/**
	 * 弹层审计:左栏「显示星体 / 宫位与黄道 / 显示与样式 / 快捷切换」这类入口按钮背后的设置面板。
	 * 它们不在左栏 DOM 里,默认 rootSel 扫不到 —— 而这里恰恰是开关最密集的地方。
	 */
	// ── 设置弹窗/抽屉/下拉面板里的选项(openers):点开 → 在容器内跑同一套快轮 → 关上 ──
	// 效果仍看主区指纹(弹窗在 body portal 里,不进指纹);提交钮(PROFILE.commitText)照常点。
	function openContainers() {
		var modals = [].slice.call(document.querySelectorAll('.ant-modal-wrap')).filter(function (w) { return modalOpen(w) && w.getBoundingClientRect().width > 0; }).map(function (w) { return w.querySelector('.ant-modal-content'); });
		var drawers = [].slice.call(document.querySelectorAll('.ant-drawer-open .ant-drawer-content, .ant-drawer-open .ant-drawer-content-wrapper')).filter(function (d) { return d.getBoundingClientRect().width > 0; });
		var pops = [].slice.call(document.querySelectorAll('.ant-popover:not(.ant-popover-hidden), .ant-dropdown:not(.ant-dropdown-hidden)')).filter(function (p) { return p.getBoundingClientRect().height > 20 && parseFloat(getComputedStyle(p).opacity || '0') > 0.5; });
		return modals.concat(drawers, pops).filter(Boolean);
	}
	async function closeContainer(el) {
		if (!el) { return; }
		var wrap = el.closest('.ant-modal-wrap, .ant-drawer');
		var btn = wrap ? wrap.querySelector('.ant-modal-close, .ant-drawer-close') : null;
		if (btn) { clickEl(btn); } else { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true })); document.body.click(); }
		await sleep(500);
	}
	HDS.runOpener = async function (text, opts) {
		opts = opts || {};
		var want = String(text).replace(/\s+/g, '');
		var btn = vis('button, [role=button], a').filter(function (b) { return (b.textContent || '').replace(/\s+/g, '').indexOf(want) === 0; })[0];
		if (!btn) { return { opener: text, skip: '找不到入口按钮' }; }
		var before = openContainers();
		clickEl(btn); await sleep(opts.openMs || 1200);
		var after = openContainers().filter(function (c) { return before.indexOf(c) < 0; });
		var box = after[after.length - 1] || null;
		if (!box) { return { opener: text, skip: '点开后未出现弹窗/抽屉/浮层' }; }
		if (!box.id) { box.id = 'hds-open-' + Math.random().toString(36).slice(2, 8); }
		try { await HDS.expandAll(); } catch (e) { /* noop */ }
		var ctrlN = HDS.controls('#' + box.id).filter(function (c) { return SWITCHABLE.indexOf(c.kind) >= 0; }).length;
		HDS.runIn('#' + box.id, { waitMs: opts.waitMs || PROFILE.waitMs, valueTries: opts.valueTries });
		while (HDS.busy) { await sleep(300); }
		var res = { opener: text, container: box.className.split(' ').slice(0, 2).join('.'), controls: ctrlN, report: HDS.report(), rows: HDS.out };
		if (document.getElementById(box.id)) { await closeContainer(document.getElementById(box.id)); }
		return res;
	};
	HDS.runOpenerStart = function (text, opts) {
		HDS.openerBusy = true; HDS.openerOut = null;
		HDS.runOpener(text, opts).then(function (r) { HDS.openerOut = r; HDS.openerBusy = false; }, function (e) { HDS.openerOut = { opener: text, err: String(e).slice(0, 120) }; HDS.openerBusy = false; });
		return 'opener started';
	};
	HDS.closeAllPopovers = async function () {
		for (var k = 0; k < 4; k++) {
			var open = [].slice.call(document.querySelectorAll('.ant-popover')).filter(function (p) {
				return !p.classList.contains('ant-popover-hidden') && parseFloat(getComputedStyle(p).opacity || '0') > 0.5;
			});
			if (!open.length) { return true; }
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
			document.body.click();
			await sleep(450);
		}
		return false;
	};

	HDS.runPopovers = function (opts) {
		opts = opts || {};
		var popToken = HDS.__popToken = (HDS.__popToken || 0) + 1;   // 同 runImpl 轮次令牌:超时后的旧弹层循环醒来自行退出
		HDS.popOut = {}; HDS.popBusy = true; HDS.abort = false;
		// 🔴 antd 的四个设置面板同时留在 DOM 里、且都不带 ant-popover-hidden,只靠 opacity 区分,
		//    也没有 aria-describedby 可关联。若按「最后一个未 hidden 的 popover」取,会把三个
		//    不可见面板的控件一起扫进去 —— 那些点击根本不生效,于是整批被误判成死开关(实测 27 个假报)。
		//    判据改为:标题文字与按钮名互相包含 + opacity 为 1。关闭也必须再点一次按钮,body.click() 关不掉。
		var pickPanel = function (btnName) {
			var cands = [].slice.call(document.querySelectorAll('.ant-popover')).filter(function (p) {
				if (p.classList.contains('ant-popover-hidden')) { return false; }
				if (parseFloat(getComputedStyle(p).opacity || '0') < 0.9) { return false; }
				return p.getBoundingClientRect().height > 40;
			});
			var key = String(btnName || '').replace(/\s+/g, '');
			return cands.filter(function (p) {
				var title = ((p.innerText || '').trim().split('\n')[0] || '').replace(/\s+/g, '');
				return title && (title.indexOf(key) >= 0 || key.indexOf(title) >= 0);
			})[0] || (cands.length === 1 ? cands[0] : null);
		};
		(async function () {
			if (opts.crossTab) { try { await HDS.mountAllTabs(opts.tabScope); } catch (e) { /* 挂载失败退化为单视图 */ } }
			var btns = vis(opts.btnSel || '.horosa-input-nav-stack .ant-btn');
			var names = btns.map(function (b) { return b.innerText.trim(); });
			for (var i = 0; i < btns.length; i++) {
				if (HDS.abort || HDS.__popToken !== popToken) { break; }
				await HDS.closeAllPopovers();
				btns[i].click(); await sleep(opts.openMs || 2400);   // fade-in 未完时 opacity<0.9,面板会被判为「未定位」
				var p = pickPanel(names[i]);
				if (!p) { HDS.popOut[names[i]] = { 跳过: '面板未定位(标题不匹配或未完全展开)' }; await HDS.closeAllPopovers(); continue; }
				if (!p.id) { p.id = 'hds-pop-' + i; }
				// crossTab:弹层里的判读口径多数只改右栏未打开的页签 → 开跑前已 mountAllTabs,此处用跨页签指纹(否则整批假「无反应」)
				(opts.crossTab ? HDS.runAcrossTabs : HDS.run)('#' + p.id, Object.assign({}, opts, { kinds: opts.kinds || SWITCHABLE.filter(function (k) { return k !== 'quicktime'; }), allowBlocked: true }));
				while (HDS.busy) { await sleep(400); }
				HDS.popOut[names[i]] = HDS.report();
				HDS.popOut[names[i]].rows = HDS.out.slice();
				HDS.popOut[names[i]].面板标题 = (p.innerText || '').trim().split('\n')[0];
				await HDS.closeAllPopovers();
			}
			// 未跑到的面板也要留名(外层据此判「弹层轮没跑完」,不能只看已跑面板全绿)
			if (HDS.__popToken === popToken) {
				names.forEach(function (nm) { if (!HDS.popOut[nm]) { HDS.popOut[nm] = { 未开跑: true }; } });
				HDS.popBusy = false;
			}
		})();
		return 'popover audit started';
	};

	HDS.popReport = function () {
		var out = {};
		Object.keys(HDS.popOut || {}).forEach(function (k) {
			var r = HDS.popOut[k];
			out[k] = r.无反应 ? { 面板: r.面板标题, 进度: r.进度, 死开关: r.无反应, 跳过: r.跳过, rows: r.rows } : r;
		});
		return { 跑完: !HDS.popBusy, 结果: out };
	};

	HDS.hittable = function (el) { return hittable(el); };
	/** 开跑前拍一张开关态快照;中止后用 diffState 比对,把脏状态找出来手工复原。 */
	HDS.dumpState = function (rootSel) {
		var out = {}; var slots = {};
		HDS.controls(rootSel).forEach(function (c) {
			if (SWITCHABLE.indexOf(c.kind) < 0) { return; }
			var k = c.kind + ':' + (c.key || c.name) + (c.ctx ? '@' + c.ctx : '');
			var v = valueOf(c);
			if (Object.prototype.hasOwnProperty.call(out, k)) { k += '#' + Object.keys(out).length; }
			out[k] = v;
			slots[c.kind + '|' + (c.ctx || '') + '|' + c.slot] = k;
		});
		// 位次索引(不可枚举进 diff):标签带动态后缀(如「日月食击本命(区间>6年不适用)」)时按 kind+ctx+序号对上同一控件
		out.__slots = slots;
		return out;
	};

	HDS.diffState = function (before, rootSel) {
		var now = HDS.dumpState(rootSel), diff = [];
		var bSlots = before.__slots || {}; var nSlots = now.__slots || {};
		var bySlotKey = {}; Object.keys(bSlots).forEach(function (sk) { bySlotKey[bSlots[sk]] = sk; });
		Object.keys(before).forEach(function (k) {
			if (k === '__slots') { return; }
			var nv = now[k]; var via = '';
			if (nv === undefined && bySlotKey[k] && nSlots[bySlotKey[k]] !== undefined) { var nk = nSlots[bySlotKey[k]]; nv = now[nk]; via = ' (标签变为 ' + nk.split('@')[0] + ')'; }
			if (String(before[k]) !== String(nv)) { diff.push(k + ': ' + before[k] + ' → ' + nv + via); }
		});
		return diff;
	};

	/**
	 * 🔴 把右栏(以及中栏)所有子 tab 都点一遍,强制惰性挂载,最后回到原来那个。
	 * 不做这一步,「只改某个未打开页签」的开关会被一律误判为死开关 —— 指纹里根本没有那块内容。
	 * 返回挂载了多少个 tab;跑审计前调用一次即可(挂载后即便隐藏,innerHTML 仍进指纹)。
	 */
	HDS.mountAllTabs = async function (scopeSel) {
		var scope = scopeSel || PROFILE.tabScope;
		var roots = vis(scope);
		var mounted = 0, names = [];
		for (var i = 0; i < roots.length; i++) {
			var tabs = [].slice.call(roots[i].querySelectorAll('[role="tab"], .ant-tabs-tab'))
				.filter(function (e) { return e.getBoundingClientRect().width > 0; });
			if (tabs.length < 2) { continue; }
			var active = tabs.filter(function (e) { return (e.className || '').indexOf('active') >= 0; })[0] || tabs[0];
			for (var k = 0; k < tabs.length; k++) {
				if (tabs[k] === active) { continue; }
				tabs[k].click(); mounted++; names.push((tabs[k].innerText || '').trim());
				await sleep(420);
			}
			active.click(); await sleep(420);   // 回到原页签,别把用户的视图留在别处
		}
		return { mounted: mounted, tabs: names };
	};

	/**
	 * 🔴🔴 跨页签指纹:依次激活每个子 tab 取样再拼接。
	 *
	 * 为什么不能只 mountAllTabs 就完事:挂载只保证那块 DOM 存在,**不保证它随开关重算**。
	 * antd 用 display:none 藏起非激活页,而各判读页普遍是「激活时才算」——隐藏期内容冻在
	 * 挂载那一刻的旧值,于是改开关后指纹纹丝不动。实测:卜卦盘 29 控件在「只看当前页」下
	 * 报 0 死开关,挂载全部 tab 后反而报 13 个「无反应」,正是这个冻结在作怪。
	 * 唯一可靠的办法是让每个页签轮流处于激活态,各取一次样。
	 *
	 * 代价是每次取指纹要点 N 个页签,慢 N 倍 —— 但这是「测得准」的唯一价格。
	 */
	HDS.fpAcrossTabs = async function (opts) {
		opts = opts || {};
		var scope = opts.tabScope || PROFILE.tabScope;
		var roots = vis(scope);
		var tabs = [];
		roots.forEach(function (r) {
			[].slice.call(r.querySelectorAll('[role="tab"], .ant-tabs-tab'))
				.filter(function (e) { return e.getBoundingClientRect().width > 0; })
				.forEach(function (e) { if (tabs.indexOf(e) < 0) { tabs.push(e); } });
		});
		if (tabs.length < 2) { return HDS.fpx(); }
		var active = tabs.filter(function (e) { return (e.className || '').indexOf('active') >= 0; })[0] || tabs[0];
		var parts = []; var texts = [];
		for (var i = 0; i < tabs.length; i++) {
			tabs[i].click();
			await sleep(opts.tabMs || 340);
			var fi = HDS.fp(); parts.push(fi.all); texts.push(fi.text);
		}
		active.click(); await sleep(opts.tabMs || 340);
		var f = await HDS.fpx();
		return { all: hash(parts.join('|')), stage: f.stage, canvas: f.canvas, text: hash(texts.join('|')) };
	};

	/** 跨页签版差分:每个控件切换前后各做一次 fpAcrossTabs。慢,但不会漏掉「只改别的页签」的开关。 */
	// 🔴 2026-08 审计器缺陷根修:旧写法借 selectDiff 换值,但 selectDiff **自含复原**,第二次调用结束时值已回原位,
	//    after 取的是复原态 → select 类「反应」恒 false,整类系统性假死报。v2 统一走 act():换值(不复原)→ 取样 → undo。
	HDS.runAcrossTabs = function (rootSel, opts) { return runImpl(rootSel, opts, HDS.fpAcrossTabs, 'across tabs'); };

	HDS.install = function () { root.HDS = HDS; return 'HDS installed'; };
	root.HDS = HDS;
})(typeof window !== 'undefined' ? window : this);
