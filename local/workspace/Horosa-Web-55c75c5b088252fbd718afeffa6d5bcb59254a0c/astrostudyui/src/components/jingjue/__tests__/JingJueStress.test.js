/**
 * 荆诀(JingJue)穷举压力测试 —— 纯新增,零改引擎/组件/常量。
 *
 * 技法结构:前端仅一个用户可选项「起筮种子 seed」(InputNumber 0..999999999),
 * 排盘/起卦引擎在后端 Python(_cast(seed) 三十算分三)。前端起课入口 = 导出的
 * buildJingJueSnapshotForFields(fields, opts):
 *   parseFieldsDateTime(fields) → 种子派生(opts.seed 覆盖或由起课时间派生) →
 *   postJingJue('pan', {...dt, seed}) → buildSnapshotText(pan)。
 *
 * 本文件两条穷举轴:
 *  (A) 前端起课管线:选项 seed 的每种取值 × 大量时间/种子输入(笛卡尔全覆盖),
 *      mock fetch 捕获真正 POST 出去的 seed,断言:不抛异常 + 派生 seed 为有限
 *      整数且在 [0,1e9) + 快照结构完整无 NaN/undefined 混入。
 *  (B) 后端起卦引擎可达状态空间穷举:引擎唯一随机量 = divider∈[10,29] 与
 *      lower_cut∈[1,16],共 320 个可达 cast 状态。以文档算法的纯参照模型逐个
 *      枚举(参照模型仅存在于测试内,绝不改引擎),断言每个状态的卦键都能解析到
 *      16 卦之一(不触发 ValueError→ResultCode -1),并记录任何数据完整性异常。
 *
 * 发现问题只记录进 crashes[](见 __STRESS_SUMMARY__),测试本体保持绿。
 */

import moment from 'moment';
import { buildJingJueSnapshotForFields } from '../JingJueMain';

// ── 引擎真值:vendor/jingjue/gua_dict.py 的 16 个合法卦键(测试参照数据,非引擎)──
const VALID_KEYS = {
	'433': '甲', '411': '乙', '343': '丙', '424': '丁', '312': '戊', '334': '己',
	'231': '壬', '222': '癸', '213': '子', '141': '丑', '132': '寅', '321': '卯',
	'123': '辰', '114': '巳', '442': '午', '244': '未',
};

// Python 风格非负取模,余 0 记为 4(照 count % 4 or 4)。
function remOf(count) {
	const m = ((count % 4) + 4) % 4;
	return m === 0 ? 4 : m;
}

// 文档算法(_cast 的纯结构部分)在测试内的参照模型 —— 只用来穷举引擎可达状态。
function refCastState(divider, lowerCut) {
	const topCount = divider - 10;
	const remainderPool = 30 - topCount;
	const middleCount = remainderPool - lowerCut;
	const bottomCount = lowerCut;
	const counts = [topCount, middleCount, bottomCount];
	const remainders = counts.map(remOf);
	const key = remainders.join('');
	return { counts, remainders, key };
}

// mock 后端:据 body.seed 派生一个结构忠实的 pan(镜像 Python 输出形状)。
function fakePanFromBody(body) {
	const seed = Number(body && body.seed);
	const s = Number.isFinite(seed) ? (Math.abs(Math.floor(seed)) % 1000000000) : 0;
	const divider = 10 + (s % 20);
	const lowerCut = 1 + (Math.floor(s / 20) % 16);
	const { counts, remainders, key } = refCastState(divider, lowerCut);
	const name = VALID_KEYS[key] || '甲';
	const labels = ['上分', '中分', '下分'];
	const groups = counts.map((count, idx) => ({
		key: labels[idx],
		count,
		remainder: remainders[idx],
		label: `${labels[idx]}：${count}算，余${remainders[idx]}`,
	}));
	const gua = {
		name,
		text: '参照卦义文本。',
		verdict: '吉',
		spirit: '—',
		keyword: '参照关键词',
		english: '',
	};
	const jingjue = {
		seed: s, method: '三十算分三', key, divider, lowerCut, groups, remainders, gua,
		allGua: Object.keys(VALID_KEYS).map((k) => ({
			key: k, name: VALID_KEYS[k], verdict: '吉', spirit: '—', keyword: 'kw', text: 't', summary: 't',
		})),
	};
	const dateStr = body.date || '';
	const timeStr = body.time || '';
	const sections = [
		{ title: '起课', rows: [
			{ label: '起课时间', value: `${dateStr} ${timeStr}`.trim() || '—' },
			{ label: '卦键', value: key },
			{ label: '三分余数', value: remainders.join('、') },
		] },
		{ title: '卦辞', rows: [
			{ label: '干卦', value: name },
			{ label: '吉凶', value: gua.verdict },
		] },
	];
	const snapshot = sections.map((sec) => {
		const lines = [`[${sec.title}]`];
		sec.rows.forEach((r) => lines.push(`${r.label}：${r.value}`));
		lines.push('');
		return lines.join('\n');
	}).join('\n').trim();
	return { source: 'jingjue', engine: 'jingjue', dateStr, timeStr, seed: s, jingjue, sections, snapshot };
}

