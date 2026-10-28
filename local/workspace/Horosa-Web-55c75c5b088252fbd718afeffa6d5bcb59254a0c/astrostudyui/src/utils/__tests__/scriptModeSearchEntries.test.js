// 界面简繁 · 各类检索入口的行为(真转换器 + 真归一键):
// 繁体模式下 ① 照屏幕上的繁体输入能命中 ② 直接输入简体能命中 ③ 记录里本来就存繁体的也能命中;
// 简体模式下与原先逐字节等价(繁体输入照旧认不出简体数据)。
import fs from 'fs';
import path from 'path';
import * as hantConv from '../scriptConvert/hantConverter';
import {
	applyScriptMode, SCRIPT_HANT, SCRIPT_HANS, __resetScriptModeForTest, __setConverterForTest,
	matchesUserQuery, scriptQueryVariants, scriptMatchIndex, scriptTextEquals,
} from '../scriptMode';
import { scriptMatchSpan, scriptNodeOffset, scriptOriginalNodeText } from '../scriptMode';
import { createLocalRecordStore } from '../localRecordStore';
import { filterDeletedLogEntries } from '../../components/user/DeletedLogPanel';
import { pageMatchesQuery, matchedKeyword } from '../../components/HomePageSetup';
import { filterBiFaListByQuery } from '../../components/lrzhan/main/referenceMatch';
import { BIFA_LIST } from '../../components/liureng/LRBiFaDoc';
import { buildStarIndex, findStarByName, suggestStars } from '../../components/planetarium/planetariumStarSearch';
import { withQueryVariants } from '../../services/xuanshi';

const SRC = path.resolve(__dirname, '../..');
const { toHant } = hantConv;

beforeEach(async () => {
	__resetScriptModeForTest();
	__setConverterForTest(hantConv.toHant, hantConv.toMatchKey, hantConv);
	document.body.innerHTML = '';
	window.localStorage.clear();
});
afterAll(() => { __resetScriptModeForTest(); });

const hant = ()=>applyScriptMode(SCRIPT_HANT);

