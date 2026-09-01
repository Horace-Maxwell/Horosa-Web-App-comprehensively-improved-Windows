// [Z0] 择日完备性闸哨兵(用户定案 12「能算出来的都可搜索」的机械化):
// 每个择日技法的 AI 快照段表逐段必须在 ZERI_COVERAGE_MAP 表态(types/allTypes/exempt 三选一)。
// 判据:①登记段集 ≡ AI_EXPORT_PRESET_SECTIONS[技法] 双向差空 —— **主技法新增快照段时
// 择日侧被强制表态,否则此处机械红**(「原技法演进→择日强制跟上」完备性层);
// ②types 键必须真实存在于该技法条件注册表(防登记造假);③exempt 理由 ≥6 字;④注错自证。
import { AI_EXPORT_PRESET_SECTIONS } from '../../../utils/aiExport';
import { ZERI_COVERAGE_MAP } from '../zeriCoverageMap';
import { CONDITION_TYPES } from '../conditionTypes';
import { QIMEN_CONDITION_TYPES } from '../qimenConditionTypes';
import { HUANGLI_CONDITION_TYPES } from '../huangliZeriConditionTypes';
import { BAZI_CONDITION_TYPES } from '../baziZeriConditionTypes';
import { TAIYI_CONDITION_TYPES } from '../taiyiZeriConditionTypes';
import { ZIWEI_CONDITION_TYPES } from '../ziweiZeriConditionTypes';
import { LIURENG_CONDITION_TYPES } from '../liurengZeriConditionTypes';
import { SANSHI_CONDITION_TYPES } from '../sanshiZeriConditionTypes';
import { QIZHENG_CONDITION_TYPES } from '../qizhengZeriConditionTypes';
import { INDIA_CONDITION_TYPES } from '../indiaZeriConditionTypes';

const REGISTRIES = {
	conditionTypes: CONDITION_TYPES,
	qimenConditionTypes: QIMEN_CONDITION_TYPES,
	huangliZeriConditionTypes: HUANGLI_CONDITION_TYPES,
	baziZeriConditionTypes: BAZI_CONDITION_TYPES,
	taiyiZeriConditionTypes: TAIYI_CONDITION_TYPES,
	ziweiZeriConditionTypes: ZIWEI_CONDITION_TYPES,
	liurengZeriConditionTypes: LIURENG_CONDITION_TYPES,
	sanshiZeriConditionTypes: SANSHI_CONDITION_TYPES,
	qizhengZeriConditionTypes: QIZHENG_CONDITION_TYPES,
	indiaZeriConditionTypes: INDIA_CONDITION_TYPES,
};

describe('[Z0] 择日完备性闸(段表↔条件类映射)', ()=>{
	const techKeys = Object.keys(ZERI_COVERAGE_MAP);

	it('登记技法非空且各自 preset 段表在位', ()=>{
		expect(techKeys.length).toBeGreaterThanOrEqual(2);
		techKeys.forEach((k)=>{
			expect(Array.isArray(AI_EXPORT_PRESET_SECTIONS[k])).toBe(true);
			expect(AI_EXPORT_PRESET_SECTIONS[k].length).toBeGreaterThan(0);
		});
	});

	it('🔴 逐技法:登记段集 ≡ preset 段集双向差空(主技法新增段未表态=红)', ()=>{
		techKeys.forEach((k)=>{
			const preset = AI_EXPORT_PRESET_SECTIONS[k];
			const registered = Object.keys(ZERI_COVERAGE_MAP[k].sections);
			const missing = preset.filter((s)=>!registered.includes(s));
			const stale = registered.filter((s)=>!preset.includes(s));
			expect(missing.length ? `${k}: 快照段未在完备性表表态(补 types 或 exempt):${missing.join('、')}` : 'ok').toBe('ok');
			expect(stale.length ? `${k}: 完备性表存在已消失的段(清理):${stale.join('、')}` : 'ok').toBe('ok');
		});
	});

	it('🔴 types 键必须真实存在于该技法条件注册表(防登记造假);exempt 理由 ≥6 字;三选一恰一', ()=>{
		techKeys.forEach((k)=>{
			const { registry, sections } = ZERI_COVERAGE_MAP[k];
			const reg = REGISTRIES[registry];
			expect(reg && typeof reg === 'object').toBe(true);
			Object.keys(sections).forEach((sec)=>{
				const ent = sections[sec];
				const modes = ['types', 'allTypes', 'exempt'].filter((m)=>ent[m] !== undefined);
				expect(modes.length === 1 ? 'ok' : `${k}/${sec}: 须恰一种表态(现 ${modes.join('+') || '零'})`).toBe('ok');
				if(ent.types){
					expect(Array.isArray(ent.types) && ent.types.length > 0).toBe(true);
					const bad = ent.types.filter((t)=>!reg[t]);
					expect(bad.length ? `${k}/${sec}: 登记了不存在的条件类:${bad.join('、')}` : 'ok').toBe('ok');
				}
				if(ent.exempt !== undefined){
					expect(`${ent.exempt}`.length >= 6 ? 'ok' : `${k}/${sec}: 豁免理由过短`).toBe('ok');
				}
			});
		});
	});

	it('注错自证:临时删一段登记必被双向差咬住(防比较器恒真)', ()=>{
		const k = techKeys[0];
		const preset = AI_EXPORT_PRESET_SECTIONS[k];
		const mutated = Object.keys(ZERI_COVERAGE_MAP[k].sections).slice(1);	// 删第一段
		const missing = preset.filter((s)=>!mutated.includes(s));
		expect(missing.length).toBeGreaterThan(0);
	});
});

