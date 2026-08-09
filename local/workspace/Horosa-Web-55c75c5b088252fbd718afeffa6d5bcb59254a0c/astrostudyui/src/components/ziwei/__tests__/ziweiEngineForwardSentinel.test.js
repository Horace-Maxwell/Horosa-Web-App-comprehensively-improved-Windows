// 紫微引擎键「转发链」双哨兵:UI→ZWEngineOptions→ZiWeiMain opts→calcZiwei ctx 三跳链
// 曾因三处手抄清单漏抄断线(changshengStart/kuiYue 真机死开关;金标全走 assembleNatalChart
// 绕过 calcZiwei 断点没抓到=测试盲区)。此后三消费点全 spread ZW_ENGINE_FORWARD_KEYS,
// 本哨兵①行为层:逐键探针**全走 calcZiwei 入口**证「转了且用了」②清单层:表与判据集合对账。
jest.mock('d3', () => ({}));
import { calcZiwei } from '../ZiweiCalc';
import { ZWEngineOptions, ZW_ENGINE_FORWARD_KEYS, collectEngineOpts, ziweiNeedsLocalEngine } from '../ziweiOptions';

const BIRTH = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, ad: 1, gender: 1 };
// 庚年生辰(魁钺档敏感):1990=庚午
const BIRTH_GENG = BIRTH;

function findHouseOf(chart, starName){
	for(let i = 0; i < 12; i++){
		const groups = ['starsMain', 'starsAssist', 'starsEvil', 'starsOthersGood', 'starsOthersBad', 'starsSmall'];
		for(const g of groups){
			if((chart.houses[i][g] || []).some((s) => s.name === starName)){ return i; }
		}
	}
	return -1;
}

describe('[A1] 引擎键转发行为哨兵(全走 calcZiwei 入口,防「转了没用」)', () => {
	test('🔴 kuiYue:庚年两档天魁移位(丑→午)——经 calcZiwei 全链', () => {
		const a = calcZiwei(BIRTH_GENG, { kuiYue: 'jia_wu_geng' });
		const b = calcZiwei(BIRTH_GENG, { kuiYue: 'geng_ma_hu' });
		expect(findHouseOf(a, '天魁')).toBe(1);   // 丑
		expect(findHouseOf(b, '天魁')).toBe(6);   // 午
		expect(findHouseOf(b, '天钺')).toBe(2);   // 寅
	});
	test('🔴 changshengStart:两档经 calcZiwei 产生差异(或土五局长生移位)', () => {
		// 用 assemble 快扫找一个土五局生辰不可行(calcZiwei 吃真实生辰)——直接断言:
		// 两档在「同生辰」下 phase 序列要么全同(非土五局)要么整移;并用已知土五局命例锚定。
		const a = calcZiwei(BIRTH, { changshengStart: 'shui_tu' });
		const b = calcZiwei(BIRTH, { changshengStart: 'huo_tu' });
		const pa = a.houses.map((h) => h.phase).join('');
		const pb = b.houses.map((h) => h.phase).join('');
		if(a.wuxingJu === 5){
			expect(pb).not.toBe(pa);
		}else{
			expect(pb).toBe(pa);
			// 土五局锚:换时辰扫出一个土五局生辰(时轴不改年月日)
			let found = null;
			for(const t of ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22']){
				const c = calcZiwei({ ...BIRTH, time: `${t}:30:00` }, {});
				if(c.wuxingJu === 5){ found = `${t}:30:00`; break; }
			}
			if(found){
				const x = calcZiwei({ ...BIRTH, time: found }, { changshengStart: 'shui_tu' });
				const y = calcZiwei({ ...BIRTH, time: found }, { changshengStart: 'huo_tu' });
				const px = x.houses.findIndex((h) => h.phase === '长生');
				const py = y.houses.findIndex((h) => h.phase === '长生');
				expect((py - px + 12) % 12).toBe(6);   // 申↔寅对宫整移
			}
		}
	});
	test('其余转发键逐键敏感探针(经 calcZiwei 产生可观测差异)', () => {
		const base = calcZiwei(BIRTH, {});
		// daxianSpan:direction 跨度变
		const ju = calcZiwei(BIRTH, { daxianSpan: 'ju' });
		expect(ju.houses[ju.lifeHouseIndex].direction[1] - ju.houses[ju.lifeHouseIndex].direction[0] + 1).toBe(ju.wuxingJu);
		// tianmaBasis:年马消失
		const ym = calcZiwei(BIRTH, { tianmaBasis: 'year' });
		expect(findHouseOf(base, '年马')).toBeGreaterThanOrEqual(0);
		expect(findHouseOf(ym, '年马')).toBe(-1);
		// starSet:精简后杂曜清空
		const n18 = calcZiwei(BIRTH, { starSet: 'north18' });
		expect(n18.houses.reduce((a, h) => a + h.starsOthersGood.length, 0)).toBe(0);
		// huoling:南派火星位=子时位(与默认盘可能同可能异——断言南派任意时辰恒同子时)
		const np = calcZiwei(BIRTH, { huoling: 'nanpai' });
		const npZi = calcZiwei({ ...BIRTH, time: '00:30:00' }, { huoling: 'nanpai' });
		expect(findHouseOf(np, '火星')).toBe(findHouseOf(npZi, '火星'));
		// kongNaming:book 档地空改名天空
		const book = calcZiwei(BIRTH, { kongNaming: 'book' });
		expect(findHouseOf(book, '地空')).toBe(-1);
		// lifeMasterBy:ming_branch 命主=命宫支值
		const mb = calcZiwei(BIRTH, { lifeMasterBy: 'ming_branch' });
		const { LIFE_MASTER } = require('../data/ziweiTables');
		expect(mb.lifeMaster).toBe(LIFE_MASTER[mb.houses[mb.lifeHouseIndex].ganzi.charAt(1)]);
		// shangShi/leapMonth 已有 calcZiwei 级金标(ziweiCalc.test),此处不重复
	});
});