describe('单源', () => {
	it('两边都归一:繁体存的名字,繁体 / 简体输入都能命中', async () => {
		expect(matchesUserQuery('張三豐', '张三')).toBe(false);   // 简体模式:原样比
		await hant();
		expect(matchesUserQuery('張三豐', '张三')).toBe(true);
		expect(matchesUserQuery('張三豐', '張三')).toBe(true);
		expect(matchesUserQuery('张三丰', '張三')).toBe(true);
	});

	it('scriptQueryVariants:简体模式不给;繁体模式给简体写法与繁体显示写法', async () => {
		expect(scriptQueryVariants('荧惑')).toEqual([]);
		await hant();
		expect(scriptQueryVariants('熒惑')).toEqual(['荧惑']);
		expect(scriptQueryVariants('荧惑')).toEqual(['熒惑']);
		expect(scriptQueryVariants('  ')).toEqual([]);
	});

	it('scriptQueryVariants:不把「乾」扩成「干」;一简多繁按位展开各繁体写法(至多 8 条,显示写法在前)', async () => {
		// 简体界面(anyScript:远端库简繁混存,不论界面档位都要)
		const v = (q)=>scriptQueryVariants(q, { anyScript: true });
		expect(v('乾')).toEqual([]);
		expect(v('乾宫')).toEqual(['乾宮']);
		expect(v('乾山')).not.toContain('干山');
		expect(v('著')).not.toContain('着');
		expect(v('钟')).toEqual(expect.arrayContaining(['鐘', '鍾']));
		expect(v('钟繇')).toEqual(expect.arrayContaining(['鍾繇']));
		expect(v('历')).toEqual(expect.arrayContaining(['曆', '歷']));
		expect(v('发')).toEqual(expect.arrayContaining(['發', '髮']));
		expect(v('里')).toEqual(expect.arrayContaining(['裡', '裏']));
		expect(v('历史发展里程钟表').length).toBeLessThanOrEqual(8);
		expect(v('历史')[0]).toBe(toHant('历史'));
		await hant();
		expect(scriptQueryVariants('乾')).toEqual([]);
		expect(scriptQueryVariants('历')).toEqual(expect.arrayContaining(['曆', '歷']));
	});

	it('繁体模式子串检索:该中的中、不该中的不中(整串归一键在子串上不稳定的旧病)', async () => {
		await hant();
		const yes = [['乾卦', '乾'], ['乾造', '乾'], ['乾坤', '乾'], ['坐标经度', '坐'], ['坐标经度', '座'],
			['回复', '覆'], ['反复', '覆'], ['家具', '俱'], ['显著', '著'], ['钟馗', '鍾'], ['钟馗', '钟'],
			['鍾馗', '钟'], ['張三豐', '张三'], ['张三丰', '張三']];
		const no = [['天干地支', '乾'], ['干支', '乾'], ['著作', '着'], ['幹部', '乾'], ['鍾馗', '鐘']];
		expect(yes.filter(([h, q])=>!matchesUserQuery(h, q))).toEqual([]);
		expect(no.filter(([h, q])=>matchesUserQuery(h, q))).toEqual([]);
		expect(scriptMatchIndex('回复他人', '覆')).toBe(1);
		expect(scriptMatchIndex('回复回复', '覆', { from: 2 })).toBe(3);
		expect(scriptTextEquals('太阳', '太陽')).toBe(true);
		expect(scriptTextEquals('太阳系', '太陽')).toBe(false);
	});

	it('简体模式:matchesUserQuery / scriptMatchIndex / scriptTextEquals 与原比对逐字节等价', () => {
		const ref = (h, q, { ci = true, prefix = false } = {})=>{
			if(!q){ return true; }
			const hh = ci ? h.toLowerCase() : h; const qq = ci ? q.toLowerCase() : q;
			return prefix ? hh.startsWith(qq) : hh.indexOf(qq) >= 0;
		};
		const hays = ['天干地支', '乾卦', '坐标经度', '回复', '張三豐', '张三丰', 'Vega 织女一', 'ABC', '鍾馗', ''];
		const qs = ['乾', '坐', '座', '覆', '张三', '張三', 'vega', 'B', 'b', '钟', '鍾', '', '回'];
		const bad = [];
		hays.forEach((h)=>qs.forEach((q)=>{
			[{}, { ci: false }, { prefix: true }].forEach((o)=>{
				if(matchesUserQuery(h, q, o) !== ref(h, q, o)){ bad.push([h, q, o]); }
			});
			if(q && scriptMatchIndex(h, q) !== h.toLowerCase().indexOf(q.toLowerCase())){ bad.push(['idx', h, q]); }
			if(scriptTextEquals(h, q) !== (h.toLowerCase() === q.toLowerCase())){ bad.push(['eq', h, q]); }
		}));
		expect(bad).toEqual([]);
	});
});

