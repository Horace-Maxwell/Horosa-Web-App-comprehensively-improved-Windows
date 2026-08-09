// 紫微亮度基表「血统金标」：钉死基表十四正曜 ≡ 中州五档权威表誊录夹具（逐格 168 格）。
// 夹具 fixtures/ziweiZhongzhouRef.json 系对权威原表的**独立逐格誊录**（2026-08-07 誊录时
// 与基表对照 168/168 全同，含「地」档两格与天府酉=陷）——基表即中州五档口径的实证。
// 🔴 本金标的意义：基表与 Java 侧 ziweistarlight.json 逐字节同源、一字不可改；此后任何人
//    动基表十四正曜任何一格，这里当场红——红=数据血统被破坏，先查改动理由，绝不改夹具将就。
// 🔴 因此**不设**独立的「中州」亮度源：与默认表逐格相同的源是死选项（同四化表「两两必须
//    不同」金标精神）；默认源 zi_jian 即中州五档口径。
import { STAR_LIGHT } from '../data/ziweiTables';
import ZHONGZHOU_REF from './fixtures/ziweiZhongzhouRef.json';

const MAIN14 = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

describe('亮度基表血统（十四正曜 ≡ 中州权威表誊录）', () => {
	test('夹具形状：十四正曜 × 十二支全键，档位词汇 ⊆ {庙,旺,平,闲,陷,地}', () => {
		expect(Object.keys(ZHONGZHOU_REF)).toEqual(MAIN14);
		const LEVELS = new Set(['庙', '旺', '平', '闲', '陷', '地']);
		MAIN14.forEach((s) => {
			expect(Object.keys(ZHONGZHOU_REF[s])).toEqual(ZHI12);
			ZHI12.forEach((z) => expect(LEVELS.has(ZHONGZHOU_REF[s][z])).toBe(true));
		});
	});
	test('🔴 基表十四正曜逐格 === 权威表誊录（168 格；红=基表血统被动，勿改夹具将就）', () => {
		MAIN14.forEach((s) => {
			ZHI12.forEach((z) => {
				expect(`${s}${z}=${STAR_LIGHT[s][z]}`).toBe(`${s}${z}=${ZHONGZHOU_REF[s][z]}`);
			});
		});
	});
	test('权威表特征格抽样锚（「地」两格 + 「闲」档在 + 天府酉陷）', () => {
		expect(ZHONGZHOU_REF['贪狼']['卯']).toBe('地');
		expect(ZHONGZHOU_REF['天梁']['酉']).toBe('地');
		expect(ZHONGZHOU_REF['紫微']['戌']).toBe('闲');
		expect(ZHONGZHOU_REF['天府']['酉']).toBe('陷');
	});
});
