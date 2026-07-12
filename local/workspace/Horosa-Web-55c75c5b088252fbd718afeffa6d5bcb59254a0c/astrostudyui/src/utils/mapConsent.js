import { safeLocalStorageSet } from './safeStorage';
// 在线地图(高德)加载前的一次性知情同意:加载第三方地图脚本会向其服务器发送
// 用户 IP 与地图交互请求(服务器位于中国境内)。按 PIPL「向第三方提供」的单独
// 同意要求与 GDPR 最小化原则,首次使用地图前须经用户显式确认;拒绝不影响
// 手动输入经纬度等本地路径。同意持久化本机,可通过清除本地数据撤回。
// 配套:docs/legal/隐私政策(第三方服务清单·高德地图条目)。
// 注:本模块保持零依赖(不 import 其它 util)——它在 MapV2 constructor 即被调用,
// 位于多个入口 chunk 的最早执行路径上,任何跨模块初始化顺序问题都会放大成白屏。
const MAP_CONSENT_KEY = 'horosa.map.consent.v1';

export function hasMapConsent(){
	try{
		return typeof window !== 'undefined'
			&& !!window.localStorage
			&& window.localStorage.getItem(MAP_CONSENT_KEY) === '1';
	}catch(e){
		return false; // 私有模式等 getItem 抛错:按未同意处理(更保守)
	}
}

export function grantMapConsent(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			safeLocalStorageSet(MAP_CONSENT_KEY, '1');
		}
	}catch(e){
		// 配额满/私有模式写入失败:本次会话按已同意继续(setState 已切换),下次启动再询问一次。
	}
}

export default { hasMapConsent, grantMapConsent };
