// [V5-A6/A7] 存储健康页:本地数据的可自证状态一览 + 一键诊断包。
// 显示:持久化授予(persist)/影子副本状态/存储用量/记录库规模;桌面端可导出诊断包。
import React, { useEffect, useState } from 'react';
import { Modal, Descriptions, Button, message } from 'antd';
import { safeLocalStorageGet } from '../../utils/safeStorage';
import { getShadowMirrorStatus } from '../../utils/shadowMirror';
import { listLocalCharts, listLocalChartsTrash } from '../../utils/localcharts';
import { listLocalCases, listLocalCasesTrash } from '../../utils/localcases';
import { isDesktopBridgeAvailable, invokeDesktopCommand } from '../../utils/aiAnalysisDesktop';
import { getAutoBackupStatus } from '../../utils/autoBackup';
import { runArchiveHealthCheck } from '../../utils/archiveHealthCheck';
import { remindersEnabled, setRemindersEnabled } from '../../utils/upcomingReminders';

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
					<Button key='diag' loading={exporting} onClick={exportDiagnostics}>导出诊断包</Button>
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
						? `已启用（记录库/回收站每次保存同步镜像到本机应用数据目录）${reconcile.restored && reconcile.restored.length ? ` · 本次启动已恢复 ${reconcile.restored.length} 项` : ''}${reconcile.diverged && reconcile.diverged.length ? ' · 检测到镜像与当前数据不一致（以当前数据为准）' : ''}`
						: '未启用（浏览器环境或独立实例窗口）'}
				</Descriptions.Item>
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
							return '已启用（每 30 分钟自动备份到「文稿/Horosa Backups」；尚未执行首轮）';
						}
						const when = new Date(ab.last.at).toLocaleString();
						const base = ab.last.ok ? `上次成功：${when}${ab.last.verified ? '（已自验）' : ''}` : `上次失败：${when}`;
						const deep = ab.last.oldestVerified ? ` · 最老备份抽验：${ab.last.oldestVerified.ok ? '通过' : '⚠ 未通过'}` : '';
						return `${base}${deep}`;
					})()}
				</Descriptions.Item>
			</Descriptions>
			{/* [V5-D15] 生日/整寿提醒开关(用户明令可开关;默认关)。开=每次启动扫未来 7 天生日弹卡片。 */}
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
