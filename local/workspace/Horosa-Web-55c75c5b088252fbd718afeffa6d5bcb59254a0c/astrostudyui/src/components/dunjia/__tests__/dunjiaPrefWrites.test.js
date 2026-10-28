// 奇门两个显示偏好(格局解读显隐 / 法奇门问事主题)的写入:safeLocalStorageSet 自带环境判断与异常兜底,
// 两个键都已登记,写入函数直调即可。
import fs from 'fs';
import path from 'path';
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import { classifyStorageKey } from '../../../utils/storageKeyRegistry';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'DunJiaMain.js'), 'utf8');

describe('奇门显示偏好写入', ()=>{
	test('两个键都已登记,写入直达本机存储', ()=>{
		['qimenShowPatternInterpretation', 'qimenFaAskTopic'].forEach((k)=>{
			expect(classifyStorageKey(k)).toBeTruthy();
		});
		expect(SRC).toContain("const QIMEN_PATTERN_INTERPRETATION_STORAGE_KEY = 'qimenShowPatternInterpretation';");
		expect(SRC).toContain("const QIMEN_FA_ASK_TOPIC_KEY = 'qimenFaAskTopic';");
		expect(safeLocalStorageSet('qimenShowPatternInterpretation', '1')).toBe(true);
		expect(window.localStorage.getItem('qimenShowPatternInterpretation')).toBe('1');
		expect(safeLocalStorageSet('qimenFaAskTopic', 'wealth')).toBe(true);
		expect(window.localStorage.getItem('qimenFaAskTopic')).toBe('wealth');
	});

	test('源码:两个写入函数只剩一行直调', ()=>{
		expect(SRC).toContain("function savePatternInterpretationPreference(value){\n\tsafeLocalStorageSet(QIMEN_PATTERN_INTERPRETATION_STORAGE_KEY, value ? '1' : '0');\n}");
		expect(SRC).toContain('function saveFaAskTopic(value){\n\tsafeLocalStorageSet(QIMEN_FA_ASK_TOPIC_KEY, value);\n}');
	});

	test('两处调用点在位(格局解读按钮 / 问事主题切换)', ()=>{
		expect(SRC).toContain('savePatternInterpretationPreference(next);');
		expect(SRC).toContain('saveFaAskTopic(k);');
	});
});
