// 按用户给的起卦结果建事盘(六爻摇钱 / 报数、小六壬三数、灵棋棋数、统摄法四卦、小成图、飞宫起支)+ 格式目录。
// 只增:永远新建、不改已有档案;同题同一分钟同类、且起卦结果与所问都相同的已存在 → 直接回已有 cid(同一分钟摇的第二卦照建);
// 撤销 = 移入回收站(trash-record,与建事盘同)。
// 只用用户给的结果,绝不随机、绝不凭时间代起;时间地点解析、落库与选中与 create_case_record 共用同一实现。
import { GUIDE, aiOriginOf } from './_shared';
import { recordStorePersisted } from '../../recordStoreNotice';
import { caseFieldSnapshot } from '../../kentangCaseSave';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../dayBoundary';
import { normalizeGender } from '../normalize/gender';
import { resolveCaseTimePlace, persistCaseRecord, findDuplicateCase, caseInputFingerprint } from './createCaseRecord';
import { INPUT_CASTABLE, CAST_SPECS, buildCastCase, listCastSpecs, normalizeCastInputs } from '../divinationCast';

export const listDivinationCastsTool = {
	name: 'list_divination_casts',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: {
		type: 'object', required: ['types'],
		properties: { types: { type: 'array', items: { type: 'object', required: ['caseType', 'label', 'inputs'], properties: { caseType: { type: 'string' }, label: { type: 'string' }, inputs: { type: 'string' }, example: { type: 'object' } } } } },
	},
	description: `列出可按用户起卦结果建事盘的技法与各自的输入格式(含示例)。写 cast_divination_case 的 inputs 前先查这里;只关心一类时给 caseType。${GUIDE}:用户报出摇卦 / 报数 / 棋数等结果、要存成事盘时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: { caseType: { type: 'string', enum: INPUT_CASTABLE } },
	},
	async run(args){
		const types = listCastSpecs(args.caseType);
		return { ok: true, data: { types }, summary: `起卦格式 ${types.length} 类` };
	},
};

export const castDivinationCaseTool = {
	name: 'cast_divination_case',
	level: 'additive',
	category: 'records',
	undoKind: 'trash-record',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	outputSchema: {
		type: 'object', required: ['cid', 'created', 'duplicate'],
		properties: { cid: { type: 'string' }, created: { type: 'boolean' }, duplicate: { type: 'boolean' }, persisted: { type: 'boolean' }, record: { type: 'object' }, selected: { type: 'boolean' }, loaded: { type: 'boolean' }, cast: { type: 'string' } },
	},
	description: `用用户亲手摇出 / 报出的起卦结果新建一条事盘(${INPUT_CASTABLE.map((k)=>CAST_SPECS[k].label).join(' / ')}),成卦与技法页同一算法、判读设置跟该页保存的设置;只用用户给的结果,绝不随机、绝不凭时间代起。起课时间缺省 = 现在,只作占时记录。${GUIDE}:用户说「我摇了一卦 / 报个数 / 帮我把这卦存下来」时调用;inputs 格式先用 list_divination_casts 查。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['caseType', 'inputs'],
		properties: {
			caseType: { type: 'string', enum: INPUT_CASTABLE },
			inputs: { type: 'object', additionalProperties: true, description: '起卦结果(格式按 caseType,见 list_divination_casts;如六爻 { "yao": [7,8,9,7,6,8] })' },
			event: { type: 'string', maxLength: 120, description: '标题;缺省「<技法>占断 <时间>」' },
			question: { type: 'string', maxLength: 2000, description: '所问原文(存为事盘备注,并进快照的占事一栏)' },
			divTime: { type: 'string', maxLength: 60, description: '起课时间;缺省 = 现在(本机时间)' },
			calendar: { type: 'string', enum: ['solar', 'lunar'], default: 'solar' },
			gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
			place: { type: 'string', maxLength: 80 },
			gpsLat: { type: 'number', minimum: -90, maximum: 90 },
			gpsLon: { type: 'number', minimum: -180, maximum: 180 },
			zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$' },
			tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 20 } },
			selectAsAnalysisSource: { type: 'boolean', default: true },
			loadIntoWorkspace: { type: 'boolean', default: false },
			allowDuplicate: { type: 'boolean', default: false, description: '同题同一分钟同类、起卦结果与所问都相同的事盘已存在时,用户明确要求再建一条才为 true' },
		},
	},
	preview(args){
		const spec = CAST_SPECS[args.caseType];
		const fields = { 事盘类型: spec ? spec.label : `${args.caseType || ''}`, 起卦结果: JSON.stringify(args.inputs || {}).slice(0, 200), 标题: `${args.event || ''}`, 所问: `${args.question || ''}`.slice(0, 200), 起课时间: args.divTime ? `${args.divTime}` : '现在(本机时间)' };
		return { title: '按起卦结果新建事盘', before: '', after: Object.keys(fields).filter((k)=>fields[k] !== '').map((k)=>`${k}: ${fields[k]}`).join('\n') };
	},
	async run(args, ctx){
		const spec = CAST_SPECS[args.caseType];
		if(!spec){ return { ok: false, code: 'E_CASE_TYPE_UNKNOWN', message: `这一类不支持按结果建事盘:${args.caseType};支持:${INPUT_CASTABLE.join(' ')}` }; }
		const assumptions = [];
		const tp = await resolveCaseTimePlace(args, assumptions);
		if(!tp.ok){ return tp.error; }
		const { divTime, geo, pos, z } = tp;
		const event = `${args.event || `${spec.label}占断 ${divTime.slice(0, 16)}`}`.trim();
		// 指纹按规整后的起卦结果算(「7」与 7 是同一爻),同一分钟里不同的卦各成一条
		const normalizedInputs = args.inputs && typeof args.inputs === 'object' && !Array.isArray(args.inputs) ? normalizeCastInputs(args.inputs) : args.inputs;
		const inputFingerprint = caseInputFingerprint({ caseType: args.caseType, inputs: normalizedInputs, question: args.question });
		const dup = args.allowDuplicate ? null : findDuplicateCase(event, divTime, args.caseType, { fingerprint: inputFingerprint, inputs: normalizedInputs, question: args.question });
		if(dup){
			return { ok: true, data: { cid: dup.cid, created: false, duplicate: true, persisted: recordStorePersisted('case') }, message: `已存在同题同时刻、起卦结果与所问都相同的事盘「${dup.event}」,未重复新建(确要再建一条请带 allowDuplicate)`, summary: `已有事盘 ${dup.event}`, assumptions };
		}
		const gender = normalizeGender(args.gender, { forCase: true });
		const recordLike = { divTime, zone: z.zone, lat: geo.lat, lon: geo.lon, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, ...(gender !== undefined ? { gender } : {}) };
		const built = await buildCastCase(args.caseType, args.inputs, recordLike, { question: args.question || '' });
		if(!built.ok){ return { ok: false, code: built.code, message: built.message, ...(built.retryable ? { retryable: true } : {}), data: { inputs: spec.inputs } }; }
		// payload 与页面「存为事盘」同形:模块 / 版本 / 存档时刻 / 口径快照(日界点、晚子时)+ 各技法冻结结果 + 快照正文
		const fieldsLike = { after23NewDay: { value: defaultAfter23NewDay() }, lateZiHourUseNextDay: { value: defaultLateZiHourUseNextDay() } };
		const payload = { module: spec.module, version: spec.version, savedAt: new Date().toISOString(), fieldSnapshot: caseFieldSnapshot(fieldsLike), createdBy: 'ai-assistant', ...built.body, snapshot: built.snapshot };
		const values = {
			event, caseType: args.caseType, divTime, zone: z.zone,
			lat: geo.lat, lon: geo.lon, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, pos,
			group: Array.isArray(args.tags) && args.tags.length ? args.tags : undefined,
			memo: args.question || undefined,
			payload,
			sourceModule: spec.sourceModule,
			aiOrigin: aiOriginOf(ctx, 'cast_divination_case', { inputFingerprint }),
		};
		if(gender !== undefined){ values.gender = gender; }
		const p = persistCaseRecord('cast_divination_case', values, args, ctx, assumptions);
		if(!p.ok){ return p.error; }
		const { saved, persisted, selected, selectionDeferred, loaded } = p;
		return {
			ok: true,
			data: { cid: saved.cid, created: true, duplicate: false, persisted, cast: built.summary || '', record: { event: saved.event, caseType: saved.caseType, divTime: saved.divTime, zone: saved.zone, pos: saved.pos, module: saved.sourceModule }, selected, loaded, ...(selectionDeferred ? { selectionDeferred: true } : {}) },
			message: `已按起卦结果新建事盘「${saved.event}」(${spec.label}:${built.summary || ''})`,
			summary: `新建事盘 ${saved.event}`,
			assumptions,
			undo: { kind: 'trash-record', payload: { store: 'case', cid: saved.cid } },
		};
	},
};
