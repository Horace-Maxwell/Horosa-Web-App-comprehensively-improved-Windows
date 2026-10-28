// 档案库体检(Anki Check Database 范式):全库跑完整性检查出分项报告,
// 坏档给恢复指引。检查逻辑与各哨兵测试同判据 —— 这里是「用户可见的一键入口」。
// 全部检查只读,绝不修改数据;每项独立 try,单项炸不拖垮整个体检。
import { parseDateTimeMs } from './dateTimeParse';
import { listLocalCharts, listLocalChartsTrash } from './localcharts';
import { listLocalCases, listLocalCasesTrash } from './localcases';
import { collectBackupKeys } from './storageKeyRegistry';
import { getShadowMirrorStatus } from './shadowMirror';
import { getAutoBackupStatus, describeAutoBackupFailure } from './autoBackup';
import { listCorruptArchives } from './safeStorage';

function safeCount(fn){
	try{
		return fn();
	}catch(_e){
		return -1;
	}
}

function checkRecords(records, label){
	const issues = [];
	let payloadBad = 0;
	let groupBad = 0;
	const seen = new Set();
	records.forEach((r)=>{
		if(!r || !r.cid){
			issues.push(`${label}:存在缺 cid 的记录`);
			return;
		}
		if(seen.has(r.cid)){
			issues.push(`${label}:cid 重复 ${r.cid}`);
		}
		seen.add(r.cid);
		if(r.payload){
			try{
				JSON.parse(r.payload);
			}catch(_e){
				payloadBad += 1;
			}
		}
		if(r.group){
			try{
				const g = JSON.parse(r.group);
				if(!(g instanceof Array)){
					groupBad += 1;
				}
			}catch(_e){
				groupBad += 1;
			}
		}
	});
	if(payloadBad){
		issues.push(`${label}:${payloadBad} 条记录的技法数据(payload)无法解析`);
	}
	if(groupBad){
		issues.push(`${label}:${groupBad} 条记录的标签数据无法解析`);
	}
	return issues;
}

