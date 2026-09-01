// 🔴 [V6-W3] 挂载一致性三闸 —— 「所有 AI 挂载设置永久准确无误」的机械保证(wuzhaoChainParity
// 双向判据泛化)。由来:B 路 76 键矩阵实锤 sixyao.guirenFa 手抄白名单漏抄恒死、既有测试与
// 代码抄同一份漏抄清单;fieldParams 是 fieldsToParams 手抄副本已漂移(首跑即抓获七政六键缺失);
// kind 与 isChartTechnique 双口径零一致性断言(登错一处=齿轮静默蒸发)。
//
// 闸1 field 级消费闸:每个非 sectionsOnly 技法的每个齿轮名,必须满足三层之一:
//   ①字面出现在组装文件 aiAnalysisContext.js(手抄白名单/构参/整包透传注释——guirenFa 当时零出现)
//   ②命中前缀拼键锚(hp_/ep_/school_/taiyiSchool_ 族在组装文件内 o['hp_'+sp.key] 式拼键消费,
//     字面名天然不出现;锚串被删=改动了消费结构,红)
//   ③在 REMOTE_CONSUMPTION 登记的异地消费文件中出现(登记时经人工核实;测试真 grep 防登记造假)
// 新增齿轮忘接组装点即红。
// 闸3 fieldParams ≡ fieldsToParams 逐键对拍:AI 链与技法页构参键集 diff,差异必须在
//     成文豁免表(有意差异登记理由),新漂移即红。
// 闸4 分派一致性:kind==='record' ⟺ ANALYSIS_CHART_TECHNIQUES 成员;kind==='payload' 而
//     走 A 路者必须在显式例外表(cetian/huangji 靠 case 内手抄回塞才活,历史注释自陈)。
import fs from 'fs';
import path from 'path';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../techniqueMountSettings';

const UI_ROOT = path.join(__dirname, '..', '..');
const CTX_SRC = fs.readFileSync(path.join(UI_ROOT, 'utils', 'aiAnalysisContext.js'), 'utf8');

// 层②:组装文件内「前缀拼键」消费锚(字面键名不出现,靠 prefix+动态键拼装)。
// 锚串必须与 aiAnalysisContext.js 源码逐字节一致 —— 改了消费结构就该来改这里(有意为之)。
const PREFIX_ANCHORS = [
	{ prefix: 'hp_', anchor: "o['hp_' + sp.key]" },                 // horary 判读参数(:2043)
	{ prefix: 'ep_', anchor: "options['ep_' + sp.key]" },           // election 判读参数(:2101)
	{ prefix: 'school_', anchor: "po['school_' + k]" },             // taiyi 流派六轴(:1026)
	{ prefix: 'taiyiSchool_', anchor: "po['taiyiSchool_' + k]" },   // 三式合一太乙轴(:1026 同行)
];

