// AI 导出 · 页面上下文识别:页签容器查找、当前技法判定、按盘面状态解析、店内回落、节气设置键判定、运行时页签读取。
// 由 utils/aiExport.js 门面统一对外导出。
import { getStore } from '../storageutil';
import { AI_EXPORT_TECHNIQUES } from './presets';
import { textOf } from './settingsModel';
import { getModuleCachedContent } from './snapshotLookup';
import { getTechniqueLabelByKey } from './exportKeys';

function getTabsNavItems(container){
	if(!container){
		return [];
	}
	return Array.from(container.querySelectorAll('.ant-tabs-nav .ant-tabs-tab'));
}

function getDirectActivePane(container){
	if(!container){
		return null;
	}
	const holder = Array.from(container.children).find((n)=>n.classList && n.classList.contains('ant-tabs-content-holder'));
	if(holder){
		const content = holder.querySelector('.ant-tabs-content');
		if(content){
			const direct = Array.from(content.children).find((n)=>n.classList && n.classList.contains('ant-tabs-tabpane-active'));
			if(direct){
				return direct;
			}
		}
		const any = holder.querySelector('.ant-tabs-tabpane-active');
		if(any){
			return any;
		}
	}
	return container.querySelector('.ant-tabs-tabpane-active');
}

function findTabsContainerByLabels(scopeRoot, labels, requireAll){
	if(!scopeRoot){
		return null;
	}
	const tabs = Array.from(scopeRoot.querySelectorAll('.ant-tabs'));
	for(let i=0; i<tabs.length; i++){
		const tab = tabs[i];
		const names = getTabsNavItems(tab).map((n)=>textOf(n));
		if(names.length === 0){
			continue;
		}
		let ok = false;
		if(requireAll){
			ok = labels.every((k)=>names.some((v)=>v.includes(k)));
		}else{
			ok = labels.some((k)=>names.some((v)=>v.includes(k)));
		}
		if(ok){
			return tab;
		}
	}
	return null;
}

function findTopTabsContainer(root){
	if(!root){
		return null;
	}
	const topLabelHints = [
		'星盘',
		'三维盘',
		'星运',
		'推运盘',
		'辅盘',
		'量化盘',
		'合盘',
		'关系盘',
		'节气盘',
		'十三分盘',
		'占星地图',
		'希腊星术',
		'印度占星',
		'印度律盘',
		'黄历',
		'骰子',
		'辅助',
		'八字紫微',
		'其他术数',
		'易与三式',
		'六爻',
		'六壬',
		'遁甲',
		'太乙',
		'七政四余',
		'风水',
		'三式合一',
	];
	const tabs = Array.from(root.querySelectorAll('.ant-tabs'));
	let best = null;
	let bestScore = -1;
	let bestNavCount = -1;
	for(let i=0; i<tabs.length; i++){
		const names = getTabsNavItems(tabs[i]).map((n)=>textOf(n));
		if(names.includes('星盘') && (names.includes('易与三式') || names.includes('其他术数') || names.includes('六爻'))){
			return tabs[i];
		}
		if(!names.length){
			continue;
		}
		let score = 0;
		topLabelHints.forEach((hint)=>{
			if(names.some((txt)=>txt && txt.includes(hint))){
				score += 1;
			}
		});
		const navCount = names.filter(Boolean).length;
		if(score > bestScore || (score === bestScore && navCount > bestNavCount)){
			bestScore = score;
			best = tabs[i];
			bestNavCount = navCount;
		}
	}
	if(best && bestScore > 0){
		return best;
	}
	const leftTabs = root.querySelector('.ant-tabs-left');
	if(leftTabs){
		return leftTabs;
	}
	if(best){
		return best;
	}
	return tabs[0] || null;
}

function detectChartTypeInPane(scopeRoot){
	if(!scopeRoot){
		return '';
	}
	const items = Array.from(scopeRoot.querySelectorAll('.ant-select-selection-item'));
	for(let i=0; i<items.length; i++){
		const txt = textOf(items[i]);
		if(txt.includes('外盘')){
			return txt;
		}
	}
	return '';
}

export function findIndiaActivePane(scopeRoot){
	if(!scopeRoot){
		return {
			pane: null,
			label: '',
		};
	}
	const tabs = Array.from(scopeRoot.querySelectorAll('.ant-tabs'));
	for(let i=0; i<tabs.length; i++){
		const tab = tabs[i];
		const names = getTabsNavItems(tab).map((n)=>textOf(n));
		if(!names.some((n)=>n.includes('命盘'))){
			continue;
		}
		if(!names.some((n)=>n.includes('律盘'))){
			continue;
		}
		const active = getTabsNavItems(tab).find((n)=>n.classList.contains('ant-tabs-tab-active'));
		return {
			pane: getDirectActivePane(tab),
			label: textOf(active),
		};
	}
	return {
		pane: null,
		label: '',
	};
}