// 返回 [{name, ok, detail}]:ok=true 绿行;false 黄/红行(detail 给人话与指引)。
export function runArchiveHealthCheck(){
	const rows = [];
	// ① 记录体完整性
	try{
		const charts = listLocalCharts({ includeArchived: true });
		const cases = listLocalCases({ includeArchived: true });
		const issues = [...checkRecords(charts, '命盘'), ...checkRecords(cases, '事盘')];
		rows.push({
			name: '记录完整性',
			ok: !issues.length,
			detail: issues.length ? issues.join('；') : `命盘 ${charts.length} 条、事盘 ${cases.length} 条全部结构合法`,
		});
	}catch(e){
		rows.push({ name: '记录完整性', ok: false, detail: '检查本身失败（库可能损坏），建议立即从最近备份恢复' });
	}
	// ② 回收站与主库互斥(同 cid 同时在两边=异常态)
	try{
		const mainIds = new Set([...listLocalCharts({ includeArchived: true }), ...listLocalCases({ includeArchived: true })].map((r)=>r.cid));
		const ghosts = [...listLocalChartsTrash(), ...listLocalCasesTrash()].filter((r)=>r && mainIds.has(r.cid));
		rows.push({
			name: '回收站一致性',
			ok: !ghosts.length,
			detail: ghosts.length ? `${ghosts.length} 条记录同时存在于主库与回收站（可在回收站将其彻底删除以消除重影）` : '回收站与主库无重影',
		});
	}catch(e){
		rows.push({ name: '回收站一致性', ok: false, detail: '检查失败' });
	}
	// ③ 影子副本
	try{
		const s = getShadowMirrorStatus();
		if(!s.enabled){
			rows.push({ name: '影子副本', ok: true, detail: '未启用（浏览器环境或独立实例窗口），跳过' });
		}else{
			const div = (s.lastReconcile && s.lastReconcile.diverged) || [];
			const held = Array.isArray(s.held) ? s.held : [];
			// 每次保存都同步镜像,正常运行下两边不该不一致:不一致多半是上次保存后立刻退出、本机存储没来得及落盘
			rows.push({
				name: '影子副本',
				ok: !s.lastMirrorError && !held.length,
				// 壳层原始报错(英文 / 系统错误码)不直出,进诊断包;这里只说人话
				detail: s.lastMirrorError ? '最近一次镜像没写成（可能是磁盘满或没有写权限），原始错误见诊断包' : (div.length ? `启动时镜像与本机数据有 ${div.length} 处不一致（上次退出前的保存可能没写进本机存储）${held.length ? '；影子副本里较新的记录还留着，可在顶部提示或「数据管理 ▾」›「存储健康」里并回或以本机为准' : '；影子副本里没有比本机更新的记录，以本机为准'}` : '镜像正常'),
			});
		}
	}catch(e){
		rows.push({ name: '影子副本', ok: false, detail: '检查失败' });
	}
	// ④ 备份健康
	try{
		const ab = getAutoBackupStatus();
		if(!ab.enabled){
			rows.push({ name: '自动备份', ok: true, detail: '未启用（浏览器环境），跳过；请定期手动导出全量备份' });
		}else if(!ab.last){
			rows.push({ name: '自动备份', ok: true, detail: '已启用，尚未执行首轮（启动 5 分钟后开始）' });
		}else{
			const okRow = !!ab.last.ok && (!ab.last.oldestVerified || ab.last.oldestVerified.ok !== false);
			rows.push({
				name: '自动备份',
				ok: okRow,
				detail: okRow ? `最近备份成功（${new Date(parseDateTimeMs(ab.last.at)).toLocaleString()}）`
					: (!ab.last.ok ? `最近一次备份${describeAutoBackupFailure(ab.last.reason)}；建议先手动导出一份全量备份` : '最老一份备份抽验没通过，建议立即手动导出一份全量备份'),
			});
		}
	}catch(e){
		rows.push({ name: '自动备份', ok: false, detail: '检查失败' });
	}
	// ⑤ 损坏内容留档:某项数据读不出来时原样另存的一份,占本机存储空间、随备份走;在「存储健康」里可导出或删除
	try{
		const arch = listCorruptArchives();
		const size = arch.reduce((acc, a)=>acc + (a.size || 0), 0);
		rows.push({
			name: '损坏内容留档',
			ok: !arch.length,
			detail: arch.length ? `有 ${arch.length} 份（约 ${Math.max(1, Math.round(size / 1024))} KB），某项数据读不出来时原样另存的；可在「数据管理 ▾」›「存储健康」里导出为文件，确认不需要后删除` : '没有',
		});
	}catch(e){
		rows.push({ name: '损坏内容留档', ok: false, detail: '检查失败' });
	}
	// ⑥ 未登记键(运行时防呆的可见化:有=会被备份带走但应尽快登记分类)
	try{
		const { unknownKeys } = collectBackupKeys();
		rows.push({
			name: '存储键登记',
			ok: !unknownKeys.length,
			detail: unknownKeys.length ? `发现 ${unknownKeys.length} 个未登记数据键（备份会按用户数据带走，不丢失）` : '全部数据键已登记分类',
		});
	}catch(e){
		rows.push({ name: '存储键登记', ok: false, detail: '检查失败' });
	}
	// ⑦ 规模概览(纯信息行,恒 ok)
	rows.push({
		name: '库规模',
		ok: true,
		detail: `命盘 ${safeCount(()=>listLocalCharts({ includeArchived: true }).length)} · 事盘 ${safeCount(()=>listLocalCases({ includeArchived: true }).length)} · 回收站 ${safeCount(()=>listLocalChartsTrash().length + listLocalCasesTrash().length)}`,
	});
	return rows;
}
