// 技法键 → 快照槽名别名表(单源):挂载 / 存案 / 导出等各路读盘方同一张(零依赖,导出侧与挂载侧都能引)。
// 两种关系:
//   · 同组(GROUPS):同一样东西的几个槽名(历史改名 / 页面别名),问任一名都展开成整组;
//   · 母子(FAMILIES):母键展开到全部子槽;子槽只回落到它登记的几个槽,不串到兄弟子槽(黄历三子、各节气盘是不同的内容)。
// 所问的名永远排第一(读序 = 别名序)。几门技法轮流覆盖的共用槽(shusuan / mingother)不收:不知道里面是哪一门的盘。
export function normalizeTechniqueKey(key){
	const text = `${key || ''}`.trim();
	if(!text){
		return '';
	}
	if(text === 'liuyao' || text === 'guazhan'){
		return 'sixyao';
	}
	if(text === 'dunjia'){
		return 'qimen';
	}
	if(text === 'germanytech'){
		return 'germany';
	}
	// hellenastro 自 2026-09-11 起是独立技法键(十三分盘),不再折叠进聚合键;locastro/chart13 仍归聚合键。
	if(text === 'locastro'){
		return 'astrochart_like';
	}
	if(text === 'relativechart'){
		return 'relative';
	}
	if(text === 'jieqichart'){
		return 'jieqi';
	}
	if(text === 'chart13'){
		return 'astrochart_like';
	}
	return text;
}

// 数算 / 其他命术页的服务键(与 KinAstroMain 页配置的 serviceKey 一一对应;合同 reportMountedSnapshotSource 看守)
export const KINASTRO_SERVICE_KEYS = ['shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi', 'canping', 'heluo', 'zhengchuan', 'xianqin', 'cetian', 'yizhangjing'];

export const TECHNIQUE_SLOT_GROUPS = [
	['sixyao', 'guazhan', 'liuyao'],
	['qimen', 'dunjia'],
	['direction', 'primarydirect', 'primarydirchart'],
	['zodialrelease', 'zodiacrelease'],
	['decennials', 'decennial'],
	['germany', 'germanytech'],
	['relative', 'relativechart'],
	['astrochart_like', 'locastro', 'chart13'],
	['qizhengkin', 'guolao-qizhengkin'],
	// 数算 / 其他命术页按服务键写自己的专属槽 kinastro-<服务键>
	...KINASTRO_SERVICE_KEYS.map((k)=>[k, `kinastro-${k}`]),
];
export const TECHNIQUE_SLOT_FAMILIES = [
	{ parent: 'indiachart', children: ['indiachart_current'], childPrefix: 'indiachart_', childFallback: ['indiachart', 'indiachart_current'] },
	{ parent: 'jieqi', children: ['jieqi_current', 'jieqi_meta', 'jieqi_chunfen', 'jieqi_xiazhi', 'jieqi_qiufen', 'jieqi_dongzhi'], childPrefix: 'jieqi_', childFallback: ['jieqi', 'jieqi_current'] },
	// 黄历四子 tab 各自独立快照(老黄历 / 通书择日 / 日子馆):母键挂载 / 导出一并纳入;子槽是不同内容,不互相回落
	{ parent: 'calendar', children: ['calendar-huangli', 'calendar-tongshu', 'calendar-rizi'], childFallback: [] },
];
// 不许出现在任何别名展开里的共用槽(几门技法轮流写)
export const SHARED_SNAPSHOT_SLOTS = ['shusuan', 'mingother'];

export function getTechniqueAliasList(moduleName){
	const raw = `${moduleName || ''}`.trim();
	if(!raw){
		return [];
	}
	const name = normalizeTechniqueKey(raw);
	const out = [];
	const add = (k)=>{ if(k && out.indexOf(k) < 0){ out.push(k); } };
	add(raw);
	add(name);
	const fam = TECHNIQUE_SLOT_FAMILIES.find((f)=>f.parent === name);
	if(fam){ fam.children.forEach(add); return out; }
	const child = TECHNIQUE_SLOT_FAMILIES.find((f)=>f.children.indexOf(name) >= 0 || (f.childPrefix && name.indexOf(f.childPrefix) === 0));
	if(child){ child.childFallback.forEach(add); return out; }
	const g = TECHNIQUE_SLOT_GROUPS.find((gr)=>gr.indexOf(name) >= 0);
	if(g){ g.forEach(add); }
	return out;
}
