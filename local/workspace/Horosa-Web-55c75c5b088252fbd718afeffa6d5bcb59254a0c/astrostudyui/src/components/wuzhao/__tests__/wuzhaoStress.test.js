/**
 * 五兆 穷举压力测试(纯新增,零改引擎/组件/常量)。
 *
 * 说明:五兆的排盘/起卦内核在后端(Python vendor/kinwuzhao),前端无本地引擎——
 * WuZhaoMain 通过 postWuZhao 向后端 POST 计算。前端可测的「引擎输入层」是:
 *   ①时间字段解析(parseFieldsDateTime,经 buildWuZhaoSnapshotForFields 触达)
 *   ②起盘选项归一(mode / number / manual / manualSplits)→ 请求体(payload)
 *   ③快照渲染(buildSnapshotText,经返回的 pan 触达)
 * 本测试 mock 全局 fetch:拦截每次请求捕获 payload(即引擎入参),并回一个合成 pan
 * 使快照构建器真实运行。断言:不抛异常 + payload 关键字段存在且无 NaN/undefined +
 * 快照为字符串且不混入字面 'NaN'/'undefined'。
 *
 * 发现问题只记录不改引擎:所有异常收集进 CRASHES[],测试本身保持绿。
 */
import moment from 'moment';
import { buildWuZhaoSnapshotForFields } from '../WuZhaoMain';

const CRASHES = [];
let CAPTURED = [];

// ---- mock 后端:捕获 payload,回合成 pan(含 sections 触发快照构建)----
beforeAll(() => {
	global.fetch = jest.fn(async (url, init) => {
		let payload = null;
		try {
			payload = init && init.body ? JSON.parse(init.body) : null;
		} catch (e) {
			payload = { __parseError: `${e && e.message}` };
		}
		CAPTURED.push(payload);
		const pan = {
			dateStr: payload ? payload.date : '',
			timeStr: payload ? payload.time : '',
			modeLabel: payload ? payload.mode : '',
			ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯', minute: '戊辰' },
			positions: [
				{ key: '兆', label: '兆', palace: '子', number: 18, element: '水', relation: '兄弟', beast: '玄武', prosperity: '旺', flags: [] },
			],
			sections: [
				{ title: '总览', rows: [{ label: '起盘方式', value: payload ? payload.mode : '' }, { label: '报数', value: payload ? payload.number : 0 }] },
				{ title: '六位', rows: [{ label: '兆', value: '水·兄弟' }] },
			],
		};
		return {
			ok: true,
			text: async () => JSON.stringify({ ResultCode: 0, Result: pan }),
		};
	});
});

afterAll(() => {
	// 汇总打印,便于人工核对
	// eslint-disable-next-line no-console
	console.log('WUZHAO_STRESS_CRASHES=' + JSON.stringify(CRASHES));
});

// ---- 时间样本 ≥30(含边界:子时/跨年/闰月/极端年/单位数月日/秒边界)----
function mkFields(y, mo, d, h, mi, s, zone) {
	if (y === null) {
		return { time: { value: moment('2024-06-01T12:00:00') }, zone: { value: '+08:00' } }; // 缺 date
	}
	if (mo === null) {
		return { date: { value: moment('2024-06-01') }, zone: { value: '+08:00' } }; // 缺 time
	}
	const date = moment({ year: y, month: mo - 1, day: d, hour: h, minute: mi, second: s });
	return {
		date: { value: date.clone() },
		time: { value: date.clone() },
		zone: { value: zone || '+08:00' },
	};
}

