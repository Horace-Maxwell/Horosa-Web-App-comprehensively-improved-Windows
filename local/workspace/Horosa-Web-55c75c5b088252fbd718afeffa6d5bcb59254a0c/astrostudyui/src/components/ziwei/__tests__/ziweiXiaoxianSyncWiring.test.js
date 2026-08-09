// [B15b] 小限顺逆·全链同步金标 —— 病灶回归锁(2026-08-08 用户真机实锤):
//   改「小限顺逆」档后 ①盘面小限岁数条(排盘期 smallDirection 烙死)纹丝不动;②右栏芯片列表(消费期现算)
//   已按新口径,而已选中详情卡/叠宫层/金框/AI period(luckSel 点击时快照)仍旧口径 —— 同屏自相矛盾。
// 根修三件套:口径纯函数单源(ziweiCore.xiaoxianClockwiseFor) + 岁数条渲染期现算(ZiWeiHelper.xiaoxianAgesOf)
//   + 快照整链重派生(ZWLuckPanel.rederiveLuckSel,ZiWeiMain 广播监听全键触发)。
// 本文件是三件套的字节级看守;preflight sentinel 锚关键表达式防回删。
import { ZHI, xiaoxianClockwiseFor, xiaoxianAgesForHouse } from '../ziweiCore';
import { XIAOXIAN_START } from '../data/ziweiTables';
import { assembleNatalChart } from '../ZiweiCalc';
import * as ZiWeiHelper from '../ZiWeiHelper';
import { ZWEngineOptions } from '../ziweiOptions';
import {
	buildDaxianItems, buildLiunianItems, buildXiaoxianItems, buildLiuyueItems, buildLiuriItems, buildLiushiItems,
	luckSelectDaxian, luckSelectLiunian, luckSelectLiuyue, luckSelectLiuri, luckSelectLiushi, rederiveLuckSel,
} from '../ZWLuckPanel';
const fs = require('fs');
const path = require('path');

// Java ZiWeiHelper.getSmallDirectioinHouse 直译(男顺女逆,0-based step):双端同构的对拍 oracle。
function javaSmallHouse(step0, yearZi, male){
	const start = ZHI.indexOf(XIAOXIAN_START[yearZi]);
	const idx = step0 % 12;
	return male ? (idx + start) % 12 : (start - idx + 12) % 12;
}

// 造盘:丁未阴男(用户实锤截图同款差异样本 —— 两档顺逆恰好反向)。
// 补 Java 顶层兼容字段,模拟运行时形状(ZiWeiMain 本地盘 spread 在 Java chart 之上,gender/yearPolar/birth 保留)。
function makeChart(over = {}){
	const c = assembleNatalChart({ yearGan: '丁', yearZi: '未', monthInt: 7, leap: false, dayInt: 7, timeZi: '未', male: true, ...over });
	c.gender = over.male === false ? 'Female' : 'Male';
	c.yearPolar = 'Negative';   // 丁=阴干
	c.birth = '2027-08-08';
	return c;
}
const XX0 = ZWEngineOptions.xiaoxianMode;
const SG0 = ZWEngineOptions.liunianSihuaGan;
const LY0 = ZWEngineOptions.liuYueBasis;
afterEach(()=>{ ZWEngineOptions.xiaoxianMode = XX0; ZWEngineOptions.liunianSihuaGan = SG0; ZWEngineOptions.liuYueBasis = LY0; });

