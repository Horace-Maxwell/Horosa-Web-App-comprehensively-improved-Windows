// 🔴 跨技法「存案保真」总闸 —— 保存后再读取,必须逐字复现时间/地点/选项/卦相。
//
// 立此闸的由来(用户实报):灵棋经保存结果后**再次读取那条记录,卦不一样** —— 保存形同虚设。
// 根因是各技法读档统一有 `!force && lastRestoredCaseId === saved.caseVersion` 这道去重守卫,
// 而 lastRestoredCaseId 只在构造函数初始化、全仓无一处重置;子技法面板又常驻挂载
// (Tabs 无 destroyInactiveTabPane → componentDidMount 的 force 一会话只跑一次)。
// 于是同一条记录第二次载入必被守卫拦掉。21 技法同款守卫、无一幸免。
//
// 仓内此前**没有**「一条用例扫全部技法 × 存案往返」的总闸:
//   · localStorageManagement.test.js 遍历了全量 CASE_TYPE_OPTIONS,但只验信封不验选项;
//   · aiExportSectionsParityAll.test.js 真跑全技法无头重算,但验的是段头不是存案键值;
//   · 逐技法的往返用例只有 4 个(wuzhao / geomancy / xiaochengtu / tarot),其余 15 法裸奔。
// 本文件补上这一刀。
//
// 🔴 判据一律 **AST 求出**,不用正则:首版正则把 dispatch 对象的 type/payload/key/record/event
// 也当成存案选项(dunjia 报 17 键、guice 报 5 键全未读回,全是假报)。
// preflight :5024 早写过「凡从源码正则求名单,必须先断言名单合理,否则判据本身失效比漏支更险」。
const fs = require('fs');
const path = require('path');
const helper = require('./helpers/caseRoundTrip');
const { getKentangSavedCasePayload, caseApplySeqSuffix } = require('../kentangCaseSave');
const storageutil = require('../storageutil');

const COMPONENTS_DIR = path.join(helper.UI_SRC, 'components');

function walk(dir, acc){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){
			if(e.name !== '__tests__'){ walk(p, acc); }
		}else if(e.name.endsWith('.js')){
			acc.push(p);
		}
	});
	return acc;
}

const ALL_JS = walk(COMPONENTS_DIR, []);
const rel = (p)=>path.relative(helper.UI_SRC, p);
// 「有存案入口」的技法组件 = 机械求出,不手写数组(新技法忘接线即在下面的量级自检里现形)
const SAVE_MAINS = ALL_JS.filter((f)=>/Main\.js$/.test(f) && fs.readFileSync(f, 'utf8').includes('clickSaveCase'));

describe('存案保真总闸 · 清单自检', ()=>{
	it('机械求出的技法清单非空且量级合理(判据失效比漏支更险)', ()=>{
		// 现况 19 个;下限设 15 只防「解析器坏掉/目录挪走导致清单塌成空集」这一类事故
		expect(SAVE_MAINS.length).toBeGreaterThanOrEqual(15);
		expect(SAVE_MAINS.length).toBeLessThanOrEqual(40);
	});

	it('每个有存案入口的技法都必须有读档入口(存了没法读＝保存即废纸)', ()=>{
		const orphan = SAVE_MAINS.filter((f)=>!helper.hasRestoreEntry(helper.parseFile(rel(f)))).map(rel);
		expect(orphan).toEqual([]);
	});
});

describe('存案保真总闸 · 存而不载(双向哨兵)', ()=>{
	// 🔴 本轮真抓到的四条全属此类:geomancy.castMethod(真起卦法只记在它里、无人读回)、
	// lingqi.seedMode(存 'manual' 却不读,左栏档位仍 random)、feigong 的 qiMode 与日干支档位
	// (根本没进 payload)、以及若干 localFields 草稿未清。
	it('每个写进 payload.options 的键,都必须有人读回(逐技法)', ()=>{
		const bad = [];
		SAVE_MAINS.forEach((f)=>{
			const dir = path.dirname(f);
			const saved = helper.savedOptionKeys(helper.parseFile(rel(f)));
			if(!saved.keys.length){ return; }
			// 读者面 = 该技法目录下全部文件(组件 restore + 无头快照 builder + 引擎…)。
			// 判据是「存进去的键必须有人读」,不是「必须由 restore 读」——
			// 只看 restore 会把灵棋经 wuDay/timeLines(无头 builder 在读)误判成存而不载。
			const readers = ALL_JS.filter((x)=>x.startsWith(`${dir}${path.sep}`))
				.map((x)=>{ try{ return helper.parseFile(rel(x)); }catch(e){ return null; } });
			const readable = helper.optionReaderKeys(readers);
			const missing = saved.keys.filter((k)=>!readable.has(k));
			if(missing.length){ bad.push(`${rel(f)} 存而不载: ${missing.join(', ')}`); }
		});
		expect(bad).toEqual([]);
	});

	it('存案选项键总量合理(抽取器塌成空集即红)', ()=>{
		const total = SAVE_MAINS.reduce((n, f)=>n + helper.savedOptionKeys(helper.parseFile(rel(f))).keys.length, 0);
		expect(total).toBeGreaterThanOrEqual(30);   // 现况 53
	});
});