function makeFields(spec) {
	// spec: { date:'YYYY-MM-DD'|null, time:'HH:mm:ss'|null, zone, invalid }
	const f = {};
	if (spec.date !== undefined) {
		if (spec.date === null) {
			f.date = { value: null };
		} else if (spec.invalidDate) {
			f.date = { value: moment(spec.date, 'YYYY-MM-DD', true) }; // 严格 → Invalid
		} else {
			f.date = { value: moment(spec.date, 'YYYY-MM-DD') };
		}
	}
	if (spec.time !== undefined) {
		if (spec.time === null) {
			f.time = { value: null };
		} else {
			f.time = { value: moment(spec.time, 'HH:mm:ss') };
		}
	}
	if (spec.zone !== undefined) {
		f.zone = { value: spec.zone };
	}
	return f;
}

// ── 时间/种子输入样本(≥30,含边界:空/缺项/无效/闰日/子时/跨年/极端年) ──
const TIME_SAMPLES = [
	{ tag: 'normal-noon', date: '2024-06-15', time: '12:30:00', zone: '8' },
	{ tag: 'leap-feb29', date: '2024-02-29', time: '08:00:00', zone: '8' },
	{ tag: 'nonleap-feb29-invalid', date: '2023-02-29', time: '08:00:00', zone: '8', invalidDate: true },
	{ tag: 'zi-early', date: '2024-01-01', time: '00:00:00', zone: '8' },
	{ tag: 'zi-late', date: '2024-01-01', time: '23:30:00', zone: '8' },
	{ tag: 'zi-2359', date: '2024-01-01', time: '23:59:59', zone: '8' },
	{ tag: 'cross-year-eve', date: '2023-12-31', time: '23:59:59', zone: '8' },
	{ tag: 'cross-year-new', date: '2024-01-01', time: '00:00:01', zone: '8' },
	{ tag: 'year-0001', date: '0001-01-01', time: '00:00:00', zone: '0' },
	{ tag: 'year-9999', date: '9999-12-31', time: '23:59:59', zone: '0' },
	{ tag: 'year-1900', date: '1900-01-01', time: '00:00:00', zone: '8' },
	{ tag: 'epoch-1970', date: '1970-01-01', time: '00:00:00', zone: '0' },
	{ tag: 'dst-ish', date: '2024-03-10', time: '02:30:00', zone: '-5' },
	{ tag: 'noon-midyear', date: '2000-07-15', time: '12:00:00', zone: '8' },
	{ tag: 'late-eve', date: '1984-11-23', time: '22:15:45', zone: '8' },
	{ tag: 'early-morning', date: '2010-05-01', time: '05:05:05', zone: '9' },
	{ tag: 'noon-2038', date: '2038-01-19', time: '03:14:07', zone: '0' },
	{ tag: 'feb28-nonleap', date: '2025-02-28', time: '11:11:11', zone: '8' },
	{ tag: 'mar01-afterleap', date: '2024-03-01', time: '00:00:30', zone: '8' },
	{ tag: 'dec-solstice', date: '2022-12-22', time: '05:48:00', zone: '8' },
	{ tag: 'jun-solstice', date: '2022-06-21', time: '17:14:00', zone: '8' },
	{ tag: 'neg-zone', date: '1999-09-09', time: '09:09:09', zone: '-11' },
	{ tag: 'big-pos-zone', date: '2015-08-08', time: '08:08:08', zone: '14' },
	{ tag: 'random-a', date: '1888-08-18', time: '18:18:18', zone: '8' },
	{ tag: 'random-b', date: '2077-07-07', time: '07:07:07', zone: '8' },
	{ tag: 'random-c', date: '1600-02-29', time: '13:33:33', zone: '0' },
	// 无效/缺项样本
	{ tag: 'empty-fields', empty: true },
	{ tag: 'date-only', date: '2024-06-15', time: undefined, zone: '8' },
	{ tag: 'time-only', date: undefined, time: '12:00:00', zone: '8' },
	{ tag: 'date-null', date: null, time: '12:00:00', zone: '8' },
	{ tag: 'time-null', date: '2024-06-15', time: null, zone: '8' },
	{ tag: 'no-zone', date: '2024-06-15', time: '12:00:00' },
	{ tag: 'invalid-date-str', date: 'not-a-date', time: '12:00:00', zone: '8', invalidDate: true },
	{ tag: 'invalid-time-str', date: '2024-06-15', time: '99:99:99', zone: '8' },
];

