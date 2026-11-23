// AI 助手·按用户给的起卦结果建事盘:六爻 / 小六壬 / 灵棋 / 统摄法 / 小成图 / 飞宫 / 金口诀 / 天文地占(报数)。
// 每类 = 输入格式 + 与页面同一核心的纯函数成卦 + 页面同形 payload + 快照正文。快照必存 payload.snapshot:
// 挂载只在 module 匹配时读它,回退重建只覆盖六爻 / 统摄法。判读设置一律取该页保存的设置(与用户在页面上起卦同口径)。
// 只用用户给的结果:绝不随机、绝不凭时间代起(起课时间只作占时记录,与页面同)。技法页模块一律惰性载入(不进工具首包)。
import { safeJsonParseFromStorage } from '../safeStorage';

// 起课时辰序数(子 1 … 亥 12;与六爻页「附加时辰」同一张 HourZi / ZiList 表),取自起课时间的钟点
async function castHourOrdinal(record){
	const m = `${(record && (record.divTime || record.birth)) || ''}`.match(/\s(\d{1,2}):/);
	const h = m ? Number(m[1]) : 12;
	const gc = await import('../../components/gua/GuaConst');
	return gc.ZiList.indexOf(gc.HourZi[h]) + 1;
}
export const INPUT_CASTABLE = ['liuyao', 'xiaoliuren', 'lingqi', 'tongshefa', 'xiaochengtu', 'feigong', 'jinkou', 'geomancy',
	'liureng', 'qimen', 'huangji', 'wuzhao', 'shenyishu', 'taixuan', 'jingjue'];
export const TRIGRAM_NAMES = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

const bad = (message)=>({ ok: false, code: 'E_ARGS_INVALID', message });
const isInt = (v)=>typeof v === 'number' && Number.isInteger(v);
function dongList(v){
	if(v === undefined || v === null){ return { ok: true, list: [] }; }
	const arr = Array.isArray(v) ? v : [v];
	if(arr.some((n)=>!isInt(n) || n < 1 || n > 6)){ return { ok: false }; }
	return { ok: true, list: arr.filter((n, i)=>arr.indexOf(n) === i) };
}

async function caseFields(record){
	const ctx = await import('../aiAnalysisContext');
	return ctx.buildCaseFieldsForRecord(record);
}
async function timeLinesOf(fields){
	try{ const t = await import('../divinationTimeDraft'); return t.buildQiKeTimeLines(fields) || []; }catch(e){ return []; }
}
async function nongliOf(fields){
	try{
		const t = await import('../divinationTimeDraft');
		return t.deriveNongliUniversalSync(fields) || (await t.deriveNongliRemote(fields)) || null;
	}catch(e){ return null; }
}

