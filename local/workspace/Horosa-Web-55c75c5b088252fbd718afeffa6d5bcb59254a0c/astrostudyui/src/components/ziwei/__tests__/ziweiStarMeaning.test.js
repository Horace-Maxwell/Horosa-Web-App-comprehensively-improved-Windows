// WP-7 星曜含义数据完整性。
import M from '../data/tables/ziweiStarMeaning.json';

const MAIN14 = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];

describe('WP-7 星曜含义结构化', ()=>{
	test('14 主星齐全且五行/斗分/化气/主管/性格五字段完整', ()=>{
		expect(Object.keys(M.mainStars).sort()).toEqual([...MAIN14].sort());
		MAIN14.forEach((s)=>{
			const m = M.mainStars[s];
			['wuxing', 'dou', 'huaqi', 'zhu', 'xing'].forEach((f)=>{
				expect(typeof m[f]).toBe('string');
				expect(m[f].length).toBeGreaterThan(0);
			});
		});
	});
	test('十二宫+身宫含义齐(键与 ZWHouses 同款带宫后缀)', ()=>{
		['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫', '身宫'].forEach((h)=>{
			expect(typeof M.houses[h]).toBe('string');
		});
	});
	test('四化含义 + 常用辅佐杂曜含义非空', ()=>{
		['禄', '权', '科', '忌'].forEach((h)=>{ expect(M.sihua[h].length).toBeGreaterThan(0); });
		['左辅', '右弼', '文昌', '文曲', '禄存', '天马', '擎羊', '火星'].forEach((s)=>{
			expect(typeof M.assistStars[s]).toBe('string');
		});
	});
});
