import { parseDateTimeMs } from '../../utils/dateTimeParse';
import { Component } from 'react';
import { Popconfirm, message, Modal, Dropdown, Checkbox, } from 'antd';
import * as AstroText from '../../constants/AstroText';
import {TableOddRowBgColor, } from '../../utils/constants';
import EditableTags from '../comp/EditableTags';
import { exportLocalChartsBackup, importLocalChartsBackup, listLocalChartTags, validateLocalChartsBackup, previewLocalChartsBackup, listLocalChartsTrash, restoreLocalChartFromTrash, restoreLocalChartFromDeletedLog, purgeLocalChartTrashItem, clearLocalChartsTrash, listLocalCharts, upsertLocalChart, removeLocalChart, pinLocalChart, moveLocalChart, flagLocalChart, setLocalChartTags, countLocalChartsLiveTrash, LOCAL_CHARTS_TRASH_CAP } from '../../utils/localcharts';
import { prepareCelebrityChartsImport } from '../../utils/astrodata/celebrityDedupe';
import { toRecordCopy, parseGroupTags, countDeletedLogEntries, DELETED_LOG_CAP } from '../../utils/localRecordStore';
import { withNewChartDefaults } from '../../utils/newChartCapture';
import { toastRecordWrite, runRecordBatch, toastRecordBatch, toastRecordImport, toastTrashPurge, RECORD_BATCH_DELETE_NOT_PERSISTED_NOTE, emitRecordsChanged } from '../../utils/recordStoreNotice';
import { XQButton, XQPagination, XQSearch, XQSelect, XQTable } from '../xq-ui';
import { shouldSkipDeleteConfirm, setSkipDeleteConfirm, clearSkipDeleteConfirm } from '../../utils/uiPrefs';
import StorageHealthModal from '../common/StorageHealthModal';
import { RecordLinkModal, DuplicateMergeModal } from '../common/RecordToolsModals';
import { runAutoBackupOnce, getAutoBackupStatus } from '../../utils/autoBackup';
import { runUnifiedRestoreFlow } from './unifiedRestoreFlow';
import { batchRemoveConfirmTitle, trashPurgeFailedText, recordImportConfirmText, batchRemoveUnkeptNote } from './recordListText';
import DeletedLogPanel from './DeletedLogPanel';
import { recordsToCsv } from '../../utils/recordExportLite';
import { parseCsvCharts, parseQckCharts, parseAafCharts, recordsToNdjson, recordsToMarkdown } from '../../utils/interchangeFormats';
import { saveBlobToBrowser, describeSaveResult } from '../../utils/aiAnalysisExport';
import { copyDesktopClipboard } from '../../utils/aiAnalysisDesktop';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import XQIcon from '../xq-icons';

import { getLayoutViewportHeight } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
import { matchesUserQuery } from '../../utils/scriptMode';
const Option = XQSelect.Option;

const primaryActionIconStyle = {
	fontSize: 19,
};
const primaryActionLinkStyle = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: 26,
	height: 26,
	verticalAlign: 'middle',
	color: 'var(--horosa-link)',
	lineHeight: 1,
};
const actionCellStyle = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 2,
	whiteSpace: 'nowrap',
};
// [V 顶部美化] 单行 flex 工具栏:主动作+回收站+「数据管理」下拉收纳低频四钮 | 视图切换+筛选+检索。
// 此前五个宽窄不一的裸按钮在栅格里折成两行残行,检索框漂最右 —— 全量收编。
const listToolbarStyle = {
	display: 'flex',
	alignItems: 'center',
	gap: 8,
	flexWrap: 'wrap',
	marginBottom: 12,
};
const toolbarSpacerStyle = {
	flex: 1,
	minWidth: 8,
};
const backupActionsStyle = {
	display: 'flex',
	alignItems: 'center',
	gap: 8,
	flexWrap: 'wrap',
};

export function isEditableChartRecord(record, userInfo){
	if(!record){
		return false;
	}
	if(userInfo && userInfo.uid && userInfo.uid === record.creator){
		return true;
	}
	if(record.creator === 'local'){
		return true;
	}
	if(record.cid && `${record.cid}`.indexOf('local-') === 0){
		return true;
	}
	return false;
}

class ChartList extends Component{

	constructor(props) {
		super(props);
		this.state = {
			tag: null,
			name: null,
			dispType: 'user/searchCharts',
			trashOpen: false,
			healthOpen: false,
			linkPair: null,
			mergeOpen: false,
			trashList: [],
			selectedKeys: [],
			orderBy: null,
			orderDir: null,
			batchTagOpen: false,
			batchTags: [],
			// [V 分组视图] 'flat' 平铺分页 | 'grouped' 按标签分段折叠(一条多标签出现在多组,无标签归「未分组」)
			viewMode: 'flat',
			deleteRec: null,
			deleteLabel: null,
			skipNext: false,
		};

		this.clickAdd = this.clickAdd.bind(this);
		this.clickEdit = this.clickEdit.bind(this);
		this.clickRemove = this.clickRemove.bind(this);
		this.clickInfo = this.clickInfo.bind(this);
		this.searchByName = this.searchByName.bind(this);
		this.clickDLFeature = this.clickDLFeature.bind(this);

		this.genTagsOption = this.genTagsOption.bind(this);
		this.filterTagsOption = this.filterTagsOption.bind(this);
		this.onTagChange = this.onTagChange.bind(this);
		this.renderGroup = this.renderGroup.bind(this);

		this.changeShowSize = this.changeShowSize.bind(this);
		this.showTotal = this.showTotal.bind(this);
		this.changePage = this.changePage.bind(this);
		this.clickExportLocalBackup = this.clickExportLocalBackup.bind(this);
		this.clickImportLocalBackup = this.clickImportLocalBackup.bind(this);
		this.onImportLocalFileChange = this.onImportLocalFileChange.bind(this);
		this.handleOpClick = this.handleOpClick.bind(this);
		this.openTrash = this.openTrash.bind(this);
		this.closeTrash = this.closeTrash.bind(this);
		this.confirmDelete = this.confirmDelete.bind(this);
		this.clickRestoreTrash = this.clickRestoreTrash.bind(this);
		this.clickPurgeTrash = this.clickPurgeTrash.bind(this);
		this.clickClearTrash = this.clickClearTrash.bind(this);
		this.clickUnifiedBackup = this.clickUnifiedBackup.bind(this);
		this.clickUnifiedRestore = this.clickUnifiedRestore.bind(this);
		this.onUnifiedRestoreFileChange = this.onUnifiedRestoreFileChange.bind(this);
		this.runUnifiedRestore = this.runUnifiedRestore.bind(this);
		this.onTableChange = this.onTableChange.bind(this);
		this.onDataMenuClick = this.onDataMenuClick.bind(this);
		this.onViewModeChange = this.onViewModeChange.bind(this);
		this.clickBatchPin = this.clickBatchPin.bind(this);
		this.clickBatchFlag = this.clickBatchFlag.bind(this);
		this.clickExportCsv = this.clickExportCsv.bind(this);
		this.clickImportInterchange = this.clickImportInterchange.bind(this);
		this.clickMove = this.clickMove.bind(this);
		this.clickBatchRemove = this.clickBatchRemove.bind(this);
		this.clickBatchExport = this.clickBatchExport.bind(this);
		this.clickBatchTagOk = this.clickBatchTagOk.bind(this);
		this.clickDuplicate = this.clickDuplicate.bind(this);
	}