export function resolveActiveContext(){
	const root = document.getElementById('mainContent') || document.body;
	const topTabs = findTopTabsContainer(root);
	if(!topTabs){
		return {
			displayName: '当前技术',
			key: 'generic',
			domain: null,
			scopeRoot: root,
		};
	}

	const topActiveTab = getTabsNavItems(topTabs).find((n)=>n.classList.contains('ant-tabs-tab-active'));
	let topLabel = textOf(topActiveTab) || '当前技术';
	// [制度化] 🔴 主导航短名→导出判定长名归一(结构化真值,与显示文案永久解耦):
	//   判定链按长名词匹配;导航显示名改短(如「印度占星」→「印占」)曾使印占/七政/三式/分至等页
	//   顶栏 AI 导出全线报「没有可导出文本」。data-node-key 是 rc-tabs 暴露的结构化 tab key,
	//   命中归一表则以长名喂给下游全部 includes 判定;未列键沿用真实文本(八字/紫微等短名本就命中)。
	//   ⚠ 新增主导航技法必须在 aiExportNavKeyCoverage.test.js 三分类表登记(归一/自命中/豁免),哨兵看死。
	const NAV_KEY_EXPORT_LABEL = {
		astrochart: '星盘',
		guolao: '七政四余',
		indiachart: '印度占星',
		sanshiunited: '三式合一',
		jieqichart: '节气盘',
		cnyibu: '其他术数',
	};
	const navNodeKey = topActiveTab ? (topActiveTab.getAttribute('data-node-key') || '') : '';
	if(navNodeKey && NAV_KEY_EXPORT_LABEL[navNodeKey]){
		topLabel = NAV_KEY_EXPORT_LABEL[navNodeKey];
	}
	const topPane = getDirectActivePane(topTabs) || root;

	const context = {
		displayName: topLabel,
		key: 'generic',
		domain: null,
		scopeRoot: topPane,
		topLabel,
		subLabel: '',
		chartType: '',
	};

	const predictiveLabelMap = [
		// 「主限法盘」必须排在「主限法」前:匹配用 subLabel.includes(label),「主限法盘」包含「主限法」。
		{ label: '主限法盘', key: 'primarydirchart', name: '星运-主限法盘' },
		{ label: '主限法', key: 'primarydirect', name: '星运-主限法' },
		{ label: '黄道星释', key: 'zodialrelease', name: '星运-黄道星释' },
		{ label: '法达星限', key: 'firdaria', name: '星运-法达星限' },
		{ label: '界推运', key: 'distributions', name: '星运-界推运' },
		{ label: '年龄推进点', key: 'agepoint', name: '星运-年龄推进点' },
		{ label: '星历', key: 'ephemeris', name: '星运-星历' },
		{ label: '回归轴', key: 'returntimeline', name: '星运-回归轴' },
		{ label: '产前朔望', key: 'prenatalsyzygy', name: '星运-产前朔望' },
		{ label: '小限法', key: 'profection', name: '星运-小限法' },
		{ label: '太阳弧', key: 'solararc', name: '星运-太阳弧' },
		{ label: '太阳返照', key: 'solarreturn', name: '星运-太阳返照' },
		{ label: '月亮返照', key: 'lunarreturn', name: '星运-月亮返照' },
		{ label: '流年法', key: 'givenyear', name: '星运-流年法' },
		{ label: '十年大运', key: 'decennials', name: '星运-十年大运' },
		{ label: '行星年龄', key: 'planetaryages', name: '星运-行星年龄' },
		{ label: '二次推运', key: 'prog', name: '星运-二次推运' },
		{ label: '恒星推运', key: 'vedicprog', name: '星运-恒星推运' },
		{ label: '赤纬推运', key: 'jaynesprog', name: '星运-赤纬推运' },
		{ label: '行星弧', key: 'planetaryarc', name: '星运-行星弧' },
		{ label: '波斯向运', key: 'persiandirected', name: '星运-波斯向运' },
		{ label: '129年系统', key: 'yearsystem129', name: '星运-129年系统' },
		{ label: 'Balbillus', key: 'balbillus', name: '星运-Balbillus' },
		{ label: '三分主星', key: 'triplicityrulers', name: '星运-三分主星' },
		{ label: '数字相位', key: 'keypoints', name: '星运-数字相位' },
		{ label: '月相推运', key: 'lunationphase', name: '星运-月相推运' },
		{ label: '多重回归', key: 'extrareturns', name: '星运-多重回归' },
	];
	const predictiveByTop = predictiveLabelMap.find((item)=>topLabel && topLabel.includes(item.label));
	if(predictiveByTop){
		context.key = predictiveByTop.key;
		context.domain = 'predictive_raw';
		context.displayName = predictiveByTop.name;
		return context;
	}
	// 右侧子标签直接激活时，顶层标题可能不是“星运/量化盘/合盘/印度占星”等；
	// 这里优先按可见标签做直达识别，避免落入 generic 导致导出误判为空。
	if(topLabel.includes('行星中点')){
		context.key = 'germany';
		context.displayName = '量化盘';
		return context;
	}
	if(topLabel.includes('比较盘') || topLabel.includes('组合盘')
		|| topLabel.includes('影响盘') || topLabel.includes('时空中点盘')
		|| topLabel.includes('马克斯盘')){
		context.key = 'relative';
		context.displayName = `合盘-${topLabel}`;
		return context;
	}
	if(topLabel.includes('命盘') || /(^|\s)\d+\s*律盘$/.test(topLabel)){
		context.key = 'indiachart';
		context.displayName = '印度占星';
		return context;
	}
	if(topLabel.includes('节气') || topLabel.includes('春分') || topLabel.includes('夏至')
		|| topLabel.includes('秋分') || topLabel.includes('冬至')){
		context.key = 'jieqi';
		context.displayName = '节气盘';
		return context;
	}
	if(topLabel === '八字' || topLabel.includes('八字')){
		context.key = 'bazi';
		context.displayName = '八字';
		return context;
	}
	if(topLabel.includes('紫微')){
		context.key = 'ziwei';
		context.displayName = '紫微斗数';
		return context;
	}

	if(topLabel.includes('星运') || topLabel.includes('推运盘')){
		const subTabs = findTabsContainerByLabels(topPane, ['主限法', '黄道星释', '法达星限', '小限法', '太阳弧', '太阳返照', '月亮返照', '流年法', '十年大运'], false);
		const subActiveTab = subTabs ? getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active')) : null;
		const subLabel = textOf(subActiveTab);
		context.subLabel = subLabel || '';
		context.scopeRoot = subTabs ? (getDirectActivePane(subTabs) || topPane) : topPane;
		const predictiveBySub = predictiveLabelMap.find((item)=>subLabel && subLabel.includes(item.label));
		if(predictiveBySub){
			context.key = predictiveBySub.key;
			context.domain = 'predictive_raw';
			context.displayName = predictiveBySub.name;
			return context;
		}
		// 子标签识别失败时不要回落到星盘；保留 direction 触发 store 回退，
		// 否则会误读 astrochart 快照并造成“当前页面没有可导出文本”。
		context.key = 'direction';
		context.domain = 'predictive_raw';
		context.displayName = subLabel ? `星运-${subLabel}` : '星运';
		return context;
	}
	const directCnYiBuMap = [
		{ label: '统摄法', key: 'tongshefa', domain: 'tongshefa', name: '统摄法' },
		{ label: '皇极经世', key: 'huangji', domain: 'huangji', name: '皇极经世' },
		{ label: '皇極經世', key: 'huangji', domain: 'huangji', name: '皇极经世' },
		{ label: '五兆', key: 'wuzhao', domain: 'kentang_raw', name: '五兆' },
		{ label: '太玄', key: 'taixuan', domain: 'kentang_raw', name: '太玄筮法' },
		{ label: '荆诀', key: 'jingjue', domain: 'kentang_raw', name: '荆诀' },
		{ label: '荊訣', key: 'jingjue', domain: 'kentang_raw', name: '荆诀' },
		{ label: '神易数', key: 'shenyishu', domain: 'kentang_raw', name: '神易数' },
		{ label: '神易數', key: 'shenyishu', domain: 'kentang_raw', name: '神易数' },
		{ label: '天文地占', key: 'geomancy', domain: 'kentang_raw', name: '天文地占' },
		{ label: '地占', key: 'geomancy', domain: 'kentang_raw', name: '天文地占' },
		{ label: '塔罗', key: 'tarot', domain: 'kentang_raw', name: '塔罗' },
		{ label: '六爻', key: 'sixyao', domain: 'sixyao', name: '六爻' },
		{ label: '易卦', key: 'sixyao', domain: 'sixyao', name: '六爻' },
		{ label: '六壬', key: 'liureng', domain: 'liureng', name: '大六壬' },
		{ label: '金口诀', key: 'jinkou', domain: 'jinkou', name: '金口诀' },
		{ label: '遁甲', key: 'qimen', domain: 'qimen', name: '奇门遁甲' },
		{ label: '太乙', key: 'taiyi', domain: null, name: '太乙' },
	];
	const directCnYiBu = directCnYiBuMap.find((item)=>topLabel && topLabel.includes(item.label));
	if(directCnYiBu){
		context.key = directCnYiBu.key;
		context.domain = directCnYiBu.domain;
		context.displayName = directCnYiBu.name;
		return context;
	}
	if(topLabel.includes('辅盘')){
		const subTabs = findTabsContainerByLabels(topPane, ['量化盘', '十三分盘', '占星地图', '骰子'], false);
		const subActiveTab = subTabs ? getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active')) : null;
		const subLabel = textOf(subActiveTab);
		context.subLabel = subLabel || '';
		context.scopeRoot = subTabs ? (getDirectActivePane(subTabs) || topPane) : topPane;
		// 🔒 显式映射每个辅盘子页 → 对应技法 key。**严禁默认成量化盘(germany)**——否则卜卦/择日/世俗/调波/龙盘点 AI导出全被串成量化盘。
		const auxSubMap = [
			{ label: '卜卦盘', key: 'horary', name: '卜卦盘' },
			{ label: '择日盘', key: 'election', name: '择日盘' },
			{ label: '世俗盘', key: 'mundane', name: '世俗盘' },
			{ label: '十三分盘', key: 'hellenastro', name: '十三分盘' },
			{ label: '十二分盘', key: 'dwadasamsa', name: '十二分盘' },
			{ label: '占星地图', key: 'locastro', name: '占星地图' },
			{ label: '调波盘', key: 'harmonic', name: '调波盘' },
			{ label: '龙盘', key: 'draconic', name: '龙盘' },
			{ label: '换置盘', key: 'relocation', name: '换置盘' },
			{ label: '骰子', key: 'otherbu', name: '骰子' },
			{ label: '量化盘', key: 'germany', name: '量化盘' },
		];
		const auxHit = auxSubMap.find((item)=>subLabel && subLabel.includes(item.label));
		if(auxHit){
			context.key = auxHit.key;
			context.displayName = auxHit.name;
			return context;
		}
		// 子标签识别失败:回落 generic 走 store 兜底,绝不默认量化盘。
		context.key = 'generic';
		context.displayName = subLabel || '辅盘';
		return context;
	}
	if(topLabel.includes('星盘') || topLabel.includes('三维盘')){
		context.key = 'astrochart';
		return context;
	}
	if(topLabel.includes('七政四余')){
		context.key = 'guolao';
		return context;
	}
	if(topLabel.includes('量化盘')){
		context.key = 'germany';
		context.displayName = '量化盘';
		return context;
	}
	if(topLabel.includes('节气盘')){
		context.key = 'jieqi';
		context.displayName = '节气盘';
		return context;
	}
	if(topLabel.includes('印度占星') || topLabel.includes('印度律盘')){
		context.key = 'indiachart';
		context.displayName = '印度占星';
		return context;
	}
	if(topLabel.includes('十三分盘') || topLabel.includes('希腊星术')){
		context.key = 'hellenastro';
		context.displayName = '十三分盘';
		return context;
	}
	if(topLabel.includes('占星地图') || topLabel.includes('星体地图')){
		context.key = 'locastro';
		context.displayName = '占星地图';
		return context;
	}
	if(topLabel.includes('合盘') || topLabel.includes('关系盘')){
		const subTabs = findTabsContainerByLabels(topPane, ['比较盘', '组合盘', '影响盘', '时空中点盘', '马克斯盘'], false);
		const subActiveTab = subTabs ? getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active')) : null;
		const subLabel = textOf(subActiveTab);
		context.key = 'relative';
		context.subLabel = subLabel || '';
		context.scopeRoot = subTabs ? (getDirectActivePane(subTabs) || topPane) : topPane;
		context.displayName = subLabel ? `合盘-${subLabel}` : '合盘';
		return context;
	}
	if(topLabel.includes('骰子') || topLabel.includes('西洋游戏')){
		context.key = 'otherbu';
		context.displayName = '骰子';
		return context;
	}
	if(topLabel.includes('风水')){
		context.key = 'fengshui';
		context.displayName = '风水';
		return context;
	}
	if(topLabel.includes('三式合一')){
		context.key = 'sanshiunited';
		context.domain = 'sanshiunited';
		context.displayName = '三式合一';
		return context;
	}

	if(topLabel.includes('易与三式') || topLabel.includes('其他术数')){
		const subTabs = findTabsContainerByLabels(topPane, ['宿盘', '金口诀', '统摄法', '皇极经世'], false);
		if(!subTabs){
			context.key = 'cnyibu';
			return context;
		}

		const subActiveTab = getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active'));
		const subLabel = textOf(subActiveTab);
		const subPane = getDirectActivePane(subTabs) || topPane;
		context.scopeRoot = subPane;
		context.subLabel = subLabel;

		if(subLabel.includes('易卦') || subLabel.includes('六爻')){
			context.key = 'sixyao';
			context.domain = 'sixyao';
			context.displayName = '六爻';
			return context;
		}

		if(subLabel.includes('统摄法')){
			context.key = 'tongshefa';
			context.domain = 'tongshefa';
			context.displayName = '统摄法';
			return context;
		}

		if(subLabel.includes('皇极经世') || subLabel.includes('皇極經世')){
			context.key = 'huangji';
			context.domain = 'huangji';
			context.displayName = '皇极经世';
			return context;
		}

		if(subLabel.includes('五兆')){
			context.key = 'wuzhao';
			context.domain = 'kentang_raw';
			context.displayName = '五兆';
			return context;
		}

		if(subLabel.includes('太玄')){
			context.key = 'taixuan';
			context.domain = 'kentang_raw';
			context.displayName = '太玄筮法';
			return context;
		}

		if(subLabel.includes('荆诀') || subLabel.includes('荊訣')){
			context.key = 'jingjue';
			context.domain = 'kentang_raw';
			context.displayName = '荆诀';
			return context;
		}

		if(subLabel.includes('神易数') || subLabel.includes('神易數')){
			context.key = 'shenyishu';
			context.domain = 'kentang_raw';
			context.displayName = '神易数';
			return context;
		}

		if(subLabel.includes('六壬')){
			context.key = 'liureng';
			context.domain = 'liureng';
			context.displayName = '大六壬';
			return context;
		}

		if(subLabel.includes('金口诀')){
			context.key = 'jinkou';
			context.domain = 'jinkou';
			context.displayName = '金口诀';
			return context;
		}

		if(subLabel.includes('遁甲')){
			context.key = 'qimen';
			context.domain = 'qimen';
			context.displayName = '奇门遁甲';
			return context;
		}

		if(subLabel.includes('太乙')){
			context.key = 'taiyi';
			context.displayName = '太乙';
			return context;
		}

		if(subLabel.includes('宿盘')){
			const chartType = detectChartTypeInPane(subPane);
			context.chartType = chartType;
			if(chartType.includes('遁甲外盘')){
				context.key = 'qimen';
				context.domain = 'qimen';
				context.displayName = '奇门(遁甲外盘)';
			}else{
				context.key = 'suzhan';
				context.displayName = chartType ? `宿盘(${chartType})` : '宿盘';
			}
			return context;
		}

		context.key = 'cnyibu';
		context.displayName = subLabel || '其他术数';
	}
	if(topLabel.includes('八字紫微') || topLabel.includes('辅助')){
		const subTabs = findTabsContainerByLabels(topPane, ['八卦类象', '十二串宫', '八字规则', '八字', '紫微斗数'], false);
		if(!subTabs){
			context.key = 'cntradition';
			context.displayName = topLabel.includes('辅助') ? '辅助' : '八字紫微';
			return context;
		}
		const subActiveTab = getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active'));
		const subLabel = textOf(subActiveTab);
		const subPane = getDirectActivePane(subTabs) || topPane;
		context.scopeRoot = subPane;
		context.subLabel = subLabel;
		if(subLabel.includes('八字')){
			context.key = 'bazi';
			context.displayName = '八字';
			return context;
		}
		if(subLabel.includes('紫微')){
			context.key = 'ziwei';
			context.displayName = '紫微斗数';
			return context;
		}
		context.key = 'cntradition';
		context.displayName = subLabel || (topLabel.includes('辅助') ? '辅助' : '八字紫微');
		return context;
	}

	return context;
}

