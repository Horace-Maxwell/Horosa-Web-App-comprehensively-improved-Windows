/**
 * 神易数 穷举压力测试(纯新增,不改引擎/组件/常量)。
 *
 * 说明:该技法排盘/起局引擎在服务端(postShenYiShu 走 fetch)。前端可导出的
 * 唯一起盘入口是 buildShenYiShuSnapshotForFields(fields, opts) —— 它负责:
 *   1) 把用户时间字段(date/time/zone)规整为排盘输入(parseFieldsDateTime)
 *   2) 把四个用户可选项(入式小时来源/手动小时/季令来源/手动季令)归一到合法域
 *   3) 发往后端排盘并把返回盘面构造成快照文本(buildSnapshotText)
 *
 * 本测试用 mock fetch 回显后端收到的归一化 payload,从而对该入口做穷举:
 *   选项域(hourSource × manualHour × seasonSource × manualSeason 的笛卡尔积,含大量非法/边界取值)
 *   × 一组时间/输入样本(≥30,含 空值/极端年/闰月 2-29/子时 23:xx 与 00:xx/跨年)。
 * 每个组合断言:不抛异常 + 返回字符串 + 发往引擎的四个选项都落在合法域且无 NaN/undefined +
 *              快照文本不混入字面 'NaN'/'undefined'。
 * 发现问题只收集进 crashes[] 记录,测试本身保持绿。
 */

import moment from 'moment';
import { buildShenYiShuSnapshotForFields } from '../ShenYiShuMain';

// ---- 记录桶(发现异常只报告不改引擎)----
const crashes = [];
function record(input, error){
	crashes.push({ input, error: `${error && error.message ? error.message : error}` });
}

// ---- mock 后端 fetch:回显归一化 payload,并把它暴露给断言 ----
let lastBody = null;
const origFetch = global.fetch;
beforeAll(()=>{
	global.fetch = jest.fn((url, init)=>{
		let body = {};
		try{ body = init && init.body ? JSON.parse(init.body) : {}; }catch(e){ body = {}; }
		lastBody = body;
		const pan = {
			dateStr: body.date,
			timeStr: body.time,
			hour: body.manualHour,
			season: body.manualSeason,
			// 无 snapshot 字段 → 逼 buildSnapshotText 走 sections 拼装分支
			sections: [
				{ title: '概览', rows: [
					{ label: '入式小时', value: body.hour },
					{ label: '季令', value: body.manualSeason },
				] },
			],
			shenyishu: { total: 0, roles: [], pillars: [] },
		};
		return Promise.resolve({
			text: ()=>Promise.resolve(JSON.stringify({ ResultCode: 0, Result: pan })),
		});
	});
});
afterAll(()=>{ global.fetch = origFetch; });
beforeEach(()=>{ lastBody = null; });

// ---- 构造 fields ----
function makeFields(dateStr, timeStr, zone){
	const d = dateStr ? moment(dateStr, 'YYYY-MM-DD', true) : null;
	const t = timeStr ? moment(`2000-01-01 ${timeStr}`, 'YYYY-MM-DD HH:mm:ss', true) : null;
	return {
		date: { value: d && d.isValid() ? d : null },
		time: { value: t && t.isValid() ? t : null },
		zone: { value: zone !== undefined ? zone : '+08:00' },
	};
}

