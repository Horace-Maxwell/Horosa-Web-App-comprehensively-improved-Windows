// KinAstro 取盘与 AI 快照(盘面 → 快照文本、按字段无头重算、快照键与存档)
// 从 KinAstroMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { postKentang } from '../../../services/kentangPost';
import { formatHumanValue } from '../../../utils/humanReadableFields';
import { parseFieldsDateTime } from '../../../utils/kinAstroFieldsSync';
import { parseYearFromDateStr } from '../../../utils/dateStrSafe';
import { buildTiebanFramework, buildTiebanFrameworkSnapshot } from '../../../utils/tiebanFrameworkLocal';
import { deriveLocalNongliAsync } from '../../../utils/divinationTimeDraft';
import { buildYanqinYanfaSnapshot } from '../../yanqin/yanqinSnapshot';
import { saveModuleAISnapshot } from '../../../utils/moduleAiSnapshot';

// normBinaryGender / parseFieldsDateTime / computeKinFieldsResync 移至 utils/kinAstroFieldsSync
// （fields→state 同步层，纯函数可测；载入命例时 didUpdate 据此重同步性别/农历锚点，修透传断链）。

export function postKinAstro(serviceKey, payload){ return postKentang(serviceKey, 'pan', payload); }

export function fmtValue(value){
	return formatHumanValue(value);
}

export function textValue(value){
	if(value === undefined || value === null || value === ''){
		return '—';
	}
	if(typeof value === 'object'){
		return fmtValue(value.text || value.verse || value.content || value.raw_key || value);
	}
	return fmtValue(value);
}

export function buildSnapshotText(pan){
	if(!pan){
		return '暂无 kinastro 数据';
	}
	if(pan.snapshot){
		return pan.snapshot;
	}
	const lines = [];
	(pan.sections || []).forEach((section)=>{
		lines.push(`[${section.title}]`);
		(section.rows || []).forEach((row)=>{
			lines.push(`${row.label}：${fmtValue(row.value)}`);
		});
		lines.push('');
	});
	return lines.join('\n').trim();
}

// 演禽(xianqin)/ 策天飞星(cetian) AI 快照(无头):按出生 fields 经 ken 后端起盘 → buildSnapshotText。
// aiAnalysisContext 复算用;无 pan 或后端不可达即返 '' → 挂载显示「缺失」而非占位语。
// optionsOverride:挂载「每技法设置」下发的排盘选项(如策天 method/lunarMode/starOrder/show*)。
// 🔴 曾无此参 → cetian 的 8 个齿轮项在挂载链上全是死开关:UI 提示「已按新设置重算」、
// 卡片打 regenerated 绿标,快照却逐字节不变(组件 state 只在页面内生效,挂载走本函数)。
export async function buildKinAstroSnapshotForFields(fields, serviceKey, optionsOverride){
	if(!serviceKey){
		return '';
	}
	const payload = parseFieldsDateTime(fields);
	if(!payload){
		return '';
	}
	if(optionsOverride && typeof optionsOverride === 'object'){
		Object.keys(optionsOverride).forEach((k)=>{
			const v = optionsOverride[k];
			if(v !== undefined && v !== null && v !== ''){ payload[k] = v; }
		});
	}
	let text = '';
	let panForFramework = null;
	try{
		const pan = await postKinAstro(serviceKey, payload);
		if(pan){
			panForFramework = pan;
			const t = buildSnapshotText(pan);
			text = (t && t !== '暂无 kinastro 数据') ? t : '';
		}
	}catch(e){
		text = '';
	}
	// 铁板:追加 [框架推演] 段(页面 saveKinAstroAISnapshots 恒带此段,无头曾整段缺失 → 两侧快照不等长)。
	// 口径:齿轮 tiebanSchool/tiebanKeSystem/tiebanKe(缺省 south/qing8/1 = 页面 state 默认),gender 随 optionsOverride。
	if(serviceKey === 'tieban' && text){
		try{
			const ov = optionsOverride && typeof optionsOverride === 'object' ? optionsOverride : {};
			const fwOf = (pan)=>{
				const pillars = (pan && pan.pillars) || [];
				const gz = (k, i)=>{ const byKey = pillars.find((pp)=>pp.key === k); return (byKey && byKey.ganzhi) || (pillars[i] && pillars[i].ganzhi) || ''; };
				const fourPillars = { year: gz('year', 0), month: gz('month', 1), day: gz('day', 2), hour: gz('hour', 3) };
				const birthYear = parseYearFromDateStr(`${(pan && pan.dateStr) || ''}`) || 0;
				return buildTiebanFramework(fourPillars, {
					school: ov.tiebanSchool || 'south',
					keSystem: ov.tiebanKeSystem || 'qing8',
					ke: ov.tiebanKe !== undefined && ov.tiebanKe !== null && ov.tiebanKe !== '' ? ov.tiebanKe : 1,
					gender: ov.gender !== undefined ? ov.gender : '1',
					birthYear,
				});
			};
			const suffix = panForFramework ? (buildTiebanFrameworkSnapshot(fwOf(panForFramework)) || '') : '';
			if(suffix){ text = `${text}\n\n${suffix}`; }
		}catch(e){ /* 框架段失败不拖主快照 */ }
	}
	// 演禽:追加右栏「演法」内容(起禽四禽/择日/占卜/投胎 + 当前流派),纯前端,后端不可达也出。
	if(serviceKey === 'xianqin'){
		try{
			// 全年份域:BC/域外农历月(月禽/投胎)lunar-js 静默错 → 经远程桥取权威 monthInt 注入快照 payload。
			const yanfaPayload = { ...payload };
			try{
				const nl = await deriveLocalNongliAsync(fields);
				if(nl && nl.monthInt){ yanfaPayload.lunarMonth = nl.monthInt; }
			}catch(e){ /* 桥失败 → snapshot 内域内 lunar-js/公历月兜底 */ }
			const yanfa = buildYanqinYanfaSnapshot(yanfaPayload);
			if(yanfa){ text = text ? (text + '\n\n' + yanfa) : yanfa; }
		}catch(e){ /* 演法失败不影响命盘快照 */ }
	}
	return text;
}

