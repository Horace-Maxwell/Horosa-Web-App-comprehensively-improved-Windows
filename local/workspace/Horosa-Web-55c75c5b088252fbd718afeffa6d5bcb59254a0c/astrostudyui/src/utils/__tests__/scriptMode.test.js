// 界面简繁 · 显示层引擎:只改看到的字、原文逐节点记住、切回简体逐字复原;不碰输入 / 可编辑区 / 代码块
import {
	SCRIPT_HANS, SCRIPT_HANT, SCRIPT_LS_KEY, SCRIPT_APPLIED_EVENT,
	applyScriptMode, setScriptMode, currentScriptMode, getStoredScriptMode, readOriginalText,
	bootScriptMode, prebootScriptMode, withOriginalScript, scriptMatchKey, matchesUserQuery, scriptFilterBy,
	subscribeScriptMode, scriptWordAttrs, attachScriptDocument,
	__resetScriptModeForTest, __setConverterForTest, __setConverterLoaderForTest,
} from '../scriptMode';

// 测试用转换器:逐字映射(真转换器另有单测;这里只验引擎行为)
const MAP = { '简': '簡', '体': '體', '设': '設', '置': '置', '显': '顯', '示': '示', '历': '曆', '关': '關', '于': '於' };
const fake = (s) => `${s}`.split('').map((c) => MAP[c] || c).join('');
const flush = () => new Promise((r) => setTimeout(r, 0));

function mount(html){
	document.body.innerHTML = html;
}

beforeEach(() => {
	__resetScriptModeForTest();
	__setConverterForTest(fake);
	try{ window.localStorage.clear(); }catch(e){ /* noop */ }
	document.body.innerHTML = '';
});

afterAll(() => {
	__resetScriptModeForTest();
});

describe('切到繁体 / 切回简体', () => {
	it('文字节点与显示属性转繁体;切回简体逐字复原', async () => {
		mount('<div id="a" title="简体设置">简体显示<span>关于</span></div><img id="i" alt="历法" />');
		await applyScriptMode(SCRIPT_HANT);
		expect(currentScriptMode()).toBe(SCRIPT_HANT);
		expect(document.getElementById('a').textContent).toBe('簡體顯示關於');
		expect(document.getElementById('a').getAttribute('title')).toBe('簡體設置');
		expect(document.getElementById('i').getAttribute('alt')).toBe('曆法');
		expect(document.documentElement.getAttribute('lang')).toBe('zh-Hant');
		await applyScriptMode(SCRIPT_HANS);
		expect(document.getElementById('a').textContent).toBe('简体显示关于');
		expect(document.getElementById('a').getAttribute('title')).toBe('简体设置');
		expect(document.getElementById('i').getAttribute('alt')).toBe('历法');
		expect(document.documentElement.hasAttribute('lang')).toBe(false);   // 恢复模板原状(原本没有 lang)
	});

	it('不碰:输入框的值、多行输入、可编辑区、代码块、.horosa-script-keep', async () => {
		mount('<input id="t" value="简体" /><textarea id="ta">简体</textarea><div id="ce" contenteditable="true">简体</div>'
			+ '<pre id="p"><code>简体</code></pre><div class="horosa-script-keep"><span id="k">简体</span></div>'
			+ '<input id="b" type="button" value="简体" /><input id="ph" placeholder="简体" />');
		await applyScriptMode(SCRIPT_HANT);
		expect(document.getElementById('t').value).toBe('简体');
		expect(document.getElementById('ta').value).toBe('简体');
		expect(document.getElementById('ce').textContent).toBe('简体');
		expect(document.getElementById('p').textContent).toBe('简体');
		expect(document.getElementById('k').textContent).toBe('简体');
		expect(document.getElementById('b').getAttribute('value')).toBe('簡體');   // 按钮上的字是显示
		expect(document.getElementById('ph').getAttribute('placeholder')).toBe('簡體');
	});

	it('之后新渲染 / 改动的文字跟着转(含改回同一原文、属性改动)', async () => {
		mount('<div id="a">简体</div>');
		await applyScriptMode(SCRIPT_HANT);
		const a = document.getElementById('a');
		a.firstChild.nodeValue = '显示';                  // 框架改字 = 改文字节点
		const s = document.createElement('span');
		s.textContent = '设置';
		s.setAttribute('title', '关于');
		a.appendChild(s);                                  // 新挂节点
		await flush();
		expect(a.textContent).toBe('顯示設置');
		expect(s.getAttribute('title')).toBe('關於');
		s.setAttribute('title', '简体');
		await flush();
		expect(s.getAttribute('title')).toBe('簡體');
		await applyScriptMode(SCRIPT_HANS);
		expect(a.textContent).toBe('显示设置');
		expect(s.getAttribute('title')).toBe('简体');
	});

	it('切回简体后新挂的字不再转换', async () => {
		mount('<div id="a">简体</div>');
		await applyScriptMode(SCRIPT_HANT);
		await applyScriptMode(SCRIPT_HANS);
		document.getElementById('a').appendChild(document.createTextNode('设置'));
		await flush();
		expect(document.getElementById('a').textContent).toBe('简体设置');
	});
});

