/**
 * [#80] 推运快照双支金标。
 *
 * 病:`/astroextra/progressions` 一直只有**恒星黄道**那支(vedicprog)能挂给 AI;页面上主流的
 * **回归黄道**二次/三次/小推运从来没有技法键 —— 用户问「西占的行运推运在哪」时,AI 手上确实
 * 一个字都没有(#80 之六)。修=同一 builder 按 variant 出两支。
 *
 * 判据两条腿:
 *  ① 回归支**不下发 zodiacal**(与页面 AstroProgressions.js 请求体同形),恒星支仍下发 1;
 *  ② 抽取重构不得改动恒星支输出 —— 两支产文除 variant 三处文案外**逐行相同**(结构等价判据)。
 */
import { buildVedicProgSnapshotText, buildTropicalProgSnapshotText, buildProgSnapshotText, PROG_SNAPSHOT_VARIANTS } from '../../components/astro/astroProgSnapshot';
import request from '../../utils/request';

jest.mock('../../utils/request', () => ({ __esModule: true, default: jest.fn() }));

const RESULT = { methods: [
	{ method: 'secondary', progressedDate: { datetime: '1990-03-05 12:00' },
		positions: [{ id: 'Sun', lon: 12.5, sign: 'Aries', signlon: 12.5, lonspeed: 0.98 },
			{ id: 'Moon', lon: 200.25, sign: 'Libra', signlon: 20.25, lonspeed: 13.1 }],
		aspectsToNatal: [{ a: 'Sun', b: 'Moon', aspect: 90, orb: 0.42 }] },
	{ method: 'tertiary', progressedDate: { datetime: '1991-01-01 12:00' },
		positions: [{ id: 'Sun', lon: 30, sign: 'Taurus', signlon: 0, lonspeed: 1 }],
		aspectsToNatal: [] },
] };
const CHART = { params: { birth: '1990-01-01 12:00', zone: '+08:00', lat: '39n54', lon: '116e23', hsys: 0, zodiacal: 0 },
	chart: { objects: [], houses: [] } };

const bodyOf = ()=>JSON.parse(request.mock.calls[request.mock.calls.length - 1][1].body);

describe('推运快照 · 两支同源', ()=>{
	beforeEach(()=>{
		request.mockReset();
		request.mockImplementation(()=>Promise.resolve({ result: RESULT, data: RESULT, Result: RESULT }));
	});

	it('🔴 回归支透传盘自身黄道(与页面 AstroProgressions 同形);恒星支强制 1', async ()=>{
		// 页面 load() 发的是 {...chartParams(value), targetDate, targetTime, minorVariant, orb}
		// —— zodiacal 来自盘参数、不另行覆盖。回归支必须与之逐字同形,否则挂载与页面分叉。
		await buildTropicalProgSnapshotText(CHART, {});
		expect(bodyOf().zodiacal).toBe(0);                       // 盘是回归盘 → 透传 0
		await buildVedicProgSnapshotText(CHART, {});
		expect(bodyOf().zodiacal).toBe(1);                       // 恒星支强制 1

		const sidereal = { ...CHART, params: { ...CHART.params, zodiacal: 1 } };
		await buildTropicalProgSnapshotText(sidereal, {});
		expect(bodyOf().zodiacal).toBe(1);                       // 🔴 透传而非写死 0
	});

	it('两支请求体除 zodiacal 外逐键相同(同一后端同一口径)', async ()=>{
		await buildTropicalProgSnapshotText(CHART, { targetDate: '2020-06-01', targetTime: '09:30:00' });
		const a = bodyOf();
		await buildVedicProgSnapshotText(CHART, { targetDate: '2020-06-01', targetTime: '09:30:00' });
		const b = bodyOf();
		expect(a.zodiacal).toBe(0);
		expect(b.zodiacal).toBe(1);
		delete a.zodiacal; delete b.zodiacal;
		expect(a).toEqual(b);
		expect(a.targetDate).toBe('2020-06-01');
		expect(a.targetTime).toBe('09:30:00');
		expect(a.minorVariant).toBe('synodic');   // [Q-180] 缺省 = 标准朔望月(与页面/挂载/后端同)
		expect(a.orb).toBe(1.5);
	});

	it('🔴 抽取重构零行为漂移:两支产文除 variant 三处文案外逐行相同', async ()=>{
		const tropical = await buildTropicalProgSnapshotText(CHART, { targetDate: '2020-06-01' });
		const vedic = await buildVedicProgSnapshotText(CHART, { targetDate: '2020-06-01' });
		expect(tropical).toBeTruthy();
		expect(vedic).toBeTruthy();
		const V = PROG_SNAPSHOT_VARIANTS;
		// 只替**整行**级的 variant 字面(posCol 在回归支是「推运位置」,它是段标题
		// 「[时段盘配置 二次推运位置]」的子串 —— 全局替换会把结构行也改花,判据就假了)。
		const norm = (txt, key)=>txt
			.split('\n')
			.map((l)=>{
				const v = V[key];
				if(l === `[${v.section}]`){ return '[SECTION]'; }
				if(l === v.intro){ return 'INTRO'; }
				if(l === `| 点 | ${v.posCol} |`){ return '| 点 | POS |'; }
				if(l === `| 点 | ${v.posCol} | 速度 |`){ return '| 点 | POS | 速度 |'; }
				return l;
			})
			// [方法说明] 两支各自成文,不参与结构比对(内容差异是有意的)。
			.filter((l)=>!l.startsWith('二次推运:') && !l.startsWith('恒星推运：') && !l.startsWith('读法：'));
		expect(norm(tropical, 'prog')).toEqual(norm(vedic, 'vedicprog'));
	});

	it('段头与列名按 variant 出(回归支不得自称恒星)', async ()=>{
		const tropical = await buildTropicalProgSnapshotText(CHART, {});
		expect(tropical).toContain('[二次推运（回归黄道）]');
		expect(tropical).toContain('| 点 | 推运位置 |');
		expect(tropical).not.toContain('恒星');

		const vedic = await buildVedicProgSnapshotText(CHART, {});
		expect(vedic).toContain('[恒星推运（Vedic Sidereal）]');
		expect(vedic).toContain('| 点 | 恒星推运位置 |');
	});

	it('无盘/未知 variant/后端空 → 空串且不抛(挂载面显示「缺失」而非空段头)', async ()=>{
		expect(await buildTropicalProgSnapshotText(null, {})).toBe('');
		expect(await buildProgSnapshotText(CHART, {}, 'no-such-variant')).toBe('');
		request.mockImplementation(()=>Promise.resolve({ result: { methods: [] } }));
		expect(await buildTropicalProgSnapshotText(CHART, {})).toBe('');
		request.mockImplementation(()=>Promise.reject(new Error('boom')));
		await expect(buildTropicalProgSnapshotText(CHART, {})).resolves.toBe('');
	});
});
