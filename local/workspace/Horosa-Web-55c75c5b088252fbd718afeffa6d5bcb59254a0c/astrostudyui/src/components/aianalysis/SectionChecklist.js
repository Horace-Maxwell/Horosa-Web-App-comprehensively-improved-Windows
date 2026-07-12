// 挂载「纳入内容段」勾选列表 —— 通用子组件,供多处挂载设置面板复用。
// 纯展示/受控:自身不持状态,勾选/全选/清空/恢复默认全部回吐给父;段名、存储结构零改。
//   · groups 有值(getSectionGroupsForTechnique 命中厚技法)→ 组标题 + 组内勾选两级渲染;
//   · groups 空/null → 维持现状扁平单列勾选。
//   · onSelectAll/onClear/onReset 任一缺省 → 该按钮不渲染;三者全缺 → 无工具条(父自带工具条时用)。
// 依赖极简:只依赖通用 UI 套件 xq-ui,不引任何技法组件。
import React from 'react';
import { XQButton, XQCheckItem, XQCheckList, XQToolbar } from '../xq-ui';

export default function SectionChecklist({
	options,
	selected,
	groups,
	onToggle,
	onSelectAll,
	onClear,
	onReset,
	columns = 2,
	toolbarClassName = '',
	checklistClassName = '',
	groupTitleClassName = '',
}){
	const opts = Array.isArray(options) ? options : [];
	const sel = Array.isArray(selected) ? selected : [];
	const validGroups = Array.isArray(groups) && groups.length ? groups : null;
	const hasToolbar = !!(onSelectAll || onClear || onReset);

	const renderChecks = (items)=>(
		<XQCheckList columns={columns} className={checklistClassName}>
			{items.map((sec)=>(
				<XQCheckItem
					key={sec}
					compact
					checked={sel.indexOf(sec) >= 0}
					onClick={onToggle ? ()=>onToggle(sec) : undefined}
				>
					{sec}
				</XQCheckItem>
			))}
		</XQCheckList>
	);

	return (
		<React.Fragment>
			{hasToolbar ? (
				<XQToolbar compact className={toolbarClassName}>
					{onSelectAll ? <XQButton size="small" onClick={onSelectAll}>全选</XQButton> : null}
					{onClear ? <XQButton size="small" onClick={onClear}>清空</XQButton> : null}
					{onReset ? <XQButton size="small" onClick={onReset}>恢复默认</XQButton> : null}
				</XQToolbar>
			) : null}
			{validGroups ? (
				validGroups.map((group)=>(
					<div key={group.title} className="xq-mount-section-group">
						<div className={groupTitleClassName}>{group.title}</div>
						{renderChecks(group.items)}
					</div>
				))
			) : renderChecks(opts)}
		</React.Fragment>
	);
}
