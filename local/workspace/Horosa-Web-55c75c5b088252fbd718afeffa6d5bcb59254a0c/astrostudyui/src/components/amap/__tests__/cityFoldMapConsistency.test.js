// 地点检索 · 繁→简单字折叠表与界面显示同口径:
// 城市库全是简体;界面切到繁体后下拉里显示的是显示层转出的繁体(紐約 / 雲巖區 / 鍾祥市 …),用户照屏幕输入,
// 查询经 foldTrad 逐字折回后必须正好是库里的简体名;直接输入简体名必须原样不动(「乾县」的「乾」不能折成「干」)。
// 城市库约五万条,检索不逐条算搜索归一键(太贵),由 build 期按显示规则烘焙的折叠表承担 —— 本测试锁两者一致。
// 红了:跑 `node scripts/build-city-fold-map.js` 重新补全折叠表(改了显示规则 / 城市库之后都要跑)。
import CITIES from '../../../data/cities.json';
import CITIES_FULL from '../../../data/citiesFull.json';
import FOLD from '../../../data/cityTradSimpMap.json';
import { foldTrad, searchCities } from '../cityMatch';
import { toHant } from '../../../utils/scriptConvert/hantConverter';

const lists = [CITIES, CITIES_FULL];
const texts = [];
lists.forEach((list)=>list.forEach((c)=>{
	const name = c.n !== undefined ? c.n : c.name;
	const region = c.r !== undefined ? c.r : c.region;
	if(name){ texts.push(`${name}`); }
	if(region){ texts.push(`${region}`); }
}));
const uniq = Array.from(new Set(texts));
const names = (q)=>searchCities(q, lists, FOLD, 80).map((c)=>c.name);

describe('地点检索折叠表与界面繁体显示同口径', ()=>{
	it('扫到了完整的城市库(防静默失效)', ()=>{
		expect(uniq.length).toBeGreaterThan(30000);
	});

	it('库里用作简体的字不进折叠表(直接输入简体原样不动)', ()=>{
		const simp = new Set();
		uniq.forEach((s)=>{ for(const ch of s){ simp.add(ch); } });
		expect(Object.keys(FOLD).filter((k)=>simp.has(k))).toEqual([]);
		expect(uniq.filter((s)=>foldTrad(s, FOLD) !== s)).toEqual([]);
	});

	it('每个城市名 / 地区名照屏幕上的繁体输入都折回原名', ()=>{
		const bad = uniq.filter((s)=>foldTrad(toHant(s), FOLD) !== s).map((s)=>`${s} → ${toHant(s)} → ${foldTrad(toHant(s), FOLD)}`);
		expect(bad).toEqual([]);
	});

	it('地名里的「克」显示为「克」(不是生克的「剋」)', ()=>{
		expect(uniq.filter((s)=>/克/.test(s) && /剋/.test(toHant(s)))).toEqual([]);
	});

	it('行为:照屏幕繁体输入与简体输入结果一致;「乾县」能搜到乾县', ()=>{
		['纽约', '华盛顿', '云岩区', '钟祥市', '浚县', '慈溪市', '克山县', '乾安县'].forEach((s)=>{
			const got = names(s);
			expect(got).toContain(s);
			expect(names(toHant(s))).toEqual(got);
		});
		expect(names('乾县')).toContain('乾县');
	});
});
