// 神数正传(六亲 / 心易)与铁板框架「考刻刻位」AI 挂载齿轮各档 ↔ 引擎实际所用值 合同(选项语义证 · contract)。
// 「拨了有反应」只证明值被消费;这里证明选到的就是标签写的那一档:
//   ① 齿轮档位取自挂载设置表本身(TECHNIQUE_SETTINGS_SCHEMA,与页面同一张表);
//   ② 每一档原样走挂载重算(记录 → regenerateChartTechniqueSnapshot → 本地引擎 → 快照),从快照里读回引擎回显的实际所用值;
//      铁板框架段要后端四柱,这里按挂载段同一映射直调框架引擎;
//   ③ 标签 → 应得值 按名书写的规则判定:「（取本人时支）」= 本人时支;「X时（白天·…）/（昼夜·…）」= X 且昼夜相符;
//      「（按时辰取首项）」与不属该时辰那一套的天象 = 该套首项;其余 = 标签本身。另核档位 = 引擎查表的全部键(不多不少)。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => { throw new Error('offline'); }) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn() }));
import fs from 'fs';
import path from 'path';
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';
import { TECHNIQUE_SETTINGS_SCHEMA, mountFieldOptions } from '../techniqueMountSettings';
import { XINYI_SOUNDS_A, XINYI_SOUNDS_B, XINYI_KE, XINYI_GONG, lookupBake, lookupXingqing, lookupXiang } from '../zhengchuanXinyiLocal';
import { buildTiebanFramework, buildTiebanFrameworkSnapshot, tiebanKeOptions } from '../tiebanFrameworkLocal';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const DAY_ZHI = '卯辰巳午未申';
const field = (tech, name)=>{
	const f = TECHNIQUE_SETTINGS_SCHEMA[tech].fields.find((x)=>x.name === name);
	if(!f){ throw new Error(`${tech} 齿轮里没有字段 ${name}`); }
	return f;
};
const REC = { cid: 'zc-contract', name: '合同', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };
const DAY_BIRTH = '1990-05-18 10:00:00';    // 巳时(白天)
const NIGHT_BIRTH = '1990-05-18 22:00:00';  // 亥时(昼夜)
const rowOf = (txt, head)=>{
	const seg = `${txt}`.split('\n\n').find((s)=>s.startsWith(head)) || '';
	const line = seg.split('\n')[3] || '';
	return line.split('|').slice(1, -1).map((c)=>c.trim());
};
const xuanji = (txt)=>{
	const m = /(白天（卯–申）取天四象|昼夜（酉–寅）取地四象)：(\S) 时逢「(\S)」/.exec(`${txt}`);
	return m ? { isDay: m[1].startsWith('白天'), ask: m[2], env: m[3] } : null;
};

describe('心易五项:每档 = 引擎查表所用的那一档', ()=>{
	const xinyi = (extra)=>regenerateChartTechniqueSnapshot({ ...REC, birth: DAY_BIRTH, zcSchool: 'xinyi', ...extra }, 'zhengchuan');
	test('声音 16 档:快照「条文秘数查询」回显即标签,且每档在引擎表里有格', async ()=>{
		const opts = field('zhengchuan', 'zcSound').options;
		expect(opts.map((o)=>o.value)).toEqual([...XINYI_SOUNDS_A, ...XINYI_SOUNDS_B]);
		for(const o of opts){
			const t = await xinyi({ zcSound: o.value });
			expect(rowOf(t, '[条文秘数查询]')[1]).toBe(o.label);
			expect(lookupXiang('父母', o.value, 1)).toBeTruthy();
		}
	});
	test('刻数 8 档 × 八宫 8 档:快照「八刻分命」回显即标签,64 格都有本命卦', async ()=>{
		const ke = field('zhengchuan', 'zcKe').options; const gong = field('zhengchuan', 'zcGong').options;
		expect(ke.map((o)=>o.value)).toEqual(XINYI_KE);
		expect(gong.map((o)=>o.value)).toEqual(XINYI_GONG);
		for(const k of ke){
			const t = await xinyi({ zcKe: k.value, zcGong: '坎' });
			expect(rowOf(t, '[八刻分命]').slice(0, 2)).toEqual([k.label, '坎']);
		}
		for(const g of gong){
			const t = await xinyi({ zcKe: '三刻', zcGong: g.value });
			expect(rowOf(t, '[八刻分命]').slice(0, 2)).toEqual(['三刻', g.label]);
		}
		ke.forEach((k)=>gong.forEach((g)=>expect(lookupBake(k.value, g.value)).toBeTruthy()));
	});
	test('性情项 地支 12 档 × 余数 12 档:快照「性情项查询」回显即标签,144 格都有条文号', async ()=>{
		const zhi = field('zhengchuan', 'zcXqZhi').options; const ys = field('zhengchuan', 'zcXqYushu').options;
		expect(zhi.map((o)=>o.value)).toEqual(ZHI);
		expect(ys.map((o)=>o.value)).toEqual(Array.from({ length: 12 }, (_, i)=>`${i + 1}`));
		for(const z of zhi){
			const t = await xinyi({ zcXqZhi: z.value, zcXqYushu: '5' });
			expect(rowOf(t, '[性情项查询]').slice(0, 2)).toEqual([z.label, '5']);
		}
		for(const y of ys){
			const t = await xinyi({ zcXqZhi: '午', zcXqYushu: y.value });
			expect(rowOf(t, '[性情项查询]').slice(0, 2)).toEqual(['午', y.label]);
		}
		zhi.forEach((z)=>ys.forEach((y)=>expect((lookupXingqing(z.value, y.value) || {}).nums || []).not.toHaveLength(0)));
	});
});

