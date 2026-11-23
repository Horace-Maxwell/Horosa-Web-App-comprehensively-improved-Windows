// AI 助手·无头合盘取数 cast_relative:两张命盘(已存 cid 或临时出生资料)之间的合盘数据,不开页面、不写记录。
// 三类数据与对话页双盘挂载同一取数:西洋(比较盘 / 组合盘 / 影响盘 / 契合度,getPairSynastryText 按对缓存)·
// 八字合婚对照 · 紫微合盘对照(getPairChineseTexts;只给对照事实、不打分)。
// 两人各按自己的生效挂载设置(与对话页双盘挂载、目标任务同一解析 resolveEffectiveTechniqueOptions:这里没有会话覆盖,
// 即用户设的同类默认,按各自那张盘现状剪);没设同类默认 = 只按记录(结果与不带设置时逐字节相同)。
import { getPairSynastryText, getPairChineseTexts, clipContentToBudget } from '../../aiAnalysisContext';
import { resolveEffectiveTechniqueOptions } from '../../techniqueMountSettings';
import { buildSourceFromArgs } from './castTechnique';
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { splitContentSections } from '../../aiExport';

export const RELATIVE_MODES = ['western', 'bazi', 'ziwei'];
// 西洋合盘可另取的两张盘(合盘页的「时空中点盘」「马克斯盘」页签)
export const WESTERN_EXTRAS = ['timespace', 'marks'];
// 合盘取数用到的挂载技法:西洋取星盘那一门,中式两门各取同名技法
const PAIR_MOUNT_KEYS = ['astrochart', 'bazi', 'ziwei'];
const MODE_TITLES = { western: '西洋合盘(比较盘 / 组合盘 / 影响盘 / 契合度)', bazi: '八字合婚对照', ziwei: '紫微合盘对照' };

const PERSON_SCHEMA = {
	type: 'object', additionalProperties: false, required: ['kind'],
	properties: {
		kind: { type: 'string', enum: ['record', 'natal'], description: 'record=已存命盘(cid)/ natal=临时出生资料' },
		cid: { type: 'string', pattern: RECORD_ID_PATTERN, description: 'kind=record 必填(必须是命盘,不是事盘)' },
		birth: { type: 'string', maxLength: 60, description: 'kind=natal 必填' },
		calendar: { type: 'string', enum: ['solar', 'lunar'] },
		name: { type: 'string', maxLength: 60 },
		place: { type: 'string', maxLength: 80 },
		gpsLat: { type: 'number', minimum: -90, maximum: 90 },
		gpsLon: { type: 'number', minimum: -180, maximum: 180 },
		zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$' },
		gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
	},
	allOf: [
		{ if: { properties: { kind: { const: 'record' } } }, then: { required: ['cid'] } },
		{ if: { properties: { kind: { const: 'natal' } } }, then: { required: ['birth'] } },
	],
};

async function personOf(spec, label){
	const built = await buildSourceFromArgs(spec);
	if(built.error){ return { error: built.error }; }
	const src = built.source;
	if(!src || src.sourceType !== 'chart' || !src.record){
		return { error: { ok: false, code: 'E_TECHNIQUE_NOT_ALLOWED', message: `${label}必须是命盘(出生资料),事盘不能合盘` } };
	}
	const name = `${(src.record && src.record.name) || src.title || label}`.replace(/\s+/g, '') || label;
	return { record: src.record, name, assumptions: built.assumptions || [] };
}