describe('从页面读字做判断:readOriginalText', () => {
	it('繁体下读到的是简体原文,读完页面仍是繁体', async () => {
		mount('<div id="tabs"><div class="tab">简体</div><div class="tab" title="设置">显示</div></div>');
		await applyScriptMode(SCRIPT_HANT);
		const root = document.getElementById('tabs');
		const got = readOriginalText(root, (n) => n.textContent);
		expect(got).toBe('简体显示');
		const title = readOriginalText(root, (n) => n.querySelectorAll('.tab')[1].getAttribute('title'));
		expect(title).toBe('设置');
		expect(root.textContent).toBe('簡體顯示');
		expect(root.querySelectorAll('.tab')[1].getAttribute('title')).toBe('設置');
		await flush();
		expect(root.textContent).toBe('簡體顯示');      // 换回去产生的变动记录不会把字再改坏
	});

	it('读期间之前积压的真实改动照常转换(不被丢)', async () => {
		mount('<div id="a">简体</div><div id="b">x</div>');
		await applyScriptMode(SCRIPT_HANT);
		document.getElementById('b').firstChild.nodeValue = '设置';   // 积压中,尚未处理
		readOriginalText(document.getElementById('a'), (n) => n.textContent);
		expect(document.getElementById('b').textContent).toBe('設置');
	});

	it('简体下原样读', () => {
		mount('<div id="a">简体</div>');
		expect(readOriginalText(document.getElementById('a'), (n) => n.textContent)).toBe('简体');
	});
});

describe('存储与广播', () => {
	it('setScriptMode 写存储并广播;读存储归一', async () => {
		const seen = [];
		const on = (e) => seen.push(e.detail.mode);
		window.addEventListener(SCRIPT_APPLIED_EVENT, on);
		mount('<div>简体</div>');
		expect(await setScriptMode(SCRIPT_HANT)).toEqual({ mode: SCRIPT_HANT, persisted: true });
		expect(window.localStorage.getItem(SCRIPT_LS_KEY)).toBe(SCRIPT_HANT);
		expect(getStoredScriptMode()).toBe(SCRIPT_HANT);
		await setScriptMode(SCRIPT_HANS);
		expect(window.localStorage.getItem(SCRIPT_LS_KEY)).toBe(SCRIPT_HANS);
		window.removeEventListener(SCRIPT_APPLIED_EVENT, on);
		expect(seen).toEqual([SCRIPT_HANT, SCRIPT_HANS]);
		window.localStorage.setItem(SCRIPT_LS_KEY, 'garbage');
		expect(getStoredScriptMode()).toBe(SCRIPT_HANS);
	});
});

