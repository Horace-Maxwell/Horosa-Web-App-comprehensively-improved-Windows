// 六壬盘头起课时刻:称呼与取值都跟随时间算法。后端 nongli.birth 恒写真太阳时(六壬不传农历时间算法),
// 选「直接时间」时改取钟表时 nongli.clockTime 并标「直接时间」;默认 / 真太阳时照旧。
// 时间算法从页面经 LiuRengChart 传到 RengChart,切换即重画。
import fs from 'fs';
import path from 'path';
import RengChart from '../RengChart';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const R = (f) => readSource(path.join(__dirname, '..', f));
const NONGLI = { birth: '2026-05-05 09:47:12', clockTime: '2026-05-05 12:00:00' };   // 乌鲁木齐 12:00 钟表 → 真太阳时约 09:47

describe('六壬盘头时间', () => {
	const at = (timeAlg, nongli) => {
		const self = { timeAlg, nongli };
		self.birthTimeRaw = RengChart.prototype.birthTimeRaw;
		return {
			label: RengChart.prototype.birthTimeLabel.call(self),
			raw: RengChart.prototype.birthTimeRaw.call(self),
			text: RengChart.prototype.formatTrueSolarTime.call(self),
		};
	};
	test('直接时间:标「直接时间」,取钟表时(不是真太阳时)', () => {
		expect(at(1, NONGLI)).toEqual({ label: '直接时间', raw: '2026-05-05 12:00:00', text: '2026-05-05 12:00:00' });
	});
	test('真太阳时 / 缺省:标「真太阳时」,取真太阳时', () => {
		expect(at(0, NONGLI)).toEqual({ label: '真太阳时', raw: '2026-05-05 09:47:12', text: '2026-05-05 09:47:12' });
		expect(at(undefined, NONGLI).label).toBe('真太阳时');
	});
	test('后端没给钟表时(旧响应):回落真太阳时并如实标「真太阳时」,不出现标签与数值错配', () => {
		expect(at(1, { birth: NONGLI.birth })).toEqual({ label: '真太阳时', raw: NONGLI.birth, text: NONGLI.birth });
		expect(at(1, null).raw).toBe('');
	});
	test('盘头三处都用跟随的标签与取值;页面传入、子组件透传并在变化时重画', () => {
		const chart = R('RengChart.js');
		expect(chart).not.toMatch(/'真太阳时:' \+ this\.nongli\.birth/);
		expect(chart).toContain('`${this.birthTimeLabel()}：${trueSolar}；八字：${pillarText}`');
		expect(chart.match(/this\.birthTimeLabel\(\) \+ ':' \+ this\.birthTimeRaw\(\)/g).length).toBe(2);
		const host = R('LiuRengChart.js');
		expect(host).toContain('timeAlg: this.props.timeAlg,');
		expect(host).toContain('this.rengchart.timeAlg = this.props.timeAlg;');
		expect(host).toContain('|| prevProps.timeAlg !== this.props.timeAlg');
		expect(R('LiuRengMain.js')).toContain('timeAlg={this.state.timeAlg}');
	});
});