// 层③:齿轮在组装链之外消费的登记表:field 名(或「技法.field」复合键,同名字段跨技法消费点
// 不同用复合键)→ { file, anchor }(anchor 缺省=键名)。登记=经人工核实该文件确实读这个键
// (测试会去该文件 grep anchor,防登记造假)。
// 🔴 判定层序:登记键**优先走层③真 grep**,不落层①字面判据 —— 层①命中注释也算过,
// guirenFa 曾被自己源文件里的病史注释保送(层③真锚永不执行),复查轮实锤后调层序根治。
const REMOTE_CONSUMPTION = {};
const reg = (file, names, anchor)=>{
	// 复合键(「技法.field」)缺省 anchor 剥掉技法前缀 —— grep 消费文件用的是裸字段名。
	names.forEach((n)=>{ REMOTE_CONSUMPTION[n] = { file, anchor: anchor || n.split('.').pop() }; });
};
// 七政 C 类:storageKey 写全局,GuoLaoChartMain 回退读(B 路矩阵已核)。
reg('components/guolao/GuoLaoChartMain.js', ['lifeMode', 'bodyMode', 'nodeMode', 'su28Mode', 'trueSolarTime', 'nodeType', 'lilithType']);
// 宿占起宫(SuZhanMain 读,B 路矩阵已核)。
reg('components/suzhan/SuZhanMain.js', ['houseStartMode']);
// 埃及历七轴:随盘键经 egyptSchoolFromFields(fields) 进 AI 快照埃及历段(astroAiSnapshot:1556);
// 消费形态=前缀常量拼键 fields[EGYPT_RECORD_KEY_PREFIX + k],anchor 用拼键表达式串。
reg('divination/data/egyptianSchools.js', ['egypt_decanRuler', 'egypt_decanAnchor', 'egypt_decanNaming', 'egypt_starClock', 'egypt_calendarAnchor', 'egypt_petosirisMod', 'egypt_godEdition'], 'fields[EGYPT_RECORD_KEY_PREFIX + k]');
// 奇门 20 键(qimen 与 sanshiunited 同名共享):options 整包进 payload,DunJiaCalc 起局消费。
reg('components/dunjia/DunJiaCalc.js', ['godsPreset', 'anGanMode', 'feiXingShun', 'feiMenShun', 'feiShenShun', 'feiMenZhongCan', 'feiMenZhongShow', 'mixTian', 'mixXing', 'mixMen', 'mixShen', 'kongMarkBoth', 'showAllKong', 'shiftZhiFuMode', 'yearJiaJu', 'dayJiaJu', 'keJiaFenDun', 'keZiZhengHuanShi', 'jinhanMenPai', 'showAnZhi']);
// 龟策:流派/起卦/大定表在 guiceSchools+engine 消费。
reg('components/guice/guiceSchools.js', ['yanshuFa', 'qiguaShu', 'shiyingSet', 'dadingTable', 'shuXi', 'shiFang', 'shenSha']);
reg('components/xiaoliuren/XiaoLiuRenMain.js', ['showOneThree']);
reg('components/xiaochengtu/XiaoChengTuMain.js', ['yongGong', 'piKoujing']);
reg('components/feigong/FeiGongMain.js', ['mingAge', 'mingGender', 'liuYueMonth', 'koujing']);
// 通书:列宿用法在 tongshuSchools,命年在玄空层。
reg('components/calendar/tongshuSchools.js', ['liexiuUse']);
reg('components/calendar/tongshu/xuankong.js', ['mingYear']);
// 六爻:schema 驱动 merge 后(W2 根修,组装文件无手抄键名),判读消费在 liuyaoFacade/liuyaoSchools。
reg('components/gua/liuyaoFacade.js', ['askType', 'yongOverride', 'benming', 'tuChangsheng', 'bianyaoScope', 'fushen', 'yuepoMode', 'shishen', 'jinTuiTu', 'tianshiSchool', 'guashen', 'sixGods', 'yuqi', 'yingqi', 'doctrine', 'gufa', 'yueLiushen', 'guirenFa']);
reg('components/wuzhao/WuZhaoMain.js', ['shifaVariant', 'qianAuto', 'qianThrows', 'zhaoNums', 'xingshenMonth', 'mingZhi']);
// 复查轮抓获:此前仅靠组装文件病史注释保送(层①短路),真锚在 WuZhaoMain(键集驱动透传的消费端)。
reg('components/wuzhao/WuZhaoMain.js', ['wuzhao.manualSplits', 'wuzhao.number']);
// 汉堡量化盘流派(school 是超普通词,层①被太乙 po.school 等无关子串恒保送 → 复合键真锚)。
reg('components/germany/UranianDialMain.js', ['germany.school'], 'state.school');
reg('components/geomancy/GeomancyMain.js', ['readingScope', 'zodiacSystem', 'housePlacement', 'quesitedHouse', 'turnTo']);
// 灵棋经:六家注键为模板拼键 g[`zhu_${k}`](lingqiSnapshot:143),anchor 用前缀串。
reg('components/lingqi/lingqiSnapshot.js', ['zhu_yan', 'zhu_he', 'zhu_chen', 'zhu_liu', 'zhu_ke', 'zhu_shi'], 'zhu_');
reg('components/lingqi/lingqiSnapshot.js', ['category']);

