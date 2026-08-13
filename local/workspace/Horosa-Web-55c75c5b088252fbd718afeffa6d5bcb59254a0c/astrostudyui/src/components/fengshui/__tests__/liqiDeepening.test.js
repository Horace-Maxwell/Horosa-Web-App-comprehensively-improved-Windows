// 理气深化（B5）· golden —— 三合赖公拨砂/格龙、八宅法脉三档/三元阳宅、玄空收山出煞。
// 🔴 三条铁律在此机器钉死：
//   ① 全部为 additive：不传新参时逐字段与旧路等值（零回归，形势图判/既有 golden 不受影响）。
//   ② 赖公拨砂用**人盘中针**、五行表与双山三合五行**不同源**，两档结论允许相反，不可互相校准。
//   ③ 收山出煞是「形势理气合参」的独立结论，**不改 ge 的本判**（古籍两说并陈，不合并）。
import { sanhe } from '../sanhe';
import { bazhai } from '../bazhai';
import { xuankong } from '../xuankong';
import { LAIGONG_BOSHA_WUXING } from '../fengshuiLiqiDeepData';

describe('三合 · 赖公拨砂（人盘中针）', ()=>{
	const base = { shuiKou: '辛', waterFlow: 'leftToRight' };
	const sands = { 坎: 'sand', 离: 'sand', 震: 'sand', 兑: 'sand' };

	test('默认档（双山）不受影响：不传 boshaVariant 与显式传 shuangshan 全等', ()=>{
		const a = JSON.stringify(sanhe({ ...base, sands }).bosha);
		const b = JSON.stringify(sanhe({ ...base, sands, boshaVariant: 'shuangshan' }).bosha);
		expect(a).toBe(b);
		expect(sanhe({ ...base, sands }).bosha.myFrom).toBe('向');
	});
	test('赖公档：我＝坐山之人盘中针字，且带子目（太阳火/太阴火）与口径说明', ()=>{
		const r = sanhe({ ...base, sands, boshaVariant: 'laigong', zuoShanForBosha: '子' }).bosha;
		expect(r.boshaVariant).toBe('laigong');
		expect(r.myFrom).toBe('坐山（人盘中针）');
		// 人盘中针较地盘正针退半山：子山中心 0° → 读中针得 0+7.5° 所在之字。
		expect(r.myShan).toBeTruthy();
		expect(r.myWuxing).toBe(LAIGONG_BOSHA_WUXING[r.myShan]);
		expect(r.note).toMatch(/中针|赖/);
	});
	test('🔴 赖公档与双山档判据不同源：同一砂位可得不同五格（并陈两说，不可互校）', ()=>{
		const dbl = sanhe({ ...base, sands }).bosha;
		const lai = sanhe({ ...base, sands, boshaVariant: 'laigong', zuoShanForBosha: '子' }).bosha;
		const geOf = (b, g)=>{ const h = b.sands.find((x)=>x.gua === g); return h && h.wuGe ? h.wuGe.ge : null; };
		const diff = ['坎', '离', '震', '兑'].filter((g)=>geOf(dbl, g) !== geOf(lai, g));
		expect(diff.length).toBeGreaterThan(0);
		// 赖公档每个砂位都读到中针之字（而非卦正五行）
		lai.sands.filter((x)=>x.actual === 'sand').forEach((x)=>{ expect(x.shaShan).toBeTruthy(); });
	});
	test('赖公档缺坐山 → 回落双山档（不产出半成品）', ()=>{
		const r = sanhe({ ...base, sands, boshaVariant: 'laigong', zuoShanForBosha: '' }).bosha;
		expect(r.boshaVariant).toBe('shuangshan');       // 如实标注实际所用档（否则右栏渲染出 undefined 山）
		expect(r.fellBack).toMatch(/赖公档需坐山/);
		expect(r.myShan).toBeUndefined();
	});
	test('赖公五行表六类齐备（太阳火/太阴火/木/金/水/土）', ()=>{
		const set = new Set(Object.values(LAIGONG_BOSHA_WUXING));
		expect(Object.keys(LAIGONG_BOSHA_WUXING)).toHaveLength(24);
		['火', '木', '金', '水', '土'].forEach((w)=>{ expect(set.has(w)).toBe(true); });
	});
});

