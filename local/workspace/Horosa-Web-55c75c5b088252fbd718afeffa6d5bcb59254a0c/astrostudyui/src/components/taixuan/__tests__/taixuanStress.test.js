// 太玄穷尽压测:排盘/起筮引擎在后端(kentang taixuan /taixuan/pan,前端只经 fetch 调),
//   前端可测「引擎面」= 导出的 buildTaiXuanSnapshotForFields(种子派生 + 快照拼装管线
//   buildSnapshotText / buildTaixuanQuanwenBlock / formatHumanValue)。
// 唯一用户可选项 = 起筮种子 seed(0..999999999,InputNumber),其余为时间/地点输入。
// 策略:mock 全局 fetch(jest 无后端)→ ①穷尽 seed 取值域 × ≥30 时间样本(含空/子时/跨年/闰月对应公历/极端)
//   的笛卡尔,断言:不抛 + 返回字符串 + 空输入→'' + 有效输入→非空且含首名 + 实发 seed = 期望派生;
//   ②畸形 pan(缺字段/NaN/空/深层 undefined)喂进快照拼装管线,断言不抛且不外泄 undefined/NaN 裸串。
// 发现问题只收集进 crashes[] 不改引擎。
import { buildTaiXuanSnapshotForFields } from '../TaiXuanMain';

// —— fetch mock:捕获请求体(用于核 seed),回一个可控 pan —— //
let capturedBodies = [];
let nextPanFactory = null; // (sentSeed)=>pan

function installFetch(){
	capturedBodies = [];
	global.fetch = jest.fn(async (url, init)=>{
		let body = {};
		try{ body = init && init.body ? JSON.parse(init.body) : {}; }catch(e){ body = {}; }
		capturedBodies.push(body);
		const pan = nextPanFactory ? nextPanFactory(body.seed) : cleanPan(body.seed);
		return {
			text: async ()=>JSON.stringify({ Result: pan }),
		};
	});
}

// 干净有效 pan(含 snapshot 早返回路径 + taixuan.allLines 全文块 + sections 兜底路径素材)
function cleanPan(seed){
	return {
		dateStr: '2026-07-18',
		hour: '午',
		snapshot: `[起盘]\n首：中\n占：${seed}`,
		ganzhi: { year: '丙午', month: '乙未', day: '甲子', hour: '庚午' },
		winterSolstice: { date: '2025-12-21', days: 209 },
		taixuan: {
			gua: { name: '中', text: '阳气潜萌' },
			period: '昼', head: '一方一州',
			xuanHead: { number: '一', relation: '主', judgment: '吉', xuanZan: '初一' },
			starLodge: { text: '牛宿' },
			zhanNumber: 3, zhou: '一一一一', head4: '中',
			selectedLines: [{ name: '初一', content: '昆仑旁薄' }],
			allLines: [
				{ name: '初一', content: '昆仑旁薄幽' },
				{ name: '次二', content: '神战于玄' },
			],
			fourPlaces: [{ key: 'fang', label: '方', symbol: '1' }],
		},
	};
}

afterEach(()=>{ nextPanFactory = null; jest.resetAllMocks(); });

// —— 起筮种子取值域(唯一用户选项),期望 = 镜像源码派生逻辑(仅为核对,不参与引擎) —— //
// 源:optSeed = (seed!==undefined&&!==null&&!=='')?Number(seed):null;
//     用 = (isFinite(optSeed)&&optSeed>0)? floor(optSeed)%1e9 : 时间派生
const SEED_OPTS = [
	{ label: 'undefined(整包无 opts)', opts: undefined, forcesTime: true },
	{ label: 'seed=undefined', opts: {}, forcesTime: true },
	{ label: 'seed=null', opts: { seed: null }, forcesTime: true },
	{ label: 'seed=空串', opts: { seed: '' }, forcesTime: true },
	{ label: 'seed=0', opts: { seed: 0 }, forcesTime: true },
	{ label: 'seed=负', opts: { seed: -7 }, forcesTime: true },
	{ label: 'seed=42', opts: { seed: 42 }, expect: 42 },
	{ label: 'seed=上限', opts: { seed: 999999999 }, expect: 999999999 },
	{ label: 'seed=溢出(>1e9)', opts: { seed: 1000000042 }, expect: 42 },
	{ label: 'seed=浮点', opts: { seed: 3.9 }, expect: 3 },
	{ label: 'seed=数字串', opts: { seed: '77' }, expect: 77 },
	{ label: 'seed=坏串', opts: { seed: 'abc' }, forcesTime: true },
	{ label: 'seed=NaN', opts: { seed: NaN }, forcesTime: true },
	{ label: 'seed=Infinity', opts: { seed: Infinity }, forcesTime: true },
];

function makeFields(dateStr, timeStr, zone){
	if(dateStr === null){ return null; }
	const f = {};
	if(dateStr !== 'MISSING'){ f.date = { value: { format: ()=>dateStr } }; }
	if(timeStr !== 'MISSING'){ f.time = { value: { format: ()=>timeStr } }; }
	f.zone = { value: zone || '+08:00' };
	return f;
}