// [2026-08-29 审查实抓防回潮] 工作台 draftType 初值必须是本注册表键:四个工作台曾抄
// 上一技法的键(紫微 ming_zhu_xing 进六壬/三式,太乙 geju_kind 进七政/印度)——首开
// 「条件类型」显示裸键名、参数表单空白、添加后 compile 抛「未知条件类型」拒扫。
describe('[防回潮] 工作台 draftType 初值∈本注册表', ()=>{
	const fs = require('fs');
	const path = require('path');
	const CASES = [
		['QimenZeriWorkbench.js', QIMEN_CONDITION_TYPES],
		['HuangliZeriWorkbench.js', HUANGLI_CONDITION_TYPES],
		['BaziZeriWorkbench.js', BAZI_CONDITION_TYPES],
		['TaiyiZeriWorkbench.js', TAIYI_CONDITION_TYPES],
		['ZiweiZeriWorkbench.js', ZIWEI_CONDITION_TYPES],
		['LiurengZeriWorkbench.js', LIURENG_CONDITION_TYPES],
		['SanshiZeriWorkbench.js', SANSHI_CONDITION_TYPES],
		['QizhengZeriWorkbench.js', QIZHENG_CONDITION_TYPES],
		['IndiaZeriWorkbench.js', INDIA_CONDITION_TYPES],
	];
	it('九工作台初值全部在各自注册表(外来键=首开即坏)', ()=>{
		CASES.forEach(([file, registry])=>{
			const src = fs.readFileSync(path.join(__dirname, '../../../components/zeri', file), 'utf8');
			const m = /const \[draftType, setDraftType\] = useState\('([a-z_0-9]+)'\)/.exec(src);
			expect(m ? 'found' : `${file}: 未找到 draftType 初值`).toBe('found');
			expect(registry[m[1]] ? 'ok' : `${file}: 初值 ${m[1]} 不在本注册表`).toBe('ok');
			// [复审 F3] draftParams 初值叶必须与 draftType 同键:曾修了 type 漏了 params
			// (newXxxLeaf(外来键).params={} → 首开 validate 红错+添加禁用,四台同病)
			const mp = /useState\(\(\) => new\w+Leaf\('([a-z_0-9]+)'\)\.params\)/.exec(src);
			if(mp){
				expect(mp[1] === m[1] ? 'ok' : `${file}: draftParams 初值键 ${mp[1]} ≠ draftType ${m[1]}`).toBe('ok');
			}
		});
	});
});

