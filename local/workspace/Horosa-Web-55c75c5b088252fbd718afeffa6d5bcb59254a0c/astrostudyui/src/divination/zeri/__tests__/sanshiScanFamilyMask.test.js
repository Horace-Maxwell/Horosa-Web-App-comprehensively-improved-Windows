// 三式择日扫描:只排条件树涉及的家(未涉家不进判定、行键为 SKIP 段 → 结果与三家全排一致);逐刻解释 / 预览不给掩码 = 三家全排
import { computeSanshiScanPan, sanshiKeyMaskOf, plateKeyOf } from '../sanshiZeriScanEngine';

const GEO = { zone: '+08:00', gpsLat: 31.23, gpsLon: 121.47, lat: '31n13', lon: '121e28', ad: 1 };

it('只涉六壬的树:奇门 / 太乙不排;行键与三家全排在该树掩码下相同', ()=>{
	const tree = { type: 'all', conditions: [{ type: 'lr_ke_name', params: { values: ['元首课'] } }] };
	const mask = sanshiKeyMaskOf(tree);
	expect(mask.fams).toEqual({ lr: true, qm: false, ty: false });
	const lean = computeSanshiScanPan({ fams: mask.fams }, GEO, {}, '2027-01-05', '10:10:00');
	const full = computeSanshiScanPan({}, GEO, {}, '2027-01-05', '10:10:00');
	expect(lean.qimen).toBe(null); expect(lean.taiyi).toBe(null);
	expect(lean._famFail).toEqual({});
	expect(full.qimen && full.taiyi).toBeTruthy();
	expect(plateKeyOf(lean, mask)).toBe(plateKeyOf(full, mask));
});

it('空树 / 未知前缀:三家全排(保守)', ()=>{
	expect(sanshiKeyMaskOf({ type: 'all', conditions: [] }).fams).toEqual({ lr: true, qm: true, ty: true });
	expect(sanshiKeyMaskOf({ type: 'all', conditions: [{ type: 'zz_x' }] }).fams).toEqual({ lr: true, qm: true, ty: true });
});
