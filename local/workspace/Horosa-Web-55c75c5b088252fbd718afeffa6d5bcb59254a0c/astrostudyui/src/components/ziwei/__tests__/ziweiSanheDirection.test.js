// 紫微「运限三合(运财帛/运官禄)」方向一致性锁:getSanheIndices 与主盘「运X」角标(luckRoleChar)一口径,防对调回归。
// 🔴 方向铁律:紫微十二宫自命宫沿地支**逆行**排 ⇒ chart.houses(地支固定序 子=0..亥=11)上
//   传统宫序 = index 递减;财帛 = 命−4 ≡ (命+8)%12、官禄 = 命−8 ≡ (命+4)%12。
//   历史 bug:getSanheIndices 曾写反成 财=+4/官=+8,右栏「运限三合」与 AI 挂载的运财帛↔运官禄整体对调;
//   主盘「运X」角标(ZWChart delta=dirIndex−i)一直正确,同盘两套答案。本套件用主盘口径(luckRoleChar)
//   + 用户真实盘 golden 锁死一致。
jest.mock('d3', () => ({}));

import * as ZiWeiHelper from '../ZiWeiHelper';

const DIZI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 用户真实盘(截图 golden):命宫乙酉(酉=idx9);宫序沿地支顺行 = 命→父母→福德→…(传统序逆向)。
const USER_PALACES = [
	['田宅宫', '戊子'], ['官禄宫', '己丑'], ['交友宫', '戊寅'], ['迁移宫', '己卯'],
	['疾厄宫', '庚辰'], ['财帛宫', '辛巳'], ['子女宫', '壬午'], ['夫妻宫', '癸未'],
	['兄弟宫', '甲申'], ['命宫', '乙酉'], ['父母宫', '丙戌'], ['福德宫', '丁亥'],
];
function makeUserChart(){
	return {
		houses: USER_PALACES.map(([name, ganzi], i) => ({
			name,
			ganzi,
			zhi: ganzi.slice(-1),
			direction: [i * 10, i * 10 + 9],
			starsMain: [`主星${i}`], starsAssist: [], starsEvil: [],
			starsOthersGood: [], starsOthersBad: [], starsSmall: [], stars: [],
		})),
	};
}

describe('运限三合方向:getSanheIndices 与主盘 luckRoleChar 一口径', () => {
	it('全环 0..11:getSanheIndices = [财(+8), 官(+4)],且与主盘 luckRoleChar 角色字互证', () => {
		for (let m = 0; m < 12; m++) {
			const [cai, guan] = ZiWeiHelper.getSanheIndices(m);
			expect(cai).toBe((m + 8) % 12);
			expect(guan).toBe((m + 4) % 12);
			expect(ZiWeiHelper.luckRoleChar(m, cai)).toBe('财');
			expect(ZiWeiHelper.luckRoleChar(m, guan)).toBe('官');
			// 反向自检:按历史错误方向取宫,角色字是官/财(对调)——铁证方向唯一
			expect(ZiWeiHelper.luckRoleChar(m, (m + 4) % 12)).toBe('官');
			expect(ZiWeiHelper.luckRoleChar(m, (m + 8) % 12)).toBe('财');
		}
	});

	it('collectSanhePalaces:runName 与所落宫的主盘角色字一致(任意盘)', () => {
		const chart = makeUserChart();
		for (let m = 0; m < 12; m++) {
			const sanhe = ZiWeiHelper.collectSanhePalaces(chart, m);
			expect(sanhe).toHaveLength(2);
			expect(sanhe[0].runName).toBe('运财帛宫');
			expect(ZiWeiHelper.luckRoleChar(m, sanhe[0].houseIndex)).toBe('财');
			expect(sanhe[1].runName).toBe('运官禄宫');
			expect(ZiWeiHelper.luckRoleChar(m, sanhe[1].houseIndex)).toBe('官');
		}
	});

	it('用户盘 golden·大限丁亥(福德宫位,idx11):运财帛=夫妻宫癸未、运官禄=迁移宫己卯', () => {
		const chart = makeUserChart();
		const sanhe = ZiWeiHelper.collectSanhePalaces(chart, 11);
		expect(sanhe[0].runName).toBe('运财帛宫');
		expect(sanhe[0].palaceName).toBe('夫妻宫');
		expect(sanhe[0].ganZhi).toBe('癸未');
		expect(sanhe[1].runName).toBe('运官禄宫');
		expect(sanhe[1].palaceName).toBe('迁移宫');
		expect(sanhe[1].ganZhi).toBe('己卯');
		expect(ZiWeiHelper.luckRoleChar(11, 7)).toBe('财');
		expect(ZiWeiHelper.luckRoleChar(11, 3)).toBe('官');
	});

	it('用户盘 golden·流命宫=午(idx6):运财帛=交友宫戊寅、运官禄=父母宫丙戌', () => {
		const chart = makeUserChart();
		const sanhe = ZiWeiHelper.collectSanhePalaces(chart, 6);
		expect(sanhe[0].palaceName).toBe('交友宫');
		expect(sanhe[0].ganZhi).toBe('戊寅');
		expect(sanhe[1].palaceName).toBe('父母宫');
		expect(sanhe[1].ganZhi).toBe('丙戌');
	});

	it('DIZI 序表自检(防常量漂移)', () => {
		expect(DIZI[9]).toBe('酉');
		expect(DIZI[11]).toBe('亥');
	});
});
