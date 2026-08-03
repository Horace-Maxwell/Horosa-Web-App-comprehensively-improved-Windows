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
 * 用法:
 *   HDS.install();
 *   await HDS.goto('卜卦盘', '判读参数');     // 切页并核对身份(rail 项在辅盘内才有)
 *   await HDS.expandAll();                    // 折叠区宽高为 0 会被可见性过滤掉
 *   await HDS.selfTest('界限环');             // ① 自证:必须返回 true
 *   HDS.run('.horosa-horary-param-grid');     // 后台跑,避开控制台单次执行时限
 *   HDS.report();                             // 轮询取结果
 */
(function (root) {
	var HDS = {};
	var HDS_hittable;

	function hash(s) {
		s = String(s || '');
		var a = 5381;
		for (var i = 0; i < s.length; i++) { a = ((a << 5) + a + s.charCodeAt(i)) | 0; }
		return a + '/' + s.length;
	}
	function vis(sel) {
		return [].slice.call(document.querySelectorAll(sel)).filter(function (e) {
			return e.getBoundingClientRect().width > 0;
		});
	}
	function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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

	// 与 src/utils/shortOptionLabel.js 同规则:收起态可能只显示剥括号短名。
	function shortOf(s) {
		s = String(s == null ? '' : s).trim();
		var m = s.match(/^(.*?)[（(][^）)]*[）)]\s*$/);
		var head = m && m[1] ? m[1].trim() : '';
		return head || s;
	}
	function sameOption(a, b) {
		a = String(a || '').trim(); b = String(b || '').trim();
		return a === b || shortOf(a) === shortOf(b) || shortOf(a) === b || a === shortOf(b);
	}

	// 指纹取**可见的**盘面网格全量:右栏判读正文并不都在 .horosa-inspector-panel 内,
	// 只取 panel 会漏掉判读容器 → 一堆真开关被误判成死的(实测 10 个)。
	// 指纹取「可见主内容区,但**剔除左栏自身**」。
	//   · 不剔左栏 → 勾选态自己就会改 DOM,每个开关都「有反应」,审计等于没做。
	//   · 只认 .horosa-astro-redesign-grid → 只适用于西洋盘族;紫微/八字/六壬等各有各的容器,
	//     一律返回 '-' 而恒等,于是整页开关被误判成死的。故改为按一组候选容器兜底。
	var MAIN_SEL = '.horosa-astro-redesign-grid, .horosa-ziwei-redesign-grid, .horosa-workspace-main, .ant-layout-content';
	var LEFT_SEL = '.horosa-astro-input-panel, .horosa-astro-context-panel, .horosa-ziwei-input-panel, .horosa-side-input-section, .xq-side-section';
	// innerHTML 天然包含 display:none 的子树,所以**已挂载但不可见**的右栏 tab 也进指纹。
	// 但惰性 tab 若从未被点开就根本不在 DOM 里 —— 那部分要靠 mountAllTabs() 先撑起来。
	HDS.fp = function () {
		var g = vis(MAIN_SEL)[0];
		var st = vis('.horosa-chart-stage')[0] || vis('[class*="chart-stage"], [class*="chart-viewport"]')[0];
		if (!g) { return { all: '-', stage: st ? hash(st.innerHTML) : '-' }; }
		var clone = g.cloneNode(true);
		clone.querySelectorAll(LEFT_SEL).forEach(function (n) { n.remove(); });
		return { all: hash(clone.innerHTML), stage: st ? hash(st.innerHTML) : '-' };
	};
	HDS.same = function (a, b) { return a.all === b.all; };

	HDS.controls = function (rootSel) {
		var out = [];
		vis(rootSel || '.horosa-astro-input-panel,.horosa-astro-context-panel').forEach(function (r) {
			r.querySelectorAll('input[type=checkbox]').forEach(function (el) {
				out.push({ kind: 'checkbox', el: el, name: ((el.closest('.ant-checkbox-wrapper') || {}).innerText || '').trim().slice(0, 26) });
			});
			r.querySelectorAll('.ant-switch').forEach(function (el) {
				out.push({ kind: 'switch', el: el, name: ((el.parentElement || {}).innerText || '').trim().slice(0, 26) });
			});
			r.querySelectorAll('.ant-select').forEach(function (el) {
				var b = el.closest('.horosa-field-block');
				var l = b && b.querySelector('.horosa-field-label');
				out.push({ kind: 'select', el: el, name: ((l ? l.innerText : el.innerText) || '').trim().slice(0, 26) });
			});
			r.querySelectorAll('.ant-radio-button-wrapper').forEach(function (el) {
				out.push({ kind: 'radio', el: el, name: (el.innerText || '').trim().slice(0, 26) });
			});
			// 🔴 自研控件必须单列:左栏四个入口按钮弹出的设置面板里,开关根本不是 antd 的
			//    input[type=checkbox],而是 .xq-check-item / .xq-toggle 这类自研芯片。
			//    只扫 antd 选择器 = 整个弹层被当成「0 个控件」而静默跳过 —— 死开关最容易藏的就是这里。
			r.querySelectorAll('.xq-check-item').forEach(function (el) {
				out.push({ kind: 'chip', el: el, name: (el.innerText || '').trim().slice(0, 26) });
			});
			r.querySelectorAll('.xq-toggle').forEach(function (el) {
				out.push({ kind: 'toggle', el: el, name: (el.innerText || '').trim().slice(0, 26) });
			});
		});
		return out;
	};

	// 🔴 铁律②:按 aria-controls 精确定位本 select 的面板。
	HDS.panelOf = function (sel) {
		var inp = sel.querySelector('input[aria-controls],input[aria-owns]');
		var id = inp && (inp.getAttribute('aria-controls') || inp.getAttribute('aria-owns'));
		if (!id) { return null; }
		var list = document.getElementById(id);
		var dd = list && list.closest('.ant-select-dropdown');
		if (!dd || dd.classList.contains('ant-select-dropdown-hidden')) { return null; }
		return dd;
	};

	HDS.selectDiff = async function (sel, waitMs) {
		waitMs = waitMs || 700;
		var open = function () {
			var s = sel.querySelector('.ant-select-selector') || sel;
			s.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			s.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		};
		var close = function () { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); document.body.click(); };
		var curTxt = function () { return ((sel.querySelector('.ant-select-selection-item') || {}).textContent || '').trim(); };
		var cur = curTxt();
		open(); await sleep(300);
		var dd = HDS.panelOf(sel);
		if (!dd) { close(); return { skip: '面板未开/未关联' }; }
		var opts = [].slice.call(dd.querySelectorAll('.ant-select-item-option'));
		if (opts.length < 2) { close(); return { skip: '取值<2', n: opts.length }; }
		var other = opts.filter(function (o) { return !o.classList.contains('ant-select-item-option-selected'); })[0];
		if (!other) { close(); return { skip: '全为选中态' }; }
		var toTxt = other.textContent.trim();
		var before = HDS.fp();
		other.click(); await sleep(waitMs);
		var picked = curTxt();
		var after = HDS.fp();
		// 复原:重开**本** select 的面板,按原值(允许短名/全名互认)选回
		open(); await sleep(300);
		var dd2 = HDS.panelOf(sel);
		var back = dd2 && [].slice.call(dd2.querySelectorAll('.ant-select-item-option')).filter(function (o) { return sameOption(o.textContent, cur); })[0];
		if (back) { back.click(); } else { close(); }
		await sleep(waitMs);
		// 复原判据取「显示值回到原文本」而非指纹相等:右栏重算是异步的,
		// 指纹法会把一堆其实已回位的项误报成未复原(实测 14/14 假报)。
		return {
			from: cur, to: toTxt, picked: picked,
			选对了: sameOption(picked, toTxt),
			反应: !HDS.same(before, after),
			面: before.stage !== after.stage ? '盘面' : '右栏',
			复原: sameOption(curTxt(), cur),
			取值数: opts.length,
		};
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
		var secs = vis('.horosa-astro-input-panel .xq-side-section, .horosa-astro-context-panel .xq-side-section');
		for (var i = 0; i < secs.length; i++) {
			var s = secs[i];
			var body = s.querySelector('.xq-side-section-body,.xq-side-section-body-inner');
			if (body && body.getBoundingClientRect().height < 8) {
				var head = s.querySelector('.xq-side-section-head,[class*=head]') || s.firstElementChild;
				if (head) { head.click(); opened++; await sleep(260); }
			}
		}
		return opened;
	};

	// 🔴 铁律①:自证。传一个已知有效开关的名字片段,必须返回 ok:true。
	HDS.selfTest = async function (nameFragment, rootSel) {
		var c = HDS.controls(rootSel).filter(function (x) { return (x.kind === 'checkbox' || x.kind === 'chip' || x.kind === 'toggle') && x.name.indexOf(nameFragment) >= 0; })[0];
		if (!c) { return { ok: false, why: '未找到自证开关 ' + nameFragment }; }
		var b = HDS.fp(); c.el.click(); await sleep(800);
		var a = HDS.fp(); c.el.click(); await sleep(700);
		return { ok: !HDS.same(b, a), 复原: HDS.same(b, HDS.fp()), 开关: c.name };
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

	HDS.run = function (rootSel, opts) {
		opts = opts || {};
		var blocked = HDS.blockedBy();
		if (blocked && !(opts && opts.allowBlocked)) {
			HDS.out = [{ n: '(未开跑)', k: '-', skip: '全屏遮挡:' + blocked + ' —— 先关掉再审计' }];
			HDS.busy = false; HDS.total = 0;
			return 'ABORTED: blocked by ' + blocked;
		}
		HDS.out = []; HDS.busy = true; HDS.abort = false;
		var ctrls = HDS.controls(rootSel).filter(function (c) { return !opts.kinds || opts.kinds.indexOf(c.kind) >= 0; });
		HDS.total = ctrls.length;
		(async function () {
			for (var i = 0; i < ctrls.length; i++) {
				if (HDS.abort) { break; }
				var c = ctrls[i];
				// 面板内多数控件要滚动才进视口:先滚到中间再做命中测试,否则「视口外」会被误记为不可达
				try { c.el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) { /* 老内核无 options */ }
				await sleep(150);
				if (!hittable(c.el)) { HDS.out.push({ n: c.name, k: c.kind, skip: '不可达(被遮挡/面板未真正在最顶层)' }); continue; }
				try {
					if (c.kind === 'select') {
						var d = await HDS.selectDiff(c.el, opts.waitMs || 700);
						HDS.out.push(Object.assign({ n: c.name, k: c.kind }, d));
					} else {
						if (c.el.disabled) { HDS.out.push({ n: c.name, k: c.kind, skip: 'disabled' }); continue; }
						var b = HDS.fp(); c.el.click(); await sleep(opts.waitMs || 700);
						var a = HDS.fp();
						c.el.click(); await sleep((opts.waitMs || 700) * 0.8);
						HDS.out.push({ n: c.name, k: c.kind, 反应: !HDS.same(b, a), 面: b.stage !== a.stage ? '盘面' : '右栏', 复原: HDS.same(b, HDS.fp()) });
					}
				} catch (e) { HDS.out.push({ n: c.name, k: c.kind, err: String(e).slice(0, 50) }); }
				await sleep(120);
			}
			HDS.busy = false;
		})();
		return 'started: ' + HDS.total + ' controls';
	};

	HDS.report = function () {
		var o = HDS.out || [];
		return {
			进度: o.length + '/' + HDS.total, 跑完: !HDS.busy,
			无反应: o.filter(function (r) { return r.反应 === false; }).map(function (r) { return r.n + ' [' + (r.from || '') + '→' + (r.to || '') + ']'; }),
			选错: o.filter(function (r) { return r.选对了 === false; }).map(function (r) { return r.n + ':' + r.to + '≠' + r.picked; }),
			跳过: o.filter(function (r) { return r.skip; }).map(function (r) { return r.n + ':' + r.skip; }),
			未复原: o.filter(function (r) { return r.复原 === false; }).map(function (r) { return r.n; }),
		};
	};

	/**
	 * 多页批跑:在同一个大模块内沿 rail 逐页 goto→expandAll→selfTest→run。
	 * selfTest 失败的页面直接记为「审计器未自证」而不出结论 —— 未自证的绿色一文不值。
	 */
	HDS.runPages = function (pages, opts) {
		opts = opts || {};
		HDS.pagesOut = {}; HDS.pagesBusy = true; HDS.abort = false;
		(async function () {
			for (var i = 0; i < pages.length; i++) {
				if (HDS.abort) { break; }
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
			HDS.pagesBusy = false;
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
			})[0] || null;
		};
		(async function () {
			var btns = vis(opts.btnSel || '.horosa-input-nav-stack .ant-btn');
			var names = btns.map(function (b) { return b.innerText.trim(); });
			for (var i = 0; i < btns.length; i++) {
				if (HDS.abort) { break; }
				await HDS.closeAllPopovers();
				btns[i].click(); await sleep(opts.openMs || 2400);   // fade-in 未完时 opacity<0.9,面板会被判为「未定位」
				var p = pickPanel(names[i]);
				if (!p) { HDS.popOut[names[i]] = { 跳过: '面板未定位(标题不匹配或未完全展开)' }; await HDS.closeAllPopovers(); continue; }
				if (!p.id) { p.id = 'hds-pop-' + i; }
				HDS.run('#' + p.id, Object.assign({}, opts, { kinds: opts.kinds || ['chip', 'toggle', 'checkbox', 'select', 'switch'] }));
				while (HDS.busy) { await sleep(400); }
				HDS.popOut[names[i]] = HDS.report();
				HDS.popOut[names[i]].面板标题 = (p.innerText || '').trim().split('\n')[0];
				await HDS.closeAllPopovers();
			}
			HDS.popBusy = false;
		})();
		return 'popover audit started';
	};

	HDS.popReport = function () {
		var out = {};
		Object.keys(HDS.popOut || {}).forEach(function (k) {
			var r = HDS.popOut[k];
			out[k] = r.无反应 ? { 面板: r.面板标题, 进度: r.进度, 死开关: r.无反应 } : r;
		});
		return { 跑完: !HDS.popBusy, 结果: out };
	};

	HDS.hittable = function (el) { return hittable(el); };
	/** 开跑前拍一张开关态快照;中止后用 diffState 比对,把脏状态找出来手工复原。 */
	HDS.dumpState = function (rootSel) {
		var out = {};
		HDS.controls(rootSel).forEach(function (c) {
			if (c.kind === 'checkbox') { out[c.name] = !!c.el.checked; }
			else if (c.kind === 'select') { out[c.name] = ((c.el.querySelector('.ant-select-selection-item') || {}).textContent || '').trim(); }
			else if (c.kind === 'chip') { out[c.name] = c.el.classList.contains('xq-check-item-checked'); }
			else if (c.kind === 'toggle') { out[c.name] = c.el.classList.contains('xq-toggle-active'); }
		});
		return out;
	};

	HDS.diffState = function (before, rootSel) {
		var now = HDS.dumpState(rootSel), diff = [];
		Object.keys(before).forEach(function (k) {
			if (String(before[k]) !== String(now[k])) { diff.push(k + ': ' + before[k] + ' → ' + now[k]); }
		});
		return diff;
	};

	/**
	 * 🔴 把右栏(以及中栏)所有子 tab 都点一遍,强制惰性挂载,最后回到原来那个。
	 * 不做这一步,「只改某个未打开页签」的开关会被一律误判为死开关 —— 指纹里根本没有那块内容。
	 * 返回挂载了多少个 tab;跑审计前调用一次即可(挂载后即便隐藏,innerHTML 仍进指纹)。
	 */
	HDS.mountAllTabs = async function (scopeSel) {
		var scope = scopeSel || '.horosa-inspector-panel, .horosa-chart-stage';
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
		var scope = opts.tabScope || '.horosa-inspector-panel, .horosa-chart-stage';
		var roots = vis(scope);
		var tabs = [];
		roots.forEach(function (r) {
			[].slice.call(r.querySelectorAll('[role="tab"], .ant-tabs-tab'))
				.filter(function (e) { return e.getBoundingClientRect().width > 0; })
				.forEach(function (e) { if (tabs.indexOf(e) < 0) { tabs.push(e); } });
		});
		if (tabs.length < 2) { return HDS.fp(); }
		var active = tabs.filter(function (e) { return (e.className || '').indexOf('active') >= 0; })[0] || tabs[0];
		var parts = [];
		for (var i = 0; i < tabs.length; i++) {
			tabs[i].click();
			await sleep(opts.tabMs || 340);
			parts.push(HDS.fp().all);
		}
		active.click(); await sleep(opts.tabMs || 340);
		return { all: hash(parts.join('|')), stage: HDS.fp().stage };
	};

	/** 跨页签版差分:每个控件切换前后各做一次 fpAcrossTabs。慢,但不会漏掉「只改别的页签」的开关。 */
	HDS.runAcrossTabs = function (rootSel, opts) {
		opts = opts || {};
		var blocked = HDS.blockedBy();
		if (blocked && !opts.allowBlocked) {
			HDS.out = [{ n: '(未开跑)', k: '-', skip: '全屏遮挡:' + blocked }];
			HDS.busy = false; HDS.total = 0;
			return 'ABORTED: blocked by ' + blocked;
		}
		HDS.out = []; HDS.busy = true; HDS.abort = false;
		var ctrls = HDS.controls(rootSel).filter(function (c) { return !opts.kinds || opts.kinds.indexOf(c.kind) >= 0; });
		// opts.names:只跑名单内控件(分层审计:快轮单页签筛活者,只对无反应候选跨页签定罪;
		// 39 控件全量跨页签 ~50 分钟 → 候选数 × ~80s)
		if (opts.names && opts.names.length) {
			ctrls = ctrls.filter(function (c) { return opts.names.some(function (n) { return c.name.indexOf(n) >= 0; }); });
		}
		HDS.total = ctrls.length;
		(async function () {
			for (var i = 0; i < ctrls.length; i++) {
				if (HDS.abort) { break; }
				var c = ctrls[i];
				try { c.el.scrollIntoView({ block: 'center' }); } catch (e) { /* noop */ }
				await sleep(140);
				if (c.el.disabled) { HDS.out.push({ n: c.name, k: c.kind, skip: 'disabled' }); continue; }
				if (!hittable(c.el)) { HDS.out.push({ n: c.name, k: c.kind, skip: '不可达' }); continue; }
				try {
					if (c.kind === 'select') {
						// 🔴 2026-08 审计器缺陷根修:旧写法借 selectDiff 换值,但 selectDiff **自含复原**,
						//    第二次调用结束时值已回原位,after 取的是复原态 → select 类「反应」恒 false,
						//    整类系统性假死报。改为内联换值(不复原)→ 跨页签指纹 → 再手工选回。
						var sOpen = function () {
							var s = c.el.querySelector('.ant-select-selector') || c.el;
							s.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
							s.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
						};
						var sCur = function () { return ((c.el.querySelector('.ant-select-selection-item') || {}).textContent || '').trim(); };
						var sFrom = sCur();
						var before = await HDS.fpAcrossTabs(opts);
						sOpen(); await sleep(300);
						var sDD = HDS.panelOf(c.el);
						if (!sDD) { document.body.click(); HDS.out.push({ n: c.name, k: c.kind, skip: '面板未开/未关联' }); continue; }
						var sOpts = [].slice.call(sDD.querySelectorAll('.ant-select-item-option'));
						var sOther = sOpts.filter(function (o) { return !o.classList.contains('ant-select-item-option-selected'); })[0];
						if (sOpts.length < 2 || !sOther) { document.body.click(); HDS.out.push({ n: c.name, k: c.kind, skip: '取值<2' }); continue; }
						var sTo = sOther.textContent.trim();
						sOther.click(); await sleep(opts.waitMs || 700);
						var after = await HDS.fpAcrossTabs(opts);		// 改值态取样(未复原)
						sOpen(); await sleep(300);
						var sDD2 = HDS.panelOf(c.el);
						var sBack = sDD2 && [].slice.call(sDD2.querySelectorAll('.ant-select-item-option')).filter(function (o) { return sameOption(o.textContent, sFrom); })[0];
						if (sBack) { sBack.click(); } else { document.body.click(); }
						await sleep(opts.waitMs || 700);
						HDS.out.push({ n: c.name, k: c.kind, from: sFrom, to: sTo, 反应: !HDS.same(before, after), 复原: sameOption(sCur(), sFrom) });
					} else {
						var b = await HDS.fpAcrossTabs(opts);
						c.el.click(); await sleep(opts.waitMs || 700);
						var a = await HDS.fpAcrossTabs(opts);
						c.el.click(); await sleep((opts.waitMs || 700) * 0.8);
						HDS.out.push({ n: c.name, k: c.kind, 反应: !HDS.same(b, a), 复原: HDS.same(b, await HDS.fpAcrossTabs(opts)) });
					}
				} catch (e) { HDS.out.push({ n: c.name, k: c.kind, err: String(e).slice(0, 50) }); }
				await sleep(120);
			}
			HDS.busy = false;
		})();
		return 'started (across tabs): ' + HDS.total + ' controls';
	};

	HDS.install = function () { root.HDS = HDS; return 'HDS installed'; };
	root.HDS = HDS;
})(typeof window !== 'undefined' ? window : this);
