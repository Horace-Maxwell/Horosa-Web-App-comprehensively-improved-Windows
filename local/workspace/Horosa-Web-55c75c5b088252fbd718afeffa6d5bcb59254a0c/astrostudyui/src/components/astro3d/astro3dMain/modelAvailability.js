// 3D 星盘 · 模型加载失败的冷却:会话级记下失败时刻、冷却期内与离线时跳过加载、成功后清标记
// 从 Astro3D.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { safeStorageSetOn } from '../../../utils/safeStorage';

const ModelUnavailableAtKey = 'horosa3dModelUnavailableAt';
const ModelUnavailableCooldown = 10 * 60 * 1000;

function getStorageValue(storage, key){
	if(!storage){
		return '';
	}
	try{
		return storage.getItem(key) || '';
	}catch(err){
		return '';
	}
}

function setStorageValue(storage, key, value){
	// 经存储单源(sessionStorage 只做 try/catch;本机 localStorage 走配额阶梯)
	return safeStorageSetOn(storage, key, value);
}

function removeStorageValue(storage, key){
	if(!storage){
		return;
	}
	try{
		storage.removeItem(key);
	}catch(err){
		// ignore storage exceptions
	}
}

function getModelUnavailableAt(){
	if(typeof window === 'undefined'){
		return 0;
	}
	// 🔴 冷却只认 session 级:模型是本地静态资源,失败=瞬时故障(dev/后端重启、首启 race),
	// localStorage 级长冷却会把一次 8s 超时钉死成「之后每次进页都满天 TextGeometry 简化模式」
	// (实爆:被当成「3D 盘改坏了」)。localStorage 旧标记视为遗留脏数据,读到即清。
	removeStorageValue(window.localStorage, ModelUnavailableAtKey);
	return Number(getStorageValue(window.sessionStorage, ModelUnavailableAtKey) || 0);
}

export function markModelUnavailableNow(){
	if(typeof window === 'undefined'){
		return;
	}
	// 只写 sessionStorage(同上:冷却不跨会话)
	setStorageValue(window.sessionStorage, ModelUnavailableAtKey, `${Date.now()}`);
}

export function clearModelUnavailableMark(){
	if(typeof window === 'undefined'){
		return;
	}
	removeStorageValue(window.localStorage, ModelUnavailableAtKey);
	removeStorageValue(window.sessionStorage, ModelUnavailableAtKey);
}

export function shouldSkipModelLoad(){
	if(typeof navigator !== 'undefined' && navigator.onLine === false){
		return true;
	}
	const unavailableAt = getModelUnavailableAt();
	if(!unavailableAt){
		return false;
	}
	return (Date.now() - unavailableAt) < ModelUnavailableCooldown;
}
