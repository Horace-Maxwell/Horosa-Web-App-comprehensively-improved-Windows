// 占天时(晴雨)古法判法 —— 六家分列。
//
// 病理:tianshiSchool 曾是**死开关** —— 写入三处(默认值 / 「断易天机(古法)」预设 override /
// 缓存键),消费点**零**;天时用神映射是硬编码通行法,不按该键分叉。用户切了古法预设,
// 天时判断零变化。
//
// 现按 (a) 接线:古籍「占天时」章有六家各成体系的完整条文,其中五家判据明确、输入可得,
// 逐条接上;鬼谷辨爻法爻位表**故意不实现**(原书今注自陈「排列有错位、与他本多有不合、
// 内容亦有错误,仅供参考」,且仓内该表行列对应已丢失 —— 据其重建必然失真)。
//
// 🔴 不合成单一结论:古籍自己就说「其为法而套用,则多有冲突之处,使人不知所从」。
//    故按家分列 + 每条附原文依据,取舍留给用神者。
import { analyzeLiuyao } from '../../gua/liuyaoFacade';
import { DEFAULT_LIUYAO_SETTINGS, LIUYAO_PRESETS } from '../../gua/liuyaoSchools';
import { Gua64 } from '../../gua/GuaConst';

const CTX = { dayGan: '甲', dayZhi: '子', monthZhi: '午', yearGan: '丙', yearZhi: '子' };
function ana(name, moving, school){
	const g = Gua64.find((x)=>x.name === name);
	return analyzeLiuyao(g, moving || [], CTX, { ...DEFAULT_LIUYAO_SETTINGS, tianshiSchool: school });
}

describe('🔴 天时占法开关 · 不再是死开关', ()=>{
	it("通行档('fumu')恒不产出古法块 —— 行为一字不改(零回归)", ()=>{
		['坎为水', '离为火', '乾为天', '坤为地'].forEach((n)=>{
			[[], [1], [1, 3, 5]].forEach((mv)=>{
				expect(ana(n, mv, 'fumu').tianshi).toBeNull();
			});
		});
	});

	it("古法档('ancient')真的产出内容 —— 切换后不再零变化", ()=>{
		const a = ana('坎为水', [1], 'ancient');
		expect(a.tianshi).toBeTruthy();
		expect(Array.isArray(a.tianshi.houses)).toBe(true);
		expect(a.tianshi.houses.length).toBeGreaterThan(0);
		// 两档必须真的不同(死开关的判据就是"切了没差别")
		expect(ana('坎为水', [1], 'fumu').tianshi).toBeNull();
	});

	it('「断易天机(古法)」预设确实把该键切到 ancient(预设 → 开关 → 产出 全链通)', ()=>{
		const preset = LIUYAO_PRESETS.tianji || null;
		expect(preset).toBeTruthy();
		expect(preset.overrides.tianshiSchool).toBe('ancient');
		const g = Gua64.find((x)=>x.name === '坎为水');
		const withPreset = analyzeLiuyao(g, [1], CTX, { ...DEFAULT_LIUYAO_SETTINGS, ...preset.overrides });
		expect(withPreset.tianshi).toBeTruthy();
		expect(withPreset.tianshi.houses.length).toBeGreaterThan(0);
	});
});

describe('古法块结构与出处', ()=>{
	const a = ana('坎为水', [1], 'ancient');

	it('每家都有 source,每条 hit 都有 rule / detail / tag(可追溯到条文)', ()=>{
		a.tianshi.houses.forEach((h)=>{
			expect(typeof h.source).toBe('string');
			expect(h.source.length).toBeGreaterThan(1);
			expect(h.hits.length).toBeGreaterThan(0);
			h.hits.forEach((x)=>{
				expect(typeof x.rule).toBe('string');
				expect(x.rule.length).toBeGreaterThan(1);
				expect(typeof x.detail).toBe('string');	// 本卦命中实况,不能空
				expect(x.detail.length).toBeGreaterThan(0);
				expect(typeof x.tag).toBe('string');
			});
		});
	});

	it('🔴 免责声明在位:明说各家冲突、不合成单一结论', ()=>{
		expect(a.tianshi.disclaimer).toContain('冲突');
		expect(a.tianshi.disclaimer).toContain('不合成单一结论');
	});

	it('🔴 不实现的那一家有显式声明与理由(不装作覆盖全了)', ()=>{
		expect(Array.isArray(a.tianshi.notImplemented)).toBe(true);
		expect(a.tianshi.notImplemented.length).toBeGreaterThan(0);
		const ni = a.tianshi.notImplemented[0];
		expect(ni.source).toContain('鬼谷');
		expect(ni.why).toContain('错位');		// 原书自陈的理由
	});

	it('出处只出现在已实现的五家里(不冒名)', ()=>{
		const ALLOWED = ['孙膑歌诀', '天玄赋', '卜筮元龟', '洞林秘诀', '海底眼'];
		a.tianshi.houses.forEach((h)=>{ expect(ALLOWED).toContain(h.source); });
	});
});