describe('多行输入框的占位符 / 可编辑性翻转 / 富文本编辑面', () => {
	it('🔴 多行输入框:值不动,占位符 / 提示照转(与单行输入框一致);切回简体复原;之后挂进来的、改了的也跟着转', async () => {
		mount('<textarea id="ta" placeholder="简体设置" title="关于">简体</textarea>');
		await applyScriptMode(SCRIPT_HANT);
		const ta = document.getElementById('ta');
		expect(ta.value).toBe('简体');
		expect(ta.textContent).toBe('简体');
		expect(ta.getAttribute('placeholder')).toBe('簡體設置');
		expect(ta.getAttribute('title')).toBe('關於');
		ta.setAttribute('placeholder', '显示');
		const t2 = document.createElement('textarea');
		t2.setAttribute('placeholder', '历法');
		t2.textContent = '历法';
		document.body.appendChild(t2);
		await flush();
		expect(ta.getAttribute('placeholder')).toBe('顯示');
		expect(t2.getAttribute('placeholder')).toBe('曆法');
		expect(t2.value).toBe('历法');
		await applyScriptMode(SCRIPT_HANS);
		expect(ta.getAttribute('placeholder')).toBe('显示');
		expect(t2.getAttribute('placeholder')).toBe('历法');
	});

	it('🔴 可编辑性翻转:只读时转了的区,改成可编辑后放回原文、之后不再转(编辑器会从页面读回去当数据)', async () => {
		mount('<div id="ed" contenteditable="false"><p id="p1">简体设置</p></div>');
		await applyScriptMode(SCRIPT_HANT);
		const ed = document.getElementById('ed');
		expect(ed.textContent).toBe('簡體設置');
		ed.setAttribute('contenteditable', 'true');
		await flush();
		expect(ed.textContent).toBe('简体设置');
		const p2 = document.createElement('p');
		p2.textContent = '显示';
		ed.appendChild(p2);
		await flush();
		expect(p2.textContent).toBe('显示');
		ed.setAttribute('contenteditable', 'false');                       // 再改回只读:当新内容转
		await flush();
		expect(ed.textContent).toBe('簡體設置顯示');
		await applyScriptMode(SCRIPT_HANS);
		expect(ed.textContent).toBe('简体设置显示');
	});

	it('富文本编辑面(.ql-editor)只读时也按原样', async () => {
		mount('<div class="ql-editor" contenteditable="false"><p id="q">简体</p></div>');
		await applyScriptMode(SCRIPT_HANT);
		expect(document.getElementById('q').textContent).toBe('简体');
	});
});

describe('不该转换的区域(补)', () => {
	it('SVG 里的 <style> 与 contenteditable="plaintext-only" 不转换', async () => {
		mount('<svg><style id="st">.a{font-family:"简体"}</style><text id="tx">简体</text></svg>'
			+ '<div id="ce" contenteditable="plaintext-only">简体</div><div id="cf" contenteditable="false">简体</div>');
		await applyScriptMode(SCRIPT_HANT);
		expect(document.getElementById('st').textContent).toBe('.a{font-family:"简体"}');
		expect(document.getElementById('ce').textContent).toBe('简体');
		expect(document.getElementById('tx').textContent).toBe('簡體');
		expect(document.getElementById('cf').textContent).toBe('簡體');   // 明说不可编辑的照常转
		const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'style');
		s2.textContent = '设置';
		document.querySelector('svg').appendChild(s2);                     // 之后挂进来的也不碰
		await flush();
		expect(s2.textContent).toBe('设置');
	});
});

describe('框架写来的值恰好等于上次转出的结果:当新原文', () => {
	it('文字节点与属性:切回简体后显示的是框架写的值', async () => {
		mount('<span id="n">简体</span><i id="t" title="设置"></i>');
		await applyScriptMode(SCRIPT_HANT);
		const node = document.getElementById('n').firstChild;
		expect(node.nodeValue).toBe('簡體');
		node.nodeValue = '簡體';                       // 数据真的变成了繁体写法
		document.getElementById('t').setAttribute('title', '設置');
		await flush();
		await applyScriptMode(SCRIPT_HANS);
		expect(node.nodeValue).toBe('簡體');
		expect(document.getElementById('t').getAttribute('title')).toBe('設置');
	});
	it('同一批里连改两次只按最后的值转一次', async () => {
		mount('<span id="n">x</span>');
		await applyScriptMode(SCRIPT_HANT);
		const node = document.getElementById('n').firstChild;
		node.nodeValue = '显示';
		node.nodeValue = '设置';
		await flush();
		expect(node.nodeValue).toBe('設置');
		await applyScriptMode(SCRIPT_HANS);
		expect(node.nodeValue).toBe('设置');
	});
});

describe('逐字出图:按整词转再取那一位', () => {
	it('父元素带整词与位次时,单字按整词的转换结果取', async () => {
		const ctxConv = (s) => (s === '天后' ? '天后' : fake(s).replace(/后/g, '後'));
		__setConverterForTest(ctxConv);
		const a = scriptWordAttrs('天后', 1);
		mount(`<svg><text ${Object.keys(a).map((k) => `${k}="${a[k]}"`).join(' ')} id="c">后</text><text id="d">后</text></svg>`);
		await applyScriptMode(SCRIPT_HANT);
		expect(document.getElementById('c').textContent).toBe('后');
		expect(document.getElementById('d').textContent).toBe('後');
	});
});

