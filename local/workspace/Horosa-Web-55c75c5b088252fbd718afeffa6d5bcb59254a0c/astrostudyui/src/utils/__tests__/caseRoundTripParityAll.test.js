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
const { readSource, sourceSetFiles, isSourceSetPart } = require('./helpers/sourceSet');
const { getKentangSavedCasePayload, caseRestoreKey } = require('../kentangCaseSave');
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
// 技法主组件 = 按文件名 *Main.js 求出;拆成子模块的大文件(登记表 scripts/source-sets.json)按「门面 + 子模块」全集读、
// 子模块不单列 —— 子模块文件名不是 *Main.js,逐文件读门面会漏掉搬进子模块的代码(判据静默缺席 = 假绿)。
const MAINS = ALL_JS.filter((f)=>/Main\.js$/.test(f) && !isSourceSetPart(f));
// 全集里每个文件各自的 AST(类方法类判据:门面的类在门面里,搬出去的助手在子模块里,逐个看)
const setAsts = (f)=>sourceSetFiles(f).map((x)=>helper.parseFile(rel(x)));
const savedKeysOf = (f)=>setAsts(f).map((a)=>helper.savedOptionKeys(a)).find((r)=>r.found) || { keys: [], spread: false, found: false };
// 「有存案入口」的技法组件 = 机械求出,不手写数组(新技法忘接线即在下面的量级自检里现形)
const SAVE_MAINS = MAINS.filter((f)=>readSource(f).includes('clickSaveCase'));

