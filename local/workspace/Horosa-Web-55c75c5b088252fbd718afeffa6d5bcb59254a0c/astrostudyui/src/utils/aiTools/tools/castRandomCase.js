// AI 助手·让软件代摇 / 代抽:用户明确要求时,用各技法页自己的随机源起一卦 / 抽一副牌建事盘。
// 随机结果(爻 / 棋数 / 种子)随事盘落盘、可复现;事盘标 payload.randomCast(软件代摇)。始终要用户审批(alwaysConfirm,
// 不论审批档);一问一次:同类同问已代摇过即拒,用户明说重摇才 recast:true(照样审批、进账本)。无头没有审批台 = 不可用。
import { yarrowYao } from '../../../components/gua/LiuYaoConst';
import { newEntropySeed, randomBit, seedDisplayText } from '../../trueRandom';
import { listLocalCases } from '../../localcases';
import { caseFieldSnapshot } from '../../kentangCaseSave';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../dayBoundary';
import { normalizeGender } from '../normalize/gender';
import { resolveCaseTimePlace, persistCaseRecord } from './createCaseRecord';
import { castDivinationCaseTool } from './castDivinationCase';
import { GUIDE, aiOriginOf } from './_shared';

export const RANDOM_CAST_TYPES = ['liuyao', 'lingqi', 'taixuan', 'jingjue', 'tarot', 'geomancy'];
const LABELS = { liuyao: '六爻', lingqi: '灵棋经', taixuan: '太玄', jingjue: '荆诀', tarot: '塔罗', geomancy: '天文地占' };

// 代摇用的随机数一律取自系统真随机源(utils/trueRandom.js);要按种子重开的几类,种子是一段真随机记录
const coin = ()=>randomBit();
const SEEDED_ENTROPY_BYTES = 32;   // 太玄 / 荆诀:与各自页面「重起」同长
const GEOMANCY_ENTROPY_BYTES = 192;   // 地占:与页面随机起盘同长

// 各类的随机起卦结果(与页面同一随机源 / 同一规则)
export function randomInputsOf(type, method){
	if(type === 'liuyao'){
		if(method === 'coins'){ return { inputs: { coins: Array.from({ length: 6 }, ()=>coin() + coin() + coin()) }, method: 'coins' }; }
		// 蓍草法(与六爻页「蓍草起卦」同一 yarrowYao):value 阳 / 阴 + change 动 → 9 / 7 / 8 / 6
		const yao = Array.from({ length: 6 }, ()=>{ const y = yarrowYao(); return y.value === 1 ? (y.change ? 9 : 7) : (y.change ? 6 : 8); });
		return { inputs: { yao }, method: 'yarrow' };
	}
	if(type === 'lingqi'){ return { inputs: { counts: [0, 1, 2].map(()=>coin() + coin() + coin() + coin()) }, method: 'cast' }; }   // 每层四子掷字面
	if(type === 'taixuan' || type === 'jingjue'){ return { inputs: { seed: newEntropySeed(SEEDED_ENTROPY_BYTES) }, method: 'seed' }; }
	return null;
}

function priorRandomCase(caseType, question){
	const q = `${question || ''}`.trim();
	if(!q){ return null; }
	return listLocalCases({ includeArchived: true }).find((r)=>{
		if(!r || r.caseType !== caseType){ return false; }
		let p = r.payload;
		if(typeof p === 'string'){ try{ p = JSON.parse(p); }catch(e){ p = null; } }
		return !!(p && p.randomCast && `${p.randomCast.question || ''}`.trim() === q);
	}) || null;
}