describe('[B15b] 口径纯函数(单一真值源)', ()=>{
	test('XIAOXIAN_START 表单源:expandSanHe 展开与经典字面量逐支相等(ZWLuckPanel 曾自带手写副本,已删)', ()=>{
		const classic = { '寅': '辰', '午': '辰', '戌': '辰', '申': '戌', '子': '戌', '辰': '戌', '亥': '丑', '卯': '丑', '未': '丑', '巳': '未', '酉': '未', '丑': '未' };
		ZHI.forEach((z)=>{ expect(XIAOXIAN_START[z]).toBe(classic[z]); });
	});
	test('默认档=男顺女逆:与 Java setupSmallDirection 直译 12支×2性×100岁 全同', ()=>{
		ZHI.forEach((yz)=>{
			[true, false].forEach((male)=>{
				const cw = xiaoxianClockwiseFor('0', male, false);
				for(let step = 0; step < 100; step++){
					const si = ZHI.indexOf(XIAOXIAN_START[yz]);
					const mine = cw ? (si + (step % 12)) % 12 : (si - (step % 12) + 12) % 12;
					expect(mine).toBe(javaSmallHouse(step, yz, male));
				}
			});
		});
	});
	test('中州档:阳男/阴女顺、阴男/阳女逆;🔴阳男两档同向(条件未触发样本)、阴男两档反向(差异样本)', ()=>{
		expect(xiaoxianClockwiseFor('1', true, true)).toBe(true);    // 阳男顺
		expect(xiaoxianClockwiseFor('1', false, false)).toBe(true);  // 阴女顺
		expect(xiaoxianClockwiseFor('1', true, false)).toBe(false);  // 阴男逆
		expect(xiaoxianClockwiseFor('1', false, true)).toBe(false);  // 阳女逆
		// 判「这盘改档该不该有差异」的口径锚:阳男(甲年男)两档同为顺 → 无差异不是死开关;
		// 阴男(丁年男)两档反向 → 用户截图盘正是该差异样本,改档必须处处跟随。
		expect(xiaoxianClockwiseFor('0', true, true)).toBe(xiaoxianClockwiseFor('1', true, true));
		expect(xiaoxianClockwiseFor('0', true, false)).not.toBe(xiaoxianClockwiseFor('1', true, false));
	});
	test('xiaoxianAgesForHouse:岁列=环距+1 起每 12 一跳升序;非法支返空', ()=>{
		// 未年起丑,顺行:寅=距1 → 2,14,…,98;逆行:寅=距11 → 12,24,…,96
		expect(xiaoxianAgesForHouse('0', true, false, '丑', '寅')).toEqual([2, 14, 26, 38, 50, 62, 74, 86, 98]);
		expect(xiaoxianAgesForHouse('1', true, false, '丑', '寅')).toEqual([12, 24, 36, 48, 60, 72, 84, 96]);
		expect(xiaoxianAgesForHouse('0', true, false, '丑', '丑')).toEqual([1, 13, 25, 37, 49, 61, 73, 85, 97]);
		expect(xiaoxianAgesForHouse('0', true, false, '?', '寅')).toEqual([]);
	});
});

describe('[B15b] 本地引擎 smallDirection 口径接线', ()=>{
	test('默认档:阴男盘 smallDirection 与 Java 直译逐宫字节一致(零回归锚)', ()=>{
		const c = makeChart();
		const perHouse = Array.from({ length: 12 }, ()=>[]);
		for(let step = 0; step < 100; step++){ perHouse[javaSmallHouse(step, '未', true)].push(step + 1); }
		c.houses.forEach((h, i)=>{ expect(h.smallDirection).toEqual(perHouse[i]); });
	});
	test('🔴 中州档(经 FORWARD 表进 ctx):阴男盘逐宫反向且≡xiaoxianAgesForHouse', ()=>{
		const c1 = assembleNatalChart({ yearGan: '丁', yearZi: '未', monthInt: 7, leap: false, dayInt: 7, timeZi: '未', male: true, xiaoxianMode: '1' });
		c1.houses.forEach((h)=>{
			expect(h.smallDirection).toEqual(xiaoxianAgesForHouse('1', true, false, '丑', h.ganzi.charAt(1)));
		});
		// 与默认档确实不同(差异样本上引擎真跟随,不是恒默认)
		const c0 = assembleNatalChart({ yearGan: '丁', yearZi: '未', monthInt: 7, leap: false, dayInt: 7, timeZi: '未', male: true });
		expect(c1.houses.map((h)=>h.smallDirection[0])).not.toEqual(c0.houses.map((h)=>h.smallDirection[0]));
	});
	test('FORWARD 表运行时含 xiaoxianMode(漏登=引擎档死,奇门缓存键前科)', ()=>{
		const { ZW_ENGINE_FORWARD_KEYS, collectEngineOpts } = require('../ziweiOptions');
		expect(ZW_ENGINE_FORWARD_KEYS).toContain('xiaoxianMode');
		expect(collectEngineOpts({ xiaoxianMode: '1' }).xiaoxianMode).toBe('1');
	});
});