describe('导出 / 截图:withOriginalScript', () => {
	function FakeCtx(){ this.drawn = []; }
	FakeCtx.prototype.fillText = function(t){ this.drawn.push(t); };
	FakeCtx.prototype.strokeText = function(t){ this.drawn.push(t); };
	FakeCtx.prototype.measureText = function(t){ return { width: `${t}`.length }; };
	beforeAll(() => { window.CanvasRenderingContext2D = FakeCtx; });
	afterAll(() => { delete window.CanvasRenderingContext2D; });

	it('期间 canvas 画原文、页上要截的元素放回原文;结束后恢复繁体', async () => {
		mount('<div id="chart">简体设置</div><div id="other">显示</div>');
		await applyScriptMode(SCRIPT_HANT);
		const ctx = new FakeCtx();
		ctx.fillText('简体', 0, 0);
		const ex = new FakeCtx();   // 导出新建的画布:只在暂停期间画字
		const seen = await withOriginalScript(async () => {
			ex.fillText('简体', 0, 0);
			ctx.fillText('简体', 0, 0);   // 暂停之外画过字的离屏画布 = 页面自己的(图表量宽等):照常转换
			const host = document.createElement('div');
			host.className = 'horosa-script-keep';
			host.textContent = '设置';
			document.body.appendChild(host);
			await flush();
			const chart = document.getElementById('chart');
			chart.appendChild(document.createTextNode('关于'));            // 截图期间框架又写了字
			await flush();
			return [host.textContent, chart.textContent, document.getElementById('other').textContent];
		}, { roots: [document.getElementById('chart')] });
		expect(ex.drawn).toEqual(['简体']);
		expect(ctx.drawn).toEqual(['簡體', '簡體']);
		expect(seen).toEqual(['设置', '简体设置关于', '顯示']);
		expect(document.getElementById('chart').textContent).toBe('簡體設置關於');
		expect(document.getElementById('chart').classList.contains('horosa-script-keep')).toBe(false);
		ctx.fillText('简体', 0, 0);
		expect(ctx.drawn[2]).toBe('簡體');
	});
	it('fn 抛错也恢复;简体模式直接执行', async () => {
		mount('<div id="chart">简体</div>');
		await applyScriptMode(SCRIPT_HANT);
		await expect(withOriginalScript(() => { throw new Error('x'); }, { roots: document.getElementById('chart') })).rejects.toThrow('x');
		expect(document.getElementById('chart').textContent).toBe('簡體');
		const ctx = new FakeCtx();
		ctx.fillText('简体', 0, 0);
		expect(ctx.drawn).toEqual(['簡體']);
		await applyScriptMode(SCRIPT_HANS);
		expect(await withOriginalScript(() => 7)).toBe(7);
	});

	const pageCtx = () => {
		const ctx = new FakeCtx();
		ctx.canvas = document.createElement('canvas');
		document.body.appendChild(ctx.canvas);
		return ctx;
	};
	it('只旁路不挂在页面上的画布:导出期间页面上的画布照常画繁体', async () => {
		mount('<div></div>');
		await applyScriptMode(SCRIPT_HANT);
		const live = pageCtx();
		const off = new FakeCtx();
		off.canvas = document.createElement('canvas');   // 新建、不挂文档 = 导出自己的画布
		await withOriginalScript(async () => {
			live.fillText('简体', 0, 0);
			off.fillText('简体', 0, 0);
		});
		expect(live.drawn).toEqual(['簡體']);
		expect(off.drawn).toEqual(['简体']);
	});
	it('fn 永不落定:空闲一整个看门狗时长(期间不画字)就强制结束,恢复转换、roots 去掉 keep 类并转回繁体', async () => {
		mount('<div id="chart">简体</div>');
		await applyScriptMode(SCRIPT_HANT);
		const off = new FakeCtx();
		withOriginalScript(() => new Promise(() => {}), { roots: [document.getElementById('chart')], maxHoldMs: 20 });
		expect(document.getElementById('chart').textContent).toBe('简体');
		off.fillText('简体', 0, 0);
		await new Promise((r) => setTimeout(r, 80));   // 画过一次 → 续一段;之后两段空闲 → 判挂起
		off.fillText('简体', 0, 0);
		expect(off.drawn).toEqual(['简体', '簡體']);
		expect(document.getElementById('chart').classList.contains('horosa-script-keep')).toBe(false);
		expect(document.getElementById('chart').textContent).toBe('簡體');
	});
	it('🔴 看门狗计的是空闲:在跑的长导出(3 倍最长持有,其间每半个持有时长画一次字)全程原文;停笔后才到点解开', async () => {
		jest.useFakeTimers();
		try{
			mount('<div id="chart">简体</div>');
			await applyScriptMode(SCRIPT_HANT);
			const off = new FakeCtx();
			let settle = null;
			const p = withOriginalScript(() => new Promise((r) => { settle = r; }), { roots: [document.getElementById('chart')], maxHoldMs: 1000 });
			for(let i = 0; i < 6; i++){
				jest.advanceTimersByTime(500);
				off.fillText(`段${i}简体`, 0, 0);
			}
			expect(off.drawn).toEqual(['段0简体', '段1简体', '段2简体', '段3简体', '段4简体', '段5简体']);
			expect(document.getElementById('chart').classList.contains('horosa-script-keep')).toBe(true);
			// 真挂起(不再画字):两个持有时长之内解开
			jest.advanceTimersByTime(2000);
			off.fillText('简体', 0, 0);
			expect(off.drawn[off.drawn.length - 1]).toBe('簡體');
			expect(document.getElementById('chart').classList.contains('horosa-script-keep')).toBe(false);
			settle();
			await Promise.resolve();
			void p;
		}finally{
			jest.useRealTimers();
		}
	});
	it('🔴 页面自己的离屏画布(暂停之外画过字)不给卡死的导出续期:照常转换,两个持有时长之内解开', async () => {
		jest.useFakeTimers();
		try{
			mount('<div id="chart">简体</div>');
			await applyScriptMode(SCRIPT_HANT);
			const gauge = new FakeCtx();   // 图表库量宽用的离屏画布:页面一直在用
			gauge.canvas = document.createElement('canvas');
			gauge.measureText('简体');
			withOriginalScript(() => new Promise(() => {}), { roots: [document.getElementById('chart')], maxHoldMs: 1000 });
			const widths = [];
			for(let i = 0; i < 4; i++){
				jest.advanceTimersByTime(500);
				gauge.fillText('简体', 0, 0);
				widths.push(gauge.drawn[gauge.drawn.length - 1]);
			}
			expect(widths).toEqual(['簡體', '簡體', '簡體', '簡體']);   // 导出期间照常转换(与页面画布同一份字)
			expect(document.getElementById('chart').classList.contains('horosa-script-keep')).toBe(false);   // 已解开
			expect(document.getElementById('chart').textContent).toBe('簡體');
		}finally{
			jest.useRealTimers();
		}
	});
	it('🔴 总时长封顶:导出画布一直在画也到 maxTotalMs 解开;缺省上限 = 30 个持有时长', async () => {
		jest.useFakeTimers();
		try{
			mount('<div id="chart">简体</div>');
			await applyScriptMode(SCRIPT_HANT);
			const off = new FakeCtx();
			withOriginalScript(() => new Promise(() => {}), { roots: [document.getElementById('chart')], maxHoldMs: 1000, maxTotalMs: 5000 });
			let t = 0;
			while(t < 4500){ jest.advanceTimersByTime(500); t += 500; off.fillText('简体', 0, 0); }
			expect(document.getElementById('chart').classList.contains('horosa-script-keep')).toBe(true);
			jest.advanceTimersByTime(600);
			expect(document.getElementById('chart').classList.contains('horosa-script-keep')).toBe(false);
			// 缺省上限
			mount('<div id="chart2">简体</div>');
			const off2 = new FakeCtx();
			withOriginalScript(() => new Promise(() => {}), { roots: [document.getElementById('chart2')], maxHoldMs: 100 });
			t = 0;
			while(t < 2900){ jest.advanceTimersByTime(50); t += 50; off2.fillText('简体', 0, 0); }
			expect(document.getElementById('chart2').classList.contains('horosa-script-keep')).toBe(true);
			jest.advanceTimersByTime(150);
			expect(document.getElementById('chart2').classList.contains('horosa-script-keep')).toBe(false);
		}finally{
			jest.useRealTimers();
		}
	});
	it('导出挂起时切换简繁:暂停归零,切回繁体后照常转换', async () => {
		mount('<div id="chart">简体</div>');
		await applyScriptMode(SCRIPT_HANT);
		withOriginalScript(() => new Promise(() => {}), { roots: [document.getElementById('chart')] });
		await applyScriptMode(SCRIPT_HANS);
		await applyScriptMode(SCRIPT_HANT);
		const off = new FakeCtx();
		off.fillText('简体', 0, 0);
		expect(off.drawn).toEqual(['簡體']);
		expect(document.getElementById('chart').textContent).toBe('簡體');
	});
	it('暂停期间有不挂在页面上的画布按原文画过(可能是标签纹理)→ 结束后请订阅方重画一次', async () => {
		mount('<div></div>');
		await applyScriptMode(SCRIPT_HANT);
		const calls = [];
		const off = subscribeScriptMode((m) => calls.push(m));
		await withOriginalScript(async () => { new FakeCtx().fillText('简体', 0, 0); });
		await new Promise((r) => setTimeout(r, 40));
		expect(calls).toEqual([SCRIPT_HANT]);
		await withOriginalScript(async () => 1);   // 没画过 → 不重画
		await new Promise((r) => setTimeout(r, 40));
		expect(calls).toEqual([SCRIPT_HANT]);
		off();
	});
});

