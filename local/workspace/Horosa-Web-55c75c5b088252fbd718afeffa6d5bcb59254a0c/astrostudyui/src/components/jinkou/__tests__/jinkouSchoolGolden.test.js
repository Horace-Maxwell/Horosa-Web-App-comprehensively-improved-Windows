/**
 * 金口诀 Batch 6（P2 精修）golden：
 * ① 大六壬古法贵人表逐干冻结 + 与实务派的差异面锁定；
 * ② 天盘法起贵神冻结（地盘/天盘两路各自可复算）；
 * ③ 土之十二长生两派（水土同宫·申 / 火土同宫·寅）；
 * ④ 昼夜口径回报（真实地平 / 时支粗判）。
 *
 * 这些是「换了实现就必须重新对典籍」的口径面，冻结后任何静默漂移都会在此炸出来。
 */
import { buildJinKouData, jinKouPhaseTable, jinKouSoilStart, JINKOU_SOIL_PHASE_START } from '../JinKouCalc';

function mockLR(dayGanZi, monthGanZi, timeZhi){
	return {
		nongli: { dayGanZi: dayGanZi, time: `${timeZhi}时`, monthGanZi: monthGanZi },
		fourColumns: { year: { ganzi: '丙午' }, month: { ganzi: monthGanZi } },
		xun: { '旬空': '', '旬首': '' },
		season: { '金': '囚', '木': '旺', '水': '休', '火': '相', '土': '死' },
		gods: {}, godsGan: {}, godsMonth: {}, godsZi: {}, godsYear: { taisui1: {} },
	};
}
const GAN10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
// 昼占取 巳时(在卯-申内)、夜占取 亥时；isDiurnal 传 null 走时支粗判，口径确定。
const build = (dayGan, timeZhi, opt)=>buildJinKouData(
	mockLR(`${dayGan}子`, '丙申', timeZhi),
	{ diFen: '午', zhanShi: timeZhi, guirengType: 0, isDiurnal: null, ...(opt || {}) }
);

describe('贵人起例：实务派 / 大六壬古法两表逐干冻结', ()=>{
	// 冻结值 = 各派「贵人所落之支」(guiStartZi)。改表即此处红。
	const SHIWU = {
		昼: { 甲: '丑', 乙: '子', 丙: '亥', 丁: '亥', 戊: '丑', 己: '子', 庚: '丑', 辛: '午', 壬: '巳', 癸: '巳' },
		夜: { 甲: '未', 乙: '申', 丙: '酉', 丁: '酉', 戊: '未', 己: '申', 庚: '未', 辛: '寅', 壬: '卯', 癸: '卯' },
	};
	// 大六壬昼夜贵人歌：甲戊庚牛羊 / 乙己鼠猴乡 / 丙丁猪鸡位 / 六辛逢马虎 / 壬癸兔蛇藏。
	const LIUREN = {
		昼: { 甲: '丑', 乙: '子', 丙: '亥', 丁: '亥', 戊: '丑', 己: '子', 庚: '丑', 辛: '午', 壬: '卯', 癸: '卯' },
		夜: { 甲: '未', 乙: '申', 丙: '酉', 丁: '酉', 戊: '未', 己: '申', 庚: '未', 辛: '寅', 壬: '巳', 癸: '巳' },
	};

	it('实务派（默认）：十干昼夜二十格逐格冻结', ()=>{
		GAN10.forEach((g)=>{
			expect(build(g, '巳').guiStartZi).toBe(SHIWU['昼'][g]);
			expect(build(g, '亥').guiStartZi).toBe(SHIWU['夜'][g]);
		});
	});

	it('大六壬古法：十干昼夜二十格逐格冻结', ()=>{
		GAN10.forEach((g)=>{
			expect(build(g, '巳', { schoolGuiTable: 'liuren' }).guiStartZi).toBe(LIUREN['昼'][g]);
			expect(build(g, '亥', { schoolGuiTable: 'liuren' }).guiStartZi).toBe(LIUREN['夜'][g]);
		});
	});

	it('两派差异面恰为壬癸两干（其余八干两派同）', ()=>{
		const diff = GAN10.filter((g)=>build(g, '巳').guiStartZi !== build(g, '巳', { schoolGuiTable: 'liuren' }).guiStartZi);
		expect(diff).toEqual(['壬', '癸']);
		// 差异形态恒为「昼夜互换」，而非另起一支
		diff.forEach((g)=>{
			expect(build(g, '巳', { schoolGuiTable: 'liuren' }).guiStartZi).toBe(SHIWU['夜'][g]);
			expect(build(g, '亥', { schoolGuiTable: 'liuren' }).guiStartZi).toBe(SHIWU['昼'][g]);
		});
	});

	it('古法表逐干合大六壬昼夜贵人歌（歌诀→表的正向复核）', ()=>{
		// 歌诀分组：甲戊庚→丑/未，乙己→子/申，丙丁→亥/酉，辛→午/寅，壬癸→卯/巳
		const SONG = [
			[['甲', '戊', '庚'], '丑', '未'],
			[['乙', '己'], '子', '申'],
			[['丙', '丁'], '亥', '酉'],
			[['辛'], '午', '寅'],
			[['壬', '癸'], '卯', '巳'],
		];
		SONG.forEach(([gans, dayZi, nightZi])=>{
			gans.forEach((g)=>{
				expect(build(g, '巳', { schoolGuiTable: 'liuren' }).guiStartZi).toBe(dayZi);
				expect(build(g, '亥', { schoolGuiTable: 'liuren' }).guiStartZi).toBe(nightZi);
			});
		});
	});
});