// 每类:label(中文名)· module(payload.module,= 页面存档模块)· sourceModule · version · inputs(给外部 AI 看的输入格式)· example · build
export const CAST_SPECS = {
	liuyao: {
		label: '六爻', module: 'guazhan', sourceModule: 'guazhan', version: 2,
		inputs: '九选一:{ yao: [六个数,初爻在前;6 老阴 / 7 少阳 / 8 少阴 / 9 老阳,6 与 9 为动爻] } · { coins: [六个背面数 0-3,初爻在前;三背 = 老阳、三字 = 老阴,字背口径跟六爻页设置] } · { numbers: [上卦数, 下卦数, 动爻数](米卦 / 报数)} · { dice: [三个骰点 1-6](上卦 = 第一骰,下卦 = 第二骰,动爻 = 三骰之和)} · { strokes: [两个笔画数](测字:上 / 下卦,动爻 = 两数和)} · { sounds: [两个闻声数](闻声:同测字)} · { direction: 北 / 东北 / 东 / 东南 / 南 / 西南 / 西 / 西北, hourNum?: 1-12(缺省 = 起课时辰序数)}(方位外应)· { number: 数字串, numberMoving?: hour(加起课时辰,缺省)/ sum(只取数位和)}(单数字起卦)— 后五种与六爻页同名按钮同一算法',
		example: { yao: [7, 8, 9, 7, 6, 8] },
		async build(inputs, record){
			let lines = null;
			let moving = [];
			if(Array.isArray(inputs.yao)){
				if(inputs.yao.length !== 6 || inputs.yao.some((v)=>[6, 7, 8, 9].indexOf(v) < 0)){ return bad('yao 须为六个 6 / 7 / 8 / 9(初爻在前)'); }
				lines = inputs.yao.map((v)=>(v === 7 || v === 9 ? 1 : 0));
				moving = inputs.yao.map((v, i)=>(v === 6 || v === 9 ? i + 1 : 0)).filter(Boolean);
			}else if(Array.isArray(inputs.coins)){
				if(inputs.coins.length !== 6 || inputs.coins.some((b)=>!isInt(b) || b < 0 || b > 3)){ return bad('coins 须为六个 0-3 的背面数(初爻在前)'); }
				const [pad, schools] = await Promise.all([import('../../components/guazhan/LiuYaoCastPad'), import('../../components/gua/liuyaoSchools')]);
				const face = (schools.normalizeLiuyaoSettings(schools.loadPersistedLiuyaoSettings()) || {}).coinFace;
				const ys = inputs.coins.map((b)=>pad.coinTossToYao(b, face));
				lines = ys.map((y)=>y.value);
				moving = ys.map((y, i)=>(y.change ? i + 1 : 0)).filter(Boolean);
			}else if(Array.isArray(inputs.numbers)){
				if(inputs.numbers.length !== 3 || inputs.numbers.some((n)=>!isInt(n) || n < 1 || n > 999999)){ return bad('numbers 须为三个正整数:[上卦数, 下卦数, 动爻数]'); }
				const pad = await import('../../components/guazhan/LiuYaoCastPad');
				const g = pad.numsToGua(inputs.numbers[0], inputs.numbers[1], inputs.numbers[2]);
				lines = g.lines; moving = g.moving;
			}else if(Array.isArray(inputs.dice)){
				// 掷骰(六爻页同一算法:上 = 一骰、下 = 二骰、动 = 三骰之和)
				if(inputs.dice.length !== 3 || inputs.dice.some((n)=>!isInt(n) || n < 1 || n > 6)){ return bad('dice 须为三个 1-6 的骰点'); }
				const pad = await import('../../components/guazhan/LiuYaoCastPad');
				const g = pad.numsToGua(inputs.dice[0], inputs.dice[1], inputs.dice[0] + inputs.dice[1] + inputs.dice[2]);
				lines = g.lines; moving = g.moving;
			}else if(Array.isArray(inputs.strokes) || Array.isArray(inputs.sounds)){
				// 测字笔画 / 闻声数(六爻页同一算法:上 / 下卦各取一数,动爻 = 两数之和)
				const arr = Array.isArray(inputs.strokes) ? inputs.strokes : inputs.sounds;
				if(arr.length !== 2 || arr.some((n)=>!isInt(n) || n < 1 || n > 999)){ return bad(`${Array.isArray(inputs.strokes) ? 'strokes' : 'sounds'} 须为两个 1-999 的正整数`); }
				const pad = await import('../../components/guazhan/LiuYaoCastPad');
				const g = pad.numsToGua(arr[0], arr[1], arr[0] + arr[1]);
				lines = g.lines; moving = g.moving;
			}else if(inputs.direction !== undefined){
				// 方位外应(六爻页同一份方位表与算法 fangweiToGua);时辰数缺省取起课时辰序数(子 1 … 亥 12)
				const pad = await import('../../components/guazhan/LiuYaoCastPad');
				const fi = pad.FANGWEI.findIndex((f)=>f.k === `${inputs.direction}`);
				if(fi < 0){ return bad(`direction 只认 ${pad.FANGWEI.map((f)=>f.k).join(' / ')}`); }
				let h = inputs.hourNum;
				if(h === undefined){ h = await castHourOrdinal(record); }
				if(!isInt(h) || h < 1 || h > 12){ return bad('hourNum 须为 1-12(时辰序数,子 1 … 亥 12)'); }
				const g = pad.fangweiToGua(fi, h);
				lines = g.lines; moving = g.moving;
			}else if(inputs.number !== undefined){
				// 单数字起卦(六爻页同一算法 singleNumberGua);动爻取法两档可复现:加起课时辰(页面缺省)/ 只取数位和;页面「随机」一档不开放(不可复现)
				const str = `${inputs.number}`.trim();
				if(!/^\d{1,30}$/.test(str)){ return bad('number 须为数字串(1-30 位)'); }
				if(inputs.numberMoving !== undefined && ['hour', 'sum'].indexOf(inputs.numberMoving) < 0){ return bad('numberMoving 只能是 hour(加起课时辰)或 sum(只取数位和)'); }
				const pad = await import('../../components/guazhan/LiuYaoCastPad');
				const addend = inputs.numberMoving === 'sum' ? 0 : await castHourOrdinal(record);
				const g = pad.singleNumberGua(str, addend);
				if(!g){ return bad('number 须为数字串'); }
				lines = g.lines; moving = g.moving;
			}else{
				return bad('六爻要给 yao / coins / numbers / dice / strokes / sounds / direction / number 其中一种');
			}
			const [ctx, consts] = await Promise.all([import('../aiAnalysisContext'), import('../../components/gua/GuaConst')]);
			const r = await ctx.buildSixyaoCaseFromLines(record, lines, moving);
			if(!r){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: true, message: '起课时刻的农历没取到(本机排盘服务可能还没就绪),未建事盘' }; }
			const g = consts.Gua64[r.gua.currentGua] || {};
			return { ok: true, body: { gua: r.gua }, snapshot: r.snapshot, summary: `${g.name || '成卦'}${moving.length ? ` · 动爻 ${moving.join('、')}` : ' · 静卦'}` };
		},
	},
	// 金口诀:地分是求测者报出的(选支 / 报数 / 笔画 / 翻书页数 / 颜色 / 属相),定课本身。与金口诀页「地分来源」同一换算(resolveDiFenBySource),
	// 课由起课时间排出(与页面同一条重算路径),其余口径跟金口诀页设置
	jinkou: {
		label: '金口诀', module: 'jinkou', sourceModule: 'jinkou', version: 1, needsBackend: true,   // 课要本机计算服务排
		inputs: '{ diFen: 地支(子-亥) } 或 { method: number(报数)/stroke(笔画)/book(翻书页数)/color(颜色)/shengxiao(属相), value: 用户报的数或词 };课按起课时间排',
		example: { method: 'number', value: 27 },
		async build(inputs, record){
			const calc = await import('../../components/jinkou/JinKouCalc');
			let zhi = '';
			if(inputs.diFen !== undefined){ zhi = calc.resolveDiFenBySource('zhi', `${inputs.diFen}`); }
			else if(['number', 'stroke', 'book', 'color', 'shengxiao'].indexOf(inputs.method) >= 0 && inputs.value !== undefined && inputs.value !== ''){ zhi = calc.resolveDiFenBySource(inputs.method, inputs.value); }
			if(!zhi){ return bad('地分要给一个地支(diFen:子-亥),或 method + value(报数 / 笔画 / 翻书页数 / 颜色 / 属相)'); }
			const body = { diFen: zhi, ...(inputs.method ? { diFenSource: inputs.method, diFenInput: inputs.value } : {}) };
			const ctx = await import('../aiAnalysisContext');
			let snapshot = '';
			try{ snapshot = `${(await ctx.regenerateCaseTechniqueSnapshot(record, 'jinkou', { ...body, module: 'jinkou' })) || ''}`.trim(); }catch(e){ snapshot = ''; }
			if(!snapshot){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '金口诀课没排出来(需本机计算服务在线)', retryable: true }; }
			return { ok: true, body, snapshot, summary: `地分 ${zhi}${inputs.method ? `(${inputs.method} ${inputs.value})` : ''}` };
		},
	},
	xiaoliuren: {
		label: '小六壬', module: 'xiaoliuren', sourceModule: 'xiaoliuren', version: 1,
		inputs: '{ nums: [三个正整数](月 / 日 / 时三数,报数或手录)};流派跟小六壬页设置',
		example: { nums: [3, 15, 7] },
		async build(inputs, record, ex){
			const nums = inputs.nums;
			if(!Array.isArray(nums) || nums.length !== 3 || nums.some((n)=>!isInt(n) || n < 1 || n > 999999)){ return bad('nums 须为三个正整数(月 / 日 / 时三数)'); }
			const [m, core] = await Promise.all([import('../../components/xiaoliuren/XiaoLiuRenMain'), import('../../components/xiaoliuren/core/xiaoliurenKe')]);
			const settings = { ...m.DEFAULT_SETTINGS, ...(safeJsonParseFromStorage(m.STORE_KEY) || {}) };
			const ke = core.qiKe({ m: nums[0], d: nums[1], h: nums[2], school: settings.school });
			if(!ke){ return bad('三数非法,不可起课'); }
			const timeLines = await timeLinesOf(await caseFields(record));
			const askEvent = ex.question || '';
			const snapshot = m.buildXiaoLiuRenSnapshotText(ke, askEvent, { ...settings, numsFrom: 'manual', timeLines });
			return { ok: true, body: { options: { ...settings, numsFrom: 'manual' }, nums: ke.nums, askEvent }, snapshot, summary: `三数 ${nums.join(' / ')}` };
		},
	},
	lingqi: {
		label: '灵棋经', module: 'lingqi', sourceModule: 'lingqi', version: 1,
		inputs: '{ counts: [上, 中, 下](各 0-4,即每层掷出的字面棋数), category?: 问类(general 等,缺省跟灵棋页设置) }',
		example: { counts: [2, 1, 3] },
		async build(inputs, record, ex){
			const c = inputs.counts;
			if(!Array.isArray(c) || c.length !== 3 || c.some((n)=>!isInt(n) || n < 0 || n > 4)){ return bad('counts 须为三个 0-4 的整数(上 / 中 / 下)'); }
			const [m, snap, cast] = await Promise.all([import('../../components/lingqi/LingQiMain'), import('../../components/lingqi/lingqiSnapshot'), import('../../components/lingqi/core/lingqiCast')]);
			const stored = safeJsonParseFromStorage(m.STORE_KEY) || {};
			const cats = (snap.LINGQI_CATEGORY_OPTIONS || []).map((o)=>o && o.value);
			if(inputs.category !== undefined && cats.indexOf(inputs.category) < 0){ return bad(`category 只认:${cats.join(' ')}`); }
			const fields = await caseFields(record);
			const nl = await nongliOf(fields);
			const options = {
				// 手摆的棋数不带种子:本机旧存的「手动」来源归成随机(空种子的手动 = 载入后再掷恒得同一卦)
				seedMode: stored.seedMode && stored.seedMode !== 'manual' ? stored.seedMode : 'random', seed: '', handPlaced: true, question: ex.question || '',
				category: inputs.category || stored.category || 'general', display: stored.display || 'simp',
				zhuVisible: { ...snap.DEFAULT_LINGQI_ZHU_VISIBLE, ...(stored.zhuVisible || {}) },
				wuDay: nl ? !!cast.isWuDay(nl) : false,
				timeLines: await timeLinesOf(fields),
			};
			const body = { options, counts: c.slice() };
			const snapshot = snap.buildLingqiSnapshotForCase(body);
			return snapshot ? { ok: true, body, snapshot, summary: `棋数 ${c.join(' / ')}` } : bad('这组棋数成不了卦');
		},
	},
	tongshefa: {
		label: '统摄法', module: 'tongshefa', sourceModule: 'tongshefa', version: 1,
		inputs: `{ taiyin, taiyang, shaoyang, shaoyin }:四象各取一卦(${TRIGRAM_NAMES.join(' / ')})`,
		example: { taiyin: '巽', taiyang: '乾', shaoyang: '震', shaoyin: '坎' },
		async build(inputs){
			const keys = ['taiyin', 'taiyang', 'shaoyang', 'shaoyin'];
			const sel = {};
			for(let i = 0; i < keys.length; i++){
				const v = `${inputs[keys[i]] || ''}`.trim();
				if(TRIGRAM_NAMES.indexOf(v) < 0){ return bad(`${keys[i]} 须为八卦之一:${TRIGRAM_NAMES.join(' ')}`); }
				sel[keys[i]] = v;
			}
			const m = await import('../../components/tongshefa/TongSheFaMain');
			const snapshot = m.buildTongSheFaSnapshot(m.buildTongSheFaModel(sel));
			return snapshot ? { ok: true, body: { selection: sel }, snapshot, summary: keys.map((k)=>sel[k]).join('') } : bad('这组四卦成不了局');
		},
	},
	xiaochengtu: {
		label: '小成图', module: 'xiaochengtu', sourceModule: 'xiaochengtu', version: 1,
		inputs: `三选一:{ up, lo, dongYaos? }(上下卦名 ${TRIGRAM_NAMES.join(' / ')},动爻 1-6)· { upNum, loNum, dongYaos? }(两数配卦,数法跟小成图页设置)· { counts: [六个 6/7/8/9,初爻在前], countsMethod?: yaoqian(摇钱三变,缺省)| dayan(大衍蓍草) }(手录)`,
		example: { up: '离', lo: '坎', dongYaos: [3] },
		async build(inputs, record, ex){
			const [m, q] = await Promise.all([import('../../components/xiaochengtu/XiaoChengTuMain'), import('../../components/xiaochengtu/core/xiaochengtuQiGua')]);
			const settings = { ...m.DEFAULT_SETTINGS, ...(safeJsonParseFromStorage(m.STORE_KEY) || {}) };
			const ds = dongList(inputs.dongYaos);
			if(!ds.ok){ return bad('dongYaos 须为 1-6 的整数'); }
			let qi = null;
			let method = '';
			const ins = { up: '', lo: '', dongYaosText: ds.list.join(','), upNum: null, loNum: null, open: '', close: '', seed: '', countsText: '' };
			if(inputs.up !== undefined || inputs.lo !== undefined){
				if(TRIGRAM_NAMES.indexOf(inputs.up) < 0 || TRIGRAM_NAMES.indexOf(inputs.lo) < 0){ return bad(`up / lo 须为八卦之一:${TRIGRAM_NAMES.join(' ')}`); }
				qi = q.qiGuaManual({ up: inputs.up, lo: inputs.lo, dongYaos: ds.list }); method = 'manual'; ins.up = inputs.up; ins.lo = inputs.lo;
			}else if(inputs.upNum !== undefined || inputs.loNum !== undefined){
				if(!isInt(inputs.upNum) || !isInt(inputs.loNum) || inputs.upNum < 1 || inputs.loNum < 1){ return bad('upNum / loNum 须为正整数'); }
				qi = q.qiGuaByNumbers({ upNum: inputs.upNum, loNum: inputs.loNum, qiguaShu: settings.qiguaShu, dongYaos: ds.list }); method = 'number'; ins.upNum = inputs.upNum; ins.loNum = inputs.loNum;
			}else if(Array.isArray(inputs.counts)){
				if(inputs.counts.length !== 6 || inputs.counts.some((v)=>[6, 7, 8, 9].indexOf(v) < 0)){ return bad('counts 须为六个 6 / 7 / 8 / 9(初爻在前)'); }
				// 手录六爻按页面两种起法记(大衍蓍草 / 摇钱三变):卦相同,起法标签不同;缺省摇钱(此前唯一一种)
				if(inputs.countsMethod !== undefined && ['yaoqian', 'dayan'].indexOf(inputs.countsMethod) < 0){ return bad('countsMethod 只能是 yaoqian(摇钱三变)或 dayan(大衍蓍草)'); }
				const dayan = inputs.countsMethod === 'dayan';
				qi = dayan ? q.qiGuaByDaYan({ seed: 1, manualCounts: inputs.counts.slice() }) : q.qiGuaByYaoQian({ seed: 1, manualCounts: inputs.counts.slice() });
				method = dayan ? 'dayan' : 'yaoqian'; ins.countsText = inputs.counts.join(',');
			}else{
				return bad('小成图要给 up/lo、upNum/loNum 或 counts 其中一种');
			}
			if(!qi || !qi.ben){ return bad('这组输入成不了卦'); }
			const fields = await caseFields(record);
			const body = { options: { ...settings, qiguaFa: method, kline: null }, qi, inputs: ins, askEvent: ex.question || '' };
			const snapshot = m.buildXiaoChengTuSnapshotForCase(body, { timeLines: await timeLinesOf(fields) });
			return snapshot ? { ok: true, body, snapshot, summary: `${qi.ben.name || '本卦'}${qi.zhi && qi.zhi.name && qi.zhi.name !== qi.ben.name ? ` 之 ${qi.zhi.name}` : ''}` } : bad('这组输入成不了卦');
		},
	},
	feigong: {
		label: '飞宫小奇门', module: 'feigong', sourceModule: 'feigong', version: 1,
		inputs: `三选一:{ zhi }(起支,${ZHI.join('')})· { num }(报数,按 12 取支)· { yearZhi }(年命布局:命主生年地支起局);可选 dayGanZi(日干支两字,缺省 = 起课日的日柱)`,
		example: { zhi: '午' },
		async build(inputs, record, ex){
			const [m, core] = await Promise.all([import('../../components/feigong/FeiGongMain'), import('../../components/feigong/core/feigongJu')]);
			const settings = { ...m.DEFAULT_SETTINGS, ...(safeJsonParseFromStorage(m.STORE_KEY) || {}) };
			let qz = null;
			let qiMode = '';
			if(inputs.zhi !== undefined){ qz = core.resolveQiZhi({ mode: 'manualZhi', zhi: inputs.zhi }); qiMode = 'zhi'; }
			else if(inputs.num !== undefined){
				if(!isInt(inputs.num) || inputs.num < 1){ return bad('num 须为正整数'); }
				qz = core.resolveQiZhi({ mode: 'manualNum', num: inputs.num }); qiMode = 'num';
			}else if(inputs.yearZhi !== undefined){ qz = core.resolveQiZhi({ mode: 'yearZhi', yearZhi: inputs.yearZhi }); qiMode = 'yearZhi'; }   // 页面「年命布局」
			else{ return bad('飞宫要给 zhi、num 或 yearZhi'); }
			if(!qz){ return bad(`起支非法(只认 ${ZHI.join('')})`); }
			const fields = await caseFields(record);
			let dayGan = '';
			let dayZhi = '';
			if(inputs.dayGanZi !== undefined){
				const s = `${inputs.dayGanZi || ''}`.trim();
				if(s.length !== 2 || GAN.indexOf(s[0]) < 0 || ZHI.indexOf(s[1]) < 0){ return bad('dayGanZi 须为两字日干支,如「甲子」'); }
				dayGan = s[0]; dayZhi = s[1];
			}else{
				const nl = await nongliOf(fields);
				const b = (nl && nl.bazi) || {};
				const cell = (which)=>(b.day && b.day[which] && b.day[which].cell) || '';
				dayGan = cell('stem'); dayZhi = cell('branch');
				if(!dayGan || !dayZhi){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: true, message: '起课日的日柱没取到;可直接给 dayGanZi' }; }
			}
			const ju = core.buildJu({ zhi: qz, dayGan, dayZhi });
			if(!ju){ return bad('起支非法,不可定局'); }
			const askEvent = ex.question || '';
			const options = {
				mingAge: null, mingGender: 'male', liuYueMonth: null, koujing: settings.heKuiKoujing,
				qiMode, useDayGZ: inputs.dayGanZi === undefined, zhi: qiMode === 'zhi' ? qz : '', num: qiMode === 'num' ? inputs.num : null,
				yearZhi: qiMode === 'yearZhi' ? qz : '子', inputDayGan: dayGan, inputDayZhi: dayZhi,
			};
			const snapshot = m.buildFeiGongSnapshotText(ju, { askEvent, mingAge: null, mingGender: 'male', liuYueMonth: null, koujing: settings.heKuiKoujing, timeLines: await timeLinesOf(fields) });
			return snapshot ? { ok: true, body: { options, qiZhi: ju.qiZhi, dayGan: ju.dayGan, dayZhi: ju.dayZhi, askEvent }, snapshot, summary: `起支 ${qz} · 日 ${dayGan}${dayZhi}` } : bad('定局失败');
		},
	},
	// 天文地占:报数起卦(求测者自报十六数,奇数单点、偶数双点)。与地占页「报数起卦」同一请求体(castMethod numbers + castNumbers)
	// 与同一快照 builder;流派 / 读取范围 / 黄道体系 / 传本逐项 / 行星地占盘跟地占页保存的设置
	geomancy: {
		label: '天文地占', module: 'geomancy', sourceModule: 'geomancy', version: 1,   // 计算服务不在时有本地引擎兜底(离线也能排)
		inputs: '{ numbers: [十六个正整数](依次为四母卦各四行,奇数单点、偶数双点), questionType?: 问类(缺省 custom), quesitedHouse?: 所问宫 1-12 };所问取 question',
		example: { numbers: [3, 8, 5, 2, 7, 1, 4, 6, 9, 2, 3, 5, 8, 1, 6, 4] },
		async build(inputs, record, ex){
			const nums = inputs.numbers;
			if(!Array.isArray(nums) || nums.length !== 16 || nums.some((n)=>!isInt(n) || n < 1 || n > 999999)){ return bad('numbers 须为十六个正整数(奇数单点、偶数双点)'); }
			const house = inputs.quesitedHouse === undefined ? undefined : Number(inputs.quesitedHouse);
			if(house !== undefined && (!isInt(house) || house < 1 || house > 12)){ return bad('quesitedHouse 须为 1-12'); }
			const m = await import('../../components/geomancy/GeomancyMain');
			const saved = m.GEOMANCY_PAGE_SETTINGS.load();
			const options = {
				question: ex.question || '', questionType: inputs.questionType ? `${inputs.questionType}` : 'custom',
				...(house !== undefined ? { quesitedHouse: house } : {}),
				seedMode: 'manual', seed: 0, castMethod: 'numbers', castNumbers: nums.slice(),
				tradition: saved.tradition, readingScope: saved.readingScope, zodiacSystem: saved.zodiacSystem,
				granular: { ...(saved.granular || {}) },
				planetaryChart: saved.planetaryChart, planetaryChartZodiac: saved.planetaryChartZodiac,
				planetaryChartNodes: saved.planetaryChartNodes, planetaryChartExtras: saved.planetaryChartExtras,
			};
			let snapshot = '';
			try{ snapshot = `${(await m.buildGeomancySnapshotForFields(await caseFields(record), { ...options, noPageFallback: true })) || ''}`.trim(); }catch(e){ snapshot = ''; }
			if(!snapshot){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '地占盘没排出来(需本机计算服务在线)', retryable: true }; }
			return { ok: true, body: { options }, snapshot, summary: `报数 ${nums.join(' ')}` };
		},
	},
};

