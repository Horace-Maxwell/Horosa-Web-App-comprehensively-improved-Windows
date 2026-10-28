import React from 'react';
import { Modal, message, Checkbox } from 'antd';
import { runAutoBackupOnce } from '../../utils/autoBackup';
import { freezeGlobalSetupWrites, thawGlobalSetupWrites } from '../../utils/globalSetupStore';
import { stashRestoreResult, takeRestoreResult } from '../../utils/restoreResultCarry';
import { emitRecordsChanged } from '../../utils/recordStoreNotice';

// 校验结果的提示(两条可同时出现:来自更新版本 + 有部分损坏)
export function restoreCheckNotes(check){
	const reasons = check ? (Array.isArray(check.reasons) ? check.reasons : (check.reason ? [check.reason] : [])) : [];
	const out = [];
	if(reasons.indexOf('newer-version') >= 0){ out.push('注意：该备份来自更新版本，可能含无法完整导入的数据。'); }
	if(reasons.indexOf('checksum-bad') >= 0){
		const n = Array.isArray(check.badSections) ? check.badSections.length : 0;
		out.push(`注意：备份文件里有${n ? ` ${n} ` : ''}部分已损坏（校验和不符），这几部分会跳过、本机数据不动，其余照常恢复（见下方列表）。`);
	}
	return out;
}

// 恢复确认框的内容:逐项预览 + 「同一 ID 一律用备份里的」勾选(缺省不勾;勾上后预览按这个口径重算)。
// onChange(opts) 把当前选择交给确认按钮(onOk 读同一份)
export function RestorePreview({ ub, manifest, check, onChange }){
	const [useBackup, setUseBackup] = React.useState(false);
	const opts = useBackup ? { sameCid: 'backup' } : {};
	let rows = [];
	try{ rows = ub.previewUnifiedRestore(manifest, opts); }catch(e){ rows = []; }
	return (
		<div>
			{restoreCheckNotes(check).map((t)=><p key={t} style={{ color: 'var(--horosa-warn)' }}>{t}</p>)}
			<ul style={{ paddingLeft: 18 }}>
				{rows.map((r)=><li key={r.key} title={r.title || undefined}>{r.label}：{r.detail}</li>)}
			</ul>
			<p>{restoreNoteText(manifest, opts)}</p>
			<Checkbox
				checked={useBackup}
				onChange={(e)=>{ const on = !!(e && e.target && e.target.checked); setUseBackup(on); if(typeof onChange === 'function'){ onChange(on ? { sameCid: 'backup' } : {}); } }}
			>同一 ID 的命盘 / 事盘一律用备份里的（回到这份备份时的样子；本机较新的版本会被替换，仍可从版本历史找回）</Checkbox>
		</div>
	);
}

// 全量备份恢复的界面流程(单源):星盘列表「恢复全量备份」与存储横幅「从最近的自动备份恢复」共用。
// 三闸:解析校验(格式防呆,AI 工作区备份指路)→ 逐项预览确认 → 风险前自动备份 + 执行 + 分项结果。
// opts.onAfterRestore():恢复执行完、刷新页面前回调(列表刷新等)。opts.title:确认框标题。
export async function runUnifiedRestoreFlow(blobOrFile, opts = {}){
	try{
		const ub = await import('../../utils/unifiedBackup');
		const manifest = await ub.parseUnifiedBackupBlob(blobOrFile);
		if(!manifest){
			message.error('备份文件无法解析（不是有效的 zip 备份）');
			return;
		}
		const check = ub.validateUnifiedBackup(manifest);
		if(!check.ok){
			message.error(check.reason === 'format-mismatch' ? '不是星阙全量备份文件（若是 AI 分析工作区备份，请到 AI 分析页恢复）' : '备份文件内容无效');
			return;
		}
		let restoreOpts = {};
		Modal.confirm({
			title: opts.title || '恢复全量备份',
			width: 560,
			content: <RestorePreview ub={ub} manifest={manifest} check={check} onChange={(o)=>{ restoreOpts = o || {}; }} />,
			okText: '恢复',
			cancelText: '取消',
			onOk: async ()=>{
				// 恢复=整值替换级风险操作,先落一份自动备份(失败不阻断,恢复本身仍有预览确认)。
				await runAutoBackupOnce({ trigger: 'pre-risk' }).catch(()=>{});
				// 恢复执行起,内存态与存储就对不上了:冻结全局设置落盘(否则途中 / 之后任何一次 app/save 会拿恢复前的内存态写回)。
				// 之后要么立即刷新(解冻随页面重载),要么记录只在内存不刷新(冻结保持到重启:恢复写进去的设置重启后生效)
				freezeGlobalSetupWrites('unified-restore');
				let results = null;
				try{
					results = await ub.restoreUnifiedBackup(manifest, restoreOpts);
				}catch(e){
					thawGlobalSetupWrites();
					message.error('恢复失败');
					return;
				}
				finishUnifiedRestore(ub, results, opts);
			},
		});
	}catch(e){
		message.error('恢复失败');
	}
}

