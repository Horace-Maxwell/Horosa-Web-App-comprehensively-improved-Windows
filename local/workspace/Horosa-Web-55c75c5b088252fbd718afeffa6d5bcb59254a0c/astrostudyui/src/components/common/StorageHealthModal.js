// 存储健康页:本地数据的可自证状态一览 + 一键诊断包。
// 显示:持久化授予(persist)/影子副本状态/存储用量/记录库规模;桌面端可导出诊断包。
// 另有两处要用户决定的:影子副本里较新的记录(顶部提示关掉后,在这里并回或以本机为准);
// 损坏内容留档(某项数据读不出来时原样另存的一份:可导出为文件、确认不需要后删除)。
import { parseDateTimeMs } from '../../utils/dateTimeParse';
import React, { useEffect, useState } from 'react';
import { Modal, Descriptions, Button, Tooltip, Popconfirm, message } from 'antd';
import { safeLocalStorageGet, listCorruptArchives, removeCorruptArchive, listCorruptUnarchivedKeys, abandonCorruptUnarchived } from '../../utils/safeStorage';
import { getShadowMirrorStatus, getShadowAhead, mergeShadowAhead, discardShadowAhead, shadowAheadCids } from '../../utils/shadowMirror';
import { listLocalCharts, listLocalChartsTrash } from '../../utils/localcharts';
import { listLocalCases, listLocalCasesTrash } from '../../utils/localcases';
import { isDesktopBridgeAvailable, invokeDesktopCommand } from '../../utils/aiAnalysisDesktop';
import { getAutoBackupStatus, describeAutoBackupFailure } from '../../utils/autoBackup';
import { saveBlobToBrowser, describeSaveResult } from '../../utils/aiAnalysisExport';
import { emitRecordsChanged } from '../../utils/recordStoreNotice';
import { readBackupIncident, clearBackupIncident } from '../../utils/backupIncident';
import { classifyStorageKey } from '../../utils/storageKeyRegistry';
import { runArchiveHealthCheck } from '../../utils/archiveHealthCheck';
import { remindersEnabled, setRemindersEnabled } from '../../utils/upcomingReminders';

const SHADOW_STORE_NAMES = {
	'horosa.localCharts.v1': '命盘库',
	'horosa.localCases.v1': '事盘库',
	'horosa.localCharts.trash.v1': '命盘回收站',
	'horosa.localCases.trash.v1': '事盘回收站',
};

// 留档来自哪项数据(中文名;没登记的写「其它数据」)
export function corruptArchiveSourceLabel(sourceKey){
	if(SHADOW_STORE_NAMES[sourceKey]){ return SHADOW_STORE_NAMES[sourceKey]; }
	if(sourceKey === 'horosa.deleted.log.v1'){ return '删除日志'; }
	const e = classifyStorageKey(sourceKey);
	const label = e && e.label ? `${e.label}` : '其它数据';
	const cut = label.indexOf('(');
	return cut > 0 ? label.slice(0, cut) : label;
}

// 留档时刻串 YYYYMMDD-HHmmss-SSS → 「YYYY-MM-DD HH:mm:ss」
function fmtArchiveAt(at){
	const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(`${at || ''}`);
	return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : '';
}

function exportCorruptArchive(a){
	const text = safeLocalStorageGet(a.key);
	if(text === null){
		message.warning('这份留档已经不在了');
		return;
	}
	const stamp = `${a.at || ''}`.replace(/[^0-9-]/g, '');
	const name = `horosa-damaged-${`${a.sourceKey || 'data'}`.replace(/[^A-Za-z0-9._-]/g, '_')}-${stamp || 'copy'}.txt`;
	try{
		const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
		saveBlobToBrowser(name, blob).then((r)=>{ const d = describeSaveResult(r, '已导出这份留档'); (message[d.type] || message.info)(d.text); }).catch(()=>message.error('导出失败'));
	}catch(e){
		message.error('导出失败');
	}
}

function fmtBytes(n){
	if(!Number.isFinite(n) || n <= 0){
		return '未知';
	}
	if(n > 1024 * 1024){
		return `${(n / 1024 / 1024).toFixed(1)} MB`;
	}
	return `${Math.round(n / 1024)} KB`;
}