// [2026-08-29 用户实报双修防回潮] ①工作台 Modal X 在暗色下隐形(antd 默认近黑,用户
// 「无法返回」)——九台必须带 wrapClassName(app.less 作用域覆写 close 颜色);
// ②择日内嵌 IndiaChartMain 缺 planetDisplay props 曾回退「不过滤=全画」,盘面被
// 33 个西占 Pars 淹没——透传层必须兜 DEFAULT_OBJECTS。
describe('[防回潮] 工作台 X 可见性+印度盘对象兜底', ()=>{
	const fs = require('fs');
	const path = require('path');
	it('九工作台 Modal 全带 horosa-zeri-workbench-modal(X 颜色作用域)', ()=>{
		const files = ['Qimen', 'Huangli', 'Bazi', 'Taiyi', 'Ziwei', 'Liureng', 'Sanshi', 'Qizheng', 'India'];
		const bad = [];
		files.forEach((f)=>{
			const src = fs.readFileSync(path.join(__dirname, '../../../components/zeri', `${f}ZeriWorkbench.js`), 'utf8');
			if(!src.includes('wrapClassName="horosa-zeri-workbench-modal"')){
				bad.push(`${f}: 缺 wrapClassName(暗色下关闭钮回黑=用户困死回潮)`);
			}
		});
		const less = fs.readFileSync(path.join(__dirname, '../../../layouts/app.less'), 'utf8');
		if(!less.includes('.horosa-zeri-workbench-modal .ant-modal-close')){
			bad.push('app.less: 作用域 close 颜色规则被删');
		}
		expect(bad.length ? bad.join('\n') : 'ok').toBe('ok');
	});
	it('三式宿主底盘 props 名=chartObj(组件读 props.chartObj||props.chart;曾传 value= 六壬家断链:月将「—」+中宫四课区空骨架,用户截图实报)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../../components/zeri/SanshiZeriMain.js'), 'utf8');
		expect(src.includes('chartObj={this.state.chartValue}')).toBe(true);
		expect(/\n\s*value=\{this\.state\.chartValue\}/.test(src)).toBe(false);
	});

	it('IndiaChartMain 盘面 planetDisplay 透传兜 DEFAULT_OBJECTS(缺 props≠全画)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../../components/astro/IndiaChartMain.js'), 'utf8');
		const n = (src.match(/planetDisplay=\{this\.props\.planetDisplay \|\| AstroConst\.DEFAULT_OBJECTS\}/g) || []).length;
		expect(n >= 2 ? 'ok' : `兜底透传只剩 ${n} 处(应 2:分盘集+主盘)`).toBe('ok');
	});
});

