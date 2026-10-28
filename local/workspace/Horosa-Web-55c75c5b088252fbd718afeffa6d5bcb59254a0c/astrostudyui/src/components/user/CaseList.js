import { Component } from 'react';
import { Popconfirm, message, Modal, Dropdown, Checkbox } from 'antd';
import * as AstroText from '../../constants/AstroText';
import { TableOddRowBgColor } from '../../utils/constants';
import EditableTags from '../comp/EditableTags';
import { getCaseTypeLabel, exportLocalCasesBackup, importLocalCasesBackup, listLocalCaseTags, validateLocalCasesBackup, previewLocalCasesBackup, listLocalCasesTrash, restoreLocalCaseFromTrash, restoreLocalCaseFromDeletedLog, purgeLocalCaseTrashItem, clearLocalCasesTrash, listLocalCases, upsertLocalCase, removeLocalCase, pinLocalCase, moveLocalCase, CASE_TYPE_OPTIONS , flagLocalCase, setLocalCaseTags, countLocalCasesLiveTrash, LOCAL_CASES_TRASH_CAP } from '../../utils/localcases';
import { XQButton, XQPagination, XQSearch, XQSelect, XQTable } from '../xq-ui';
import { toRecordCopy, parseGroupTags } from '../../utils/localRecordStore';
import { toastRecordWrite, runRecordBatch, toastRecordBatch, toastRecordImport, toastTrashPurge, RECORD_BATCH_DELETE_NOT_PERSISTED_NOTE, emitRecordsChanged } from '../../utils/recordStoreNotice';
import { runAutoBackupOnce } from '../../utils/autoBackup';
import { batchRemoveConfirmTitle, trashPurgeFailedText, recordImportConfirmText, batchRemoveUnkeptNote } from './recordListText';
import DeletedLogPanel from './DeletedLogPanel';
import { countDeletedLogEntries, DELETED_LOG_CAP } from '../../utils/localRecordStore';
import { shouldSkipDeleteConfirm, setSkipDeleteConfirm, clearSkipDeleteConfirm } from '../../utils/uiPrefs';
import { recordsToCsv } from '../../utils/recordExportLite';
import { saveBlobToBrowser, describeSaveResult } from '../../utils/aiAnalysisExport';
import { copyDesktopClipboard } from '../../utils/aiAnalysisDesktop';
import XQIcon from '../xq-icons';
import { parseRecordPayload } from '../../utils/aiAnalysisSources';

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
// [V 顶部美化] 单行 flex 工具栏(与 ChartList 同款):主动作+回收站+「数据管理」下拉 | 视图切换+筛选+检索。
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