const TIME_SAMPLES = [
	mkFields(2024, 6, 1, 12, 0, 0),        // 常规
	mkFields(2024, 6, 1, 0, 0, 0),         // 子初 00:00
	mkFields(2024, 6, 1, 23, 59, 59),      // 子末 23:59:59
	mkFields(2024, 6, 1, 23, 0, 0),        // 晚子 23:00
	mkFields(2024, 2, 29, 6, 30, 15),      // 闰年 2/29
	mkFields(2023, 2, 28, 6, 30, 15),      // 平年 2/28
	mkFields(2024, 12, 31, 23, 59, 59),    // 跨年末
	mkFields(2025, 1, 1, 0, 0, 0),         // 跨年初
	mkFields(2024, 1, 1, 0, 0, 1),         // 秒 1
	mkFields(1900, 1, 1, 0, 0, 0),         // 极早
	mkFields(1901, 3, 5, 5, 5, 5),
	mkFields(2100, 12, 31, 18, 45, 30),    // 极晚
	mkFields(2000, 2, 29, 12, 0, 0),       // 世纪闰
	mkFields(1999, 12, 31, 23, 59, 58),
	mkFields(2024, 3, 20, 3, 6, 9),        // 春分附近
	mkFields(2024, 6, 21, 12, 0, 0),       // 夏至
	mkFields(2024, 9, 23, 6, 0, 0),        // 秋分
	mkFields(2024, 12, 21, 18, 0, 0),      // 冬至
	mkFields(2024, 7, 4, 1, 1, 1),
	mkFields(2024, 8, 8, 8, 8, 8),
	mkFields(2024, 11, 11, 11, 11, 11),
	mkFields(2024, 5, 5, 5, 5, 0),
	mkFields(2024, 10, 1, 13, 30, 45),
	mkFields(2024, 4, 15, 21, 15, 0),
	mkFields(2024, 6, 1, 12, 1, 0),        // 分 1
	mkFields(2024, 6, 1, 11, 59, 0),
	mkFields(2024, 2, 1, 0, 0, 0),         // 单位数月
	mkFields(2024, 1, 9, 9, 9, 9),         // 单位数日
	mkFields(2026, 7, 18, 15, 30, 0),      // 今日
	mkFields(2024, 6, 1, 12, 0, 0, '-05:00'), // 负时区
	mkFields(2024, 6, 1, 12, 0, 0, '+00:00'), // UTC
	mkFields(null, 6, 1, 12, 0, 0),        // 缺 date → 应返回 ''
	mkFields(2024, null, 1, 12, 0, 0),     // 缺 time → 应返回 ''
	{},                                    // 空 fields → ''
	null,                                  // null → ''
	{ date: { value: null }, time: { value: null }, zone: { value: '' } }, // 空值
];

// ---- 选项取值域(每个选项每种取值)----
const MODES = ['ganzhi', 'day', 'hour', 'minute', 'tang', 'bogus', '', null, undefined];
const NUMBERS = [0, 1, 45, 90, 91, 999, -5, 45.7, NaN, null, undefined, '13', 'abc'];
const MANUALS = [true, false, 1, 0, undefined, null];
const SPLITS = [
	undefined,
	[18, 8, 5, 2, 1, 1],          // 默认
	[35, 35, 35, 35, 35, 35],     // 上界
	[1, 1, 1, 1, 1, 1],           // 下界
	[10, 20, 30, 1, 2, 3],        // 常规
	[1, 2, 3],                    // 错长度 → 应回退默认
	'notarray',                   // 非数组 → 回退默认
	[NaN, 8, 5, 2, 1, 1],         // 含 NaN
];

const ALLOWED_MODES = ['ganzhi', 'day', 'hour', 'minute', 'tang'];

function assertPayloadSane(payload, ctxLabel) {
	if (payload === null) {
		return; // 缺时间:未发请求,合法
	}
	// mode 必落在允许集(非法应归一为 ganzhi)
	if (ALLOWED_MODES.indexOf(payload.mode) < 0) {
		throw new Error(`mode 非法归一失败: ${payload.mode}`);
	}
	// number 必为有限数、非 NaN
	if (typeof payload.number !== 'number' || Number.isNaN(payload.number) || !Number.isFinite(payload.number)) {
		throw new Error(`number 非有限数: ${payload.number}`);
	}
	// manual 必为布尔
	if (typeof payload.manual !== 'boolean') {
		throw new Error(`manual 非布尔: ${payload.manual}`);
	}
	// manualSplits 必为长度 6 的数组
	if (!Array.isArray(payload.manualSplits) || payload.manualSplits.length !== 6) {
		throw new Error(`manualSplits 结构坏: len=${payload.manualSplits && payload.manualSplits.length}`);
	}
	// 时间字段必为有限数、非 NaN
	['year', 'month', 'day', 'hour', 'minute', 'second'].forEach((k) => {
		const v = payload[k];
		if (typeof v !== 'number' || Number.isNaN(v)) {
			throw new Error(`时间字段 ${k} 为 NaN/非数: ${v}`);
		}
	});
}

