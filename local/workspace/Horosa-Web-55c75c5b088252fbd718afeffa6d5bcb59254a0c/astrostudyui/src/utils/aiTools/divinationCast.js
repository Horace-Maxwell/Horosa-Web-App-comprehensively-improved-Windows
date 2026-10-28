// AI 助手·按用户给的起卦结果建事盘:六爻 / 小六壬 / 灵棋 / 统摄法 / 小成图 / 飞宫。
// 每类 = 输入格式 + 与页面同一核心的纯函数成卦 + 页面同形 payload + 快照正文。快照必存 payload.snapshot:
// 挂载只在 module 匹配时读它,回退重建只覆盖六爻 / 统摄法。判读设置一律取该页保存的设置(与用户在页面上起卦同口径)。
// 只用用户给的结果:绝不随机、绝不凭时间代起(起课时间只作占时记录,与页面同)。技法页模块一律惰性载入(不进工具首包)。
import { safeJsonParseFromStorage } from '../safeStorage';

export const INPUT_CASTABLE = ['liuyao', 'xiaoliuren', 'lingqi', 'tongshefa', 'xiaochengtu', 'feigong'];
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
		inputs: '三选一:{ yao: [六个数,初爻在前;6 老阴 / 7 少阳 / 8 少阴 / 9 老阳,6 与 9 为动爻] } · { coins: [六个背面数 0-3,初爻在前;三背 = 老阳、三字 = 老阴,字背口径跟六爻页设置] } · { numbers: [上卦数, 下卦数, 动爻数](报数 / 米卦:上下卦数 %8、动爻数 %6)}',
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
			}else{
				return bad('六爻要给 yao / coins / numbers 其中一种');
			}
			const [ctx, consts] = await Promise.all([import('../aiAnalysisContext'), import('../../components/gua/GuaConst')]);
			const r = await ctx.buildSixyaoCaseFromLines(record, lines, moving);
			if(!r){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: true, message: '起课时刻的农历没取到(本机排盘服务可能还没就绪),未建事盘' }; }
			const g = consts.Gua64[r.gua.currentGua] || {};
			return { ok: true, body: { gua: r.gua }, snapshot: r.snapshot, summary: `${g.name || '成卦'}${moving.length ? ` · 动爻 ${moving.join('、')}` : ' · 静卦'}` };
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
		inputs: `三选一:{ up, lo, dongYaos? }(上下卦名 ${TRIGRAM_NAMES.join(' / ')},动爻 1-6)· { upNum, loNum, dongYaos? }(两数配卦,数法跟小成图页设置)· { counts: [六个 6/7/8/9,初爻在前] }(摇钱手录)`,
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
				qi = q.qiGuaByYaoQian({ seed: 1, manualCounts: inputs.counts.slice() }); method = 'yaoqian'; ins.countsText = inputs.counts.join(',');
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
		inputs: `二选一:{ zhi }(起支,${ZHI.join('')})· { num }(报数,按 12 取支);可选 dayGanZi(日干支两字,缺省 = 起课日的日柱)`,
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
			}else{ return bad('飞宫要给 zhi 或 num'); }
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
				yearZhi: '子', inputDayGan: dayGan, inputDayZhi: dayZhi,
			};
			const snapshot = m.buildFeiGongSnapshotText(ju, { askEvent, mingAge: null, mingGender: 'male', liuYueMonth: null, koujing: settings.heKuiKoujing, timeLines: await timeLinesOf(fields) });
			return snapshot ? { ok: true, body: { options, qiZhi: ju.qiZhi, dayGan: ju.dayGan, dayZhi: ju.dayZhi, askEvent }, snapshot, summary: `起支 ${qz} · 日 ${dayGan}${dayZhi}` } : bad('定局失败');
		},
	},
};

// 给外部 AI 的格式目录(list_divination_casts)
export function listCastSpecs(type){
	return INPUT_CASTABLE.filter((k)=>!type || k === type).map((k)=>({ caseType: k, label: CAST_SPECS[k].label, inputs: CAST_SPECS[k].inputs, example: CAST_SPECS[k].example }));
}

// 数字字段容错:外部客户端常把数字写成字符串("7")—— 只对纯数字串转数,其余原样(inputs 是自由对象,校验器不做类型转换)
const NUMERIC_KEYS = ['yao', 'coins', 'numbers', 'nums', 'counts', 'dongYaos', 'upNum', 'loNum', 'num'];
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