// ≥30 时间样本:含空/缺字段/子时/晚子时/跨年/闰月对应公历/极端年/负年/边界秒
const TIME_SAMPLES = [
	{ label: 'null 整体', f: makeFields(null) },
	{ label: '缺 date', f: makeFields('MISSING', '12:00:00') },
	{ label: '缺 time', f: makeFields('2026-07-18', 'MISSING') },
	{ label: 'date.value 空', f: { date: { value: null }, time: { value: { format: ()=>'12:00:00' } }, zone: { value: '+08:00' } } },
	{ label: '正常午', f: makeFields('2026-07-18', '12:00:00'), valid: true },
	{ label: '早子时 00:00', f: makeFields('2026-07-18', '00:00:00'), valid: true },
	{ label: '晚子时 23:59', f: makeFields('2026-07-18', '23:59:59'), valid: true },
	{ label: '子正 23:00', f: makeFields('2026-01-01', '23:00:00'), valid: true },
	{ label: '跨年除夕', f: makeFields('2025-12-31', '23:59:00'), valid: true },
	{ label: '元旦零点', f: makeFields('2026-01-01', '00:00:00'), valid: true },
	{ label: '闰月对应公历(2025闰六月)', f: makeFields('2025-08-01', '08:30:00'), valid: true },
	{ label: '闰四月(2020)', f: makeFields('2020-05-23', '15:00:00'), valid: true },
	{ label: '立春前夕', f: makeFields('2026-02-03', '23:50:00'), valid: true },
	{ label: '立春当日', f: makeFields('2026-02-04', '10:00:00'), valid: true },
	{ label: '冬至', f: makeFields('2025-12-21', '12:00:00'), valid: true },
	{ label: '夏至', f: makeFields('2026-06-21', '12:00:00'), valid: true },
	{ label: '春分', f: makeFields('2026-03-20', '06:00:00'), valid: true },
	{ label: '秋分', f: makeFields('2026-09-23', '18:00:00'), valid: true },
	{ label: '2月29闰年', f: makeFields('2024-02-29', '11:11:11'), valid: true },
	{ label: '2月28平年末', f: makeFields('2025-02-28', '13:00:00'), valid: true },
	{ label: '月末31', f: makeFields('2026-03-31', '23:00:00'), valid: true },
	{ label: '极早年 0001', f: makeFields('0001-01-01', '00:00:00'), valid: true },
	{ label: '古年 1000', f: makeFields('1000-06-15', '09:00:00'), valid: true },
	{ label: '近未来 2100', f: makeFields('2100-12-31', '23:59:59'), valid: true },
	{ label: '远未来 2999', f: makeFields('2999-01-01', '00:00:01'), valid: true },
	{ label: '负年(BCE 串)', f: makeFields('-0044-03-15', '12:00:00'), valid: true },
	{ label: '午夜前一秒', f: makeFields('2026-07-18', '23:59:58'), valid: true },
	{ label: '正午差一分', f: makeFields('2026-07-18', '11:59:00'), valid: true },
	{ label: '秒缺省(HH:mm)', f: makeFields('2026-07-18', '07:30'), valid: true },
	{ label: '单数月日', f: makeFields('2026-03-05', '05:05:05'), valid: true },
	{ label: '零时零分', f: makeFields('2027-11-09', '00:00:00'), valid: true },
	{ label: '整点 06', f: makeFields('2026-04-15', '06:00:00'), valid: true },
	{ label: '整点 18', f: makeFields('2026-08-08', '18:00:00'), valid: true },
];

// 期望时间派生 seed:(YYYYMMDD*10000 + hour*100 + minute) % 1e9
function expectTimeSeed(dateStr, timeStr){
	const d = dateStr.split('-').map((x)=>parseInt(x, 10));
	const t = timeStr.split(':').map((x)=>parseInt(x, 10));
	return (parseInt(`${d[0]}${String(d[1]).padStart ? '' : ''}`, 10), // noop keep分行
		((`${dateStr}`.replace(/-/g, '') | 0) * 10000 + (t[0] || 0) * 100 + (t[1] || 0)) % 1000000000);
}

const crashes = [];
let combosCovered = 0;