function kinAstroSnapshotKey(serviceKey){
	return `kinastro-${serviceKey || 'unknown'}`;
}

export function setRuntimeKinAstroTechnique(moduleKey, serviceKey){
	try{
		if(typeof window === 'undefined'){
			return;
		}
		if(!window.__horosaKinAstroCurrent || typeof window.__horosaKinAstroCurrent !== 'object'){
			window.__horosaKinAstroCurrent = {};
		}
		if(moduleKey){
			window.__horosaKinAstroCurrent[moduleKey] = serviceKey;
		}
		window.__horosaKinAstroCurrent.technique = serviceKey;
		window.__horosaKinAstroTechnique = serviceKey;
	}catch(e){
		// runtime hint only
	}
}

// 快照 meta(平时写槽与刷新应答同一份):服务键 / 技法 / 槽位 / 段目录
export function kinAstroSnapshotMeta(config, pan, moduleKey){
	return {
		source: 'kentang2017/kinastro',
		serviceKey: config.serviceKey,
		technique: config.techniqueLabel,
		moduleKey,
		sections: ((pan && pan.sections) || []).map((section)=>section.title).filter(Boolean),
	};
}

export function saveKinAstroAISnapshots(config, pan, extraSnapshot, moduleKeyOverride, fields){
	if(!config || !pan){
		return;
	}
	// 🔴 moduleKey 须随宿主:xianqin 配置静态写 'yanqin'(独立演禽门户口径),但同一配置被
	// 「命·其他」复用 —— 曾恒写 yanqin → mingother 槽位停在上一技法,AI 挂载/导出在
	// 命·其他页看演禽却取到策天旧盘。宿主传 hostModuleKey 即写对槽位。
	const moduleKey = moduleKeyOverride || config.moduleKey;
	const base = buildSnapshotText(pan);
	let content = extraSnapshot ? `${base}\n\n${extraSnapshot}` : base;
	// 演禽演法段页面/无头同构:无头路径(:349-358)对 xianqin await 农历桥后
	// 追加 buildYanqinYanfaSnapshot,页面路径曾整段不产 → 页面 render(YanQinBranchPanel)
	// 自愈显示而 AI 快照恒缺 [演法] 段。此处同构:域内 lunar-js 同步自算即全对;
	// 域外(BC/万年后)builder 退公历月兜底不崩,再 fire 农历桥回包带 monthInt 补拍终版。
	const appendYanfa = (lunarMonth)=>{
		try{
			const payload = parseFieldsDateTime(fields);
			if(lunarMonth){ payload.lunarMonth = lunarMonth; }
			const yanfa = buildYanqinYanfaSnapshot(payload);
			return yanfa ? `${content}\n\n${yanfa}` : content;
		}catch(e){ return content; }
	};
	const meta = kinAstroSnapshotMeta(config, pan, moduleKey);
	const persist = (txt)=>{
		saveModuleAISnapshot(kinAstroSnapshotKey(config.serviceKey), txt, meta);
		saveModuleAISnapshot(moduleKey, txt, meta);
	};
	if(config.serviceKey === 'xianqin' && content && fields){
		persist(appendYanfa(null));
		deriveLocalNongliAsync(fields).then((nl)=>{
			if(nl && nl.monthInt){ persist(appendYanfa(nl.monthInt)); }
		}).catch(()=>{ /* 桥失败 → 首拍的 lunar-js/公历月兜底已在 */ });
		return;
	}
	persist(content);
}

export function sectionByTitle(sections, names){
	const wanted = new Set(names);
	return (sections || []).filter((section)=>wanted.has(section.title));
}
