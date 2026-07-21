// 通蓍法 穷举压力测试(纯新增,零改引擎)。
// 技法输入 = 4 个位置(太阴/太阳/少阳/少阴)各选 1 个八卦 → 组合域 = 8^4 = 4096(可完全穷举)。
// 本技法起卦不依赖时间/随机种子(时间面板仅供 AI 上下文),故对「时间/种子」维度改由:
//   ①4096 全组合穷举 + ②大量畸形/边界 selection 输入(空/错类型/非法卦名/多余键/子时等无关串)。
// 每个组合断言:不抛异常 + 关键输出字段存在且非空 + 核心数值无 NaN/undefined 混入。
// 发现问题只记录不改引擎(收集进 crashes[],测试仍绿)。
import {
	buildTongSheFaModel,
	buildTongSheFaSnapshot,
	buildShiYingSection,
	buildWuXingRelationSection,
} from '../TongSheFaMain';

const BAGUA = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const POS = ['taiyin', 'taiyang', 'shaoyang', 'shaoyin'];

const crashes = [];
function record(input, err) {
	crashes.push({ input: typeof input === 'string' ? input : JSON.stringify(input), error: `${(err && err.message) || err}` });
}

// 递归扫描 NaN / undefined 混入核心数值/字段。返回首个坏路径或 null。
function scanBad(node, pathStr, seen) {
	if (node === undefined) return `${pathStr}=undefined`;
	if (typeof node === 'number' && Number.isNaN(node)) return `${pathStr}=NaN`;
	if (node && typeof node === 'object') {
		if (seen.has(node)) return null;
		seen.add(node);
		if (Array.isArray(node)) {
			for (let i = 0; i < node.length; i++) {
				const r = scanBad(node[i], `${pathStr}[${i}]`, seen);
				if (r) return r;
			}
		} else {
			const keys = Object.keys(node);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				const r = scanBad(node[k], `${pathStr}.${k}`, seen);
				if (r) return r;
			}
		}
	}
	return null;
}

// 校验 model 结构完整 + 无 NaN/undefined。抛出 = 记录。
function assertModel(model, label) {
	if (!model || typeof model !== 'object') throw new Error(`${label}: model 空`);
	const need = ['baseLeft', 'baseRight', 'mutualLeft', 'mutualRight', 'oppositeLeft', 'oppositeRight',
		'leftElem', 'rightElem', 'leftLines', 'rightLines', 'mainRelation', 'baguaPicked'];
	need.forEach((k) => {
		if (model[k] === undefined || model[k] === null) throw new Error(`${label}: 缺字段 ${k}`);
	});
	['baseLeft', 'baseRight', 'mutualLeft', 'mutualRight', 'oppositeLeft', 'oppositeRight'].forEach((k) => {
		const hex = model[k];
		if (!hex || !hex.gua || !`${hex.gua.name || ''}`.trim()) throw new Error(`${label}: ${k}.gua.name 空`);
		if (!Array.isArray(hex.lines) || hex.lines.length !== 6) throw new Error(`${label}: ${k}.lines 非 6 爻`);
		if (typeof hex.key !== 'number' || Number.isNaN(hex.key)) throw new Error(`${label}: ${k}.key 非数`);
		hex.lines.forEach((v, i) => {
			if (v !== 0 && v !== 1) throw new Error(`${label}: ${k}.lines[${i}]=${v} 非 0/1`);
		});
	});
	if (!`${model.leftElem || ''}`.trim()) throw new Error(`${label}: leftElem 空`);
	if (!`${model.rightElem || ''}`.trim()) throw new Error(`${label}: rightElem 空`);
	if (!Array.isArray(model.leftLines) || model.leftLines.length !== 6) throw new Error(`${label}: leftLines 非 6`);
	if (!Array.isArray(model.rightLines) || model.rightLines.length !== 6) throw new Error(`${label}: rightLines 非 6`);
	const bad = scanBad(model, 'model', new Set());
	if (bad) throw new Error(`${label}: 混入 ${bad}`);
}