describe('[B15b] 渲染层 xiaoxianAgesOf 与右栏 buildXiaoxianItems 单源互证', ()=>{
	test('🔴 阴男盘两档岁数条确变,且逐岁与右栏宫支互证(同屏自相矛盾病灶的回归锚)', ()=>{
		const c = makeChart();
		const dx = buildDaxianItems(c)[0];
		['0', '1'].forEach((mode)=>{
			ZWEngineOptions.xiaoxianMode = mode;
			const items = buildXiaoxianItems(c, dx);
			expect(items.length).toBeGreaterThan(0);
			items.forEach((it)=>{
				const ages = ZiWeiHelper.xiaoxianAgesOf(c, it.zhi);
				expect(ages).toContain(it.age);   // 右栏说 age 岁在此宫 ⇔ 岁数条该宫含 age
			});
		});
		ZWEngineOptions.xiaoxianMode = '0';
		const a0 = ZiWeiHelper.xiaoxianAgesOf(c, '寅');
		ZWEngineOptions.xiaoxianMode = '1';
		const a1 = ZiWeiHelper.xiaoxianAgesOf(c, '寅');
		expect(a0).toEqual([2, 14, 26, 38, 50, 62, 74, 86, 98]);
		expect(a1).toEqual([12, 24, 36, 48, 60, 72, 84, 96]);   // 改档必须变(修前恒 smallDirection 旧口径)
	});
	test('判定健壮性:裸本地盘(仅 male bool)与合并盘(Java gender/yearPolar)同判;条件不足返 null', ()=>{
		const bare = assembleNatalChart({ yearGan: '丁', yearZi: '未', monthInt: 7, leap: false, dayInt: 7, timeZi: '未', male: true });
		const merged = makeChart();
		ZWEngineOptions.xiaoxianMode = '1';
		expect(ZiWeiHelper.xiaoxianClockwise(bare)).toBe(ZiWeiHelper.xiaoxianClockwise(merged));
		expect(ZiWeiHelper.xiaoxianAgesOf(bare, '寅')).toEqual(ZiWeiHelper.xiaoxianAgesOf(merged, '寅'));
		expect(ZiWeiHelper.xiaoxianAgesOf(null, '寅')).toBe(null);
		expect(ZiWeiHelper.xiaoxianAgesOf(merged, null)).toBe(null);
	});
});

