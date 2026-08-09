// [D1] 开关族A金标(键清单驱动):
//   ① 7 开关默认值=现状零回归 ② colorForEvilStar 纯函数 ③ filterShenshaForDisplay 三组过滤
//   ④ UI wiring(每键:Checkbox 挂 handler×LS 键×消费文件读口) ⑤ 显示开关不渗漏快照(源码守卫)
import fs from 'fs';
import path from 'path';
import * as ZiWeiHelper from '../ZiWeiHelper';
import * as ZWConst from '../../../constants/ZWConst';

// 键清单:新增开关必登记此表,五路断言自动覆盖。
const FLAGS = [
	{ ls: 'ziweiShowLaiyin', fn: 'zwShowLaiyin', dflt: true, consumers: ['ZWHouse.js', 'ZWHouseSangHe.js'] },
	{ ls: 'ziweiShowBodyPalace', fn: 'zwShowBodyPalace', dflt: true, consumers: ['ZWHouse.js', 'ZWHouseSangHe.js'] },
	{ ls: 'ziweiSixEvilBlack', fn: 'zwSixEvilBlack', dflt: false, consumers: [] },   // 经 colorForEvilStar 间接消费
	{ ls: 'ziweiShowShaHuagai', fn: 'zwShowShaHuagai', dflt: true, consumers: [] },  // 经 filterShenshaForDisplay
	{ ls: 'ziweiShowShaSande', fn: 'zwShowShaSande', dflt: true, consumers: [] },
	{ ls: 'ziweiShowShaTaizuo', fn: 'zwShowShaTaizuo', dflt: true, consumers: [] },
	{ ls: 'ziweiZihuaAlways', fn: 'zwZihuaAlways', dflt: false, consumers: ['ZiWeiMain.js'] },
];

afterEach(()=>{
	FLAGS.forEach((f)=>{ try{ localStorage.removeItem(f.ls); }catch(e){ /* noop */ } });
});

describe('[D1] 开关默认值=现状零回归', ()=>{
	test('🔴 七键无 LS 时默认值逐键正确;写 0/1 后翻转', ()=>{
		FLAGS.forEach((f)=>{
			expect(`${f.ls}:${ZiWeiHelper[f.fn]()}`).toBe(`${f.ls}:${f.dflt}`);
			localStorage.setItem(f.ls, '0');
			expect(`${f.ls}:${ZiWeiHelper[f.fn]()}`).toBe(`${f.ls}:false`);
			localStorage.setItem(f.ls, '1');
			expect(`${f.ls}:${ZiWeiHelper[f.fn]()}`).toBe(`${f.ls}:true`);
		});
	});
});

describe('[D1] colorForEvilStar 纯函数', ()=>{
	test('🔴 关(默认)=全煞曜同煞红;开=仅六煞(含book档天空)转黑 token,天刑天姚咸池保持煞红', ()=>{
		['擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '天刑', '天姚', '咸池'].forEach((n)=>{
			expect(ZiWeiHelper.colorForEvilStar(n)).toBe(ZWConst.ZWColor.StarEvilStroke);
		});
		localStorage.setItem('ziweiSixEvilBlack', '1');
		['擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '天空'].forEach((n)=>{
			expect(`${n}:${ZiWeiHelper.colorForEvilStar(n)}`).toBe(`${n}:${ZWConst.ZWColor.StarSixEvilStroke}`);
		});
		['天刑', '天姚', '咸池', '孤辰'].forEach((n)=>{
			expect(`${n}:${ZiWeiHelper.colorForEvilStar(n)}`).toBe(`${n}:${ZWConst.ZWColor.StarEvilStroke}`);
		});
	});
	test('两盘煞曜组已换函数色;drawGroup 支持函数分派', ()=>{
		['ZWHouse.js', 'ZWHouseSangHe.js'].forEach((f)=>{
			const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
			expect(`${f}:${src.includes('ZiWeiHelper.colorForEvilStar')}`).toBe(`${f}:true`);
			expect(`${f}:${src.includes("typeof color === 'function'")}`).toBe(`${f}:true`);
		});
	});
});