// ---- 时间/输入样本(≥30,含边界)----
const TIME_SAMPLES = [
	['2024-06-15', '12:30:00', '+08:00'],     // 常规
	['2024-01-01', '00:00:00', '+08:00'],     // 跨年 元旦 子初
	['2023-12-31', '23:59:59', '+08:00'],     // 跨年 除夕 子时前
	['2024-02-29', '06:00:00', '+08:00'],     // 闰年 2-29
	['2000-02-29', '18:00:00', '+08:00'],     // 世纪闰年
	['1900-03-01', '03:00:00', '+08:00'],     // 极早年份
	['2100-12-31', '21:00:00', '+08:00'],     // 极晚年份
	['2024-06-15', '23:00:00', '+08:00'],     // 晚子时
	['2024-06-15', '23:30:00', '+08:00'],     // 晚子时
	['2024-06-15', '00:30:00', '+08:00'],     // 早子时
	['2024-06-15', '01:00:00', '+08:00'],     // 丑
	['2024-06-21', '12:00:00', '+08:00'],     // 夏至
	['2024-12-21', '12:00:00', '+08:00'],     // 冬至
	['2024-03-20', '12:00:00', '+08:00'],     // 春分
	['2024-09-22', '12:00:00', '+08:00'],     // 秋分
	['2024-02-04', '05:00:00', '+08:00'],     // 立春附近
	['2024-05-05', '00:00:00', '+00:00'],     // UTC 时区
	['2024-05-05', '12:00:00', '-05:00'],     // 西五区
	['2024-05-05', '12:00:00', '+14:00'],     // 极东时区
	['2024-05-05', '12:00:00', '-12:00'],     // 极西时区
	['2024-05-05', '12:00:00', ''],           // 空时区
	['2024-05-05', '12:00:00', undefined],    // 缺时区
	['2024-07-18', '13:14:15', '+08:00'],     // 带秒
	['1970-01-01', '00:00:00', '+08:00'],     // Unix 纪元
	['2038-01-19', '03:14:07', '+08:00'],     // 2038 边界
	['2024-08-08', '08:08:08', '+08:00'],     // 常规
	['2024-11-11', '11:11:11', '+08:00'],     // 常规
	['2024-06-15', '17:45:00', '+08:00'],     // 酉
	['2024-06-15', '22:00:00', '+08:00'],     // 亥
	['2024-04-30', '19:20:00', '+08:00'],     // 戌
	// ---- 病态输入:应被 parseFieldsDateTime 挡下并返回空串,不得抛 ----
	['', '12:00:00', '+08:00'],               // 空日期
	['2024-06-15', '', '+08:00'],             // 空时间
	['bad-date', '12:00:00', '+08:00'],       // 坏日期串
	['2024-13-40', '99:99:99', '+08:00'],     // 越界日期时间(moment strict 判无效)
];

// ---- 选项域(含大量非法/边界取值)----
const HOUR_SOURCE = ['auto', 'manual', undefined, 'xxx', null, ''];
const MANUAL_HOUR = [0, 5, 12, 23, -1, 24, null, NaN, '7', 99];
const SEASON_SOURCE = ['auto', 'manual', undefined, 'zzz'];
const MANUAL_SEASON = ['春', '夏', '秋', '冬', 'invalid', undefined, null, ''];

const VALID_HOUR_SOURCE = new Set(['auto', 'manual']);
const VALID_SEASON_SOURCE = new Set(['auto', 'manual']);
const VALID_SEASON = new Set(['春', '夏', '秋', '冬']);

// 病态样本索引(parseFieldsDateTime 返回 null → 入口早退返回 '',不发 fetch)
const BAD_TIME_START = 30;

function assertClean(str){
	expect(typeof str).toBe('string');
	// 快照文本不得混入字面 NaN/undefined
	if(typeof str === 'string' && str.length){
		expect(str.indexOf('NaN')).toBe(-1);
		expect(str.indexOf('undefined')).toBe(-1);
	}
}

function assertNormalizedPayload(body){
	// 无论传入何种脏选项,发往引擎的四个选项都必须落在合法域、无 NaN
	expect(VALID_HOUR_SOURCE.has(body.hourSource)).toBe(true);
	expect(VALID_SEASON_SOURCE.has(body.seasonSource)).toBe(true);
	expect(VALID_SEASON.has(body.manualSeason)).toBe(true);
	expect(typeof body.manualHour).toBe('number');
	expect(Number.isNaN(body.manualHour)).toBe(false);
}