export function resolveContextByAstroState(){
	try{
		const store = getStore();
		const astro = store && store.astro ? store.astro : null;
		if(!astro){
			return null;
		}
		const topTab = `${astro.currentTab || ''}`;
		const subTab = `${astro.currentSubTab || ''}`;
		if(!topTab){
			return null;
		}
		const predictiveMap = {
			primarydirect: { key: 'primarydirect', displayName: '星运-主限法', domain: 'predictive_raw' },
			primarydirchart: { key: 'primarydirchart', displayName: '星运-主限法盘', domain: 'predictive_raw' },
			zodialrelease: { key: 'zodialrelease', displayName: '星运-黄道星释', domain: 'predictive_raw' },
			firdaria: { key: 'firdaria', displayName: '星运-法达星限', domain: 'predictive_raw' },
			distributions: { key: 'distributions', displayName: '星运-界推运', domain: 'predictive_raw' },
			agepoint: { key: 'agepoint', displayName: '星运-年龄推进点', domain: 'predictive_raw' },
			ephemeris: { key: 'ephemeris', displayName: '星运-星历', domain: 'predictive_raw' },
			returntimeline: { key: 'returntimeline', displayName: '星运-回归轴', domain: 'predictive_raw' },
			prenatalsyzygy: { key: 'prenatalsyzygy', displayName: '星运-产前朔望', domain: 'predictive_raw' },
			profection: { key: 'profection', displayName: '星运-小限法', domain: 'predictive_raw' },
			solararc: { key: 'solararc', displayName: '星运-太阳弧', domain: 'predictive_raw' },
			solarreturn: { key: 'solarreturn', displayName: '星运-太阳返照', domain: 'predictive_raw' },
			lunarreturn: { key: 'lunarreturn', displayName: '星运-月亮返照', domain: 'predictive_raw' },
			givenyear: { key: 'givenyear', displayName: '星运-流年法', domain: 'predictive_raw' },
			decennials: { key: 'decennials', displayName: '星运-十年大运', domain: 'predictive_raw' },
			planetaryages: { key: 'planetaryages', displayName: '星运-行星年龄', domain: 'predictive_raw' },
			prog: { key: 'prog', displayName: '星运-二次推运', domain: 'predictive_raw' },
			vedicprog: { key: 'vedicprog', displayName: '星运-恒星推运', domain: 'predictive_raw' },
			jaynesprog: { key: 'jaynesprog', displayName: '星运-赤纬推运', domain: 'predictive_raw' },
			planetaryarc: { key: 'planetaryarc', displayName: '星运-行星弧', domain: 'predictive_raw' },
			persiandirected: { key: 'persiandirected', displayName: '星运-波斯向运', domain: 'predictive_raw' },
			yearsystem129: { key: 'yearsystem129', displayName: '星运-129年系统', domain: 'predictive_raw' },
			balbillus: { key: 'balbillus', displayName: '星运-Balbillus', domain: 'predictive_raw' },
			triplicityrulers: { key: 'triplicityrulers', displayName: '星运-三分主星', domain: 'predictive_raw' },
			keypoints: { key: 'keypoints', displayName: '星运-数字相位', domain: 'predictive_raw' },
			lunationphase: { key: 'lunationphase', displayName: '星运-月相推运', domain: 'predictive_raw' },
			extrareturns: { key: 'extrareturns', displayName: '星运-多重回归', domain: 'predictive_raw' },
		};
		const auxchartMap = {
			germanytech: { key: 'germany', displayName: '量化盘' },
			hellenastro: { key: 'hellenastro', displayName: '十三分盘' },
			// 十二分盘/谐波盘/黄道分盘/换置盘 皆由本命盘派生的占星式衍生盘,导出复用星盘式预设。
			dwadasamsa: { key: 'dwadasamsa', displayName: '十二分盘' },
			harmonic: { key: 'harmonic', displayName: '谐波盘' },
			draconic: { key: 'draconic', displayName: '黄道分盘' },
			relocation: { key: 'relocation', displayName: '换置盘' },
			locastro: { key: 'locastro', displayName: '占星地图' },
			otherbu: { key: 'otherbu', displayName: '骰子' },
			mundane: { key: 'mundane', displayName: '世俗盘' },
			// 卜卦盘/择日盘 在辅盘页亦可单开(与顶层同术),各归本预设,勿 fallback 到量化盘。
			horary: { key: 'horary', displayName: '卜卦盘', domain: 'horary' },
			election: { key: 'election', displayName: '择日盘', domain: 'election' },
			babylon: { key: 'babylon', displayName: '巴比伦占星' },
		};
		const cnyibuMap = {
			suzhan: { key: 'suzhan', displayName: '宿盘' },
			guazhan: { key: 'sixyao', displayName: '六爻', domain: 'sixyao' },
			liureng: { key: 'liureng', displayName: '大六壬', domain: 'liureng' },
			jinkou: { key: 'jinkou', displayName: '金口诀', domain: 'jinkou' },
			dunjia: { key: 'qimen', displayName: '奇门遁甲', domain: 'qimen' },
			taiyi: { key: 'taiyi', displayName: '太乙' },
			tongshefa: { key: 'tongshefa', displayName: '统摄法', domain: 'tongshefa' },
			huangji: { key: 'huangji', displayName: '皇极经世', domain: 'huangji' },
			wuzhao: { key: 'wuzhao', displayName: '五兆', domain: 'kentang_raw' },
			taixuan: { key: 'taixuan', displayName: '太玄筮法', domain: 'kentang_raw' },
			jingjue: { key: 'jingjue', displayName: '荆诀', domain: 'kentang_raw' },
			shenyishu: { key: 'shenyishu', displayName: '神易数', domain: 'kentang_raw' },
			geomancy: { key: 'geomancy', displayName: '天文地占', domain: 'kentang_raw' },
			tarot: { key: 'tarot', displayName: '塔罗', domain: 'kentang_raw' },
			// 轨策不带 domain:其快照由前端引擎构成规整之表,无须后端原文那套符号替换器。
			guice: { key: 'guice', displayName: '皇极轨策' },
			xiaoliuren: { key: 'xiaoliuren', displayName: '小六壬' },
			xiaochengtu: { key: 'xiaochengtu', displayName: '小成图' },
			feigong: { key: 'feigong', displayName: '飞宫小奇门' },
			// 灵棋经不带 domain:快照由前端引擎(lingqiSnapshot)构成,无须后端原文符号替换器(照轨策)。
			lingqi: { key: 'lingqi', displayName: '灵棋经' },
		};
		switch(topTab){
		case 'astrochart':
			return { key: 'astrochart', displayName: '星盘' };
		case 'astrochart3D':
			return { key: 'astrochart', displayName: '三维盘' };
		case 'bazi':
			return { key: 'bazi', displayName: '八字' };
		case 'ziwei':
			return { key: 'ziwei', displayName: '紫微斗数' };
		case 'guazhan':
			return { key: 'sixyao', displayName: '六爻', domain: 'sixyao' };
		case 'liureng':
			return { key: 'liureng', displayName: '大六壬', domain: 'liureng' };
		case 'dunjia':
			return { key: 'qimen', displayName: '奇门遁甲', domain: 'qimen' };
		case 'taiyi':
			return { key: 'taiyi', displayName: '太乙' };
		case 'direction':
			return predictiveMap[subTab] || predictiveMap.primarydirect;
		case 'germanytech':
			return { key: 'germany', displayName: '量化盘' };
		case 'auxchart':
			return auxchartMap[subTab] || auxchartMap.germanytech;
		case 'relativechart':
			return { key: 'relative', displayName: '合盘' };
		case 'jieqichart':
			return { key: 'jieqi', displayName: '节气盘' };
		case 'locastro':
			return { key: 'locastro', displayName: '占星地图' };
		case 'hellenastro':
			return { key: 'hellenastro', displayName: '十三分盘' };
		case 'indiachart':
			return { key: 'indiachart', displayName: '印度占星' };
		case 'cntradition':
			if(subTab === 'bazi'){
				return { key: 'bazi', displayName: '八字' };
			}
			if(subTab === 'ziwei'){
				return { key: 'ziwei', displayName: '紫微斗数' };
			}
			return { key: 'cntradition', displayName: '辅助' };
		case 'cnyibu': {
			// 🔴 兜底之前先喊一声 —— 漏登记者旧时【静默】落宿盘:人在轨策页上点导出,
			//    导出的却是宿盘,而头里还写着「当前激活技术面板专属导出」。geomancy/tarot/guice
			//    三个都这么漏了许久,直到真机点了一次导出才现形(builder 单测照不到此处)。
			const cnyibuTab = getRuntimeCnYiBuTab() || subTab;
			const hit = cnyibuMap[getRuntimeCnYiBuTab()] || cnyibuMap[subTab];
			if(!hit && cnyibuTab){
				console.warn(`[aiExport] 「${cnyibuTab}」未登记于 cnyibuMap —— 将误导成宿盘。请在该表补一行。`);
			}
			return hit || cnyibuMap.suzhan;
		}
		case 'guolao':
			if(getStoredGuolaoEngineModeForExport() === 'kinastro'){
				return { key: 'qizhengkin', displayName: '七政四余（七政）', domain: 'kentang_raw' };
			}
			return { key: 'guolao', displayName: '七政四余' };
		case 'shusuan': {
			const technique = getRuntimeKinAstroTechnique('shusuan') || 'shaozi';
			return KINASTRO_EXPORT_CONTEXTS[technique] || KINASTRO_EXPORT_CONTEXTS.shaozi;
		}
		case 'yanqin':
			return KINASTRO_EXPORT_CONTEXTS.xianqin;
		case 'mingother': {
			// 「其他」页同 moduleKey 承载策天飞星/一掌经，按运行时激活子技法取上下文（默认策天）。
			const mingTech = getRuntimeKinAstroTechnique('mingother');
			if(mingTech === 'yizhangjing'){
				return KINASTRO_EXPORT_CONTEXTS.yizhangjing;
			}
			// 演禽页签在命·其他内激活时 runtime 技法=xianqin,此前只认一掌经、其余回策天 → 导出拿到策天盘。
			if(mingTech === 'xianqin'){
				return KINASTRO_EXPORT_CONTEXTS.xianqin;
			}
			return KINASTRO_EXPORT_CONTEXTS.cetian;
		}
		case 'otherbu':
			return { key: 'otherbu', displayName: '骰子' };
		case 'fengshui':
			return { key: 'fengshui', displayName: '风水' };
		case 'sanshiunited':
			return { key: 'sanshiunited', displayName: '三式合一', domain: 'sanshiunited' };
		case 'zeri':
			// 择日页按子技法分流(store 兜底根治:「择日」是子技法名的子串,DOM 启发式易串成辅盘择日盘)
			if(subTab === 'qimenzeri'){
				return { key: 'qimenzeri', displayName: '奇门择日' };
			}
			if(subTab === 'huanglizeri'){
				return { key: 'huanglizeri', displayName: '黄历择日' };
			}
			if(subTab === 'bazizeri'){
				return { key: 'bazizeri', displayName: '八字择日' };
			}
			if(subTab === 'taiyizeri'){
				return { key: 'taiyizeri', displayName: '太乙择日' };
			}
			if(subTab === 'ziweizeri'){
				return { key: 'ziweizeri', displayName: '紫微择日' };
			}
			if(subTab === 'liurengzeri'){
				return { key: 'liurengzeri', displayName: '六壬择日' };
			}
			if(subTab === 'sanshizeri'){
				return { key: 'sanshizeri', displayName: '三式择日' };
			}
			if(subTab === 'qizhengzeri'){
				return { key: 'qizhengzeri', displayName: '七政择日' };
			}
			if(subTab === 'indiazeri'){
				return { key: 'indiazeri', displayName: '印度择日' };
			}
			return { key: 'tianxing', displayName: '天星择日' };
		case 'calendar': {
			// 按当前子 tab 分流:老黄历/通书 → 独立键(preset/挂载早有,导出链曾不可达=两键
			// 设置面可勾恒无效);农历主 tab 与日子馆仍走 calendar 聚合(rizi 无独立 preset 键)。
			const calTab = getRuntimeCalendarTab();
			if(calTab === 'huangli'){
				return { key: 'huangli', displayName: '老黄历' };
			}
			if(calTab === 'tongshu'){
				return { key: 'tongshu', displayName: '通书择日' };
			}
			return { key: 'calendar', displayName: '黄历' };
		}
		default:
			return null;
		}
	}catch(e){
		return null;
	}
}