describe('[D1] filterShenshaForDisplay', ()=>{
	const mk = (names)=>names.map((n)=>({ name: n }));
	test('🔴 默认全开=返回原引用(零开销零变化)', ()=>{
		const arr = mk(['华盖', '天德', '三台', '天刑']);
		expect(ZiWeiHelper.filterShenshaForDisplay(arr)).toBe(arr);
	});
	test('三开关各辖各组;组外星恒保留;混合关闭正确并集', ()=>{
		const arr = mk(['华盖', '劫煞', '咸池', '天德', '月德', '三台', '八座', '恩光', '天贵', '天刑', '红鸾']);
		localStorage.setItem('ziweiShowShaHuagai', '0');
		expect(ZiWeiHelper.filterShenshaForDisplay(arr).map((s)=>s.name))
			.toEqual(['天德', '月德', '三台', '八座', '恩光', '天贵', '天刑', '红鸾']);
		localStorage.setItem('ziweiShowShaSande', '0');
		localStorage.setItem('ziweiShowShaTaizuo', '0');
		expect(ZiWeiHelper.filterShenshaForDisplay(arr).map((s)=>s.name)).toEqual(['天刑', '红鸾']);
	});
	test('两盘五星组+双盘 smalls 全部过滤(列宽计算前);数据层 houseObj 不被改动', ()=>{
		['ZWHouse.js', 'ZWHouseSangHe.js'].forEach((f)=>{
			const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
			const n = (src.match(/filterShenshaForDisplay\(/g) || []).length;
			expect(`${f}:${n >= 4}`).toBe(`${f}:true`);   // evil+othersGood+othersBad+smalls
		});
		const arr = mk(['华盖']);
		localStorage.setItem('ziweiShowShaHuagai', '0');
		ZiWeiHelper.filterShenshaForDisplay(arr);
		expect(arr.length).toBe(1);   // 原数组零触碰
	});
});

describe('[D1] UI wiring(键清单驱动)+快照不渗漏', ()=>{
	const inputSrc = fs.readFileSync(path.join(__dirname, '..', 'ZiWeiInput.js'), 'utf8');
	test('🔴 每键:Checkbox 挂 onDisplayFlagToggle(lsKey);handler 写 LS+广播', ()=>{
		FLAGS.forEach((f)=>{
			expect(`${f.ls}:${inputSrc.includes(`onDisplayFlagToggle('${f.ls}'`)}`).toBe(`${f.ls}:true`);
		});
		const h = inputSrc.slice(inputSrc.indexOf('onDisplayFlagToggle(lsKey, stateKey, checked)'));
		expect(h.slice(0, 400).includes('safeLocalStorageSet(lsKey')).toBe(true);
		expect(h.slice(0, 400).includes('bumpZwDisplayRev(stateKey')).toBe(true);
	});
	test('🔴 onOverlayToggle 尾部有统一 bump(overlay 死开关族加固)', ()=>{
		const h = inputSrc.slice(inputSrc.indexOf('onOverlayToggle(stateKey, optKey, lsKey, checked)'));
		expect(h.slice(0, 500).includes('bumpZwDisplayRev(optKey, checked)')).toBe(true);
	});
	test('声明的消费文件确实读取该开关', ()=>{
		FLAGS.forEach((f)=>{
			f.consumers.forEach((c)=>{
				const src = fs.readFileSync(path.join(__dirname, '..', c), 'utf8');
				expect(`${c}→${f.fn}:${src.includes(`${f.fn}()`)}`).toBe(`${c}→${f.fn}:true`);
			});
		});
	});
	test('🔴 纯显示开关不渗漏快照:挂载/导出链 aiAnalysisContext 与快照 builder 不读七键', ()=>{
		['../../../utils/aiAnalysisContext.js', '../ZWLuckPanel.js'].forEach((rel)=>{
			const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
			FLAGS.forEach((f)=>{
				expect(`${rel}:${f.ls}:${src.includes(f.ls)}`).toBe(`${rel}:${f.ls}:false`);
			});
		});
	});
});

describe('[QA-fix] 运限推演层三键:只广播不重提盘(保住已选运限)', ()=>{
	test('🔴 liunianSihuaGan/liuYueBasis/xiaoxianMode 的 handler 无 redrawChart 且有 bump', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'ZiWeiInput.js'), 'utf8');
		[['onLiunianSihuaGanChange'], ['onLiuYueBasisChange'], ['onXiaoxianModeChange']].forEach(([h])=>{
			const i = src.indexOf(`${h}(val)`);
			expect(`${h}:found:${i > 0}`).toBe(`${h}:found:true`);
			// 单行方法(体在同一行闭合)取该行;多行方法取到首个 \n\t} —— 否则单行体会吞进后续方法假红
			const eol = src.indexOf('\n', i);
			const firstLine = src.slice(i, eol);
			const body = /\}\s*$/.test(firstLine.trim()) ? firstLine
				: src.slice(i, src.indexOf('\n\t}', i) + 3).split('\n').filter((l)=>!l.trim().startsWith('//')).join('\n');
			expect(`${h}:redraw:${body.includes('redrawChart')}`).toBe(`${h}:redraw:false`);
			expect(`${h}:bump:${body.includes('bumpZwDisplayRev')}`).toBe(`${h}:bump:true`);
		});
	});
});
