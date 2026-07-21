// 皇极轨策 · 三百八十四爻全表金标。
//
// 🔴 失败 = 引擎错，不得改测试将就。
//    fixture 为古籍所载之全表；引擎由公式派生。两者逐字吻合方证公式无误。
import GOLDEN from './fixtures/guice384.json';
import { bodyNumber, moveNumber, buildGuiceTable, __resetGuiceTableCache } from '../core/guiceEngine';
import { XIANTIAN_NUM, HOUTIAN_NUM, DAN_GUA_CE, DAN_GUA_GUI } from '../core/guiceConst';

const ROWS = GOLDEN.rows;

describe('轨策 · 三百八十四爻全表（古籍金标 384/384）', () => {
	test('fixture 自身完备：64 卦 × 6 爻，无重无漏', () => {
		expect(ROWS).toHaveLength(384);
		expect(new Set(ROWS.map((r) => `${r.up}${r.lo}${r.dongYao}`)).size).toBe(384);
		expect(new Set(ROWS.map((r) => `${r.up}${r.lo}`)).size).toBe(64);
	});

	test('策数 384/384 逐字吻合（含身数）', () => {
		const bad = [];
		ROWS.forEach((r) => {
			const m = moveNumber(r.up, r.lo, r.dongYao, 'ce');
			if (!m) return bad.push(`${r.name}${r.dongYao}爻: 无果`);
			if (m.body !== r.yuanCe) bad.push(`${r.name}${r.dongYao}爻 身数: ${m.body} ≠ ${r.yuanCe}`);
			if (m.value !== r.ceShu) bad.push(`${r.name}${r.dongYao}爻 策数: ${m.value} ≠ ${r.ceShu}`);
		});
		expect(bad).toEqual([]);
	});

	test('轨数 384/384 逐字吻合（含原轨）', () => {
		const bad = [];
		ROWS.forEach((r) => {
			const m = moveNumber(r.up, r.lo, r.dongYao, 'gui');
			if (!m) return bad.push(`${r.name}${r.dongYao}爻: 无果`);
			if (m.body !== r.yuanGui) bad.push(`${r.name}${r.dongYao}爻 原轨: ${m.body} ≠ ${r.yuanGui}`);
			if (m.value !== r.guiShu) bad.push(`${r.name}${r.dongYao}爻 轨数: ${m.value} ≠ ${r.guiShu}`);
		});
		expect(bad).toEqual([]);
	});

	test('buildGuiceTable 派生之表与金标同（策/轨各 384 行）', () => {
		__resetGuiceTableCache();
		['ce', 'gui'].forEach((mode) => {
			const t = buildGuiceTable(mode);
			expect(t).toHaveLength(384);
			const key = (r) => `${r.up}|${r.lo}|${r.dongYao}`;
			const map = t.reduce((m, r) => { m[key(r)] = r; return m; }, {});
			const bad = ROWS.filter((r) => map[key(r)].value !== (mode === 'ce' ? r.ceShu : r.guiShu));
			expect(bad.map((r) => `${r.name}${r.dongYao}`)).toEqual([]);
		});
	});

	test('表懒生成且模块级缓存（同 mode 二次调用返同一引用）', () => {
		__resetGuiceTableCache();
		expect(buildGuiceTable('ce')).toBe(buildGuiceTable('ce'));
		expect(buildGuiceTable('ce')).not.toBe(buildGuiceTable('gui'));
	});
});

describe('轨策 · 交接锚点（逐个写死）', () => {
	test.each([
		['坤', '坤', 1, 'ce', 144, 11825], ['坤', '坤', 1, 'gui', 672, 14789],
		['巽', '艮', 5, 'ce', null, 10097], ['震', '巽', 3, 'ce', null, 9732],
		['震', '艮', 4, 'gui', null, 30991], ['乾', '乾', 5, 'ce', null, 11239],
		['坤', '坤', 6, 'ce', null, 9958], ['巽', '兑', 2, 'ce', null, 4425],
	])('%s上%s下 %s爻动 · %s → %s', (up, lo, yao, mode, body, want) => {
		const m = moveNumber(up, lo, yao, mode);
		if (body !== null) expect(m.body).toBe(body);
		expect(m.value).toBe(want);
	});
});

describe('轨策 · 常量由规则派生（非硬编）', () => {
	test('先天正数 = 八卦表之序 +1（乾1 兑2 离3 震4 巽5 坎6 艮7 坤8）', () => {
		expect(XIANTIAN_NUM).toEqual({ 乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8 });
	});
	test('后天正数无 5/10（五与十为寄宫之槽）', () => {
		expect(Object.values(HOUTIAN_NUM).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
	});
	test('单卦原策/原轨由爻之阴阳派生，与古籍所载同', () => {
		expect(DAN_GUA_CE).toEqual({ 乾: 108, 坤: 72, 艮: 84, 兑: 96, 震: 84, 巽: 96, 坎: 84, 离: 96 });
		expect(DAN_GUA_GUI).toEqual({ 乾: 384, 坤: 336, 艮: 352, 兑: 368, 震: 352, 巽: 368, 坎: 352, 离: 368 });
	});
	test('身数 = 上卦原策 + 下卦原策（不随动爻变）', () => {
		const bad = [];
		Object.keys(XIANTIAN_NUM).forEach((up) => Object.keys(XIANTIAN_NUM).forEach((lo) => {
			const want = DAN_GUA_CE[up] + DAN_GUA_CE[lo];
			for (let f = 1; f <= 6; f += 1) if (bodyNumber(up, lo, 'ce') !== want) bad.push(`${up}${lo}${f}`);
		}));
		expect(bad).toEqual([]);
	});
});

describe('轨策 · 边界与坏值', () => {
	test('动爻越域（0/7/负/非数）→ null，不抛', () => {
		[0, 7, -1, null, undefined, 'x', 1.5].forEach((f) => expect(moveNumber('乾', '坤', f, 'ce')).toBeNull());
	});
	test('非卦名 → null，不抛', () => {
		expect(moveNumber('甲', '坤', 1, 'ce')).toBeNull();
		expect(bodyNumber('', '', 'ce')).toBeNull();
	});
	test('演数之档缺省即策数（默认即现状）', () => {
		expect(moveNumber('坤', '坤', 1).value).toBe(moveNumber('坤', '坤', 1, 'ce').value);
	});
});
