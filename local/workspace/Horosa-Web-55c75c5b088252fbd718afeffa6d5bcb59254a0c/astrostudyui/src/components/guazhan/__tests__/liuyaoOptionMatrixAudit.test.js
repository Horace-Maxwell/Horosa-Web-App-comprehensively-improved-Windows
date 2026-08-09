// [六爻死开关审计 L1 金标 · 2026-08-08] 左栏「断卦设置(流派)」全键全档引擎差分实证。
// 探索轮(200 固定种子样本)已定谳,本文件固化断言:
//   ① 引擎键逐档 anyDiff>0(改档必改判读);低命中键配定向样本(随机撒不到≠死,playbook 铁律)
//   ② 渲染/起卦键恒 SAME=「不进引擎」结构契约(它们的活性在 Board/CastPad,由 liuyaoBoard 测试+真机看守;
//      未来有人把这类键接进引擎,本契约红→提醒同步矩阵)
//   ③ jinTuiTu 全域空载事实锁:64 卦×63 动爻组合(含多爻齐动)穷举,纳甲动变无戌↔丑本变对 →
//      两口径输出恒等,UI 已按先例置灰+说明。🔴 若本测变红=载荷出现了,须同步解除 GuaZhanMain 的置灰。
//   ④ getLiuyaoOptionsKey(测试 oracle 键)机械完备性:键面=DEFAULT 全键派生,不再手抄(曾漏 yongOverride 前科)。
// 🔴 自毒防线:facade 返回值内嵌 settings(本卦+五关联卦)——比对前必须剥,否则每键假「有差异」。
import { analyzeLiuyao } from '../../gua/liuyaoFacade';
import { Gua64 } from '../../gua/GuaConst';
import { analyzeGua } from '../../gua/LiuYaoEngine';
import { bianGuaOf } from '../../gua/liuyaoDongBian';
import { DEFAULT_LIUYAO_SETTINGS, normalizeLiuyaoSettings, getLiuyaoOptionsKey } from '../../gua/liuyaoSchools';

