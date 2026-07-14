// 通书择日设置持久化（safeStorage）；TongshuMain 持有 state，此处仅 load/save。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../../utils/safeStorage';
import { DEFAULT_TONGSHU_SETTINGS, TONGSHU_SCHOOL_MAP } from './tongshuSchools';

const STORE_KEY = 'horosa-calendar-tongshu-settings';

export function loadTongshuSettings() {
	const v = safeJsonParseFromStorage(STORE_KEY);
	if (v && typeof v === 'object' && v.school && TONGSHU_SCHOOL_MAP[v.school]) {
		return { ...DEFAULT_TONGSHU_SETTINGS, ...v };
	}
	return { ...DEFAULT_TONGSHU_SETTINGS };
}

export function saveTongshuSettings(settings) {
	safeJsonStringifyToStorage(STORE_KEY, settings);
}
