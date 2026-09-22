import fs from 'fs';
import path from 'path';
import { buildTimeBasisLine, timeBasisLabel } from '../timeBasisLine';
import { AGENT_SYSTEM_RULES } from '../aiAgent/protocol';

// 跨技法「时间基准」自声明合同:三处 [起盘信息] 构造器(八字/七政×2/星盘)必须经 buildTimeBasisLine 追加一行,
// AI 守则必须告诉模型「各技法时间基准可不同,以自声明为准」——否则同一时刻八字丁酉/七政戊戌会被模型判为算错。
const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('timeBasisLine · 单行格式', ()=>{
	test('八字默认真太阳时;缺参按「钟表时」+ 否/否', ()=>{
		expect(buildTimeBasisLine({ timeAlg: 0 })).toBe('时间基准：真太阳时(经度+均时差校正)；晚子时归次日：否；23 点换日：否');
		expect(buildTimeBasisLine({})).toBe('时间基准：钟表时(按输入钟面时刻,无真太阳时校正)；晚子时归次日：否；23 点换日：否');
		expect(buildTimeBasisLine({ timeAlg: '2', lateZiHourUseNextDay: 1, after23NewDay: '1', zone: '+08:00' })).toBe('时间基准：春分定卯时；晚子时归次日：是；23 点换日：是；时区：+08:00');
		expect(timeBasisLabel(1)).toMatch(/钟表时/);
	});
});

describe('起盘信息构造器合同(源码结构锁)', ()=>{
	test('八字/七政(两处)/星盘快照均调用 buildTimeBasisLine', ()=>{
		expect((read('components/cntradition/BaZi.js').match(/buildTimeBasisLine\(/g) || []).length).toBeGreaterThanOrEqual(1);
		expect((read('components/guolao/GuoLaoChartMain.js').match(/buildTimeBasisLine\(/g) || []).length).toBeGreaterThanOrEqual(2);
		expect((read('utils/astroAiSnapshot.js').match(/buildTimeBasisLine\(/g) || []).length).toBeGreaterThanOrEqual(1);
	});

	test('AI 守则含跨技法时间基准条款', ()=>{
		expect(AGENT_SYSTEM_RULES).toMatch(/时间基准/);
		expect(AGENT_SYSTEM_RULES).toMatch(/不要判某一方算错/);
	});
});
