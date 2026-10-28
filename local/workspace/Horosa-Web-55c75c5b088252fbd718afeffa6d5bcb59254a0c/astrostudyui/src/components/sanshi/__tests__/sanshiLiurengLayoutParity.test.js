// 三式合一的六壬起盘(buildLiuRengLayout)与六壬页同口径:
//  · 贵人未命中 → 两边都返回 null(不再静默落子位、十二天将整环偏移);
//  · castOverride.timeZhi(临位覆盖)两边都认;
//  · 正常输入下两边天地盘 / 贵人 / 十二天将逐字相同;
//  · 三式页拿到 null 走既有不出盘分支:四课空、三传 null、快照空串,不抛错。
import * as AstroConst from '../../../constants/AstroConst';
import * as LRConst from '../../liureng/LRConst';
import {
	buildLiuRengLayout as sanshiLayout,
	buildKeData as sanshiKeData,
	buildSanChuan as sanshiSanChuan,
	buildSanShiUnitedSnapshotText,
} from '../SanShiUnitedMain';
import { buildLiuRengLayout as liurengLayout } from '../../lrzhan/LiuRengMain';

const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
// 三式这份不带的两个字段(guirenForward / actualYue)三式下游不读,比对只取两边共有的六项。
const SHARED_KEYS = ['yue', 'timezi', 'guizi', 'downZi', 'upZi', 'houseTianJiang'];

function mkChart(sunSign, dayGan, timeZhi, isDiurnal){
	return {
		objects: [{ id: AstroConst.SUN, sign: sunSign }],
		nongli: { dayGanZi: `${dayGan}子`, time: `甲${timeZhi}` },
		isDiurnal,
	};
}

function pick(layout){
	if(!layout){ return layout; }
	const out = {};
	SHARED_KEYS.forEach((k)=>{ out[k] = layout[k]; });
	return out;
}

describe('三式六壬起盘与六壬页对齐', ()=>{
	test('正常输入:全部日干 × 占时 × 月将 × 五套贵人 × 昼夜,两边结果逐字相同', ()=>{
		let n = 0;
		AstroConst.LIST_SIGNS.slice(0, 12).forEach((sign)=>{
			GANS.forEach((gan)=>{
				LRConst.ZiList.forEach((tz)=>{
					[0, 1, 2, 3, 4].forEach((gt)=>{
						[true, false].forEach((diurnal)=>{
							const chart = mkChart(sign, gan, tz, diurnal);
							const a = sanshiLayout(chart, gt, null);
							const b = liurengLayout(chart, gt, null);
							expect(a).toBeTruthy();
							expect(JSON.stringify(pick(a))).toBe(JSON.stringify(pick(b)));
							n += 1;
						});
					});
				});
			});
		});
		expect(n).toBe(12 * 10 * 12 * 5 * 2);
	});

	test('带流派覆盖(换将 / 昼夜 / 阳阴归属)两边也逐字相同', ()=>{
		const chart = mkChart('Taurus', '丙', '巳', true);
		const overrides = [
			{ yue: '申' },
			{ isDiurnal: false },
			{ yinyangSystem: 'yinyang' },
			{ yue: '亥', isDiurnal: true, yinyangSystem: 'yinyang' },
		];
		overrides.forEach((co)=>{
			[0, 2, 4].forEach((gt)=>{
				expect(JSON.stringify(pick(sanshiLayout(chart, gt, co)))).toBe(JSON.stringify(pick(liurengLayout(chart, gt, co))));
			});
		});
	});

	test('castOverride.timeZhi:两边都按覆盖的临位起盘,结果相同', ()=>{
		const chart = mkChart('Leo', '甲', '子', true);
		const co = { timeZhi: '午' };
		const a = sanshiLayout(chart, 2, co);
		const b = liurengLayout(chart, 2, co);
		expect(a.timezi).toBe('午');
		expect(b.timezi).toBe('午');
		expect(JSON.stringify(pick(a))).toBe(JSON.stringify(pick(b)));
		// 不带覆盖时仍按正时
		expect(sanshiLayout(chart, 2, null).timezi).toBe('子');
	});

	test('贵人未命中:两边都返回 null', ()=>{
		// 日干不在贵人表里(取不到贵人)
		const chart = { objects: [{ id: AstroConst.SUN, sign: 'Aries' }], nongli: { dayGanZi: '?子', time: '甲午' }, isDiurnal: true };
		expect(LRConst.getGuiZi(chart, 2)).toBeUndefined();
		expect(liurengLayout(chart, 2, null)).toBeNull();
		expect(sanshiLayout(chart, 2, null)).toBeNull();
		[0, 1, 3, 4].forEach((gt)=>{
			expect(liurengLayout(chart, gt, null)).toBeNull();
			expect(sanshiLayout(chart, gt, null)).toBeNull();
		});
	});

	test('三式页拿到 null:四课空、三传 null、快照空串,全程不抛错', ()=>{
		const chart = { objects: [{ id: AstroConst.SUN, sign: 'Aries' }], nongli: { dayGanZi: '?子', time: '甲午' }, isDiurnal: true };
		const layout = sanshiLayout(chart, 2, null);
		expect(layout).toBeNull();
		const ke = sanshiKeData(layout, chart);
		expect(ke).toEqual({ raw: [], lines: [] });
		expect(sanshiSanChuan(layout, ke.raw, chart, null)).toBeNull();
		expect(buildSanShiUnitedSnapshotText({ dunjia: {}, keData: ke, sanChuan: null, lrLayout: layout })).toBe('');
	});

	test('三式这份保留缺省贵人体系(未传 guirengType 时按星占法)', ()=>{
		const chart = mkChart('Gemini', '庚', '辰', false);
		expect(JSON.stringify(pick(sanshiLayout(chart, undefined, null)))).toBe(JSON.stringify(pick(liurengLayout(chart, 2, null))));
	});
});
