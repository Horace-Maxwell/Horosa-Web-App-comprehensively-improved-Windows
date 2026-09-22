import { describeFacet, SETTING_FACETS } from '../settingsFacets';
import { GUIDE } from './_shared';

const schema = {
	type: 'object', additionalProperties: false, required: ['facet'],
	properties: {
		facet: { type: 'string', enum: SETTING_FACETS, description: 'chart=当前盘口径 / mount=某技法的 AI 挂载默认 / app=全局显示偏好 / classical=古典占星全局参数 / technique=技法本地设置' },
		technique: { type: 'string', maxLength: 40, description: 'facet=mount|technique 时必填,技法键如 astrochart/indiachart/suzhan/guolao' },
	},
};

export const describeSettingsTool = {
	name: 'describe_settings',
	level: 'read',
	category: 'settings',
	undoKind: 'none',
	cacheable: true,
	description: `把可由助手修改的设置项(键/含义/可选值/当前值/默认值)以表格返回。改设置前必须先调用它拿到合法键与值域,不要凭记忆猜键名。${GUIDE}。`,
	inputSchema: schema,
	async run(args){
		const d = describeFacet(args.facet, args.technique);
		if(!d.ok){ return { ok: false, code: d.code, message: d.message || '该面不可用' }; }
		return { ok: true, data: { facet: args.facet, technique: d.technique, items: d.items }, summary: `设置面 ${args.facet} ${d.items.length} 项` };
	},
};

export const getSettingsTool = {
	name: 'get_settings',
	level: 'read',
	category: 'settings',
	undoKind: 'none',
	cacheable: true,
	description: `只读某设置面的当前值(轻量;不含可选值表)。${GUIDE}。`,
	inputSchema: schema,
	async run(args){
		const d = describeFacet(args.facet, args.technique);
		if(!d.ok){ return { ok: false, code: d.code, message: d.message || '该面不可用' }; }
		const values = {};
		d.items.forEach((it)=>{ values[it.key] = it.current; });
		return { ok: true, data: { facet: args.facet, technique: d.technique, values }, summary: `设置面 ${args.facet} 当前值` };
	},
};

export default describeSettingsTool;