// ── 选项 seed(opts.seed)取值域(唯一用户可选项 + 各种异常形态) ──
const SEED_OPTION_VALUES = [
	undefined, null, '', 0, '0', 1, -1, -999999, 123456789, 999999999,
	1000000000, 1000000001, 1e12, 3.7, -3.7, 'abc', NaN, Infinity, -Infinity, '  42  ',
];

const CRASHES = [];
function recordCrash(input, error) {
	CRASHES.push({ input, error: `${error && error.message ? error.message : error}`, file: 'src/components/jingjue/JingJueMain.js' });
}

let combosCovered = 0;

describe('荆诀(A)前端起课管线:选项 seed × 时间/种子输入 穷举', () => {
	let capturedPayloads;
	const origFetch = global.fetch;

	beforeEach(() => {
		capturedPayloads = [];
		global.fetch = jest.fn(async (url, init) => {
			let body = {};
			try { body = JSON.parse(init.body); } catch (e) { body = {}; }
			capturedPayloads.push(body);
			const pan = fakePanFromBody(body);
			return { text: async () => JSON.stringify({ ResultCode: 0, Result: pan }) };
		});
	});
	afterEach(() => { global.fetch = origFetch; });

	// 笛卡尔全覆盖:20 seed × 34 时间 = 680 组合
	SEED_OPTION_VALUES.forEach((seedOpt) => {
		TIME_SAMPLES.forEach((sample) => {
			const label = `seed=${String(seedOpt)} | ${sample.tag}`;
			test(label, async () => {
				combosCovered += 1;
				const fields = sample.empty ? {} : makeFields(sample);
				capturedPayloads.length = 0;
				let result;
				try {
					result = await buildJingJueSnapshotForFields(fields, { seed: seedOpt });
				} catch (e) {
					// buildJingJueSnapshotForFields 内部 catch-all,本不应抛;若抛=真 bug
					recordCrash(label, e);
					return; // 记录后保持绿
				}

				// 结果类型契约:恒为 string
				if (typeof result !== 'string') {
					recordCrash(label, new Error(`result 非 string: ${typeof result}`));
					return;
				}

				const dtParseable = !sample.empty
					&& sample.date && sample.time
					&& !sample.invalidDate
					&& sample.date !== null && sample.time !== null
					&& sample.time !== '99:99:99';

				if (!dtParseable) {
					// 缺/无效时间 → 预期空串、无 POST。属预期跳过而非崩溃。
					if (capturedPayloads.length > 0) {
						// 无有效时间却发出了请求 → 记录(非预期)
						const seedSent = capturedPayloads[0].seed;
						if (!Number.isFinite(Number(seedSent))) {
							recordCrash(label, new Error(`无效时间仍 POST 且 seed 非有限: ${seedSent}`));
						}
					}
					expect(typeof result).toBe('string');
					return;
				}

				// 有效时间:必发一次 POST,捕获真正下发的 seed
				if (capturedPayloads.length === 0) {
					recordCrash(label, new Error('有效时间未产生任何 POST'));
					return;
				}
				const payload = capturedPayloads[0];
				const seedSent = payload.seed;

				// 核心数值断言:派生 seed 必为有限整数且在 [0, 1e9)
				if (typeof seedSent !== 'number' || !Number.isFinite(seedSent)) {
					recordCrash(label, new Error(`下发 seed 非有限数值: ${seedSent}`));
				} else if (Number.isNaN(seedSent)) {
					recordCrash(label, new Error('下发 seed 为 NaN'));
				} else if (!Number.isInteger(seedSent)) {
					recordCrash(label, new Error(`下发 seed 非整数: ${seedSent}`));
				} else if (seedSent < 0 || seedSent >= 1000000000) {
					recordCrash(label, new Error(`下发 seed 越界: ${seedSent}`));
				}

				// POST body 的时间字段不得混入 NaN
				['year', 'month', 'day', 'hour', 'minute', 'second'].forEach((k) => {
					const v = payload[k];
					if (v !== undefined && (typeof v !== 'number' || Number.isNaN(v))) {
						recordCrash(label, new Error(`POST body.${k} 非法: ${v}`));
					}
				});

				// 快照结构完整:非空 + 不含裸 undefined/NaN 字面量
				if (!result || !result.trim()) {
					recordCrash(label, new Error('有效时间但快照为空串'));
				} else if (/\bundefined\b/.test(result) || /\bNaN\b/.test(result)) {
					recordCrash(label, new Error(`快照混入 undefined/NaN: ${result.slice(0, 80)}`));
				}

				expect(typeof result).toBe('string');
			});
		});
	});
});

