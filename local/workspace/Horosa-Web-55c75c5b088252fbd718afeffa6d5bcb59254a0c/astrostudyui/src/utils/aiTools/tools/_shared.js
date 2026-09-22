// AI 助手·工具共用小件(不含任何写入)。
import { getStore } from '../../storageutil';
import { getWorkspaceBridge, getWorkspaceUi } from '../workspaceBridge';

export function nowStr(){
	const d = new Date();
	const p = (n)=>(n < 10 ? '0' : '') + n;
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function ctxDispatch(ctx){
	if(ctx && typeof ctx.dispatch === 'function'){ return ctx.dispatch; }
	const b = getWorkspaceBridge();
	return b && typeof b.dispatch === 'function' ? b.dispatch : null;
}

export function ctxStore(ctx){
	if(ctx && typeof ctx.getStore === 'function'){ return ctx.getStore() || {}; }
	return getStore() || {};
}

// 页面登记的 ui 面(选源/导航/配对)在下,本 Turn 传入的 ui(页面回调)在上
export function ctxUi(ctx){
	return { ...(getWorkspaceUi() || {}), ...((ctx && ctx.ui) || {}) };
}

export const GUIDE = '仅当用户明确要求时调用';
// 单对象 + if/then 按 kind 定 required:不用 oneOf——Ajv removeAdditional 在 oneOf 首支就把
// 其它分支的键剥掉(数据被改后余支必败),是已踩实的形状陷阱。
export const SOURCE_SCHEMA = {
	type: 'object', additionalProperties: false, required: ['kind'],
	properties: {
		kind: { type: 'string', enum: ['record', 'timepoint', 'natal'], description: 'record=已存命盘/事盘(cid) / timepoint=临时起课时间 / natal=临时出生数据' },
		cid: { type: 'string', pattern: '^local-', description: 'kind=record 必填' },
		divTime: { type: 'string', maxLength: 60, description: 'kind=timepoint;缺省=现在' },
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
