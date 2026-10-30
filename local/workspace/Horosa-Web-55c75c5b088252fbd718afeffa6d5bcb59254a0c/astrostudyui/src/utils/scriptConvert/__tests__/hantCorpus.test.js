// 界面简繁 · 全仓文案级护栏:拿 src 下全部界面 / 古籍文案跑真转换器。
//   ① 「克」随词典(未判作生克义)的上下文快照:新文案里「克」的邻字不在生克语境表里时会出现在这里 ——
//      属生克义 → 把邻字补进 hantRules.js 的 KE_CONTEXT.domain;不是 → 把这一条补进下面的快照。
//   ② 转两次与转一次相同(幂等):例外只许是下面列出的、由通用词典本身造成的几处。
//   ④ 白名单词跨词边界快照:白名单词的头 / 尾字与词外邻字组成通用词典里的词(「3 天后」「分钟会」「辛丑事」一类)时,
//      该位到底取哪个字要人判 —— 新出现的组合会红:不对就在 hantRules.js 的 WORD_GUARDS / EDGE_GUARDS 补判据,对就补进快照。
//   ⑥ 「只」作「隻」(量词)的每处上下文快照、数词 / 指示字后仍作「只」(副词)的每处上下文快照(防漏转)
//      + 整句转换后的禁形(「只 + 动词」切成「隻」、术数名词转错):
//      新出现的「隻」上下文要人判(量词 → 补进快照;副词 → 改 hantRules.js 的 ZHI_CONTEXT);禁形只认转换新造出来的
//      (原文本身就写着的繁体不算)。
//   ③ 检索子串性质:对每段文案的每个 1–3 字片段,照屏幕输入(显示写法的那一段)与直接输入原文那一段都能命中
//      (逐位对齐比对;整串归一键只验整串、验不到子串 —— 「乾」「坐」「覆」「俱」「著」「鍾」都曾漏在这里)。
const fs = require('fs');
const path = require('path');
const hantConv = require('../hantConverter');
const { matchAcrossScripts } = require('../scriptMatch');
const { applyHantDomainRules } = require('../hantRules');
const OpenCC = require('opencc-js/dist/umd/cn2t.js');

const { toHant, __traceHant } = hantConv;

const SRC = path.resolve(__dirname, '../../..');
const SKIP_DIRS = new Set(['__tests__', 'test', '.umi', '.umi-production', '.umi-test']);
const RUN_RE = /[㐀-鿿，、：。「」《》0-9A-Za-z·]{2,}/g;
const HAN = /[㐀-鿿]/;