describe('起贵神盘：地盘法 / 天盘法', ()=>{
	it('地盘法（默认）：贵神直坐所落之支，起点＝guiStartZi', ()=>{
		const d = build('甲', '巳', { schoolGuiPan: 'di' });
		expect(d.schools.guiPan).toBe('di');
		expect(d.guiStartZi).toBe('丑');
		expect(d.guiName).toBeTruthy();
	});

	it('天盘法：起点为「贵人落支在天盘上方」之地盘位，与地盘法结果不同即真生效', ()=>{
		const di = build('甲', '巳', { schoolGuiPan: 'di', yueJiang: '戌' });
		const tian = build('甲', '巳', { schoolGuiPan: 'tian', yueJiang: '戌' });
		expect(tian.schools.guiPan).toBe('tian');
		// 天盘[地盘位]=(月将+位-时)%12；解 tian[x]=丑 → x=(丑-戌+巳)。此盘两法必不同支。
		expect(tian.guiName).toBeTruthy();
		expect(tian.guiName).not.toBe(di.guiName);
	});

	it('天盘法逐月将复算：贵神名随月将而变（月将真参与，非摆设）', ()=>{
		const names = ['子', '寅', '辰', '午', '申', '戌'].map((yj)=>build('甲', '巳', { schoolGuiPan: 'tian', yueJiang: yj }).guiName);
		expect(new Set(names).size).toBeGreaterThan(1);
		names.forEach((n)=>{ expect(typeof n).toBe('string'); });
	});
});