describe('逐条判据正确性(按条文核对)', ()=>{
	it('坎为水:内外皆坎 → 各家的「坎主雨」都应命中', ()=>{
		const a = ana('坎为水', [1], 'ancient');
		const all = a.tianshi.houses.flatMap((h)=>h.hits.map((x)=>`${h.source}|${x.rule}`));
		// 海底眼「以卦象论:坎主雨」
		expect(all.some((s)=>/海底眼\|坎主雨/.test(s))).toBe(true);
		// 洞林秘诀「坎卦为雨旺须疾」
		expect(all.some((s)=>/洞林秘诀\|坎 →/.test(s))).toBe(true);
	});

	it('离为火:内外皆离 → 「离主晴」命中,且不出现「坎主雨」', ()=>{
		const a = ana('离为火', [1], 'ancient');
		const all = a.tianshi.houses.flatMap((h)=>h.hits.map((x)=>x.rule));
		expect(all.some((s)=>/离主晴/.test(s))).toBe(true);
		expect(all.some((s)=>/坎主雨/.test(s))).toBe(false);
	});

	it('乾为天:六爻皆阳 → 三家的「纯阳」条各自命中(亢旱 / 雨未可望)', ()=>{
		const a = ana('乾为天', [1], 'ancient');
		const byHouse = {};
		a.tianshi.houses.forEach((h)=>{ byHouse[h.source] = h.hits.map((x)=>x.rule).join(' | '); });
		expect(byHouse['天玄赋'] || '').toContain('纯阳');
		expect(byHouse['卜筮元龟'] || '').toContain('纯阳');
		expect(byHouse['孙膑歌诀'] || '').toContain('纯阳');
	});

	it('无动爻时:动爻类判据全不出,但卦象类仍在(静卦不该空白)', ()=>{
		const a = ana('坎为水', [], 'ancient');
		expect(a.tianshi).toBeTruthy();
		const all = a.tianshi.houses.flatMap((h)=>h.hits);
		expect(all.length).toBeGreaterThan(0);
		// 动爻类的 detail 里都带「动」字;静卦不该出现
		expect(all.filter((x)=>/爻.*动$/.test(x.detail)).length).toBe(0);
	});

	it('六爻全域不抛异常、结构恒稳(64 卦 × 三种动爻组合)', ()=>{
		const combos = [[], [1], [2, 4]];
		Gua64.forEach((g)=>{
			combos.forEach((mv)=>{
				let out = null;
				expect(()=>{ out = analyzeLiuyao(g, mv, CTX, { ...DEFAULT_LIUYAO_SETTINGS, tianshiSchool: 'ancient' }); }).not.toThrow();
				expect(out.tianshi).toBeTruthy();
				out.tianshi.houses.forEach((h)=>h.hits.forEach((x)=>{
					expect(x.rule).toBeTruthy();
					expect(x.detail).toBeTruthy();
				}));
			});
		});
	});

	// 观察用:把一个卦的全部命中打出来,便于人工对着条文复核(不作断言)
	it('[观察] 坎为水 初爻动 · 各家命中一览', ()=>{
		const a = ana('坎为水', [1], 'ancient');
		a.tianshi.houses.forEach((h)=>{
			console.log(`\n《${h.source}》${h.hits.length} 条`);
			h.hits.forEach((x)=>console.log(`   [${x.tag}] ${x.rule}  <=  ${x.detail}`));
		});
		expect(true).toBe(true);
	});
});
