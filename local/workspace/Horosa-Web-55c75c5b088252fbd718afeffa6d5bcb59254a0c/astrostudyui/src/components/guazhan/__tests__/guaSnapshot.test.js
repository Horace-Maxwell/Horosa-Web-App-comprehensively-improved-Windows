import { buildGuaSnapshotText } from '../GuaZhanMain';
import { getGua64, Gua64 } from '../../gua/GuaConst';
import { littleEndian } from '../../../utils/helper';

function mkYao(values, movingIdx){
	return values.map((v, i) => ({ value: v, change: i === movingIdx, god: null, name: null }));
}
function guaIdx(values){
	const g = getGua64(littleEndian(values));
	return g ? g.index : null;
}

describe('六爻 buildGuaSnapshotText 全卦输出(回归哨兵:AI分析挂载经 buildTimeGua 时 gua 无 guaDesc → 旧版只剩本卦)', () => {
	// 挂载路径(regenerateSixyaoSnapshot→buildTimeGua)给的 gua 只有 yao/currentGua,没有 guaDesc。
	// 之/互/错/综卦必须能从 yao 六爻线值直接算出。
	it('仅有 yao(无 guaDesc)时仍输出 本卦/互卦/之卦/错卦/综卦', () => {
		const vals = [1, 1, 1, 1, 1, 1]; // 乾(全阳),初爻动
		const cur = guaIdx(vals);
		expect(cur).not.toBeNull();
		const st = { currentGua: cur, yao: mkYao(vals, 0), nongli: {}, guaDesc: {} };
		const txt = buildGuaSnapshotText({}, st);
		expect(txt).toMatch(/本卦：/);
		expect(txt).toMatch(/互卦：/);
		expect(txt).toMatch(/之卦/);
		expect(txt).toMatch(/错卦\(阴阳全变\)：/);
		expect(txt).toMatch(/综卦\(上下颠倒\)：/);
	});

	it('错卦 = 阴阳全变:乾(全阳)的错卦应为坤(全阴)', () => {
		const qian = [1, 1, 1, 1, 1, 1];
		const cuoVals = qian.map((v) => (v === 1 ? 0 : 1)); // 坤
		const kunIdx = guaIdx(qian.map((v) => (v === 1 ? 0 : 1)));
		const st = { currentGua: guaIdx(qian), yao: mkYao(qian, 0), nongli: {}, guaDesc: {} };
		const txt = buildGuaSnapshotText({}, st);
		const kunName = (Gua64[kunIdx] && Gua64[kunIdx].name) || '坤';
		// 错卦行应包含坤卦名
		const cuoLine = txt.split('\n').find((l) => l.indexOf('错卦') >= 0);
		expect(cuoLine).toBeTruthy();
		expect(cuoLine).toContain(kunName);
		// 自洽:坤 = 乾的阴阳全变
		expect(guaIdx(cuoVals)).toBe(kunIdx);
	});

	it('无动爻时之卦标注「无动爻,卦不变」', () => {
		const vals = [1, 0, 1, 0, 1, 0];
		const st = { currentGua: guaIdx(vals), yao: mkYao(vals, -1), nongli: {}, guaDesc: {} };
		const txt = buildGuaSnapshotText({}, st);
		expect(txt).toMatch(/之卦\(变卦\)：无动爻/);
	});

	it('之卦(变卦)/互卦 输出每根爻的装卦(地支/五行/六亲/世应,取自 yaoname)', () => {
		const vals = [1, 1, 1, 1, 1, 1]; // 乾,初爻动 → 之卦=天风姤(初爻「丑土父母世」),互卦=乾
		const st = { currentGua: guaIdx(vals), yao: mkYao(vals, 0), nongli: {}, guaDesc: {} };
		const txt = buildGuaSnapshotText({}, st);
		expect(txt).toMatch(/之卦\(变卦\)逐爻/);
		expect(txt).toMatch(/互卦逐爻/);
		// 之卦逐爻应含纳甲(地支+五行+六亲[+世应]),如 天风姤 初爻「丑土父母世」。
		const zhiSection = txt.split('之卦(变卦)逐爻')[1] || '';
		expect(zhiSection).toMatch(/[子丑寅卯辰巳午未申酉戌亥][金木水火土](父母|官鬼|妻财|子孙|兄弟)/); // 妻才 typo 已修为妻财(去 妻才 以捕回潮)
		// 之卦/互卦逐爻也要有阴阳爻（天风姤=[0,1,1,1,1,1]：初爻阴、余阳）。
		const zhiLine1 = zhiSection.split('\n').find((l)=>l.indexOf('第1爻') >= 0) || '';
		expect(zhiLine1).toContain('阴爻');
		expect(zhiSection).toMatch(/阳爻/);
	});
});

