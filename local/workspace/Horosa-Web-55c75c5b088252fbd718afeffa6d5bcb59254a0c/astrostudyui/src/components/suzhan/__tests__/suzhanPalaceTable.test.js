// 宿占宫宿表与宿盘同一分宫:赤经每 30° 一宫、从命宫那一段数第 1 宫;星曜按赤经落宫。
// 不再按西洋宫头黄经取座(非整宫制下两个宫头常落同一座 → 地支重复、另一支缺位)。
import { buildSuzhanSnapshotText } from '../SuZhanMain';
import * as SZConst from '../SZConst';

function chartOf(){
	// 非整宫制宫头:第 1、2 宫宫头都在金牛(30–60°),双子缺宫头
	const lons = [35, 55, 95, 120, 150, 185, 215, 235, 275, 300, 330, 5];
	const houses = lons.map((lon, i)=>({ id: `House${i + 1}`, lon, ra: lon }));
	const objects = [
		{ id: 'Asc', ra: 40, signlon: 10, su28: '胃', house: 'House1' },
		{ id: 'Sun', ra: 70, signlon: 10, su28: '觜', house: 'House2' },   // 双子段(60–90°):以前因没有宫头在双子而丢失
		{ id: 'Moon', ra: 200, signlon: 20, su28: '角', house: 'House6' },
	];
	return { houses, objects, fixedStarSu28: [], nongli: {} };
}

it('12 宫各占一支、不重不缺;命宫(上升所在赤经段)为第 1 宫;星曜按赤经落宫', ()=>{
	const fields = { houseStartMode: { value: SZConst.SZHouseStart_ASC } };
	const text = buildSuzhanSnapshotText({ chart: chartOf() }, fields, ['Asc', 'Sun', 'Moon']);
	const rows = text.split('\n').filter((l)=>/^\| [子丑寅卯辰巳午未申酉戌亥]—/.test(l));
	expect(rows).toHaveLength(12);
	const zis = rows.map((r)=>r.slice(2, 3));
	expect(new Set(zis).size).toBe(12);
	expect(rows[0]).toMatch(/^\| 酉—大梁—金牛座—第1宫/);
	expect(rows[1]).toMatch(/^\| 申—实沉—双子座—第2宫 \| 觜 \| 日/);
	expect(rows.find((r)=>/天秤座/.test(r))).toMatch(/角 \| 月/);
});