// 报出的起课输入(挂载表里登记了的起卦输入键:六壬选时 / 演数、奇门数字起局报数、皇极心易、五兆起法、神易数手动时辰季令、太玄 / 荆诀手填种子):
// 输入 = 该技法挂载齿轮的键(起卦输入键至少给一个;起课法之类的普通口径键可一并给),与 create_case_record 同一冻结(显式 > 同类默认 > 本机现值),
// 课 / 局 / 筮由与挂载同一条重算路径排出,正文冻结进 payload.snapshot。只有这条通道放行起卦输入键(cast_technique / create_case_record 仍拒)。
const REPORTED_LABELS = { liureng: '六壬', qimen: '奇门', huangji: '皇极经世', wuzhao: '五兆', shenyishu: '神易数', taixuan: '太玄', jingjue: '荆诀' };
// 六壬课要本机计算服务排;奇门局前端本地起(离线可用)
const REPORTED_BACKEND = { liureng: true };
function reportedSpec(t){
	return {
		label: REPORTED_LABELS[t], module: t, sourceModule: t, version: 1, needsBackend: !!REPORTED_BACKEND[t], reported: true,
		get inputs(){
			// 惰性:读挂载表(不进工具首包求值顺序)
			try{
				// eslint-disable-next-line global-require
				const ms = require('../techniqueMountSettings');
				// eslint-disable-next-line global-require
				const ck = require('./castInputKeys');
				const schema = ms.getTechniqueSettingsSchema(t);
				const keys = ck.castInputKeysOf(t);
				// eslint-disable-next-line global-require
				const ct = require('./mountVisibility');
				// 要配上级项才生效的键注明配哪一档(六壬演数 / 报数配起课法、奇门报数配起局)
				const needs = (k)=>{ try{ const en = ct.castKeyEnablers(t, k, {}, null); return en.length ? `,须配 ${en.map((e)=>`${e.key}=${e.value}`).join(' 或 ')}` : ''; }catch(e){ return ''; } };
				const desc = (schema && schema.fields ? schema.fields : []).filter((f)=>keys.indexOf(f.name) >= 0)
					.map((f)=>`${f.name}(${f.label}${Array.isArray(f.options) && f.options.length ? `:${f.options.map((o)=>o.value).join('/')}` : ''}${needs(f.name)})`);
				return `{ 起卦输入键至少一个:${desc.join(' · ')};可一并给该技法其它口径键(describe_settings facet=mount)}`;
			}catch(e){ return '{ 该技法挂载齿轮的起卦输入键 }'; }
		},
		example: REPORTED_EXAMPLES[t],
		async build(inputs, record){
			const [ct, ck, cc, mv] = await Promise.all([import('./tools/castTechnique'), import('./castInputKeys'), import('./tools/createCaseRecord'), import('./mountVisibility')]);
			const sorted = ct.classifyCastOptions(t, inputs, null);
			if(sorted.ignored.length){ return bad(`这些项不认:${sorted.ignored.map((x)=>`${x.key}(${x.message})`).join('、')}`); }
			const castKeys = ck.castInputKeysIn(t, sorted.options);
			if(!castKeys.length){
				const given = ck.castInputKeysOf(t).filter((k)=>Object.prototype.hasOwnProperty.call(sorted.options, k));
				// 给了起卦输入键、但取的是「按时间 / 自动 / 留空」那一档 = 没报出任何结果
				return bad(given.length
					? `给的 ${given.map((k)=>`${k}=${JSON.stringify(sorted.options[k])}`).join('、')} 是「按起课时间 / 自动」那一档,没有报出起卦结果;只按起课时间起用 create_case_record,报数 / 手填请给具体值(例:${JSON.stringify(REPORTED_EXAMPLES[t] || {})})`
					: `没有报出的起课输入(${ck.castInputKeysOf(t).join(' / ')} 至少一个);只按起课时间起用 create_case_record`);
			}
			// 报出的键要配上级项才生效(六壬演数 / 报数配起课法、奇门报数配起局):调用方没给上级项、且只有一档能让它生效 → 补上并注明;多档 → 让调用方选
			const opts = { ...sorted.options };
			const autoSet = [];
			for(const h of ct.hiddenCastOptions(t, Object.keys(opts), opts, null).filter((x)=>castKeys.indexOf(x.key) >= 0)){
				if((h.controlledBy || []).some((c)=>Object.prototype.hasOwnProperty.call(sorted.options, c))){ continue; }
				const en = mv.castKeyEnablers(t, h.key, opts, null);
				if(en.length === 1){ opts[en[0].key] = en[0].value; autoSet.push(`${h.key} 只在 ${en[0].key}=${JSON.stringify(en[0].value)}(${en[0].label})时生效,已一并按这一档起`); }
				else if(en.length > 1){ return bad(`${h.key} 要配 ${en.map((e)=>`${e.key}=${JSON.stringify(e.value)}(${e.label})`).join(' 或 ')} 一并给(两种起法结果不同,按用户说的选)`); }
			}
			const hidden = ct.hiddenCastOptions(t, Object.keys(opts), opts, null).filter((x)=>castKeys.indexOf(x.key) >= 0);
			if(hidden.length){ return bad(hidden.map((x)=>`${x.key}:${x.message}`).join(';')); }
			sorted.options = opts;
			const body = cc.freezeCaseOptions({}, t, sorted.options);
			const ctx = await import('../aiAnalysisContext');
			let snapshot = '';
			try{ snapshot = `${(await ctx.regenerateCaseTechniqueSnapshot(record, t, { ...body, module: t })) || ''}`.trim(); }catch(e){ snapshot = ''; }
			if(!snapshot){ return REPORTED_BACKEND[t] ? { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `${REPORTED_LABELS[t]}没排出来(需本机计算服务在线)`, retryable: true } : bad('这组输入起不出来'); }
			return { ok: true, body, snapshot, summary: castKeys.map((k)=>`${k} ${JSON.stringify(sorted.options[k])}`).join(' · '), ...(autoSet.length ? { notes: autoSet } : {}) };
		},
	};
}
const REPORTED_EXAMPLES = {
	liureng: { castMethod: 'yanshu', yanShuNum: '27' },
	qimen: { qijuMethod: 'shuzi', shuziReportNumber: '123' },
	huangji: { xinyiMethod: 'number', upperNum: 3, lowerNum: 5 },
	wuzhao: { mode: 'zhushu', zhaoNums: '1,3,5,2,4,1' },
	shenyishu: { hourSource: 'manual', manualHour: 5 },
	taixuan: { seed: '12345' },
	jingjue: { seed: '12345' },
};
Object.keys(REPORTED_LABELS).forEach((t)=>{ CAST_SPECS[t] = reportedSpec(t); });