describe('六爻快照 · 设置闸口(Q-205/T-150、Q-208/T-162)', () => {
	const vals = [1, 1, 1, 1, 1, 1]; // 乾,初爻动 → 有之卦与互卦三处六神位
	function stWith(settings, nongli){
		const yao = mkYao(vals, 0).map((y, i)=>({ ...y, god: ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'][i] }));
		return { currentGua: guaIdx(vals), yao, nongli: nongli || {}, guaDesc: {}, liuyaoSettings: settings };
	}

	it('六神开(缺省):本卦与各关联卦逐爻都带「六神:」', () => {
		const txt = buildGuaSnapshotText({}, stWith(undefined));
		// 本卦 + 之卦 + 互卦 + 伏神卦 + 综卦 + 错卦 = 6 块 × 6 爻(Q-448/T-411 后关联卦五卦俱全)
		expect((txt.match(/，六神:/g) || []).length).toBe(36);
	});

	it('六神关:快照一处都不带「六神:」(与中间栏同闸,帮助称关掉的块不进快照)', () => {
		const txt = buildGuaSnapshotText({}, stWith({ sixGods: false }));
		expect(txt).not.toMatch(/，六神:/);
		expect(txt).toMatch(/\[六爻与动爻\]/); // 其余内容照出
	});

	it('定年界线=正月初一:首段年干支取农历年支(缺省立春档逐字不变)', () => {
		const nongli = { yearJieqi: '甲辰', yearGanZi: '甲辰', yearGZByLunar: '癸卯', monthGanZi: '丙寅', dayGanZi: '戊午', timeGanZi: '壬子' };
		const lichun = buildGuaSnapshotText({}, stWith(undefined, nongli));
		const lunar = buildGuaSnapshotText({}, stWith({ yearBoundary: 'lunar' }, nongli));
		expect(lichun).toMatch(/干支：年甲辰 /);
		expect(lunar).toMatch(/干支：年癸卯 /);
	});
});

describe('六爻快照 · 页面有而快照无的四项补齐(Q-448/T-411)', () => {
	const vals = [0, 1, 0, 1, 0, 1]; // 火水未济
	function st(settings, nongli){
		const yao = vals.map((v, i)=>({ value: v, change: i === 2, god: null, name: null }));
		return { currentGua: guaIdx(vals), yao, nongli: nongli || { dayGanZi: '甲子', monthGanZi: '丙午', yearGanZi: '丙午', time: '子' }, guaDesc: {}, liuyaoSettings: settings };
	}

	it('关联卦五卦都出完整装卦(之/互/伏神/综/错)', () => {
		const txt = buildGuaSnapshotText({}, st(undefined));
		['之卦(变卦)逐爻', '互卦逐爻', '伏神卦(本宫首卦)逐爻', '综卦逐爻', '错卦逐爻'].forEach((k)=>{
			expect(txt).toContain(k);
		});
	});

	it('关联卦显隐勾选即闸住快照(与页面同律):只留互卦时其余四块不出', () => {
		const txt = buildGuaSnapshotText({}, st({ relatedCards: ['hu'] }));
		expect(txt).toContain('互卦逐爻');
		['之卦(变卦)逐爻', '伏神卦(本宫首卦)逐爻', '综卦逐爻', '错卦逐爻'].forEach((k)=>{
			expect(txt).not.toContain(k);
		});
	});

	it('[断卦结构] 用神段带「取用说明」(页面用神卡早有)', () => {
		const txt = buildGuaSnapshotText({}, st(undefined));
		expect(txt).toMatch(/取用说明：.+/);
	});

	it('逐爻状态列带岁破/日破(甲子日午爻日破)', () => {
		const txt = buildGuaSnapshotText({}, st(undefined));
		const struct = txt.split('[断卦结构]')[1] || '';
		expect(struct).toContain('日破');
	});
});
