// 界面简繁 · 白名单词左右邻判据自己的护栏。
// 判据是「否决字 × 白名单词」的组合:否决表里的字与别的白名单词也能拼成常用词(「修改」+「历史」→ 误作「曆史」、
// 「社稷」+「后土」→ 误作「後土」、「称王」+「后来」→ 误作「王后」),全仓文案里一处都不出现时,文案级快照看不见。
//   ① 全部「否决字 × 白名单词」组合逐条拍成快照(hantGuardCombos.fixture.json,已逐条看过):否决表 / 白名单一改即红,
//      新组合要人判 —— 对就重写快照(UPDATE_HANT_GUARD_COMBOS=1 跑一次),不对就改判据;
//   ② 能从词典推出的否决表按词典推:「后土」的左邻 = 词典里「X后 → X後」的 X(+ 季节 / 月),词典升级多出新词即红;
//   ③ 固定反例:判据收紧前误配过的串。
const fs = require('fs');
const path = require('path');
const { toHant } = require('../hantConverter');
const { __HANT_GUARDS_FOR_TEST: G } = require('../hantRules');
const OpenCC = require('opencc-js/dist/umd/cn2t.js');

const FIXTURE = path.join(__dirname, 'hantGuardCombos.fixture.json');

function combos(){
	const out = [];
	Object.keys(G.WORD_GUARDS).forEach((w)=>{
		const g = G.WORD_GUARDS[w];
		Array.from(g.notLeft || '').forEach((c)=>out.push(c + w));
		Array.from(g.notRight || '').forEach((c)=>out.push(w + c));
		Array.from(g.onlyLeft || '').forEach((c)=>out.push(c + w));
		Array.from(g.onlyLeftStrict || '').forEach((c)=>out.push(c + w));
		if(g.onlyLeftStrict){ out.push(w, `行${w}`); }   // 串首 / 表外左邻:不算这个词
	});
	Object.keys(G.TAIL_GUARDS).forEach((ch)=>{
		const g = G.TAIL_GUARDS[ch];
		const words = Object.keys(G.RULES[ch].words).filter((w)=>Array.from(w).length > 1 && w[w.length - 1] === ch);
		Array.from(g.notRight || '').forEach((c)=>words.forEach((w)=>out.push(w + c)));
	});
	Object.keys(G.EDGE_GUARDS).forEach((ch)=>{
		const g = G.EDGE_GUARDS[ch];
		const words = Object.keys(G.RULES[ch].words).filter((w)=>w[0] === ch && (!g.words || g.words.indexOf(w) >= 0));
		Array.from(g.notLeft || '').forEach((c)=>words.forEach((w)=>out.push(c + w)));
	});
	return out;
}