// 恢复写完之后(单源;测试直接调):
//   · 命盘 / 事盘只进了内存(本机存储不可用)→ 不刷新(刷新 = 只在内存里的恢复结果当场丢),全局设置落盘保持冻结,写明重启后生效;
//   · 全部成功 → **立即刷新**:恢复写进去的 40 多项设置要整页重载才对齐;结果先存进 sessionStorage,刷新后由 showCarriedRestoreResult 弹出;
//   · 有失败项 → 先不刷新,当场逐条列出失败的每一项(中文名:说明),「刷新页面」按钮关框即刷新(框只能经它关);
//     刷新不再取决于用户点哪个钮(此前失败框只有点「知道了」才刷新,按 Esc / 点遮罩关掉就一直不刷新,恢复的设置随后被旧内存态盖回);
//   · sessionStorage 存不进 → 退回先弹结果框:Esc / 点遮罩关不掉,关框之后(afterClose)刷新恰好一次。
// opts.reload:换掉整页刷新(测试用)
export function finishUnifiedRestore(ub, results, opts = {}){
	const list = Array.isArray(results) ? results : [];
	const bad = list.filter((r)=>r && !r.ok);
	const sessionOnly = list.some((r)=>r && r.sessionOnly);
	let reloaded = false;
	const reload = ()=>{
		if(reloaded){ return; }
		reloaded = true;
		if(typeof opts.reload === 'function'){ opts.reload(); return; }
		if(typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function'){
			try{ window.location.reload(); }catch(e){ /* ignore */ }
		}
	};
	try{ if(typeof opts.onAfterRestore === 'function'){ opts.onAfterRestore(list); } }catch(e){ /* 列表刷新失败不影响恢复结果 */ }
	// 不立刻刷新的路径(记录只进了内存 / 有失败项先列结果):被恢复换掉的记录按记录号广播,当前载入的正是那条 → 按库里新版重设
	// (与单库导入同口径;否则屏幕上仍是恢复前那版,这次运行里一保存就写回旧版)。立刻刷新的路径刷新后自然是新版,不广播
	const announceChanged = ()=>{ announceRestoredRecords(list); };
	if(sessionOnly){
		announceChanged();
		Modal.warning({
			title: '恢复的记录只在本次运行有效',
			content: `本机存储不可用，${list.filter((r)=>r.sessionOnly).map((r)=>r.detail).join('；')}。页面没有刷新；恢复写进去的设置重启软件后生效（在那之前界面上改的全局设置不会保存）。请先在列表里导出一份备份，排查存储后再恢复。`,
		});
		return { reloaded: false, sessionOnly: true };
	}
	const carried = { bad: bad.map((r)=>({ key: r.key, label: r.label || '', detail: r.detail || '' })) };
	// 有失败项:先不刷新,当场逐条列出(中文名:说明),由「刷新页面」按钮刷新 —— 刷新前看得清哪几项没成;
	// 框只能经这个按钮关(Esc / 遮罩 / 右上角都关不掉),关框后刷新恰好一次;全局设置落盘在此期间保持冻结
	if(!bad.length && stashRestoreResult(carried)){
		reload();
		return { reloaded: true, carried: true };
	}
	// 有失败项,或 sessionStorage 存不进:先弹结果框,关框后刷新(无论怎么关,刷新恰好一次)
	announceChanged();
	Modal[bad.length ? 'warning' : 'success']({
		title: bad.length ? '恢复完成，但有几项没有完全成功' : '全量恢复完成',
		content: bad.length ? restoreResultList(ub, bad) : '点「刷新页面」让恢复的设置生效。',
		okText: '刷新页面',
		keyboard: false,
		maskClosable: false,
		closable: false,
		afterClose: reload,
	});
	return { reloaded: false, carried: false };
}