export default function StorageHealthModal({ visible, onClose }){
	const [estimate, setEstimate] = useState(null);
	const [exporting, setExporting] = useState(false);
	const [checkRows, setCheckRows] = useState(null);
	const [, setTick] = useState(0);
	const bump = ()=>setTick((t)=>t + 1);

	useEffect(()=>{
		if(!visible){
			return;
		}
		try{
			if(navigator.storage && navigator.storage.estimate){
				navigator.storage.estimate().then(setEstimate).catch(()=>setEstimate(null));
			}
		}catch(_e){
			setEstimate(null);
		}
	}, [visible]);

	if(!visible){
		return null;
	}
	const persisted = safeLocalStorageGet('horosa.storage.persisted');
	const shadow = getShadowMirrorStatus();
	const charts = listLocalCharts().length;
	const cases = listLocalCases().length;
	const trash = listLocalChartsTrash().length + listLocalCasesTrash().length;
	const reconcile = shadow.lastReconcile || {};
	const held = Array.isArray(shadow.held) ? shadow.held : [];
	let aheadMap = {};
	try{ aheadMap = getShadowAhead() || {}; }catch(e){ aheadMap = {}; }
	const archives = listCorruptArchives();
	const unarchived = listCorruptUnarchivedKeys();
	const incident = readBackupIncident();

	function mergeHeld(){
		const cids = shadowAheadCids();
		const n = held.reduce((acc, k)=>{ const r = mergeShadowAhead(k); return r < 0 ? acc : acc + r; }, 0);
		const left = getShadowAhead();
		if(held.some((k)=>left[k])){
			message.error('有一部分没能并回（可能是存储空间不足），影子副本里那份留着，可以清理后再试');
		}else{
			message.success(`已并回 ${n} 条`);
		}
		emitRecordsChanged({ source: 'shadow-merge', cids });
		bump();
	}
	function discardHeld(){
		held.forEach((k)=>discardShadowAhead(k));
		message.success('已以本机为准，影子副本恢复同步');
		bump();
	}

	async function exportDiagnostics(){
		setExporting(true);
		try{
			const path = await invokeDesktopCommand('export_diagnostics_bundle', {});
			message.success(`诊断包已导出：${path}`);
		}catch(e){
			message.error('诊断包导出失败');
		}finally{
			setExporting(false);
		}
	}

	return (
		<Modal
			visible={visible}
			title='存储健康'
			width={520}
			onCancel={onClose}
			footer={[
				<Button key='check' onClick={()=>setCheckRows(runArchiveHealthCheck())}>运行体检</Button>,
				isDesktopBridgeAvailable() ? (
					<Tooltip key='diag' title='打包本机日志 / 动作账本 / 更新历史供排障;写入前自动脱敏(接口 Key、令牌、授权头等密钥体一律打码)'>
						<Button loading={exporting} onClick={exportDiagnostics}>导出诊断包(已脱敏)</Button>
					</Tooltip>
				) : null,
				<Button key='close' type='primary' onClick={onClose}>关闭</Button>,
			]}
		>
			<Descriptions column={1} size='small' bordered>
				<Descriptions.Item label='记录库规模'>{`命盘 ${charts} 条 · 事盘 ${cases} 条 · 回收站 ${trash} 条`}</Descriptions.Item>
				<Descriptions.Item label='持久化保护'>
					{persisted === '1' ? '已授予（磁盘紧张时本地数据免于被系统清理）' : persisted === '0' ? '未授予（由系统决定；建议定期导出备份）' : '未知'}
				</Descriptions.Item>
				<Descriptions.Item label='影子副本'>
					{shadow.enabled
						? `已启用（记录库/回收站每次保存同步镜像到本机应用数据目录）${reconcile.restored && reconcile.restored.length ? ` · 本次启动已恢复 ${reconcile.restored.length} 项` : ''}${reconcile.diverged && reconcile.diverged.length ? ` · 启动时检测到镜像与本机数据不一致（上次退出前的保存可能没写进本机存储${held.length ? '；影子副本里较新的记录还留着，见下方' : '；以本机为准'}）` : ''}`
						: '未启用（浏览器环境或独立实例窗口）'}
					{held.length ? (
						<div data-shadow-held="1" style={{ marginTop: 6 }}>
							<div style={{ marginBottom: 4 }}>
								{`影子副本里还有 ${held.map((k)=>`${SHADOW_STORE_NAMES[k] || '记录库'} ${(aheadMap[k] || []).length} 条`).join('、')}比本机新或本机没有。选择之前，这几个库暂停写影子副本（之后新存的记录没有影子保护）。`}
							</div>
							<Button size='small' style={{ marginRight: 8 }} onClick={mergeHeld}>并回这些记录</Button>
							<Button size='small' onClick={discardHeld}>以本机为准</Button>
						</div>
					) : null}
				</Descriptions.Item>
				{unarchived.length ? (
					<Descriptions.Item label='没能留档的损坏数据'>
						<div style={{ marginBottom: 4 }}>这几项数据读不出来，本机存储又满了、没能另存留档：原内容原样留着没删，这几项暂时不写入（免得盖掉唯一的一份）。请先导出原内容，再清理一些数据；腾出空间后会自动另存留档并恢复写入。也可以导出后放弃本机这份，这一项立刻恢复写入。</div>
						{unarchived.map((u)=>(
							<div key={u.key} data-corrupt-unarchived={u.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
								<span style={{ flex: 1 }}>{`${corruptArchiveSourceLabel(u.key)} · ${u.size * 2 < 1024 ? '不到 1 KB' : fmtBytes(u.size * 2)}`}</span>
								<Button size='small' onClick={()=>exportCorruptArchive({ key: u.key, sourceKey: u.key, at: '' })}>导出原内容</Button>
								<Popconfirm title='放弃之后本机就没有这份原内容了，只剩你导出的文件。确定已经导出、放弃本机这份？' onConfirm={()=>{ if(abandonCorruptUnarchived(u.key)){ message.success('已放弃本机这份，这一项恢复写入'); }else{ message.error('没能放弃'); } bump(); }}>
									<Button size='small' danger>已导出，放弃本机这份</Button>
								</Popconfirm>
							</div>
						))}
					</Descriptions.Item>
				) : null}
				{archives.length ? (
					<Descriptions.Item label='损坏内容留档'>
						<div style={{ marginBottom: 4 }}>某项数据读不出来时原样另存的一份（占本机存储空间，也随备份带走）。可导出为文件留着；确认不需要后删除。</div>
						{archives.map((a)=>(
							<div key={a.key} data-corrupt-archive={a.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
								<span style={{ flex: 1 }}>{`${corruptArchiveSourceLabel(a.sourceKey)} · ${fmtArchiveAt(a.at) || '时间不明'} · ${a.size * 2 < 1024 ? '不到 1 KB' : fmtBytes(a.size * 2)}`}</span>
								<Button size='small' onClick={()=>exportCorruptArchive(a)}>导出为文件</Button>
								<Popconfirm title='删掉这份留档后就找不回里面的原内容了，建议先导出。确定删除？' onConfirm={()=>{ if(removeCorruptArchive(a.key)){ message.success('已删除这份留档'); }else{ message.error('没能删除'); } bump(); }}>
									<Button size='small' danger>删除</Button>
								</Popconfirm>
							</div>
						))}
					</Descriptions.Item>
				) : null}
				{incident ? (
					<Descriptions.Item label='出过事的标记'>
						<div data-backup-incident="1" style={{ marginBottom: 4 }}>{`${new Date(parseDateTimeMs(incident.at)).toLocaleString()} 起${incident.sections.map((x)=>({ charts: '命盘库', cases: '事盘库', aiWorkspace: 'AI 分析工作区' }[x] || x)).join('、')}出过问题：之后写的自动备份都标了「来源不健康」，修剪时出事之前最近一份完整的备份一直留着。成功恢复这几部分后自动清掉；确认已经处理好了也可以点「已处理」。`}</div>
						<Button size='small' onClick={()=>{ clearBackupIncident(); message.success('已清掉出过事的标记，之后的自动备份按当时的状况标注'); bump(); }}>已处理</Button>
					</Descriptions.Item>
				) : null}
				<Descriptions.Item label='存储用量'>
					{estimate ? `${fmtBytes(estimate.usage)} / 配额 ${fmtBytes(estimate.quota)}` : '未知'}
				</Descriptions.Item>
				<Descriptions.Item label='自动备份'>
					{(()=>{
						const ab = getAutoBackupStatus();
						if(!ab.enabled){
							return '未启用（浏览器环境或独立实例窗口）';
						}
						if(!ab.last){
							return '已启用（每 30 分钟自动备份到「文稿/Horosa Backups」里以本应用命名的子文件夹；尚未执行首轮）';
						}
						const when = new Date(parseDateTimeMs(ab.last.at)).toLocaleString();
						const deep = ab.last.oldestVerified ? ` · 最老备份抽验：${ab.last.oldestVerified.ok ? '通过' : '⚠ 未通过'}` : '';
						if(ab.last.ok){
							return `上次成功：${when}${ab.last.verified ? '（已自验）' : ''}${deep}`;
						}
						// 失败原因说人话(没有「文稿」文件夹的访问权限要单独说清怎么开);原始错误放悬停提示
						return <span title={ab.last.reason ? `${ab.last.reason}` : undefined}>{`上次失败：${when} · ${describeAutoBackupFailure(ab.last.reason)}${deep}`}</span>;
					})()}
				</Descriptions.Item>
			</Descriptions>
			{/* 生日/整寿提醒开关(用户明令可开关;默认关)。开=每次启动扫未来 7 天生日弹卡片。 */}
			<div style={{ marginTop: 10, display: 'flex', alignItems: 'center' }}>
				<span style={{ flex: 1 }}>生日 / 整寿提醒（启动时提示未来 7 天内生日，逢十标整寿）</span>
				<Button size='small' onClick={()=>{ setRemindersEnabled(!remindersEnabled()); setEstimate((v)=>({ ...(v || {}) })); }}>
					{remindersEnabled() ? '已开启（点击关闭）' : '已关闭（点击开启）'}
				</Button>
			</div>
			{checkRows ? (
				<div style={{ marginTop: 12 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>体检结果</div>
					{checkRows.map((r)=>(
						<div key={r.name} style={{ padding: '4px 0', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
							<span style={{ marginRight: 6 }}>{r.ok ? '✅' : '⚠️'}</span>
							<span style={{ fontWeight: 500, marginRight: 8 }}>{r.name}</span>
							<span style={{ opacity: 0.85 }}>{r.detail}</span>
						</div>
					))}
				</div>
			) : null}
		</Modal>
	);
}
