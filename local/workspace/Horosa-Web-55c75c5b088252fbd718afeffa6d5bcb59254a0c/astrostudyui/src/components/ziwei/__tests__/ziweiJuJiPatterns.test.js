// 巨机格局按《紫微斗数全书》分宫:卯宫为贵(「巨機居卯,乙辛己丙至公卿,不貴即富,甲人平常」),
// 酉宫为破(「巨機酉上化吉者,縱有財官也不終」);卯酉同论只用于女命破荡(「女命巨機於卯酉,雖富貴不免淫佚」)。
// 曾:「巨机卯酉」破格卯酉一并,命在卯的巨机同临被判破格。
import { detectPatterns } from '../ziweiPatterns';
import { opToText } from '../ZWPatternPanel';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
function chartWith({ mingZhi, yearGan, gender }){
	const life = ZHI.indexOf(mingZhi);
	const houses = ZHI.map((z)=>({ ganzi: `甲${z}`, starsMain: [], starsAssist: [], starsEvil: [], starsOthersGood: [], starsOthersBad: [], starsSmall: [] }));
	houses[life].starsMain = [{ name: '天机' }, { name: '巨门' }];
	return { lifeHouseIndex: life, yearGan, gender, houses };
}
const names = (c)=>detectPatterns(c).map((p)=>p.name);

describe('巨机格局分卯酉', ()=>{
	test('卯宫 + 乙年男命:巨机同临(富贵),不判破格', ()=>{
		const n = names(chartWith({ mingZhi: '卯', yearGan: '乙', gender: 'Male' }));
		expect(n).toContain('巨机同临');
		expect(n).not.toContain('巨机居酉');
		expect(n).not.toContain('巨机破荡(女命)');
	});
	test.each(['辛', '己', '丙'])('卯宫 + %s 年同样入格', (g)=>{
		expect(names(chartWith({ mingZhi: '卯', yearGan: g, gender: 'Male' }))).toContain('巨机同临');
	});
	test('卯宫 + 甲年:不入同临(甲人平常)', ()=>{
		expect(names(chartWith({ mingZhi: '卯', yearGan: '甲', gender: 'Male' }))).not.toContain('巨机同临');
	});
	test('酉宫:巨机居酉破格,不入同临', ()=>{
		const n = names(chartWith({ mingZhi: '酉', yearGan: '乙', gender: 'Male' }));
		expect(n).toContain('巨机居酉');
		expect(n).not.toContain('巨机同临');
	});
	test.each(['卯', '酉'])('女命 %s 宫另挂破荡;男命不挂', (z)=>{
		expect(names(chartWith({ mingZhi: z, yearGan: '乙', gender: 'Female' }))).toContain('巨机破荡(女命)');
		expect(names(chartWith({ mingZhi: z, yearGan: '乙', gender: 'Male' }))).not.toContain('巨机破荡(女命)');
	});
	test('裸本地盘(只有 male 布尔)也认性别', ()=>{
		const c = chartWith({ mingZhi: '卯', yearGan: '乙' });
		c.male = false;
		expect(names(c)).toContain('巨机破荡(女命)');
	});
	test('新 op 有可读文本', ()=>{
		expect(opToText({ op: 'yearGan', gans: ['乙', '辛'] })).toMatch('乙');
		expect(opToText({ op: 'female' })).toBe('女命');
	});
});