describe('存案保真总闸 · 清单自检', ()=>{
	it('机械求出的技法清单非空且量级合理(判据失效比漏支更险)', ()=>{
		// 现况 19 个;下限设 15 只防「解析器坏掉/目录挪走导致清单塌成空集」这一类事故
		expect(SAVE_MAINS.length).toBeGreaterThanOrEqual(15);
		expect(SAVE_MAINS.length).toBeLessThanOrEqual(40);
	});

	it('每个有存案入口的技法都必须有读档入口(存了没法读＝保存即废纸)', ()=>{
		const orphan = SAVE_MAINS.filter((f)=>!setAsts(f).some((a)=>helper.hasRestoreEntry(a))).map(rel);
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
			const saved = savedKeysOf(f);
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
		const total = SAVE_MAINS.reduce((n, f)=>n + savedKeysOf(f).keys.length, 0);
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
	// 显式载入 = applyCase 同一次写下 appliedCaseCid 与载入代次
	function stubStore(seq){
		storageutil.setGlobalStore({ user: { currentCase: CASE, caseApplySeq: seq, appliedCaseCid: 'case-1' } });
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

	it('🔴 西占系共用件同款金标(horary):代次一变 caseVersion 必变、不变则恒定', ()=>{
		// getDivinationSavedCasePayload 曾无代次后缀 → DivinationChartShell._appliedCaseVersion
		// 永不重置,四技法第二次载入静默不生效。行为金标与 kentang 侧一比一。
		const { getDivinationSavedCasePayload } = require('../divinationCaseSave');
		const DIV_CASE = {
			cid: { value: 'case-div-1' },
			updateTime: { value: '2026-08-13 02:00:00' },
			sourceModule: { value: 'horary' },
			caseType: { value: 'horary' },
			payload: { value: JSON.stringify({ module: 'horary', settings: { hsys: 3 } }) },
		};
		storageutil.setGlobalStore({ user: { currentCase: DIV_CASE, caseApplySeq: 1, appliedCaseCid: 'case-div-1' } });
		const a = getDivinationSavedCasePayload('horary');
		storageutil.setGlobalStore({ user: { currentCase: DIV_CASE, caseApplySeq: 2, appliedCaseCid: 'case-div-1' } });
		const b = getDivinationSavedCasePayload('horary');
		expect(a && a.caseVersion).toBeTruthy();
		expect(b && b.caseVersion).toBeTruthy();
		expect(b.caseVersion).not.toBe(a.caseVersion);
		expect(b.payload).toEqual(a.payload);
		storageutil.setGlobalStore({ user: { currentCase: DIV_CASE, caseApplySeq: 2, appliedCaseCid: 'case-div-1' } });
		expect(getDivinationSavedCasePayload('horary').caseVersion).toBe(b.caseVersion);
	});

	it('代次不变时 caseVersion 恒定 —— 守卫「别反复覆盖用户现场」的原意必须保住', ()=>{
		stubStore(7);
		const a = getKentangSavedCasePayload('lingqi');
		const b = getKentangSavedCasePayload('lingqi');
		expect(b.caseVersion).toBe(a.caseVersion);
	});

	it('去重键是单一真值源:只认显式载入的那条、随载入代次走、不含更新时间', ()=>{
		const cur = (cid, t)=>({ cid: { value: cid }, updateTime: { value: t } });
		expect(caseRestoreKey('m', null)).toBe(null);
		expect(caseRestoreKey('m', {})).toBe(null);
		// 当前事盘不是显式载入的那条(编辑 / 存为事盘把它换掉)→ 不还原
		expect(caseRestoreKey('m', { currentCase: cur('b', 't1'), appliedCaseCid: 'a', caseApplySeq: 3 })).toBe(null);
		expect(caseRestoreKey('m', { currentCase: cur('b', 't1'), appliedCaseCid: null, caseApplySeq: 3 })).toBe(null);
		expect(caseRestoreKey('m', { currentCase: cur('a', 't1'), appliedCaseCid: 'a', caseApplySeq: 5 })).toBe('m|a|5');
		// 保存编辑换了更新时间:键不变
		expect(caseRestoreKey('m', { currentCase: cur('a', 't2'), appliedCaseCid: 'a', caseApplySeq: 5 })).toBe('m|a|5');
		// 数字 cid 与字符串 cid 同一条
		expect(caseRestoreKey('m', { currentCase: { cid: { value: 12 } }, appliedCaseCid: '12', caseApplySeq: 1 })).toBe('m|12|1');
	});
});

describe('存案保真总闸 · 源码接线锚(防复辟)', ()=>{
	it('🔴 凡自拼 caseVersion 者必须带载入代次后缀(手抄一份即红):读档去重键一律出自 caseRestoreKey', ()=>{
		const bad = [];
		ALL_JS.forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			// 只看代码行,注释里提到不算(注释喂哨兵会造成假绿 —— 本轮已踩过)
			src.split('\n').forEach((line)=>{
				const code = line.replace(/\/\/.*$/, '');
				// 去重键的两种自拼写法:caseVersion = …(不出自共用件)/ 页面自己读当前事盘的更新时间或载入代次(按当前事盘而非显式载入判还原)
				if(/\bcaseVersion\s*=(?!=)/.test(code) && !/caseVersion\s*=\s*caseRestoreKey\(/.test(code)){ bad.push(`${rel(f)}: ${code.trim().slice(0, 80)}`); }
				if(/currentCase\.updateTime|caseApplySeq|appliedCaseCid/.test(code)){ bad.push(`${rel(f)}: ${code.trim().slice(0, 80)}`); }
			});
		});
		expect(bad).toEqual([]);
	});

	it('🔴 共用件的 caseVersion 也必须出自 caseRestoreKey(改坏它 = 25 技法一起退化)', ()=>{
		// 双共用件:kentangCaseSave(19 技法) + divinationCaseSave(卜卦/择日/世俗/天星四技法)。
		// 🔴 后者曾漏网 —— 扩域后改坏任意一份即红。
		['utils/kentangCaseSave.js', 'utils/divinationCaseSave.js'].forEach((u)=>{
			const src = fs.readFileSync(path.join(helper.UI_SRC, u), 'utf8');
			const line = src.split('\n').find((l)=>/const caseVersion\s*=/.test(l.replace(/\/\/.*$/, '')));
			expect(line).toBeTruthy();
			expect(`${u} → ${line.trim()}`).toContain('caseRestoreKey(module, userState)');
			expect(src).not.toMatch(/caseVersion:\s*`/);
		});
		// 键函数本身:不许读更新时间(保存编辑换更新时间不是载入)、必须比对显式载入的 cid
		const ks = fs.readFileSync(path.join(helper.UI_SRC, 'utils/kentangCaseSave.js'), 'utf8');
		const body = ks.slice(ks.indexOf('export function caseRestoreKey('), ks.indexOf('\n}\n', ks.indexOf('export function caseRestoreKey(')));
		expect(body).toContain('appliedCaseCid');
		expect(body).not.toContain('updateTime');
	});

	it('🔴 applyCase 必须自增代次(不增则后缀恒定,等于没修),并同一次写下载入的 cid', ()=>{
		const src = fs.readFileSync(path.join(helper.UI_SRC, 'models/user.js'), 'utf8');
		expect(src).toContain('caseApplySeq: prevSeq + 1, appliedCaseCid: appliedCid');
		// appliedCaseCid 只由 applyCase 写(别处写 = 编辑 / 存为事盘又被当成载入)
		expect((src.match(/appliedCaseCid:/g) || []).length).toBe(2);   // 初值 + applyCase
	});

	it('🔴 每个存案入口都必须带口径快照与性别(否则载档回落全局值,盘会算错)', ()=>{
		// 两种合规写法:走共用件 openKentangCaseDrawer,或自建 record 时调 caseFieldSnapshot
		const bad = [];
		MAINS.forEach((f)=>{
			const src = readSource(f);
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
		MAINS.forEach((f)=>{
			const src = readSource(f);
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