	// 查询载荷单源:标签/检索/排序随每次分页与刷新走(此前分散拼装,漏一处即口径漂移)。
	queryPayload(extra){
		return {
			tag: this.state.tag,
			name: this.state.name,
			orderBy: this.state.orderBy,
			orderDir: this.state.orderDir,
			// 视图派生筛选:归档视图只看已归档,星标视图只看已加星(默认视图不含归档)。
			archivedOnly: this.state.viewMode === 'archived' || undefined,
			...extra,
		};
	}

	// 表头排序:store 级真排序(全库排后分页),非当前页内排(误导)。
	onTableChange(pagination, filters, sorter){
		const orderBy = sorter && sorter.order ? sorter.field : null;
		const orderDir = sorter && sorter.order === 'ascend' ? 'asc' : (sorter && sorter.order === 'descend' ? 'desc' : null);
		this.setState({ orderBy, orderDir }, ()=>{
			this.props.dispatch({
				type: this.state.dispType,
				payload: this.queryPayload({ PageIndex: 1, PageSize: this.props.pageSize || 30 }),
			});
		});
	}

	// [V 顶部美化] 「数据管理」下拉:导入/导出/全量备份/恢复全量四个低频动作收纳单钮。
	onDataMenuClick({ key }){
		if(key === 'import'){
			this.clickImportLocalBackup();
		}else if(key === 'export'){
			this.clickExportLocalBackup();
		}else if(key === 'unifiedBackup'){
			this.clickUnifiedBackup();
		}else if(key === 'unifiedRestore'){
			this.clickUnifiedRestore();
		}else if(key === 'health'){
			this.setState({ healthOpen: true });
		}else if(key === 'dedupe'){
			this.setState({ mergeOpen: true });
		}else if(key === 'importOther'){
			this.clickImportInterchange();
		}else if(key === 'exportNdjson'){
			const rows = listLocalCharts(this.queryPayload({}));
			// 保存结果如实报(桌面壳保存桥;取消 / 失败不报已导出)
			saveBlobToBrowser(`horosa-charts-${Date.now()}.ndjson`, new Blob([recordsToNdjson(rows)], { type: 'application/x-ndjson' })).then((r)=>{ const d = describeSaveResult(r, `已导出 ${rows.length} 条 NDJSON`); (message[d.type] || message.info)(d.text); });
		}else if(key === 'exportMarkdown'){
			const rows = listLocalCharts(this.queryPayload({}));
			saveBlobToBrowser(`horosa-charts-${Date.now()}.md`, new Blob([recordsToMarkdown(rows, 'chart')], { type: 'text/markdown' })).then((r)=>{ const d = describeSaveResult(r, `已导出 ${rows.length} 条 Markdown 档案(不可回导,备份请用 zip)`); (message[d.type] || message.info)(d.text); });
		}
	}

	// [V 分组定谳] 分组=「组选择器」模式:右侧标签下拉即分组切换,列表只显示选中组的平铺内容
	// (组内检索/排序/分页全部照常)——不做 Collapse 子分段(用户实测否决:分段妨碍组内检索)。
	// 切入分组时未选标签则自动选第一个组;库无标签给引导文案。
	onViewModeChange(val){
		if(val === 'grouped'){
			const tags = listLocalChartTags();
			const tag = this.state.tag || (tags.length ? tags[0] : null);
			this.setState({ viewMode: val, tag }, ()=>{
				this.searchByName(this.state.name || '');
			});
			return;
		}
		// flat/archived:切视图即按新筛选面刷新。
		this.setState({ viewMode: val }, ()=>{
			this.searchByName(this.state.name || '');
		});
	}

	// 从其他软件导入:文件选择(.csv/.qck/.aaf/.txt) → 按扩展名解析 → 预览条数与
	// 坏行 → 确认后经既有信封入库(三闸+去重四闸全复用;风险操作前自动备份)。
	clickImportInterchange(){
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.csv,.qck,.aaf,.txt';
		input.onchange = (e)=>{
			const file = e.target.files && e.target.files[0];
			if(!file){
				return;
			}
			const reader = new FileReader();
			reader.onload = ()=>{
				const text = `${reader.result || ''}`;
				const name = `${file.name}`.toLowerCase();
				const parsed = name.endsWith('.qck')
					? parseQckCharts(text)
					: (name.endsWith('.aaf') ? parseAafCharts(text) : parseCsvCharts(text));
				if(!parsed.records.length){
					Modal.warning({ title: '没有解析出可导入的记录', content: (parsed.errors || []).slice(0, 8).join('；') || '文件格式无法识别' });
					return;
				}
				Modal.confirm({
					title: '从其他软件导入',
					content: (
						<div>
							<p>{`解析出 ${parsed.records.length} 条记录${parsed.errors.length ? `，另有 ${parsed.errors.length} 行无法解析（已跳过）` : ''}。`}</p>
							{parsed.errors.length ? <p style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>{parsed.errors.slice(0, 5).join('；')}</p> : null}
							<p>同名同生辰的记录将自动跳过（防重复灌库）。</p>
						</div>
					),
					okText: '导入',
					cancelText: '取消',
					onOk: async ()=>{
						await runAutoBackupOnce({ trigger: 'pre-risk' }).catch(()=>{});
						// 外部软件导入的是全新记录、不带任何排盘设置:按「此刻点新命盘会用的设置」记下并打代次标记
						// (与在页面上新建同一个人一致;不沿用当时载入的那张盘的设置)
						const recs = (parsed.records || []).map((r)=>withNewChartDefaults(r, { forStore: true }));
						const r = importLocalChartsBackup({ format: 'horosa-local-charts', version: 1, charts: recs });
						toastRecordImport(message, 'chart', r, { label: '从其他软件导入' });
						this.searchByName(this.state.name || '');
					},
				});
			};
			reader.readAsText(file);
		};
		input.click();
	}

