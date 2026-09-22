import { SETTING_FACETS, validateFacetValues, snapshotFacet, applyFacetValues } from '../settingsFacets';
import { GUIDE } from './_shared';

export default {
	name: 'set_settings',
	level: 'additive',
	category: 'settings',
	undoKind: 'restore-settings',
	description: `修改排盘口径或显示偏好(chart=当前盘口径 / mount=某技法的 AI 挂载默认 / app=全局显示偏好 / classical=古典占星全局参数 / technique=技法本地设置)。${GUIDE}:仅当用户明确要求改设置时调用,先用 describe_settings 取合法键值;一次调用要么全部生效要么全部拒绝;不会删除任何设置;密钥、模型接口、备份不在此面。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['facet', 'values'],
		properties: {
			facet: { type: 'string', enum: SETTING_FACETS },
			technique: { type: 'string', maxLength: 40 },
			values: { type: 'object', minProperties: 1, maxProperties: 20, additionalProperties: { type: ['string', 'number', 'boolean', 'array', 'null'] } },
		},
	},
	snapshot(args){
		const v = validateFacetValues(args.facet, args.technique, args.values);
		if(!v.ok){ return null; }
		return snapshotFacet(args.facet, args.technique, Object.keys(v.values));
	},
	// [批二③] 写前预览:当前值 → 改后值(只含本次要改的键;纯读)
	preview(args){
		const v = validateFacetValues(args.facet, args.technique, args.values);
		if(!v.ok){ return null; }
		const keys = Object.keys(v.values).sort();
		const snap = snapshotFacet(args.facet, args.technique, keys);
		const cur = snap && snap.snapshot && typeof snap.snapshot === 'object' ? snap.snapshot : {};
		// 只展示本次要改的键:当前值缺席写「(未设)」,改后值就是本次给的值
		const fmt = (o)=>keys.map((k)=>`${k}: ${Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined ? JSON.stringify(o[k]) : '(未设)'}`).join('\n');
		return { title: `修改 ${args.facet}${args.technique ? `·${args.technique}` : ''} 设置`, before: fmt(cur), after: fmt({ ...cur, ...v.values }) };
	},
	async run(args){
		const v = validateFacetValues(args.facet, args.technique, args.values);
		if(!v.ok){
			return { ok: false, code: v.code || 'E_SETTING_VALUE_INVALID', message: v.badKey ? `键「${v.badKey}」${v.code === 'E_SETTING_KEY_NOT_ALLOWED' ? '不在可改白名单' : '取值不在允许范围'}(整体未写入,请先 describe_settings)` : (v.message || '设置校验失败') };
		}
		const before = snapshotFacet(args.facet, args.technique, Object.keys(v.values));
		const r = await applyFacetValues(args.facet, args.technique, v.values);
		if(!r.ok){ return { ok: false, code: r.code || 'E_SETTING_VALUE_INVALID', message: r.message || '设置写入失败' }; }
		return {
			ok: true,
			data: { facet: args.facet, technique: args.technique, applied: r.applied, before: before.snapshot },
			message: `已修改 ${args.facet} 设置: ${Object.keys(v.values).join(', ')}`,
			summary: `改设置 ${args.facet}:${Object.keys(v.values).join(',')}`,
			undo: { kind: 'restore-settings', payload: before },
		};
	},
};