describe('存案保真总闸 · 读档去重键(本次 bug 的直接金标)', ()=>{
	const CASE = {
		cid: { value: 'case-1' },
		updateTime: { value: '2026-08-12 01:00:00' },
		sourceModule: { value: 'lingqi' },
		caseType: { value: 'lingqi' },
		payload: { value: JSON.stringify({ module: 'lingqi', counts: [2, 3, 3] }) },
	};
	function stubStore(seq){
		storageutil.setGlobalStore({ user: { currentCase: CASE, caseApplySeq: seq } });
	}

	it('🔴 同一条记录、代次一变,caseVersion 必变 —— 否则第二次载入被守卫永久拦掉', ()=>{
		stubStore(1);
		const a = getKentangSavedCasePayload('lingqi');
		stubStore(2);
		const b = getKentangSavedCasePayload('lingqi');
		expect(a && a.caseVersion).toBeTruthy();
		expect(b && b.caseVersion).toBeTruthy();
		expect(b.caseVersion).not.toBe(a.caseVersion);
		// payload 本身不受影响(去重键变、内容不变)
		expect(b.payload).toEqual(a.payload);
	});

	it('代次不变时 caseVersion 恒定 —— 守卫「别反复覆盖用户现场」的原意必须保住', ()=>{
		stubStore(7);
		const a = getKentangSavedCasePayload('lingqi');
		const b = getKentangSavedCasePayload('lingqi');
		expect(b.caseVersion).toBe(a.caseVersion);
	});

	it('后缀函数是单一真值源:缺省 0、随 caseApplySeq 走', ()=>{
		expect(caseApplySeqSuffix(null)).toBe('|0');
		expect(caseApplySeqSuffix({})).toBe('|0');
		expect(caseApplySeqSuffix({ caseApplySeq: 5 })).toBe('|5');
	});
});

describe('存案保真总闸 · 源码接线锚(防复辟)', ()=>{
	it('🔴 凡自拼 caseVersion 者必须带载入代次后缀(手抄一份即红)', ()=>{
		const bad = [];
		ALL_JS.filter((f)=>/Main\.js$/.test(f)).forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			// 只看代码行,注释里提到不算(注释喂哨兵会造成假绿 —— 本轮已踩过)
			src.split('\n').forEach((line)=>{
				const code = line.replace(/\/\/.*$/, '');
				if(!/caseVersion\s*=\s*`/.test(code)){ return; }
				if(!code.includes('caseApplySeqSuffix')){ bad.push(`${rel(f)}: ${code.trim().slice(0, 70)}`); }
			});
		});
		expect(bad).toEqual([]);
	});

	it('🔴 共用件的 caseVersion 也必须带后缀(改坏它 = 21 技法一起退化)', ()=>{
		const src = fs.readFileSync(path.join(helper.UI_SRC, 'utils/kentangCaseSave.js'), 'utf8');
		const line = src.split('\n').find((l)=>/caseVersion:/.test(l.replace(/\/\/.*$/, '')));
		expect(line).toBeTruthy();
		expect(line.includes('caseApplySeqSuffix')).toBe(true);
	});

	it('🔴 applyCase 必须自增代次(不增则后缀恒定,等于没修)', ()=>{
		const src = fs.readFileSync(path.join(helper.UI_SRC, 'models/user.js'), 'utf8');
		expect(src).toContain('caseApplySeq: prevSeq + 1');
	});

	it('🔴 每个存案入口都必须带口径快照与性别(否则载档回落全局值,盘会算错)', ()=>{
		// 两种合规写法:走共用件 openKentangCaseDrawer,或自建 record 时调 caseFieldSnapshot
		const bad = [];
		ALL_JS.filter((f)=>/Main\.js$/.test(f)).forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			if(!src.includes("key: 'caseadd'")){ return; }        // 只查自建 record 的
			if(!src.includes('caseFieldSnapshot(')){ bad.push(`${rel(f)}: 自建 record 但没带 caseFieldSnapshot`); }
		});
		// 共用件本身与 divinationCaseSave 也必须带
		['utils/kentangCaseSave.js', 'utils/divinationCaseSave.js'].forEach((u)=>{
			const src = fs.readFileSync(path.join(helper.UI_SRC, u), 'utf8');
			if(!src.includes('caseFieldSnapshot')){ bad.push(`${u}: 缺 caseFieldSnapshot`); }
			if(!src.includes('caseGenderValue')){ bad.push(`${u}: 缺 caseGenderValue`); }
		});
		expect(bad).toEqual([]);
	});

	it('🔴 去重命中后若会触发后端重取,必须先拦下(否则还原的盘被重取覆盖)', ()=>{
		const bad = [];
		ALL_JS.filter((f)=>/Main\.js$/.test(f)).forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			if(!src.includes('lastRestoredCaseId === saved.caseVersion')){ return; }
			// componentDidUpdate 里是 `if(!this.restoreFromCurrentCase()){ … fetch … }` 这一形态才有风险
			const du = src.split('componentDidUpdate')[1];
			if(!du){ return; }
			const head = du.slice(0, 1200);
			if(!/if\(!this\.restoreFromCurrentCase\(\)\)/.test(head)){ return; }
			// 有风险 → 守卫命中处必须有「已有盘则返 true」
			const idx = src.indexOf('lastRestoredCaseId === saved.caseVersion');
			const seg = src.slice(idx, idx + 420);
			if(!/return true;/.test(seg)){ bad.push(`${rel(f)}: 去重命中裸 return,会被 fetch 覆盖`); }
		});
		expect(bad).toEqual([]);
	});
});