	// CSV 导出:选中行(无选中=当前筛选面全部)按核心列出表(BOM+转义,Excel 直开)。
	clickExportCsv(){
		const rows = (this.state.selectedRows && this.state.selectedRows.length)
			? this.state.selectedRows
			: listLocalCharts(this.queryPayload({}));
		if(!rows.length){
			message.warning('没有可导出的记录');
			return;
		}
		const csv = recordsToCsv(rows, 'chart');
		saveBlobToBrowser(`horosa-charts-${Date.now()}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' })).then((r)=>{ const d = describeSaveResult(r, `已导出 ${rows.length} 条为 CSV`); (message[d.type] || message.info)(d.text); });
	}

	// 批量 归档/星标(toggle 语义:以首个选中项的当前态取反,批量同步到该态)。
	clickBatchFlag(field){
		const rows = this.state.selectedRows || [];
		if(!rows.length){
			return;
		}
		const target = !(rows[0] && rows[0][field] === true);
		const res = runRecordBatch(rows, (r)=>flagLocalChart(r.cid, field, target));
		toastRecordBatch(message, 'chart', res, (n)=>(field === 'archived' ? (target ? `已归档 ${n} 条（默认列表不再显示，可在「已归档」视图查看）` : `已取消归档 ${n} 条`) : (target ? `已加星 ${n} 条` : `已取消星标 ${n} 条`)));
		this.setState({ selectedRowKeys: [], selectedRows: [] }, ()=>{
			this.searchByName(this.state.name || '');
		});
	}

	// [V] 上移/下移:仅单选可用;表头字段排序激活时禁用(手动微调只在默认序语义下成立)。
	// 移动后保持选中,方便连续点。
	clickMove(dir){
		const keys = this.state.selectedKeys;
		if(keys.length !== 1){
			return;
		}
		try{
			moveLocalChart(keys[0], dir);
		}catch(e){
			message.error('移动失败：本地存储空间不足');
			return;
		}
		this.searchByName(this.state.name || '');
	}

	// [V] 置顶/置底(选中后出现的批量条按钮;单选即单记录):三层分区,表头怎么排置顶恒先置底恒后。
	clickBatchPin(tier){
		const keys = this.state.selectedKeys;
		const res = runRecordBatch(keys, (cid)=>pinLocalChart(cid, tier));
		toastRecordBatch(message, 'chart', res, (n)=>(tier === 1 ? `已置顶 ${n} 条` : (tier === -1 ? `已置底 ${n} 条` : `已恢复默认排序 ${n} 条`)));
		this.setState({ selectedKeys: [] });
		this.searchByName(this.state.name || '');
	}

	// 批量操作:直调存储层 + 单次刷新(N 次 dispatch 每次全刷=闪屏)。删除走回收站可恢复。
	clickBatchRemove(){
		const keys = this.state.selectedKeys;
		// 删除写不进(配额满)的那条计失败:主库没变,它仍在列表里。
		// 存储写满时删除照样生效:回收站写不进的直接记进删除日志;连删除日志也写不进的(unkept)如实提示,横幅给「导出这些记录」
		let unkept = 0;
		let logged = 0;
		const removed = [];
		const res = runRecordBatch(keys, (cid)=>{
			const w = removeLocalChart(cid);
			if(w && !w.persisted && w.reason === 'quota'){ throw new Error('quota'); }
			removed.push(cid);
			if(w && w.unkept){ unkept += 1; }
			if(w && w.keptIn === 'log'){ logged += 1; }
		});
		// 删掉的里面有当前命盘:与单条删除同一入口脱离记录(否则之后「保存」写回回收站里那条)
		if(removed.length){
			this.props.dispatch({ type: 'user/detachCurrentChartIfRemoved', payload: { cids: removed } });
		}
		const api = unkept ? { ...message, success: message.warning } : message;
		toastRecordBatch(api, 'chart', res, (n)=>((unkept || logged)
			? `已删除 ${n} 条${logged ? `（其中 ${logged} 条回收站写不进，已直接记进删除日志）` : ''}${batchRemoveUnkeptNote(unkept)}`
			: `已移入回收站 ${n} 条`), { note: RECORD_BATCH_DELETE_NOT_PERSISTED_NOTE });
		this.setState({ selectedKeys: [] });
		this.searchByName(this.state.name || '');
	}

	clickBatchExport(){
		try{
			const set = new Set(this.state.selectedKeys);
			const items = listLocalCharts().filter((r)=>set.has(r.cid));
			const now = new Date();
			const pad = (n)=>String(n).padStart(2, '0');
			const fname = `horosa-local-charts-selected-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
			const backup = {
				format: 'horosa-local-charts',
				version: 1,
				exportedAt: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
				total: items.length,
				charts: items,
			};
			const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
			saveBlobToBrowser(fname, blob).then((r)=>{ const d = describeSaveResult(r, `已导出选中 ${items.length} 条`); (message[d.type] || message.info)(d.text); });
		}catch(e){
			message.error('导出选中失败');
		}
	}

	clickBatchTagOk(){
		const tags = (this.state.batchTags || []).filter(Boolean);
		if(!tags.length){
			this.setState({ batchTagOpen: false });
			return;
		}
		const set = new Set(this.state.selectedKeys);
		// 只改标签(与 AI 加标签同一写入):不经整条重建、不刷新「最近更新」
		const res = runRecordBatch(listLocalCharts({ includeArchived: true }).filter((r)=>set.has(r.cid)), (rec)=>{
			const merged = parseGroupTags(rec.group).slice();
			tags.forEach((t)=>{
				if(merged.indexOf(t) < 0){
					merged.push(t);
				}
			});
			setLocalChartTags(rec.cid, merged);
		});
		toastRecordBatch(message, 'chart', res, (n)=>`已为 ${n} 条追加标签`);
		this.setState({ batchTagOpen: false, batchTags: [], selectedKeys: [] });
		this.searchByName(this.state.name || '');
	}

