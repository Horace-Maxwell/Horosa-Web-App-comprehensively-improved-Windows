// 十家行时长归因审计网 —— 「时长颗粒度确保全技法修复」的永久机械保证。
// 不变量:恒真树(L∨¬L,pass 恒真)下,结果行的每个**内部边界**都必须能被「独立锚面」解释:
//   钟表时辰界(时支变)∨ 家特有真变盘事件(换日四柱变/节气月柱变/朔安星元组变/子正换局/中气换将)。
// 解释不了的边界 = 假劈(十一轮六壬 diurnal 病族)→ 红 → 按掩码协议修。
// 锚面全部独立于 plateKey 实现(时支由墙钟直算;家面从盘判定键直读)——防循环论证。
// 窗口 2026-08-31 起:含白露(09-07)/秋分(09-23,兼中气换将)/朔(09-11)/每日换日,事件全覆盖。
// 分钟级三家(天星/七政/印度)=连续量语义,行时长任意合法,永不加粒度断言(文档锚,勿删)。
import { scanBazi, computeBaziScanPan } from '../baziZeriScanEngine';
import { scanZiwei, computeZiweiScanPan } from '../ziweiZeriScanEngine';
import { scanTaiyi, computeTaiyiScanPan } from '../taiyiZeriScanEngine';
import { scanLiureng, computeLiurengScanPan } from '../liurengZeriScanEngine';
import { scanQimen, computeQimenScanPan, buildQimenScanSeeds } from '../qimenScanEngine';
import { scanHuangli } from '../huangliZeriScanEngine';
import { zoneOffsetMinutes, msToWall, wallDateStr, wallTimeStr } from '../hourlyScanEngine';

jest.setTimeout(300000);

const GEO = { zone: '+08:00', gpsLon: 116.46, gpsLat: 39.9, lon: 116.46, lat: 39.9 };
const OFFSET = zoneOffsetMinutes(GEO.zone);
const MIN = 60000;
const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 恒真树:L ∨ ¬L(引擎树形态直构;叶 params=该类 defaults,真假无关恒真成立)。
const tautology = (leafType, params)=>({
	type: 'any',
	conditions: [
		{ type: leafType, params },
		{ type: 'not', conditions: [{ type: leafType, params }] },
	],
});

const panArgsAt = (ms)=>{
	const w = msToWall(ms, OFFSET);
	return [wallDateStr(w), wallTimeStr(w)];
};

// 逐内部边界归因:家锚面(各家判定面直读,时支/四柱/局/月将全在内——盘自身口径,
// 真太阳时/钟表时随家而定,锚天然同口径;首跑教训:外推钟表时辰界=口径错假红)。
async function auditBoundaries({ name, scan, cfg, tree, famAnchor }){
	const res = await scan({ cfg, geoParams: GEO, options: {}, tree });
	expect(res.intervals.length).toBeGreaterThan(0);
	const offenders = [];
	const rows = res.intervals;
	for(let i = 0; i < rows.length; i++){
		const r = rows[i];
		const isLast = i === rows.length - 1;
		// 恒真树:相邻行必须共点(pass 恒真,断行只因盘面)——缝隙=覆盖漏,另一类病。
		if(!isLast && rows[i + 1].startMs !== r.endMs){
			offenders.push(`${name} 恒真树相邻行有缝隙 ${r.end} → ${rows[i + 1].start}`);
		}
		if(isLast){ continue; }
		const b = r.endMs;
		const a1 = famAnchor(...panArgsAt(b - MIN));
		const a2 = famAnchor(...panArgsAt(b));
		const famFlip = `${a1}` !== `${a2}` && `${a1}` !== '' && `${a2}` !== '';
		if(!famFlip){
			offenders.push(`${name} 边界无因(锚面未变=疑似假劈) @${r.end} [${a1}]`);
		}
	}
	return { offenders, rows };
}

