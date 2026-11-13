// 圆周字形避让单源:双黄道主图与金融五重轮共用。
import fs from 'fs';
import path from 'path';
import { spreadAngles } from '../circleSpread';

const { importsName } = require('./helpers/importSpecs');   // 按 AST 读 import

const sep = (a, b)=>Math.abs(((a - b + 540) % 360) - 180);
const worstSep = (xs)=>{
	let w = 360;
	xs.forEach((a, i)=>xs.forEach((b, j)=>{ if(i !== j){ w = Math.min(w, sep(a, b)); } }));
	return w;
};

describe('spreadAngles', ()=>{
	it('日月同度且左右各挤一颗:全部推开到最小间距(此前逐对取模,换位后当成「将近一整圈」不再推,日月叠字)', ()=>{
		// 水 7° / 月 16.4° / 日 16.5° / 金 23° 同在一座,外加其余星;最小间距 12.4°(双黄道盘字形宽)
		const lons = [196.4, 196.5, 187, 203, 145, 82, 316, 48, 251, 262];
		const shown = spreadAngles(lons, 12.4);
		expect(shown.length).toBe(lons.length);
		expect(worstSep(shown)).toBeGreaterThanOrEqual(12.39);
	});
	it('不挤时不动,跨 0° 也按环上距离推开', ()=>{
		expect(spreadAngles([10, 80, 200], 8)).toEqual([10, 80, 200]);
		expect(worstSep(spreadAngles([359, 1], 8))).toBeGreaterThanOrEqual(7.99);
	});
	it('双黄道主图、黄道制主图与金融五重轮都走这个单源,不再各留一份', ()=>{
		const read = (p)=>fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
		const michon = read('components/astro/MichonDualRing.js');
		expect(importsName(read('components/auxchart/ZodiacRing.js'), { name: 'spreadAngles', from: '../../utils/circleSpread' })).toBe(true);
		expect(importsName(michon, { name: 'spreadAngles', from: '../../utils/circleSpread' })).toBe(true);
		expect(michon).not.toMatch(/function spread\(/);
	});
});