	// 另存副本:同记录新 cid 复制(名加「(副本)」),含随盘技法键一并复制。
	clickDuplicate(rec){
		const dup = toRecordCopy(rec, { titleKey: 'name', suffix: '(副本)' });   // 单源剥离表:不带走置顶 / 星标 / 名人编号 / 关系边等
		try{
			upsertLocalChart(dup);
			toastRecordWrite(message, 'chart', `已另存副本：${dup.name}`);
			this.searchByName(this.state.name || '');
		}catch(e){
			message.error('另存副本失败：本地存储空间不足，请清理后重试');
		}
	}

	// 命盘+事盘+人生事件+命主实况+AI 导出/挂载设置打包单一 zip(unifiedBackup.js)。
	// 桌面优先走原生保存对话框(复用既有 Rust 命令,零壳改动),失败/非桌面回落浏览器下载
	// (AI 工作区备份同款回落纪律)。模块动态 import,不进主包。
	async clickUnifiedBackup(){
		try{
			const ub = await import('../../utils/unifiedBackup');
			const exp = await import('../../utils/aiAnalysisExport');
			const manifest = await ub.buildFullUnifiedManifest();
			const blob = await ub.buildUnifiedBackupBlob(manifest);
			const now = new Date();
			const pad = (n)=>String(n).padStart(2, '0');
			const fname = `horosa-full-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`;
			// 单源保存:桌面壳保存桥;取消不回落浏览器、不报成功;失败如实提示。
			const d = exp.describeSaveResult(await exp.saveBlobToBrowser(fname, blob), '全量备份已导出（命盘/事盘/人生事件/命主实况/AI 设置）');
			(message[d.type] || message.info)(d.text);
			// AI 工作区读不开(内存回退)时,包里没有对话 / 资料 / 模板:如实说,不让人以为都备份了
			if(manifest && manifest.aiWorkspaceUnavailable && d.type === 'success'){
				message.warning(`这份备份不含 AI 分析对话、资料与模板：${ub.aiWorkspaceUnavailableText(manifest.aiWorkspaceUnavailable.reason)}。`, 8);
			}
		}catch(e){
			message.error('全量备份导出失败');
		}
	}

	async clickUnifiedRestore(){
		try{
			const desktop = await import('../../utils/aiAnalysisDesktop');
			if(desktop.isDesktopBridgeAvailable()){
				const item = await desktop.openDesktopBackup();
				if(!item){
					return;   // 用户取消
				}
				const exp = await import('../../utils/aiAnalysisExport');
				await this.runUnifiedRestore(exp.base64ToBlob(item.base64Data, item.mimeType || 'application/zip'));
				return;
			}
		}catch(e){
			// 桌面通道失败 → 回落浏览器文件选择
		}
		if(this.unifiedRestoreInput){
			this.unifiedRestoreInput.value = '';
			this.unifiedRestoreInput.click();
		}
	}

	onUnifiedRestoreFileChange(evt){
		const file = evt && evt.target && evt.target.files ? evt.target.files[0] : null;
		if(!file){
			return;
		}
		this.runUnifiedRestore(file);
	}

	// 恢复三闸:解析校验(format 防呆,AI 工作区 zip 指路)→逐 store 预览确认→执行+分项结果(单源 unifiedRestoreFlow,存储横幅同用)。
	async runUnifiedRestore(blobOrFile){
		await runUnifiedRestoreFlow(blobOrFile, { onAfterRestore: ()=>this.searchByName(this.state.name || '') });
	}

	// 删除的星盘保留 30 天,可恢复/彻底删除/清空(清空=唯一批量硬删,双确认+条数)。
	openTrash(){
		this.setState({ trashOpen: true, trashList: listLocalChartsTrash() });
	}

	closeTrash(){
		this.setState({ trashOpen: false });
	}

	clickRestoreTrash(rec){
		try{
			const restored = restoreLocalChartFromTrash(rec.cid);
			toastRecordWrite(message, 'chart', restored && restored.cid !== rec.cid
				? `库里已有同一张,已按副本恢复：${restored.name || ''}`
				: `已恢复：${rec.name || '(未命名命盘)'}${rec.name ? '' : (rec.birth ? ` ${rec.birth}` : '')}`);
			this.setState({ trashList: listLocalChartsTrash() });
			this.searchByName(this.state.name || '');
		}catch(e){
			// 先恢复后出栈:失败时该条仍在回收站,零丢失
			message.error('恢复失败：本地存储空间不足，请先导出清理后重试');
		}
	}

	clickPurgeTrash(rec){
		if(purgeLocalChartTrashItem(rec.cid) === false){
			message.error(trashPurgeFailedText(1));
		}else{
			toastTrashPurge(message, 'chart', '已彻底删除');
		}
		this.setState({ trashList: listLocalChartsTrash() });
	}

	clickClearTrash(){
		// 风险操作前强制备份(Anki 范式):清空回收站=唯一批量硬删,先落一份自动备份再动手。
		runAutoBackupOnce({ trigger: 'pre-risk' }).finally(()=>{
			const n = clearLocalChartsTrash();
			if(n < 0){
				message.error(trashPurgeFailedText());
			}else{
				toastTrashPurge(message, 'chart', `已清空回收站（${n} 条）`);
			}
			this.setState({ trashList: listLocalChartsTrash() });
		});
	}

	handleOpClick(evt, cb){
		if(evt && evt.preventDefault){
			evt.preventDefault();
		}
		if(cb){
			cb();
		}
	}

	clickImportLocalBackup(){
		if(this.localImportInput){
			this.localImportInput.value = '';
			this.localImportInput.click();
		}
	}

