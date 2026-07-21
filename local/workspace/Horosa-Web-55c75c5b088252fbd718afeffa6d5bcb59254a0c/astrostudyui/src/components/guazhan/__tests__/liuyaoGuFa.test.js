import { ganForYaos, nayinOf, shiShenOf, yueLiuShen, sixteenChangesOf, shengJiangOf, baJieGuaQi, sanXianOf, jiaziIndex } from '../../gua/liuyaoGuFa';
import { getGua64 } from '../../gua/GuaConst';
import { littleEndian } from '../../../utils/helper';

const gua = (bits) => getGua64(littleEndian(bits));
const QIAN = gua([1, 1, 1, 1, 1, 1]);

describe('六爻古法体系(断易天机)', () => {
	it('逐爻天干:乾为天=甲甲甲壬壬壬;天风姤=辛辛辛壬壬壬', () => {
		expect(ganForYaos(QIAN)).toEqual(['甲', '甲', '甲', '壬', '壬', '壬']);
		expect(ganForYaos(gua([0, 1, 1, 1, 1, 1]))).toEqual(['辛', '辛', '辛', '壬', '壬', '壬']);
	});
	it('纳音:甲子海中金/壬戌大海水', () => {
		expect(nayinOf('甲', '子').name).toBe('海中金');
		expect(nayinOf('壬', '戌').name).toBe('大海水');
		expect(jiaziIndex('甲', '子')).toBe(0);
	});
	it('世身两套:乾为天世上爻戌→standard 第5爻/lichunfeng 第2爻', () => {
		expect(shiShenOf(QIAN, 'standard').pos).toBe(5);   // 辰戌持世身居五
		expect(shiShenOf(QIAN, 'lichunfeng').pos).toBe(2); // 丑戌持世二爻扶
	});
	it('月建六神:五月白虎子/螣蛇子;正月青龙寅', () => {
		const m5 = yueLiuShen(5);
		expect(m5['白虎']).toBe('子'); expect(m5['螣蛇']).toBe('子');
		expect(yueLiuShen(1)['青龙']).toBe('寅');
	});
	it('十六变:乾宫全序 16 卦名', () => {
		const names = sixteenChangesOf(QIAN).map((s) => s.name);
		expect(names).toEqual(['天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火山旅', '火风鼎', '火天大有', '离为火', '火雷噬嗑', '山雷颐', '风雷益', '天雷无妄', '天火同人', '乾为天']);
	});
	it('升降:冬至升阳初爻降阴上爻;夏至升阴初爻', () => {
		expect(shengJiangOf(QIAN, '冬至', new Set(), 6).upYao.pos).toBe(1);
		expect(shengJiangOf(QIAN, '夏至', new Set(), 6).upYao.name).toBe('升阴');
	});
	it('八节卦气:立春艮旺巽胎坎废(家宅序);生育序兑休乾囚', () => {
		const home = baJieGuaQi('立春', 'home');
		expect(home['艮']).toBe('旺'); expect(home['巽']).toBe('胎'); expect(home['坎']).toBe('废'); expect(home['兑']).toBe('囚');
		const birth = baJieGuaQi('立春', 'birth');
		expect(birth['兑']).toBe('休'); expect(birth['乾']).toBe('囚');
	});
	it('三限:内三爻 1-15 年、之卦外主生死;阳世顺行流年', () => {
		const sx = sanXianOf(QIAN, gua([0, 1, 1, 1, 1, 1]), new Set([1]));
		expect(sx.seg[0].years).toBe('1-5'); expect(sx.seg[5].side).toContain('外');
		expect(sx.bianSeg[5].zhu).toContain('生死'); expect(sx.shiYang).toBe(true);
		expect(sx.liuNian[0].pos).toBe(6); expect(sx.liuNian[1].pos).toBe(1);
	});
});
