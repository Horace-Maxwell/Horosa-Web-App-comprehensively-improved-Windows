// AI 导出 · 导出键:键名规范化(旧键 direction → primarydirect)、推运类判定、技法显示名。
// 只依赖段表常量(presets),是各子模块共用的底层件(不引其它子模块);由 utils/aiExport.js 门面经各子模块间接对外。
import { AI_EXPORT_TECHNIQUES } from './presets';

export function normalizeExportKey(key){
	const val = `${key || ''}`;
	if(val === 'direction'){
		return 'primarydirect';
	}
	return val;
}

export function isPredictiveExportKey(key){
	const val = normalizeExportKey(key);
	return val === 'primarydirect'
		|| val === 'primarydirchart'
		|| val === 'zodialrelease'
		|| val === 'firdaria'
		|| val === 'distributions'
		|| val === 'agepoint'
		|| val === 'ephemeris'          // 星运三页上线为技法键(简单模块抓取 extractSimpleModuleContent,与 planetaryages 等同机制)
		|| val === 'returntimeline'
		|| val === 'prenatalsyzygy'
		|| val === 'profection'
		|| val === 'solararc'
		|| val === 'solarreturn'
		|| val === 'lunarreturn'
		|| val === 'givenyear'
		|| val === 'decennials'
		|| val === 'planetaryages'
		|| val === 'prog'
		|| val === 'vedicprog'
		|| val === 'jaynesprog'
		|| val === 'planetaryarc'
		|| val === 'persiandirected'
		|| val === 'yearsystem129'
		|| val === 'balbillus'
		|| val === 'triplicityrulers'
		|| val === 'keypoints'
		|| val === 'lunationphase'
		|| val === 'extrareturns';
}

export function getTechniqueLabelByKey(key){
	const found = AI_EXPORT_TECHNIQUES.find((item)=>item.key === `${key || ''}`);
	return found ? found.label : '';
}
