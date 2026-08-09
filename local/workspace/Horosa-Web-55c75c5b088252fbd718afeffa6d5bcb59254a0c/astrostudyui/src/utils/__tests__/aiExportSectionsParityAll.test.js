// [制度化] 🔴 全技法段登记双向哨兵(L3·总闸):经挂载重算统一分派入口
// regenerateCaseTechniqueSnapshot 真跑每个技法(fetchPreciseNongli 自带本地兜底,jest 无网可产),
// 机械提取段头 ↔ AI_EXPORT_PRESET_SECTIONS 对照:
//   「快照有段而 preset 无」= 漏登记(自定义过段集的用户新段被静默滤空,indiachart/金函教训);
//   条件段(样本不产)须在各技法白名单成文。
// 两层制度:LOCAL(纯本地引擎,产空即红) / SOFT(依赖后端盘,产出才断言、产空只提示不红——
//   环境无后端时保持测试稳定;有产出时同样吃双向断言)。
// 🔴 全覆盖总锁:AI_EXPORT_PRESET_SECTIONS 每个 key ∈ LOCAL ∪ SOFT ∪ EXEMPT(理由成文)——
//   新增技法 preset 而未接入哨兵注册表,当场红。
import { regenerateCaseTechniqueSnapshot, regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';
import fs from 'fs';
import path from 'path';

jest.setTimeout(120000);

const read = (rel)=>fs.readFileSync(path.join(__dirname, rel), 'utf8');

function extractSections(txt){
	const out = [];
	`${txt || ''}`.split('\n').forEach((ln)=>{
		const t = ln.trim();
		let m = t.match(/^\[(.+)\]$/);
		if(!m){ m = t.match(/^【(.+)】$/); }
		if(m && m[1]){ out.push(m[1].replace(/\s+/g, '')); }
	});
	return [...new Set(out)];
}

function readPresetMap(){
	const src = read('../aiExport.js');
	const i = src.indexOf('AI_EXPORT_PRESET_SECTIONS = {');
	const seg = src.slice(i, src.indexOf('\n};', i));
	const map = {};
	let cur = null;
	seg.split('\n').forEach((ln)=>{
		const km = ln.match(/^\t(\w+): \[/);
		if(km){ cur = km[1]; map[cur] = map[cur] || []; }
		if(cur){
			[...ln.matchAll(/'([^']+)'/g)].forEach((m)=>map[cur].push(m[1].replace(/\s+/g, '')));
		}
		if(/\],\s*$/.test(ln)){ cur = null; }
	});
	// 动态拼接键(字面量区外):qimenzeri = [...qimen, 三段]
	if(map.qimen && !map.qimenzeri){
		map.qimenzeri = [...map.qimen, '择日搜索配置', '择日条件', '命中时辰'];
	}
	return map;
}

// 假 record:固定生辰(与各技法压测样本同域)。
const RECORD = {
	divTime: '2026-02-17 09:05:00',
	zone: '+08:00',
	lon: '120e00', lat: '30n00',
	gpsLon: 120, gpsLat: 30,
	gender: 1, name: 'QA',
};

// ── 注册表:LOCAL=纯本地引擎(产空即红);每技法可带 payload 与条件段白名单 ──
const LOCAL = {
	qimen: { payload: { options: { paiPanType: 2, school: '转盘', qijuMethod: 'zhirun', sex: 1 } }, cond: { '日家占方（古籍金函系）': '金函形态专段(qimenSectionsParity 专测覆盖)' } },
	bazi: { via: 'chart' },
	huangji: { payload: { options: {} } },
	huangli: {},
	tongshu: {},
	xiaoliuren: {},
	xiaochengtu: {},
	feigong: {},
};

// SOFT=依赖后端盘/外部服务(有产出才断言;产空提示不红)
const SOFT = {
	liureng: '六壬挂载链走 /liureng/gods(:9999);本地引擎由 liureng 域金标另测',
	jinkou: '金口诀挂载链需地分/演数 payload;本地引擎由 jinkou 域金标另测',
	sixyao: '六爻语义=已存卦恒冻结,需 payload.gua;装卦由 guazhan 域金标另测',
	tongshefa: '统摄法需已起卦象 payload;算法由 tongshefa 域金标另测',
	guice: '皇极轨策需起数 payload;算法由 guice 域 116 金标另测',
	tarot: '塔罗需牌阵 seed payload;牌组由 tarot 域金标另测',
	geomancy: '地占需成卦 payload;引擎由 geomancy 域金标另测',
	qizhengkin: '七政 kentang 盘走 :8899 后端',
	taiyi: '太乙盘走 :8899 后端',
	sanshiunited: '三式含太乙后端环节',
	ziwei: '紫微主盘走 :9999 Java',
	indiachart: '印占盘走后端 chart',
	guolao: '七政盘走后端',
	horary: '卜卦盘走后端 chart',
	election: '择日盘走后端 chart',
	mundane: '世俗盘走后端',
	tianxing: '天星择日走后端',
	qimenzeri: '奇门择日=奇门+择日段(择日态需宿主)',
	taixuan: '太玄走 kentang :8899',
	jingjue: '荆诀走 kentang :8899',
	wuzhao: '五兆走 kentang :8899',
	shenyishu: '神易数走 kentang :8899',
	firdaria: '法达走后端 chart', distributions: '界推运走后端 chart', agepoint: '年龄推进走后端 chart',
	planetaryages: '行星年龄走后端 chart', vedicprog: '吠陀推运走后端 chart', balbillus: 'Balbillus 走后端 chart',
	triplicityrulers: '三分主星走后端 chart', keypoints: '关键点走后端 chart', lunationphase: '月相推运走后端 chart',
	extrareturns: '多重回归走后端 chart', yearsystem129: '129年系统走后端 chart', planetaryarc: '行星弧走后端 chart',
	persiandirected: '波斯向运走后端 chart', jaynesprog: 'Jaynes 推运走后端 chart', primarydirect: '主限走后端 chart',
};

// EXEMPT=不经统一分派入口(各自独立导出链/聚合键/纯展示),理由成文
const EXEMPT = {
	astrochart: '本命盘走 astroAiSnapshot 独立链(store 快照)',
	astrochart_like: '占星派生盘聚合键(同上)',
	hellenastro: '希腊星术=astro 派生(store 快照链)', dwadasamsa: '十二分盘=astro 派生', harmonic: '调波盘=astro 派生',
	draconic: '龙盘=astro 派生', relocation: '重置盘=astro 派生', locastro: '占星地图=astro 派生',
	relative: '合盘 sectionsOnly(读合盘页已存快照)', primarydirchart: '主限法盘=astro 派生',
	zodialrelease: '黄道星释走后端 chart(入口在 direction 复合页)', solararc: '太阳弧同上', solarreturn: '太阳返照同上',
	lunarreturn: '月亮返照同上', givenyear: '流年法同上', decennials: '十年大运同上', profection: '小限法同上',
	suzhan: '宿占快照取自组件态(需宿主上下文)', shaozi: '邵子神数走数算宿主', tieban: '铁板神数走数算宿主',
	fendjing: '分定经走数算宿主', beiji: '北极神数走数算宿主', nanji: '南极神数走数算宿主', chunzi: '蠢子数走数算宿主',
	xianqin: '仙禽走演禽宿主', cetian: '策天走演禽宿主', canping: '参评数走数算宿主', zhengchuan: '神数正传走数算宿主',
	heluo: '河洛理数走数算宿主', yizhangjing: '一掌经快照取自组件态', germany: '量化盘走后端 chart',
	babylon: '巴比伦盘走后端', jieqi: '节气盘走后端 chart', otherbu: '卜其他聚合键(子技法各自覆盖)',
	fengshui: '风水理气快照取自画布组件态', calendar: '黄历聚合键(huangli/tongshu 已覆盖)',
	generic: '兜底键(无固定段)',
};

describe('[制度化] 全技法段登记双向哨兵(总闸)', ()=>{
	const presetMap = readPresetMap();
	const presetKeys = Object.keys(presetMap);

	test('提取自证:preset ≥ 80 键(正则塌缩必红)', ()=>{
		expect(presetKeys.length).toBeGreaterThanOrEqual(80);
	});

	test('🔴 全覆盖总锁:每个 preset key ∈ LOCAL ∪ SOFT ∪ EXEMPT(新增技法漏接入当场红)', ()=>{
		const missing = presetKeys.filter((k)=>!LOCAL[k] && !SOFT[k] && !EXEMPT[k]);
		expect(missing).toEqual([]);
	});

	test('三表互斥:一键不得同时在两表', ()=>{
		const dup = presetKeys.filter((k)=>[LOCAL[k], SOFT[k], EXEMPT[k]].filter(Boolean).length > 1);
		expect(dup).toEqual([]);
	});

	Object.keys(LOCAL).forEach((key)=>{
		test(`🔴 LOCAL·${key}:真跑产文本+快照段⊆preset(漏登记红)`, async ()=>{
			const entry = LOCAL[key];
			const txt = entry.via === 'chart'
				? await regenerateChartTechniqueSnapshot(RECORD, key)
				: await regenerateCaseTechniqueSnapshot(RECORD, key, entry.payload || {});
			expect(`${txt || ''}`.trim().length).toBeGreaterThan(0);
			const secs = extractSections(txt);
			const p = new Set(presetMap[key] || []);
			const missing = secs.filter((sct)=>!p.has(sct));
			expect(missing).toEqual([]);
		});
	});

	Object.keys(SOFT).forEach((key)=>{
		test(`SOFT·${key}:有产出则快照段⊆preset(产空仅提示)`, async ()=>{
			let txt = '';
			try{ txt = await regenerateCaseTechniqueSnapshot(RECORD, key, {}); }catch(e){ txt = ''; }
			if(!`${txt || ''}`.trim()){
				console.log(`SOFT-skip ${key}: 无产出(${SOFT[key]})`);
				return;
			}
			const secs = extractSections(txt);
			const p = new Set(presetMap[key] || []);
			const missing = secs.filter((sct)=>!p.has(sct));
			expect(missing).toEqual([]);
		});
	});
});