// [2026-08-29 用户实报] 天星概览浮窗崩溃(函数组件里写类式 props 访问)+新八技法无预览。
// ①全仓函数组件体内禁 this.props/this.state(块分割静态扫描,与修复同日全仓已清零);
// ②七工作台 ZeriMiniPanPopup 接线完备(概览按钮+浮窗+宿主 previewCtx)。
describe('[防回潮] 函数组件 this.props 全仓零命中+八技法概览接线', ()=>{
	const fs = require('fs');
	const path = require('path');
	it('🔴 全仓函数组件体内无 this.props/this.state(天星浮窗崩溃型)', ()=>{
		const root = path.join(__dirname, '../../../..');	// 仓根(astrostudyui/)
		const bad = [];
		const walk = (dir)=>{
			fs.readdirSync(dir).forEach((f)=>{
				const p = path.join(dir, f);
				const st = fs.statSync(p);
				if(st.isDirectory()){
					if(f === '__tests__' || f === 'node_modules'){ return; }
					walk(p);
					return;
				}
				if(!f.endsWith('.js') || f.endsWith('.test.js')){ return; }
				const src = fs.readFileSync(p, 'utf8');
				if(src.indexOf('this.props') < 0 && src.indexOf('this.state') < 0){ return; }
				const lines = src.split('\n');
				const blocks = [];
				lines.forEach((ln, i)=>{
					if(/^(?:export (?:default )?)?function [A-Z]\w*\(/.test(ln)){ blocks.push([i, 'fn']); }
					else if(/^(?:export (?:default )?)?class \w+/.test(ln)){ blocks.push([i, 'class']); }
				});
				blocks.push([lines.length, 'eof']);
				for(let bi = 0; bi < blocks.length - 1; bi++){
					if(blocks[bi][1] !== 'fn'){ continue; }
					for(let j = blocks[bi][0]; j < blocks[bi + 1][0]; j++){
						const ln = lines[j];
						const s = ln.trim();
						if(s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')){ continue; }
						// 剥行内注释后再查(注释里提及不算)
						const code = ln.split('//')[0].replace(/\/\*[\s\S]*?\*\//g, '');
						if(/\bthis\.(props|state)\b/.test(code)){
							bad.push(`${path.relative(root, p)}:${j + 1}`);
						}
					}
				}
			});
		};
		walk(path.join(root, 'src'));
		expect(bad.length ? `函数组件体内类式访问(浮窗崩溃型):\n${bad.join('\n')}` : 'ok').toBe('ok');
	});
	it('结果表表头「盘」占位列九家齐(行内 7 列 vs 表头 6 列=两 flex 列压窄整行左移,用户实报错位)', ()=>{
		// 判别向量(建档自证):删掉任一家表头的「>盘</span>」占位 → 该家入 bad 判红。
		const nine = ['Bazi', 'Taiyi', 'Ziwei', 'Liureng', 'Sanshi', 'Qizheng', 'India', 'Qimen'];
		const bad = [];
		nine.forEach((f2)=>{
			const src = fs.readFileSync(path.join(__dirname, '../../../components/zeri', `${f2}ZeriWorkbench.js`), 'utf8');
			if(!(/textAlign: 'center' \}\}>详情<\/span>\s*\n\s*<span style=\{\{ width: \d+ \}\}>盘<\/span>/.test(src))){
				bad.push(`${f2}: 表头缺「盘」等宽占位列`);
			}
		});
		const tianxing = fs.readFileSync(path.join(__dirname, '../../../components/zeri/ConditionBuilderModal.js'), 'utf8');
		if(!(/textAlign: 'center' \}\}>详情<\/span>\s*\n\s*<span style=\{\{ width: \d+ \}\}>盘<\/span>/.test(tianxing))){
			bad.push('天星(ConditionBuilderModal): 表头缺「盘」等宽占位列');
		}
		expect(bad.length ? bad.join('\n') : 'ok').toBe('ok');
	});
	it('七工作台 ZeriMiniPanPopup 接线完备(概览按钮+浮窗渲染)', ()=>{
		const files = ['Bazi', 'Taiyi', 'Ziwei', 'Liureng', 'Sanshi', 'Qizheng', 'India'];
		const bad = [];
		files.forEach((f)=>{
			const src = fs.readFileSync(path.join(__dirname, '../../../components/zeri', `${f}ZeriWorkbench.js`), 'utf8');
			if(!src.includes("import ZeriMiniPanPopup")){ bad.push(`${f}: 缺 import`); }
			if(!src.includes('setPreviewRow(row)')){ bad.push(`${f}: 缺概览按钮`); }
			if(!src.includes('<ZeriMiniPanPopup')){ bad.push(`${f}: 缺浮窗渲染`); }
			// 概览地理冻结:浮窗 geo 必须优先吃扫描时地理(previewGeo),否则扫后改地点概览错盘
			if(!src.includes('geo={previewGeo || geo}')){ bad.push(`${f}: 浮窗未吃 previewGeo 冻结地理`); }
		});
		['Bazi', 'Taiyi', 'Ziwei', 'Liureng', 'Sanshi'].forEach((f)=>{
			const src = fs.readFileSync(path.join(__dirname, '../../../components/zeri', `${f}ZeriMain.js`), 'utf8');
			if(!src.includes('onPreviewPan=')){ bad.push(`${f}Main: 缺 onPreviewPan`); }
		});
		['Qizheng', 'India'].forEach((f)=>{
			const src = fs.readFileSync(path.join(__dirname, '../../../components/zeri', `${f}ZeriMain.js`), 'utf8');
			if(!src.includes('onPreviewExplain=')){ bad.push(`${f}Main: 缺 onPreviewExplain`); }
			if(!src.includes('previewGeo={')){ bad.push(`${f}Main: 缺 previewGeo 冻结地理透传`); }
		});
		expect(bad.length ? bad.join('\n') : 'ok').toBe('ok');
	});
	it('🔴 [W9] 帮助文档类数=注册表实数(十家;终结「纯自律」漂移——判别向量:注错数字必红)', ()=>{
		const help = fs.readFileSync(path.join(__dirname, '../../../components/help/ZeriHelpDoc.js'), 'utf8');
		const count = (file, re2)=>{
			const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
			return (src.match(re2) || []).length;
		};
		const CASES = [
			['conditionTypes.js', /^\t[a-z_0-9]+: \{/mg, /等 (\d+) 类/],
			['huangliZeriConditionTypes.js', /^\t[a-z_0-9]+: \{/mg, /五组 (\d+) 类:用事/],
			['baziZeriConditionTypes.js', /^\t[a-z_0-9]+: \{/mg, /六组 (\d+) 类:四柱/],
			['taiyiZeriConditionTypes.js', /^\t[a-z_0-9]+: \{/mg, /七组 (\d+) 类:局式/],
			['ziweiZeriConditionTypes.js', /^\t[a-z_0-9]+: \{/mg, /九组 (\d+) 类:局式/],
			['liurengZeriConditionTypes.js', /^\t[a-z_0-9]+: \{/mg, /八组 (\d+) 类:课体/],
			['qizhengZeriConditionTypes.js', /^\t[a-z_0-9]+: \{/mg, /九组 (\d+) 类:落宫/],
			['indiaZeriConditionTypes.js', /^\t[a-z_0-9]+: \{/mg, /五组 (\d+) 类:五肢/],
		];
		CASES.forEach(([file, keyRe, helpRe])=>{
			const real = count(file, keyRe);
			const m = help.match(helpRe);
			expect({ file, 帮助有数字: !!m }).toEqual({ file, 帮助有数字: true });
			expect({ file, 帮助数: Number(m[1]) }).toEqual({ file, 帮助数: real });
		});
		// 三式=三家程序化合并(27+19+24=70)
		const lr = count('liurengZeriConditionTypes.js', /^\t[a-z_0-9]+: \{/mg);
		const qm = count('qimenConditionTypes.js', /^\t[a-z_]+: \{/mg);
		const ty = count('taiyiZeriConditionTypes.js', /^\t[a-z_0-9]+: \{/mg);
		const m70 = help.match(/三家 (\d+) 类全量混排/);
		expect(Number(m70 && m70[1])).toBe(lr + qm + ty);
	});

});

describe('[十一轮] keyDeps 声明完备闸(掩码家全类必显式声明;值域越界=红)', ()=>{
	const LR_BITS = ['diurnal', 'yearZhi', 'monthZhi', 'candY'];
	const QM_BITS = ['yearGz', 'monthGz', 'dayGz', 'timeGz', 'diurnal'];
	it('六壬 27 类:keyDeps 必为数组且 ⊆ 四可掩位', ()=>{
		Object.keys(LIURENG_CONDITION_TYPES).forEach((k)=>{
			const d = LIURENG_CONDITION_TYPES[k].keyDeps;
			expect({ k, isArr: Array.isArray(d) }).toEqual({ k, isArr: true });
			d.forEach((b)=>{ expect({ k, b, ok: LR_BITS.indexOf(b) >= 0 }).toEqual({ k, b, ok: true }); });
		});
	});
	it('[十四轮] 八字 26 类:keyDeps 数组或函数,产物 ⊆ 四柱位', ()=>{
		const BITS = ['yearGz', 'monthGz', 'dayGz', 'timeGz'];
		const { BAZI_CONDITION_TYPES } = require('../baziZeriConditionTypes');
		Object.keys(BAZI_CONDITION_TYPES).forEach((k)=>{
			const spec = BAZI_CONDITION_TYPES[k];
			const d = spec.keyDeps;
			expect({ k, okShape: Array.isArray(d) || typeof d === 'function' }).toEqual({ k, okShape: true });
			const arr = typeof d === 'function' ? d(spec.defaults || {}) : d;
			expect({ k, isArr: Array.isArray(arr) }).toEqual({ k, isArr: true });
			arr.forEach((b)=>{ expect({ k, b, ok: BITS.indexOf(b) >= 0 }).toEqual({ k, b, ok: true }); });
		});
	});
	it('[十四轮] 紫微 28 类:keyDeps 必为数组 ⊆ 安星六位', ()=>{
		const BITS = ['yearGan', 'yearZi', 'anchorM', 'anchorLeap', 'anchorD', 'timeZi'];
		const { ZIWEI_CONDITION_TYPES } = require('../ziweiZeriConditionTypes');
		Object.keys(ZIWEI_CONDITION_TYPES).forEach((k)=>{
			const d = ZIWEI_CONDITION_TYPES[k].keyDeps;
			expect({ k, isArr: Array.isArray(d) }).toEqual({ k, isArr: true });
			d.forEach((b)=>{ expect({ k, b, ok: BITS.indexOf(b) >= 0 }).toEqual({ k, b, ok: true }); });
		});
	});
	it('奇门 19 类:keyDeps 必为数组或函数;数组/函数产物 ⊆ 五可掩位', ()=>{
		Object.keys(QIMEN_CONDITION_TYPES).forEach((k)=>{
			const spec = QIMEN_CONDITION_TYPES[k];
			const d = spec.keyDeps;
			const okShape = Array.isArray(d) || typeof d === 'function';
			expect({ k, okShape }).toEqual({ k, okShape: true });
			const arr = typeof d === 'function' ? d(spec.defaults || {}) : d;
			expect({ k, isArr: Array.isArray(arr) }).toEqual({ k, isArr: true });
			arr.forEach((b)=>{ expect({ k, b, ok: QM_BITS.indexOf(b) >= 0 }).toEqual({ k, b, ok: true }); });
		});
	});
});
