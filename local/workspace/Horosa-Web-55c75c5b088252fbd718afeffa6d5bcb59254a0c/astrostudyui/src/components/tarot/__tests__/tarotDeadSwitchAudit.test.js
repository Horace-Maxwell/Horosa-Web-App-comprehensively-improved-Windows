// 【第2步】死开关审计:逐键逐值切换,机械证明「中栏计算」或「右栏显示」真的变化。
// 判据(死开关审计 playbook 口径):不自证的结论不作数——每个键都要在可复现的具体场景(种子)下,
// 让引擎签名 boardSignature / 快照文本 / 渲染文本 三者之一出现真实差异;找不到这样的场景即判死开关。
// 「找场景」用有界搜种子(SEED_TRIES),搜到即记录该种子,搜不到即红并打印,便于定位根因。
import React from 'react';
import ReactDOM from 'react-dom';
import TarotMain from '../TarotMain';
import { buildReading } from '../engine/reading';
import { buildReadingText } from '../engine/reportText';
import { SETTINGS_STATE_MAP } from '../engine/settingsMap';
import { OPTION_SPEC, boardSignature } from './tarotOptionSpec';

jest.setTimeout(180000);

if(!window.matchMedia){
	window.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false });
}

const SEED_TRIES = 120;
// 纯 UI 键:不进入快照文本(设计如此),只在渲染层可判。
const UI_ONLY = new Set(['artStyle', 'dummettOrder', 'showCorrespondences']);
// artStyle 的差异是 <img> 元素而非文字,单独用 DOM 判据。
const DOM_JUDGE = new Set(['artStyle']);

function readingOf(ctx, key, value, seed){
	const { deckId, spreadType, ...rest } = ctx;
	return buildReading(deckId, spreadType, seed, { ...rest, [key]: value });
}

// 在有界种子内找到「该键两值产生差异」的场景。probe: (reading)=>string
// 返回至多 CAND_MAX 个候选种子:引擎层只需第一个;渲染层的 state 基线与引擎默认未必逐位相同
// (同种子下抽到的牌可能不同),故渲染层要逐个候选试,避免拿单一种子误判成死开关。
const CAND_MAX = 6;
function findSeed(spec, probe, valueA, valueB){
	const seeds = [];
	for(let i = 0; i < SEED_TRIES; i++){
		const seed = `audit-${spec.key}-${i}`;
		const a = probe(readingOf(spec.ctx, spec.key, valueA, seed));
		const b = probe(readingOf(spec.ctx, spec.key, valueB, seed));
		if(a !== b){
			seeds.push(seed);
			if(seeds.length >= CAND_MAX){ break; }
		}
	}
	return seeds.length ? { seed: seeds[0], seeds } : null;
}

// —— 渲染层:mount 一次,取右栏指定页的可见文本 ——
function renderText(spec, key, value, seed, tab){
	const container = document.createElement('div');
	document.body.appendChild(container);
	let text = '';
	let html = '';
	try{
		const inst = ReactDOM.render(<TarotMain height={800} fields={{}} />, container);
		const patch = { deckId: spec.ctx.deckId, spreadType: spec.ctx.spreadType, rightPanelTab: tab };
		Object.keys(spec.ctx).forEach((k) => {
			if(k === 'deckId' || k === 'spreadType'){ return; }
			const stateKey = (SETTINGS_STATE_MAP.find(([sk]) => sk === k) || [])[1];
			if(stateKey){ patch[stateKey] = spec.ctx[k]; }
		});
		const selfStateKey = (SETTINGS_STATE_MAP.find(([sk]) => sk === key) || [])[1];
		if(selfStateKey){ patch[selfStateKey] = value; }
		ReactDOM.unstable_batchedUpdates(() => { inst.setState(patch); });
		inst.applyRecompute(seed);
		text = container.textContent || '';
		html = container.innerHTML || '';
	}finally{
		ReactDOM.unmountComponentAtNode(container);
		container.remove();
	}
	return { text, html };
}

describe('第2步 · 规格完备性', () => {
	test('SETTINGS_STATE_MAP 每个设置键都登记在规格对照表(漏登即红)', () => {
		const spec = new Set(OPTION_SPEC.map((s) => s.key));
		SETTINGS_STATE_MAP.forEach(([sk]) => {
			expect(`${sk}:${spec.has(sk)}`).toBe(`${sk}:true`);
		});
		expect(OPTION_SPEC.length).toBe(SETTINGS_STATE_MAP.length);
		// 每条规格必须写全四要件
		OPTION_SPEC.forEach((s) => {
			expect(`${s.key}.values`).toBe(`${s.key}.values`);
			expect(s.values.length).toBeGreaterThanOrEqual(2);
			expect(s.calc.length).toBeGreaterThan(8);
			expect(s.show.length).toBeGreaterThan(8);
			expect(['board', 'read', 'both']).toContain(s.layer);
		});
	});
});

