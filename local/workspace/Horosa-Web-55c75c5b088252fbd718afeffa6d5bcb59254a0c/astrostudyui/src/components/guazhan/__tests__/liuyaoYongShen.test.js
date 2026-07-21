import {
	relativeRoles, resolveYongShen, locateYaos, pickYongShenYao, analyzeYongShen,
	YONGSHEN_CATEGORIES, getYongShenCategory,
} from '../../gua/liuyaoYongShen';
import { analyzeGua } from '../../gua/LiuYaoEngine';
import { Gua64 } from '../../gua/GuaConst';

function byName(n){ return Gua64.find((g) => g.name === n); }

describe('六爻用神体系·WP-E', () => {
	test('原神/忌神/仇神(古籍五六亲全验)', () => {
		expect(relativeRoles('妻财')).toEqual({ yuan: '子孙', ji: '兄弟', chou: '父母' }); // 古籍例
		expect(relativeRoles('父母')).toEqual({ yuan: '官鬼', ji: '妻财', chou: '子孙' });
		expect(relativeRoles('子孙')).toEqual({ yuan: '兄弟', ji: '父母', chou: '官鬼' });
		expect(relativeRoles('官鬼')).toEqual({ yuan: '妻财', ji: '子孙', chou: '兄弟' });
		expect(relativeRoles('兄弟')).toEqual({ yuan: '父母', ji: '官鬼', chou: '妻财' });
	});

	test('世/应 用神无六亲原忌仇', () => {
		expect(relativeRoles('世')).toBeNull();
		expect(relativeRoles('应')).toBeNull();
	});

	test('取用表覆盖六类六亲 + 世/应 + 婚姻男女/疾病次用神', () => {
		expect(getYongShenCategory('wealth').yong).toBe('妻财');
		expect(getYongShenCategory('career').yong).toBe('官鬼');
		expect(getYongShenCategory('self').yong).toBe('世');
		expect(getYongShenCategory('opponent').yong).toBe('应');
		expect(getYongShenCategory('marriage_m')).toMatchObject({ yong: '妻财', secondary: '世' });
		expect(getYongShenCategory('marriage_f')).toMatchObject({ yong: '官鬼', secondary: '世' });
		expect(getYongShenCategory('illness')).toMatchObject({ yong: '官鬼', secondary: '子孙' });
		// 每项 yong 必为六亲或世应
		YONGSHEN_CATEGORIES.forEach((c) => {
			expect(['父母', '兄弟', '子孙', '妻财', '官鬼', '世', '应']).toContain(c.yong);
		});
	});

	test('resolveYongShen(求财) 带原忌仇', () => {
		const r = resolveYongShen('wealth');
		expect(r.yong).toBe('妻财');
		expect(r.roles).toEqual({ yuan: '子孙', ji: '兄弟', chou: '父母' });
	});

	test('locateYaos:乾为天 妻财在第2爻;世在第6爻', () => {
		const res = analyzeGua(byName('乾为天'), { monthZhi: '午', dayZhi: '子' });
		expect(locateYaos(res.yaos, '妻财')).toEqual([2]);
		expect(locateYaos(res.yaos, '世')).toEqual([6]);
		expect(locateYaos(res.yaos, '应')).toEqual([3]);
	});

	test('用神多现(风地观 官鬼两现)→ multiple=true', () => {
		const res = analyzeGua(byName('风地观'), { monthZhi: '午', dayZhi: '子' });
		const pick = pickYongShenYao(res.yaos, '官鬼', {});
		expect(pick.candidates.length).toBe(2);
		expect(pick.multiple).toBe(true);
		// 父母临世应(第1应、第4世)→均带「临世应」标
		const fu = pickYongShenYao(res.yaos, '父母', {});
		expect([1, 4]).toContain(fu.primary);
		fu.candidates.forEach((c) => { expect(c.flags).toContain('临世应'); });
	});

	test('用神不上卦(火水未济测功名·官鬼伏)→ located.yong 候选空、伏神持官鬼', () => {
		const g = byName('火水未济');
		const res = analyzeGua(g, { monthZhi: '午', dayZhi: '子' });
		const ay = analyzeYongShen(res.yaos, 'career', { monthZhi: '午', dayZhi: '子' });
		expect(ay.yong).toBe('官鬼');
		expect(ay.located.yong.candidates.length).toBe(0); // 官鬼不上卦
		// 第3爻伏神为官鬼(古籍)
		expect(res.yaos[2].fushen).toMatchObject({ liuqin: '官鬼', zhi: '亥' });
	});

	test('手动选用神:override 覆盖占测事项自动取用,按该六亲重派原/忌/仇;不传则零回归', () => {
		const res = analyzeGua(byName('坤为地'), {});
		const r = analyzeYongShen(res.yaos, 'wealth', {}, '官鬼'); // 求财自动=妻财,手选官鬼
		expect(r.yong).toBe('官鬼');
		expect(r.manual).toBe(true);
		expect(r.roles.yuan).toBe('妻财'); // 妻财生官鬼=原神
		const r0 = analyzeYongShen(res.yaos, 'wealth', {}); // 不传 override
		expect(r0.yong).toBe('妻财');
		expect(r0.manual).toBe(false);
	});

	test('独发加权:动爻唯一时该爻得「独发」标', () => {
		const res = analyzeGua(byName('风地观'), { monthZhi: '午', dayZhi: '子' });
		const pick = pickYongShenYao(res.yaos, '官鬼', { movingPositions: [5] });
		const p5 = pick.candidates.find((c) => c.pos === 5);
		expect(p5.flags).toContain('发动');
		expect(p5.flags).toContain('独发');
		expect(pick.primary).toBe(5); // 独发者优先
	});
});