// 给外部 AI 的格式目录(list_divination_casts)
export function listCastSpecs(type){
	return INPUT_CASTABLE.filter((k)=>!type || k === type).map((k)=>({ caseType: k, label: CAST_SPECS[k].label, inputs: CAST_SPECS[k].inputs, example: CAST_SPECS[k].example }));
}

// 数字字段容错:外部客户端常把数字写成字符串("7")—— 只对纯数字串转数,其余原样(inputs 是自由对象,校验器不做类型转换)
const NUMERIC_KEYS = ['yao', 'coins', 'numbers', 'nums', 'counts', 'dongYaos', 'upNum', 'loNum', 'num', 'dice', 'strokes', 'sounds', 'hourNum'];
function toNum(v){ return typeof v === 'string' && /^\s*\d+\s*$/.test(v) ? Number(v) : v; }
export function normalizeCastInputs(inputs){
	const out = { ...inputs };
	NUMERIC_KEYS.forEach((k)=>{
		if(Array.isArray(out[k])){ out[k] = out[k].map(toNum); }
		else if(out[k] !== undefined){ out[k] = toNum(out[k]); }
	});
	return out;
}

// 成卦:回 { ok, body, snapshot, summary, spec } | { ok:false, code, message, retryable? }
export async function buildCastCase(caseType, inputs, record, ex){
	const spec = CAST_SPECS[caseType];
	if(!spec){ return { ok: false, code: 'E_CASE_TYPE_UNKNOWN', message: `这一类不支持按结果建事盘:${caseType};支持:${INPUT_CASTABLE.join(' ')}` }; }
	if(!inputs || typeof inputs !== 'object' || Array.isArray(inputs)){ return bad(`inputs 须为对象;格式:${spec.inputs}`); }
	let r;
	try{ r = await spec.build(normalizeCastInputs(inputs), record || {}, ex || {}); }catch(e){ return { ok: false, code: 'E_CAST_FAILED', message: `成卦失败:${e && e.message ? e.message : e}` }; }
	if(!r || !r.ok){ return r || { ok: false, code: 'E_CAST_FAILED', message: '成卦失败' }; }
	if(typeof r.snapshot !== 'string' || !r.snapshot.trim()){ return { ok: false, code: 'E_CAST_FAILED', message: '成卦了但没产出快照正文,未建事盘' }; }
	return { ...r, spec };
}
