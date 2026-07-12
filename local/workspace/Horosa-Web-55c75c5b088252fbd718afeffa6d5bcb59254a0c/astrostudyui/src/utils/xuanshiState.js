import { safeLocalStorageSet } from './safeStorage';
// 玄史模块 UI 状态持久化:记住当前子页 + 各子页过滤组合(localStorage)。
const LS_KEY = 'horosa.xuanshi.state.v1';

export const XUANSHI_SUBPAGES = [
	{ key: 'overview', label: '总览' },
	{ key: 'events', label: '玄学事件' },
	{ key: 'celestial', label: '星象大典' },
	{ key: 'micro', label: '天象微年表' },
	{ key: 'figures', label: '人物列传' },
	{ key: 'map', label: '玄学地图' },
	{ key: 'persons', label: '人物关系' },
	{ key: 'stories', label: '故事专题' },
	{ key: 'timeline', label: '朝代时间轴' },
	{ key: 'encyclopedia', label: '词条百科' },
	{ key: 'search', label: '统一搜索' },
	{ key: 'desk', label: '案头' },
];

function makeDefaults() {
	return {
		subpage: 'overview',
		events: { tradition: '', dynasty: '', history: '', technique: '', evidence: '', q: '', page: 1 },
		celestial: {
			dynasty: '', omen: [], history: '', source: '',
			year_from: null, year_to: null, crosswalk: '', in_chapter: '', q: '',
			view: 'sample', page: 1,
		},
		figures: { dynasty: '', q: '', page: 1 },
		map: { period: '' },
		persons: { min_weight: 3, top_n: 80 },
		stories: { channel: '', dynasty: '', q: '', page: 1 },
		timeline: { macro: '' },
		encyclopedia: { tab: 'technique' },
		search: { q: '', tradition: '', dynasty: [], technique: [], history: [], evidence: [] },
	};
}

export function getXuanShiDefaults() {
	return makeDefaults();
}

export function loadXuanShiState() {
	const base = makeDefaults();
	try {
		const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
		// 浅合并顶层 + 各子页对象深一层合并,避免旧 schema 缺键
		const out = { ...base, ...saved };
		Object.keys(base).forEach((k) => {
			if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
				out[k] = { ...base[k], ...(saved[k] || {}) };
			}
		});
		return out;
	} catch (e) {
		return base;
	}
}

export function saveXuanShiState(state) {
	try {
		safeLocalStorageSet(LS_KEY, JSON.stringify(state));
	} catch (e) { /* ignore quota/availability */ }
}
