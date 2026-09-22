// [W1·衍化四段] 古典 tab 衍化组件快照镜像的三层锁:
// ① opt-in 正锚:classicalDerived=true 时四段头齐产,内容与单源计算函数一致;
// ② 默认零字节:缺省 options 下四段头零出现(germany/mundane/indiachart/jieqi/relative 等嵌套消费方零波及);
// ③ per-key 负向源扫(MU-2 教训:union 级前瞻守卫放过 per-key 失配):五个嵌套消费方的
//    buildAstroSnapshotContent 调用行禁传 classicalDerived —— 谁改谁红。
// 另:v56 union ∩ DEFAULT_OFF = ∅ 卫生锁(默认关段进 union 会让已自定义用户被强制勾上,口径倒挂)。
import fs from 'fs';
import path from 'path';
import { buildAstroSnapshotContent } from '../astroAiSnapshot';
import { computeEminence, buildThemaMundiSnapshotLines } from '../astroClassicalDerived';

const SIGNS12 = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const DERIVED_HEADS = ['[古典·派生宫转宫]', '[古典·气候带]', '[古典·显赫计分]', '[古典·世界范式盘]'];

function makeChartObj(){
	return {
		chartId: 'natal-fixture',
		params: { lat: '31n38', lon: '118e27', hsys: '0' },
		lots: [],
		chart: {
			isDiurnal: true,
			houses: SIGNS12.map((sg, i)=>({ id: `House${i + 1}`, sign: sg, lon: i * 30 })),
			objects: [
				{ id: 'Sun', house: 'House10', sign: 'Capricorn', signlon: 15, selfDignity: [] },
				{ id: 'Moon', house: 'House4', sign: 'Cancer', signlon: 10, selfDignity: ['ruler'] },
			],
			aspects: { normalAsp: {} },
		},
	};
}

describe('[W1] astro 古典衍化四段 opt-in', ()=>{
	it('🔴 classicalDerived=true:四段头齐产,显赫总分与 computeEminence 单源一致', ()=>{
		const chartObj = makeChartObj();
		const txt = buildAstroSnapshotContent(chartObj, null, { classicalDerived: true });
		DERIVED_HEADS.forEach((h)=>expect(txt).toContain(h));
		// 显赫段总分行与单源计算逐字一致
		const em = computeEminence(chartObj);
		expect(em.ok).toBe(true);
		expect(txt).toContain(`总分 ${em.total} / 10 → ${em.level}`);
		// 气候带:夹具纬度 31.63°N → 归带行在 + 十二座斜升表在
		expect(txt).toMatch(/出生纬度 31\.63°N,归入第 \d 气候带/);
		expect(txt).toContain('| 星座 | 上升时度 | 折恒星时 |');
		// 派生宫:本命基准表 + 宫主列
		expect(txt).toContain('| 宫·话题 | 星座 | 落星 | 宫主 |');
		expect(txt).toContain('| 1·命宫·自我 | 白羊 |');
		// 世界范式盘:恒定教义,行与单源构建逐字一致
		buildThemaMundiSnapshotLines().forEach((line)=>expect(txt).toContain(line));
	});

	it('🔴 缺省(未传 classicalDerived):四段头零出现(嵌套消费方零字节回归证明)', ()=>{
		const txt = buildAstroSnapshotContent(makeChartObj(), null);
		DERIVED_HEADS.forEach((h)=>expect(txt).not.toContain(h));
		const headerless = buildAstroSnapshotContent(makeChartObj(), null, { headerless: true });
		DERIVED_HEADS.forEach((h)=>{
			expect(headerless).not.toContain(h);
			expect(headerless).not.toContain(`· ${h.slice(1, -1)}`);
		});
	});

	it('🔴 per-key 负向源扫:五个嵌套消费方的调用行禁传 classicalDerived', ()=>{
		const consumers = [
			'../../components/germany/AstroMidpoint.js',
			'../../components/mundane/MundaneMain.js',
			'../../components/astro/IndiaChart.js',
			'../../components/jieqi/JieQiChartsMain.js',
			'../../components/astro/AstroRelative.js',
		];
		consumers.forEach((rel)=>{
			const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
			const callLines = src.split('\n').filter((l)=>l.includes('buildAstroSnapshotContent('));
			expect(callLines.length).toBeGreaterThan(0);
			callLines.forEach((l)=>{
				if(l.trim().startsWith('import')){ return; }
				expect(l.includes('classicalDerived')).toBe(false);
			});
		});
	});

	// [#79] 泛化到所有 v-window union 块(v56/v57/…):①∩DEFAULT_OFF=∅(默认关段禁入 union,防口径倒挂);
	// ②union 每段 ∈ 该键 preset(「产出了但没登记 preset 的段会被静默删」——union 进来的段名必须真存在于 preset)。
	it('全部 AI_EXPORT_V*_SECTION_UNION 块:∩ DEFAULT_OFF = ∅ 且 每段 ∈ 该键 preset(v56/v57 必在)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../aiExport.js'), 'utf8');
		const { AI_EXPORT_PRESET_SECTIONS } = require('../aiExport');
		const offSeg = src.slice(src.indexOf('AI_EXPORT_DEFAULT_OFF_SECTIONS = {'), src.indexOf('};', src.indexOf('AI_EXPORT_DEFAULT_OFF_SECTIONS = {')));
		const grab = (seg)=>[...seg.matchAll(/'([^']+)'/g)].map((m)=>m[1]);
		const offSecs = grab(offSeg);
		const blocks = [...src.matchAll(/AI_EXPORT_V(\d+)_SECTION_UNION = \{/g)];
		expect(blocks.map((m)=>m[1])).toEqual(expect.arrayContaining(['56', '57']));
		blocks.forEach((m)=>{
			const seg = src.slice(m.index, src.indexOf('\n};', m.index));
			const unionSecs = new Set(grab(seg));
			offSecs.forEach((s)=>expect(`v${m[1]}:${s}:${unionSecs.has(s) ? 'IN_UNION' : 'ok'}`).toBe(`v${m[1]}:${s}:ok`));
			const keyRe = /^\t([A-Za-z_]+):\s*\[([\s\S]*?)\],?$/gm;
			let km;
			while((km = keyRe.exec(seg))){
				const key = km[1];
				const preset = AI_EXPORT_PRESET_SECTIONS[key];
				expect(`v${m[1]}:${key}:${Array.isArray(preset) ? 'ok' : 'NO_PRESET'}`).toBe(`v${m[1]}:${key}:ok`);
				grab(km[2]).forEach((sec)=>expect(`v${m[1]}:${key}:${preset.includes(sec) ? 'ok' : sec}`).toBe(`v${m[1]}:${key}:ok`));
			}
		});
	});
});