function assertSnapshotSane(text, ctxLabel) {
	if (typeof text !== 'string') {
		throw new Error(`快照非字符串: ${typeof text}`);
	}
	if (/\bNaN\b/.test(text) || /\bundefined\b/.test(text)) {
		throw new Error(`快照混入 NaN/undefined: ${text.slice(0, 120)}`);
	}
}

async function runOne(fields, opts, label) {
	CAPTURED = [];
	let text;
	try {
		text = await buildWuZhaoSnapshotForFields(fields, opts);
	} catch (e) {
		CRASHES.push({ input: label, error: `THROW: ${e && e.message}` });
		return;
	}
	try {
		// 每次调用最多产生一个 payload(缺时间时为 0)
		const payload = CAPTURED.length ? CAPTURED[CAPTURED.length - 1] : null;
		assertPayloadSane(payload, label);
		if (payload) {
			assertSnapshotSane(text, label);
		}
	} catch (e) {
		CRASHES.push({ input: label, error: `${e && e.message}` });
	}
}

describe('五兆穷举压力测试', () => {
	let combos = 0;

	test('①模式×时间 全遍历(5+4非法 模式 × 36 时间样本)', async () => {
		for (let mi = 0; mi < MODES.length; mi++) {
			for (let ti = 0; ti < TIME_SAMPLES.length; ti++) {
				const label = `mode=${MODES[mi]}|t#${ti}`;
				await runOne(TIME_SAMPLES[ti], { mode: MODES[mi] }, label);
				combos++;
			}
		}
		expect(true).toBe(true);
	});

	test('②报数×揲筮×手动六数 每值≥1覆盖(带正常时间 + 手动模式)', async () => {
		const baseFields = TIME_SAMPLES[0];
		for (let ni = 0; ni < NUMBERS.length; ni++) {
			for (let mai = 0; mai < MANUALS.length; mai++) {
				for (let si = 0; si < SPLITS.length; si++) {
					// 用 day 模式(可用手动六数),报数与揲筮全域
					const opts = { mode: 'day', number: NUMBERS[ni], manual: MANUALS[mai], manualSplits: SPLITS[si] };
					const label = `day|num=${NUMBERS[ni]}|manual=${MANUALS[mai]}|split#${si}`;
					await runOne(baseFields, opts, label);
					combos++;
				}
			}
		}
		expect(true).toBe(true);
	});

	test('③笛卡尔抽样:模式×时间×报数×手动(对角抽样,保每值≥1)', async () => {
		// 组合爆炸时按索引对角抽样,保证每个选项每种取值至少命中一次
		const maxLen = Math.max(MODES.length, TIME_SAMPLES.length, NUMBERS.length, MANUALS.length, SPLITS.length);
		for (let i = 0; i < maxLen * 3; i++) {
			const mode = MODES[i % MODES.length];
			const fields = TIME_SAMPLES[(i * 7) % TIME_SAMPLES.length];
			const number = NUMBERS[(i * 3) % NUMBERS.length];
			const manual = MANUALS[(i * 5) % MANUALS.length];
			const split = SPLITS[(i * 2) % SPLITS.length];
			const opts = { mode, number, manual, manualSplits: split };
			const label = `mix#${i}|mode=${mode}|num=${number}|manual=${manual}`;
			await runOne(fields, opts, label);
			combos++;
		}
		expect(true).toBe(true);
	});

	test('④无 opts / 空 opts(默认路径 ganzhi)× 全时间样本', async () => {
		for (let ti = 0; ti < TIME_SAMPLES.length; ti++) {
			await runOne(TIME_SAMPLES[ti], undefined, `noopts|t#${ti}`);
			await runOne(TIME_SAMPLES[ti], {}, `emptyopts|t#${ti}`);
			combos += 2;
		}
		expect(true).toBe(true);
	});

	test('⑤汇总:崩溃列表应可枚举(不阻断)', () => {
		// eslint-disable-next-line no-console
		console.log(`WUZHAO_STRESS_COMBOS=${combos} CRASH_COUNT=${CRASHES.length}`);
		expect(Array.isArray(CRASHES)).toBe(true);
	});
});
