// 三式太乙:getKintaiyiPan 读的每个 options 键都必须进「太乙缓存键」与「重算签名」两处。
// 曾漏 taiyiTimeBasis:签名不变 → 去重不重算、缓存也命中旧盘 → 三式「时间基准」切真太阳时纹丝不动(死开关)。
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'SanShiUnitedMain.js'), 'utf8');

function blockAfter(marker, endMarker){
	const i = SRC.indexOf(marker);
	expect(i).toBeGreaterThan(0);
	return SRC.slice(i, SRC.indexOf(endMarker, i));
}
const refs = (seg, obj) => new Set([...seg.matchAll(new RegExp(`${obj}\\.(\\w+)`, 'g'))].map((m) => m[1]));

describe('三式太乙 键完备', () => {
	const read = refs(blockAfter('async getKintaiyiPan(fields, nongli, options){', "if(!pan || pan.source !== 'kintaiyi')"), 'options');
	const cacheKey = refs(blockAfter('const taiyiCacheKey = [', "].join('|');"), 'mergedOptions');
	const recalc = refs(blockAfter('const recalcSignature = [', "].join('|');"), 'mergedOptions');
	test('提取自证', () => {
		['taiyiStyle', 'taiyiAccum', 'sex', 'taiyiTimeBasis', 'gameTheory'].forEach((k) => expect(read.has(k)).toBe(true));
	});
	test('🔴 太乙缓存键 ⊇ getKintaiyiPan 所读键', () => {
		expect([...read].filter((k) => !cacheKey.has(k))).toEqual([]);
	});
	test('🔴 重算签名 ⊇ getKintaiyiPan 所读键(sex 经奇门键 getQimenOptionsKey 入签名)', () => {
		expect([...read].filter((k) => !recalc.has(k) && k !== 'sex')).toEqual([]);
	});
});
