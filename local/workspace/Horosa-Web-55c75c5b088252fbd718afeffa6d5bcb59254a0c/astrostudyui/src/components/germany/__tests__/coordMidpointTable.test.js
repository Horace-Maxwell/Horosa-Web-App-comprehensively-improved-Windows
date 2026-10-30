// 中点坐标两表(CoordMidpoint)的分组 / 文案:赤经按 30° 段,赤纬按北 / 南;接触按目标因子分组,常规点受 planetDisplay 筛。
import { coordValueText, coordMidpointGroups, coordContactGroups } from '../CoordMidpoint';

describe('CoordMidpoint 分组与文案', () => {
  it('坐标值文案:赤经度分(进位不出 60′),赤纬带北 / 南', () => {
    expect(coordValueText('ra', 123.5)).toBe('123°30′');
    expect(coordValueText('ra', 29.9999)).toBe('30°00′');
    expect(coordValueText('ra', -1)).toBe('359°00′');
    expect(coordValueText('decl', -12.25)).toBe('南 12°15′');
    expect(coordValueText('decl', 3.1)).toBe('北 3°06′');
  });

  it('赤经按 30° 段成组、组内升序;赤纬按北 / 南成组、各按离赤道由近到远', () => {
    const ra = coordMidpointGroups('ra', [
      { idA: 'a', idB: 'b', value: 45 }, { idA: 'c', idB: 'd', value: 10 }, { idA: 'e', idB: 'f', value: 31 }, { idA: 'g', idB: 'h', value: 359.9 },
    ]);
    expect(ra.map((g) => [g.label, g.rows.map((r) => r.value)])).toEqual([
      ['0°–30°', [10]], ['30°–60°', [31, 45]], ['330°–360°', [359.9]],
    ]);
    const decl = coordMidpointGroups('decl', [
      { idA: 'a', idB: 'b', value: -5 }, { idA: 'c', idB: 'd', value: 8 }, { idA: 'e', idB: 'f', value: -1 }, { idA: 'g', idB: 'h', value: 2 },
    ]);
    expect(decl.map((g) => [g.label, g.rows.map((r) => r.value)])).toEqual([['北赤纬', [2, 8]], ['南赤纬', [-1, -5]]]);
  });

  it('接触按目标分组:常规点排前且受 planetDisplay 筛,虚星等其余点随后不受筛;组内按误差升序', () => {
    const cs = [
      { id: 'Cupido', idA: 'Sun', idB: 'Moon', aspect: 0, delta: 0.3 },
      { id: 'Moon', idA: 'Sun', idB: 'Mars', aspect: 90, delta: 0.5 },
      { id: 'Sun', idA: 'Moon', idB: 'Mars', aspect: 180, delta: 0.4 },
      { id: 'Sun', idA: 'Venus', idB: 'Mars', aspect: 0, delta: 0.1 },
    ];
    const all = coordContactGroups(cs, null);
    expect(all.map((g) => [g.id, g.rows.map((r) => r.delta)])).toEqual([['Sun', [0.1, 0.4]], ['Moon', [0.5]], ['Cupido', [0.3]]]);
    expect(coordContactGroups(cs, ['Sun']).map((g) => g.id)).toEqual(['Sun', 'Cupido']);
  });
});
