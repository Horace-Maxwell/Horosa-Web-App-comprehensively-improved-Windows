// 紫微「四化流派」与「星曜亮度」两条切换轴的**接线**金标。
//
// 既有金标已覆盖数据层(四化表各派值、STAR_LIGHT_QUANSHU 每格都异于基表、亮度不触发本地引擎),
// 本组补三条它们看不见的缝:
//   ① 渲染层 `ZWCommHouse.effStarLight` 与共享 `starLightOf` 是**同一口径的两处实现**
//      —— 既有亮度金标测的是 starLightOf,渲染器自己读 STAR_LIGHT_QUANSHU,漂了没人知道。
//   ② UI 四张四化表两两必须真的不同(任两张相同 = 该选项选了等于没选)。
//   ③ 每个写 `ZWSchool.school` 的地方都必须配齐 refreshActiveSiHua + resetHuaMap
//      —— getSiHua 是 size===0 懒缓存,漏一处 reset 就「显示换了、算的还是旧流派」。
import fs from 'fs';
import path from 'path';
import ZWCommHouse from '../ZWCommHouse';
import { ZWEngineOptions, BRIGHTNESS_SOURCE_OPTIONS } from '../ziweiOptions';
import { STAR_LIGHT, STAR_LIGHT_QUANSHU, starLightOf } from '../data/ziweiTables';
import { SiHuaTables, getActiveSiHuaGan, ZWSchool, refreshActiveSiHua } from '../../../constants/ZWConst';
import * as ZiWeiHelper from '../ZiWeiHelper';

const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
const GAN = '甲乙丙丁戊己庚辛壬癸'.split('');
// 渲染器的 effStarLight 只用到 this.houseObj.ganzi,可用最小 this 裸调原型方法。
const eff = (name, zhi, starlight)=>ZWCommHouse.prototype.effStarLight.call(
	{ houseObj: { ganzi: `甲${zhi}` } }, { name, starlight });

describe('[亮度] 渲染层 effStarLight 与共享 starLightOf 必须逐格等价(双源真值护栏)', ()=>{
	const STARS = [...new Set([...Object.keys(STAR_LIGHT), ...Object.keys(STAR_LIGHT_QUANSHU)])];
	afterEach(()=>{ ZWEngineOptions.brightnessSource = 'zi_jian'; });

	test('🔴 全星 × 12 宫支 × 全部亮度源:渲染器取值 === starLightOf 取值(新源自动进护栏)', ()=>{
		expect(STARS.length).toBeGreaterThan(10);
		const bad = [];
		BRIGHTNESS_SOURCE_OPTIONS.map((o)=>o.value).forEach((src)=>{
			ZWEngineOptions.brightnessSource = src;
			STARS.forEach((s)=>ZHI.forEach((z)=>{
				// 盘数据里的 starlight 恒是基础值(ZiweiCalc 钉死 zi_jian),照此喂给渲染器
				const stored = starLightOf(s, z, 'zi_jian');
				const got = eff(s, z, stored);
				const want = starLightOf(s, z, src);
				if(got !== want){ bad.push(`${src}/${s}/${z}: 渲染=${got} 共享=${want}`); }
			}));
		});
		expect(bad).toEqual([]);
	});

	test('《全书》delta 格在渲染器上真的生效(不是恒等空转)', ()=>{
		const hits = [];
		Object.keys(STAR_LIGHT_QUANSHU).forEach((s)=>Object.keys(STAR_LIGHT_QUANSHU[s]).forEach((z)=>{
			ZWEngineOptions.brightnessSource = 'quanshu';
			const q = eff(s, z, starLightOf(s, z, 'zi_jian'));
			ZWEngineOptions.brightnessSource = 'zi_jian';
			const b = eff(s, z, starLightOf(s, z, 'zi_jian'));
			if(q !== b){ hits.push(`${s}${z}:${b}→${q}`); }
		}));
		// 既有金标已断言「每个 QUANSHU 格都异于基表」,故 delta 格数 = 渲染差异格数
		const cells = Object.keys(STAR_LIGHT_QUANSHU)
			.reduce((n, s)=>n + Object.keys(STAR_LIGHT_QUANSHU[s]).length, 0);
		expect(hits.length).toBe(cells);
	});

	test('副星名前缀「副」在渲染层剥除后再查表(渲染器独有语义)', ()=>{
		const s = Object.keys(STAR_LIGHT_QUANSHU)[0];
		const z = Object.keys(STAR_LIGHT_QUANSHU[s])[0];
		ZWEngineOptions.brightnessSource = 'quanshu';
		expect(eff(`副${s}`, z, starLightOf(s, z, 'zi_jian'))).toBe(starLightOf(s, z, 'quanshu'));
	});
});