describe('搜索比对:scriptMatchKey / matchesUserQuery / scriptFilterBy', () => {
	// 测试用归一键:繁 → 简逐字(真键另有全仓文案测试)
	const BACK = { '簡': '简', '體': '体', '設': '设', '顯': '显', '曆': '历', '關': '关', '於': '于' };
	const key = (s) => Array.from(fake(s)).map((c) => BACK[c] || c).join('');

	it('简体模式原样(逐字节等价)', () => {
		__setConverterForTest(fake, key);
		expect(scriptMatchKey('簡體')).toBe('簡體');
		expect(matchesUserQuery('简体设置', '簡體')).toBe(false);
		expect(matchesUserQuery('Abc', 'b')).toBe(true);
		expect(matchesUserQuery('Abc', 'B', { ci: false })).toBe(false);
	});
	it('繁体模式:照屏幕输入繁体、或输入简体,都能搜到简体数据', async () => {
		__setConverterForTest(fake, key);
		await applyScriptMode(SCRIPT_HANT);
		expect(matchesUserQuery('简体设置', '簡體')).toBe(true);
		expect(matchesUserQuery('简体设置', '简体')).toBe(true);
		expect(matchesUserQuery('简体设置', '設置', { prefix: true })).toBe(false);
		expect(matchesUserQuery('简体设置', '簡', { prefix: true })).toBe(true);
		const byLabel = scriptFilterBy('label');
		expect(byLabel('顯示', { value: 'x', label: '显示' })).toBe(true);
		expect(byLabel('顯示', { value: 'x', label: '关于' })).toBe(false);
		const byChildren = scriptFilterBy('children');
		expect(byChildren('關', { value: 'x', children: ['选', { props: { children: '关于' } }] })).toBe(true);
		const byDefault = scriptFilterBy();
		expect(byDefault('曆', { value: '历法', label: 'zz' })).toBe(true);                 // 缺省同组件:看 value
		expect(byDefault('曆', { label: '历法组', options: [] })).toBe(true);              // 选项组看 label
	});
});