export function withStoreContextFallback(context){
	const base = context && typeof context === 'object'
		? { ...context }
		: { key: 'generic', displayName: '当前技术', domain: null, scopeRoot: null };
	const fallback = resolveContextByAstroState();
	if(!fallback || !fallback.key){
		return base;
	}
	const baseKey = `${base.key || ''}`;
	const fallbackKey = `${fallback.key || ''}`;
	const baseKnown = AI_EXPORT_TECHNIQUES.some((item)=>item.key === baseKey);
	const fallbackSpecific = !!fallbackKey && fallbackKey !== 'generic';
	const isBaseUmbrella = baseKey === 'generic'
		|| baseKey === 'cntradition'
		|| baseKey === 'cnyibu'
		|| baseKey === 'direction';
	const shouldUseFallback = !baseKey
		|| !baseKnown
		|| isBaseUmbrella
		|| (baseKey === 'guolao' && fallbackKey === 'qizhengkin')
		|| (baseKey === fallbackKey && fallbackSpecific);
	if(!shouldUseFallback){
		return base;
	}
	return {
		...base,
		...fallback,
	};
}

export function detectJieQiSettingKeyByCurrentSnapshot(){
	const current = `${getModuleCachedContent('jieqi_current') || ''}`;
	return detectJieQiSettingKeyByLabel(current) || 'jieqi_meta';
}

