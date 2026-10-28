import { parseDateTimeMs } from '../../utils/dateTimeParse';
import React from 'react';
import { message } from 'antd';
import { getLocalChartsStoreHealth } from '../../utils/localcharts';
import { getLocalCasesStoreHealth } from '../../utils/localcases';
import { getShadowMirrorStatus, getShadowAhead, mergeShadowAhead, discardShadowAhead, shadowAheadCids, SHADOW_RECONCILED_EVENT } from '../../utils/shadowMirror';
import { emitRecordsChanged } from '../../utils/recordStoreNotice';
import { saveBlobToBrowser, describeSaveResult } from '../../utils/aiAnalysisExport';
import { hasCarriedRestoreResult } from '../../utils/restoreResultCarry';
import { readBackupIncident, observeBackupHealth, storeHealthKind, clearBackupIncident, BACKUP_INCIDENT_EVENT } from '../../utils/backupIncident';
import { listCorruptUnarchivedKeys, CORRUPT_UNARCHIVED_EVENT } from '../../utils/safeStorage';

// 本地储存横幅:localRecordStore 写路径发现储存根坏(非 quota 异常/句柄不可得)时
// 降级为内存模式 —— 会话内数据仍可用,但**重启即丢**。此前该状态只有一行 console.warn,
// 用户完全无感(「保存假成功」事故面的 UI 侧)。
//
// 另外几种要用户知道 / 决定的存储状况(同一条横幅,逐条列出):
//   · 主存内容坏了(解析不出):原内容已原样留档,本次运行只在内存(等启动对账用影子副本找回);
//     没有影子副本可救时已从空库开始并落盘(可从备份恢复);原内容没能留档时先不动它;
//   · 启动对账发现本机存储被整体清空过:影子副本只找回了记录库与回收站,其余数据给「从最近的自动备份恢复」入口;
//   · 影子副本里有本机没有 / 更新的记录(上次保存后立刻退出、主存没落盘):并回 或 以本机为准(这期间这几个库暂停写影子副本);
//   · 存储写满时删掉、却没能留进回收站或删除日志的记录:当场给「导出这些记录」;
//   · 读到更新版本写的记录(降级 / 与新版本互导)。
//
// 触发:内核每实例每会话至多一次的 'horosa.localRecordStore.degraded' / newerSchema 事件 + 影子副本对账结果事件;
// 挂载时补查两店健康态与最近一次对账(事件可能早于本组件挂载,ServiceStatusBanner 的 pending 事件同思路)。
// quota(空间不足)不走本横幅 —— 那条路在保存动作上抛错,由既有「保存失败」Modal 就地提示。
// 形制与 ServiceStatusBanner 一致:fixed 顶部居中、wrap 穿透点击、琥珀告警色、可手动关闭。
const STORE_NAMES = {
	'horosa.localCharts.v1': '命盘库',
	'horosa.localCases.v1': '事盘库',
	'horosa.localCharts.trash.v1': '命盘回收站',
	'horosa.localCases.trash.v1': '事盘回收站',
};

function readHealth(){
	const out = { memory: false, corrupt: [], corruptUnarchived: [], corruptReset: [], corruptResetAt: 0, newer: null, incidentSections: [], incidentAt: 0, observed: {} };
	[['charts', getLocalChartsStoreHealth], ['cases', getLocalCasesStoreHealth]].forEach(([section, fn])=>{
		try{
			const h = fn();
			// 每段的现状(出事类型 / 健康)交给持久的「出事」标记:不健康的记下(重启后仍在),问题消失的按规则自动清
			out.observed[section] = storeHealthKind(h);
			if(h && (h.mode === 'memory' || h.corrupt)){
				out.incidentSections.push(section);
				const t = h.corrupt ? Number(h.corrupt.at) || 0 : 0;
				if(t && (!out.incidentAt || t < out.incidentAt)){ out.incidentAt = t; }
			}
			if(h && h.mode === 'memory'){ out.memory = true; }
			if(h && h.corrupt){
				const name = STORE_NAMES[h.corrupt.storageKey] || '记录库';
				if(h.corrupt.resetToEmpty){
					out.corruptReset.push(name);
					// 最早发现坏了的那一刻:恢复取这之前写的自动备份(之后心跳写的是空库)
					const at = Number(h.corrupt.at) || 0;
					if(at && (!out.corruptResetAt || at < out.corruptResetAt)){ out.corruptResetAt = at; }
				}
				else if(h.corrupt.archiveKey){ out.corrupt.push(name); }
				else{ out.corruptUnarchived.push(name); }
			}
			if(h && h.newerSchema && !out.newer){ out.newer = h.newerSchema; }
		}catch(e){ /* 健康态查询失败不阻断渲染 */ }
	});
	return out;
}