describe('扩展区字(转换逐码点等长、UTF-16 不等长)', () => {
	// 𬣙(扩展 E,规范简化字)显示为 訏(基本平面);㓆(扩展 A)显示为 𠗣(辅助平面)
	it('繁体模式:串里有这种字时照屏幕输入、直接输入简体都照样命中(整串比对不失效)', async () => {
		await hant();
		const yes = [['王𬣙的后天八卦', '後天'], ['王𬣙的后天八卦', '后天'], ['王𬣙的后天八卦', '王訏'], ['王𬣙的后天八卦', '王𬣙'],
			['㓆姓后人', '後人'], ['㓆姓后人', '𠗣姓']];
		expect(yes.filter(([h, q])=>!matchesUserQuery(h, q))).toEqual([]);
		expect(matchesUserQuery('王𬣙的后天八卦', '先天')).toBe(false);
		expect(scriptTextEquals('王𬣙', '王訏')).toBe(true);
	});
	it('命中下标 / 长度是被搜文字上的 UTF-16 量;找下一处不错位', async () => {
		await hant();
		expect(scriptMatchSpan('𬣙xyz后天', '後天')).toEqual({ index: 5, length: 2 });
		expect(scriptMatchIndex('𬣙xyz后天', '後天')).toBe(5);
		expect(scriptMatchSpan('王𬣙', '王訏')).toEqual({ index: 0, length: 3 });   // 查询 2 个 UTF-16 单元,命中占 3 个
		const hay = '𬣙后𬣙后';
		const a = scriptMatchSpan(hay, '訏後');
		const b = scriptMatchSpan(hay, '訏後', { from: a.index + a.length });
		expect([a, b]).toEqual([{ index: 0, length: 3 }, { index: 3, length: 3 }]);
		expect(scriptMatchSpan(hay, '訏後', { from: b.index + b.length }).index).toBe(-1);
	});
	it('原文下标落回已转换的页面文字:经 scriptNodeOffset 落到同一个字;串尾命中不越界', async () => {
		await hant();
		const p = document.createElement('p');
		p.textContent = '𬣙xyz后天';
		document.body.appendChild(p);
		await new Promise((r)=>setTimeout(r, 0));
		const node = p.firstChild;
		expect(node.nodeValue).toBe('訏xyz後天');
		const orig = scriptOriginalNodeText(node);
		const hit = scriptMatchSpan(orig, '后天');
		const st = scriptNodeOffset(node, hit.index);
		const en = scriptNodeOffset(node, hit.index + hit.length);
		expect(node.nodeValue.slice(st, en)).toBe('後天');
		expect(en).toBeLessThanOrEqual(node.nodeValue.length);
		const r = document.createRange();
		expect(()=>{ r.setStart(node, st); r.setEnd(node, en); }).not.toThrow();
		expect(scriptNodeOffset(node, 999)).toBe(node.nodeValue.length);
	});
	it('不对着屏幕的检索(anyScript 放宽一档)命中位置同样按码点落回:含 ⇔ 命中位置 ≥ 0', () => {
		const hay = '𬣙張三豐記';
		expect(matchesUserQuery(hay, '张三丰', { anyScript: true })).toBe(true);
		expect(scriptMatchSpan(hay, '张三丰', { anyScript: true })).toEqual({ index: 2, length: 3 });
		expect(scriptMatchIndex(hay, '张三丰', { anyScript: true })).toBe(2);
		expect(scriptMatchSpan(hay, '张三丰', { anyScript: true, from: 3 }).index).toBe(-1);
		// 只有放宽一档才中的(查询的繁体写法字在显示里不换字:「豐」对「丰」),且折回改了 UTF-16 长度(訏 → 𬣙)
		expect(hantConv.toMatchKey('王訏张三丰')).toBe('王𬣙张三丰');
		expect(matchesUserQuery('王訏张三丰', '張三豐')).toBe(false);   // 屏幕检索不放宽
		expect(matchesUserQuery('王訏张三丰', '張三豐', { anyScript: true })).toBe(true);
		expect(scriptMatchSpan('王訏张三丰', '張三豐', { anyScript: true })).toEqual({ index: 2, length: 3 });
		expect(scriptMatchIndex('王訏张三丰', '張三豐', { anyScript: true })).toBe(2);
	});
	it('简体模式逐字节照旧:scriptMatchSpan = indexOf + 查询长度', () => {
		expect(scriptMatchSpan('𬣙xyz后天', '后天')).toEqual({ index: 5, length: 2 });
		expect(scriptMatchSpan('后天', '後天')).toEqual({ index: -1, length: 0 });
	});
	it('拿原文下标切页面文字的地方(用 scriptOriginalNodeText 又建 Range 的)都经 scriptNodeOffset 换算', () => {
		const bad = [];
		(function walk(dir){
			fs.readdirSync(dir).forEach((f)=>{
				const pth = path.join(dir, f);
				if(fs.statSync(pth).isDirectory()){ if(f !== '__tests__' && f !== 'node_modules' && !f.startsWith('.umi')){ walk(pth); } return; }
				if(!/\.(js|jsx)$/.test(f)){ return; }
				const t = fs.readFileSync(pth, 'utf8');
				if(/scriptOriginalNodeText\(/.test(t) && /\.set(?:Start|End)\(/.test(t) && !/scriptNodeOffset\(/.test(t)){ bad.push(path.relative(SRC, pth)); }
			});
		})(SRC);
		expect(bad).toEqual([]);
	});
});

describe('命盘 / 事盘列表的名字检索(记录库内核)', () => {
	const make = ()=>createLocalRecordStore({
		storageKey: 'test.script.search.records.v1', searchField: 'name',
		envelopeFormat: 'test-records', envelopeListField: 'records', buildRecord: (r)=>({ ...r }),
		saveErrorCode: 'test.save.failed', deleteErrorCode: 'test.delete.failed', warnLabel: 'test',
		trashKey: 'test.script.search.trash.v1',
	});
	const seed = ()=>{
		window.localStorage.setItem('test.script.search.records.v1', JSON.stringify([
			{ cid: 'a1', name: '张三', updateTime: '2026-01-02 00:00:00' },
			{ cid: 'a2', name: '劉德華', updateTime: '2026-01-01 00:00:00' },
		]));
		return make();
	};
	const names = (store, q)=>store.getPaged({ name: q }).List.map((r)=>r.name);

	it('简体模式与原先等价', () => {
		const store = seed();
		expect(names(store, '张')).toEqual(['张三']);
		expect(names(store, '張')).toEqual([]);
		expect(names(store, '劉德')).toEqual(['劉德華']);
		expect(names(store, '刘德')).toEqual([]);
	});

	it('繁体模式:照屏幕繁体、直接简体、记录本身是繁体,都能命中', async () => {
		const store = seed();
		await hant();
		expect(names(store, toHant('张三'))).toEqual(['张三']);
		expect(names(store, '张')).toEqual(['张三']);
		expect(names(store, '劉德')).toEqual(['劉德華']);
		expect(names(store, '刘德')).toEqual(['劉德華']);
	});
});

describe('回收站删除日志', () => {
	const entries = [{ id: 1, name: '张三' }, { id: 2, name: '李四' }];
	const describeEntry = (e)=>`${e.name} · 2026-01-01`;
	it('繁体模式照屏幕输入能搜到;简体模式照旧', async () => {
		expect(filterDeletedLogEntries(entries, '張三', describeEntry)).toEqual([]);
		await hant();
		expect(filterDeletedLogEntries(entries, '張三', describeEntry).map((e)=>e.id)).toEqual([1]);
		expect(filterDeletedLogEntries(entries, '张三', describeEntry).map((e)=>e.id)).toEqual([1]);
	});
});

describe('主页导航搜索', () => {
	const rec = { label: '六壬', group: '卜', keywords: '毕法 课体 卜卦盘' };
	it('繁体模式:模块名与术法关键词都照屏幕输入能命中', async () => {
		expect(pageMatchesQuery(rec, '畢法')).toBe(false);
		await hant();
		expect(pageMatchesQuery(rec, toHant('六壬'))).toBe(true);
		expect(pageMatchesQuery(rec, '畢法')).toBe(true);
		expect(matchedKeyword(rec, '卜卦')).toBe('卜卦盘');
		expect(matchedKeyword(rec, toHant('卜卦盘'))).toBe('卜卦盘');
	});
});

describe('六壬毕法检索', () => {
	it('繁体模式:每条法名照屏幕输入都能检索到;简体模式照旧', async () => {
		const sample = BIFA_LIST.slice(0, 30);
		expect(filterBiFaListByQuery(BIFA_LIST, '')).toBe(BIFA_LIST);
		await hant();
		const miss = sample.filter((b)=>!filterBiFaListByQuery(BIFA_LIST, toHant(b.name)).some((x)=>x.no === b.no)).map((b)=>b.name);
		expect(miss).toEqual([]);
		await applyScriptMode(SCRIPT_HANS);
		const trad = BIFA_LIST.find((b)=>toHant(b.name) !== b.name);
		expect(filterBiFaListByQuery(BIFA_LIST, toHant(trad.name)).some((x)=>x.no === trad.no)).toBe(false);
		expect(filterBiFaListByQuery(BIFA_LIST, trad.name).some((x)=>x.no === trad.no)).toBe(true);
	});
});

describe('天文馆星名搜索', () => {
	const catalog = [
		{ id: 'bsc5-7001', name: 'Vega', bayer: 'α Lyr', mag: 0.03 },
		{ id: 'bsc5-2491', name: 'Sirius', bayer: 'α CMa', mag: -1.46 },
	];
	const names = { 'bsc5-7001': { zh: '织女一', proper: 'Vega' }, 'bsc5-2491': { zh: '天狼', proper: 'Sirius' } };
	it('繁体模式:照屏幕输入「織女一」能定位、能出补全;简体模式照旧', async () => {
		const idx = buildStarIndex(catalog, names);
		expect(findStarByName(idx, '織女一')).toBeNull();
		await hant();
		expect(findStarByName(idx, '織女一').name).toBe('Vega');
		expect(findStarByName(idx, '織女').name).toBe('Vega');
		expect(findStarByName(idx, '织女一').name).toBe('Vega');
		expect(suggestStars(idx, '織').map((e)=>e.star.name)).toEqual(['Vega']);
	});
});

describe('玄学史检索(后端)', () => {
	it('不论界面简繁都带上其它写法 q_any(库里简繁混存);没有检索词时请求不变', async () => {
		const p = { q: '熒惑', page: 1 };
		expect(withQueryVariants(undefined)).toEqual({});
		expect(withQueryVariants({ page: 1 })).toEqual({ page: 1 });
		// 简体界面(转换器已加载):输入简体也带繁体写法
		expect(withQueryVariants({ q: '荧惑' })).toEqual({ q: '荧惑', q_any: ['熒惑'] });
		expect(withQueryVariants(p)).toEqual({ q: '熒惑', page: 1, q_any: ['荧惑'] });
		await hant();
		expect(withQueryVariants(p)).toEqual({ q: '熒惑', page: 1, q_any: ['荧惑'] });
		expect(withQueryVariants({ q: '荧惑' })).toEqual({ q: '荧惑', q_any: ['熒惑'] });
		expect(withQueryVariants({ page: 1 })).toEqual({ page: 1 });
	});
});

describe('名人库页内检索(iframe 里的 SQL)', () => {
	const html = fs.readFileSync(path.join(SRC, '..', 'public', 'astrodata', 'index.html'), 'utf8');
	it('姓名检索与分类检索都按「任一写法」拼 SQL', () => {
		const where = html.slice(html.indexOf('function buildWhere'), html.indexOf('function orderBy'));
		const facet = html.slice(html.indexOf('function renderFacet'), html.indexOf('function toggleCat'));
		expect(where).toMatch(/kwAlts\(kw\)/);
		expect(facet).toMatch(/kwAlts\(kw\)/);
	});
	it('kwAlts:宿主给的写法并进来;独立打开时只有原词', async () => {
		const src = html.slice(html.indexOf('function kwAlts'), html.indexOf('/* ---------- facet'));
		// eslint-disable-next-line no-new-func
		const make = (win)=>new Function('window', `${src}; return kwAlts;`)(win);
		expect(make({})('张三')).toEqual(['张三']);
		await hant();
		expect(make({ __horosaScriptQueryVariants: scriptQueryVariants })('張三')).toEqual(['張三', '张三']);
	});
	it('宿主页在 iframe 加载时挂上 scriptQueryVariants', () => {
		const page = fs.readFileSync(path.join(SRC, 'components/astrodata/AstrodataPage.js'), 'utf8');
		expect(page).toMatch(/__horosaScriptQueryVariants\s*=\s*scriptQueryVariants/);
	});
});
