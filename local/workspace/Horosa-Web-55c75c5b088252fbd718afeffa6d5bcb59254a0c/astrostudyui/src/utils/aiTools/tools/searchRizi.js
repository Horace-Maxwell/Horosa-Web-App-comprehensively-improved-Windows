// AI 助手·日子馆(个性化择日):通书全年候选 × 各当事人八字(年命 / 日主 / 喜忌)交集评分,与黄历页「日子馆」同一引擎与正文。
// 只读、不写记录。当事人可给已存命盘(cid)或临时出生资料;本人 + 配偶时另出合婚一行。
import { buildPersonalizedDates, personBazi } from '../../../components/calendar/riziEngine';
import { buildRiziSnapshotText } from '../../../components/calendar/riziSnapshot';
import { EVENT_CATEGORIES } from '../../../components/calendar/tongshuData';
import { findAnalysisSourceById } from '../../aiAnalysisSources';
import { parseBirthInput } from '../normalize/birthText';
import { normalizeGender } from '../normalize/gender';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../dayBoundary';
import { datePartOf } from '../../dateStrSafe';
import { GUIDE, RECORD_ID_PATTERN } from './_shared';

export const RIZI_EVENTS = EVENT_CATEGORIES.map((c)=>c.key);
export const RIZI_ROLES = ['self', 'spouse', 'family'];

function personOf(spec, i){
	const role = RIZI_ROLES.indexOf(spec.role) >= 0 ? spec.role : (i === 0 ? 'self' : 'family');
	let birth = ''; let zone = spec.zone || ''; let gender = spec.gender !== undefined ? normalizeGender(spec.gender) : undefined; let name = spec.name || '';
	if(spec.recordId){
		const src = findAnalysisSourceById(spec.recordId);
		if(!src || src.sourceType !== 'chart' || !src.record){ return { error: { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到命盘 ${spec.recordId}` } }; }
		birth = `${src.record.birth || ''}`; zone = zone || src.record.zone || ''; name = name || src.record.name || '';
		if(gender === undefined){ gender = src.record.gender; }
	}else{
		const b = parseBirthInput(spec.birth || '', { calendar: spec.calendar || 'solar' });
		if(!b.ok){ return { error: { ok: false, code: b.code || 'E_BIRTH_UNPARSEABLE', message: `第 ${i + 1} 位当事人出生时间无法解析` } }; }
		birth = b.birth; zone = zone || b.zoneHint || '';
	}
	const [d, t] = birth.split(' ');
	const bazi = personBazi({
		date: datePartOf(d).replace(/\//g, '-'), time: t || '12:00:00', zone: zone || '+08:00', gender: gender === undefined || gender === null ? 1 : gender,
		after23NewDay: defaultAfter23NewDay() ? 1 : 0, lateZiHourUseNextDay: defaultLateZiHourUseNextDay() ? 1 : 0,
	});
	return { person: { role, name, gender: gender === undefined || gender === null ? 1 : gender, bazi } };
}

export const searchRiziTool = {
	name: 'search_rizi',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	description: `日子馆个性化择日:按事项(婚嫁 / 入宅 / 开市 …)在某一年的通书吉日里,结合各当事人八字(年命、日主、喜用忌神)逐日评分排序;冲任一当事人本命年的日子淘汰。当事人给已存命盘 recordId 或临时 birth;本人 + 配偶时另给合婚一行。与黄历页「日子馆」同一引擎。${GUIDE}:用户要为具体的人挑某件事的好日子时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['event', 'year', 'persons'],
		properties: {
			event: { type: 'string', enum: RIZI_EVENTS, description: EVENT_CATEGORIES.map((c)=>`${c.key}=${c.label}`).join(' / ') },
			year: { type: 'integer', minimum: 1, maximum: 9999 },
			persons: { type: 'array', minItems: 1, maxItems: 6, items: {
				type: 'object', additionalProperties: false,
				properties: {
					role: { type: 'string', enum: RIZI_ROLES, description: 'self 本人 / spouse 配偶 / family 家人(缺省:第一位本人,其余家人)' },
					recordId: { type: 'string', pattern: RECORD_ID_PATTERN, description: '已存命盘(与 birth 二选一)' },
					birth: { type: 'string', maxLength: 60, description: "出生时间,如 '1990-01-01 08:00'(与 recordId 二选一)" },
					calendar: { type: 'string', enum: ['solar', 'lunar'] },
					zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$' },
					gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
					name: { type: 'string', maxLength: 40 },
				},
			} },
			topN: { type: 'integer', minimum: 1, maximum: 60, default: 15 },
			strongOnly: { type: 'boolean', default: false, description: '只要综分 ≥ 8 的强吉日' },
		},
	},
	outputSchema: { type: 'object', required: ['content', 'count'], properties: { content: { type: 'string' }, count: { type: 'integer' }, dates: { type: 'array', items: { type: 'object' } } } },
	async run(args){
		const persons = [];
		for(let i = 0; i < args.persons.length; i += 1){
			const spec = args.persons[i] || {};
			if(!spec.recordId && !spec.birth){ return { ok: false, code: 'E_ARGS_INVALID', message: `第 ${i + 1} 位当事人要给 recordId 或 birth` }; }
			const r = personOf(spec, i);
			if(r.error){ return r.error; }
			persons.push(r.person);
		}
		const result = buildPersonalizedDates({ event: args.event, persons, year: args.year, topN: args.topN || 15, strongOnly: !!args.strongOnly });
		const content = `${buildRiziSnapshotText({ event: args.event, year: args.year, persons, result, selectedYmd: null }) || ''}`.trim();
		const dates = (result.list || []).map((d)=>({ ymd: d.ymd, score: d.score, lunar: d.lunar, ganzhi: d.ganzhi }));
		return { ok: true, data: { content, count: result.count || 0, dates }, summary: `日子馆 ${result.label || args.event} ${args.year} 年 ${dates.length} 日` };
	},
};

export default searchRiziTool;
