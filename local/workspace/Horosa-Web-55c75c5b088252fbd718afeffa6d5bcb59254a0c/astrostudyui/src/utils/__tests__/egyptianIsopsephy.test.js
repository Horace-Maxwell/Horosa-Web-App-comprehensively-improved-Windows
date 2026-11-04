// 埃及页「数字占」名字数值:带音调 / 气息符的希腊字母与不带的同值(输入法默认打出带音调的字母)
import { isopsephy, pythmen } from '../../divination/data/egyptianData';

describe('isopsephy', ()=>{
	test('不带音调的基准值', ()=>{
		// α1 λ30 ε5 ξ60 α1 ν50 δ4 ρ100 ο70 ς200
		expect(isopsephy('αλεξανδρος')).toBe(521);
	});
	test('带音调 / 大写 / 气息符与基准同值', ()=>{
		expect(isopsephy('Αλέξανδρος')).toBe(521);
		expect(isopsephy('ἈΛΈΞΑΝΔΡΟΣ')).toBe(521);
	});
	test('古字母与非希腊字符', ()=>{
		expect(isopsephy('ϝ')).toBe(6);
		expect(isopsephy('ϙ')).toBe(90);
		expect(isopsephy('abc 123')).toBe(0);
		expect(isopsephy('')).toBe(0);
	});
	test('位根', ()=>{
		expect(pythmen(521)).toBe(8);
		expect(pythmen(9)).toBe(9);
	});
});
