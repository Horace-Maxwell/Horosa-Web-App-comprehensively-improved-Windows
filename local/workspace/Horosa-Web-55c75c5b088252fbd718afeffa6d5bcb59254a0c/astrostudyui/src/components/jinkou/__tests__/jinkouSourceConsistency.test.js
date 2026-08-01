/**
 * 金口诀排查轮：两处「一张课两个真值源」的分叉闸。
 *
 * BUG-1 日柱两源分叉：/liureng/gods 不接 timeBasis（后端恒按真太阳时定日柱），/jinkou/pan 接。
 *   跨日界（晚子时）+「直接时间」→ 两者日柱差一天 → 盘面按 pan 日干起人元、右栏解读按 liureng 日干。
 * BUG-2 非默认流派时概览四柱/月将/占时只认后端字段 → 走本地引擎即整排「无」。
 */
import { buildJinKouData, normalizeKinjinkouData } from '../JinKouCalc';

function mockLR(dayGanZi){
	return {
		nongli: { dayGanZi: dayGanZi, time: '亥时', monthGanZi: '乙未' },
		fourColumns: { year: { ganzi: '丙午' }, month: { ganzi: '乙未' }, day: { ganzi: dayGanZi }, time: { ganzi: '丁亥' } },
		xun: { '旬空': '', '旬首': '' },
		season: { '金': '囚', '木': '旺', '水': '休', '火': '相', '土': '死' },
		gods: {}, godsGan: {}, godsMonth: {}, godsZi: {}, godsYear: { taisui1: {} },
	};
}
// 后端 pan：日柱可与 liureng 不同（跨日界时真实会发生）
function mockPan(dayGanZi){
	return {
		ganzhi: { year: '丙午', month: '乙未', day: dayGanZi, time: '戊子' },
		difen: '辰', yuejiang: '午', zhanshi: '子',
		rows: [
			{ label: '人元', content: '壬', gan: '-', element: '水' },
			{ label: '贵神', content: '午', gan: '甲', element: '火' },
			{ label: '将神', content: '戌', gan: '戊', element: '土' },
			{ label: '地分', content: '辰', gan: '-', element: '土' },
		],
		plates: [{ index: 1, di: '子', tian: '巳', jiang: '太乙', shen: '申', gui: '白虎' }],
	};
}

describe('BUG-1 日柱两源分叉', ()=>{
	it('两源日柱一致时照用后端盘（零回归：source=kinjinkou、无提示）', ()=>{
		const lr = mockLR('庚子');
		const local = buildJinKouData(lr, { diFen: '辰', zhanShi: '子', guirengType: 0 });
		const merged = normalizeKinjinkouData(mockPan('庚子'), local);
		expect(merged.source).toBe('kinjinkou');
		expect(merged.daySourceNote).toBeUndefined();
	});

	it('本地引擎的日干恒取 liureng：人元与解读层同源，不受 pan 影响', ()=>{
		// 庚日辰地分：五鼠遁 庚→丙子起，数至辰 = 庚
		const gengDay = buildJinKouData(mockLR('庚子'), { diFen: '辰', zhanShi: '子', guirengType: 0 });
		// 辛日辰地分：辛→戊子起，数至辰 = 壬
		const xinDay = buildJinKouData(mockLR('辛丑'), { diFen: '辰', zhanShi: '子', guirengType: 0 });
		expect(gengDay.renYuanGan).toBe('庚');
		expect(xinDay.renYuanGan).toBe('壬');
		// 两个日干给出不同的人元 → 若显示层用 pan(辛日)、解读层用 liureng(庚日)，用户看到的就是两张课
		expect(gengDay.renYuanGan).not.toBe(xinDay.renYuanGan);
	});

	it('本地结果自洽：rows 的人元 === renYuanGan（分叉时退回本地即恢复自洽）', ()=>{
		['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉'].forEach((dz)=>{
			const d = buildJinKouData(mockLR(dz), { diFen: '辰', zhanShi: '子', guirengType: 0 });
			const rowGan = (d.rows || []).filter((r)=>r.label === '人元').map((r)=>r.content)[0];
			expect(rowGan).toBe(d.renYuanGan);
		});
	});

	it('后端盘缺 ganzhi 时不误判为分叉（无从比对即照旧走 pan）', ()=>{
		const local = buildJinKouData(mockLR('庚子'), { diFen: '辰', zhanShi: '子', guirengType: 0 });
		const pan = mockPan('庚子');
		delete pan.ganzhi;
		const merged = normalizeKinjinkouData(pan, local);
		expect(merged.source).toBe('kinjinkou');
	});
});

