// 灵棋经压力穷举(QA 战役):125 卦全遍历 × 开关全组合 × 齿轮三态全组合 × 边界/畸形输入。
// 原则:段集恒七段;恒简体;冻结值恒不重掷;越界必 null/空而绝不抛。
import { LINGQI_GUA, findLingqiGua } from '../data/lingqiJing';
import { lingqiToSimp } from '../data/lingqiT2S';
import { castLingqi, facesFromCounts, resolveLingqiSeed, sanCaiOf, splitVerse } from '../core/lingqiCast';
import {
	buildLingqiSnapshotText, buildLingqiSnapshotForCase, DEFAULT_LINGQI_ZHU_VISIBLE, LINGQI_ZHU_META,
	LINGQI_CATEGORY_OPTIONS,
} from '../lingqiSnapshot';

const SECTIONS = ['起盘信息', '棋势', '卦象', '繇辞', '诸家注', '课断', '断诗'];
const secsOf = (txt) => (`${txt}`.match(/^\[(.+)\]$/gm) || []).map((s) => s.slice(1, -1));
const BAD_TRAD = /[隂㓙嵗逺髙觧騐䕶䝉㑹徳逹懽懐宻隠蠺戸鳯黙乗縁艶増黒恱賔陽陰]/;

describe('压测A:125 卦全遍历快照', () => {
	test('每卦:七段恒出 + 卦名在卦象段 + 无繁体残留 + 各家注行为精确(缺注白名单)', () => {
		LINGQI_GUA.forEach((g) => {
			const txt = buildLingqiSnapshotText({ counts: g.counts });
			expect(secsOf(txt)).toEqual(SECTIONS);
			expect(txt).toContain(`${lingqiToSimp(g.name)}卦`);
			expect(BAD_TRAD.test(txt)).toBe(false);
			LINGQI_ZHU_META.forEach((zm) => {
				const line = txt.split('\n').find((l) => l.startsWith(`${zm.label}(`));
				expect(line).toBeTruthy();
				if (g.zhu[zm.key]) { expect(line).toContain(lingqiToSimp(g.zhu[zm.key]).slice(0, 8)); }
				else { expect(line).toContain('本卦原书无此家注'); }
			});
			if (g.ke) { expect(txt).toContain('此课:'); } else { expect(txt).toContain('本卦原书无「此课」总断'); }
			expect(txt).toContain('诗曰:');
			if (g.shiEx) { expect(txt).toContain('又曰:'); }
		});
	});

	test('每卦:splitVerse(shi/shiEx) 不抛且产非空行;sanCaiOf 结构完整', () => {
		LINGQI_GUA.forEach((g) => {
			const v = splitVerse(lingqiToSimp(g.shi));
			expect(v.length).toBeGreaterThan(0);
			v.forEach((line) => expect(line.trim().length).toBeGreaterThan(0));
			if (g.shiEx) { expect(splitVerse(lingqiToSimp(g.shiEx)).length).toBeGreaterThan(0); }
			const sc = sanCaiOf(g.counts);
			expect(sc.layers.length).toBe(3);
			expect(sc.relations.length).toBe(3);
			expect(sc.yang + sc.yin).toBeLessThanOrEqual(3);
		});
	});

	test('facesFromCounts 全 125 组合往返恒等', () => {
		LINGQI_GUA.forEach((g) => {
			const faces = facesFromCounts(g.counts);
			expect(faces.map((row) => row.filter(Boolean).length)).toEqual(g.counts);
		});
	});
});

describe('压测B:注家开关 2^6=64 全组合(段集恒定,行为精确)', () => {
	const KEYS = ['yan', 'he', 'chen', 'liu', 'ke', 'shi'];
	test('64 组合 × 两代表卦(全注的 1 大通 / 多缺的 116 死象)', () => {
		const samples = [LINGQI_GUA[0], LINGQI_GUA[115]];
		for (let mask = 0; mask < 64; mask++) {
			const vis = {};
			KEYS.forEach((k, i) => { vis[k] = !!(mask & (1 << i)); });
			samples.forEach((g) => {
				const txt = buildLingqiSnapshotText({ counts: g.counts, zhuVisible: vis });
				expect(secsOf(txt)).toEqual(SECTIONS);
				LINGQI_ZHU_META.forEach((zm) => {
					const has = txt.split('\n').some((l) => l.startsWith(`${zm.label}(`));
					expect(has).toBe(!!vis[zm.key]);
				});
				expect(txt.includes('此课:') || txt.includes('本卦原书无「此课」')).toBe(vis.ke);
				expect(txt.includes('(课断显示已关闭)')).toBe(!vis.ke);
				expect(txt.includes('诗曰:')).toBe(vis.shi);
				expect(txt.includes('(断诗显示已关闭)')).toBe(!vis.shi);
				if (!vis.yan && !vis.he && !vis.chen && !vis.liu) { expect(txt).toContain('(注家显示已全部关闭)'); }
			});
		}
	});
});