describe('第2步 · 引擎层死开关(中栏计算真的变)', () => {
	OPTION_SPEC.filter((s) => !UI_ONLY.has(s.key)).forEach((spec) => {
		test(`${spec.key}(${spec.label}):逐值切换后 ${spec.layer === 'board' ? '牌面签名' : '快照文本'} 必有真实差异`, () => {
			const probe = spec.layer === 'board' ? boardSignature : ((r) => buildReadingText(r));
			const base = spec.values[0];
			const misses = [];
			spec.values.slice(1).forEach((v) => {
				const hit = findSeed(spec, probe, base, v);
				if(!hit){ misses.push(`${JSON.stringify(base)}→${JSON.stringify(v)}`); }
			});
			expect(`${spec.key} 无差异档: ${misses.join(' , ')}`).toBe(`${spec.key} 无差异档: `);
		});
	});
});

describe('第2步 · 枚举档位两两互异(只与默认档比会漏掉「两个非默认档互为孪生」)', () => {
	// 逐值只与 values[0] 比,查不出「B 档与 C 档全等」。凡多值枚举键,在同一场景下取全档输出,要求两两互异。
	const enumSpecs = OPTION_SPEC.filter((s) => s.values.length >= 3 && !UI_ONLY.has(s.key));
	enumSpecs.forEach((spec) => {
		test(`${spec.key}(${spec.label}):${spec.values.length} 档在同一牌面下输出两两互异`, () => {
			const probe = spec.layer === 'board' ? boardSignature : ((r) => buildReadingText(r));
			// 找一个「全档互异」的场景;单一种子下有些档可能碰巧同值(牌面未触及该档特性),故也搜种子。
			let best = null;
			for(let i = 0; i < SEED_TRIES && !best; i++){
				const seed = `enum-${spec.key}-${i}`;
				const outs = spec.values.map((v) => probe(readingOf(spec.ctx, spec.key, v, seed)));
				if(new Set(outs).size === spec.values.length){ best = { seed, outs }; }
			}
			if(best){ expect(new Set(best.outs).size).toBe(spec.values.length); return; }
			// 搜不到全异场景 → 报出哪些档互为孪生(全场景恒等即真死档对)
			const seed = `enum-${spec.key}-0`;
			const outs = spec.values.map((v) => probe(readingOf(spec.ctx, spec.key, v, seed)));
			const twins = [];
			outs.forEach((o, i) => outs.forEach((p, j) => { if(j > i && o === p){ twins.push(`${JSON.stringify(spec.values[i])}≡${JSON.stringify(spec.values[j])}`); } }));
			expect(`${spec.key} 孪生档对: ${twins.join(' , ')}`).toBe(`${spec.key} 孪生档对: `);
		});
	});
});

describe('第2步 · 渲染层死开关(右栏显示真的变)', () => {
	OPTION_SPEC.forEach((spec) => {
		test(`${spec.key}(${spec.label}):右栏「${spec.tab}」页显示随之变化`, () => {
			const probe = UI_ONLY.has(spec.key) ? null : (spec.layer === 'board' ? boardSignature : ((r) => buildReadingText(r)));
			// 先用引擎层找一个可判场景的种子;纯 UI 键用固定种子
			const base = spec.values[0];
			const other = spec.values[spec.values.length - 1];
			const hit = probe ? findSeed(spec, probe, base, other) : { seeds: [`ui-${spec.key}`] };
			expect(`${spec.key} 可判场景`).toBe(hit ? `${spec.key} 可判场景` : `${spec.key} 无可判场景`);
			let changed = false;
			const tried = [];
			hit.seeds.forEach((seed) => {
				if(changed){ return; }
				tried.push(seed);
				const A = renderText(spec, spec.key, base, seed, spec.tab);
				const B = renderText(spec, spec.key, other, seed, spec.tab);
				// 牌面样式的差异是 <img> 元素的有无,非文字
				changed = DOM_JUDGE.has(spec.key) ? (A.html.includes('<img') !== B.html.includes('<img')) : (A.text !== B.text);
			});
			expect(`${spec.key} 显示随之变(试过种子 ${tried.length} 个):${changed}`).toBe(`${spec.key} 显示随之变(试过种子 ${tried.length} 个):true`);
		});
	});
});