function detectJieQiSettingKeyByLabel(label){
	const txt = `${label || ''}`;
	if(txt.includes('春分')){
		return 'jieqi_chunfen';
	}
	if(txt.includes('夏至')){
		return 'jieqi_xiazhi';
	}
	if(txt.includes('秋分')){
		return 'jieqi_qiufen';
	}
	if(txt.includes('冬至')){
		return 'jieqi_dongzhi';
	}
	return '';
}

export function detectJieQiSettingKeyByScope(scopeRoot){
	const tab = findTabsContainerByLabels(scopeRoot, ['春分', '夏至', '秋分', '冬至'], false);
	if(!tab){
		return '';
	}
	const active = getTabsNavItems(tab).find((n)=>n.classList.contains('ant-tabs-tab-active'));
	return detectJieQiSettingKeyByLabel(textOf(active));
}

export function resolveExportContextForPayload(rawContext){
	const context = rawContext && typeof rawContext === 'object'
		? { ...rawContext }
		: { key: 'generic', displayName: '当前页面' };
	if(context.key === 'direction'){
		return {
			...context,
			key: 'primarydirect',
			displayName: context.displayName || '星运-主限法',
		};
	}
	if(context.key === 'jieqi'){
		const splitKey = detectJieQiSettingKeyByScope(context.scopeRoot) || detectJieQiSettingKeyByCurrentSnapshot();
		if(splitKey){
			return {
				...context,
				key: splitKey,
				displayName: getTechniqueLabelByKey(splitKey) || context.displayName || '节气盘',
			};
		}
	}
	return context;
}