function collectRuns(){
	const runs = new Set();
	(function walk(dir){
		fs.readdirSync(dir).forEach((f)=>{
			const p = path.join(dir, f);
			const st = fs.statSync(p);
			if(st.isDirectory()){
				if(!SKIP_DIRS.has(f)){ walk(p); }
				return;
			}
			if(!/\.(js|jsx|json|md)$/.test(f)){ return; }
			const text = fs.readFileSync(p, 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
			const ms = text.match(RUN_RE) || [];
			ms.forEach((m)=>{ if(HAN.test(m)){ runs.add(m); } });
		});
	})(SRC);
	return [...runs];
}

const RUNS = collectRuns();

// ①「克」随词典的上下文(左字 克 右字;^ / $ = 串首尾)——已逐条看过,都不是生克义
const KE_DICT_CONTEXTS = [
	// 地名 / 译名
	'^克东', '^克井', '^克什', '^克卢', '什克腾', '兰克福', '凯克$', '努克$', '勒克县', '勒克瑙',
	'北克城', '可克达', '奥克兰', '布克赛', '托克前', '托克托', '托克旗', '托克逊', '斯克$', '未克$',
	'温克族', '牙克石', '瓦克肖', '科克$', '萨克族', '萨克自', '逊克县', '雷克雅', '鲁克$',
	// 克制(情绪 / 冲动 / 措辞 …)与古文 克 = 能
	'^克制', '、克制', '。克制', '以克遂', '咎克。', '度克制', '弗克之', '性克制', '望克遂', '臣克任',
	'语克制', '辞克制', '述克制', '遂克先',
	'托克布',   // hantRules.js 出生地音译保留字表字面量「里托克布扎于采范」(不上界面)
];

// ② 转两次会再变的(通用词典在繁体上的二次改写,与本域校正无关)
const KNOWN_NON_IDEMPOTENT = [
	'于洪區→於', '云城區→雲', '廠家私有參→俬', '忿窒欲，宜→慾', '木里藏族→裡',
	'毛里塔尼→裡', '滿洲里市→裡', '精打采→採', '著、划著關→劃', '馬普托→託',
];

// ④ 白名单词跨词边界的上下文(左邻[词]右邻;^ / $ = 串首尾)——已逐条看过,该位取字都对
const WORD_BOUNDARY_CONTEXTS = [
	'^[三台]台', '^[亚历]山', '^[天后]主', '^[天后]宫', '^[天后]生', '^[天后]重', '^[太冲]克', '^[獨占]百', '^[生发]到', '^[神后]加', '^[约占]四', '^[马克]斯',
	'n[霸占]主', '、[马克]斯', '一[回归]年', '上[冲突]时', '不[克美]$', '不[占位]$', '不[占便宜]$', '不[占便宜]。', '不[占用]发', '交[回归]$', '交[回归]当', '交[回归]年', '任[天冲]天',
	'依[巴克]区', '值[冲突]、', '勇[斗狠]。', '北[回归]线', '南[回归]线', '只[要冲]到', '台[台辅]之', '含[马克]斯', '回[回归]锚', '回[回归]黄', '回[天后]，', '因[争斗]起',
	'图[克服]困', '大[历史]节', '太[冲来]金', '安[克雷]奇', '尔[克孜]自', '尼[克斯]$', '年[历史]对', '性[约占]四', '战[斗争]文', '所[占座]定', '按[回归]$', '按[回归]坐', '按[回归]年',
	'按[回归]座', '按[回归]边', '按[回归]黄', '新[历史]供', '无[干劲]，', '明[强干]、', '星[回归]$', '星[回归]约', '曰[云云]$', '曰[云云]」', '曰[云云]二', '曰[云云]此',
	'曰[云云]言', '曰[云云]隂', '曼[蒂克]$', '曼[蒂克]的', '有[才干]却', '木[舒克]$', '木[舒克]市', '杜[争斗]起', '法[克斯]$', '温[得和克]$', '特[克斯]县', '的[历史]中',
	'的[历史]共', '的[历史]占', '的[历史]命', '的[历史]时', '的[历史]牌', '的[历史]背', '的[历年]$', '的[历次]起', '的[钟表]时', '相[冲突]的', '相[冲突]，', '相[斗争]，',
	'看[马克]斯', '纳[克里]$', '而[云云]$', '至[所历]日', '苏[克雷]$', '谷[子云]：', '身[经历]$', '还[出丑]儿', '重[回归]$', '重[回归]·', '重[回归]：', '阅[历史]年',
	'阿[克拉]$', '，[太冲]到', '·[月系]上',
	'之[欲望]产', '忿[窒欲]、', '忿[窒欲]，',
	// 2026-10-29 全仓复核新增的整词(回 / 制 / 发 / 注 / 征 / 托 / 折 …)跨边界处,逐条看过
	'^[凌制]取', '^[发生]于', '^[宿度制]为', '^[立向]后', '^[魚游]春', '^[魚游]泳', '。[凌制]取', '一[吊客]，', '一[手托]杯', '一[折叠]成', '下[注明]$', '不[折叠]$',
	'不[折叠]段', '与[骤发]状', '专[注意]志', '中[发生]了', '乱[发萌]之', '事[发生]$', '事[发生]、', '事[发生]。', '事[发生]，', '交[回到]本', '份[宫制]表', '会[发生]$',
	'会[发生]。', '会[发生]什', '会[发生]大', '会[发生]战', '会[发生]灾', '会[发生]疾', '会[发生]诉', '会[发生]连', '会[发生]重', '会[发生]，', '会[发送]给', '传[发用]与',
	'俱[发动]克', '俱[发动]，', '再[发送]。', '再[回到]$', '再[回到]力', '再[回到]这', '分[宫制]变', '分[宫制]定', '分[宫制]衡', '加[注意]莫', '南[征吉]。', '只[发生]在',
	'只[回放]折', '只[回答]、', '只[回答]「', '合[发动]最', '周[折叠]到', '周[折叠]成', '器[立向]时', '多[回到]起', '天[复现]锚', '字[注明]当', '宅[立向]时', '实[发生]的',
	'害[发动]成', '尾[注明]了', '尾[注明]略', '并[发动]，', '并[回到]存', '并[回到]第', '开[发送]时', '开[回到]「', '开[回到]上', '开[回到]今', '开[回到]按', '张[宫制]表',
	'念[出征]的', '恢[复成]功', '恢[复成]当', '恢[复现]状', '手[折芹]扞', '拉[回到]首', '指[回到]原', '接[回放]存', '接[回答]更', '接[回答]问', '整[宫制]表', '断[发福]发',
	'断[发送]$', '新[发送]图', '日[发生]了', '星[回到]本', '星[回宫]九', '星[回宫]年', '有[征凶]。', '有[面包屑]$', '木[制约]$', '木[制约]·', '木[制约]凶', '标[签注「]仅',
	'正[发生]了', '步[向导]，', '法[布施]之', '用[出征]。', '病[发生]，', '盘[回传]，', '盘[回到]扫', '盘[回到]报', '盘[回到]整', '盘[回收]站', '确[立向]、', '素[借贷]$',
	'素[借贷]，', '经[折叠]$', '经[折叠]进', '行[注明]当', '被[发用]相', '要[回到]「', '要[回到]上', '要[回到]原', '要[回到]自', '要[回到]跟', '要[回到]魔', '要[回报]却',
	'要[回答]的', '让[须眉]$', '该[回到]「', '财[布施]之', '轮[发送]$', '轮[回放]$', '轮[回放]各', '轮[回答]完', '返[回宫]位', '返[回宫]框', '迟[回应]这', '迟[回报]$',
	'部[发送]$', '都[发动]。', '都[发生]$', '都[回到]扫', '都[注明]了', '重[折算]$', '金[发动]，', '随[宫制]变', '面[宫制]取', '面[折叠]表', '页[面包屑]还', '食[发生]于',
	'黄[卷发]，', '，[立向]应',
	'合[格里历]闰',   // 「J + Y 合格里历闰年规则」:合 = 符合,格里历 = 公历
];

// ⑥「只」作「隻」处的上下文(左字 只 右字;^ / $ = 串首尾)——已逐条看过,都是量词
const ZHI_CLASSIFIER_CONTEXTS = [
	// 成语 / 固定词(含 hantRules.js 白名单表本身的词条)
	'^只声', '^只字', '^只影', '^只手', '^只眼', '^只言', '^只身', '^只轮', '^只鸡', '一只眼', '一只耳', '一只蜥',
	'一只黑', '两只手', '两只杯', '五只眼', '具只眼', '哪只手', '多只，', '夫只妇', '形只影', '影只$', '影只形', '某只手',
	'纸只字', '舰只$', '船只$', '言只字', '言只語', '言只语', '语只字', '语只辞', '身只影', '酒只鸡', '马只轮',
	'牛只$', '牛只。', '犬只$', '猪只$', '鸡只$',
];

// ⑥′ 反向:数词 / 指示 / 量化字(及 是 / 有 / 数)后面的「只」仍作「只」处(左二字 左字 只 右字 右二字)——已逐条看过,都是副词。
// 新出现的要人判:是量词 → 改 hantRules.js 的 ZHI_CONTEXT(或改文案原文的错字,如繁体古籍里把「隻」写成「只」);是副词 → 补进这里。
const ZHI_COUNT_LEFT = new Set(Array.from('0123456789０１２３４５６７８９一二两三四五六七八九十百千万亿几半这那哪某每整单多余少另是有数'));
const ZHI_ADVERB_AFTER_COUNT_CONTEXTS = [
	'^余只标关', '^另只读显', '^数只增$', '^这只是一', '^那只是数', '一半只有$', '不是只改叠', '不是只断主', '不是只罗列', '不是只说吉',
	'刻数只显示', '多数只管「', '己9只能得', '度数只负责', '归一只影响', '打数只用四', '组是只读展', '而这只是你', '而这只是时', '而这只是理',
	'计数只是姑', '这是只读分', '逐一只论临', '遠是只從容',
];

// ⑥ 转换新造出来就是错的写法:副词「只」被切成「隻」(只影响 → 隻影響、切换只换 → 切換隻換、是只读 → 是隻讀);
// 术数名词(台座光贵 = 台辅 + 八座、紫微月系 / 时系诸星、十二辟卦 = 消息卦、天干 / 干支、姓氏于 / 朴)
const BANNED_HANT_FORMS = [
	/隻(?:影響|換|讀|改|看|在|有|是|能|要|會|可|用|取|算|認|管|留|剩|顯|作|做|寫|存|給|對|把|將|被|當|限|收|列|跟|隨|按|以|從|由|高亮|手動|適用|針對|保留|需要)/g,
	/臺座光|[年月日時]繫(?![於住着著緊牢])|闢卦|姓於|姓樸|幹支|天幹|地支藏幹/g,
];

// 转换结果 out 里由转换新造出来的禁形(原文同一位置本来就写着的不算)
function newBannedForms(src, out){
	const s = Array.from(src);
	const found = [];
	BANNED_HANT_FORMS.forEach((re)=>{
		re.lastIndex = 0;
		let m;
		while((m = re.exec(out))){
			const at = Array.from(out.slice(0, m.index)).length;
			if(s.slice(at, at + Array.from(m[0]).length).join('') !== m[0]){ found.push(m[0]); }
		}
	});
	return found;
}

// 通用词典(简 → 繁)的词条(2–4 字):用来认「白名单词的边字与词外邻字也能组成一个词」
const DICT_WORDS = (()=>{
	const set = new Set();
	OpenCC.Locale.from.cn.flat().forEach((d)=>{
		if(typeof d !== 'string'){ return; }
		d.split('|').forEach((seg)=>{ const k = seg.slice(0, seg.indexOf(' ')); const n = Array.from(k).length; if(n >= 2 && n <= 4){ set.add(k); } });
	});
	return set;
})();

function crossesDictWord(s, st, en){
	const spans = (lo, hi, edge)=>{
		for(let p = lo; p < hi; p += 1){
			for(let L = 2; L <= 4; L += 1){
				const e = p + L;
				if(e <= edge || e > s.length){ continue; }
				if(DICT_WORDS.has(s.slice(p, e).join(''))){ return true; }
			}
		}
		return false;
	};
	return spans(Math.max(0, st - 3), st, st) || spans(st + 1, en, en);
}

describe('全仓文案 · 界面简繁', () => {
	it('文案量足够(防遍历静默失效)', () => {
		expect(RUNS.length).toBeGreaterThan(50000);
	});

	it('①「克」随词典处都已逐条确认(新增的要么补生克语境字,要么补进快照)', () => {
		const seen = new Set();
		RUNS.forEach((r)=>{
			if(r.indexOf('克') < 0){ return; }
			const s = Array.from(r);
			__traceHant(r).trace.forEach(([i, ch, how])=>{
				if(ch === '克' && how === 'ctx-dict'){ seen.add(`${s[i - 1] || '^'}克${s[i + 1] || '$'}`); }
			});
		});
		// 只判新增(快照里多出来的旧项不判:不同仓的文案集合不同,少了几条不说明出错)
		const extra = [...seen].filter((w)=>KE_DICT_CONTEXTS.indexOf(w) < 0).sort();
		expect(extra).toEqual([]);
	});

	it('② 转两次与转一次相同(例外只许是已知的词典二次改写)', () => {
		const bad = new Set();
		RUNS.forEach((r)=>{
			const h = toHant(r);
			const h2 = toHant(h);
			if(h2 === h){ return; }
			const a = Array.from(h);
			const b = Array.from(h2);
			for(let i = 0; i < a.length; i += 1){
				if(a[i] !== b[i]){ bad.add(`${a.slice(Math.max(0, i - 2), i + 3).join('')}→${b[i]}`); break; }
			}
		});
		const extra = [...bad].filter((w)=>KNOWN_NON_IDEMPOTENT.indexOf(w) < 0).sort();
		expect(extra).toEqual([]);
	});

	it('④ 白名单词跨词边界处都已逐条确认(新增的要么补判据,要么补进快照)', () => {
		const seen = new Set();
		RUNS.forEach((r)=>{
			const s = Array.from(r);
			__traceHant(r).trace.forEach(([, , how, span])=>{
				if(how !== 'word' || !span){ return; }
				const [st, len] = span;
				if(crossesDictWord(s, st, st + len)){ seen.add(`${s[st - 1] || '^'}[${s.slice(st, st + len).join('')}]${s[st + len] || '$'}`); }
			});
		});
		const extra = [...seen].filter((w)=>WORD_BOUNDARY_CONTEXTS.indexOf(w) < 0).sort();
		expect(extra).toEqual([]);
		expect(seen.size).toBeGreaterThan(20);   // 防判据静默失效
	});

	it('⑤ 一对多字随词典「保持原字」处都已逐条确认(新增的要么补白名单词,要么补进快照)', () => {
		// 「里 / 台 / 后 / 云」缺省随词典;词典没把它切进词时就保持原字。界面新文案里「下拉里」「列表里」这类 = 里面,
		// 词典不认 → 繁体界面显示成「里」(该作「裡」)。凡保持原字的新上下文(左字 字 右字)都要人判:
		// 该转 → 在 hantRules.js 的 words 补整词;本就该保持(里程 / 千里 / 三台 / 皇后 …)→ 补进 hantDictKeep.snapshot.json。
		const KEEP_CHARS = new Set(['里', '台', '后', '云']);
		// eslint-disable-next-line global-require
		const SNAP = new Set(require('./hantDictKeep.snapshot.json'));
		const seen = new Set();
		RUNS.forEach((r)=>{
			if(!Array.from(r).some((c)=>KEEP_CHARS.has(c))){ return; }
			const s = Array.from(r);
			const { out, trace } = __traceHant(r);
			const o = Array.from(out);
			trace.forEach(([i, ch, how])=>{
				if(KEEP_CHARS.has(ch) && how === 'def' && o[i] === ch){ seen.add(`${s[i - 1] || '^'}${ch}${s[i + 1] || '$'}`); }
			});
		});
		const extra = [...seen].filter((w)=>!SNAP.has(w)).sort();
		expect(extra).toEqual([]);
		expect(seen.size).toBeGreaterThan(50);   // 防判据静默失效
		expect(toHant('在下方两个下拉里分别选')).toContain('下拉裡');
	});

	it('⑥「只」作「隻」处都是量词、数词 / 指示字后仍作「只」处都是副词(新增的要人判);整句转换后不出现禁形', () => {
		const seen = new Set();
		const kept = new Set();
		const bad = new Set();
		RUNS.forEach((r)=>{
			const s = Array.from(r);
			const o = Array.from(toHant(r));
			if(o.length !== s.length){ return; }
			s.forEach((c, i)=>{
				if(c !== '只'){ return; }
				if(o[i] === '隻'){ seen.add(`${s[i - 1] || '^'}只${s[i + 1] || '$'}`); }
				if(o[i] === '只' && ZHI_COUNT_LEFT.has(s[i - 1])){ kept.add(`${s[i - 2] || '^'}${s[i - 1]}只${s[i + 1] || '$'}${s[i + 2] || '$'}`); }
			});
			newBannedForms(r, o.join('')).forEach((f)=>bad.add(`${r.slice(0, 40)} → ${f}`));
		});
		if(process.env.PRINT_ZHI_CONTEXTS === '1'){ console.log(JSON.stringify([...seen].sort())); }
		expect([...seen].filter((w)=>ZHI_CLASSIFIER_CONTEXTS.indexOf(w) < 0).sort()).toEqual([]);
		expect([...kept].filter((w)=>ZHI_ADVERB_AFTER_COUNT_CONTEXTS.indexOf(w) < 0).sort()).toEqual([]);
		expect(kept.size).toBeGreaterThan(5);   // 防判据静默失效
		expect([...bad].sort()).toEqual([]);
		expect(seen.size).toBeGreaterThan(5);   // 防判据静默失效
		// 判别力:禁形认得出转换新造的,也放过原文本身的繁体
		expect(newBannedForms('闢卦细判', toHant('闢卦细判'))).toEqual([]);
		expect(newBannedForms('切换只换显示', '切換隻換顯示')).toEqual(['隻換']);   // 词典原样(未校正)的结果会被抓
		expect(newBannedForms('台座光贵', '臺座光貴')).toEqual(['臺座光']);
		expect(applyHantDomainRules('只影响', '隻影響')).toBe('只影響');
	});

	it('③ 每段文案的每个 1–3 字片段:照屏幕输入、直接输入都能命中(无漏命中)', () => {
		const bad = [];
		let total = 0;
		RUNS.forEach((r)=>{
			if(bad.length >= 20){ return; }
			const s = Array.from(r);
			const shown = Array.from(toHant(r));
			if(shown.length !== s.length){ bad.push(`等长:${r}`); return; }
			for(let i = 0; i < s.length && bad.length < 20; i += 1){
				if(!HAN.test(s[i])){ continue; }
				for(let j = i + 1; j <= Math.min(s.length, i + 3); j += 1){
					total += 1;
					const typed = s.slice(i, j).join('');
					const seen = shown.slice(i, j).join('');
					if(!matchAcrossScripts(r, typed, hantConv)){ bad.push(`${r} ⊉ ${typed}`); }
					if(!matchAcrossScripts(r, seen, hantConv)){ bad.push(`${r} ⊉ ${seen}(照屏幕)`); }
				}
			}
		});
		expect(bad).toEqual([]);
		expect(total).toBeGreaterThan(100000);
	});

	it('③′ 固定反例:显示的不是那个字就不命中(无乱命中)', () => {
		const no = [['天干地支', '乾'], ['干支', '乾'], ['著作', '着'], ['幹部', '乾'], ['鍾馗', '鐘'], ['天干', '幹']];
		expect(no.filter(([h, q])=>matchAcrossScripts(h, q, hantConv))).toEqual([]);
	});
});
