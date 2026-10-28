import { describeFacet, SETTING_FACETS, preparePageFacet } from '../settingsFacets';
import { GUIDE } from './_shared';
import { settingFacetTitle } from '../settingNames';   // 动作条摘要写中文面名 / 技法名(与改设置的审批卡同一套)

const schema = {
	type: 'object', additionalProperties: false, required: ['facet'],
	properties: {
		facet: { type: 'string', enum: SETTING_FACETS, description: 'chart=当前盘口径 / mount=某技法的 AI 挂载默认 / app=全局显示偏好 / classical=古典占星全局参数 / technique=技法本地设置 / page=技法页保存的排盘设置(technique 填页键,如 liureng / dunjia / taiyi / horary)' },
		technique: { type: 'string', maxLength: 40, description: 'facet=mount|technique|page 时必填,技法键如 astrochart/indiachart/suzhan/guolao;page 面填页键' },
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
		if(args.facet === 'page'){ await preparePageFacet(args.technique); }   // 页面面 schema 惰性载入
		const d = describeFacet(args.facet, args.technique);
		if(!d.ok){ return { ok: false, code: d.code, message: d.message || '该面不可用' }; }
		// 缺工作区桥的面(无头 / 页面未就绪):整面只读并写明原因(与写入时的拒绝同一判据 facetBridgeBlock)
		const ro = d.readOnly ? { writable: false, readOnlyReason: d.readOnly.message } : {};
		return { ok: true, data: { facet: args.facet, technique: d.technique, ...ro, items: d.items }, ...(d.readOnly ? { message: `此面现在只读:${d.readOnly.message}` } : {}), summary: `设置面 ${settingFacetTitle(args.facet, d.technique || args.technique)} ${d.items.length} 项${d.readOnly ? '(只读)' : ''}` };
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
		if(args.facet === 'page'){ await preparePageFacet(args.technique); }   // 页面面 schema 惰性载入
		const d = describeFacet(args.facet, args.technique);
		if(!d.ok){ return { ok: false, code: d.code, message: d.message || '该面不可用' }; }
		const values = {};
		d.items.forEach((it)=>{ values[it.key] = it.current; });
		return { ok: true, data: { facet: args.facet, technique: d.technique, values }, summary: `设置面 ${settingFacetTitle(args.facet, d.technique || args.technique)} 当前值` };
	},
};

export default describeSettingsTool;
