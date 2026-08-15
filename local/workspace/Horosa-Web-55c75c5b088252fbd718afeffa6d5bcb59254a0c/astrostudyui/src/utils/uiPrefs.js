// 轻量 UI 偏好(localStorage 经 safeStorage;非记录数据,不入备份 raw 键清单)。
// [V] 删除确认「下次不再提醒」:回收站兜底后单条删除的确认框可选关闭(批量删除恒确认)。
// 命盘/事盘共用同一偏好;回收站弹窗内提供「重新开启」后悔药。
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safeStorage';

const SKIP_DELETE_CONFIRM_KEY = 'horosa.ui.skipDeleteConfirm.v1';

export function shouldSkipDeleteConfirm(){
	return safeLocalStorageGet(SKIP_DELETE_CONFIRM_KEY) === '1';
}

export function setSkipDeleteConfirm(){
	safeLocalStorageSet(SKIP_DELETE_CONFIRM_KEY, '1');
}

export function clearSkipDeleteConfirm(){
	safeLocalStorageRemove(SKIP_DELETE_CONFIRM_KEY);
}