const remoteFileCache = {};
function remoteSrc(file){
	if(!remoteFileCache[file]){
		remoteFileCache[file] = fs.readFileSync(path.join(UI_ROOT, file), 'utf8');
	}
	return remoteFileCache[file];
}

describe('[V6-W3 闸1] 全技法齿轮消费闸(新增齿轮忘接组装点即红)', ()=>{
	it('🔴 每个齿轮名必须命中:组装文件字面/前缀拼键锚/登记的异地消费文件', ()=>{
		const missing = [];
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((key)=>{
			const schema = TECHNIQUE_SETTINGS_SCHEMA[key];
			if(!schema || schema.kind === 'sectionsOnly' || !Array.isArray(schema.fields)){
				return;
			}
			schema.fields.forEach((field)=>{
				const name = field.name;
				// 层③优先:登记键(复合键先于裸名)必须过异地真 grep,绝不被层①的
				// 「注释/子串也算命中」弱判据保送(guirenFa 病史注释保送实锤)。
				const remote = REMOTE_CONSUMPTION[`${key}.${name}`] || REMOTE_CONSUMPTION[name];
				if(remote){
					if(remoteSrc(remote.file).indexOf(remote.anchor) >= 0){
						return;   // 层③:异地消费文件真 grep 命中
					}
					missing.push(`${key}.${name}(登记的异地文件 ${remote.file} 不见锚「${remote.anchor}」——登记造假或消费点被移走)`);
					return;
				}
				const pa = PREFIX_ANCHORS.find((p)=>name.indexOf(p.prefix) === 0);
				if(pa){
					if(CTX_SRC.indexOf(pa.anchor) >= 0){
						return;   // 层②:拼键消费锚在位
					}
					missing.push(`${key}.${name}(前缀拼键锚「${pa.anchor}」已从组装文件消失——消费结构被改,同步更新锚或接回)`);
					return;
				}
				if(CTX_SRC.indexOf(name) >= 0){
					return;   // 层①:组装链(手抄白名单/构参/整包透传)字面可见 —— 未登记键的兜底弱判据
				}
				missing.push(`${key}.${name}`);
			});
		});
		expect(missing.length
			? `齿轮在挂载组装链零出现(死开关候选——接进组装点,或经人工核实后登记 REMOTE_CONSUMPTION):\n${missing.join('\n')}`
			: 'ok').toBe('ok');
	});

	it('🔴 六爻白名单必须 schema 驱动(手抄清单禁复辟——guirenFa 类漏抄的病根)', ()=>{
		expect(CTX_SRC).toContain("getTechniqueSettingsSchema('sixyao')");
		// 手抄 direct 数组复辟哨兵:mergeLiuyaoGearSettings 函数体内不得再出现整段手抄键清单。
		const fnBody = CTX_SRC.slice(CTX_SRC.indexOf('function mergeLiuyaoGearSettings'), CTX_SRC.indexOf('function mergeLiuyaoGearSettings') + 2400);
		expect(/const direct = \['school'/.test(fnBody)).toBe(false);
	});
});

describe('[V6-W3 闸3] fieldParams ≡ fieldsToParams 逐键对拍(手抄副本漂移即红)', ()=>{
	// 有意差异豁免表(登记理由;新漂移必须进表或修齐)。
	const AI_ONLY = new Set([
		// AI 挂载主限恒开固定档(技法页由 direction 子 tab 交互态另行组装,不在 fieldsToParams 主体):
		'pdDirect', 'pdConverse', 'pdAntiscia', 'pdTerms', 'pdYears',
	]);
	const PAGE_ONLY = new Set([
		// (空)技法页主构参的每个键 AI 链都必须带 —— 新出现的缺键先修齐,确因无意义才登此表带理由。
	]);

	function extractKeys(src, fnAnchor){
		const start = src.indexOf(fnAnchor);
		expect(start).toBeGreaterThan(-1);
		// 取函数体到首个顶层 `\n}`:抽 `key:` 与 `?{ key: ... }` 条件透传两形态的**下发键名**。
		const body = src.slice(start, src.indexOf('\n}', start));
		// 负向自检:两正则抓不到的形态一旦在函数体出现(反序三元 `? {} : {key}`、条件多键
		// `? { a:…, b:… }` 的第二键),先在这里红,提醒扩正则 —— 否则两侧同写时 diff 抵消静默漏抓。
		expect(body).not.toMatch(/\?\s*\{\s*\}\s*:\s*\{/);
		expect(body).not.toMatch(/\?\s*\{[^{}]*,\s*[A-Za-z0-9_]+:/);
		const keys = new Set();
		[...body.matchAll(/^\t+([A-Za-z0-9_]+):\s/gm)].forEach((m)=>keys.add(m[1]));
		[...body.matchAll(/\?\s*\{\s*([A-Za-z0-9_]+):/g)].forEach((m)=>keys.add(m[1]));
		return keys;
	}

	it('🔴 AI 链构参键集与技法页构参键集对拍(差集必须走成文豁免)', ()=>{
		const astroSrc = fs.readFileSync(path.join(UI_ROOT, 'models', 'astro.js'), 'utf8');
		// 锚必须是函数定义行(裸函数名首现在 :162 注释,曾致抓错函数体空转出假 diff)。
		const aiKeys = extractKeys(CTX_SRC, 'function fieldParams(fields){');
		const pageKeys = extractKeys(astroSrc, 'function fieldsToParams(fields){');
		const missingInAi = [...pageKeys].filter((k)=>!aiKeys.has(k) && !PAGE_ONLY.has(k)).sort();
		const extraInAi = [...aiKeys].filter((k)=>!pageKeys.has(k) && !AI_ONLY.has(k) && k !== 'cid').sort();
		expect(missingInAi.length ? `技法页有而 AI 链缺(挂载重算与技法页口径分叉;修齐或登记 PAGE_ONLY 带理由):\n${missingInAi.join('\n')}` : 'ok').toBe('ok');
		expect(extraInAi.length ? `AI 链有而技法页缺(反向漂移;修齐或登记 AI_ONLY 带理由):\n${extraInAi.join('\n')}` : 'ok').toBe('ok');
		// 对拍闸自体健康:两侧键集非空且体量正常(锚失效/正则失配时这里先红,不给假绿机会)。
		expect(aiKeys.size).toBeGreaterThan(30);
		expect(pageKeys.size).toBeGreaterThan(30);
	});
});

describe('[V6-W3 闸4] kind ↔ 分派路径一致性(登错一处=齿轮静默蒸发)', ()=>{
	// kind='payload' 但走 A 路(record):历史遗留双例(cetian/huangji),靠 regenerate case 手抄
	// 回塞才活。例外单源=schema 上的 chartRoute 标记(复查轮把它落进 schema:基线锚也按此分叉,
	// 手抄清单与 schema 双账必漂),此处只验「chartRoute 标记 ⟺ 实际走 A 路」互为充要。
	it('🔴 record 类必须全部在 ANALYSIS_CHART_TECHNIQUES;payload 类走 A 路必须带 schema.chartRoute 标记', ()=>{
		const m = CTX_SRC.match(/ANALYSIS_CHART_TECHNIQUES = \[([\s\S]*?)\];/);
		expect(m).toBeTruthy();
		const chartSet = new Set([...m[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map((x)=>x[1]));
		const bad = [];
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((key)=>{
			const schema = TECHNIQUE_SETTINGS_SCHEMA[key];
			if(!schema){
				return;
			}
			if(schema.kind === 'record' && !chartSet.has(key)){
				bad.push(`${key}: kind=record 但不在 ANALYSIS_CHART_TECHNIQUES → 会落 B 路被 mergeOptionsIntoPayload 的 kind 闸吞掉(齿轮静默蒸发)`);
			}
			if(schema.kind === 'payload' && chartSet.has(key) && !schema.chartRoute){
				bad.push(`${key}: kind=payload 却走 A 路且无 chartRoute 标记 → merge 永不执行且基线锚会错读 payload 段,需 regenerate case 手抄回塞并在 schema 标 chartRoute:true`);
			}
			if(schema.kind === 'payload' && !chartSet.has(key) && schema.chartRoute){
				bad.push(`${key}: 标了 chartRoute 却不在 ANALYSIS_CHART_TECHNIQUES → 标记撒谎(基线锚被错误切到 record 平铺)`);
			}
		});
		expect(bad.length ? `分派口径错位:\n${bad.join('\n')}` : 'ok').toBe('ok');
	});
});

// 🔴 闸6:A 类基线锚全局可变现值(Win Issue#76 根修契约,2026-08-29)。
// 病理:紫微 builder 缺省回退全局单例 ZWEngineOptions,而 A 类基线曾锚裸 schema 默认——
// 左栏(写单例)开了「紫云太岁入卦」后,挂载设置拨「关」恰等 schema 默认被 prune 剪空
// → 走 live 快照(读单例=开)→ 挂载开关/地支输入均不生效、且左栏残留跨盘影响一切挂载文本。
// 修法=schema 逐键补 globalCurrent(读同一单例,与 builder 回退口径 by construction 恒等)。
describe('[闸6] A 类基线=全局单例现值(Issue#76)', ()=>{
	const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
	const { ZWSchool } = require('../../constants/ZWConst');
	const { effectiveMountBaseline, pruneOptionsToNonDefault } = require('../techniqueMountSettings');

	it('🔴 判别时刻:全局开太岁入卦→挂载拨0=真覆盖;全局默认→拨0=剪空(零回归)', ()=>{
		const prev = ZWEngineOptions.taiSuiRuGua;
		try{
			ZWEngineOptions.taiSuiRuGua = true;	// 模拟左栏开过(单例=真值源)
			const base = effectiveMountBaseline('ziwei', {});
			expect(base.taiSuiRuGua).toBe(1);	// boolean→0/1 归一(prune 字符串比较域)
			const opts = pruneOptionsToNonDefault('ziwei', { taiSuiRuGua: 0 }, base);
			expect(opts.taiSuiRuGua).toBe(0);	// 关得掉=进 regen 覆盖
			ZWEngineOptions.taiSuiRuGua = false;
			const base2 = effectiveMountBaseline('ziwei', {});
			const opts2 = pruneOptionsToNonDefault('ziwei', { taiSuiRuGua: 0 }, base2);
			expect(opts2.taiSuiRuGua).toBe(undefined);	// 默认拨默认仍剪空=默认路径零变
		}finally{
			ZWEngineOptions.taiSuiRuGua = prev;
		}
	});

	it('🔴 taiSuiRelatives 对象数组判别力(曾 `${x}`=[object Object] 同长列表零判别)', ()=>{
		const prev = ZWEngineOptions.taiSuiRelatives;
		try{
			ZWEngineOptions.taiSuiRelatives = [{ branch: '午', role: '母', sex: 'female' }];
			const base = effectiveMountBaseline('ziwei', {});
			// 同长不同支的关系人必须判「不同」→ override 透传
			const opts = pruneOptionsToNonDefault('ziwei', { taiSuiRelatives: '子:兄' }, base);
			expect(Array.isArray(opts.taiSuiRelatives)).toBe(true);
			expect(opts.taiSuiRelatives[0].branch).toBe('子');
			// 逐字段相同(text 归一后)则剪空
			const opts2 = pruneOptionsToNonDefault('ziwei', { taiSuiRelatives: '午:母:female' }, base);
			expect(opts2.taiSuiRelatives).toBe(undefined);
		}finally{
			ZWEngineOptions.taiSuiRelatives = prev;
		}
	});

	it('🔴 机械防漏:ziwei schema 凡单例同名键必带 globalCurrent 且返回值联动单例', ()=>{
		const schema = TECHNIQUE_SETTINGS_SCHEMA.ziwei;
		const MAPPED = { sihuaSchool: 'school@ZWSchool', ziweiXiaoxianYinyang: 'xiaoxianMode' };
		const bad = [];
		schema.fields.forEach((f)=>{
			const engineKey = MAPPED[f.name] === 'school@ZWSchool' ? null : (MAPPED[f.name] || f.name);
			const inEngine = engineKey ? Object.prototype.hasOwnProperty.call(ZWEngineOptions, engineKey) : (f.name === 'sihuaSchool');
			if(!inEngine){
				return;	// 非单例回退键(时间字段/运限选层/自定义表等)不要求——反向差在下一测兜改名滑出
			}
			if(typeof f.globalCurrent !== 'function'){
				bad.push(`${f.name}: builder 回退全局单例但 schema 无 globalCurrent(基线退化裸默认=Issue#76 回潮)`);
				return;
			}
			// 联动自证:拨动单例,globalCurrent 返回值必须跟着变(防写死常量的假 globalCurrent)
			if(f.name === 'sihuaSchool'){
				const prev = ZWSchool.school;
				try{
					ZWSchool.school = 'zhongzhou';
					if(f.globalCurrent() !== 'zhongzhou'){ bad.push(`${f.name}: globalCurrent 不联动 ZWSchool`); }
				}finally{ ZWSchool.school = prev; }
			}else{
				const prev = ZWEngineOptions[engineKey];
				try{
					const probe = typeof prev === 'boolean' ? !prev : (typeof prev === 'number' ? prev + 1 : `${prev}_probe`);
					ZWEngineOptions[engineKey] = probe;
					const got = f.globalCurrent();
					const want = typeof probe === 'boolean' ? (probe ? 1 : 0) : probe;
					if(`${got}` !== `${want}`){ bad.push(`${f.name}: globalCurrent(${got}) 不联动单例(${want})`); }
				}finally{ ZWEngineOptions[engineKey] = prev; }
			}
		});
		expect(bad.length ? bad.join('\n') : 'ok').toBe('ok');
	});
});

// 🔴 闸7:regen 调用点透传完备(canping.dayunRule 实抓型,2026-08-29)。
// 病型:builder 支持某 opts 键(schema 也暴露齿轮),但 regenerateChartTechniqueSnapshot 的
// case 分支手写字面 opts 时漏传该键 → 齿轮拨了 override 也进不了 builder=死开关。
// 闸1 抓不到:builder 与调用点同在 aiAnalysisContext.js,字面出现即保送(同文件盲区)。
// 判据(零登记,纯源码抽取):对每个 A 类技法的 case 块,块内 `record.<field>` 引用集∪
// 整包透传标记(buildChartXxxParams(record)/ForRecord(record) 无 opts/buildFieldObject(record))
// 必须覆盖 schema 全部非时间齿轮字段;不覆盖=疑漏传红(豁免须落 EXEMPT 并写理由)。
describe('[闸7] regen case 块 record.* 引用覆盖 schema 齿轮字段', ()=>{
	const TIME_FIELD_NAMES = new Set(['timeAlg', 'dayBoundary', 'after23NewDay', 'lateZiHourUseNextDay', 'date', 'time', 'zone', 'lon', 'lat', 'gpsLon', 'gpsLat', 'ad', 'gender', 'pos']);
	// 豁免:键确实不经 case 块字面透传(整包构参函数内部读/另一文件消费),登记时人工核实过。
	const EXEMPT = {
		// buildChartZiweiParams/buildChartBaziParams 整包构参(闸1+构参函数自身白名单覆盖)
		// heluo 7 键:buildHeluoSnapshotForRecord(aiAnalysisContext ~2027-2033)**直读 record.***
		// 组 heluoOpts,不经 case 块字面 opts——2026-08-29 逐键人工核实消费链在位(闸7 判据只扫
		// case 块,builder 体内引用属合法第三形;新键若走此形须同来登记)。
		'heluo.ziShuMode': 'builder 直读 record(2027)',
		'heluo.jiGongMode': 'builder 直读 record(2028)',
		'heluo.zhiZunEnabled': 'builder 直读 record(2029)',
		'heluo.pureGanKunVariant': 'builder 直读 record(2030)',
		'heluo.liunianStep2': 'builder 直读 record(2031)',
		'heluo.liuYueMode': 'builder 直读 record(2032)',
		'heluo.huangdiOffset': 'builder 直读 record(2033)',
	};
	it('🔴 逐技法 case 块透传完备(canping.dayunRule 曾漏=此处红)', ()=>{
		const m = CTX_SRC.match(/export async function regenerateChartTechniqueSnapshot[\s\S]*?\n\}\n/);
		expect(m ? 'found' : 'regen 函数未定位').toBe('found');
		const body = m[0];
		// case 块切分:case 'key': ... 到下一个 case/default
		const caseRe = /case '([a-z0-9_]+)':/g;
		const marks = [];
		let mm;
		while((mm = caseRe.exec(body))){ marks.push({ key: mm[1], idx: mm.index }); }
		const blocks = {};
		marks.forEach((mk, i)=>{
			// 落穿链(case A: case B: 共块):向后并块直到出现实代码(非空白/注释)——
			// 否则落穿前段切出空块,共享体键全部误报漏传(首跑实抓 profection/solararc 族)。
			let end = i + 1 < marks.length ? marks[i + 1].idx : body.length;
			let j = i + 1;
			const isEmpty = (txt)=>!txt.replace(/case '[a-z0-9_]+':|\/\/[^\n]*|\s/g, '');
			while(j < marks.length && isEmpty(body.slice(mk.idx, end))){
				j += 1;
				end = j < marks.length ? marks[j].idx : body.length;
			}
			blocks[mk.key] = body.slice(mk.idx, end);
		});
		const bad = [];
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((key)=>{
			const schema = TECHNIQUE_SETTINGS_SCHEMA[key];
			if(!schema || schema.kind !== 'record' || !Array.isArray(schema.fields)){ return; }
			const block = blocks[key];
			if(!block){ return; }	// 不在 regen switch(astrochart 族等另有入口)——闸4 管分派
			// 整包透传标记:构参函数(record)/ForRecord(record) 无 opts/buildFieldObject(record)/mergeOptionsIntoRecord
			const wholesale = /buildChart\w+Params\(record\)|ForRecord\(record\)[^,]|buildFieldObject\(record\)/.test(block);
			if(wholesale){ return; }
			const used = new Set();
			// [复审 F17①] 剥注释行再抽引用:一行「// record.foo 已在别处」曾可保送
			const codeOnly = block.split('\n').filter((ln)=>!/^\s*\/\//.test(ln)).join('\n');
			const useRe = /record\.([A-Za-z0-9_]+)/g;
			let um;
			while((um = useRe.exec(codeOnly))){ used.add(um[1]); }
			schema.fields.forEach((f)=>{
				if(TIME_FIELD_NAMES.has(f.name)){ return; }
				if(EXEMPT[`${key}.${f.name}`]){
					// [复审 F17④] 豁免反向自证:登记「builder 直读 record」的键必须真在
					// aiAnalysisContext.js 出现 record.<field> 引用(防登记造假,REMOTE_CONSUMPTION 同律)
					if(!new RegExp(`record\\.${f.name}\\b`).test(CTX_SRC)){
						bad.push(`${key}.${f.name}: EXEMPT 登记为 builder 直读,但全文件无 record.${f.name} 引用(登记造假)`);
					}
					return;
				}
				if(!used.has(f.name)){
					bad.push(`${key}.${f.name}: schema 暴露齿轮但 regen case 块无 record.${f.name} 引用(疑调用点漏传=死开关;真豁免须登记 EXEMPT+理由)`);
				}
			});
		});
		expect(bad.length ? bad.join('\n') : 'ok').toBe('ok');
	});

	it('🔴 反向差:ZWEngineOptions 每个键必须被 schema globalCurrent 键集覆盖(复审 F16:改名滑出防线)', ()=>{
		const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
		// fail-open 补丁:上一测按 schema→单例方向查,schema 键改名后查不到单例=静默豁免。
		// 此测反向:单例每个键(显式豁免除外)必须 ∈ schema 带 globalCurrent 的字段名∪MAPPED 值。
		const schema = TECHNIQUE_SETTINGS_SCHEMA.ziwei;
		const covered = new Set();
		schema.fields.forEach((f)=>{
			if(typeof f.globalCurrent !== 'function'){ return; }
			covered.add(f.name === 'ziweiXiaoxianYinyang' ? 'xiaoxianMode' : f.name);
		});
		// 显式豁免(挂载 schema 不暴露的引擎内部键;新增须人工核实后登记+理由)
		const EXEMPT_ENGINE = new Set([
			'taiSuiRelatives',	// schema 有(text 型)且带 globalCurrent——在 covered
		]);
		const bad = [];
		Object.keys(ZWEngineOptions).forEach((k)=>{
			if(covered.has(k) || EXEMPT_ENGINE.has(k)){ return; }
			bad.push(`ZWEngineOptions.${k}: 单例键不被 schema globalCurrent 覆盖(改名滑出或漏暴露=Issue#76 无红灯回潮)`);
		});
		expect(bad.length ? bad.join('\n') : 'ok').toBe('ok');
	});
});

// [闸6 扩展] 基线锚审计五病防回潮(2026-08-29 全技法审计:私有页.school/egypt 七轴/
// planetaryarc.asporb 镜像型/suzhan.houseStartMode/日界族)——globalCurrent 存在+联动。
describe('[闸6b] 审计五病 globalCurrent 在位且联动', ()=>{
	const get = (tech, name)=>{
		const schema = TECHNIQUE_SETTINGS_SCHEMA[tech];
		return schema && schema.fields.find((f)=>f.name === name);
	};
	it('astrochart egypt_* 七轴全带 globalCurrent;suzhan 已滤死齿轮', ()=>{
		const astro = TECHNIQUE_SETTINGS_SCHEMA.astrochart.fields.filter((f)=>f.name.startsWith('egypt_'));
		expect(astro.length).toBeGreaterThanOrEqual(7);
		astro.forEach((f)=>{ expect(typeof f.globalCurrent).toBe('function'); });
		const su = TECHNIQUE_SETTINGS_SCHEMA.suzhan.fields.filter((f)=>f.name.startsWith('egypt_'));
		expect(su.length).toBe(0);	// buildSuzhanSnapshotText 不产埃及段=死齿轮,已滤
	});
	it('日界族两键 globalCurrent 实时(载入期 default 冻结病)', ()=>{
		const f = get('bazi', 'after23NewDay');
		const g = get('bazi', 'lateZiHourUseNextDay');
		expect(typeof f.globalCurrent).toBe('function');
		expect(typeof g.globalCurrent).toBe('function');
	});
	it('suzhan.houseStartMode globalCurrent 读 localStorage 同源', ()=>{
		const f = get('suzhan', 'houseStartMode');
		expect(typeof f.globalCurrent).toBe('function');
		try{
			localStorage.setItem('suzhanHouseStartMode', '1');
			expect(f.globalCurrent()).toBe(1);
			localStorage.setItem('suzhanHouseStartMode', '0');
			expect(f.globalCurrent()).toBe(0);
		}finally{
			localStorage.removeItem('suzhanHouseStartMode');
		}
	});
	it('planetaryarc 无头 builder asporb 回退 transitOrbDefault(镜像型:builder 侧锚)', ()=>{
		const fs2 = require('fs');
		const path2 = require('path');
		const src = fs2.readFileSync(path2.join(__dirname, '../../components/astro/AstroPlanetaryArc.js'), 'utf8');
		expect(src.includes('? Number(o.asporb) : transitOrbDefault()')).toBe(true);
	});
});
