// 「默认检索策略」(组合的 defaultRetrievalMode)不得再变成死开关。
//
// 🔴 病理:该控件三档(自动/全文优先/检索优先)存进组合、也在组合预览里显示,
//    但检索链从不读它 —— applyBundle 没有对应分支,retrieveMaterialContext 纯按
//    资料长度用 shouldUseDirectAttach 判定。用户选「全文优先/检索优先」零变化。
//    这类"存了、显示了、却没人消费"的开关,用形状测试与渲染测试都照不出来。
//
// 护栏做成双判据:
//   ① 契约层 —— shouldUseDirectAttach 必须真的按 mode 改判(纯函数,可精确断言);
//   ② 消费链层 —— 源码里 retrieveMaterialContext 必须把 mode 传进 shouldUseDirectAttach,
//      且调用点必须从组合里取出 defaultRetrievalMode。任何一环被摘掉即红。
import fs from 'fs';
import path from 'path';
import { shouldUseDirectAttach } from '../aiAnalysisRag';

const SRC_ROOT = path.join(__dirname, '..', '..');
const MAIN = fs.readFileSync(path.join(SRC_ROOT, 'components', 'aianalysis', 'AIAnalysisMain.js'), 'utf8');
const RAG = fs.readFileSync(path.join(SRC_ROOT, 'utils', 'aiAnalysisRag.js'), 'utf8');

const SHORT = { extractedText: 'x'.repeat(100) };			// 远低于阈值 → auto 下直挂
const LONG = { extractedText: 'x'.repeat(50000) };			// 远高于阈值 → auto 下走检索

describe('🔴 默认检索策略 · 契约层(三档必须真的改判)', ()=>{
	it("auto / 缺省 = 原长度规则(零回归):短资料直挂、长资料走检索", ()=>{
		expect(shouldUseDirectAttach(SHORT)).toBe(true);
		expect(shouldUseDirectAttach(LONG)).toBe(false);
		expect(shouldUseDirectAttach(SHORT, 'auto')).toBe(true);
		expect(shouldUseDirectAttach(LONG, 'auto')).toBe(false);
		// 未知/非法档位也退回长度规则,不改变现状
		expect(shouldUseDirectAttach(LONG, 'nonsense')).toBe(false);
		expect(shouldUseDirectAttach(SHORT, null)).toBe(true);
	});

	it("fulltext = 强制整篇直挂,长资料也不再走检索", ()=>{
		expect(shouldUseDirectAttach(LONG, 'fulltext')).toBe(true);
		expect(shouldUseDirectAttach(SHORT, 'fulltext')).toBe(true);
	});

	it("rag = 强制分块检索,短资料也不再直挂", ()=>{
		expect(shouldUseDirectAttach(SHORT, 'rag')).toBe(false);
		expect(shouldUseDirectAttach(LONG, 'rag')).toBe(false);
	});

	it('三档确实两两不同(至少存在一个输入把它们区分开)', ()=>{
		const probe = (m)=>[shouldUseDirectAttach(SHORT, m), shouldUseDirectAttach(LONG, m)].join(',');
		const auto = probe('auto');
		const full = probe('fulltext');
		const rag = probe('rag');
		expect(new Set([auto, full, rag]).size).toBe(3);	// 红=某两档行为塌成一样,又成半死开关
	});

	it('边界:恰好等于阈值仍算直挂(auto),且 fulltext/rag 不受阈值影响', ()=>{
		const AT = { extractedText: 'x'.repeat(12000) };
		const OVER = { extractedText: 'x'.repeat(12001) };
		expect(shouldUseDirectAttach(AT)).toBe(true);
		expect(shouldUseDirectAttach(OVER)).toBe(false);
		expect(shouldUseDirectAttach(OVER, 'fulltext')).toBe(true);
		expect(shouldUseDirectAttach(AT, 'rag')).toBe(false);
	});

	it('空/缺字段资料不抛(与原行为一致:空文本算直挂)', ()=>{
		[undefined, null, {}, { extractedText: '' }, { extractedText: null }].forEach((m)=>{
			expect(()=>shouldUseDirectAttach(m, 'auto')).not.toThrow();
			expect(shouldUseDirectAttach(m)).toBe(true);
		});
	});
});

describe('🔴 默认检索策略 · 消费链层(源码级,防被静默摘线)', ()=>{
	it('shouldUseDirectAttach 的实现里有 fulltext / rag 两个分支', ()=>{
		expect(RAG).toMatch(/retrievalMode\s*===\s*'fulltext'/);
		expect(RAG).toMatch(/retrievalMode\s*===\s*'rag'/);
	});

	it('retrieveMaterialContext 收 mode 形参,并把它传给分拣单源', ()=>{
		const fn = MAIN.slice(MAIN.indexOf('async function retrieveMaterialContext'));
		const body = fn.slice(0, 900);
		expect(body).toContain('retrieveMaterialContext(query, resolvedRefs, embeddingTarget, retrievalMode)');
		// [B1] 分拣收编进 partitionMaterialsByRetrieval 单源(内部调 shouldUseDirectAttach,
		// 契约层已断三档改判)。判据换锚同一意图:mode 必须作为第二实参传入单源,红=收了没往下传。
		expect(body).toMatch(/partitionMaterialsByRetrieval\([^,]+,\s*retrievalMode\)/);
	});

	it('调用点从挂载的组合取 defaultRetrievalMode 并传入(不是硬写 undefined)', ()=>{
		expect(MAIN).toContain('defaultRetrievalMode');
		const callIdx = MAIN.indexOf('await retrieveMaterialContext(currentPrompt');
		expect(callIdx).toBeGreaterThan(0);
		const around = MAIN.slice(Math.max(0, callIdx - 700), callIdx + 260);
		expect(around).toMatch(/defaultRetrievalMode/);			// 上游确实取了这个字段
		// 注意别用 [^)]* 去跨实参匹配 —— 中间的 resolveEmbeddingTarget(profile) 自带括号会把它截断。
		const callLine = around.slice(around.indexOf('await retrieveMaterialContext('));
		expect(callLine.slice(0, 200)).toContain('bundleRetrievalMode');	// mode 确实作为末参传入
	});

	it('该字段仍在存储侧被归一(旧组合无此键时回落 auto)', ()=>{
		const store = fs.readFileSync(path.join(SRC_ROOT, 'utils', 'aiAnalysisStore.js'), 'utf8');
		expect(store).toMatch(/defaultRetrievalMode\s*=\s*\S*defaultRetrievalMode\s*\|\|\s*'auto'/);
	});

	it('三档选项仍在表单里暴露(退役了就该同时删掉本护栏)', ()=>{
		expect(MAIN).toMatch(/value:\s*'fulltext'/);
		expect(MAIN).toMatch(/value:\s*'rag'/);
		expect(MAIN).toContain('name="defaultRetrievalMode"');
	});
});