describe('[B15b] rederiveLuckSel 快照整链重派生', ()=>{
	function pick2029(c){
		const dx = buildDaxianItems(c)[0];
		let sel = luckSelectDaxian(c, dx, null);
		const ln = buildLiunianItems(c, dx).find((l)=>l.year === 2029);
		sel = luckSelectLiunian(c, ln, sel);
		return sel;
	}
	test('🔴 改小限顺逆:重派生后 xiaoxian 宫随新口径、age 不变,且与芯片列表恒一致(按钮vs详情矛盾锚)', ()=>{
		const c = makeChart();
		ZWEngineOptions.xiaoxianMode = '0';
		const sel = pick2029(c);
		expect(sel.xiaoxian && sel.xiaoxian.age).toBe(3);
		const oldIdx = sel.xiaoxian.mingIndex;
		ZWEngineOptions.xiaoxianMode = '1';                       // 用户改档(快照未动=修前病灶)
		const re = rederiveLuckSel(c, sel);
		expect(re.xiaoxian.age).toBe(3);
		expect(re.xiaoxian.mingIndex).not.toBe(oldIdx);           // 阴男差异样本必移宫
		const chip = buildXiaoxianItems(c, re.daxian).find((x)=>x.age === 3);
		expect(re.xiaoxian.mingIndex).toBe(chip.mingIndex);       // 详情卡=芯片列表(同屏矛盾根除)
		expect(re.xiaoxian.ganzi).toBe(chip.ganzi);
		// 丁未年亥卯未起丑:顺行3岁=卯,逆行3岁=亥(截图实锤:详情"癸卯"vs芯片"辛亥")
		expect(sel.xiaoxian.zhi).toBe('卯');
		expect(re.xiaoxian.zhi).toBe('亥');
	});
	test('改流年四化取干:重派生后 liunian.sihuaGan 字段出现/消失', ()=>{
		const c = makeChart();
		ZWEngineOptions.liunianSihuaGan = 'year_gan';
		const sel = pick2029(c);
		expect(sel.liunian.sihuaGan).toBe(undefined);             // 默认档不加字段(item 形状字节稳)
		ZWEngineOptions.liunianSihuaGan = 'ming_gong_gan';
		const re = rederiveLuckSel(c, sel);
		const expectGan = c.houses[re.liunian.mingIndex].ganzi.charAt(0);
		expect(re.liunian.sihuaGan).toBe(expectGan);
		ZWEngineOptions.liunianSihuaGan = 'year_gan';
		expect(rederiveLuckSel(c, re).liunian.sihuaGan).toBe(undefined);
	});
	test('改流月起法:liuyue.mingIndex 跟随且 liuri/liushi 命宫链随动', ()=>{
		const c = makeChart();
		ZWEngineOptions.liuYueBasis = 'doujun';
		let sel = pick2029(c);
		const ly = buildLiuyueItems(c, 2029)[0];
		sel = luckSelectLiuyue(c, ly, sel);
		const lr = buildLiuriItems(c, 2029, ly)[0];
		sel = luckSelectLiuri(c, lr, sel);
		const ls = buildLiushiItems(c, lr)[0];
		sel = luckSelectLiushi(c, ls, sel);
		ZWEngineOptions.liuYueBasis = 'taisui';
		const re = rederiveLuckSel(c, sel);
		const lyNew = buildLiuyueItems(c, 2029)[0];
		expect(re.liuyue.mingIndex).toBe(lyNew.mingIndex);
		expect(re.liuyue.mingIndex).not.toBe(ly.mingIndex);       // 丁未盘斗君≠太岁锚(差异样本)
		expect(re.liuri.mingIndex).toBe(buildLiuriItems(c, 2029, lyNew)[0].mingIndex);
		expect(re.liushi.mingIndex).toBe((re.liuri.mingIndex + 0) % 12);
	});
	test('幂等与边界:口径未变逐层深等;空 sel/空 chart/全空选择原样返回;出窗层安全置 null', ()=>{
		const c = makeChart();
		const sel = pick2029(c);
		expect(JSON.parse(JSON.stringify(rederiveLuckSel(c, sel)))).toEqual(JSON.parse(JSON.stringify(sel)));
		expect(rederiveLuckSel(c, null)).toBe(null);
		expect(rederiveLuckSel(null, sel)).toBe(sel);
		const empty = { daxian: null, liunian: null, xiaoxian: null, liuyue: null, liuri: null, liushi: null };
		expect(rederiveLuckSel(c, empty)).toBe(empty);
		const broken = { ...sel, liunian: { ...sel.liunian, year: 1800 } };   // 大限窗外年份
		expect(rederiveLuckSel(c, broken).liunian).toBe(null);
	});
});

describe('[B15b] 静态接线锁(剥注释;L2 铁律:注释里出现键名≠代码消费了它)', ()=>{
	const strip = (s)=>s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
	const read = (f)=>strip(fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8'));
	test('ZiWeiMain 广播监听器内真调 rederiveLuckSel(全键触发,不设白名单)', ()=>{
		const src = read('ZiWeiMain.js');
		expect(src.includes('rederiveLuckSel(c, s.luckSel)')).toBe(true);
		const i = src.indexOf('_zwDisplayListener = (ev)');
		const body = src.slice(i, src.indexOf('window.addEventListener(ZiWeiHelper.ZIWEI_DISPLAY_EVENT', i));
		expect(body.includes('rederiveLuckSel')).toBe(true);      // 必须在监听器体内,不是别处偶然出现
		expect(body.includes("dualView === 'next'")).toBe(true);  // 双盘取 dualAlt(否则次日盘重派生错基)
	});
	test('ZWCommHouse 岁数条消费 xiaoxianAgesOf 且保留 smallDirection 回退', ()=>{
		const src = read('ZWCommHouse.js');
		expect(src.includes('ZiWeiHelper.xiaoxianAgesOf(chart')).toBe(true);
		const i = src.indexOf('xiaoxianAgesOf');
		expect(src.slice(i, i + 400).includes('smallDirection')).toBe(true);
	});
	test('onPresetChange 末尾有 bump 广播(preset 只差推演层键时 redraw 被 dedupe 挡=死档)', ()=>{
		const src = read('ZiWeiInput.js');
		const i = src.indexOf('onPresetChange(val)');
		const body = src.slice(i, src.indexOf('onSihuaCustomOk', i));
		expect(body.includes("bumpZwDisplayRev('preset'")).toBe(true);
	});
});
