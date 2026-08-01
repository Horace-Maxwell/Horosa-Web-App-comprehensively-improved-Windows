// horarySchools.test.js —— 卜卦五流派注册表哨兵：默认档、后端字段补丁、判读 opts、反查一致性。
import {
	HORARY_SCHOOLS, HORARY_SCHOOL_ORDER, schoolOf,
	horaryBackendFields, horaryJudgeOpts, presetOf, horarySchoolSelectOptions, VOC_EXEMPT_SIGNS,
} from '../horarySchools';

describe('horarySchools 注册表', () => {
	test('七档齐全且顺序键一一对应(批4 扩 renaissance/sequence;原五档键零变)', () => {
		expect(HORARY_SCHOOL_ORDER).toEqual(['classical', 'renaissance', 'strict', 'sequence', 'hellenistic', 'medieval', 'modern']);
		HORARY_SCHOOL_ORDER.forEach((id) => {
			expect(HORARY_SCHOOLS[id]).toBeTruthy();
			expect(HORARY_SCHOOLS[id].id).toBe(id);
			expect(typeof HORARY_SCHOOLS[id].cn).toBe('string');
			expect(HORARY_SCHOOLS[id].backend).toBeTruthy();
			expect(HORARY_SCHOOLS[id].judge).toBeTruthy();
		});
	});

	test('schoolOf 未知键回落 classical', () => {
		expect(schoolOf('___nope___').id).toBe('classical');
		expect(schoolOf(undefined).id).toBe('classical');
		expect(schoolOf('modern').id).toBe('modern');
	});

	test('默认档 classical = Regiomontanus(2)/经典界(2)/Ptolemy 三分/七曜/福点不反转', () => {
		const c = HORARY_SCHOOLS.classical;
		expect(c.backend.hsys).toBe(2);
		expect(c.backend.termsVariant).toBe(2);
		expect(c.backend.tripSystem).toBe('ptolemaic');
		expect(c.backend.tradition).toBe(1);
		expect(c.judge.pofReversal).toBe(false);
		expect(c.judge.considerationsMode).toBe('warn');
	});

	test('切档必显式生效:原五档后端签名两两不同;判读型新档(文艺复兴/序列)以 judge 区分且与经典档判读不同', () => {
		// 原五档:后端签名(宫制/界/三分/星群)两两不同 → 切档必改盘参数。
		const FIVE = ['classical', 'strict', 'hellenistic', 'medieval', 'modern'];
		const sigs = FIVE.map((id) => {
			const b = HORARY_SCHOOLS[id].backend;
			return [b.hsys, b.termsVariant, b.tripSystem, b.tradition].join('|');
		});
		expect(new Set(sigs).size).toBe(FIVE.length);
		// 判读型新档:后端与 classical 同（盘不变=有意设计），必须以判读参数显式区分。
		['renaissance', 'sequence'].forEach((id) => {
			const j = HORARY_SCHOOLS[id].judge;
			const c = HORARY_SCHOOLS.classical.judge;
			expect(JSON.stringify(j)).not.toBe(JSON.stringify(c));
		});
		// 判读型新档两者之间也不同(orbMode/considerations 分野)。
		expect(HORARY_SCHOOLS.sequence.judge.orbMode).toBe('sequence');
		expect(HORARY_SCHOOLS.renaissance.judge.orbMode).toBe('backend');
		expect(HORARY_SCHOOLS.renaissance.judge.vocMode).toBe('by_orb');
	});

	test('horaryBackendFields 仅含非 null 字段 + tripSystem 不下发 + 福点反转随档对齐', () => {
		const bf = horaryBackendFields('classical');
		// lotReversal:0 = 经典档福点恒昼式 —— 盘面(后端福点)与判读(前端 pofReversal:false)口径对齐,
		// 修复此前「默认档盘面夜盘反转/判读不反转」的潜在错位。
		expect(bf).toEqual({ hsys: 2, termsVariant: 2, tradition: 1, lotReversal: 0 });
		expect(bf.tripSystem).toBeUndefined();       // 前端判读消费,不进 /chart
		expect(bf.westNodeType).toBeUndefined();     // null 不下发
	});

	test('全部七档 backend.lotReversal 与判读 pofReversal 逐档一致(盘面↔判读福点单一口径)', () => {
		HORARY_SCHOOL_ORDER.forEach((id) => {
			const sc = HORARY_SCHOOLS[id];
			expect(sc.backend.lotReversal).toBe(sc.judge.pofReversal ? 1 : 0);
		});
	});

	test('horaryJudgeOpts 带 school + tripSystem + judge 全量', () => {
		const o = horaryJudgeOpts('medieval');
		expect(o.school).toBe('medieval');
		expect(o.tripSystem).toBe('dorothean');
		expect(o.vocMode).toBe('exempt4');
		expect(o.vocMitigateSigns).toBe(true);
	});

	test('modern 含三王星 + 不以命度早晚拒判', () => {
		expect(HORARY_SCHOOLS.modern.backend.tradition).toBe(0);  // 0=七曜+三王星
		expect(HORARY_SCHOOLS.modern.judge.includeOuter).toBe(true);
		expect(HORARY_SCHOOLS.modern.judge.considerationsMode).toBe('ignore');
		expect(HORARY_SCHOOLS.modern.judge.ascEarlyDeg).toBe(0);
		expect(HORARY_SCHOOLS.modern.judge.ascLateDeg).toBe(30);
	});

	test('presetOf 据 hsys 反查(老盘 hsys:0 → hellenistic 不误标 classical)', () => {
		expect(presetOf({ hsys: { value: 2 } })).toBe('classical');
		expect(presetOf({ hsys: { value: 0 } })).toBe('hellenistic');
		expect(presetOf({ hsys: { value: 1 } })).toBe('medieval');
		expect(presetOf({ hsys: { value: 3 } })).toBe('modern');
		expect(presetOf({})).toBe('classical');    // 缺 hsys 回落
	});

	test('选择器 options = 顺序 × 中文名', () => {
		const opts = horarySchoolSelectOptions();
		expect(opts.map((o) => o.value)).toEqual(HORARY_SCHOOL_ORDER);
		opts.forEach((o) => expect(typeof o.label).toBe('string'));
	});

	test('中世纪豁免四座 = 金牛/巨蟹/射手/双鱼', () => {
		expect(VOC_EXEMPT_SIGNS.sort()).toEqual(['cancer', 'pisces', 'sagittarius', 'taurus']);
	});

	// 注册表明面零在世作者名 —— 由发布 preflight 守卫(测试层不列举姓名)。
});