describe('[四化] UI 四张流派表两两必须真的不同(防死选项)', ()=>{
	const KEYS = ['beipai', 'zhongzhou', 'quanshu', 'beixiang'];
	test('🔴 任两张表不得完全相同', ()=>{
		const same = [];
		for(let i = 0; i < KEYS.length; i++){
			for(let j = i + 1; j < KEYS.length; j++){
				const a = SiHuaTables[KEYS[i]], b = SiHuaTables[KEYS[j]];
				if(GAN.every((g)=>JSON.stringify(a[g]) === JSON.stringify(b[g]))){ same.push(`${KEYS[i]}≡${KEYS[j]}`); }
			}
		}
		expect(same).toEqual([]);
	});
	test('分歧只落在戊/庚/壬三干(其余七干各派一致)', ()=>{
		const drift = GAN.filter((g)=>!KEYS.every((k)=>
			JSON.stringify(SiHuaTables[k][g]) === JSON.stringify(SiHuaTables.beipai[g])));
		expect(drift.sort()).toEqual(['壬', '庚', '戊'].sort());
	});
	test('天相化忌是北派独有(其余三派的庚化忌都不是天相)', ()=>{
		expect(SiHuaTables.beixiang['庚'][3]).toBe('天相');
		['beipai', 'zhongzhou', 'quanshu'].forEach((k)=>expect(SiHuaTables[k]['庚'][3]).not.toBe('天相'));
	});
	test('getActiveSiHuaGan 随单例切换返回对应表;未知流派回落默认', ()=>{
		const prev = ZWSchool.school;
		try{
			KEYS.forEach((k)=>{ ZWSchool.school = k; refreshActiveSiHua(); expect(getActiveSiHuaGan()).toEqual(SiHuaTables[k]); });
			ZWSchool.school = '不存在的流派'; refreshActiveSiHua();
			expect(getActiveSiHuaGan()).toEqual(SiHuaTables.beipai);
		}finally{ ZWSchool.school = prev; refreshActiveSiHua(); ZiWeiHelper.resetHuaMap(); }
	});
});