describe('白名单词左右邻判据', () => {
	it('① 否决字 × 白名单词 的全部组合与快照一致(逐条看过;新增 / 改动要人判)', () => {
		const now = {};
		combos().forEach((s)=>{ now[s] = toHant(s); });
		if(process.env.UPDATE_HANT_GUARD_COMBOS === '1'){
			fs.writeFileSync(FIXTURE, `${JSON.stringify(now, null, '\t')}\n`);
		}
		const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
		const diff = [];
		Object.keys(now).forEach((k)=>{ if(saved[k] !== now[k]){ diff.push(`${k}:${saved[k] === undefined ? '(新组合)' : saved[k]} → ${now[k]}`); } });
		Object.keys(saved).forEach((k)=>{ if(!(k in now)){ diff.push(`${k}:(组合已不存在)`); } });
		expect(diff).toEqual([]);
		expect(Object.keys(now).length).toBeGreaterThan(300);   // 防枚举静默失效
	});

	it('词边字的 words 限定只列以该字开头、且在白名单里的词', () => {
		Object.keys(G.EDGE_GUARDS).forEach((ch)=>{
			const g = G.EDGE_GUARDS[ch];
			(g.words || []).forEach((w)=>{
				expect(w[0]).toBe(ch);
				expect(Object.prototype.hasOwnProperty.call(G.RULES[ch].words, w)).toBe(true);
			});
		});
	});

	it('② 「后土」的左邻否决表 = 词典里「X后 → X後」的 X + 季节 / 月(不含 天 / 皇 / 王 一类「X后」作「后」的字)', () => {
		const dictX = new Set();
		const keepHou = new Set();
		OpenCC.Locale.from.cn.flat().forEach((d)=>{
			if(typeof d !== 'string'){ return; }
			d.split('|').forEach((seg)=>{
				const i = seg.indexOf(' ');
				if(i < 0){ return; }
				const k = seg.slice(0, i);
				const v = seg.slice(i + 1);
				if(Array.from(k).length === 2 && k[1] === '后'){ (v[1] === '後' ? dictX : keepHou).add(k[0]); }
			});
		});
		const table = new Set(Array.from(G.HOUTU_NOT_LEFT));
		const EXTRA = ['春', '夏', '冬', '月'];
		expect([...dictX].filter((c)=>!table.has(c)).sort()).toEqual([]);
		expect([...table].filter((c)=>!dictX.has(c) && EXTRA.indexOf(c) < 0).sort()).toEqual([]);
		expect([...keepHou].filter((c)=>table.has(c) && !dictX.has(c)).sort()).toEqual([]);
		expect(table.has('天') || table.has('皇') || table.has('稷') || table.has('祇')).toBe(false);
	});

	it('② 「台座」的左邻否决表 = 词典里「X台」作「X臺 / X檯」的 X(舞台座位 / 柜台座 = X台 + 座)', () => {
		const dictX = new Set();
		OpenCC.Locale.from.cn.flat().forEach((d)=>{
			if(typeof d !== 'string'){ return; }
			d.split('|').forEach((seg)=>{
				const i = seg.indexOf(' ');
				if(i < 0){ return; }
				const k = seg.slice(0, i);
				const v = seg.slice(i + 1);
				if(Array.from(k).length === 2 && k[1] === '台' && v[1] !== '台'){ dictX.add(k[0]); }
			});
		});
		expect([...new Set(Array.from(G.TAIZUO_NOT_LEFT))].sort()).toEqual([...dictX].sort());
		expect(G.WORD_GUARDS['台座'].notLeft).toBe(G.TAIZUO_NOT_LEFT);
	});

	it('② 「姓于 / 姓朴」的左邻否决表含词典里全部「X姓」的 X 与「百」(百姓于是 / 同姓于此 / 复姓于)', () => {
		const dictX = new Set();
		OpenCC.Locale.from.cn.flat().forEach((d)=>{
			if(typeof d !== 'string'){ return; }
			d.split('|').forEach((seg)=>{
				const k = seg.slice(0, seg.indexOf(' '));
				if(Array.from(k).length === 2 && k[1] === '姓'){ dictX.add(k[0]); }
			});
		});
		dictX.add('百');
		// 词典的「X姓」里 于 / 余 / 朱 / 周 … 本身是姓(「于姓」= 姓于),左邻仍是姓氏语境,不作否决
		const SURNAMES = new Set(Array.from('于余凌周朱梁涂胡'));
		const table = new Set(Array.from(G.SURNAME_NOT_LEFT));
		expect([...dictX].filter((c)=>!SURNAMES.has(c) && !table.has(c)).sort()).toEqual([]);
		expect(G.WORD_GUARDS['姓于'].notLeft).toBe(G.SURNAME_NOT_LEFT);
		expect(G.WORD_GUARDS['姓朴'].notLeft).toBe(G.SURNAME_NOT_LEFT);
	});

	it('② 「欲」的欲望义白名单 = 通用词典里「欲 → 慾」的全部词条(词典升级多出新词即红)', () => {
		const dict = {};
		OpenCC.Locale.from.cn.flat().forEach((d)=>{
			if(typeof d !== 'string'){ return; }
			d.split('|').forEach((seg)=>{
				const i = seg.indexOf(' ');
				if(i < 0){ return; }
				const k = seg.slice(0, i);
				const v = seg.slice(i + 1);
				if(k.indexOf('欲') >= 0 && v.indexOf('慾') >= 0){ dict[k] = v; }
			});
		});
		expect(G.RULES['欲'].words).toEqual(dict);
		expect(G.RULES['欲'].def).toBe('欲');
	});

	it('③ 固定反例:判据收紧前误配过的串', () => {
		const cases = [
			['修改历史', '修改歷史'], ['更改历史记录', '更改歷史記錄'], ['旧历史书', '舊歷史書'], ['修改历时三天', '修改歷時三天'],
			['占星历史', '占星歷史'], ['炎黄历史', '炎黃歷史'], ['华夏历经', '華夏歷經'],
			['社稷后土', '社稷后土'], ['地祇后土', '地祇后土'], ['称王后来', '稱王後來'], ['第三台', '第三臺'], ['十三台', '十三臺'],
			['行人欲至', '行人欲至'], ['久望行人欲侯归', '久望行人欲侯歸'], ['行人欲渡意', '行人欲渡意'], ['配佳人欲偕老', '配佳人欲偕老'],
			['堂上无人欲何恃', '堂上無人欲何恃'], ['人欲周全天欲差', '人欲周全天欲差'], ['倒转则器物欲落案下', '倒轉則器物欲落案下'],
			['贵人欲见', '貴人欲見'], ['病人欲去', '病人欲去'], ['纵欲停舟', '縱欲停舟'], ['寡人欲伐', '寡人欲伐'],
		];
		expect(cases.filter(([a, b])=>toHant(a) !== b).map(([a, b])=>`${a}→${toHant(a)}(应 ${b})`)).toEqual([]);
	});

	it('③′ 收紧后原有的正例不变', () => {
		const cases = [
			['公历时间', '公曆時間'], ['阳历时间', '陽曆時間'], ['黄历时辰', '黃曆時辰'], ['星历经度', '星曆經度'], ['农历行年', '農曆行年'],
			['农历过年', '農曆過年'], ['按农历来算', '按農曆來算'], ['农历次年', '農曆次年'],
			['3 天后', '3 天後'], ['十二天后出发', '十二天後出發'], ['第十二天后', '第十二天後'], ['第十二将天后', '第十二將天后'], ['末传天后', '末傳天后'],
			['立春后土囚', '立春後土囚'], ['之后土地', '之後土地'], ['雨后土壤', '雨後土壤'], ['皇天后土', '皇天后土'], ['可拜后土', '可拜后土'],
			['王后', '王后'], ['三台', '三台'], ['紫微三台八座', '紫微三台八座'],
			['十分钟会议', '十分鐘會議'], ['分钟情况', '分鐘情況'], ['古钟繇书', '古鍾繇書'], ['钟会', '鍾會'],
			['存天理，灭人欲', '存天理，滅人慾'], ['天理人欲', '天理人慾'], ['人欲横流', '人慾橫流'], ['物欲横流', '物慾橫流'],
			['束缚、物欲、上瘾', '束縛、物慾、上癮'], ['欲望', '慾望'], ['情欲牵连', '情慾牽連'], ['为私欲奔波', '為私慾奔波'],
			['色欲过度', '色慾過度'], ['求知欲被激活', '求知慾被激活'], ['欲至', '欲至'], ['所欲', '所欲'], ['随心所欲', '隨心所欲'],
		];
		expect(cases.filter(([a, b])=>toHant(a) !== b).map(([a, b])=>`${a}→${toHant(a)}(应 ${b})`)).toEqual([]);
	});
});
