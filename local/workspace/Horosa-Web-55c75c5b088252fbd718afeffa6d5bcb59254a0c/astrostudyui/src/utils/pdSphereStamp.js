// [挂载自检 F-11·P0] 主限天球「当前动画所指」盖章的单一读写口:
// 此前 AstroPDSphere 只存 {txt, ts},AstroDirectMain.buildPrimaryDirectSnapshotText 对任意盘 24h 内都附
// `[主限天球·当前动画所指]` 段 → 在 A 盘天球选过行,挂载/导出 B 盘时把 A 盘的向运行喂给 AI。
// 现在盖章带盘签名(/chart 回显 params 的 date/time/lon/lat,两侧同源),读取比对不同即视为无盖章。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from './safeStorage';

export const PD_SPHERE_STAMP_KEY = 'horosa.pdsphere.aiCurrentRow';
export const PD_SPHERE_STAMP_TTL_MS = 24 * 3600 * 1000;

export function pdSphereChartSig(params){
	const p = params && typeof params === 'object' ? params : {};
	return ['date', 'time', 'lon', 'lat'].map((k)=>`${p[k] === undefined || p[k] === null ? '' : p[k]}`.trim()).join('|');
}

export function writePdSphereStamp(params, txt){
	const text = `${txt || ''}`.trim();
	if(!text){ return null; }
	const stamp = { txt: text, ts: Date.now(), sig: pdSphereChartSig(params) };
	safeJsonStringifyToStorage(PD_SPHERE_STAMP_KEY, stamp);
	return stamp;
}

// 只在「同一张盘 + 24h 内 + 带签名」时返回盖章;旧格式(无 sig)一律视为无(宁漏勿误伤)。
export function readPdSphereStamp(params, now){
	const s = safeJsonParseFromStorage(PD_SPHERE_STAMP_KEY);
	if(!s || !s.txt || !Number.isFinite(s.ts)){ return null; }
	const t = Number.isFinite(now) ? now : Date.now();
	if(t - s.ts >= PD_SPHERE_STAMP_TTL_MS){ return null; }
	if(!s.sig || s.sig !== pdSphereChartSig(params)){ return null; }
	return s;
}