// 恢复结果行里命盘 / 事盘两段的 changedCids → horosa:records-changed(source:'restore')
export function announceRestoredRecords(results){
	(Array.isArray(results) ? results : []).forEach((r)=>{
		if(!r || (r.key !== 'charts' && r.key !== 'cases')){ return; }
		const cids = Array.isArray(r.changedCids) ? r.changedCids : [];
		if(!cids.length){ return; }
		emitRecordsChanged({ store: r.key === 'charts' ? 'chart' : 'case', cids, source: 'restore' });
	});
}

function restoreResultList(ub, bad){
	return (
		<ul style={{ paddingLeft: 18, marginBottom: 0 }}>
			{bad.map((r)=><li key={r.key}>{restoreFailureLine(ub, r)}</li>)}
		</ul>
	);
}

// 刷新之后:有恢复带过来的结果就弹一次(失败项逐条列出;全部成功只提示一句)。启动时由存储横幅调用;返回是否弹了
export function showCarriedRestoreResult(){
	const carried = takeRestoreResult();
	if(!carried){ return false; }
	const bad = carried.bad || [];
	if(bad.length){
		Modal.warning({ title: '恢复完成，但有几项没有完全成功', content: restoreResultList(null, bad), okText: '知道了' });
	}else{
		message.success('全量恢复完成');
	}
	return true;
}

// 失败行:「中文名：说明」
export function restoreFailureLine(ub, r){
	const label = (r && r.label) || (ub && typeof ub.restoreRowLabel === 'function' ? ub.restoreRowLabel(r && r.key) : '') || '某项数据';
	return `${label}：${(r && r.detail) || '没有写进'}`;
}

// 确认框底部的说明(与恢复语义同口径)。opts.sameCid === 'backup':勾了「同一 ID 一律用备份里的」
export function restoreNoteText(manifest, opts){
	const useBackup = !!(opts && opts.sameCid === 'backup');
	const records = useBackup
		? '命盘 / 事盘不删现有记录；同一 ID 的两份一律用备份里的那一版（整条替换，含置顶、星标等列表状态）'
		: '命盘 / 事盘不删现有记录；同一 ID 的两份，更新时间较新的那份整条保留（本机较新或一样新的保留本机的；置顶、星标、归档等列表状态留本机的）';
	const settings = `设置类整值替换${manifest && manifest.settingsComplete === true ? '，备份里没有的设置项（来源为默认）本机复位默认' : ''}`;
	const tail = useBackup
		? '恢复前会先自动备份一次当前数据（桌面版主窗口）；被替换的本机版本可从版本历史找回。'
		: '恢复前会先自动备份一次当前数据（桌面版主窗口）。恢复较早的备份不会改回已被较新版本替换的盘；要整份回到这份备份时的样子，请勾选下面的「同一 ID 的命盘 / 事盘一律用备份里的」。';
	return `${records}；本机在这份备份之后删掉的不带回。${settings}；AI 助手权限类开关每项取本机与备份里较严的一档，不会放宽本机。${tail}`;
}