describe('六亲·玄机卦:演算时辰 / 天象 每档 = 引擎实际所用', ()=>{
	const liuqin = (birth, extra)=>regenerateChartTechniqueSnapshot({ ...REC, birth, zcSchool: 'liuqin', ...extra }, 'zhengchuan');
	test('演算时辰 13 档:留空 = 本人时支;「X时（白天 / 昼夜…）」= X 且昼夜分组相符', async ()=>{
		const opts = field('zhengchuan', 'zcAskHourZhi').options;
		expect(opts.map((o)=>o.value)).toEqual(['', ...ZHI]);
		for(const [birth, ownZhi] of [[DAY_BIRTH, '巳'], [NIGHT_BIRTH, '亥']]){
			for(const o of opts){
				const x = xuanji(await liuqin(birth, { zcAskHourZhi: o.value }));
				expect(x).toBeTruthy();
				if(o.value === ''){
					expect(o.label).toBe('（取本人时支）');
					expect(x.ask).toBe(ownZhi);
				}else{
					const m = /^(\S)时（(白天|昼夜)·/.exec(o.label);
					expect(m).toBeTruthy();
					expect(x.ask).toBe(m[1]);
					expect(x.isDay).toBe(m[2] === '白天');
					expect(DAY_ZHI.indexOf(m[1]) >= 0).toBe(m[2] === '白天');
				}
			}
		}
	});
	test('天象 7 档:标白天的只在白天时辰生效、标夜间的只在夜间生效,不生效与留空 = 该时辰那一套的首项', async ()=>{
		const f = field('zhengchuan', 'zcEnv');
		expect(f.options.map((o)=>o.value)).toEqual(['', '晴', '陰', '明', '晦', '雨', '雪']);
		for(const [birth, isDay] of [[DAY_BIRTH, true], [NIGHT_BIRTH, false]]){
			const first = isDay ? '晴' : '明';
			for(const o of f.options){
				const x = xuanji(await liuqin(birth, { zcEnv: o.value }));
				expect(x && x.isDay).toBe(isDay);
				const label = `${o.label}`;
				const applies = o.value !== '' && (/白天/.test(label) ? isDay : (/夜间/.test(label) ? !isDay : true));
				if(o.value === ''){ expect(label).toBe('（按时辰取首项）'); }
				expect(x.env).toBe(applies ? o.value : first);
				// 齿轮回显:给了时辰而天象不属那一套 → 显示空档「按时辰取首项」(与引擎同判据)
				const ask = isDay ? '巳' : '亥';
				const shown = f.displayValue(o.value, { zcAskHourZhi: ask });
				const xa = xuanji(await liuqin(birth, { zcAskHourZhi: ask, zcEnv: o.value }));
				expect(xa.env).toBe(shown || first);
				expect(mountFieldOptions(f, { zcAskHourZhi: ask }).some((p)=>p.value === shown)).toBe(true);
			}
		}
	});
});

describe('铁板框架「考刻刻位」:每档 = 框架实际所考之刻', ()=>{
	const FP = { year: '庚午', month: '辛巳', day: '庚辰', hour: '辛巳' };
	const NUM = ['初', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
	test('十二刻·斗宫 12 档:一—八刻在八刻天干表标「考刻」并入九十六局,九—十二刻单列「考刻」一行;档位与页面同一张表', ()=>{
		const f = field('tieban', 'tiebanKe');
		expect(f.options).toEqual(tiebanKeOptions('dou12'));
		const seen = new Set();
		f.options.forEach((o)=>{
			expect(o.label).toBe(`${NUM[o.value - 1]}刻`);
			const fw = buildTiebanFramework(FP, { school: 'south', keSystem: 'dou12', ke: o.value, gender: '1', birthYear: 1990 });
			expect(fw.ke).toBe(o.value);
			const txt = buildTiebanFrameworkSnapshot(fw);
			if(o.value <= 8){
				expect(txt).toContain(`${o.label}${fw.eightKe[o.value - 1].gan}(考刻)`);
				expect(txt).toContain(`九十六局:巳时${o.label}＝`);
			}else{
				expect(txt).not.toContain('(考刻)');
				expect(txt).toContain(`考刻:${o.label}（`);
			}
			seen.add(txt);
		});
		expect(seen.size).toBe(12);   // 十二档输出两两有别(此前九—十二刻彼此无别)
	});
	test('清八刻下超出八刻的档:齿轮回显初刻、框架同按初刻;挂载段把齿轮刻位原样交给框架', ()=>{
		const f = field('tieban', 'tiebanKe');
		[9, 10, 11, 12].forEach((v)=>{
			expect(f.displayValue(v, { tiebanKeSystem: 'qing8' })).toBe(1);
			expect(buildTiebanFramework(FP, { keSystem: 'qing8', ke: v }).ke).toBe(1);
		});
		expect(mountFieldOptions(f, { tiebanKeSystem: 'qing8' }).map((o)=>o.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		const src = fs.readFileSync(path.join(__dirname, '../../components/kinastro/KinAstroMain.js'), 'utf8');
		expect(src).toContain("keSystem: ov.tiebanKeSystem || 'qing8',");
		expect(src).toContain("ke: ov.tiebanKe !== undefined && ov.tiebanKe !== null && ov.tiebanKe !== '' ? ov.tiebanKe : 1,");
	});
});