describe('土之十二长生两派', ()=>{
	it('默认「水土同宫」：土长生在申，顺行十二位', ()=>{
		expect(jinKouSoilStart(undefined)).toBe('申');
		expect(jinKouSoilStart('shen')).toBe('申');
		const t = jinKouPhaseTable('土', 'shen');
		expect(t['长生']).toBe('申');
		expect(t['帝旺']).toBe('子');
		expect(t['墓']).toBe('辰');
		expect(t['养']).toBe('未');
	});

	it('少数派「火土同宫」：土长生在寅，与火同表', ()=>{
		expect(jinKouSoilStart('yin')).toBe('寅');
		const t = jinKouPhaseTable('土', 'yin');
		expect(t['长生']).toBe('寅');
		expect(t['帝旺']).toBe('午');
		expect(t['墓']).toBe('戌');
		expect(JSON.stringify(t)).toBe(JSON.stringify(jinKouPhaseTable('火', 'yin')));
	});

	it('其余四行不受土派开关影响（金巳/木亥/水申/火寅恒定）', ()=>{
		['shen', 'yin'].forEach((mode)=>{
			expect(jinKouPhaseTable('金', mode)['长生']).toBe('巳');
			expect(jinKouPhaseTable('木', mode)['长生']).toBe('亥');
			expect(jinKouPhaseTable('水', mode)['长生']).toBe('申');
			expect(jinKouPhaseTable('火', mode)['长生']).toBe('寅');
		});
		// 非法/空五行回落默认「土」而非吐空表（空表会让长生列静默全变「—」）
		expect(jinKouPhaseTable('', 'shen')).toEqual(jinKouPhaseTable('土', 'shen'));
		expect(jinKouPhaseTable('铁', 'shen')['长生']).toBe('申');
		expect(jinKouPhaseTable('铁', 'yin')['长生']).toBe('寅');
	});

	it('接入课式：schools.soilChangSheng 回显 + phaseTable 随派变；默认零回归', ()=>{
		const a = build('甲', '巳', { wuxing: '土' });
		const b = build('甲', '巳', { wuxing: '土', soilChangSheng: 'yin' });
		expect(a.schools.soilChangSheng).toBe('shen');
		expect(b.schools.soilChangSheng).toBe('yin');
		expect(a.phaseTable['长生']).toBe('申');
		expect(b.phaseTable['长生']).toBe('寅');
		// 只改长生表，起盘四位一字不动
		['renYuanGan', 'guiName', 'guiZi', 'jiangZi', 'jiangName'].forEach((k)=>{
			expect(b[k]).toEqual(a[k]);
		});
		// 非法值按默认处理（不抛、不产生第三种表）
		expect(build('甲', '巳', { wuxing: '土', soilChangSheng: 'nope' }).phaseTable['长生']).toBe('申');
	});

	it('阴盘旺衰的长生项亦随土派（同一开关贯穿两处，不各算各的）', ()=>{
		// 地分取丑（土支）→ 该位五行为土且坐实地支，长生项必被土派开关左右。
		const yin = (opt)=>buildJinKouData(mockLR('戊子', '丙申', '巳'),
			{ diFen: '丑', zhanShi: '巳', guirengType: 0, isDiurnal: null, panShi: 'yin', ...(opt || {}) });
		const soil = (d)=>(d.yinPan.wangScore.find((s)=>s.elem === '土' && s.wei === '地分') || {});
		const a = soil(yin({}));
		const b = soil(yin({ soilChangSheng: 'yin' }));
		// 土坐丑：水土同宫(申起)→衰；火土同宫(寅起)→养
		expect(a.detail.join('')).toContain('坐衰');
		expect(b.detail.join('')).toContain('坐养');
		expect(a.score).not.toBe(b.score);
	});

	it('两派起点表只此两档（防再塞第三档而无处标注）', ()=>{
		expect(Object.keys(JINKOU_SOIL_PHASE_START).sort()).toEqual(['shen', 'yin']);
	});
});

describe('昼夜口径回报', ()=>{
	it('无盘可依 → 时支粗判（卯至申为昼）', ()=>{
		const day = build('甲', '巳');
		const night = build('甲', '亥');
		expect(day.isDay).toBe(true);
		expect(night.isDay).toBe(false);
		[day, night].forEach((d)=>{
			expect(d.dayBasis).toBe('branch');
			expect(d.dayBasisText).toContain('时支');
		});
	});

	it('有盘 isDiurnal → 真实地平优先，可与时支粗判相反', ()=>{
		// 巳时按时支属昼，但盘算得日在地平下（高纬/极夜等）→ 以盘为准
		const d = buildJinKouData(mockLR('甲子', '丙申', '巳'), { diFen: '午', zhanShi: '巳', guirengType: 0, isDiurnal: false });
		expect(d.isDay).toBe(false);
		expect(d.dayBasis).toBe('horizon');
		expect(d.dayBasisText).toContain('真实地平');
		// 且贵神真按夜占起例（与时支粗判的昼占不同）
		expect(d.guiStartZi).toBe('未');
	});
});
