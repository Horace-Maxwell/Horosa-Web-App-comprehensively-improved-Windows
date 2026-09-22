// [Q-314 裁决 A 2026-09-18] 八字左栏「日界 / 晚子时·时柱起干 / 时间算法」三键分域。
// 此前:八字左栏直接改共享 astro.fields 三键 → 紫微 / 七政 / 六壬 / 金口诀 / 导出头跟着变,且把全局同步锁死到重启;
//      未上锁时全局事件又会覆盖已载入命盘的随盘值。
// 现在:三键分三层 —— 全局(设置弹窗)→ 共享层 fields(随盘值;载入命盘自带口径时钉住,全局事件不覆盖)
//      → 八字本页覆盖层 astro.baziCalibreOverride(只八字页读;新命盘 / 载入命盘时复位)。
// 八字页所见优先级:本页左栏 > 随盘值 > 全局;其它技法只看共享层(随盘值 > 全局)。
export const BAZI_CALIBRE_KEYS = ['after23NewDay', 'lateZiHourUseNextDay', 'timeAlg'];

function normInt(v){
	if(v === undefined || v === null || v === ''){ return undefined; }
	if(v === true){ return 1; }
	if(v === false){ return 0; }
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
}

// 左栏补丁拆分:三键 → calibre(裸值);其余 → rest(原形)。
export function splitBaziCalibrePatch(patch){
	const calibre = {};
	const rest = {};
	Object.keys(patch || {}).forEach((k)=>{
		if(BAZI_CALIBRE_KEYS.indexOf(k) >= 0){
			const raw = patch[k] && typeof patch[k] === 'object' && 'value' in patch[k] ? patch[k].value : patch[k];
			const n = normInt(raw);
			if(n !== undefined){ calibre[k] = n; }
		}else{
			rest[k] = patch[k];
		}
	});
	return { calibre, rest };
}

// 覆盖层归一化(只留三键、只留可解析整数)。
export function normalizeBaziCalibreOverride(ov){
	const out = {};
	BAZI_CALIBRE_KEYS.forEach((k)=>{
		const n = ov ? normInt(ov[k]) : undefined;
		if(n !== undefined){ out[k] = n; }
	});
	return out;
}

// 八字页所见 fields:覆盖层有值的键换成新 entry(不动共享 entry 对象;无覆盖时原样返回同一对象 → 零回归、不破 SCU)。
export function applyBaziCalibreOverride(fields, override){
	const ov = normalizeBaziCalibreOverride(override);
	const keys = Object.keys(ov);
	if(!fields || !keys.length){ return fields; }
	let changed = false;
	const next = { ...fields };
	keys.forEach((k)=>{
		const cur = fields[k] && fields[k].value;
		if(normInt(cur) !== ov[k]){
			next[k] = { ...(fields[k] || { name: [k] }), value: ov[k] };
			changed = true;
		}
	});
	return changed ? next : fields;
}

// 载入的命盘 / 事盘是否自带口径(任一键有值)→ 共享层钉住,全局事件不覆盖。
export function recordPinsDayBoundary(rec){
	if(!rec || typeof rec !== 'object'){ return false; }
	return BAZI_CALIBRE_KEYS.some((k)=>rec[k] !== undefined && rec[k] !== null && `${rec[k]}` !== '');
}
