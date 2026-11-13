// 奇门快照[全局速览]:吉格、凶格、九遁标签的宫号必须是洛书宫号,不是概览的内部九宫序号。
import { buildDunJiaSnapshotText, calcDunJia } from '../DunJiaCalc';
import { LUOSHU_NUM } from '../DunJiaFaDoc';
import { buildQimenOverviewSummary } from '../DunJiaBaGongRules';

jest.mock('../DunJiaBaGongRules', ()=>{
	const actual = jest.requireActual('../DunJiaBaGongRules');
	return { ...actual, buildQimenOverviewSummary: jest.fn(actual.buildQimenOverviewSummary) };
});

function mkFields(dateStr, timeStr){
	return { date: { value: { format: ()=>dateStr } }, time: { value: { format: ()=>timeStr } }, zone: { value: '+08:00' } };
}
function buildFixtureText(){
	const fields = mkFields('2026-05-15', '00:12:00');
	const nongli = { yearJieqi: '丙午', year: '丙午', monthGanZi: '癸巳', dayGanZi: '己丑', time: '甲子', jieqi: '立夏', jiedelta: '立夏后第10天', birth: '2026-05-15 00:12:00', month: '三月', day: '廿九', leap: false };
	const pan = calcDunJia(fields, nongli, { paiPanType: 3, qijuMethod: 'chaibu', zhiShiType: 0, yueJiaQiJuType: 1, kongMode: 'day', yimaMode: 'day', shiftPalace: 0, fengJu: false, timeAlg: 1, school: '转盘', after23NewDay: 0 }, {});   // 冻结基线按 24 点换日拍下(引擎缺键现取全局现值)
	pan.options.chartCategory = 'shi';
	return buildDunJiaSnapshotText(pan);
}

const overviewLines = (text)=>text.split('\n').filter((line)=>/^(九遁：|吉格 |凶格 )/.test(line));

describe('奇门全局速览宫号', ()=>{
	afterEach(()=>{ buildQimenOverviewSummary.mockClear(); });

	it('真盘标签的宫号都与宫名对得上', ()=>{
		const labels = overviewLines(buildFixtureText()).join('\n').match(/[^(、：]+\([^)]+\)/g);
		expect(labels.length).toBeGreaterThan(0);
		labels.forEach((label)=>{
			const hit = /\((.)(\d)宫\)$/.exec(label);
			expect(hit).not.toBeNull();
			expect(Number(hit[2])).toBe(LUOSHU_NUM[hit[1]]);
		});
	});

	it('八宫内部序号全都换成洛书宫号,九遁行同样', ()=>{
		const inner = { 巽: 1, 离: 2, 坤: 3, 震: 4, 兑: 6, 艮: 7, 坎: 8, 乾: 9 };
		const items = Object.keys(inner).map((palaceName)=>({ name: '某格', palace: inner[palaceName], palaceName, dir: '' }));
		const actual = jest.requireActual('../DunJiaBaGongRules').buildQimenOverviewSummary;
		buildQimenOverviewSummary.mockImplementation((pan)=>({ ...actual(pan), dun: items, ji: items.slice(5), xiong: items.slice(0, 2) }));
		const text = buildFixtureText();
		buildQimenOverviewSummary.mockImplementation(actual);
		expect(text).toContain('九遁：某格(巽4宫)、某格(离9宫)、某格(坤2宫)、某格(震3宫)、某格(兑7宫)、某格(艮8宫)、某格(坎1宫)、某格(乾6宫)');
		expect(text).toContain('吉格 3 例：某格(艮8宫)、某格(坎1宫)、某格(乾6宫)');
		expect(text).toContain('凶格 2 例：某格(巽4宫)、某格(离9宫)');
	});
});