describe('开机 / 失败路径 / 跨窗口', () => {
	it('转换器加载失败:留在简体、放开遮罩、广播实际档(菜单据此显示)', async () => {
		__setConverterForTest(null);
		__setConverterLoaderForTest(() => Promise.reject(new Error('chunk load failed')));
		const seen = [];
		const on = (e) => seen.push(e.detail);
		window.addEventListener(SCRIPT_APPLIED_EVENT, on);
		try{
			expect(await applyScriptMode(SCRIPT_HANT, { boot: true })).toBe(SCRIPT_HANS);
		}finally{
			window.removeEventListener(SCRIPT_APPLIED_EVENT, on);
			__setConverterLoaderForTest(null);
		}
		expect(seen).toEqual([{ mode: SCRIPT_HANS, failed: true }]);
		expect(document.documentElement.hasAttribute('data-horosa-script-pending')).toBe(false);
	});
	it('写存储失败:这次照常生效,回 persisted:false', async () => {
		mount('<div>简体</div>');
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
		try{
			expect(await setScriptMode(SCRIPT_HANT)).toEqual({ mode: SCRIPT_HANT, persisted: false });
		}finally{ spy.mockRestore(); }
		expect(currentScriptMode()).toBe(SCRIPT_HANT);
	});
	it('从未切换过:<html> 不带 lang;切到繁体写 zh-Hant,切回去掉', async () => {
		document.documentElement.removeAttribute('lang');
		bootScriptMode();
		expect(document.documentElement.hasAttribute('lang')).toBe(false);
		await applyScriptMode(SCRIPT_HANT);
		expect(document.documentElement.getAttribute('lang')).toBe('zh-Hant');
		await applyScriptMode(SCRIPT_HANS);
		expect(document.documentElement.hasAttribute('lang')).toBe(false);
	});
	it('别的窗口把存储整个清空(storage 事件 key 为 null)= 复位到简体', async () => {
		mount('<div id="a">简体</div>');
		bootScriptMode();
		await applyScriptMode(SCRIPT_HANT);
		window.dispatchEvent(new window.StorageEvent('storage', { key: null }));
		await flush();
		expect(currentScriptMode()).toBe(SCRIPT_HANS);
		expect(document.getElementById('a').textContent).toBe('简体');
	});
	it('首帧前:存的是繁体先遮住页面;存的是简体不碰', () => {
		__setConverterForTest(null);
		__setConverterLoaderForTest(() => new Promise(() => {}));     // 加载中(不让真分包在后面的用例里落地)
		window.localStorage.setItem(SCRIPT_LS_KEY, SCRIPT_HANS);
		prebootScriptMode();
		expect(document.documentElement.hasAttribute('data-horosa-script-pending')).toBe(false);
		window.localStorage.setItem(SCRIPT_LS_KEY, SCRIPT_HANT);
		prebootScriptMode();
		expect(document.documentElement.hasAttribute('data-horosa-script-pending')).toBe(true);
		expect(document.documentElement.style.visibility).toBe('hidden');
		__resetScriptModeForTest();
		__setConverterLoaderForTest(null);
		expect(document.documentElement.style.visibility).toBe('');
	});
});

