import { Component } from 'react';
import { Popconfirm, message, Modal, Dropdown, Checkbox } from 'antd';
import * as AstroText from '../../constants/AstroText';
import { TableOddRowBgColor } from '../../utils/constants';
import EditableTags from '../comp/EditableTags';
import { getCaseTypeLabel, exportLocalCasesBackup, importLocalCasesBackup, listLocalCaseTags, validateLocalCasesBackup, previewLocalCasesBackup, listLocalCasesTrash, restoreLocalCaseFromTrash, purgeLocalCaseTrashItem, clearLocalCasesTrash, listLocalCases, upsertLocalCase, removeLocalCase, pinLocalCase, moveLocalCase, CASE_TYPE_OPTIONS , flagLocalCase } from '../../utils/localcases';
import { XQButton, XQPagination, XQSearch, XQSelect, XQTable } from '../xq-ui';
import { groupRecordsByTag } from '../../utils/localRecordStore';
import { shouldSkipDeleteConfirm, setSkipDeleteConfirm, clearSkipDeleteConfirm } from '../../utils/uiPrefs';
import { recordsToCsv } from '../../utils/recordExportLite';
import { saveBlobToBrowser } from '../../utils/aiAnalysisExport';
import { copyDesktopClipboard } from '../../utils/aiAnalysisDesktop';
import XQIcon from '../xq-icons';

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
	color: '#1890ff',
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

	// [R4] 查询载荷单源(与 ChartList 同款):标签/检索/类型/排序随每次分页与刷新走。
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
			if(this.props.dispatch){
				this.props.dispatch({
					type: this.state.dispType,
					payload: this.queryPayload({ PageIndex: 1, PageSize: this.props.casePageSize || 30 }),
				});
			}
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
	// [V5-UI尾款] 事盘 CSV 导出(与命盘侧同款;kind='case')。
	clickExportCsv(){
		const rows = (this.state.selectedRows && this.state.selectedRows.length)
			? this.state.selectedRows
			: listLocalCases(this.queryPayload({}));
		if(!rows.length){
			message.warning('没有可导出的记录');
			return;
		}
		saveBlobToBrowser(`horosa-cases-${Date.now()}.csv`, new Blob([recordsToCsv(rows, 'case')], { type: 'text/csv;charset=utf-8' }));
		message.success(`已导出 ${rows.length} 条为 CSV`);
	}


	// [V5-D1/D2] 批量 归档/星标(与命盘侧同款 toggle 语义)。
	clickBatchFlag(field){
		const rows = this.state.selectedRows || [];
		if(!rows.length){
			return;
		}
		const target = !(rows[0] && rows[0][field] === true);
		rows.forEach((r)=>{
			try{
				flagLocalCase(r.cid, field, target);
			}catch(err){
				message.error('操作失败（本地空间不足？）');
			}
		});
		message.success(field === 'archived' ? (target ? `已归档 ${rows.length} 条（默认列表不再显示，可在「已归档」视图查看）` : `已取消归档 ${rows.length} 条`) : (target ? `已加星 ${rows.length} 条` : `已取消星标 ${rows.length} 条`));
		this.setState({ selectedKeys: [], selectedRows: [] }, ()=>{
			this.searchByName(this.state.name || '');
		});
	}

	clickBatchPin(tier){
		const keys = this.state.selectedKeys;
		keys.forEach((cid)=>{
			try{
				pinLocalCase(cid, tier);
			}catch(e){
				// quota 单条失败继续
			}
		});
		message.success(tier === 1 ? `已置顶 ${keys.length} 条` : (tier === -1 ? `已置底 ${keys.length} 条` : `已恢复默认排序 ${keys.length} 条`));
		this.setState({ selectedKeys: [] });
		this.searchByName(this.state.name || '');
	}

	// [R4] 事盘类型筛选(25 类,CASE_TYPE_OPTIONS 单源):选中/清除即查询。
	onCaseTypeChange(val){
		this.setState({
			caseType: val === undefined ? null : val,
		}, ()=>{
			this.searchByName(this.state.name || '');
		});
	}

	clickBatchRemove(){
		const keys = this.state.selectedKeys;
		keys.forEach((cid)=>{
			try{
				removeLocalCase(cid);
			}catch(e){
				// remove 永不抛;保险
			}
		});
		message.success(`已移入回收站 ${keys.length} 条`);
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
			const url = (window.URL || window.webkitURL).createObjectURL(blob);
			const a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			a.setAttribute('download', fname);
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			(window.URL || window.webkitURL).revokeObjectURL(url);
			message.success(`已导出选中 ${items.length} 条`);
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
		listLocalCases().filter((r)=>set.has(r.cid)).forEach((rec)=>{
			let grp = [];
			try{
				grp = rec.group ? JSON.parse(rec.group) : [];
			}catch(e){
				grp = [];
			}
			if(!(grp instanceof Array)){
				grp = [];
			}
			const merged = grp.slice();
			tags.forEach((t)=>{
				if(merged.indexOf(t) < 0){
					merged.push(t);
				}
			});
			try{
				upsertLocalCase({ cid: rec.cid, group: merged });
			}catch(e){
				// 单条失败继续
			}
		});
		message.success(`已为 ${set.size} 条追加标签`);
		this.setState({ batchTagOpen: false, batchTags: [], selectedKeys: [] });
		this.searchByName(this.state.name || '');
	}

	clickDuplicate(rec){
		const dup = { ...rec };
		delete dup.cid;
		delete dup.schemaVersion;
		delete dup.deletedAt;
		dup.event = `${rec.event || ''}(副本)`;
		try{
			upsertLocalCase(dup);
			message.success(`已另存副本：${dup.event}`);
			this.searchByName(this.state.name || '');
		}catch(e){
			message.error('另存副本失败：本地存储空间不足，请清理后重试');
		}
	}

	// [R3 回收站] 与命盘侧 ChartList 同款:删除的起课保留 30 天,可恢复/彻底删除/清空。
	openTrash(){
		this.setState({ trashOpen: true, trashList: listLocalCasesTrash() });
	}

	closeTrash(){
		this.setState({ trashOpen: false });
	}

	clickRestoreTrash(rec){
		try{
			restoreLocalCaseFromTrash(rec.cid);
			message.success(`已恢复：${rec.event || rec.cid}`);
			this.setState({ trashList: listLocalCasesTrash() });
			this.searchByName(this.state.name || '');
		}catch(e){
			message.error('恢复失败：本地存储空间不足，请先导出清理后重试');
		}
	}

	clickPurgeTrash(rec){
		purgeLocalCaseTrashItem(rec.cid);
		this.setState({ trashList: listLocalCasesTrash() });
	}

	clickClearTrash(){
		const n = clearLocalCasesTrash();
		message.success(`已清空回收站（${n} 条）`);
		this.setState({ trashList: listLocalCasesTrash() });
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
		if(this.props.dispatch){
			this.props.dispatch({
				type: this.state.dispType,
				payload: this.queryPayload({ PageIndex: 1, PageSize: pSize }),
			});
		}
	}

	showTotal(){
		return (
			<span>
				总共：{this.props.caseTotal}&nbsp;条记录
			</span>
		);
	}

	changePage(page, pSize){
		if(this.props.dispatch){
			this.props.dispatch({
				type: this.state.dispType,
				payload: this.queryPayload({ PageIndex: page, PageSize: pSize }),
			});
		}
	}

	clickAdd(){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
				},
			});
		}
	}

	clickEdit(rec){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseedit',
					record: rec,
				},
			});
		}
	}

	clickRemove(rec){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'user/deleteCase',
				payload: rec,
			});
		}
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
							<span style={{ fontSize: 12, color: '#8c8c8c' }}>下次不再提醒</span>
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
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'user/applyCase',
				payload: rec,
			});
			this.props.dispatch({
				type: 'astro/closeDrawer',
				payload: {},
			});
		}
	}

	searchByName(value){
		if(this.props.dispatch){
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
			const url = (window.URL || window.webkitURL).createObjectURL(blob);
			const a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			a.setAttribute('download', fname);
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			(window.URL || window.webkitURL).revokeObjectURL(url);
			message.success(`已导出本地事盘（${backup.total}条）`);
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
			// [S8 导入三闸] 校验→预览条数确认→执行(与命盘侧 ChartList 同款,闸序纪律同源)。
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
			const preview = previewLocalCasesBackup(json);
			Modal.confirm({
				title: '导入本地事盘备份',
				content: `将新增 ${preview.adds} 条、按同 ID 合并覆盖 ${preview.updates} 条（备份共 ${preview.total} 条）。合并覆盖=同 ID 记录按字段合并，现有记录不会被删除。${check.reason === 'newer-version' ? '注意：该备份来自更新版本，可能含无法完整导入的数据。' : ''}`,
				okText: '导入',
				cancelText: '取消',
				onOk: ()=>{
					const result = importLocalCasesBackup(json);
					if(result.failed > 0){
						message.warning(`已导入本地事盘 ${result.imported} 条，${result.failed} 条因存储空间不足失败，请清理后重试`);
					}else{
						message.success(`已导入本地事盘 ${result.imported} 条，当前共 ${result.total} 条`);
					}
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
			const val = option.props.children + '';
			return val.toLowerCase().indexOf(input.toLowerCase()) >= 0;
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

	// [R4] 摘要列:从 payload 提取问事(options.question/askEvent 族)+备注,列表可辨认「这条占的什么」。
	renderSummary(text, record){
		let q = '';
		try{
			const p = record && record.payload ? JSON.parse(record.payload) : null;
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
			sorter: true,   // [R4] store 级真排序(onTableChange 派发 orderBy),非页内排
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
			// [R4] 「公开」列已隐藏:纯本地桌面版无发布语义(isPub 数据字段保留,旧档兼容)。
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

		const tbly = this.props.height ? this.props.height - 130 : document.documentElement.clientHeight - 130;
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
						<span style={{ color: '#8c8c8c', fontSize: 12, marginRight: 2 }}>已选 {this.state.selectedKeys.length} 条</span>
						<XQButton size='small' title='选中记录恒排最前' onClick={()=>{this.clickBatchPin(1);}}>置顶</XQButton>
						<XQButton size='small' title='选中记录恒排最后' onClick={()=>{this.clickBatchPin(-1);}}>置底</XQButton>
						<XQButton size='small' disabled={(this.state.selectedKeys || []).length !== 1 || !!this.state.orderBy} title='仅单选且默认序时可用' onClick={()=>{this.clickMove(-1);}}>上移</XQButton>
						<XQButton size='small' disabled={(this.state.selectedKeys || []).length !== 1 || !!this.state.orderBy} title='仅单选且默认序时可用' onClick={()=>{this.clickMove(1);}}>下移</XQButton>
						<XQButton size='small' title='取消选中记录的置顶/置底/手动排序' onClick={()=>{this.clickBatchPin(0);}}>恢复默认序</XQButton>
						<XQButton size='small' title='归档:移出默认列表(可在「已归档」视图查看,区别于删除)' onClick={()=>{this.clickBatchFlag('archived');}}>归档</XQButton>
						<Popconfirm title={`将选中 ${this.state.selectedKeys.length} 条移入回收站？（可恢复）`} onConfirm={this.clickBatchRemove}>
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
					<div style={{ marginBottom: 8, color: '#8c8c8c', fontSize: 12 }}>
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
						<div style={{ color: '#999', padding: 12 }}>回收站为空</div>
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
											<Popconfirm title='彻底删除后不可找回，确定？' onConfirm={()=>{this.clickPurgeTrash(rec);}}>
												<a href={null} style={{ color: '#cf1322' }}>彻底删除</a>
											</Popconfirm>
										</span>
									) },
								]}
							/>
							<div style={{ marginTop: 10, textAlign: 'right' }}>
								<Popconfirm title={`清空回收站将彻底删除 ${this.state.trashList.length} 条记录，不可找回，确定？`} onConfirm={this.clickClearTrash}>
									<XQButton>清空回收站</XQButton>
								</Popconfirm>
							</div>
						</div>
					)}
					{shouldSkipDeleteConfirm() ? (
						<div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
							删除确认提醒已关闭（单条删除直接进回收站）。<a href={null} onClick={(evt)=>{this.handleOpClick(evt, ()=>{clearSkipDeleteConfirm(); this.forceUpdate();});}}>重新开启提醒</a>
						</div>
					) : null}
				</Modal>
				{this.renderDeleteConfirmModal()}
			</div>
		);
	}
}

export default CaseList;
