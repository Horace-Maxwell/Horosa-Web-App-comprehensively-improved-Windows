// [挂载自检 F-39·P0] 印占快照 [起盘信息] 口径行=印占实参(恒星黄道·岁差 + 印度分宫制),不再照抄西占 fields 的「回归黄道，Alcabitus」。
import { indiaCalibreLine, replaceIndiaCalibreLine } from '../../components/astro/IndiaChart';
import * as AstroConst from '../../constants/AstroConst';

it('🔴 默认印占 fields(西占 zodiacal 0/hsys 1)→ 口径行是 恒星黄道·<默认岁差>，整宫制', ()=>{
	const line = indiaCalibreLine({ zodiacal: { value: 0 }, hsys: { value: 1 } });
	expect(line.startsWith('恒星黄道·')).toBe(true);
	expect(line).toContain(AstroConst.ayanamsaLabel(AstroConst.INDIA_AYANAMSA_DEFAULT));
	expect(line).toContain('整宫制');
	expect(line).not.toContain('回归黄道');
	expect(line).not.toContain('Alcabitus');
});

it('记录/齿轮带 indiaHsys=3(KP)/indiaAyanamsa 非默认 → 口径行随实参', ()=>{
	const line = indiaCalibreLine({ indiaHsys: { value: 3 }, indiaAyanamsa: { value: AstroConst.INDIA_AYANAMSA_DEFAULT } });
	expect(line).toContain('KP');
	const ov = indiaCalibreLine({}, { indiaHsys: 0 });
	expect(ov).toContain('整宫制');
});

it('替换:西占口径行被换成印占口径行;缺则追加', ()=>{
	const out = replaceIndiaCalibreLine(['[起盘信息]', '出生：x', '回归黄道，Alcabitus', '经纬：y'], '恒星黄道·Lahiri，整宫制 Whole Sign');
	expect(out).toEqual(['[起盘信息]', '出生：x', '恒星黄道·Lahiri，整宫制 Whole Sign', '经纬：y']);
	expect(replaceIndiaCalibreLine(['a'], 'L')).toEqual(['a', 'L']);
});