describe('神易数 穷举压力测试(选项域 × 时间样本)', ()=>{
	test('全选项笛卡尔积 × 轮转时间样本:入口不崩、选项归一化无 NaN、快照文本干净', async ()=>{
		let combo = 0;
		const usedTimeIdx = new Set();
		for(const hs of HOUR_SOURCE){
			for(const mh of MANUAL_HOUR){
				for(const ss of SEASON_SOURCE){
					for(const msn of MANUAL_SEASON){
						// 轮转覆盖每个「有效」时间样本(0..BAD_TIME_START-1)
						const tIdx = combo % BAD_TIME_START;
						usedTimeIdx.add(tIdx);
						const [ds, ts, zone] = TIME_SAMPLES[tIdx];
						const fields = makeFields(ds, ts, zone);
						const opts = { hourSource: hs, manualHour: mh, seasonSource: ss, manualSeason: msn };
						const label = `opts=${JSON.stringify(opts)} @${ds} ${ts} ${zone}`;
						try{
							const out = await buildShenYiShuSnapshotForFields(fields, opts);
							assertClean(out);
							// 有效时间样本一定发出了 fetch → 校验归一化 payload
							if(lastBody){
								assertNormalizedPayload(lastBody);
							}
						}catch(e){
							record(label, e);
						}
						combo += 1;
					}
				}
			}
		}
		// 每个有效时间样本至少被覆盖一次
		expect(usedTimeIdx.size).toBe(BAD_TIME_START);
		expect(crashes).toEqual([]);
	});

	test('全时间样本(含病态输入) × 默认选项:病态输入早退返回空串、不抛', async ()=>{
		for(let i = 0; i < TIME_SAMPLES.length; i += 1){
			const [ds, ts, zone] = TIME_SAMPLES[i];
			const fields = makeFields(ds, ts, zone);
			const label = `@${ds} ${ts} ${zone} (idx ${i})`;
			try{
				const out = await buildShenYiShuSnapshotForFields(fields, {});
				assertClean(out);
				if(i >= BAD_TIME_START){
					// 病态输入:parseFieldsDateTime 返回 null → 空串,且未发 fetch
					expect(out).toBe('');
				}
			}catch(e){
				record(label, e);
			}
		}
		expect(crashes).toEqual([]);
	});

	test('全空/缺失 fields 结构:不抛、返回空串', async ()=>{
		const weird = [
			null,
			undefined,
			{},
			{ date: null, time: null, zone: null },
			{ date: {}, time: {}, zone: {} },
			{ date: { value: null }, time: { value: null }, zone: { value: null } },
			{ date: { value: moment('2024-06-15') } }, // 缺 time
			{ time: { value: moment('2024-06-15 12:00:00') } }, // 缺 date
		];
		for(let i = 0; i < weird.length; i += 1){
			try{
				const out = await buildShenYiShuSnapshotForFields(weird[i], {});
				expect(typeof out).toBe('string');
				expect(out).toBe('');
			}catch(e){
				record(`weird-fields[${i}]`, e);
			}
		}
		expect(crashes).toEqual([]);
	});

	test('缺失/畸形 opts:入口容错不抛', async ()=>{
		const fields = makeFields('2024-06-15', '12:30:00', '+08:00');
		const weirdOpts = [undefined, null, {}, { hourSource: 123 }, { manualHour: {} }, { manualSeason: 999 }, { seasonSource: [] }];
		for(let i = 0; i < weirdOpts.length; i += 1){
			try{
				const out = await buildShenYiShuSnapshotForFields(fields, weirdOpts[i]);
				assertClean(out);
				if(lastBody){ assertNormalizedPayload(lastBody); }
			}catch(e){
				record(`weird-opts[${i}]`, e);
			}
		}
		expect(crashes).toEqual([]);
	});

	test('后端拒绝(网络失败)路径:入口吞错返回空串、不抛', async ()=>{
		const saved = global.fetch;
		global.fetch = jest.fn(()=>Promise.reject(new Error('network down')));
		try{
			const fields = makeFields('2024-06-15', '12:30:00', '+08:00');
			const out = await buildShenYiShuSnapshotForFields(fields, { hourSource: 'manual', manualHour: 9, seasonSource: 'manual', manualSeason: '秋' });
			expect(out).toBe('');
		}catch(e){
			record('backend-reject', e);
		}finally{
			global.fetch = saved;
		}
		expect(crashes).toEqual([]);
	});

	afterAll(()=>{
		if(crashes.length){
			// eslint-disable-next-line no-console
			console.warn('神易数压测发现问题:', JSON.stringify(crashes, null, 2));
		}
	});
});
