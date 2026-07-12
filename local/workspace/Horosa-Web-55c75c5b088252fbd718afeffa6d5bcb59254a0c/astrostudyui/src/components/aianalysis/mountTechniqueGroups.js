// 挂载技法多选下拉的「术数域」分组器(纯展示层)。
// 复用 aiExport.listAIExportTechniqueSettingGroups 的域定义(键→组标题 + 组序),但只对
// 「当前 source 的可挂集」(listAnalysisTechniqueOptions(source) 的选项)分组:
//   · 组内只保留可挂集内的键;组内空 → 整组不渲染;
//   · 不在任何命名域组的键(含导出侧「其他」组的键、未登记键)一律落统一「其他」组、恒置尾。
// 数据仍以传入 options 为真值(value/label 原样),分组只改展示顺序与 OptGroup 归属。
import { listAIExportTechniqueSettingGroups } from '../../utils/aiExport';

const OTHER_GROUP_TITLE = '其他';

export function groupMountTechniqueOptions(options){
	const opts = Array.isArray(options) ? options : [];
	if(!opts.length){
		return [];
	}
	// 从导出侧域定义抽「键→命名域标题」映射 + 命名域出现顺序(导出侧「其他」并入统一尾组)。
	let exportGroups = [];
	try{
		exportGroups = listAIExportTechniqueSettingGroups() || [];
	}catch(_){
		exportGroups = [];
	}
	const titleByKey = new Map();
	const orderedTitles = [];
	exportGroups.forEach((group)=>{
		const title = group && group.title ? group.title : OTHER_GROUP_TITLE;
		const items = group && Array.isArray(group.items) ? group.items : [];
		items.forEach((item)=>{
			if(item && item.key != null && !titleByKey.has(item.key)){
				titleByKey.set(item.key, title);
			}
		});
		if(title !== OTHER_GROUP_TITLE && orderedTitles.indexOf(title) < 0){
			orderedTitles.push(title);
		}
	});
	orderedTitles.push(OTHER_GROUP_TITLE); // 「其他」恒置尾

	const buckets = new Map(orderedTitles.map((title)=>[title, []]));
	opts.forEach((opt)=>{
		const title = (opt && titleByKey.get(opt.value)) || OTHER_GROUP_TITLE;
		if(!buckets.has(title)){
			buckets.set(title, []);
		}
		buckets.get(title).push(opt);
	});

	return orderedTitles
		.map((title)=>({ title, items: buckets.get(title) || [] }))
		.filter((group)=>group.items.length > 0);
}

export default groupMountTechniqueOptions;