describe('订阅切换(canvas 宿主重画)', () => {
	it('切换后回调一次、同值不回调、退订后不再回调', async () => {
		const seen = [];
		const off = subscribeScriptMode((m) => seen.push(m));
		await applyScriptMode(SCRIPT_HANT);
		await new Promise((r) => setTimeout(r, 40));
		await applyScriptMode(SCRIPT_HANT);
		await new Promise((r) => setTimeout(r, 40));
		await applyScriptMode(SCRIPT_HANS);
		await new Promise((r) => setTimeout(r, 40));
		off();
		await applyScriptMode(SCRIPT_HANT);
		await new Promise((r) => setTimeout(r, 40));
		expect(seen).toEqual([SCRIPT_HANT, SCRIPT_HANS]);
	});
});

describe('同源 iframe 的文档(名人库页一类)', () => {
	it('挂进来后与主文档同一套转换;摘掉时放回原文、之后的改动不再处理', async () => {
		const frame = document.createElement('iframe');
		document.body.appendChild(frame);
		const doc = frame.contentDocument;
		doc.body.innerHTML = '<div id="x">简体设置</div>';
		const detach = attachScriptDocument(doc);
		await applyScriptMode(SCRIPT_HANT);
		expect(doc.getElementById('x').textContent).toBe('簡體設置');
		doc.getElementById('x').appendChild(doc.createTextNode('关于'));
		await flush();
		expect(doc.getElementById('x').textContent).toBe('簡體設置關於');
		detach();
		expect(doc.getElementById('x').textContent).toBe('简体设置关于');
		doc.getElementById('x').appendChild(doc.createTextNode('显示'));
		await flush();
		expect(doc.getElementById('x').textContent).toBe('简体设置关于显示');
		await applyScriptMode(SCRIPT_HANS);
	});
});
