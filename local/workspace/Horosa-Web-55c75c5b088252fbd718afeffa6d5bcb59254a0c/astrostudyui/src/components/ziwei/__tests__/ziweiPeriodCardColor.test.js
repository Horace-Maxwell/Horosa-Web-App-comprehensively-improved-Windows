// 同一运限层:盘面色 = 右栏运限卡片左边框色(都从 ZWConst.ZWPeriodColor 的主题变量来;流年在盘上是紫、卡片上是蓝 = 图例语义打架)。
import fs from 'fs';
import path from 'path';
import { ZWPeriodColor } from '../../../constants/ZWConst';

const LESS = fs.readFileSync(path.resolve(__dirname, '../../../layouts/app/18-ziwei.less'), 'utf8');
const varName = (v)=>{ const m = /var\(\s*(--[\w-]+)/.exec(`${v || ''}`); return m ? m[1] : null; };

function cardBorders(src){
	const out = {};
	const re = /\.horosa-ziwei-luck-card\.cat-(\w+)\s*\{\s*border-left-color:\s*([^;]+);/g; let m = re.exec(src);
	while(m){ out[m[1]] = m[2].trim(); m = re.exec(src); }
	return out;
}

describe('紫微运限层:盘面色 = 卡片边框色', ()=>{
	it('每个有盘面层色的运限层,卡片边框取同一个主题变量', ()=>{
		const cards = cardBorders(LESS);
		const bad = [];
		Object.keys(ZWPeriodColor).forEach((level)=>{
			const want = varName(ZWPeriodColor[level]);
			const got = varName(cards[level]);
			if(!want || got !== want){ bad.push(`${level}: 盘面 ${ZWPeriodColor[level]} / 卡片 ${cards[level] || '(无)'}`); }
		});
		expect(bad).toEqual([]);
	});
	it('判别力自证:卡片写死另一色被抓', ()=>{
		const cards = cardBorders('.horosa-ziwei-luck-card.cat-liunian { border-left-color: #2868d8; }');
		expect(varName(cards.liunian)).toBe(null);
	});
});
