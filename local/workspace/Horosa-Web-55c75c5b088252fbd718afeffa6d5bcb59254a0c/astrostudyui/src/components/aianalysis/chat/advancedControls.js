// 「进阶」页控件登记表(单一真值)的运行时入口:基础表 + 可选扩展表(存在才合并;require 失败即无)。
// 消费方:aiAdvancedControlsRegistry.test.js(逐锚 reveal 合同)、自动化驱动器 sweepControls(注入 window.__advRegistry)、
// 检查器 check_adv_controls_registry.js(直接读 JSON)。本文件零 React、零副作用。
import registry from './advancedControls.registry.json';

let merged = null;
export function listAdvancedControls(){
	if(merged){ return merged; }
	let priv = null;
	try{ priv = require('./advancedControls.private.json'); }catch(e){ priv = null; }
	const controls = (registry.controls || []).concat(priv && Array.isArray(priv.controls) ? priv.controls : []);
	const markers = (registry.markers || []).concat(priv && Array.isArray(priv.markers) ? priv.markers : []);
	merged = { controls, markers, kinds: registry.kinds || [], revealOps: registry.revealOps || [] };
	return merged;
}
export function advancedControlById(id){ return listAdvancedControls().controls.find((c)=>c && c.id === id) || null; }
export default registry;