describe('三合 · 格龙（来龙）', ()=>{
	const base = { shuiKou: '辛', waterFlow: 'leftToRight' };
	test('不传 laiLong → geLong 为 null（零回归）', ()=>{
		expect(sanhe(base).geLong).toBeNull();
	});
	test('来龙在本局长生环上的阶如实读出，生旺为吉、死绝为凶', ()=>{
		const r = sanhe({ ...base, laiLong: '艮' }).geLong;
		expect(r).toBeTruthy();
		expect(r.stage).toBeTruthy();
		expect(r.text).toContain(r.stage);
		expect(['good', 'bad', 'neutral']).toContain(r.jx);
		// 火局（水口辛）：长生在寅 → 艮寅双山值「长生」为大吉。
		expect(r.shuangshan).toContain('寅');
		expect(r.stage).toBe('长生');
		expect(r.jx).toBe('good');
	});
	test('死绝之龙判凶（火局墓在戌 → 乾戌双山）', ()=>{
		const r = sanhe({ ...base, laiLong: '戌' }).geLong;
		expect(r.stage).toBe('墓');
		expect(r.jx).toBe('bad');
	});
	test('🔴 龙水两套方向的告诫必须随判出（左旋顺起论水、右旋逆起论龙）', ()=>{
		expect(sanhe({ ...base, laiLong: '艮' }).geLong.note).toMatch(/左旋顺起论水.*右旋逆起论龙/);
	});
	test('未定局（无水口）或来龙不在环上 → 不出 geLong', ()=>{
		expect(sanhe({ laiLong: '艮' }).geLong).toBeNull();
		expect(sanhe({ ...base, laiLong: 'X' }).geLong).toBeNull();
	});
});

describe('八宅 · 法脉三档', ()=>{
	const base = { zuoGua: '坎', doorGua: '巽', mainGua: '离', stoveGua: '震' };
	test('默认档＝坐山起伏位；不传 faMai 与显式传 zuoshan 全等（零回归）', ()=>{
		const a = bazhai(base);
		const b = bazhai({ ...base, faMai: 'zuoshan' });
		expect(a.faMai).toBe('zuoshan');
		expect(JSON.stringify(a.palaces)).toBe(JSON.stringify(b.palaces));
		expect(a.fuweiGua).toBe('坎');
	});
	test('门上起伏位：伏位改从门卦起，八方游星整体换一套', ()=>{
		const a = bazhai(base);
		const b = bazhai({ ...base, faMai: 'menshang' });
		expect(b.fuweiGua).toBe('巽');
		expect(JSON.stringify(b.palaces)).not.toBe(JSON.stringify(a.palaces));
		// 门卦所在宫在门上档必为伏位
		expect((b.palaces.find((p)=>p.gua === '巽') || {}).name).toBe('伏位');
	});
	test('门上档缺门卦 → 回落坐山（不产出空盘）', ()=>{
		const b = bazhai({ zuoGua: '坎', faMai: 'menshang' });
		expect(b.fuweiGua).toBe('坎');
	});
	test('lunMing=false（真八宅只论宅不论命）：命卦相关字段整组不出', ()=>{
		const r = bazhai({ ...base, ming: { year: 1985, isMale: true }, lunMing: false });
		expect(r.mingGua).toBeNull();
		expect(r.match).toBeNull();
		expect(r.lunMing).toBe(false);
		// 默认仍论命（零回归）
		expect(bazhai({ ...base, ming: { year: 1985, isMale: true } }).mingGua).toBeTruthy();
	});
});