	onImportLocalFileChange(evt){
		const file = evt && evt.target && evt.target.files ? evt.target.files[0] : null;
		if(!file){
			return;
		}
		const reader = new FileReader();
		reader.onload = ()=>{
			// 校验→预览条数确认→执行(此前零校验零确认:任何含 charts 数组的 JSON
			// 直接灌库、同 cid 静默覆盖;交叉选错事盘备份是静默 imported:0)。结构照 AI 工作区
			// 备份恢复的闸序纪律(校验先行→告知条数→再动库)。
			let json = null;
			try{
				json = JSON.parse(reader.result ? `${reader.result}` : '');
			}catch(e){
				message.error('本地命盘文件解析失败');
				return;
			}
			const check = validateLocalChartsBackup(json);
			if(!check.ok){
				if(check.reason === 'format-mismatch' && check.format === 'horosa-local-cases'){
					message.error('该文件是本地事盘备份，请在「起课列表」导入');
				}else{
					message.error('不是本地命盘备份文件');
				}
				return;
			}
			// 名人库页单独打开时复制出的 JSON:与软件内「导入为命盘」同一套(新人按新命盘设置补齐,已有这位只刷新出生数据)
			const celeb = prepareCelebrityChartsImport(json);
			const toImport = celeb.payload;
			// 名人库 JSON 里已有这位的条目是「只刷新出生数据」的补丁:同一 ID 按字段合并;普通备份同一 ID 较新的整条胜出
			const importOpts = toImport !== json ? { sameCid: 'merge' } : undefined;
			if(importOpts){
				// 只有补丁条目(名人库整理出来的新对象)按字段合并:同一文件里拼进来的普通备份条目照旧较新的整条胜出
				// (此前整份按字段合并,较旧的包把本机较新的改回旧值、更新时间倒退)
				const original = new Set(Array.isArray(json.charts) ? json.charts : []);
				importOpts.mergeCids = (Array.isArray(toImport.charts) ? toImport.charts : []).filter((c)=>c && !original.has(c) && c.cid).map((c)=>`${c.cid}`);
			}
			// 普通备份文件:本机在这份备份之后删掉的(还在回收站 / 删除日志里)不带回
			const recordOpts = importOpts || { respectLocalDeletions: true };
			const preview = previewLocalChartsBackup(toImport, recordOpts);
			Modal.confirm({
				title: '导入本地命盘备份',
				content: `${recordImportConfirmText(preview, { extra: celeb.skipped ? `、名人库里这位已有档案(在归档里或另建过)跳过 ${celeb.skipped} 条` : '', total: preview.total + celeb.skipped })}${check.reason === 'newer-version' ? '注意：该备份来自更新版本，可能含无法完整导入的数据。' : ''}`,
				okText: '导入',
				cancelText: '取消',
				onOk: async ()=>{
					// 同一 ID 会被替换 / 合并:与全量恢复、清空回收站同样先落一份风险前自动备份(失败不阻断)
					await runAutoBackupOnce({ trigger: 'pre-risk' }).catch(()=>{});
					const result = importLocalChartsBackup(toImport, recordOpts);
					toastRecordImport(message, 'chart', result, { label: '导入本地命盘备份' });
					// 本机已有、被整条替换的:当前载入的正是其中一条 → 按库里的新版重设(否则界面仍是导入前那版,一保存就改回去)
					if(result && Array.isArray(result.changedCids) && result.changedCids.length){ emitRecordsChanged({ store: 'chart', cids: result.changedCids, source: 'import' }); }
					if(celeb.skipped){ message.info(`名人库里这位已有档案(在归档里或另建过)的 ${celeb.skipped} 条没有导入`); }
					this.searchByName(this.state.name || '');
				},
			});
		};
		reader.onerror = ()=>{
			message.error('读取本地命盘文件失败');
		};
		reader.readAsText(file);
	}

	changeShowSize(current, pSize){
		this.props.dispatch({
			type: this.state.dispType,
			payload: this.queryPayload({ PageIndex: 1, PageSize: pSize }),
		});
	}

	showTotal(total, range){
		return (
			<span>
				总共：{this.props.total}&nbsp;条记录
			</span>
		);
	}

	changePage(page, pSize){
		this.props.dispatch({
			type: this.state.dispType,
			payload: this.queryPayload({ PageIndex: page, PageSize: pSize }),
		});
	}

	clickExportLocalBackup(){
		try{
			const backup = exportLocalChartsBackup();
			const now = new Date();
			const y = now.getFullYear();
			const m = String(now.getMonth() + 1).padStart(2, '0');
			const d = String(now.getDate()).padStart(2, '0');
			const hh = String(now.getHours()).padStart(2, '0');
			const mm = String(now.getMinutes()).padStart(2, '0');
			const ss = String(now.getSeconds()).padStart(2, '0');
			const fname = `horosa-local-charts-${y}${m}${d}-${hh}${mm}${ss}.json`;
			const payload = JSON.stringify(backup, null, 2);
			const blob = new Blob([payload], {type: 'application/json;charset=utf-8'});
			saveBlobToBrowser(fname, blob).then((r)=>{ const d = describeSaveResult(r, `已导出本地命盘（${backup.total}条）`); (message[d.type] || message.info)(d.text); });
		}catch(e){
			message.error('导出本地命盘失败');
		}
	}



	clickAdd(){
		this.props.dispatch({
			type: 'astro/openDrawer',
			payload:{
				key: 'chartadd',
			},
		});
	}

	clickEdit(rec){
		this.props.dispatch({
			type: 'astro/openDrawer',
			payload:{
				key: 'chartedit',
				record: rec,
			},
		});
	}

	clickDLFeature(rec){
		this.props.dispatch({
			type: 'astro/openDrawer',
			payload:{
				key: 'chartdeeplearn',
				record: rec,
			},
		});
	}

	clickRemove(rec){
		this.props.dispatch({
			type: 'user/deleteChart',
			payload: rec,
		});
	}

