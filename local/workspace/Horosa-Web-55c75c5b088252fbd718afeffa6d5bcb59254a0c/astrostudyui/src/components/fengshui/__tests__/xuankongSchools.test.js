// 玄空 门派 / 兼向度界 / 五黄分运 三维 + 真假打劫。
// 🔴 铁律：三维彼此独立、任意组合；全默认（沈氏 + 出中3° + 下卦运）必须与「什么都不传」逐字节一致。
import { xuankong } from '../xuankong';
import { SHAN_ORDER, XUANKONG_SCHOOLS, JIAN_BOUNDARY_OPTIONS, WUHUANG_SPLIT_OPTIONS, ROB_GROUPS } from '../fengshuiData';

const J = (o)=>JSON.stringify(o);
// 剥掉本批新增的回显字段后，其余必须与旧版逐字节同。
const strip = (o)=>{ const c = { ...o }; delete c.school; delete c.jianBoundary; delete c.wuHuangSplit; delete c.wuHuang; return c; };

describe('玄空 · 门派/度界/分运 三维', ()=>{
	it('数据层：4 门派，唯中州带自动联动（五黄两元八运），其余 auto 为 null', ()=>{
		expect(XUANKONG_SCHOOLS.length).toBe(4);
		expect(XUANKONG_SCHOOLS.map((s)=>s.key)).toEqual(['shen', 'wuchang', 'zhongzhou', 'guangdong']);
		const withAuto = XUANKONG_SCHOOLS.filter((s)=>s.auto);
		expect(withAuto.length).toBe(1);
		expect(withAuto[0].key).toBe('zhongzhou');
		expect(withAuto[0].auto).toEqual({ wuHuangSplit: 'liangyuan' });
		// 🔴 严禁门派→替星表/度界的臆造映射：任何门派都不得携带这两类联动。
		XUANKONG_SCHOOLS.forEach((s)=>{
			if (!s.auto) { return; }
			expect(Object.keys(s.auto)).toEqual(['wuHuangSplit']);
		});
	});

	it('🔴 全默认逐字节零回归：9运×24山，显式写默认三维 === 什么都不传', ()=>{
		for (let yun = 1; yun <= 9; yun++) {
			SHAN_ORDER.forEach((s)=>{
				const base = xuankong(yun, s, { year: 2026, month: 5 });
				const explicit = xuankong(yun, s, { year: 2026, month: 5, school: 'shen', jianBoundary: 3, wuHuangSplit: 'xiagua' });
				expect(J(strip(explicit))).toBe(J(strip(base)));
			});
		}
	});

	it('🔴 门派与五黄分运绝不改飞星三盘字节', ()=>{
		for (let yun = 1; yun <= 9; yun++) {
			SHAN_ORDER.forEach((s)=>{
				const base = xuankong(yun, s, { year: 2026 });
				XUANKONG_SCHOOLS.forEach((sc)=>{
					WUHUANG_SPLIT_OPTIONS.forEach((w)=>{
						const r = xuankong(yun, s, { year: 2026, school: sc.key, wuHuangSplit: w.value });
						expect(J(r.yunPan)).toBe(J(base.yunPan));
						expect(J(r.shanPan)).toBe(J(base.shanPan));
						expect(J(r.xiangPan)).toBe(J(base.xiangPan));
						expect(r.ge).toBe(base.ge);
					});
				});
			});
		}
	});

	it('兼向度界三值真生效（同一度数在不同度界下判别不同）', ()=>{
		// 午山中心 180°，向首 176° = 出中 4°：3° 界已判兼向，4.5°/6° 界仍作下卦。
		expect(xuankong(9, '午', { deg: 176, jianBoundary: 3 }).jianInfo.jian).toBe(true);
		expect(xuankong(9, '午', { deg: 176, jianBoundary: 4.5 }).jianInfo.jian).toBe(false);
		expect(xuankong(9, '午', { deg: 176, jianBoundary: 6 }).jianInfo.jian).toBe(false);
		// 出中 5°：3°/4.5° 判兼，6° 仍下卦。
		expect(xuankong(9, '午', { deg: 175, jianBoundary: 4.5 }).jianInfo.jian).toBe(true);
		expect(xuankong(9, '午', { deg: 175, jianBoundary: 6 }).jianInfo.jian).toBe(false);
		// 非法值回落默认 3。
		expect(xuankong(9, '午', { deg: 176, jianBoundary: 99 }).jianBoundary).toBe(3);
		expect(xuankong(9, '午', { deg: 176, jianBoundary: null }).jianBoundary).toBe(3);
		JIAN_BOUNDARY_OPTIONS.forEach((o)=>{
			expect(xuankong(9, '午', { deg: 176, jianBoundary: o.value }).jianBoundary).toBe(o.value);
		});
	});

	it('五黄分运只在 5 运产出元属文案，且不改任何盘', ()=>{
		expect(xuankong(5, '午', { wuHuangSplit: 'liangyuan' }).wuHuang).not.toBeNull();
		expect(xuankong(5, '午', { wuHuangSplit: 'liangyuan' }).wuHuang.segments.length).toBe(2);
		expect(xuankong(5, '午', { wuHuangSplit: 'xiagua' }).wuHuang).toBeNull();
		for (let yun = 1; yun <= 9; yun++) {
			if (yun === 5) { continue; }
			expect(xuankong(yun, '午', { wuHuangSplit: 'liangyuan' }).wuHuang).toBeNull();
		}
	});

	it('门派回显：desc/focus 出，且不含任何替星表或度数承诺', ()=>{
		XUANKONG_SCHOOLS.forEach((sc)=>{
			const r = xuankong(9, '午', { school: sc.key });
			expect(r.school.key).toBe(sc.key);
			expect(r.school.name).toBe(sc.name);
			expect(typeof r.school.desc).toBe('string');
			expect(Array.isArray(r.school.focus)).toBe(true);
		});
		expect(xuankong(9, '午', { school: 'nonexistent' }).school).toBeNull();
	});
});

describe('玄空 · 真假七星打劫（此前被三元表达式压平）', ()=>{
	it('数据层 ROB_GROUPS 本就分真假', ()=>{
		expect(ROB_GROUPS.li.nature).toBe('good');
		expect(ROB_GROUPS.kan.nature).toBe('mild');
	});
	it('🔴 消费端 flags.nature 必须照搬数据层，坎宫打劫恒为 mild', ()=>{
		let sawLi = false; let sawKan = false;
		for (let yun = 1; yun <= 9; yun++) {
			SHAN_ORDER.forEach((s)=>{
				const r = xuankong(yun, s);
				(r.rob || []).forEach((rb)=>{
					const f = r.flags.find((x)=>x.key === `rob_${rb.key}`);
					expect(f).toBeTruthy();
					expect(f.nature).toBe(ROB_GROUPS[rb.key].nature);
					if (rb.key === 'li') { sawLi = true; expect(f.nature).toBe('good'); }
					if (rb.key === 'kan') { sawKan = true; expect(f.nature).toBe('mild'); }
				});
			});
		}
		// 两种打劫都要在 9运×24山 全域里真出现过，否则断言等于没跑。
		expect(sawLi).toBe(true);
		expect(sawKan).toBe(true);
	});
});
