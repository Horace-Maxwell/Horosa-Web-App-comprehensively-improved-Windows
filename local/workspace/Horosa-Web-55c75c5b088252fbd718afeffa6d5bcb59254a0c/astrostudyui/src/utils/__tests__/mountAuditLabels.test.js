// [挂载自检 P2] 口径标注不撒谎:八字 timeAlg=3(平太阳时)有标签;流派 tongguan 有标签。
import fs from 'fs';
import path from 'path';
import { timeBasisLabel } from '../timeBasisLine';

it('timeAlg 四档全有中文标签(此前 3 打印裸数字「时间基准：3」)', ()=>{
	expect(timeBasisLabel(0)).toMatch(/真太阳时/);
	expect(timeBasisLabel(1)).toMatch(/钟表时/);
	expect(timeBasisLabel(2)).toMatch(/春分定卯时/);
	expect(timeBasisLabel(3)).toMatch(/平太阳时/);
	expect(timeBasisLabel(3)).not.toBe('3');
});

it('八字页快照:timeAlg 3 与流派 tongguan 标签在位', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'cntradition', 'BaZi.js'), 'utf8');
	expect(src).toContain("'3': '平太阳时(仅经度)'");
	expect(src).toContain("tongguan: '通关派'");
});