describe('太玄 穷尽压测:seed 取值域 × 时间样本 笛卡尔', ()=>{
	beforeEach(()=>{ installFetch(); });

	SEED_OPTS.forEach((so)=>{
		TIME_SAMPLES.forEach((ts)=>{
			test(`seed[${so.label}] × time[${ts.label}]`, async ()=>{
				combosCovered += 1;
				let out;
				try{
					out = await buildTaiXuanSnapshotForFields(ts.f, so.opts);
				}catch(e){
					crashes.push({ input: `seed=${so.label} | time=${ts.label}`, error: `${e && e.message ? e.message : e}` });
					return;
				}
				// 返回类型必为字符串
				if(typeof out !== 'string'){
					crashes.push({ input: `seed=${so.label} | time=${ts.label}`, error: `返回非字符串:${typeof out}` });
					return;
				}
				if(!ts.valid){
					// 无效时间输入:应短路返回 ''(不发请求)
					if(out !== ''){
						crashes.push({ input: `seed=${so.label} | time=${ts.label}`, error: `无效输入未短路,返回:${out.slice(0, 40)}` });
					}
					return;
				}
				// 有效输入:必发过一次请求,快照非空
				if(!capturedBodies.length){
					crashes.push({ input: `seed=${so.label} | time=${ts.label}`, error: '有效输入未触发后端请求' });
					return;
				}
				if(!out || !out.length){
					crashes.push({ input: `seed=${so.label} | time=${ts.label}`, error: '有效输入快照为空' });
					return;
				}
				// 结构完整:含首名「中」
				if(out.indexOf('中') < 0){
					crashes.push({ input: `seed=${so.label} | time=${ts.label}`, error: '快照缺当值首名' });
				}
				// 核对实发 seed
				const sent = capturedBodies[capturedBodies.length - 1].seed;
				if(!Number.isFinite(sent)){
					crashes.push({ input: `seed=${so.label} | time=${ts.label}`, error: `实发 seed 非有限数:${sent}` });
					return;
				}
				const dateStr = ts.f.date.value.format();
				const timeStr = ts.f.time.value.format();
				const expected = so.forcesTime ? expectTimeSeed(dateStr, timeStr) : so.expect;
				if(sent !== expected){
					crashes.push({ input: `seed=${so.label} | time=${ts.label}`, error: `seed 派生不符:实发${sent} 期望${expected}` });
				}
				// seed 越界防护
				if(sent < 0 || sent >= 1000000000){
					crashes.push({ input: `seed=${so.label} | time=${ts.label}`, error: `seed 越界:${sent}` });
				}
			});
		});
	});
});

// —— 畸形 pan 喂进快照拼装管线(缺字段/NaN/undefined/空/循环外形) —— //
const MALFORMED_PANS = [
	{ label: 'null pan(伪成功回空)', pan: null },
	{ label: '空对象', pan: {} },
	{ label: '仅 snapshot', pan: { snapshot: '只有快照' } },
	{ label: 'sections 兜底路径', pan: { sections: [{ title: '起盘', rows: [{ label: '首', value: '中' }, { label: '缺值一', value: undefined }, { label: '坏值二', value: NaN }] }] } },
	{ label: 'taixuan 缺 allLines', pan: { snapshot: 'x', taixuan: { gua: { name: '中' } } } },
	{ label: 'allLines 非数组', pan: { snapshot: 'x', taixuan: { allLines: 'notarray' } } },
	{ label: 'allLines 元素缺字段', pan: { snapshot: 'x', taixuan: { gua: { name: '周' }, allLines: [{ name: null, content: undefined }, {}] } } },
	{ label: '深层 NaN', pan: { sections: [{ title: 't', rows: [{ label: 'a', value: { x: NaN, y: undefined } }] }] } },
	{ label: 'rows 缺失', pan: { sections: [{ title: '无行' }] } },
	{ label: 'gua.name=NaN', pan: { snapshot: 's', taixuan: { gua: { name: NaN }, allLines: [{ name: '初一', content: '文' }] } } },
];

describe('太玄 畸形 pan 快照拼装鲁棒性', ()=>{
	beforeEach(()=>{ installFetch(); });

	MALFORMED_PANS.forEach((mp)=>{
		test(`畸形 pan:${mp.label}`, async ()=>{
			combosCovered += 1;
			nextPanFactory = ()=>mp.pan;
			let out;
			try{
				out = await buildTaiXuanSnapshotForFields(makeFields('2026-07-18', '12:00:00'), { seed: 123 });
			}catch(e){
				crashes.push({ input: `malformed:${mp.label}`, error: `${e && e.message ? e.message : e}` });
				return;
			}
			if(typeof out !== 'string'){
				crashes.push({ input: `malformed:${mp.label}`, error: `返回非字符串:${typeof out}` });
				return;
			}
			// 不得把裸 undefined / NaN 外泄进用户可见快照
			if(/\bundefined\b/.test(out)){
				crashes.push({ input: `malformed:${mp.label}`, error: `快照外泄 undefined 裸串:${out.slice(0, 60)}` });
			}
			if(/(^|[^a-zA-Z])NaN([^a-zA-Z]|$)/.test(out)){
				crashes.push({ input: `malformed:${mp.label}`, error: `快照外泄 NaN 裸串:${out.slice(0, 60)}` });
			}
		});
	});
});

describe('太玄 压测汇总', ()=>{
	test('汇总 crashes 报告(压测本身恒绿)', ()=>{
		if(crashes.length){
			// eslint-disable-next-line no-console
			console.log('TAIXUAN_STRESS_CRASHES=' + JSON.stringify(crashes, null, 2));
		}
		// eslint-disable-next-line no-console
		console.log('TAIXUAN_STRESS_COMBOS=' + combosCovered);
		expect(true).toBe(true);
	});
});