describe('[四化] 懒缓存不变量:切流派必须三件套齐全', ()=>{
	test('🔴 resetHuaMap 是承重的:只切单例不清缓存,getSiHua 仍返回旧流派(负锚)', ()=>{
		const prev = ZWSchool.school;
		try{
			ZWSchool.school = 'beipai'; refreshActiveSiHua(); ZiWeiHelper.resetHuaMap();
			expect(ZiWeiHelper.getSiHua('右弼', '戊')).toBe('科');      // 通用:戊→右弼化科
			ZWSchool.school = 'zhongzhou'; refreshActiveSiHua();        // 故意漏 resetHuaMap
			expect(ZiWeiHelper.getSiHua('右弼', '戊')).toBe('科');      // 仍是旧表 ⇒ 缓存确实承重
			ZiWeiHelper.resetHuaMap();
			expect(ZiWeiHelper.getSiHua('太阳', '戊')).toBe('科');      // 中州:戊→太阳化科
			expect(ZiWeiHelper.getSiHua('右弼', '戊')).toBe(null);
		}finally{ ZWSchool.school = prev; refreshActiveSiHua(); ZiWeiHelper.resetHuaMap(); }
	});

	test('🔴 每个写 ZWSchool.school 的生产点都配齐 refreshActiveSiHua + resetHuaMap', ()=>{
		const FILES = ['ZiWeiInput.js', 'ZiWeiMain.js'];
		const miss = [];
		FILES.forEach((f)=>{
			const src = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
			const lines = src.split('\n');
			lines.forEach((ln, i)=>{
				if(!/ZWSchool\.school\s*=/.test(ln) || /^\s*\/\//.test(ln)){ return; }
				const win = lines.slice(i, i + 8).join('\n');            // 赋值后 8 行内必须两件都在
				if(!/refreshActiveSiHua\(\)/.test(win)){ miss.push(`${f}:${i + 1} 缺 refreshActiveSiHua`); }
				if(!/resetHuaMap\(\)/.test(win)){ miss.push(`${f}:${i + 1} 缺 resetHuaMap`); }
			});
		});
		expect(miss).toEqual([]);
	});

	test('🔴 交互侧每次 applySihuaSchool 之后都要重绘(否则表换了盘没换)', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'ZiWeiInput.js'), 'utf8');
		const lines = src.split('\n');
		const miss = [];
		lines.forEach((ln, i)=>{
			// 只看调用点,跳过定义行与注释
			if(!/this\.applySihuaSchool\(/.test(ln)){ return; }
			// 🔴 窗口两次修正,都是被负锚逼出来的:
			//   ① 固定 6 行会假报 —— onPresetChange 里两者隔着整组 preset 赋值(实测 8 行);
			//   ② 只扫到「方法末尾」则 onSihuaSchoolChange 的 custom 早退支被同方法后半段的
			//      redrawChart 遮住(抽掉它也抓不到)。故窗口 = 到 `return;` 或方法末尾,先到者为准。
			let end = i + 1;
			while(end < lines.length && !/^\t\}\s*$/.test(lines[end]) && !/^\s*return;\s*$/.test(lines[end])){ end++; }
			if(!lines.slice(i, end + 1).join('\n').includes('this.redrawChart()')){ miss.push(`ZiWeiInput.js:${i + 1}`); }
		});
		expect(miss).toEqual([]);
		expect(lines.filter((l)=>/this\.applySihuaSchool\(/.test(l)).length).toBe(5);   // 少一个=有路径绕过了统一入口
	});

	test('AI 挂载临时切流派必须在 finally 里还原(异常路径也不得污染全局)', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
		const fin = src.slice(src.indexOf('}finally{'));
		expect(fin).toContain('ZWSchool.school = prevSchool');
		expect(fin).toContain('refreshActiveSiHua()');
		expect(fin).toContain('resetHuaMap()');
	});
});

// ══ [B1] 格局判据恒按基表(前后端一致)双护栏 ═════════════════════════════
// 决策定案:格局的 bright 判据(ziweige levels)按基表五档词汇书写;Java ZiWeiPattern 只知基表。
// 前端若随亮度源,则「默认引擎盘走 Java 格局(基表语义)、本地盘走源语义」同开关两行为 —— 且七档
// 词汇(得/利/不)不在 levels 里会静默漏判。故格局恒基表;切亮度只改标注,永不改格局。
describe('[B1] 格局判据恒基表(亮度源不得渗入)', ()=>{
	const patSrc = fs.readFileSync(path.resolve(__dirname, '..', 'ziweiPatterns.js'), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
	test('🔴 源扫描:ziweiPatterns 只 import STAR_LIGHT,不得引 starLightOf/ZWEngineOptions', ()=>{
		expect(patSrc).toContain("import { STAR_LIGHT } from './data/ziweiTables'");
		expect(patSrc).not.toContain('starLightOf');
		expect(patSrc).not.toContain('ZWEngineOptions');
	});
	test('🔴 行为:同盘遍历全部亮度源,detectPatterns 输出恒等', ()=>{
		const { assembleNatalChart } = require('../ziweiCalc');
		const { detectPatterns } = require('../ziweiPatterns');
		const mk = ()=>assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true });
		const sig = (c)=>detectPatterns(c).map((p)=>`${p.name}:${p.broken}`).join('|');
		const base = sig(mk());
		try{
			BRIGHTNESS_SOURCE_OPTIONS.map((o)=>o.value).forEach((src)=>{
				ZWEngineOptions.brightnessSource = src;
				expect(`${src}:${sig(mk())}`).toBe(`${src}:${base}`);
			});
		}finally{
			ZWEngineOptions.brightnessSource = 'zi_jian';
		}
	});
});