const INCIDENT_SECTION_NAMES = { charts: '命盘库', cases: '事盘库', aiWorkspace: 'AI 分析工作区' };
// 出过事的持久提示(纯函数,单测锁):按出事类型说 —— 从空库开始过的(之后的备份缺了出事前的数据)与问题消失即自动清的分开
export function incidentNoticeText(incident){
	const i = incident || {};
	const sections = Array.isArray(i.sections) ? i.sections : [];
	const kinds = i.kinds && typeof i.kinds === 'object' ? i.kinds : {};
	const nameOf = (list)=>list.map((s)=>INCIDENT_SECTION_NAMES[s] || s).join('、');
	const names = nameOf(sections) || '本机数据';
	const when = Number(i.at) > 0 ? new Date(Number(i.at)).toLocaleString() : '之前';
	const head = `${when}发现${names}出过问题：之后写的自动备份都标了「来源不健康」，修剪时出事之前最近一份完整的备份一直留着。`;
	const reset = sections.filter((s)=>kinds[s] === 'reset');
	if(reset.length){
		return `${head}${nameOf(reset)}当时从空库开始，那之后的备份不含出事之前的数据：需要的话取出事之前那份恢复；确认已经处理好了点「已处理」。`;
	}
	if(sections.some((s)=>!kinds[s] || kinds[s] === 'legacy')){
		return `${head}需要的话可以取出事之前那份恢复；如果已经恢复正常，确认后点「已处理」（之后的备份按当时的状况标注）。`;
	}
	return `${head}问题消失后会自动清掉；需要的话可以取出事之前那份恢复，确认已经处理好了也可以点「已处理」。`;
}

// 横幅里的存储提示文字(纯函数,单测锁)
export function memoryNoticeText(health){
	const h = health || {};
	if((h.corrupt || []).length){
		return `${h.corrupt.join('、')}的存储内容损坏，原内容已原样留档；本次运行新存的命盘 / 事盘只在内存，重启后会丢失。重启软件会尝试从影子副本找回（找不回就从空库开始，原内容仍在留档里）；也可以从最近的自动备份恢复。`;
	}
	if((h.corruptUnarchived || []).length){
		return `${h.corruptUnarchived.join('、')}的存储内容损坏，原内容没能另存留档（可能是存储空间不足），所以先不动它；本次运行新存的命盘 / 事盘只在内存，重启后会丢失。请先导出全量备份、清理一些数据后重启软件。`;
	}
	return '本地储存暂不可用：最新保存的命盘 / 事盘仅暂存于内存，重启后将丢失。请立即在「星盘列表 / 起课列表」导出 JSON 备份。';
}
export function corruptResetNoticeText(names){
	return `${(names || []).join('、')}的存储内容损坏：原内容已原样留档（可在星盘列表「数据管理 ▾」›「存储健康」里导出或删除）；没有可用的影子副本能找回，已从空库开始，之后新存的照常保存。可以从最近的自动备份或备份文件恢复。`;
}
export function unkeptNoticeText(count){
	return `本地存储空间不足：刚删除的 ${count} 条没能留进回收站或删除日志，删掉后在软件里找不回。请点「导出这些记录」留一份文件。`;
}
export const AHEAD_PAUSED_NOTE = '在你选择之前，这几个库暂停写影子副本（之后新存的记录没有影子保护）。';
export const CLEARED_SECURITY_NOTE = 'AI 助手权限类开关每项取本机与备份里较严的一档：备份里开着的不会自动打开，需要的话自己重开。';