describe('[十二轮] 行时长归因审计:时辰粒度五家(恒真树内部边界全归因)', ()=>{
	const CFG30 = { startDate: '2026-08-31', startTime: '00:00', endDate: '2026-09-29', endTime: '23:59' };

	it('🔴 八字:边界=时辰界∪四柱变(换日/节气);无第三种', async ()=>{
		const { offenders } = await auditBoundaries({
			name: 'bazi',
			scan: scanBazi,
			cfg: CFG30,
			tree: tautology('nayin_full', { values: ['海中金'], pillars: [], matchMode: 'any' }),
			famAnchor: (d, t)=>{
				const pan = computeBaziScanPan(GEO, {}, d, t);
				if(!pan || !pan.four){ return ''; }
				const g = (k)=>(pan.four[k] && (pan.four[k].ganzi || pan.four[k].ganZhi)) || '';
				return `${g('year')}|${g('month')}|${g('day')}|${g('time')}`;
			},
		});
		expect(offenders).toEqual([]);
	});

	it('🔴 紫微:边界=时辰界∪安星元组变(朔 09-11/换日);无第三种', async ()=>{
		const { offenders } = await auditBoundaries({
			name: 'ziwei',
			scan: scanZiwei,
			cfg: CFG30,
			tree: tautology('ming_gong_zhi', { values: ['子'] }),
			famAnchor: (d, t)=>{
				const pan = computeZiweiScanPan(GEO, {}, d, t);
				if(!pan){ return ''; }
				const a = pan.anchorMD || {};
				return [pan.yearGan, pan.yearZi, a.m, a.leap ? 1 : 0, a.d, pan.timeZi].join('#');
			},
		});
		expect(offenders).toEqual([]);
	});

	it('🔴 六壬:边界=时辰界∪日柱/月将变(秋分 09-23 中气换将在窗内);无第三种(diurnal 已掩)', async ()=>{
		const { offenders } = await auditBoundaries({
			name: 'liureng',
			scan: scanLiureng,
			cfg: CFG30,
			tree: tautology('chuan_zhi', { pos: 'any', values: ['子'] }),
			famAnchor: (d, t)=>{
				const pan = computeLiurengScanPan(GEO, {}, d, t);
				if(!pan){ return ''; }
				const fc = pan.fourColumns || {};
				const g = (k)=>(fc[k] && (fc[k].ganzi || fc[k].ganZhi)) || '';
				return `${g('day')}#${g('time').charAt(1)}#${pan.yue}`;
			},
		});
		expect(offenders).toEqual([]);
	});

	it('🔴 奇门:边界=时辰界∪局/日柱变(白露 09-07·秋分 09-23 翻局);无第三种', async ()=>{
		const seeds = buildQimenScanSeeds(2026, 2026, GEO.zone);
		const { offenders } = await auditBoundaries({
			name: 'qimen',
			scan: scanQimen,
			cfg: CFG30,
			tree: tautology('door', { values: ['开门'], palaces: [], matchMode: 'any' }),
			famAnchor: (d, t)=>{
				const pan = computeQimenScanPan(GEO, {}, seeds, d, t);
				if(!pan){ return ''; }
				const gz = pan.ganzhi || {};
				// 判定面契约副本(独立手列,勿改成复用 plateKeyOf——那是循环论证零判别力):
				// 门/星/神/干 + 六旗标 + 值符值使名。两次实抓:①时柱与 cells 界亚分钟口径差
				// ②相邻时辰布局近同时仅 isZhiFu/isZhiShi 标记位变——旗标同为 palace_flag 判定面。
				const cells = (pan.cells || []).map((c)=>[
					c.door || '', c.tianXing || '', c.god || '', c.tianGan || '', c.diGan || '',
					c.hasJiXing ? 1 : 0, c.hasRuMu ? 1 : 0, c.hasMenPo ? 1 : 0, c.hasKongWang ? 1 : 0,
					c.isYiMa ? 1 : 0, c.isZhiFu ? 1 : 0, c.isZhiShi ? 1 : 0,
				].join('')).join('|');
				return `${pan.juText}#${pan.zhiFu || ''}#${pan.zhiShi || ''}#${gz.day || ''}#${gz.time || ''}#${cells}`;
			},
		});
		expect(offenders).toEqual([]);
	});

	it('🔴 太乙(4 天窗):边界=时辰界∪局变(子正积日换局);无第三种', async ()=>{
		const { offenders } = await auditBoundaries({
			name: 'taiyi',
			scan: scanTaiyi,
			cfg: { startDate: '2026-08-31', startTime: '00:00', endDate: '2026-09-03', endTime: '23:59' },
			tree: tautology('yinyang_ju', { value: '阳' }),
			famAnchor: (d, t)=>{
				const pan = computeTaiyiScanPan(GEO, {}, d, t);
				return (pan && pan.kook && pan.kook.text) || '';
			},
		});
		expect(offenders).toEqual([]);
	});
});

describe('[十二轮] 行时长归因审计:黄历(日粒度)', ()=>{
	it('🔴 恒真树整窗单行(连续吉日并段语义;多行=日粒度假劈)', async ()=>{
		const res = await scanHuangli({
			cfg: { startDate: '2026-08-31', endDate: '2026-09-29' },
			tree: tautology('jianchu', { values: ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'] }),
		});
		expect(res.intervals.length).toBe(1);
	});
});

// 分钟级三家(天星/七政/印度):判定面是连续量(度/速/须臾段),区间可为任意分钟长——
// 「非整时辰行」在这三家是正确语义,永不加粒度断言。此注释即制度锚,勿删勿仿时辰家写断言。
describe('[十二轮] 分钟级三家语义锚', ()=>{
	it('文档锚:天星/七政/印度=连续量语义,无粒度约束(见文件头)', ()=>{
		expect(true).toBe(true);
	});
});