export default {
	name: 'cast_relative',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 120000,
	description: `两张命盘之间的合盘数据,不开页面、不写记录:western=西洋比较盘 / 组合盘 / 影响盘 / 契合度;bazi=八字合婚对照(年命、日柱夫妻宫、喜忌互补);ziwei=紫微合盘对照(双方生年四化入对方宫位、命宫 / 夫妻宫主星)。只给数据与对照事实,不打分;下结论请写明出自哪一方的哪项盘面。${GUIDE}:用户要求比较两人、合盘或合婚时调用;记录 id 先用 list_records 取。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['a', 'b'],
		properties: {
			a: { ...PERSON_SCHEMA, description: '本人' },
			b: { ...PERSON_SCHEMA, description: '对方' },
			modes: { type: 'array', items: { type: 'string', enum: RELATIVE_MODES }, minItems: 1, maxItems: 3, default: ['western'] },
			maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 12000, description: '合并正文的上限(按段对齐截断)' },
			sections: { type: 'array', items: { type: 'string' }, maxItems: 12, description: '只取这些段(按段名子串匹配,如「合成图盘」「关系量化」「八重合」「互摄相位」);西洋合盘全文十万字上下,先不带这一项调一次看回包的 sectionTitles,再按段取' },
			westernExtras: { type: 'array', items: { type: 'string', enum: WESTERN_EXTRAS }, maxItems: 2, description: '西洋合盘另取:timespace=时空中点盘 / marks=马克斯盘(缺省只取比较盘 / 组合盘 / 影响盘 / 契合度 / 八重合)' },
		},
	},
	outputSchema: {
		type: 'object', required: ['sections', 'content', 'truncated', 'totalChars'],
		properties: {
			sections: { type: 'array', items: { type: 'object', required: ['mode', 'title', 'chars'], properties: { mode: { type: 'string' }, title: { type: 'string' }, chars: { type: 'integer' } } } },
			missing: { type: 'array', items: { type: 'string' } },
			content: { type: 'string' }, truncated: { type: 'boolean' }, totalChars: { type: 'integer' },
			sectionTitles: { type: 'array', items: { type: 'string' } }, pickedSections: { type: 'array', items: { type: 'string' } }, omittedSections: { type: 'array', items: { type: 'string' } },
		},
	},
	async run(args, ctx){
		const report = ctx && typeof ctx.progress === 'function' ? ctx.progress : null;
		const modes = Array.from(new Set(Array.isArray(args.modes) && args.modes.length ? args.modes : ['western']));
		const a = await personOf(args.a, '本人');
		if(a.error){ return a.error; }
		const b = await personOf(args.b, '对方');
		if(b.error){ return b.error; }
		const names = { selfName: a.name, otherName: b.name };
		const pairOpts = {
			optionsA: resolveEffectiveTechniqueOptions(PAIR_MOUNT_KEYS, { record: a.record }),
			optionsB: resolveEffectiveTechniqueOptions(PAIR_MOUNT_KEYS, { record: b.record }),
		};
		const sections = [];
		const missing = [];
		let step = 0;
		for(const mode of modes){
			if(ctx && ctx.signal && ctx.signal.aborted){ return { ok: false, code: 'E_ABORTED', message: '本轮已被停止' }; }
			step += 1;
			if(report){ report(step, modes.length + 1, MODE_TITLES[mode]); }
			let text = '';
			try{
				if(mode === 'western'){ text = await getPairSynastryText(a.record, b.record, { ...pairOpts, extraCharts: args.westernExtras }); }
				else{ text = (getPairChineseTexts(a.record, b.record, [mode], names, pairOpts) || {})[mode] || ''; }
			}catch(e){ text = ''; }
			if(`${text || ''}`.trim()){ sections.push({ mode, title: MODE_TITLES[mode], content: `${text}`.trim() }); }
			else{ missing.push(mode); }
		}
		if(!sections.length){
			return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `合盘数据没取到(${missing.map((m)=>MODE_TITLES[m]).join('、')});西洋合盘需本机计算服务在线`, retryable: true, data: { missing } };
		}
		const head = `【合盘】本人「${a.name}」× 对方「${b.name}」`;
		const joined = [head, ...sections.map((s)=>`【${s.title}】\n${s.content}`)].join('\n\n');
		const max = args.maxChars || 12000;
		// 按段取(与 cast_technique 同一套:段名子串匹配;一段都没匹上回可用段名)。西洋合盘全文十万字上下,不按段取后半截永远读不到
		const allSecs = splitContentSections(joined).filter((sec)=>sec.title);
		const sectionTitles = Array.from(new Set(allSecs.map((sec)=>sec.title))).slice(0, 80);
		const wanted = Array.isArray(args.sections) ? args.sections.map((x)=>`${x || ''}`.trim()).filter(Boolean) : [];
		let picked = joined;
		if(wanted.length){
			const hit = allSecs.filter((sec)=>wanted.some((w)=>`${sec.title}`.indexOf(w) >= 0));
			if(!hit.length){
				return { ok: false, code: 'E_SECTION_NOT_FOUND', message: `合盘正文里没有这些段:${wanted.join('、')};可用段名见 data.availableSections`, data: { availableSections: sectionTitles } };
			}
			picked = [head, ...hit.map((sec)=>sec.lines.join('\n'))].join('\n\n');
		}
		const truncated = picked.length > max;
		const clip = truncated ? clipContentToBudget(picked, Math.max(200, max - 64)) : null;
		const content = truncated ? `${clip.text}\n[truncated: 本次要取 ${picked.length} 字符,超出 maxChars;用 sections 按段取]` : picked;
		return {
			ok: true,
			// 各段只回标题与字数(正文已在 content 里,不重复一份)
			data: { sections: sections.map((s)=>({ mode: s.mode, title: s.title, chars: s.content.length })), ...(missing.length ? { missing } : {}), content, truncated, totalChars: joined.length,
				sectionTitles, ...(wanted.length ? { pickedSections: wanted } : {}), ...(clip && clip.sectionAligned && Array.isArray(clip.omittedTitles) ? { omittedSections: clip.omittedTitles } : {}) },
			assumptions: a.assumptions.concat(b.assumptions),
			summary: `合盘 ${a.name} × ${b.name}(${sections.map((s)=>s.mode).join(' / ')})`,
		};
	},
};
