// 八字快照 [卦释] 段 = legacy「卦释」页签逐柱卦象。干配上卦、支配下卦为本卦;互卦取爻 234 / 345;旁通取全爻反转;卦名对 64 卦表取全名。
import { buildBaziSnapshotForParams } from '../BaZi';

const BASE = { date: '1990/06/15', time: '08:30:00', zone: '+08:00', lat: '39n54', lon: '116e23', gender: 1, ad: 1, timeAlg: 0, phaseType: 0, godKeyPos: '年', after23NewDay: 0, adjustJieqi: 0, byLon: 0 };

test('[卦释] 段在 [干支合冲] 之后、[大运] 之前;胎元 + 四柱各一行,三卦齐全且为 64 卦全名', async ()=>{
	const s = await buildBaziSnapshotForParams({ ...BASE, school: 'zonghe' });
	const i = s.indexOf('[卦释]');
	expect(i).toBeGreaterThan(0);
	expect(i).toBeLessThan(s.indexOf('[大运]'));
	const seg = s.slice(i, s.indexOf('[大运]')).trim().split('\n').slice(1);
	expect(seg.map((l)=>l.split(' ')[0])).toEqual(['胎元', '年柱', '月柱', '日柱', '时柱']);
	seg.forEach((l)=>expect(l).toMatch(/^\S+ \S\S:本卦 \S+ · 互卦 \S+ · 旁通 \S+$/));
});

test('金标:庚午 = 震上离下「雷火丰」,互卦「泽风大过」,旁通「风水涣」', async ()=>{
	const s = await buildBaziSnapshotForParams({ ...BASE, school: 'zonghe' });
	const row = s.split('\n').find((l)=>l.startsWith('年柱 '));
	expect(row).toBe('年柱 庚午:本卦 雷火丰 · 互卦 泽风大过 · 旁通 风水涣');
});