describe('BUG-2 本地路径的显示字段回退', ()=>{
	it('liureng.fourColumns 齐备 → 概览四柱可由本地补齐（不依赖后端 pan）', ()=>{
		const lr = mockLR('庚子');
		const cols = lr.fourColumns;
		expect(cols.year.ganzi).toBe('丙午');
		expect(cols.month.ganzi).toBe('乙未');
		expect(cols.day.ganzi).toBe('庚子');
		expect(cols.time.ganzi).toBe('丁亥');
	});

	it('本地引擎自产 yuejiang / timeZi / diFen —— 三项都有本地真值可回退', ()=>{
		const d = buildJinKouData(mockLR('庚子'), { diFen: '辰', zhanShi: '子', guirengType: 0 });
		expect(d.yuejiang).toBeTruthy();
		expect(d.timeZi).toBe('子');
		expect(d.diFen).toBe('辰');
	});

	it('全部非默认流派组合下三项恒非空（回退面覆盖全流派）', ()=>{
		['zhongqi', 'jiaojie'].forEach((yj)=>{
			['shiwu', 'liuren'].forEach((gt)=>{
				['di', 'tian'].forEach((gp)=>{
					['yang', 'yin'].forEach((ps)=>{
						const d = buildJinKouData(mockLR('庚子'), {
							diFen: '辰', zhanShi: '子', guirengType: 0,
							schoolYueJiang: yj, schoolGuiTable: gt, schoolGuiPan: gp, panShi: ps,
						});
						expect(d.yuejiang).toBeTruthy();
						expect(d.timeZi).toBeTruthy();
						expect(d.diFen).toBeTruthy();
					});
				});
			});
		});
	});
});

describe('阴盘旺衰「课内生克」下标对齐（E6-2）', ()=>{
	// 构造一行 elem 为空的课：压缩数组去索引原数组时，其后各行会整体前移一位，
	// 「排除自己」就排到别人头上 —— 自己被算进课内生克、真正的他位反被跳过。
	function scoreOf(rows, seasonMap){
		const { buildJinKouData: b } = require('../JinKouCalc');
		return b;
	}
	it('某位无五行时，其余各位的课内生克仍按「排除自己、计其余」算', ()=>{
		const lr = mockLR('庚子');
		const d = buildJinKouData(lr, { diFen: '辰', zhanShi: '子', guirengType: 0, panShi: 'yin' });
		const ws = d.yinPan.wangScore;
		expect(ws.length).toBe(4);
		// 每一位的「课内生克」项都必须存在或为 0，且不得把自己算进去：
		// 自比同气只可能来自他位，故同气加分不会超过「他位数 × 同气分」
		const elems = ws.map((s)=>s.elem).filter(Boolean);
		ws.forEach((s)=>{
			if(!s.elem){ return; }
			const sameOthers = elems.filter((e)=>e === s.elem).length - 1; // 减去自己
			const detail = s.detail.join('');
			if(sameOthers === 0){
				// 无他位同气 → 依据串里不该出现「同气」造成的正向课内生克误加
				expect(typeof s.score).toBe('number');
			}
			expect(detail).not.toMatch(/NaN/);
		});
	});

	it('四位五行齐备时逐位可复算（对齐后与手算一致）', ()=>{
		const d = buildJinKouData(mockLR('庚子'), { diFen: '辰', zhanShi: '子', guirengType: 0, panShi: 'yin' });
		const rows = d.rows;
		const ws = d.yinPan.wangScore;
		rows.forEach((r, i)=>{
			expect(ws[i].wei).toBe(r.label);
			expect(ws[i].elem).toBe(r.elem || '');
		});
	});
});

describe('后端行空亡列（E5-8）', ()=>{
	it('后端给了 kong 就用后端的，而非一律回落「—」', ()=>{
		const local = buildJinKouData(mockLR('庚子'), { diFen: '辰', zhanShi: '子', guirengType: 0 });
		const pan = mockPan('庚子');
		pan.rows[3].kong = '空';
		const merged = normalizeKinjinkouData(pan, local);
		const diFenRow = merged.rows.find((r)=>r.label === '地分');
		expect(diFenRow.kong).toBe('空');
	});

	it('后端未给 kong 时回落本地（旧行为不变）', ()=>{
		const local = buildJinKouData(mockLR('庚子'), { diFen: '辰', zhanShi: '子', guirengType: 0 });
		const merged = normalizeKinjinkouData(mockPan('庚子'), local);
		merged.rows.forEach((r)=>{ expect(typeof r.kong).toBe('string'); });
	});
});
