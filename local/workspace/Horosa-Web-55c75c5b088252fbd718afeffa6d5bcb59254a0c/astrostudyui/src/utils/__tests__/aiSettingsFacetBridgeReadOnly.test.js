// 要工作区桥才写得了的设置面(当前盘口径 / 全局显示偏好):桥缺(无头 / 页面未就绪)时,描述标整面只读并写明原因、
// 校验即拒、写入回 E_BRIDGE_UNAVAILABLE、撤销同拒 —— 四处同一判据 facetBridgeBlock;其余面不受桥影响。
import fs from 'fs';
import path from 'path';
import { registerBuiltinTools } from '../aiTools';
import { getTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge } from '../aiTools/workspaceBridge';
import { facetBridgeBlock, describeFacet, validateFacetValues, SETTING_FACETS } from '../aiTools/settingsFacets';

const SAMPLE = { chart: { hsys: 0 }, app: { wheelArt: 'hellenistic' } };
const BRIDGES = {
	none: { changeCond: undefined, dispatch: undefined },
	changeCondOnly: { changeCond: ()=>{}, dispatch: undefined },
	dispatchOnly: { changeCond: undefined, dispatch: ()=>{} },
	both: { changeCond: ()=>{}, dispatch: ()=>{} },
};

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); registerBuiltinTools(); registerWorkspaceBridge(BRIDGES.none); });
afterAll(()=>{ registerWorkspaceBridge(BRIDGES.none); });

test('🔴 缺桥:当前盘 / 全局显示两面描述整面只读(带原因),describe_settings 标 writable:false;校验与写入同一句拒绝', async ()=>{
	for(const facet of ['chart', 'app']){
		const blk = facetBridgeBlock(facet);
		expect(blk && blk.code).toBe('E_BRIDGE_UNAVAILABLE');
		const d = describeFacet(facet);
		expect(d.ok).toBe(true);
		expect(d.readOnly).toEqual(blk);
		expect(d.items.length).toBeGreaterThan(3);
		expect(d.items.every((it)=>it.settable === false && it.hint === blk.message)).toBe(true);
		const desc = await getTool('describe_settings').run({ facet });
		expect([desc.ok, desc.data.writable, desc.data.readOnlyReason]).toEqual([true, false, blk.message]);
		expect(desc.summary).toContain('只读');
		const v = validateFacetValues(facet, undefined, SAMPLE[facet]);
		expect([v.ok, v.code, v.message]).toEqual([false, 'E_BRIDGE_UNAVAILABLE', blk.message]);
		const w = await getTool('set_settings').run({ facet, values: SAMPLE[facet] });
		expect([w.ok, w.code, w.message]).toEqual([false, 'E_BRIDGE_UNAVAILABLE', blk.message]);
		expect(await getTool('set_settings').preview({ facet, values: SAMPLE[facet] })).toBe(null);   // 不出审批卡
	}
	expect(facetBridgeBlock('app').message).toContain('无头');
});

test('🔴 同一判据:四种桥状态 × 全部设置面 —— 描述只读 ⇔ 写入回 E_BRIDGE_UNAVAILABLE;桥在时两面恢复可改', async ()=>{
	const rows = [];
	for(const [state, bridge] of Object.entries(BRIDGES)){
		registerWorkspaceBridge(bridge);
		for(const facet of ['chart', 'app']){
			const ro = !!describeFacet(facet).readOnly;
			const desc = await getTool('describe_settings').run({ facet });
			const w = await getTool('set_settings').run({ facet, values: SAMPLE[facet] });
			rows.push([state, facet, ro, desc.data.writable !== false, w.code === 'E_BRIDGE_UNAVAILABLE']);
			expect([state, facet, ro]).toEqual([state, facet, !!facetBridgeBlock(facet)]);
			expect([state, facet, w.code === 'E_BRIDGE_UNAVAILABLE']).toEqual([state, facet, ro]);
			expect([state, facet, desc.data.writable !== false]).toEqual([state, facet, !ro]);
			if(!ro){ expect(describeFacet(facet).items.some((it)=>it.settable === true)).toBe(true); }
		}
	}
	// 判据只看本面要的那个函数:当前盘看 changeCond、全局显示看 dispatch
	expect(rows.filter((r)=>r[2]).map((r)=>`${r[0]}:${r[1]}`).sort()).toEqual(['changeCondOnly:app', 'dispatchOnly:chart', 'none:app', 'none:chart']);
	// 其余面不受桥影响
	registerWorkspaceBridge(BRIDGES.none);
	SETTING_FACETS.filter((f)=>f !== 'chart' && f !== 'app').forEach((f)=>expect([f, facetBridgeBlock(f)]).toEqual([f, null]));
	expect(describeFacet('classical').readOnly).toBeUndefined();
});

test('源码锁:设置面里缺桥判断只走 facetBridgeBlock(不许再手写 typeof bridge.* 判据)', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', 'aiTools', 'settingsFacets.js'), 'utf8');
	expect(src).not.toMatch(/typeof\s+(bridge\.)?(changeCond|dispatch)\s*!==\s*'function'/);
	expect((src.match(/facetBridgeBlock\(/g) || []).length).toBeGreaterThanOrEqual(7);
});
