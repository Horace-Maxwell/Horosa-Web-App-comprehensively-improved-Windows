// [2026-09-11] 技法拼音表(src/data/techniquePinyin.json)≡ 当前 ANALYSIS_TECHNIQUE_LABELS 用构建脚本重算(pinyin-pro 只在构建期/测试期,
// 不进运行时 bundle:preflight [36]);改标签后忘记 npm run build:technique-pinyin 即红。
const path = require('path');
import TABLE from '../../data/techniquePinyin.json';
import { ANALYSIS_TECHNIQUE_LABELS } from '../aiAnalysisContext';

const builder = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'build-technique-pinyin.js'));

it('🔴 表 ≡ 重算(键集与每键拼音逐一相等);每个中文标签都有全拼与首字母两段', ()=>{
	const fresh = builder.build();
	expect(Object.keys(TABLE).sort()).toEqual(Object.keys(ANALYSIS_TECHNIQUE_LABELS).sort());
	expect(TABLE).toEqual(fresh);
	Object.keys(ANALYSIS_TECHNIQUE_LABELS).forEach((k)=>{ expect(TABLE[k].split(' ').length).toBeGreaterThanOrEqual(2); });
	expect(TABLE.qimen).toBe('qimendunjia qmdj');
	expect(TABLE.bazi).toBe('bazi bz');
	expect(TABLE.liureng).toBe('daliuren dlr');
});
