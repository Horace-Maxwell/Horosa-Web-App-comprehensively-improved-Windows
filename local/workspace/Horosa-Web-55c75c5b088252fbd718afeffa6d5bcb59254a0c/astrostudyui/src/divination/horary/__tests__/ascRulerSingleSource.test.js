// 1 宫主(上升星座的庙主)单一来源 engine/radicality.ascRulerKey:卜卦征象星、择日考量、择日硬旗不再各抄一份。
import fs from 'fs';
import path from 'path';
import { ascRulerKey } from '../../engine/radicality';
import * as significators from '../significators';

const DIV = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(DIV, rel), 'utf8');

describe('1 宫主单一来源', ()=>{
	test('上升白羊 → 火星;巨蟹 → 月亮;缺上升 → null', ()=>{
		expect(ascRulerKey({ meta: { ascSign: 'aries' } })).toBe('mars');
		expect(ascRulerKey({ meta: { ascSign: 'cancer' } })).toBe('moon');
		expect(ascRulerKey({ meta: {} })).toBe(null);
		expect(ascRulerKey({ meta: { ascSign: 'nope' } })).toBe(null);
	});
	test('征象星模块原名导出仍在,且就是同一个函数', ()=>{
		expect(significators.ascRulerKey).toBe(ascRulerKey);
	});
	test('源码:择日考量 / 硬旗改为 import(本地名 lord1Of 不变)', ()=>{
		['election/considerations.js', 'election/hardFlags.js'].forEach((rel)=>{
			const src = read(rel);
			expect(src).toMatch(/import \{[^}]*ascRulerKey as lord1Of[^}]*\} from '\.\.\/engine\/radicality';/);
			expect(src).not.toContain('function lord1Of(');
		});
		expect(read('horary/significators.js')).not.toContain('function ascRulerKey(');
	});
});