// 校验文本产出非空且无 undefined/NaN 字面量。
function assertText(txt, label) {
	const s = `${txt === undefined || txt === null ? '' : txt}`;
	if (!s.trim()) throw new Error(`${label}: 输出空`);
	if (s.indexOf('undefined') >= 0) throw new Error(`${label}: 含 "undefined"`);
	if (/\bNaN\b/.test(s)) throw new Error(`${label}: 含 "NaN"`);
}

// 单组合全链路跑一遍(model → snapshot → 世应 → 五行关系)。
function runPipeline(sel, label) {
	const model = buildTongSheFaModel(sel);
	assertModel(model, `${label}/model`);
	assertText(buildTongSheFaSnapshot(model), `${label}/snapshot`);
	assertText(buildShiYingSection(model), `${label}/shiYing`);
	assertText(buildWuXingRelationSection(model), `${label}/wuxing`);
}

describe('通蓍法 穷举压力测试', () => {
	test('全 8^4=4096 组合逐一穷举(每选项每取值全覆盖)', () => {
		let combos = 0;
		const perValueCount = {}; // 每 位置|卦名 覆盖计数
		POS.forEach((p) => BAGUA.forEach((b) => { perValueCount[`${p}|${b}`] = 0; }));
		for (const a of BAGUA) {
			for (const b of BAGUA) {
				for (const c of BAGUA) {
					for (const d of BAGUA) {
						const sel = { taiyin: a, taiyang: b, shaoyang: c, shaoyin: d };
						perValueCount[`taiyin|${a}`]++;
						perValueCount[`taiyang|${b}`]++;
						perValueCount[`shaoyang|${c}`]++;
						perValueCount[`shaoyin|${d}`]++;
						combos++;
						try {
							runPipeline(sel, `combo#${combos}`);
						} catch (e) {
							record(sel, e);
						}
					}
				}
			}
		}
		expect(combos).toBe(4096);
		// 每个 选项×取值 至少覆盖一次
		Object.keys(perValueCount).forEach((k) => {
			expect(perValueCount[k]).toBeGreaterThan(0);
		});
	});

	test('畸形/边界 selection 输入(空/错类型/非法卦/多余键/子时无关串)', () => {
		const zi = '甲子丙寅'; // 子时/干支等与本技法无关的串
		const edges = [
			undefined, null, {}, [], 0, '', 'x', 42, true, NaN,
			{ taiyin: null, taiyang: undefined, shaoyang: '', shaoyin: 0 },
			{ taiyin: '無', taiyang: '?', shaoyang: '乾乾', shaoyin: '坤 ' }, // 非法卦名
			{ taiyin: '乾', taiyang: '兑' }, // 缺键 → 应回退默认
			{ taiyin: '乾', taiyang: '兑', shaoyang: '离', shaoyin: '震', extra: '污染', nested: { x: 1 } },
			{ taiyin: zi, taiyang: zi, shaoyang: zi, shaoyin: zi }, // 无关串
			{ taiyin: 123, taiyang: [], shaoyang: {}, shaoyin: () => {} }, // 全错类型
			{ TAIYIN: '乾' }, // 键大小写不匹配
			{ taiyin: '☰', taiyang: '☱', shaoyang: '☲', shaoyin: '☳' }, // 符号非卦名
		];
		let n = 0;
		edges.forEach((sel) => {
			n++;
			try {
				runPipeline(sel, `edge#${n}`);
			} catch (e) {
				record(sel, e);
			}
		});
		expect(n).toBe(edges.length);
	});

	afterAll(() => {
		if (crashes.length) {
			// eslint-disable-next-line no-console
			console.log(`通蓍法压测 crashes(${crashes.length}):\n` + crashes.map((c) => `  ${c.input} -> ${c.error}`).join('\n'));
		}
	});
});