function lcg(seed){ let s = seed >>> 0; return ()=>{ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const JIEQI = ['立春', '春分', '立夏', '夏至', '立秋', '秋分', '立冬', '冬至', '雨水', '大暑', '白露', '大寒'];
function gz(rnd){ const i = Math.floor(rnd() * 60); return GANS[i % 10] + ZHIS[i % 12]; }
function sampleAt(rnd){
	const guaIdx = Math.floor(rnd() * 64);
	const mvCnt = Math.floor(rnd() * 4);
	const mv = new Set();
	while(mv.size < mvCnt){ mv.add(1 + Math.floor(rnd() * 6)); }
	const day = gz(rnd), month = gz(rnd), year = gz(rnd), hour = gz(rnd);
	return {
		gua: Gua64[guaIdx], moving: [...mv].sort((a, b)=>a - b),
		ctx: {
			dayGan: day[0], dayZhi: day[1], monthGan: month[0], monthZhi: month[1],
			monthNum: (ZHIS.indexOf(month[1]) - 2 + 12) % 12 + 1,
			yearGan: year[0], yearZhi: year[1], hourZhi: hour[1],
			jieqiName: JIEQI[Math.floor(rnd() * JIEQI.length)],
		},
	};
}
const strip = (a)=>JSON.stringify(a, (k, v)=>(k === 'settings' ? undefined : v));
const rnd = lcg(20260808);
const SAMPLES = Array.from({ length: 200 }, ()=>sampleAt(rnd));
const BASE = SAMPLES.map((sm)=>strip(analyzeLiuyao(sm.gua, sm.moving, sm.ctx, DEFAULT_LIUYAO_SETTINGS)));
function diffCount(key, val){
	const s = normalizeLiuyaoSettings({ ...DEFAULT_LIUYAO_SETTINGS, [key]: val });
	let n = 0;
	SAMPLES.forEach((sm, i)=>{ if(strip(analyzeLiuyao(sm.gua, sm.moving, sm.ctx, s)) !== BASE[i]){ n++; } });
	return n;
}

describe('[L1] 引擎键逐档:改档必改判读(200 固定种子样本 anyDiff)', ()=>{
	test('🔴 askType 全 20 非默认档逐档有差异', ()=>{
		['opponent', 'wealth', 'career', 'marriage_m', 'marriage_f', 'illness', 'parents', 'children', 'doctor', 'sibling',
			'thief', 'weather_rain', 'weather_sun', 'lost', 'travel', 'lawsuit', 'home', 'guishen', 'study', 'guochao']
			.forEach((v)=>{ expect(`${v}:${diffCount('askType', v) > 0}`).toBe(`${v}:true`); });
	});
	test('🔴 yongOverride 7 档 / tuChangsheng 2 档 / shishen 2 档 逐档有差异', ()=>{
		['父母', '兄弟', '子孙', '妻财', '官鬼', '世', '应'].forEach((v)=>{ expect(`${v}:${diffCount('yongOverride', v) > 0}`).toBe(`${v}:true`); });
		['fire', 'off'].forEach((v)=>{ expect(diffCount('tuChangsheng', v)).toBeGreaterThan(0); });
		['standard', 'lichunfeng'].forEach((v)=>{ expect(diffCount('shishen', v)).toBeGreaterThan(0); });
	});
	test('🔴 单档引擎键族(含低命中:盲派需动爻/月破需破爻/贵人需庚辛差异日)全有差异', ()=>{
		expect(diffCount('bianyaoScope', 'blind')).toBeGreaterThan(0);
		expect(diffCount('yuepoMode', 'always')).toBeGreaterThan(0);
		expect(diffCount('guirenFa', 'geng_ma_hu')).toBeGreaterThan(0);
		expect(diffCount('fushen', 'all')).toBeGreaterThan(0);
		expect(diffCount('tianshiSchool', 'ancient')).toBeGreaterThan(0);
	});
	test('🔴 bool 开关族(卦身/六神/余气/断诀/应期/古法/月建六神/神煞双组)全有差异', ()=>{
		expect(diffCount('guashen', false)).toBeGreaterThan(0);
		expect(diffCount('sixGods', false)).toBeGreaterThan(0);
		expect(diffCount('yuqi', true)).toBeGreaterThan(0);
		expect(diffCount('doctrine', false)).toBeGreaterThan(0);
		expect(diffCount('yingqi', false)).toBeGreaterThan(0);
		expect(diffCount('gufa', true)).toBeGreaterThan(0);
		expect(diffCount('yueLiushen', true)).toBeGreaterThan(0);
		expect(diffCount('shensha', { on: false })).toBeGreaterThan(0);
		expect(diffCount('shenshaEx', { on: true, set: null })).toBeGreaterThan(0);
	});
	test('🔴 benming 12 支逐支:定向局(官鬼支=命支且日支=其五行之墓)必产生差异', ()=>{
		// 随机 200 样本对「命随鬼入墓」命中面窄(实测 子/巳 0 命中),逐支定向:墓库按 water 默认档口径。
		const MU = { 子: '辰', 亥: '辰', 寅: '未', 卯: '未', 巳: '戌', 午: '戌', 申: '丑', 酉: '丑', 辰: '辰', 戌: '辰', 丑: '辰', 未: '辰' };
		ZHIS.forEach((bm)=>{
			let found = -1;
			for(let gi = 0; gi < 64 && found < 0; gi++){
				const base = analyzeGua(Gua64[gi], { movingPositions: [] });
				if(base.yaos.some((y)=>y.liuqin === '官鬼' && y.zhi === bm)){ found = gi; }
			}
			expect(found).toBeGreaterThanOrEqual(0);
			const ctx = { dayGan: '甲', dayZhi: MU[bm], monthGan: '丙', monthZhi: '寅', monthNum: 1, yearGan: '甲', yearZhi: '子', hourZhi: '子', jieqiName: '立春' };
			const a0 = strip(analyzeLiuyao(Gua64[found], [], ctx, DEFAULT_LIUYAO_SETTINGS));
			const a1 = strip(analyzeLiuyao(Gua64[found], [], ctx, { ...DEFAULT_LIUYAO_SETTINGS, benming: bm }));
			expect(`${bm}:${a1 !== a0}`).toBe(`${bm}:true`);
		});
	});
	test('yearBoundary 由 UI 组 ctx 分流(引擎吃 yearZhi):不同 yearZhi 必改年支系输出', ()=>{
		// UI 双分流已由 liuyaoBoard/静态锁看守;此处锁引擎端 yearZhi 真参与(年支神煞面)。
		const sm = SAMPLES[0];
		const a0 = strip(analyzeLiuyao(sm.gua, sm.moving, { ...sm.ctx, yearGan: '甲', yearZhi: '子' }, DEFAULT_LIUYAO_SETTINGS));
		const a1 = strip(analyzeLiuyao(sm.gua, sm.moving, { ...sm.ctx, yearGan: '乙', yearZhi: '巳' }, DEFAULT_LIUYAO_SETTINGS));
		expect(a1).not.toBe(a0);
	});
});

describe('[L1] 渲染/起卦键「不进引擎」结构契约(恒 SAME;活性由 Board/CastPad 层看守)', ()=>{
	test('14 键逐个:引擎输出恒等', ()=>{
		const RENDER_AXES = {
			changshengUse: 'four', changshengYinYang: 'classic', writeDir: 'topDown', titleAlign: 'right',
			wangShuaiCol: false, showTips: false, bianguaSimplify: true, biangua: 'movingOnly',
			relatedCards: ['bian', 'hu'], coinFace: 'alt', randomAlgo: 'yarrow', randomConfirm: true,
			defaultYaoState: 'shaoyin', yaoHotkeys: true,
		};
		Object.keys(RENDER_AXES).forEach((k)=>{ expect(`${k}:${diffCount(k, RENDER_AXES[k])}`).toBe(`${k}:0`); });
	});
});

describe('[L1] jinTuiTu 结构性空载事实锁', ()=>{
	test('🔴 全域穷举(64 卦×63 动爻组合×动位):纳甲动变无 戌↔丑 本变对 ⇒ 两口径恒等(UI 已置灰)', ()=>{
		let payload = 0;
		Gua64.forEach((g)=>{
			const base = analyzeGua(g, { movingPositions: [] });
			for(let mask = 1; mask < 64; mask++){
				const mv = [];
				for(let p = 1; p <= 6; p++){ if(mask & (1 << (p - 1))){ mv.push(p); } }
				const bian = bianGuaOf(g, mv);
				if(!bian){ continue; }
				const bb = analyzeGua(bian, { movingPositions: [] });
				mv.forEach((p)=>{
					const bz = base.yaos[p - 1].zhi, vz = bb.yaos[p - 1].zhi;
					if((bz === '戌' && vz === '丑') || (bz === '丑' && vz === '戌')){ payload++; }
				});
			}
		});
		expect(payload).toBe(0);   // 🔴 变红=载荷出现了:解除 GuaZhanMain 置灰 + 把 jinTuiTu 移入引擎键断言组
		expect(diffCount('jinTuiTu', 'break')).toBe(0);
	});
});

describe('[L1] getLiuyaoOptionsKey 机械完备性(测试 oracle;曾漏 yongOverride 前科)', ()=>{
	test('🔴 DEFAULT 全键逐键造变体 → key 必变(键面机械派生,不再手抄维护)', ()=>{
		const VARIANT = {
			school: 'zengshan', askType: 'wealth', yongOverride: '父母', yuepoMode: 'always', tuChangsheng: 'fire',
			bianyaoScope: 'blind', guashen: false, fushen: 'all', biangua: 'movingOnly', shensha: { on: false },
			guirenFa: 'geng_ma_hu', sixGods: false, yearBoundary: 'lunar', coinFace: 'alt', randomAlgo: 'yarrow',
			randomConfirm: true, defaultYaoState: 'shaoyin', bianguaSimplify: true, relatedCards: ['bian'],
			wangShuaiCol: false, showTips: false, yaoHotkeys: true, titleAlign: 'right', writeDir: 'topDown',
			shenshaEx: { on: true }, shishen: 'standard', yueLiushen: true, jinTuiTu: 'break',
			changshengYinYang: 'classic', changshengUse: 'four', tianshiSchool: 'ancient', yuqi: true,
			yingqi: false, doctrine: false, gufa: true, benming: '子',
		};
		const missingVariant = Object.keys(DEFAULT_LIUYAO_SETTINGS).filter((k)=>!(k in VARIANT));
		expect(missingVariant).toEqual([]);   // 新增设置键必须同步补变体(此断言逼出)
		const k0 = getLiuyaoOptionsKey(DEFAULT_LIUYAO_SETTINGS);
		Object.keys(VARIANT).forEach((k)=>{
			const s = normalizeLiuyaoSettings({ ...DEFAULT_LIUYAO_SETTINGS, [k]: VARIANT[k] });
			expect(`${k}:${getLiuyaoOptionsKey(s) !== k0}`).toBe(`${k}:true`);
		});
	});
});