describe('[A1] 转发清单哨兵(表与集合对账)', () => {
	test('FORWARD_KEYS ⊆ ZWEngineOptions 实有键', () => {
		ZW_ENGINE_FORWARD_KEYS.forEach((k) => {
			expect(Object.prototype.hasOwnProperty.call(ZWEngineOptions, k)).toBe(true);
		});
	});
	test('🔴 needsLocalEngine 源码引用的键 ⊆ FORWARD ∪ 显式豁免(新引擎键漏进转发表当场红)', () => {
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'ziweiOptions.js'), 'utf8');
		const fnBody = src.slice(src.indexOf('function ziweiNeedsLocalEngine'), src.indexOf('}', src.indexOf('function ziweiNeedsLocalEngine')));
		const used = [...fnBody.matchAll(/ZWEngineOptions\.(\w+)/g)].map((m) => m[1]);
		// 豁免登记(各层自消费,不走 assembleNatalChart ctx):
		const EXEMPT = ['lateZi', 'yearBoundary', 'sanPan'];
		used.forEach((k) => {
			expect(`${k}:${ZW_ENGINE_FORWARD_KEYS.includes(k) || EXEMPT.includes(k)}`).toBe(`${k}:true`);
		});
	});
	test('collectEngineOpts 逐键取值(含 undefined 透传语义)', () => {
		const src = { daxianSpan: 'ju', kuiYue: 'geng_ma_hu' };
		const out = collectEngineOpts(src);
		expect(out.daxianSpan).toBe('ju');
		expect(out.kuiYue).toBe('geng_ma_hu');
		expect(Object.keys(out).sort()).toEqual([...ZW_ENGINE_FORWARD_KEYS].sort());
	});
	test('🔴 ZiWeiMain 两处 opts 与 ZiweiCalc ctx 均 spread collectEngineOpts(禁手抄回潮)', () => {
		const fs = require('fs'); const path = require('path');
		const main = fs.readFileSync(path.resolve(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
		expect((main.match(/\.\.\.collectEngineOpts\(ZWEngineOptions\)/g) || []).length).toBe(2);
		const calc = fs.readFileSync(path.resolve(__dirname, '..', 'ZiweiCalc.js'), 'utf8');
		expect(calc).toContain('...collectEngineOpts(options)');
	});
});