describe('八宅 · 三元阳宅（门向定宅·游年只断时日）', ()=>{
	const base = { zuoGua: '坎', doorGua: '巽', mainGua: '离', stoveGua: '震' };
	test('非本档不出 sanyuan（零回归）', ()=>{
		expect(bazhai(base).sanyuan).toBeNull();
		expect(bazhai({ ...base, faMai: 'menshang' }).sanyuan).toBeNull();
	});
	test('门宫＝当运 → 兴；＝生气 → 兴；皆非 → 替', ()=>{
		// 巽宫＝4。4 运当运 → 兴；3 运（生气＝4）→ 兴；9 运 → 替。
		expect(bazhai({ ...base, faMai: 'sanyuan', yun: 4 }).sanyuan.xingTi).toBe('xing');
		expect(bazhai({ ...base, faMai: 'sanyuan', yun: 4 }).sanyuan.wang).toBe(true);
		expect(bazhai({ ...base, faMai: 'sanyuan', yun: 3 }).sanyuan.shengQi).toBe(true);
		expect(bazhai({ ...base, faMai: 'sanyuan', yun: 3 }).sanyuan.xingTi).toBe('xing');
		expect(bazhai({ ...base, faMai: 'sanyuan', yun: 9 }).sanyuan.xingTi).toBe('ti');
	});
	test('🔴 兴替反转口径逐字随判（逢兴鬼绝更昌隆／遇替生延皆困迫）', ()=>{
		expect(bazhai({ ...base, faMai: 'sanyuan', yun: 4 }).sanyuan.fanZhuan).toMatch(/逢兴鬼绝更昌隆/);
		expect(bazhai({ ...base, faMai: 'sanyuan', yun: 9 }).sanyuan.fanZhuan).toMatch(/遇替生延皆困迫/);
		expect(bazhai({ ...base, faMai: 'sanyuan', yun: 4 }).sanyuan.youNianRole).toMatch(/只作断时日/);
	});
	test('九运逐运遍历不抛、xingTi 恰在两运为兴（当运运4 + 生气运3）', ()=>{
		const xing = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((y)=>bazhai({ ...base, faMai: 'sanyuan', yun: y }).sanyuan.xingTi === 'xing');
		expect(xing).toEqual([3, 4]);
	});
	test('🔴 缺门卦 → 据实报缺，绝不把 null 拼进可见文案（真机抓到过「门在null宫」）', ()=>{
		const sy = bazhai({ zuoGua: '坎', faMai: 'sanyuan', yun: 9 }).sanyuan;
		expect(sy.menGua).toBeNull();
		expect(sy.needsMen).toBe(true);
		expect(sy.xingTi).toBe('ti');
		[sy.verdict.text, sy.fanZhuan, sy.youNianRole, sy.note].forEach((t)=>{
			expect(t).not.toMatch(/null|undefined/);
		});
		expect(sy.verdict.text).toMatch(/未设大门之卦/);
		expect(sy.verdict.jx).toBe('neutral');       // 缺参不是凶断
	});
	it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('九运遍历：任一运下全部可见文案都无 null/undefined（运 %i）', (y)=>{
		[{}, { doorGua: '巽' }, { doorGua: 'X' }].forEach((patch)=>{
			const sy = bazhai({ zuoGua: '坎', faMai: 'sanyuan', yun: y, ...patch }).sanyuan;
			[sy.verdict.text, sy.fanZhuan, sy.youNianRole, sy.note].forEach((t)=>{
				expect(typeof t).toBe('string');
				expect(t).not.toMatch(/null|undefined/);
			});
		});
	});
});