class CaseList extends Component{
	constructor(props) {
		super(props);
		this.state = {
			tag: null,
			name: null,
			caseType: null,
			dispType: 'user/searchCases',
			trashOpen: false,
			trashList: [],
			selectedKeys: [],
			orderBy: null,
			orderDir: null,
			batchTagOpen: false,
			batchTags: [],
			// [V 分组视图] 'flat' | 'grouped'(与 ChartList 同款,按标签分段折叠)
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
		this.changeShowSize = this.changeShowSize.bind(this);
		this.showTotal = this.showTotal.bind(this);
		this.changePage = this.changePage.bind(this);
		this.genTagsOption = this.genTagsOption.bind(this);
		this.filterTagsOption = this.filterTagsOption.bind(this);
		this.onTagChange = this.onTagChange.bind(this);
		this.renderGroup = this.renderGroup.bind(this);
		this.handleOpClick = this.handleOpClick.bind(this);
		this.clickExportLocalBackup = this.clickExportLocalBackup.bind(this);
		this.clickImportLocalBackup = this.clickImportLocalBackup.bind(this);
		this.onImportLocalFileChange = this.onImportLocalFileChange.bind(this);
		this.openTrash = this.openTrash.bind(this);
		this.closeTrash = this.closeTrash.bind(this);
		this.confirmDelete = this.confirmDelete.bind(this);
		this.clickRestoreTrash = this.clickRestoreTrash.bind(this);
		this.clickPurgeTrash = this.clickPurgeTrash.bind(this);
		this.clickClearTrash = this.clickClearTrash.bind(this);
		this.onTableChange = this.onTableChange.bind(this);
		this.onCaseTypeChange = this.onCaseTypeChange.bind(this);
		this.onDataMenuClick = this.onDataMenuClick.bind(this);
		this.onViewModeChange = this.onViewModeChange.bind(this);
		this.clickBatchPin = this.clickBatchPin.bind(this);
		this.clickBatchFlag = this.clickBatchFlag.bind(this);
		this.clickExportCsv = this.clickExportCsv.bind(this);
		this.clickMove = this.clickMove.bind(this);
		this.clickBatchRemove = this.clickBatchRemove.bind(this);
		this.clickBatchExport = this.clickBatchExport.bind(this);
		this.clickBatchTagOk = this.clickBatchTagOk.bind(this);
		this.clickDuplicate = this.clickDuplicate.bind(this);
	}

	// 查询载荷单源(与 ChartList 同款):标签/检索/类型/排序随每次分页与刷新走。
	queryPayload(extra){
		return {
			archivedOnly: this.state.viewMode === 'archived' || undefined,
			tag: this.state.tag,
			name: this.state.name,
			caseType: this.state.caseType,
			orderBy: this.state.orderBy,
			orderDir: this.state.orderDir,
			...extra,
		};
	}

	onTableChange(pagination, filters, sorter){
		const orderBy = sorter && sorter.order ? sorter.field : null;
		const orderDir = sorter && sorter.order === 'ascend' ? 'asc' : (sorter && sorter.order === 'descend' ? 'desc' : null);
		this.setState({ orderBy, orderDir }, ()=>{
			this.props.dispatch({
				type: this.state.dispType,
				payload: this.queryPayload({ PageIndex: 1, PageSize: this.props.casePageSize || 30 }),
			});
		});
	}

	// [V 顶部美化] 「数据管理」下拉(事盘侧:导入/导出)。
	onDataMenuClick({ key }){
		if(key === 'import'){
			this.clickImportLocalBackup();
		}else if(key === 'export'){
			this.clickExportLocalBackup();
		}
	}

	// [V 分组定谳] 分组=「组选择器」模式(与 ChartList 同款):标签下拉即分组切换,列表=选中组平铺,
	// 组内检索/排序/分页照常;不做 Collapse 子分段(用户实测否决)。
	onViewModeChange(val){
		if(val === 'grouped'){
			const tags = listLocalCaseTags();
			const tag = this.state.tag || (tags.length ? tags[0] : null);
			this.setState({ viewMode: val, tag }, ()=>{
				this.searchByName(this.state.name || '');
			});
			return;
		}
		this.setState({ viewMode: val });
	}

	// [V] 上移/下移(与 ChartList 同款:仅单选;表头排序激活时禁用;移动后保持选中)。
	clickMove(dir){
		const keys = this.state.selectedKeys;
		if(keys.length !== 1){
			return;
		}
		try{
			moveLocalCase(keys[0], dir);
		}catch(e){
			message.error('移动失败：本地存储空间不足');
			return;
		}
		this.searchByName(this.state.name || '');
	}

	// [V] 置顶/置底(选中后批量条按钮;单选即单记录)。
	// 事盘 CSV 导出(与命盘侧同款;kind='case')。
	clickExportCsv(){
		const rows = (this.state.selectedRows && this.state.selectedRows.length)
			? this.state.selectedRows
			: listLocalCases(this.queryPayload({}));
		if(!rows.length){
			message.warning('没有可导出的记录');
			return;
		}
		saveBlobToBrowser(`horosa-cases-${Date.now()}.csv`, new Blob([recordsToCsv(rows, 'case')], { type: 'text/csv;charset=utf-8' })).then((r)=>{ const d = describeSaveResult(r, `已导出 ${rows.length} 条为 CSV`); (message[d.type] || message.info)(d.text); });
	}


	// 批量 归档/星标(与命盘侧同款 toggle 语义)。
	clickBatchFlag(field){
		const rows = this.state.selectedRows || [];
		if(!rows.length){
			return;
		}
		const target = !(rows[0] && rows[0][field] === true);
		const res = runRecordBatch(rows, (r)=>flagLocalCase(r.cid, field, target));
		toastRecordBatch(message, 'case', res, (n)=>(field === 'archived' ? (target ? `已归档 ${n} 条（默认列表不再显示，可在「已归档」视图查看）` : `已取消归档 ${n} 条`) : (target ? `已加星 ${n} 条` : `已取消星标 ${n} 条`)));
		this.setState({ selectedKeys: [], selectedRows: [] }, ()=>{
			this.searchByName(this.state.name || '');
		});
	}

	clickBatchPin(tier){
		const keys = this.state.selectedKeys;
		const res = runRecordBatch(keys, (cid)=>pinLocalCase(cid, tier));
		toastRecordBatch(message, 'case', res, (n)=>(tier === 1 ? `已置顶 ${n} 条` : (tier === -1 ? `已置底 ${n} 条` : `已恢复默认排序 ${n} 条`)));
		this.setState({ selectedKeys: [] });
		this.searchByName(this.state.name || '');
	}

	// 事盘类型筛选(25 类,CASE_TYPE_OPTIONS 单源):选中/清除即查询。
	onCaseTypeChange(val){
		this.setState({
			caseType: val === undefined ? null : val,
		}, ()=>{
			this.searchByName(this.state.name || '');
		});
	}

	clickBatchRemove(){
		const keys = this.state.selectedKeys;
		// 删除写不进(配额满)的那条计失败:主库没变,它仍在列表里
		// 存储写满时删除照样生效:回收站写不进的直接记进删除日志;连删除日志也写不进的(unkept)如实提示,横幅给「导出这些记录」
		const removed = [];
		let unkept = 0;
		let logged = 0;
		const res = runRecordBatch(keys, (cid)=>{
			const w = removeLocalCase(cid);
			if(w && !w.persisted && w.reason === 'quota'){ throw new Error('quota'); }
			removed.push(cid);
			if(w && w.unkept){ unkept += 1; }
			if(w && w.keptIn === 'log'){ logged += 1; }
		});
		// 删掉的里面有当前事盘:与单条删除同一入口清掉(否则之后首次挂载的技法页把已删的盘还原上去)
		if(removed.length){
			this.props.dispatch({ type: 'user/clearCurrentCaseIfRemoved', payload: { cids: removed } });
		}
		const api = unkept ? { ...message, success: message.warning } : message;
		toastRecordBatch(api, 'case', res, (n)=>((unkept || logged)
			? `已删除 ${n} 条${logged ? `（其中 ${logged} 条回收站写不进，已直接记进删除日志）` : ''}${batchRemoveUnkeptNote(unkept)}`
			: `已移入回收站 ${n} 条`), { note: RECORD_BATCH_DELETE_NOT_PERSISTED_NOTE });
		this.setState({ selectedKeys: [] });
		this.searchByName(this.state.name || '');
	}

	clickBatchExport(){
		try{
			const set = new Set(this.state.selectedKeys);
			const items = listLocalCases().filter((r)=>set.has(r.cid));
			const now = new Date();
			const pad = (n)=>String(n).padStart(2, '0');
			const fname = `horosa-local-cases-selected-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
			const backup = {
				format: 'horosa-local-cases',
				version: 1,
				exportedAt: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
				total: items.length,
				cases: items,
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
		const res = runRecordBatch(listLocalCases({ includeArchived: true }).filter((r)=>set.has(r.cid)), (rec)=>{
			const merged = parseGroupTags(rec.group).slice();
			tags.forEach((t)=>{
				if(merged.indexOf(t) < 0){
					merged.push(t);
				}
			});
			setLocalCaseTags(rec.cid, merged);
		});
		toastRecordBatch(message, 'case', res, (n)=>`已为 ${n} 条追加标签`);
		this.setState({ batchTagOpen: false, batchTags: [], selectedKeys: [] });
		this.searchByName(this.state.name || '');
	}

	clickDuplicate(rec){
		const dup = toRecordCopy(rec, { titleKey: 'event', suffix: '(副本)' });   // 单源剥离表(含 AI 来源里的去重指纹)
		try{
			upsertLocalCase(dup);
			toastRecordWrite(message, 'case', `已另存副本：${dup.event}`);
			this.searchByName(this.state.name || '');
		}catch(e){
			message.error('另存副本失败：本地存储空间不足，请清理后重试');
		}
	}

	// 与命盘侧 ChartList 同款:删除的起课保留 30 天,可恢复/彻底删除/清空。
	openTrash(){
		this.setState({ trashOpen: true, trashList: listLocalCasesTrash() });
	}

	closeTrash(){
		this.setState({ trashOpen: false });
	}

	clickRestoreTrash(rec){
		try{
			const restored = restoreLocalCaseFromTrash(rec.cid);
			toastRecordWrite(message, 'case', restored && restored.cid !== rec.cid
				? `库里已有同一条,已按副本恢复：${restored.event || ''}`
				: `已恢复：${rec.event || '(未命名事盘)'}${rec.event ? '' : (rec.divTime ? ` ${rec.divTime}` : '')}`);
			this.setState({ trashList: listLocalCasesTrash() });
			this.searchByName(this.state.name || '');
		}catch(e){
			message.error('恢复失败：本地存储空间不足，请先导出清理后重试');
		}
	}

	clickPurgeTrash(rec){
		if(purgeLocalCaseTrashItem(rec.cid) === false){
			message.error(trashPurgeFailedText(1));
		}else{
			toastTrashPurge(message, 'case', '已彻底删除');
		}
		this.setState({ trashList: listLocalCasesTrash() });
	}

	clickClearTrash(){
		// 与命盘侧同:清空回收站 = 批量彻底删除,先落一份自动备份再动手
		runAutoBackupOnce({ trigger: 'pre-risk' }).finally(()=>{
			const n = clearLocalCasesTrash();
			if(n < 0){
				message.error(trashPurgeFailedText());
			}else{
				toastTrashPurge(message, 'case', `已清空回收站（${n} 条）`);
			}
			this.setState({ trashList: listLocalCasesTrash() });
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

	changeShowSize(current, pSize){
		this.props.dispatch({
			type: this.state.dispType,
			payload: this.queryPayload({ PageIndex: 1, PageSize: pSize }),
		});
	}

	showTotal(){
		return (
			<span>
				总共：{this.props.caseTotal}&nbsp;条记录
			</span>
		);
	}

	changePage(page, pSize){
		this.props.dispatch({
			type: this.state.dispType,
			payload: this.queryPayload({ PageIndex: page, PageSize: pSize }),
		});
	}

	clickAdd(){
		this.props.dispatch({
			type: 'astro/openDrawer',
			payload: {
				key: 'caseadd',
			},
		});
	}

	clickEdit(rec){
		this.props.dispatch({
			type: 'astro/openDrawer',
			payload: {
				key: 'caseedit',
				record: rec,
			},
		});
	}

	clickRemove(rec){
		this.props.dispatch({
			type: 'user/deleteCase',
			payload: rec,
		});
	}

	// [V] 删除确认可选关闭(与 ChartList 同款,共用同一偏好;批量删除恒确认)。
	// 布局定谳:勾选框与取消/确定同一行(左勾选右按钮)——受控小 Modal 自绘 footer。
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
			type: 'user/applyCase',
			payload: rec,
		});
		this.props.dispatch({
			type: 'astro/closeDrawer',
			payload: {},
		});
	}

	searchByName(value){
		let disptype = this.state.dispType;
		if(value === undefined || value === null || value === ''){
			disptype = 'user/fetchCases';
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
			disptype = 'user/searchCases';
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

	clickExportLocalBackup(){
		try{
			const backup = exportLocalCasesBackup();
			const now = new Date();
			const y = now.getFullYear();
			const m = String(now.getMonth() + 1).padStart(2, '0');
			const d = String(now.getDate()).padStart(2, '0');
			const hh = String(now.getHours()).padStart(2, '0');
			const mm = String(now.getMinutes()).padStart(2, '0');
			const ss = String(now.getSeconds()).padStart(2, '0');
			const fname = `horosa-local-cases-${y}${m}${d}-${hh}${mm}${ss}.json`;
			const payload = JSON.stringify(backup, null, 2);
			const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
			saveBlobToBrowser(fname, blob).then((r)=>{ const d = describeSaveResult(r, `已导出本地事盘（${backup.total}条）`); (message[d.type] || message.info)(d.text); });
		}catch(e){
			message.error('导出本地事盘失败');
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
			// 校验→预览条数确认→执行(与命盘侧 ChartList 同款,闸序纪律同源)。
			let json = null;
			try{
				json = JSON.parse(reader.result ? `${reader.result}` : '');
			}catch(e){
				message.error('本地事盘文件解析失败');
				return;
			}
			const check = validateLocalCasesBackup(json);
			if(!check.ok){
				if(check.reason === 'format-mismatch' && check.format === 'horosa-local-charts'){
					message.error('该文件是本地命盘备份，请在「星盘列表」导入');
				}else{
					message.error('不是本地事盘备份文件');
				}
				return;
			}
			// 本机在这份备份之后删掉的(还在回收站 / 删除日志里)不带回;没有起课时间的坏条目跳过并列出
			const recordOpts = { respectLocalDeletions: true, rejectInvalid: true };
			const preview = previewLocalCasesBackup(json, recordOpts);
			Modal.confirm({
				title: '导入本地事盘备份',
				content: `${recordImportConfirmText(preview)}${check.reason === 'newer-version' ? '注意：该备份来自更新版本，可能含无法完整导入的数据。' : ''}`,
				okText: '导入',
				cancelText: '取消',
				onOk: async ()=>{
					// 同一 ID 会被替换:与全量恢复、清空回收站同样先落一份风险前自动备份(失败不阻断)
					await runAutoBackupOnce({ trigger: 'pre-risk' }).catch(()=>{});
					const result = importLocalCasesBackup(json, recordOpts);
					toastRecordImport(message, 'case', result, { label: '导入本地事盘备份' });
					// 本机已有、被整条替换的:当前载入的正是其中一条 → 按库里的新版重设(否则界面仍是导入前那版,一保存就改回去)
					if(result && Array.isArray(result.changedCids) && result.changedCids.length){ emitRecordsChanged({ store: 'case', cids: result.changedCids, source: 'import' }); }
					this.searchByName(this.state.name || '');
				},
			});
		};
		reader.onerror = ()=>{
			message.error('读取本地事盘文件失败');
		};
		reader.readAsText(file);
	}

	genTagsOption(){
		// 标签选项 = 本地事盘库全量聚合去重(与筛选判据同源)。
		// 🔴 原读恒 null 的 userInfo.group(登录用户档案)——纯本地桌面态下拉永远为空,与
		// 「选中不查询」双重断线,一并修(命盘侧 ChartList 同款)。
		return listLocalCaseTags().map((item)=>(
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
		this.setState({
			tag: val === undefined ? null : val,
		}, ()=>{
			this.searchByName(this.state.name || '');
		});
	}

	// 摘要列:从 payload 提取问事(options.question/askEvent 族)+备注,列表可辨认「这条占的什么」。
	renderSummary(text, record){
		let q = '';
		try{
			const p = record ? parseRecordPayload(record.payload) : null;
			if(p){
				q = (p.options && (p.options.question || p.options.askEvent))
					|| p.askEvent || p.question || '';
			}
		}catch(e){
			q = '';
		}
		const memo = record && record.memo ? `${record.memo}` : '';
		const txt = [q, memo].filter(Boolean).join(' · ');
		if(!txt){
			return '';
		}
		const shown = txt.length > 24 ? `${txt.slice(0, 24)}…` : txt;
		return <span title={txt}>{shown}</span>;
	}

	renderGroup(text, record){
		let txt = record.group;
		if(txt === undefined || txt === null || txt === ''){
			return text;
		}
		try{
			const tags = JSON.parse(txt);
			return (
				<div>
					<EditableTags editable={false} value={tags} />
				</div>
			);
		}catch(e){
			return txt;
		}
	}

	render(){
		const ds = this.props.cases ? this.props.cases : [];
		const columns = [{
			title: '事件',
			dataIndex: 'event',
			key: 'event',
			width: '20%',
			sorter: true,   // store 级真排序(onTableChange 派发 orderBy),非页内排
			// [V] 置顶/置底标记(与 ChartList 同款)
			render: (text, record)=>{
				const mark = record && record.pinTier === 1 ? '📌 ' : (record && record.pinTier === -1 ? '⤓ ' : '');
				return mark ? <span title={record.pinTier === 1 ? '已置顶' : '已置底'}>{mark}{text}</span> : text;
			},
		},{
			title: '类型',
			dataIndex: 'caseType',
			key: 'caseType',
			width: '8%',
			render: (text)=>getCaseTypeLabel(text),
		},{
			title: '问事/备注',
			key: 'summary',
			width: '13%',
			render: (text, record)=>this.renderSummary(text, record),
		},{
			title: '占卜时间',
			dataIndex: 'divTime',
			key: 'divTime',
			width: '14%',
			sorter: true,
		},{
			title: '时区',
			dataIndex: 'zone',
			key: 'zone',
			width: '10%',
		},{
			title: '起课地',
			dataIndex: 'pos',
			key: 'pos',
			width: '15%',
			render: (text, record)=>{
				const pos = `经度：${record.lon}，纬度：${record.lat}`;
				if(text){
					return (
						<div>
							<span>{text}</span><br />
							<span>{pos}</span>
						</div>
					);
				}
				return (<span>{pos}</span>);
			},
		},{
			title: '标签',
			dataIndex: 'tags',
			key: 'tags',
			width: '15%',
			render: (text, record)=>this.renderGroup(text, record),
		},{
			// 「公开」列已隐藏:纯本地桌面版无发布语义(isPub 数据字段保留,旧档兼容)。
			// 列宽:四个纯图标动作(副本改图标后由 160 回收);曾有裁切点不到风险(L3 实抓同修)。
			title: '操作',
			key: 'Action',
			width: 130,
			render: (text, record)=>(
				<span style={actionCellStyle}>
					<a href={null} title="选择" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickInfo(record);});}}><XQIcon name="select" style={primaryActionIconStyle} /></a>
					<a href={null} title="编辑" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickEdit(record);});}}><XQIcon name="edit" style={primaryActionIconStyle} /></a>
					{this.renderDeleteAction(record, `起课：${record.event || ''} `)}
					<a href={null} title="另存副本" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickDuplicate(record);});}}><XQIcon name="copy" style={primaryActionIconStyle} /></a>
				</span>
			),
		}];

		const tbly = this.props.height ? this.props.height - 130 : getLayoutViewportHeight() - 130;
		const tags = this.genTagsOption();
		const pageSize = this.props.casePageSize;
		const pageIndex = this.props.casePageIndex;
		const total = this.props.caseTotal;

		return (
			<div style={{height: tbly}}>
				<div style={listToolbarStyle}>
					<XQButton type="primary" iconName="newChart" onClick={this.clickAdd}>添加起课</XQButton>
					<XQButton onClick={this.openTrash}>回收站</XQButton>
					<Dropdown
						trigger={['click']}
						menu={{
							items: [
								{ key: 'import', label: '导入本地事盘(JSON)' },
								{ key: 'export', label: '导出本地事盘(JSON)' },
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
						style={{width: 84}}
					>
						<Option value='flat'>平铺</Option>
						<Option value='archived'>已归档</Option>
						<Option value='grouped'>分组</Option>
					</XQSelect>
					<XQSelect
						placeholder='类型'
						showSearch allowClear
						optionFilterProp='children'
						onChange={this.onCaseTypeChange}
						style={{width: 100}}
					>
						{CASE_TYPE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
					</XQSelect>
					<XQSelect
						placeholder='标签'
						showSearch allowClear
						filterOption={this.filterTagsOption}
						onChange={this.onTagChange}
						style={{width: 100}}
					>
						{tags}
					</XQSelect>
					<XQSearch placeholder='以事件进行检索' enterButton onSearch={this.searchByName} style={{width: 190}} />
					<input
						type='file'
						accept='.json,application/json'
						ref={(el)=>{this.localImportInput = el;}}
						style={{ display: 'none' }}
						onChange={this.onImportLocalFileChange}
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
						<Popconfirm title={batchRemoveConfirmTitle(this.state.selectedKeys.length, this.state.batchRemoveTrashLive, LOCAL_CASES_TRASH_CAP, this.state.batchRemoveLogCount, DELETED_LOG_CAP)} onOpenChange={(v)=>{ if(v){ let n = 0; let m = 0; try{ n = countLocalCasesLiveTrash(); m = countDeletedLogEntries(); }catch(e){ n = 0; } this.setState({ batchRemoveTrashLive: n, batchRemoveLogCount: m }); } }} onConfirm={this.clickBatchRemove}>
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
					dataSource={ds}
					columns={columns}
					rowKey='cid'
					bordered
					size='small'
					scroll={{x: '100%', y: tbly}}
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
								style: { backgroundColor: TableOddRowBgColor },
							};
						}
						return {
							...rowstyle,
						};
					}}
				/>

				<XQPagination
					style={{marginTop: 3, textAlign: 'center'}}
					pageSizeOptions={['30', '50', '100']}
					showSizeChanger
					onShowSizeChange={this.changeShowSize}
					pageSize={pageSize || 30}
					current={pageIndex || 1}
					total={total}
					showTotal={this.showTotal}
					onChange={this.changePage}
				/>

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
					title='回收站（删除的起课保留 30 天，超期自动清理）'
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
									{ title: '事件', dataIndex: 'event', key: 'event' },
									{ title: '类型', dataIndex: 'caseType', key: 'caseType', width: 90, render: (text)=>getCaseTypeLabel(text) },
									{ title: '占卜时间', dataIndex: 'divTime', key: 'divTime', width: 155 },
									{ title: '删除时间', dataIndex: 'deletedAt', key: 'deletedAt', width: 155 },
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
					{/* 删除日志找回(与命盘列表同):彻底删除 / 清空回收站后的第二道防线,缺省列最近几条、「显示全部」列出本库每一条,点「找回」即回灌事盘库 */}
					<DeletedLogPanel
						store='case'
						describe={(e)=>`${e.record.event || '(未命名事盘)'} · ${e.record.divTime || ''} · 删于 ${e.purgedAt}`}
						onRestore={(e)=>{
							try{
								const restored = restoreLocalCaseFromDeletedLog(e);
								toastRecordWrite(message, 'case', restored && restored.cid !== e.record.cid
									? `库里已有同一条,已按副本找回：${restored.event || ''}`
									: '已从删除日志找回');
							}catch(_err){
								message.error('找回失败：本地存储空间不足，请先导出清理后重试');
							}
							this.searchByName(this.state.name || '');
						}}
					/>
				</Modal>
				{this.renderDeleteConfirmModal()}
			</div>
		);
	}
}

export default CaseList;