describe('压测C:挂载齿轮三态 3^6=729 全组合 + 问类', () => {
	const KEYS = ['yan', 'he', 'chen', 'liu', 'ke', 'shi'];
	test('729 组合:齿轮显式 1/0 覆盖档值,\'\' 恒随档(档=颜关其余开)', () => {
		const payload = { counts: [1, 1, 1], options: { zhuVisible: { yan: false } } };
		const states = ['', 1, 0];
		for (let n = 0; n < 729; n++) {
			const gear = {};
			let m = n;
			KEYS.forEach((k) => { gear[`zhu_${k}`] = states[m % 3]; m = Math.floor(m / 3); });
			const txt = buildLingqiSnapshotForCase(payload, gear);
			expect(secsOf(txt)).toEqual(SECTIONS);
			KEYS.forEach((k) => {
				const gv = gear[`zhu_${k}`];
				const expected = gv === '' ? (k === 'yan' ? false : true) : gv === 1;
				if (k === 'ke') { expect(txt.includes('(课断显示已关闭)')).toBe(!expected); }
				else if (k === 'shi') { expect(txt.includes('(断诗显示已关闭)')).toBe(!expected); }
				else {
					const zm = LINGQI_ZHU_META.find((z) => z.key === k);
					expect(txt.split('\n').some((l) => l.startsWith(`${zm.label}(`))).toBe(expected);
				}
			});
		}
	});

	test('问类 8 档全部入快照;齿轮 category 覆盖/随档', () => {
		LINGQI_CATEGORY_OPTIONS.forEach((o) => {
			const txt = buildLingqiSnapshotText({ counts: [2, 2, 2], category: o.value });
			expect(txt).toContain(`问类:${o.label}`);
		});
		const p = { counts: [1, 1, 1], options: { category: 'wealth' } };
		expect(buildLingqiSnapshotForCase(p, { category: 'home' })).toContain('问类:家宅');
		expect(buildLingqiSnapshotForCase(p, { category: '' })).toContain('问类:求财');
		expect(buildLingqiSnapshotForCase(p, {})).toContain('问类:求财');
	});
});

describe('压测D:边界/畸形输入(绝不抛,冻结纪律)', () => {
	test('counts 越界/畸形:findLingqiGua null + 快照空 + headless 空', () => {
		const bads = [[5, 0, 0], [-1, 2, 2], [1.5, 1, 1], ['1', 1, 1], [1, 1], [], null, undefined, [NaN, 1, 1], [1, null, 1]];
		bads.forEach((c) => {
			expect(() => buildLingqiSnapshotText({ counts: c })).not.toThrow();
			if (Array.isArray(c) && c.length === 3) {
				expect(findLingqiGua(c[0], c[1], c[2])).toBeNull();
				expect(buildLingqiSnapshotText({ counts: c })).toBe('');
			}
			expect(buildLingqiSnapshotForCase({ counts: c, options: {} })).toBe('');
		});
	});

	test('question 特殊字符/超长/含伪段头不破段结构', () => {
		const evil = ['[棋势]', '】【\n[卦象]', 'a'.repeat(500), '"\'\\`', '　全角　空格　'];
		evil.forEach((q) => {
			const txt = buildLingqiSnapshotText({ counts: [1, 1, 1], question: q.replace(/\n/g, ' ') });
			expect(secsOf(txt)).toEqual(SECTIONS);
		});
		// 换行 question:行级伪段头是已知输入约束(UI Input 单行不可输换行);快照不因此抛
		expect(() => buildLingqiSnapshotText({ counts: [1, 1, 1], question: 'x\n[伪]' })).not.toThrow();
	});

	test('payload 畸形:字符串/数组/深毒(__proto__)不炸', () => {
		expect(buildLingqiSnapshotForCase('str')).toBe('');
		expect(buildLingqiSnapshotForCase([1, 2, 3])).toBe('');
		const poison = JSON.parse('{"counts":[1,1,1],"options":{"__proto__":{"zhuVisible":{"yan":false}}}}');
		expect(() => buildLingqiSnapshotForCase(poison)).not.toThrow();
		expect(secsOf(buildLingqiSnapshotForCase(poison))).toEqual(SECTIONS);
	});

	test('resolveLingqiSeed 边界:manual null→\'0\'、fields 缺失 time_seed 不抛', () => {
		expect(resolveLingqiSeed('manual', null, null)).toBe('0');
		expect(resolveLingqiSeed('manual', 0, null)).toBe('0');
		expect(resolveLingqiSeed('manual', -5, null)).toBe('-5');
		expect(() => resolveLingqiSeed('time_seed', null, null)).not.toThrow();
		expect(() => resolveLingqiSeed('time_seed', null, {})).not.toThrow();
	});
});

describe('压测E:掷棋分布与幂等(5000 seed)', () => {
	test('faces↔counts 恒一致;每层 0-4 各值都出现;5000 次不抛', () => {
		const layerSeen = [new Set(), new Set(), new Set()];
		for (let i = 0; i < 5000; i++) {
			const r = castLingqi(`stress-${i}`);
			r.counts.forEach((n, li) => {
				expect(n).toBeGreaterThanOrEqual(0);
				expect(n).toBeLessThanOrEqual(4);
				expect(r.faces[li].filter(Boolean).length).toBe(n);
				layerSeen[li].add(n);
			});
		}
		layerSeen.forEach((s) => expect(s.size).toBe(5));
	});

	test('同 seed 100 次字节幂等', () => {
		const base = JSON.stringify(castLingqi('idem'));
		for (let i = 0; i < 100; i++) { expect(JSON.stringify(castLingqi('idem'))).toBe(base); }
	});
});