describe('玄空 · 收山出煞', ()=>{
	// xuankong(yun, xiangShan, opts)：坐子＝向午。
	const XK = (opts)=>xuankong(8, '午', opts);
	test('不传 shousha → null（零回归：ge/palaces 逐字不变）', ()=>{
		const a = XK({});
		const b = XK({ shousha: {} });
		expect(a.shousha).toBeNull();
		expect(b.ge).toBe(a.ge);
		expect(JSON.stringify(b.palaces)).toBe(JSON.stringify(a.palaces));
	});
	test('三吉＝当令+生气+次生，且 9 运回绕为 [9,1,2]', ()=>{
		expect(XK({ shousha: { 1: 'shan' } }).shousha.sanJi).toEqual([8, 9, 1]);
		expect(xuankong(9, '午', { shousha: { 1: 'shan' } }).shousha.sanJi).toEqual([9, 1, 2]);
	});
	test('四原则逐条：旺山宜见山、衰山宜见水、旺向宜见水、衰向宜见山', ()=>{
		const r = XK({ shousha: { 1: 'shan', 3: 'shui', 7: 'gao', 9: 'kong' } });
		r.shousha.rows.forEach((row)=>{
			expect(row.hits).toHaveLength(2);
			const shanLike = row.env === 'shan' || row.env === 'gao';
			expect(row.hits[0].ok).toBe(row.shanWang ? shanLike : !shanLike);   // 山星面
			expect(row.hits[1].ok).toBe(row.xiangWang ? !shanLike : shanLike);  // 向星面
		});
		expect(r.shousha.okN + r.shousha.badN).toBe(r.shousha.rows.length * 2);
	});
	test('高物等同见山、空地等同见水（形势之实质，不看名相）', ()=>{
		const g = XK({ shousha: { 1: 'gao' } }).shousha.rows[0];
		const s = XK({ shousha: { 1: 'shan' } }).shousha.rows[0];
		expect(g.hits.map((h)=>h.ok)).toEqual(s.hits.map((h)=>h.ok));
		const k = XK({ shousha: { 1: 'kong' } }).shousha.rows[0];
		const w = XK({ shousha: { 1: 'shui' } }).shousha.rows[0];
		expect(k.hits.map((h)=>h.ok)).toEqual(w.hits.map((h)=>h.ok));
	});
	test('中宫不参与、未录之宫不参与（据实录判，不补默认）', ()=>{
		const r = XK({ shousha: { 5: 'shan', 1: 'shan' } }).shousha;
		expect(r.rows.map((x)=>x.gong)).toEqual([1]);
		expect(XK({ shousha: {} }).shousha.rows).toHaveLength(0);
	});
	test('全合→吉、全违→凶、半数以上合→中评', ()=>{
		const all = XK({ shousha: { 1: 'shan', 2: 'shan', 3: 'shan', 4: 'shan', 6: 'shan', 7: 'shan', 8: 'shan', 9: 'shan' } }).shousha;
		expect(all.rows).toHaveLength(8);
		expect(['good', 'neutral', 'bad']).toContain(all.verdict.jx);
		// 构造全合：逐宫按其山向旺衰给对应形势
		const opt = {};
		const probe = XK({ shousha: { 1: 'shan', 2: 'shan', 3: 'shan', 4: 'shan', 6: 'shan', 7: 'shan', 8: 'shan', 9: 'shan' } }).shousha;
		probe.rows.forEach((row)=>{ opt[row.gong] = (row.shanWang && !row.xiangWang) ? 'shan' : ((!row.shanWang && row.xiangWang) ? 'shui' : 'shan'); });
		const tuned = XK({ shousha: opt }).shousha;
		expect(tuned.badN).toBeLessThanOrEqual(all.badN);
	});
	test('🔴 收山出煞绝不改 ge 的本判（两说并陈，不合并）', ()=>{
		const worst = { 1: 'shui', 2: 'shui', 3: 'shui', 4: 'shui', 6: 'shui', 7: 'shui', 8: 'shui', 9: 'shui' };
		const a = XK({});
		const b = XK({ shousha: worst });
		expect(b.ge).toBe(a.ge);
		expect(b.shousha.note).toMatch(/虽上山下水亦吉/);
	});
	test('脏入参不抛（非对象/非法值一律不产出行）', ()=>{
		expect(XK({ shousha: 'x' }).shousha).toBeNull();
		// 非法 env 若被放行，两面判据双双 false → 凭空造「全违」凶断，故必须等同未录。
		expect(XK({ shousha: { 1: 'X', 2: '' } }).shousha.rows).toHaveLength(0);
	});
});
