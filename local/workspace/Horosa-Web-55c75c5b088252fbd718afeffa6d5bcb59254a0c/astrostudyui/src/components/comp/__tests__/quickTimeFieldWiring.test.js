// 接线哨兵:五个站点走共享触发件、三张表单有快捷输入行且位于选择器行与时区栏之间、起课标签改名、无 maxLength、帮助文档写了双击
const fs = require('fs');
const path = require('path');
const src = (rel)=>fs.readFileSync(path.join(__dirname, '../../..', rel), 'utf8');

describe('快捷数字时间录入·接线', ()=>{
	it('三主站点 + 两次级站点用 TimeFieldTrigger,手抄 Popover 时间块清零', ()=>{
		['components/comp/SpaceTimePanel.js', 'components/astro/AstroChartMain.js', 'components/divination/DivinationChartShell.js', 'components/horary/HoraryMain.js', 'components/mundane/MundaneMain.js'].forEach((f)=>{
			const s = src(f);
			expect(s.indexOf('<TimeFieldTrigger') >= 0 ? 'ok' : `${f} 未用 TimeFieldTrigger`).toBe('ok');
			expect(/<Popover[^>]*content=\{timeEditor\}/.test(s) ? `${f} 仍有手抄块` : 'ok').toBe('ok');
		});
	});
	it('三张表单:快捷输入行在选择器行之后、时区栏之前', ()=>{
		['components/user/ChartData.js', 'components/user/CaseData.js', 'components/comp/ChartFormData.js'].forEach((f)=>{
			const s = src(f);
			expect(/<\/Row>[\s)}]*(\{ needDate && )?<QuickTimeInput[\s\S]{0,400}<DstZoneIndicator/.test(s) ? 'ok' : `${f} 快捷输入行位置不对`).toBe('ok');
		});
	});
	it('起课表单标签「起课时间：」;无「起课事件：」', ()=>{
		const s = src('components/user/CaseData.js');
		expect(s.indexOf('起课时间：')).toBeGreaterThan(0);
		expect(s.indexOf('起课事件：')).toBe(-1);
	});
	it('天文馆时间行走 QuickTimeText(单击开编辑面板不变,双击键入)', ()=>{
		const s = src('components/planetarium/PlanetariumBabylon.js');
		expect(/<QuickTimeText[^>]*onClick=\{this\.toggleTimeEditor\}[^>]*onQuickCommit=\{this\.quickCommitObserverTime\}/.test(s) ? 'ok' : '天文馆时间行未接 QuickTimeText').toBe('ok');
		expect(/<div ref=\{this\._timeDisplayRef\}/.test(s) ? '仍有手写时间行' : 'ok').toBe('ok');
	});
	it('全站日期/时间/区间选择框都经 xq-ui 数字快输宿主:组件层不再直接引 antd DatePicker/TimePicker', ()=>{
		const walk = (dir)=>fs.readdirSync(dir).flatMap((n)=>{ const p = path.join(dir, n); return fs.statSync(p).isDirectory() ? walk(p) : (/\.js$/.test(n) ? [p] : []); });
		const root = path.join(__dirname, '../../..', 'components');
		const bad = walk(root).filter((p)=>!/xq-ui[\/\\]index\.js$/.test(p) && !/__tests__/.test(p)).filter((p)=>{
			const code = fs.readFileSync(p, 'utf8').split('\n').map((l)=>l.replace(/\/\/.*$/, '')).join('\n');
			return /import\s*\{[^}]*\b(DatePicker|TimePicker)\b[^}]*\}\s*from\s*'antd'/.test(code);
		}).map((p)=>path.relative(root, p));
		expect(bad).toEqual([]);
		const xq = src('components/xq-ui/index.js');
		['export function XQDatePicker', 'export function XQTimePicker', 'export function QuickDigitsHost', 'XQDatePicker.RangePicker = function XQRangePicker'].forEach((k)=>{
			expect(xq.indexOf(k) >= 0 ? 'ok' : `xq-ui 缺 ${k}`).toBe('ok');
		});
		expect((xq.match(/<QuickDigitsHost/g) || []).length).toBe(3);
	});
	it('共享件不设 maxLength(粘贴带分隔符会先被截断)', ()=>{
		expect(src('components/comp/QuickTimeField.js').indexOf('maxLength')).toBe(-1);
	});
	it('帮助文档写了双击键入', ()=>{
		['components/help/AstroHelpDoc.js', 'components/help/BaziHelpDoc.js', 'components/help/AuxchartHelpDoc.js', 'components/help/DunjiaHelpDoc.js', 'components/help/ShusuanHelpDoc.js', 'components/help/SanshiHelpDoc.js'].forEach((f)=>{
			expect(src(f).indexOf('双击') >= 0 ? 'ok' : `${f} 未写`).toBe('ok');
		});
	});
});
