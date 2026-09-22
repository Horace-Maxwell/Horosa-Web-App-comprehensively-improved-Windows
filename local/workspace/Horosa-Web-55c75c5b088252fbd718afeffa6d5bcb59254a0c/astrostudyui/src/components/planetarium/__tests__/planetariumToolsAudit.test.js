// [Q-244 · TL-07/10/11/12] 天文馆杂项修复的回归锁(源码静态锚 + DateTime 纯逻辑;Babylon 场景 jsdom 不可实例化)。
import fs from 'fs';
import path from 'path';
import DateTime from '../../comp/DateTime';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'PlanetariumBabylon.js'), 'utf8');

describe('TL-07 星等上限:恒星层关时置灰并给一键开恒星', ()=>{
	test('滑块带 disabled={!this.state.layers.stars} 与提示行', ()=>{
		expect(SRC).toContain('disabled={!this.state.layers.stars}');
		expect(SRC).toContain('data-mag-limit-hint="1"');
		expect(SRC).toContain("onClick={()=>this.toggleLayer('stars')}");
	});
});

describe('TL-12 死键与无入口代码已清', ()=>{
	test('DEFAULT_LAYERS 无 qizheng 键;无 riseSetRequested / toggleRiseSet / toggleFullscreen / groundDisk / paintGroundSurface', ()=>{
		const layersBlock = SRC.slice(SRC.indexOf('const DEFAULT_LAYERS = {'), SRC.indexOf('};', SRC.indexOf('const DEFAULT_LAYERS = {')));
		expect(/^\s*qizheng:/m.test(layersBlock)).toBe(false);
		['riseSetRequested', 'toggleRiseSet', 'toggleFullscreen(', 'groundDisk', 'paintGroundSurface', 'layers.groundProcedural'].forEach((k)=>{ expect(SRC.indexOf(k)).toBe(-1); });
		// 升落时刻仍每次请求都带(不是开关)
		expect(SRC).toContain('extras.includeRiseSet = 1;');
	});
});

describe('TL-10 回命盘地点连时区一起还原', ()=>{
	test('observerOverride 记 prevZone;clearObserverOverride 按 prevZone 回设时区', ()=>{
		expect(SRC).toContain('prevZone,');
		const i = SRC.indexOf('clearObserverOverride(){');
		const body = SRC.slice(i, SRC.indexOf('\n\t}\n', i));
		expect(body).toContain('observerOverride.prevZone');
		expect(body).toContain('time.setZone(prevZone)');
	});
});

describe('TL-11 「此刻」按面板时区取钟面', ()=>{
	test('nowInZone(zone):钟面 = 该时区此刻;缺省 +08:00 与旧构造器同时区;非法时区按系统偏移', ()=>{
		const a = DateTime.nowInZone('+08:00');
		const b = DateTime.nowInZone('-05:00');
		expect(a.zone).toBe('+08:00');
		expect(b.zone).toBe('-05:00');
		// 两者绝对时刻相同(同一「此刻」),钟面差 13 小时(取整小时比较,容许分钟进位)
		const ha = a.hour + a.minute / 60; const hb = b.hour + b.minute / 60;
		const diff = ((ha - hb) % 24 + 24) % 24;
		expect(Math.abs(diff - 13) < 0.05 || Math.abs(diff - 13 - 24) < 0.05).toBe(true);
		const c = DateTime.nowInZone('乱写');
		expect(/^[+-]\d{2}:\d{2}$/.test(c.zone)).toBe(true);
		const sel = fs.readFileSync(path.join(__dirname, '..', '..', 'comp', 'DateTimeSelector.js'), 'utf8');
		expect(sel).toContain('DateTime.nowInZone(zone)');
		expect(sel.indexOf('let dt = new DateTime();')).toBe(-1);
	});
});