const KINASTRO_EXPORT_CONTEXTS = {
	shaozi: { key: 'shaozi', displayName: '邵子神数', domain: 'kentang_raw' },
	tieban: { key: 'tieban', displayName: '铁板神数', domain: 'kentang_raw' },
	fendjing: { key: 'fendjing', displayName: '鬼谷分定经', domain: 'kentang_raw' },
	beiji: { key: 'beiji', displayName: '北极神数', domain: 'kentang_raw' },
	nanji: { key: 'nanji', displayName: '南极神数', domain: 'kentang_raw' },
	chunzi: { key: 'chunzi', displayName: '蠢子数', domain: 'kentang_raw' },
	xianqin: { key: 'xianqin', displayName: '万化仙禽', domain: 'kentang_raw' },
	cetian: { key: 'cetian', displayName: '策天飞星', domain: 'kentang_raw' },
	canping: { key: 'canping', displayName: '邵子参评数' },   // 原生·模块快照（非 kentang）
	heluo: { key: 'heluo', displayName: '河洛理数' },
	zhengchuan: { key: 'zhengchuan', displayName: '神数正传' },   // 原生·模块快照（非 kentang）
	yizhangjing: { key: 'yizhangjing', displayName: '一掌经' },
};

function getRuntimeKinAstroTechnique(group){
	try{
		if(typeof window === 'undefined'){
			return '';
		}
		const raw = window.__horosaKinAstroCurrent;
		if(raw && typeof raw === 'object'){
			if(group && raw[group]){
				return `${raw[group]}`;
			}
			if(raw.technique){
				return `${raw.technique}`;
			}
		}
		if(typeof raw === 'string'){
			return raw;
		}
		if(window.__horosaKinAstroTechnique){
			return `${window.__horosaKinAstroTechnique}`;
		}
	}catch(e){
	}
	return '';
}

// 黄历页当前子 tab(CalendarMain.changeTab 写入,__horosaCnyibuCurrentTab 同范式)。
function getRuntimeCalendarTab(){
	try{
		if(typeof window !== 'undefined' && window.__horosaCalendarCurrentTab){
			return `${window.__horosaCalendarCurrentTab}`;
		}
	}catch(e){
	}
	return '';
}

function getRuntimeCnYiBuTab(){
	try{
		if(typeof window !== 'undefined' && window.__horosaCnyibuCurrentTab){
			return `${window.__horosaCnyibuCurrentTab}`;
		}
	}catch(e){
	}
	return '';
}

function getStoredGuolaoEngineModeForExport(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage.getItem('horosa.guolao.engineMode') === 'kinastro' ? 'kinastro' : 'horosa';
		}
	}catch(e){
	}
	return 'horosa';
}

export function getCurrentAIExportContext(){
	try{
		const context = resolveExportContextForPayload(withStoreContextFallback(resolveActiveContext()));
		return {
			key: context.key,
			displayName: context.displayName,
		};
	}catch(e){
		return {
			key: 'generic',
			displayName: '当前页面',
		};
	}
}