	// [V] 删除确认可选关闭:勾「下次不再提醒」+确定 → 持久化偏好,此后单条删除直删
	// (回收站兜底可恢复;批量删除恒确认)。回收站弹窗内有「重新开启」后悔药。
	// 布局定谳:勾选框与取消/确定**同一行**(左勾选右按钮,经典对话框式)——Popconfirm 的按钮区
	// 不可自定义,改受控小 Modal 自绘 footer。
	renderDeleteAction(rec, label){
		if(shouldSkipDeleteConfirm()){
			return (
				<a href={null} title="删除" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickRemove(rec);});}}><XQIcon name="delete" style={primaryActionIconStyle} /></a>
			);
		}
		return (
			<a href={null} title="删除" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.setState({ deleteRec: rec, deleteLabel: label, skipNext: false });});}}><XQIcon name="delete" style={primaryActionIconStyle} /></a>
		);
	}

	confirmDelete(){
		const rec = this.state.deleteRec;
		if(this.state.skipNext){
			setSkipDeleteConfirm();
		}
		this.setState({ deleteRec: null, deleteLabel: null, skipNext: false });
		if(rec){
			this.clickRemove(rec);
		}
	}

	renderDeleteConfirmModal(){
		return (
			<Modal
				visible={!!this.state.deleteRec}
				width={400}
				closable={false}
				onCancel={()=>{this.setState({ deleteRec: null, deleteLabel: null, skipNext: false });}}
				footer={(
					<div style={{ display: 'flex', alignItems: 'center' }}>
						<Checkbox
							checked={!!this.state.skipNext}
							onChange={(e)=>{this.setState({ skipNext: e.target.checked });}}
						>
							<span style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>下次不再提醒</span>
						</Checkbox>
						<div style={{ flex: 1 }} />
						<XQButton onClick={()=>{this.setState({ deleteRec: null, deleteLabel: null, skipNext: false });}}>取消</XQButton>
						<XQButton type="primary" onClick={this.confirmDelete}>确定</XQButton>
					</div>
				)}
			>
				{`确定删除${this.state.deleteLabel || ''}吗？（先进回收站，可恢复）`}
			</Modal>
		);
	}

	clickInfo(rec){
		this.props.dispatch({
			type: 'user/setCurrentChart',
			payload: rec,
		});
	}
	genTagsOption(){
		// 标签选项 = 本地命盘库全量聚合去重(与筛选判据同源)。
		// 🔴 原读全局 store 的 userInfo.group(登录用户档案)——纯本地桌面态 userInfo 恒 null,
		// 下拉永远为空、筛选形同虚设;与「选中不查询」双重断线,一并修。
		return listLocalChartTags().map((item)=>(
			<Option key={item} value={item}>{item}</Option>
		));
	}

	filterTagsOption(input, option){
		if(option.props.children){
			return matchesUserQuery(option.props.children + '', input);
		}
		return false;
	}

	onTagChange(val){
		// 选中/清除即查询(原先只 setState,列表纹丝不动,须再点一次搜索才生效)。
		// allowClear 清除时 antd 传 undefined → 归一 null=不过滤。
		this.setState({
			tag: val === undefined ? null : val,
		}, ()=>{
			this.searchByName(this.state.name || '');
		});
	}

	renderGroup(text, record){
		let txt = record.group;
		if(txt === undefined || txt === null || txt === ''){
			return text;
		}
		try{
			let tags = JSON.parse(txt);
			let dom = (
				<div>
					<EditableTags editable={false} value={tags} />
				</div>
			);
			return dom;
		}catch(e){
			return txt;
		}
	}


	searchByName(value, evt){
		let disptype = this.state.dispType;
		if(value === undefined || value === null || value === ''){
			disptype = 'user/fetchCharts';
			this.setState({
				dispType: disptype,
				// 清空检索必须同步清 name:否则 changePage/changeShowSize 仍带旧 name → 陈旧过滤复现
				name: null,
			}, ()=>{
				this.props.dispatch({
					type: disptype,
					payload: this.queryPayload({}),
				});
			});

		}else{
			disptype = 'user/searchCharts';
			this.setState({
				dispType: disptype,
				name: value,
			}, ()=>{
				this.props.dispatch({
					type: disptype,
					payload: this.queryPayload({ name: value }),
				});
			});
		}
	}

	render(){
		let ds = this.props.charts ? this.props.charts : [];
		let columns = [{
			title: '姓名',
			dataIndex: 'name',
			key: 'name',
			width: '20%',
			sorter: true,   // store 级真排序(onTableChange 派发 orderBy),非页内排
			// [V] 置顶/置底记录带标记(置顶恒排最前、置底恒排最后,无论表头怎么排)
			render: (text, record)=>{
				const mark = record && record.pinTier === 1 ? '📌 ' : (record && record.pinTier === -1 ? '⤓ ' : '');
				return mark ? <span title={record.pinTier === 1 ? '已置顶' : '已置底'}>{mark}{text}</span> : text;
			},
		},{
			title: '性别',
			dataIndex: 'gender',
			key: 'gender',
			width: '6%',
			render: (text, record)=>{
				return AstroText.Gender[text];
			},
		},{
			title: '出生时间',
			dataIndex: 'birth',
			key: 'birth',
			sorter: true,
			width: '14%',
		},{
			title: '时区',
			dataIndex: 'zone',
			key: 'zone',
			width: '10%',
		},{
			title: '出生地',
			dataIndex: 'pos',
			key: 'pos',
			width: '15%',
			render: (text, record)=>{
				let pos = `经度：${record.lon}，纬度：${record.lat}`;
				let span = (<span>{pos}</span>);
				if(text){
					span = (
						<div>
							<span>{text}</span><br />
							<span>{pos}</span>
						</div>
					);
				}
				return span;
			},
		},{
			// [V] 通用备注列(截断+悬停全文;未填省显)
			title: '备注',
			key: 'memo',
			width: '10%',
			render: (text, record)=>{
				const m = record && record.memo ? `${record.memo}` : '';
				if(!m){
					return '';
				}
				const shown = m.length > 12 ? `${m.slice(0, 12)}…` : m;
				return <span title={m}>{shown}</span>;
			},
		},{
			title: '标签',
			dataIndex: 'tags',
			key: 'tags',
			width: '15%',
			render: (text, record)=>{
				return this.renderGroup(text, record);
			},
		},{
			// 「公开」列已隐藏:纯本地桌面版无发布语义(isPub 数据字段保留,旧档兼容)。
			// 列宽:五个纯图标动作(副本改图标后由 176 回收)。曾因塞不下第五动作裁切点不到(L3 实抓)。
			title: '操作',
			key: 'Action',
			width: 150,
			render: (text, record, index)=>{
				let dom = (
					<span style={actionCellStyle}>
						<a href={null} title="选择" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickInfo(record);});}}><XQIcon name="select" style={primaryActionIconStyle} /></a>
					</span>
				);
				if(isEditableChartRecord(record, this.props.userInfo)){
					dom = (
						<span style={actionCellStyle}>
							<a href={null} title="选择" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickInfo(record);});}}><XQIcon name="select" style={primaryActionIconStyle} /></a>
							<a href={null} title="编辑" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickEdit(record);});}}><XQIcon name="edit" style={primaryActionIconStyle} /></a>
							{this.renderDeleteAction(record, `星盘：${record.name} `)}
							<a href={null} title="命主实况" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickDLFeature(record);});}}><XQIcon name="list" style={primaryActionIconStyle} /></a>
							<a href={null} title="另存副本" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickDuplicate(record);});}}><XQIcon name="copy" style={primaryActionIconStyle} /></a>
						</span>
					);
				}

				return dom;
			},
		}];

		let tbly = this.props.height ? this.props.height - 130 : getLayoutViewportHeight() - 130;

		let tags = this.genTagsOption();

		let pageSize = this.props.pageSize;
		let pageIndex = this.props.pageIndex;
		let total = this.props.total;

		return (
			<div style={{height: tbly}}>
				<div style={listToolbarStyle}>
					<XQButton type="primary" iconName="newChart" onClick={this.clickAdd}>添加星盘</XQButton>
					<XQButton onClick={this.openTrash}>回收站</XQButton>
					<Dropdown
						trigger={['click']}
						menu={{
							items: [
								{ key: 'import', label: '导入本地命盘(JSON)' },
								{ key: 'export', label: '导出本地命盘(JSON)' },
								{ type: 'divider' },
								{ key: 'unifiedBackup', label: '全量备份(zip)' },
								{ key: 'unifiedRestore', label: '恢复全量备份' },
								{ type: 'divider' },
								{ key: 'health', label: '存储健康' },
								{ key: 'dedupe', label: '查重与合并' },
								{ type: 'divider' },
								{ key: 'importOther', label: '从其他软件导入(CSV/QCK/AAF)' },
								{ key: 'exportNdjson', label: '导出 NDJSON(机器格式)' },
								{ key: 'exportMarkdown', label: '导出 Markdown 档案' },
							],
							onClick: this.onDataMenuClick,
						}}
					>
						<XQButton>数据管理 ▾</XQButton>
					</Dropdown>
					<div style={toolbarSpacerStyle} />
					<XQSelect
						value={this.state.viewMode}
						onChange={this.onViewModeChange}
						style={{width: 96}}
					>
						<Option value='flat'>平铺</Option>
						<Option value='grouped'>分组</Option>
						<Option value='archived'>已归档</Option>
					</XQSelect>
					<XQSelect
						placeholder='标签'
						showSearch allowClear
						filterOption={this.filterTagsOption}
						onChange={this.onTagChange}
						style={{width: 104}}
					>
						{tags}
					</XQSelect>
					<XQSearch
						placeholder='以姓名进行检索' enterButton
						onSearch={this.searchByName}
						style={{width: 200}}
					/>
					<input
						type='file'
						accept='.json,application/json'
						ref={(el)=>{this.localImportInput = el;}}
						style={{ display: 'none' }}
						onChange={this.onImportLocalFileChange}
					/>
					<input
						type='file'
						accept='.zip,application/zip'
						ref={(el)=>{this.unifiedRestoreInput = el;}}
						style={{ display: 'none' }}
						onChange={this.onUnifiedRestoreFileChange}
					/>
				</div>
				{this.state.selectedKeys.length ? (
					<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
						<span style={{ color: 'var(--horosa-text-secondary)', fontSize: 12, marginRight: 2 }}>已选 {this.state.selectedKeys.length} 条</span>
						<XQButton size='small' title='选中记录恒排最前' onClick={()=>{this.clickBatchPin(1);}}>置顶</XQButton>
						<XQButton size='small' title='选中记录恒排最后' onClick={()=>{this.clickBatchPin(-1);}}>置底</XQButton>
						<XQButton size='small' disabled={(this.state.selectedKeys || []).length !== 1 || !!this.state.orderBy} title='仅单选且默认序时可用' onClick={()=>{this.clickMove(-1);}}>上移</XQButton>
						<XQButton size='small' disabled={(this.state.selectedKeys || []).length !== 1 || !!this.state.orderBy} title='仅单选且默认序时可用' onClick={()=>{this.clickMove(1);}}>下移</XQButton>
						<XQButton size='small' title='取消选中记录的置顶/置底/手动排序' onClick={()=>{this.clickBatchPin(0);}}>恢复默认序</XQButton>
						<XQButton size='small' title='归档:移出默认列表(可在「已归档」视图查看,区别于删除)' onClick={()=>{this.clickBatchFlag('archived');}}>归档</XQButton>
						<XQButton size='small' disabled={(this.state.selectedRows || []).length !== 2} title='恰选两条:建立/解除双向关系(配偶/父母/子女…)' onClick={()=>{this.setState({ linkPair: (this.state.selectedRows || []).slice(0, 2) });}}>关联</XQButton>
						<Popconfirm title={batchRemoveConfirmTitle(this.state.selectedKeys.length, this.state.batchRemoveTrashLive, LOCAL_CHARTS_TRASH_CAP, this.state.batchRemoveLogCount, DELETED_LOG_CAP)} onOpenChange={(v)=>{ if(v){ let n = 0; let m = 0; try{ n = countLocalChartsLiveTrash(); m = countDeletedLogEntries(); }catch(e){ n = 0; } this.setState({ batchRemoveTrashLive: n, batchRemoveLogCount: m }); } }} onConfirm={this.clickBatchRemove}>
							<XQButton size='small'>批量删除</XQButton>
						</Popconfirm>
						<XQButton size='small' onClick={()=>{this.setState({ batchTagOpen: true, batchTags: [] });}}>批量打标签</XQButton>
						<Dropdown
							trigger={['click']}
							menu={{
								items: [
									{ key: 'json', label: '导出选中(JSON)' },
									{ key: 'csv', label: '导出选中(CSV)' },
								],
								onClick: ({ key })=>{ if(key === 'json'){ this.clickBatchExport(); }else{ this.clickExportCsv(); } },
							}}
						>
							<XQButton size='small'>导出 ▾</XQButton>
						</Dropdown>
						<XQButton size='small' onClick={()=>{this.setState({ selectedKeys: [], selectedRows: [] });}}>取消选择</XQButton>
					</div>
				) : null}
				{this.state.viewMode === 'grouped' ? (
					<div style={{ marginBottom: 8, color: 'var(--horosa-text-secondary)', fontSize: 12 }}>
						{this.state.tag
							? `当前分组：${this.state.tag} · 用右侧「标签」下拉切换分组，组内可检索 / 排序 / 分页；「移动分组」=编辑或批量修改标签`
							: '暂无可用分组：先为记录添加标签，再用右侧「标签」下拉选择分组'}
					</div>
				) : null}
				<XQTable
					dataSource={ds} columns={columns}
					rowKey='cid'
					bordered size='small'
					scroll={{x: '100%', y: tbly }}
					pagination={false}
					onChange={this.onTableChange}
					rowSelection={{
						selectedRowKeys: this.state.selectedKeys,
						onChange: (keys, rows)=>{this.setState({ selectedKeys: keys, selectedRows: rows });},
					}}
					onRow={(record, index)=>{
						let rowstyle = {};
						if(index % 2 === 1){
							rowstyle = {
								style: { backgroundColor: TableOddRowBgColor, },
							};
						}
						return {
							...rowstyle,
						}
					}}
				/>
				<XQPagination
					style={{marginTop:3, textAlign:'center',}}
					pageSizeOptions={['30', '50', '100']}
					showSizeChanger onShowSizeChange={this.changeShowSize}
					pageSize={pageSize || 30} current={pageIndex || 1}
					total={total} showTotal={this.showTotal} onChange={this.changePage} />
				{/* 库统计+上次备份时间常显(催备份最有效的提示就是让它一直可见)。 */}
				<div style={{ marginTop: 4, textAlign: 'center', color: 'var(--horosa-text-secondary)', fontSize: 12 }}>
					{`共 ${total || 0} 条 · 回收站 ${listLocalChartsTrash().length} 条`}
					{(()=>{
						try{
							const ab = getAutoBackupStatus();
							if(ab.last && ab.last.ok){
								return ` · 上次备份 ${new Date(parseDateTimeMs(ab.last.at)).toLocaleString()}`;
							}
						}catch(_e){ /* 状态读取失败不影响列表 */ }
						return '';
					})()}
				</div>

				<Modal
					title={`批量打标签（追加到选中的 ${this.state.selectedKeys.length} 条）`}
					visible={this.state.batchTagOpen}
					onCancel={()=>{this.setState({ batchTagOpen: false });}}
					onOk={this.clickBatchTagOk}
					okText='追加标签'
					cancelText='取消'
					width={480}
				>
					<EditableTags
						newTagLabel='添加标签'
						needConfirm={true}
						value={this.state.batchTags}
						onChange={(val)=>{this.setState({ batchTags: val || [] });}}
					/>
				</Modal>

				<Modal
					title='回收站（删除的星盘保留 30 天，超期自动清理）'
					visible={this.state.trashOpen}
					onCancel={this.closeTrash}
					footer={null}
					width={680}
				>
					{this.state.trashList.length === 0 ? (
						<div style={{ color: 'var(--horosa-text-secondary)', padding: 12 }}>回收站为空</div>
					) : (
						<div>
							<XQTable
								dataSource={this.state.trashList}
								rowKey='cid'
								size='small'
								pagination={false}
								scroll={{ y: 320 }}
								columns={[
									{ title: '姓名', dataIndex: 'name', key: 'name' },
									{ title: '出生时间', dataIndex: 'birth', key: 'birth', width: 165 },
									{ title: '删除时间', dataIndex: 'deletedAt', key: 'deletedAt', width: 165 },
									{ title: '操作', key: 'op', width: 140, render: (text, rec)=>(
										<span style={actionCellStyle}>
											<a href={null} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickRestoreTrash(rec);});}}>恢复</a>
											<Popconfirm title={`彻底删除后回收站里不再有这一条，之后可从下方「删除日志」找回（删除日志命盘、事盘合计最多留 ${DELETED_LOG_CAP} 条，满了最早的会被挤掉），确定？`} onConfirm={()=>{this.clickPurgeTrash(rec);}}>
												<a href={null} style={{ color: '#cf1322' }}>彻底删除</a>
											</Popconfirm>
										</span>
									) },
								]}
							/>
							<div style={{ marginTop: 10, textAlign: 'right' }}>
								<Popconfirm title={`清空回收站将彻底删除 ${this.state.trashList.length} 条记录，之后可从下方「删除日志」找回（删除日志命盘、事盘合计最多留 ${DELETED_LOG_CAP} 条，满了最早的会被挤掉），确定？`} onConfirm={this.clickClearTrash}>
									<XQButton>清空回收站</XQButton>
								</Popconfirm>
							</div>
						</div>
					)}
					{shouldSkipDeleteConfirm() ? (
						<div style={{ marginTop: 8, color: 'var(--horosa-text-secondary)', fontSize: 12 }}>
							删除确认提醒已关闭（单条删除直接进回收站）。<a href={null} onClick={(evt)=>{this.handleOpClick(evt, ()=>{clearSkipDeleteConfirm(); this.forceUpdate();});}}>重新开启提醒</a>
						</div>
					) : null}
					{/* 删除日志找回:彻底删除/清空后的第二道防线(缺省列最近几条,「显示全部」列出本库每一条可搜;点「找回」即回灌主库)。 */}
					<DeletedLogPanel
						store='chart'
						describe={(e)=>`${e.record.name || '(未命名命盘)'} · ${e.record.birth || ''} · 删于 ${e.purgedAt}`}
						onRestore={(e)=>{
							try{
								const restored = restoreLocalChartFromDeletedLog(e);
								toastRecordWrite(message, 'chart', restored && restored.cid !== e.record.cid
									? `库里已有同一张,已按副本找回：${restored.name || ''}`
									: '已从删除日志找回');
							}catch(_err){
								message.error('找回失败：本地存储空间不足，请先导出清理后重试');
							}
							this.searchByName(this.state.name || '');
						}}
					/>
				</Modal>
				{this.renderDeleteConfirmModal()}
				<StorageHealthModal visible={this.state.healthOpen} onClose={()=>this.setState({ healthOpen: false })} />
				<RecordLinkModal
					visible={!!(this.state.linkPair && this.state.linkPair.length === 2)}
					kind='chart'
					pair={this.state.linkPair}
					onClose={()=>this.setState({ linkPair: null })}
					onChanged={()=>{this.searchByName(this.state.name || '');}}
				/>
				<DuplicateMergeModal
					visible={this.state.mergeOpen}
					kind='chart'
					records={this.state.mergeOpen ? listLocalCharts({ includeArchived: true }) : []}
					timeField='birth'
					onClose={()=>this.setState({ mergeOpen: false })}
					onChanged={()=>{this.searchByName(this.state.name || '');}}
					onRemoved={(cids)=>{ this.props.dispatch({ type: 'user/detachCurrentChartIfRemoved', payload: { cids } }); }}
				/>
			</div>
		);
	}
}

export default ChartList;