// 导出「删掉了却没能留底」的记录:命盘 / 事盘各一个与单库备份同格式的 JSON 文件(可在列表里「导入本地备份」找回)
function exportUnkeptRecords(unkept){
	const pad = (n)=>String(n).padStart(2, '0');
	const now = new Date();
	const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	const exportedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
	[['chart', 'horosa-local-charts', 'charts', '命盘'], ['case', 'horosa-local-cases', 'cases', '事盘']].forEach(([store, format, field, name])=>{
		const list = (unkept && unkept[store]) || [];
		if(!list.length){ return; }
		const env = { format, version: 1, exportedAt, total: list.length, [field]: list };
		try{
			const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json;charset=utf-8' });
			saveBlobToBrowser(`${format}-deleted-${stamp}.json`, blob).then((r)=>{ const d = describeSaveResult(r, `已导出删掉的${name} ${list.length} 条`); (message[d.type] || message.info)(d.text); }).catch(()=>{ message.error(`导出删掉的${name}失败`); });
		}catch(e){
			message.error(`导出删掉的${name}失败`);
		}
	});
}

export default function LocalStoreHealthBanner(){
	const [health, setHealth] = React.useState({ memory: false, corrupt: [], corruptUnarchived: [], corruptReset: [], newer: null });
	const [reconcile, setReconcile] = React.useState(null);
	const [dismissed, setDismissed] = React.useState({});
	const [unkept, setUnkept] = React.useState({ chart: [], case: [] });
	const [incident, setIncident] = React.useState(null);
	const [rawUnarchived, setRawUnarchived] = React.useState([]);

	React.useEffect(()=>{
		if(typeof window === 'undefined'){ return undefined; }
		const refresh = ()=>{
			const h = readHealth();
			try{ observeBackupHealth(h.observed, h.incidentAt || undefined); }catch(e){ /* 记不下:下次自动备份时再记 */ }
			setHealth(h);
			setIncident(readBackupIncident());
		};
		const onIncident = ()=>setIncident(readBackupIncident());
		// 某项用户数据读不出来、又没能留档(空间不足):原串留着、暂不写入 —— 给一条提示,去存储健康页导出原内容
		const onRawUnarchived = ()=>{ try{ setRawUnarchived(listCorruptUnarchivedKeys()); }catch(e){ /* noop */ } setDismissed((x)=>({ ...x, rawUnarchived: false })); };
		const onReconciled = (evt)=>{
			setReconcile((evt && evt.detail) || null);
			refresh();
		};
		// 降级事件本身就是证据:查询健康态没看到(另一实例 / 事件先于状态落定)也照样显示
		const onDegraded = ()=>setHealth({ ...readHealth(), memory: true });
		const onUnkept = (evt)=>{
			const d = (evt && evt.detail) || {};
			const store = d.store === 'case' ? 'case' : 'chart';
			const recs = Array.isArray(d.records) ? d.records.filter((r)=>r && typeof r === 'object') : [];
			if(!recs.length){ return; }
			setUnkept((u)=>({ ...u, [store]: [...(u[store] || []), ...recs] }));
			setDismissed((x)=>({ ...x, unkept: false }));
		};
		window.addEventListener('horosa.localRecordStore.degraded', onDegraded);
		window.addEventListener('horosa.localRecordStore.newerSchema', refresh);
		window.addEventListener('horosa:record-store-corrupt-reset', refresh);
		window.addEventListener('horosa:record-store-unkept', onUnkept);
		window.addEventListener(SHADOW_RECONCILED_EVENT, onReconciled);
		window.addEventListener(BACKUP_INCIDENT_EVENT, onIncident);
		window.addEventListener(CORRUPT_UNARCHIVED_EVENT, onRawUnarchived);
		// 挂载补查:事件先于挂载时不丢状态
		refresh();
		try{ setRawUnarchived(listCorruptUnarchivedKeys()); }catch(e){ /* noop */ }
		// 全量恢复写完即刷新,结果带过刷新:这里弹一次(没有就不加载恢复流程那一块)
		if(hasCarriedRestoreResult()){
			import('../user/unifiedRestoreFlow').then((flow)=>flow.showCarriedRestoreResult()).catch(()=>{});
		}
		try{
			const s = getShadowMirrorStatus();
			if(s && s.lastReconcile){ setReconcile(s.lastReconcile); }
		}catch(e){ /* noop */ }
		return ()=>{
			window.removeEventListener('horosa.localRecordStore.degraded', onDegraded);
			window.removeEventListener('horosa.localRecordStore.newerSchema', refresh);
			window.removeEventListener('horosa:record-store-corrupt-reset', refresh);
			window.removeEventListener('horosa:record-store-unkept', onUnkept);
			window.removeEventListener(SHADOW_RECONCILED_EVENT, onReconciled);
			window.removeEventListener(BACKUP_INCIDENT_EVENT, onIncident);
			window.removeEventListener(CORRUPT_UNARCHIVED_EVENT, onRawUnarchived);
		};
	}, []);

	const ahead = reconcile && reconcile.ahead ? Object.keys(reconcile.ahead).filter((k)=>reconcile.ahead[k] > 0) : [];
	const notices = [];
	if(health.memory && !dismissed.memory){
		notices.push({ id: 'memory', text: memoryNoticeText(health) });
	}
	if((health.corruptReset || []).length && !dismissed.corruptReset){
		notices.push({
			id: 'corruptReset',
			text: corruptResetNoticeText(health.corruptReset),
			actions: [{ label: '从最近的自动备份恢复', run: ()=>restoreFromLatestAutoBackup(health.corruptResetAt || Date.now(), { preferHealthy: true }) }],
		});
	}
	const unkeptCount = (unkept.chart || []).length + (unkept.case || []).length;
	if(unkeptCount && !dismissed.unkept){
		notices.push({
			id: 'unkept',
			text: unkeptNoticeText(unkeptCount),
			actions: [{ label: '导出这些记录', run: ()=>exportUnkeptRecords(unkept) }],
			onDismiss: ()=>setUnkept({ chart: [], case: [] }),
		});
	}
	if(reconcile && (reconcile.corruptUnarchived || []).length && !dismissed.corruptUnarchived){
		notices.push({
			id: 'corruptUnarchived',
			text: `${reconcile.corruptUnarchived.map((k)=>STORE_NAMES[k] || '记录库').join('、')}的存储内容损坏：影子副本里有完好的一份，但原内容没能另存留档（可能是存储空间不足），所以先没有用影子写回。请先导出全量备份、清理一些数据，再重启软件。`,
		});
	}
	if(rawUnarchived.length && !dismissed.rawUnarchived){
		notices.push({
			id: 'rawUnarchived',
			text: `有 ${rawUnarchived.length} 项数据读不出来，本机存储又满了、没能另存留档：原内容留着没删，这几项暂时不写入。可在星盘列表「数据管理 ▾」›「存储健康」里导出原内容，再清理一些数据。`,
		});
	}
	if(reconcile && reconcile.storageCleared && !dismissed.cleared){
		notices.push({
			id: 'cleared',
			text: `本机存储像是被清空过：已从影子副本找回命盘 / 事盘库与回收站，但其余设置、删除日志、人生事件、AI 对话等不在影子副本里。最近的自动备份里有这些。${CLEARED_SECURITY_NOTE}`,
			actions: [{ label: '从最近的自动备份恢复', run: ()=>restoreFromLatestAutoBackup(reconcile.at, { preferHealthy: true }) }],
		});
	}
	if(ahead.length && !dismissed.ahead){
		const all = getShadowAhead();
		const names = ahead.map((k)=>`${STORE_NAMES[k] || k} ${reconcile.ahead[k]} 条`).join('、');
		const sample = ahead.flatMap((k)=>(all[k] || []).map((r)=>r && (r.name || r.event))).filter(Boolean).slice(0, 3);
		notices.push({
			id: 'ahead',
			text: `上次退出前最后的保存可能没写进本机存储：影子副本里还有 ${names}比本机新或本机没有${sample.length ? `（如「${sample.join('」「')}」）` : ''}。${AHEAD_PAUSED_NOTE}关掉这条提示后，可在星盘列表「数据管理 ▾」›「存储健康」里再选。`,
			actions: [
				{ label: '并回这些记录', run: ()=>{ const cids = shadowAheadCids(); const n = ahead.reduce((acc, k)=>{ const r = mergeShadowAhead(k); return r < 0 ? acc : acc + r; }, 0); if(ahead.some((k)=>getShadowAhead()[k])){ message.error('有一部分没能并回（可能是存储空间不足），影子副本里那份留着，可以清理后再试'); }else{ message.success(`已并回 ${n} 条`); setDismissed((d)=>({ ...d, ahead: true })); } emitRecordsChanged({ source: 'shadow-merge', cids }); } },
				{ label: '以本机为准', run: ()=>{ ahead.forEach((k)=>discardShadowAhead(k)); setDismissed((d)=>({ ...d, ahead: true })); } },
			],
		});
	}
	// 出过事(重启之后本次运行已不再报坏):持久标记还在 → 持续给「取出事之前那份」与「已处理」
	const liveIncident = health.memory || (health.corrupt || []).length || (health.corruptReset || []).length || (health.corruptUnarchived || []).length;
	if(incident && !liveIncident && !dismissed.incident){
		notices.push({
			id: 'incident',
			text: incidentNoticeText(incident),
			actions: [
				{ label: '从出事之前的自动备份恢复', run: ()=>restoreFromLatestAutoBackup(incident.at, { preferHealthy: true }) },
				{ label: '已处理', run: ()=>{ clearBackupIncident(); setIncident(null); setDismissed((d)=>({ ...d, incident: true })); } },
			],
		});
	}
	if(health.newer && !dismissed.newer){
		notices.push({
			id: 'newer',
			text: `读到更新版本的软件写的记录（记录版本 ${health.newer.found}，本软件 ${health.newer.current}）：能照常显示与保存，更新版本才有的内容在这里可能显示不全。建议升级到最新版本。`,
		});
	}
	if(!notices.length){ return null; }

	const wrapStyle = {
		position: 'fixed', top: 0, left: 0, right: 0,
		zIndex: 2001,
		display: 'flex', justifyContent: 'center',
		pointerEvents: 'none',
	};
	const barStyle = {
		marginTop: 44,
		maxWidth: '96%',
		padding: '8px 14px',
		borderRadius: 8,
		fontSize: 13,
		lineHeight: 1.4,
		color: '#7a4f01',
		background: 'rgba(255, 244, 222, 0.97)',
		border: '1px solid rgba(214, 158, 46, 0.55)',
		boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
		pointerEvents: 'auto',
		display: 'flex',
		flexDirection: 'column',
		gap: 6,
		cursor: 'default',
	};
	const rowStyle = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' };
	const btnStyle = {
		padding: '3px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
		border: '1px solid rgba(214, 158, 46, 0.7)',
		background: 'rgba(255, 255, 255, 0.7)',
		color: '#7a4f01',
	};

	return (
		<div style={wrapStyle} aria-live="polite">
			<div style={barStyle}>
				{notices.map((n)=>(
					<div key={n.id} style={rowStyle}>
						<span>💾⚠️ {n.text}</span>
						{(n.actions || []).map((a)=><button key={a.label} type="button" onClick={a.run} style={btnStyle}>{a.label}</button>)}
						<button type="button" onClick={()=>{ if(typeof n.onDismiss === 'function'){ n.onDismiss(); } setDismissed((d)=>({ ...d, [n.id]: true })); }} style={btnStyle}>知道了</button>
					</div>
				))}
			</div>
		</div>
	);
}

// 取 before 这一刻之前写的最近一份自动备份(存储被清空 = 启动之前;主存坏了从空库开始 = 发现坏了之前),
// 走与「恢复全量备份」同一套预览确认流程。opts.preferHealthy:有来源健康的就取最近一份健康的(出事之后写的标了 degraded)
export async function restoreFromLatestAutoBackup(before, opts){
	try{
		const ab = await import('../../utils/autoBackup');
		const latest = await ab.readLatestAutoBackup({ before, preferHealthy: !!(opts && opts.preferHealthy) });
		if(!latest){
			message.warning('没有找到出事之前的自动备份；可以在「星盘列表 › 恢复全量备份」里手动选一份备份文件');
			return;
		}
		const flow = await import('../user/unifiedRestoreFlow');
		await flow.runUnifiedRestoreFlow(latest.bytes, { title: `从自动备份恢复（${new Date(parseDateTimeMs(latest.at)).toLocaleString()}）` });
	}catch(e){
		message.error('读取自动备份失败；可以在「星盘列表 › 恢复全量备份」里手动选一份备份文件');
	}
}
