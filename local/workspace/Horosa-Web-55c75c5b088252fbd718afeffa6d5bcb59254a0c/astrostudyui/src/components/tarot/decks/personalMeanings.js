// 个人牌义层(三层牌义模型之第三层):用户自撰,仅存本机 localStorage 单键;不同步、不入快照(默认)。
// 「共通义→主流义→个人义」中,个人义只适用于本人;代解他人时以解牌者义库为准——故独立于任何书源数据。
// 存取一律走 safeStorage(配额满自愈重试 + 坏档静默清除);绕开它直写 storage 是 [125] 红线。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../../../utils/safeStorage';

export const PERSONAL_KEY = 'horosa.tarot.personalMeanings';

export function loadPersonalMeanings(){
	const obj = safeJsonParseFromStorage(PERSONAL_KEY);
	return obj && typeof obj === 'object' ? obj : {};
}

export function personalMeaningOf(sid){
	const all = loadPersonalMeanings();
	return (sid && all[sid]) || '';
}

export function savePersonalMeaning(sid, text){
	if(!sid){ return false; }
	const all = loadPersonalMeanings();
	const t = `${text || ''}`.trim();
	if(t){ all[sid] = t.slice(0, 500); } // 单条 500 字封顶,防配额
	else{ delete all[sid]; }
	return safeJsonStringifyToStorage(PERSONAL_KEY, all);
}