export const castRandomCaseTool = {
	name: 'cast_random_case',
	level: 'additive',
	category: 'records',
	undoKind: 'trash-record',
	origins: ['in-app', 'mcp'],
	alwaysConfirm: true,
	timeoutMs: 120000,
	outputSchema: { type: 'object', required: ['cid', 'created'], properties: { cid: { type: 'string' }, created: { type: 'boolean' }, cast: { type: 'string' }, record: { type: 'object' } } },
	description: `让软件代摇 / 代抽建一条事盘(六爻蓍草或掷钱 / 灵棋 / 太玄 / 荆诀 / 塔罗 / 天文地占),用各技法页自己的随机源;随机结果随事盘存下可复现。每次都要用户审批;同一问题只代摇一次(用户明说重摇才 recast:true)。用户自己摇好 / 报出的结果请用 cast_divination_case。${GUIDE}:用户明说「你帮我摇一卦 / 帮我抽牌」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['caseType', 'question'], properties: {
		caseType: { type: 'string', enum: RANDOM_CAST_TYPES },
		question: { type: 'string', minLength: 1, maxLength: 2000, description: '所问(必填:一问一次按它去重)' },
		method: { type: 'string', enum: ['yarrow', 'coins'], description: '六爻起法:yarrow 蓍草(缺省)/ coins 掷钱' },
		recast: { type: 'boolean', default: false, description: '用户明说要对同一问题重摇时才为 true' },
		divTime: { type: 'string', maxLength: 60 }, place: { type: 'string', maxLength: 80 },
		gpsLat: { type: 'number', minimum: -90, maximum: 90 }, gpsLon: { type: 'number', minimum: -180, maximum: 180 },
		zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$' }, gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
		event: { type: 'string', maxLength: 120 },
	} },
	preview(args){ return { title: `软件代摇:${LABELS[args.caseType] || args.caseType}`, before: '', after: `所问:${`${args.question || ''}`.slice(0, 200)}${args.recast ? '\n(同一问题重摇)' : ''}\n由软件随机起出,结果随事盘存下` }; },
	async run(args, ctx){
		const type = args.caseType;
		const prior = priorRandomCase(type, args.question);
		if(prior && !args.recast){ return { ok: false, code: 'E_ARGS_INVALID', message: `这个问题已经代摇过(事盘「${prior.event}」,${prior.cid});一问一次。用户明说要重摇才带 recast:true`, data: { cid: prior.cid } }; }
		const randomCast = { by: 'software', question: `${args.question}`.trim(), at: new Date().toISOString(), recast: !!(prior && args.recast) };
		const r = randomInputsOf(type, args.method);
		if(r){
			// 走「按结果建事盘」同一条流程(成卦 / 快照 / payload 与页面同形),只多记一笔软件代摇
			const out = await castDivinationCaseTool.run({ caseType: type, inputs: r.inputs, question: args.question, divTime: args.divTime, place: args.place, gpsLat: args.gpsLat, gpsLon: args.gpsLon, zone: args.zone, gender: args.gender, event: args.event, allowDuplicate: true }, { ...(ctx || {}), randomCast: { ...randomCast, method: r.method } });
			return out;
		}
		// 塔罗 / 地占:种子由软件生成并冻结进 payload(复现靠种子),口径跟各自页面保存的设置
		const assumptions = [];
		const tp = await resolveCaseTimePlace(args, assumptions);
		if(!tp.ok){ return tp.error; }
		const { divTime, geo, pos, z } = tp;
		const gender = normalizeGender(args.gender, { forCase: true });
		const recordLike = { divTime, zone: z.zone, lat: geo.lat, lon: geo.lon, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, ...(gender !== undefined ? { gender } : {}) };
		let options;
		if(type === 'tarot'){
			const m = await import('../../../components/tarot/TarotMain');
			const { settingsFromState } = await import('../../../components/tarot/engine/settingsMap');
			const { newTarotRandomSeed } = await import('../../../components/tarot/engine/shuffle');
			const saved = m.TAROT_PAGE_SETTINGS.load();
			options = { deckId: saved.deckId, spreadType: saved.spreadType, seedMode: 'random', seed: newTarotRandomSeed(saved.spreadType), question: `${args.question}`, settings: settingsFromState(saved) };
		}else{
			const m = await import('../../../components/geomancy/GeomancyMain');
			const saved = m.GEOMANCY_PAGE_SETTINGS.load();
			options = { question: `${args.question}`, questionType: 'custom', seedMode: 'manual', seed: newEntropySeed(GEOMANCY_ENTROPY_BYTES), castMethod: 'random',
				tradition: saved.tradition, readingScope: saved.readingScope, zodiacSystem: saved.zodiacSystem, granular: { ...(saved.granular || {}) },
				planetaryChart: saved.planetaryChart, planetaryChartZodiac: saved.planetaryChartZodiac, planetaryChartNodes: saved.planetaryChartNodes, planetaryChartExtras: saved.planetaryChartExtras };
		}
		const ctxMod = await import('../../aiAnalysisContext');
		let snapshot = '';
		try{ snapshot = `${(await ctxMod.regenerateCaseTechniqueSnapshot(recordLike, type, { module: type, options })) || ''}`.trim(); }catch(e){ snapshot = ''; }
		if(!snapshot){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `${LABELS[type]}没起出来(部分技法需本机计算服务在线)`, retryable: true }; }
		const fieldsLike = { after23NewDay: { value: defaultAfter23NewDay() }, lateZiHourUseNextDay: { value: defaultLateZiHourUseNextDay() } };
		const event = `${args.event || `${LABELS[type]}占断 ${divTime.slice(0, 16)}`}`.trim();
		const values = { event, caseType: type, divTime, zone: z.zone, lat: geo.lat, lon: geo.lon, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, pos, memo: args.question || undefined,
			payload: { module: type, version: 1, savedAt: new Date().toISOString(), fieldSnapshot: caseFieldSnapshot(fieldsLike), createdBy: 'ai-assistant', options, snapshot, randomCast: { ...randomCast, method: 'seed' } },
			sourceModule: type, aiOrigin: aiOriginOf(ctx, 'cast_random_case', {}) };
		if(gender !== undefined){ values.gender = gender; }
		const p = persistCaseRecord('cast_random_case', values, args, ctx, assumptions);
		if(!p.ok){ return p.error; }
		const { saved, persisted } = p;
		return { ok: true, data: { cid: saved.cid, created: true, persisted, cast: `软件代摇 · 种子 ${seedDisplayText(options.seed)}`, record: { event: saved.event, caseType: saved.caseType, divTime: saved.divTime, zone: saved.zone } },
			message: `已由软件代摇建事盘「${saved.event}」(${LABELS[type]})`, summary: `代摇 ${saved.event}`, assumptions, undo: { kind: 'trash-record', payload: { store: 'case', cid: saved.cid } } };
	},
};

export default castRandomCaseTool;