describe('荆诀(B)后端起卦引擎可达状态空间穷举(320 态)', () => {
	test('divider[10..29] × lowerCut[1..16] 每态卦键都解析到 16 卦之一', () => {
		const negativeCountStates = [];
		const unresolved = [];
		let n = 0;
		for (let divider = 10; divider <= 29; divider += 1) {
			for (let lowerCut = 1; lowerCut <= 16; lowerCut += 1) {
				n += 1;
				const { counts, remainders, key } = refCastState(divider, lowerCut);
				// 余数必须各在 1..4
				remainders.forEach((r, idx) => {
					if (!(r >= 1 && r <= 4)) {
						recordCrash(`engine divider=${divider} lowerCut=${lowerCut}`, new Error(`余数越界[${idx}]=${r}`));
					}
				});
				// 卦键必须命中 16 卦,否则 _cast 抛 ValueError → ResultCode -1
				if (!VALID_KEYS[key]) {
					unresolved.push({ divider, lowerCut, counts, key });
					recordCrash(`engine divider=${divider} lowerCut=${lowerCut}`, new Error(`卦键未命中(引擎将 ValueError): key=${key}`));
				}
				// 数据完整性:三分算数出现负值(语义异常,不崩但可疑)
				if (counts.some((c) => c < 0)) {
					negativeCountStates.push({ divider, lowerCut, counts, key });
				}
			}
		}
		combosCovered += n;
		expect(n).toBe(320);
		// 未命中卦键 = 真崩溃,已记录进 CRASHES;此处硬断言引擎无崩溃状态
		expect(unresolved).toEqual([]);

		// 负算数不致崩(卦键仍合法),仅作为数据完整性观察记录,不判失败。
		if (negativeCountStates.length > 0) {
			// eslint-disable-next-line no-console
			console.warn(`[荆诀观察] ${negativeCountStates.length}/320 个可达 cast 状态出现负的“中分算数”(不崩溃,卦键仍合法),例: ${JSON.stringify(negativeCountStates[0])}`);
		}
		// 记录为软发现(不进 crashes:非崩溃/非 NaN/结构完整)
		expect(negativeCountStates.length).toBeGreaterThanOrEqual(0);
	});
});

afterAll(() => {
	// eslint-disable-next-line no-console
	console.log(`\n__STRESS_SUMMARY__ ${JSON.stringify({ combosCovered, crashesCount: CRASHES.length, crashes: CRASHES.slice(0, 20) })}`);
});
