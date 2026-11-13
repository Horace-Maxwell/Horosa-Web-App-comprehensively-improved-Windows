// 时区显示文本单一来源:一律「UTC±HH:MM」。
// 历史盘的地方平时(+00:53 = 0.8833333333333333 小时)原样拼进界面就是一长串循环小数;
// 四舍五入到一位小数又会把 +00:53 写成 +0.9(失真)。前端 formatZoneLabel 与后端 format_timezone_label 同形。
const fs = require('fs');
const path = require('path');
const { formatZoneLabel } = require('../zoneText');

const UI = path.resolve(__dirname, '../../..');
const read = (rel)=>fs.readFileSync(path.join(UI, rel), 'utf8');

describe('时区显示文本单一来源', ()=>{
	test('各种写法落成同一形', ()=>{
		const rows = [
			[8, 'UTC+08:00'], ['8', 'UTC+08:00'], ['+08:00', 'UTC+08:00'], ['UTC+8', 'UTC+08:00'], ['UTC+8.0', 'UTC+08:00'],
			[0.8833333333333333, 'UTC+00:53'], ['+00:53', 'UTC+00:53'], ['+00:53:28', 'UTC+00:53'], ['UTC+0.883333', 'UTC+00:53'],
			[5.75, 'UTC+05:45'], ['+05:45', 'UTC+05:45'], [-3.5, 'UTC-03:30'], ['GMT-03:30', 'UTC-03:30'],
			[0, 'UTC+00:00'], [-0, 'UTC+00:00'], ['-0.001', 'UTC+00:00'], [14, 'UTC+14:00'], [-12, 'UTC-12:00'], ['东8区', 'UTC+08:00'],
		];
		rows.forEach(([input, want])=>{
			expect([input, formatZoneLabel(input)]).toEqual([input, want]);
		});
	});

	test('空值回空串、认不出的原样返回(不替用户编时区)', ()=>{
		expect(formatZoneLabel(undefined)).toBe('');
		expect(formatZoneLabel(null)).toBe('');
		expect(formatZoneLabel('  ')).toBe('');
		expect(formatZoneLabel('Asia/Shanghai')).toBe('Asia/Shanghai');
	});

	test('输出里绝不出现小数点', ()=>{
		for(let m = -12 * 60; m <= 14 * 60; m += 7){
			const out = formatZoneLabel(m / 60);
			expect([m, /^UTC[+-]\d{2}:\d{2}$/.test(out)]).toEqual([m, true]);
		}
	});

	test('借用紫微中宫的两法、紫微中宫、七政盘心都走单一来源', ()=>{
		const kin = read('src/components/kinastro/KinAstroMain.js');
		expect(/zone:\s*formatZoneLabel\(pan && pan\.timezone\)/.test(kin)).toBe(true);
		expect(/zone:\s*fmtValue\(pan && pan\.timezone\),/.test(kin)).toBe(false);
		expect(read('src/components/ziwei/ZWCenterHouse.js').includes("'时区：' + (formatZoneLabel(chart.zone) || chart.zone)")).toBe(true);
		const wheel = read('src/components/guolao/GuoLaoQizhengWheel.js');
		expect(wheel.includes('formatZoneLabel(pan.timezone)')).toBe(true);
		expect(/\$\{pan\.timezone\}/.test(wheel)).toBe(false);
	});

	test('择日八个工作台、紫微右栏、推运盘、宿盘心、特征页的时区一行都走单一来源', ()=>{
		const benches = ['Bazi', 'India', 'Liureng', 'Qimen', 'Qizheng', 'Sanshi', 'Taiyi', 'Ziwei'].map((n)=>`src/components/zeri/${n}ZeriWorkbench.js`);
		benches.forEach((f)=>{
			const src = read(f);
			expect([f, src.includes('时区 {geo && geo.zone !== undefined ? (formatZoneLabel(geo.zone) || geo.zone)')]).toEqual([f, true]);
			// 不许再有「时区 {geo.zone}」「UTC{geo.zone}」这类直拼
			expect([f, /时区\s*\{\s*geo\.zone\s*\}|UTC\$?\{\s*geo\.zone\s*\}/.test(src)]).toEqual([f, false]);
		});
		expect(read('src/components/ziwei/ZiWeiMain.js').includes("['时区', formatZoneLabel(chart.zone || getFieldValue(fields, 'zone', '')) || '—']")).toBe(true);
		expect(read('src/components/astro/AstroProgChart.js').includes('本盘时区 ${formatZoneLabel(zone) || zone}')).toBe(true);
		expect(read('src/components/su28/HouseSuCenter.js').includes("'时区：' + (formatZoneLabel(this.fields.zone.value) || this.fields.zone.value)")).toBe(true);
		expect(read('src/components/su28/Su28ChartCircle.js').includes("'时区：' + (formatZoneLabel(params.zone.value) || params.zone.value)")).toBe(true);
		expect(read('src/components/deeplearn/DLFeature.js').includes('时区：${formatZoneLabel(this.props.zone.value)')).toBe(true);
	});

	test('后端各服务的时区行不再用 :+g / :+.1f 直拼小时数', ()=>{
		const dir = path.resolve(UI, '../astropy/websrv');
		if(!fs.existsSync(dir)){ return; }
		const bad = fs.readdirSync(dir).filter((f)=>/\.py$/.test(f)).filter((f)=>{
			const src = fs.readFileSync(path.join(dir, f), 'utf8');
			return /f"UTC\{[^}]*:\+(?:g|\.\df)\}"/.test(src);
		});
		expect(bad).toEqual([]);
		expect(fs.readFileSync(path.join(dir, 'horosa_engine_common.py'), 'utf8').includes('def format_timezone_label(')).toBe(true);
	});
});
