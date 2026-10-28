// 七政四余页 · 本机偏好与页内常量:Moira 快捷按钮表、排盘引擎档与 kinastro 七政选项的读写、出生日期 / 时间显示格式。
// 只被 components/guolao/GuoLaoChartMain.js 与同目录 main/ 下的兄弟模块引用。
import { safeLocalStorageSet } from '../../../utils/safeStorage';

export const MOIRA_QUICK_ACTIONS = [
	{key: 'patterns', label: '格局', icon: 'sideStyle'},
	{key: 'yearStars', label: '化曜', icon: 'quickPrimary'},
	{key: 'weakSolid', label: '虚实', icon: 'sideHouses'},
	{key: 'natalStars', label: '命曜', icon: 'sidePlanets'},
	{key: 'transitStars', label: '流曜', icon: 'quickTransit'},
	{key: 'aspects', label: '相位', icon: 'sideSwitch'},
	{key: 'gods', label: '神煞', icon: 'quickNote'},
];

const GUOLAO_ENGINE_STORAGE_KEY = 'horosa.guolao.engineMode';
const GUOLAO_KIN_OPTIONS_STORAGE_KEY = 'horosa.guolao.kinastroQizheng.options';

export function getStoredGuolaoEngineMode(){
	try{
		return localStorage.getItem(GUOLAO_ENGINE_STORAGE_KEY) === 'kinastro' ? 'kinastro' : 'horosa';
	}catch(e){
		return 'horosa';
	}
}

export function setStoredGuolaoEngineMode(value, opts){
	const next = value === 'kinastro' ? 'kinastro' : 'horosa';
	if(opts && opts.persist === false){ return next; }
	safeLocalStorageSet(GUOLAO_ENGINE_STORAGE_KEY, next);
	return next;
}

function formatNativeDate(date){
	const target = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
	const y = target.getFullYear();
	const m = `${target.getMonth() + 1}`.padStart(2, '0');
	const d = `${target.getDate()}`.padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function formatNativeTime(date){
	const target = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
	const h = `${target.getHours()}`.padStart(2, '0');
	const m = `${target.getMinutes()}`.padStart(2, '0');
	return `${h}:${m}`;
}

export function getStoredKinastroQizhengOptions(){
	const now = new Date();
	const defaults = {
		currentYear: new Date().getFullYear(),
		transitMode: 'none',
		transitDate: formatNativeDate(now),
		transitTime: formatNativeTime(now),
		showZhangguo: true,
		showShensha: true,
		showMingGong: true,
		electionalStartDate: '',
		electionalCriteria: 'general',
		electionalDays: 30,
	};
	try{
		const raw = JSON.parse(localStorage.getItem(GUOLAO_KIN_OPTIONS_STORAGE_KEY) || '{}');
		return {
			...defaults,
			...(raw || {}),
			currentYear: Number(raw && raw.currentYear) || defaults.currentYear,
		};
	}catch(e){
		return defaults;
	}
}

export function setStoredKinastroQizhengOptions(value, opts){
	const persist = !(opts && opts.persist === false);
	const next = {
		...(persist ? getStoredKinastroQizhengOptions() : ((opts && opts.base) || getStoredKinastroQizhengOptions())),
		...(value || {}),
	};
	next.currentYear = Math.max(1, Math.min(9999, Number(next.currentYear) || new Date().getFullYear()));
	next.electionalDays = Math.max(1, Math.min(60, Number(next.electionalDays) || 30));
	if(persist){
		safeLocalStorageSet(GUOLAO_KIN_OPTIONS_STORAGE_KEY, JSON.stringify(next));
	}
	return next;
}
