// 风水 · 理气/水法/大卦/形势/择日 统一工作区（十一派 左参数 / 中SVG盘 / 右断事）。自含 state + useMemo 实时重算。
// 与户型图两法(canvas)互斥;选纯前端流派时由 FengShuiMain 渲染本组件。
// 组件在这里;模块级助手按职责拆在 liqiWorkspace/ 下:options(选项表、吉凶配色、缺省状态) → compute(按流派分派重算、罗盘读数、坐山流年查验)
//   → snapshot(AI 快照正文、流派中文名)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { XQSelect, XQSegmented, XQInputNumber } from '../xq-ui';
import { XQCurrentMark } from '../xq-icons';
import CompactTimeField from '../comp/CompactTimeField';
import DateTime from '../comp/DateTime';
import { getLayoutViewportHeight } from '../../utils/shellZoom';   // horosa_luopan_dial_viewport_cap_v1:罗盘直径按可视高度封顶
import LuoshuGrid from './charts/LuoshuGrid';
import TwentyFourShanRing from './charts/TwentyFourShanRing';
import EightPalaceDisk from './charts/EightPalaceDisk';
import SixtyFourGuaRing from './charts/SixtyFourGuaRing';
import LuopanDial from './charts/LuopanDial';
import XianfaRing from './charts/XianfaRing';
import SixtyFourGuaCircle from './charts/SixtyFourGuaCircle';
import XingshiFormGallery from './charts/XingshiFormGallery';
import { jinsuoXingOptionsFor, pruneJinsuoXing } from './jinsuo';
import { YONGSHI_ALL } from './zeriDeep';
import { LUOPAN_TYPES } from './fengshuiLuopanData';
import { DECLINATION_TABLE } from './fengshuiDeclinationData';
import { duanyuByPan, XUANKONG_DUANYU, DUANYU_SOURCES, DUANYU_MISSING_NOTE, DUANYU_INDEX_NOTE } from './fengshuiDuanyuData';
import { XINGSHI_TABLES } from './xingshi';
import { XUANKONG_SCHOOLS, JIAN_BOUNDARY_NOTE, LUOPAN_LAYERS, LUOPAN_DEFAULT_LAYERS, SHAN_CENTER_DEG } from './fengshuiData';
import { implOf } from './liqi/registry';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { renderInlineBold, deepInlineBold } from './fengshuiRichText';   // 条文 `**要点**` 行内加粗

import { createDeferredResizeObserver } from '../../utils/deferredResizeObserver';
import { civilLastDayOfMonth } from '../../utils/civilCalendar';
import { LUOPAN_RULE_LABEL, LUOPAN_RULE_JX, SHAN_OPTS, oppositeShan, GUA8, GUA8_OPTS, GANZHI60, STAR09_OPTS, GONG9_OPTS, YUN_OPTS, TIVAR_OPTS, SK_OPTS, XIANGFA_OPTS, SAND_WATER, COME_GO, ZHAI_TYPE_OPTS, QK_POS9, FROM_OPTS, XK_SCHOOL_OPTS, JIANB_OPTS, WUHUANG_OPTS, JINSUO_GUA_SHANS, BOSHA_OPTS, LUOPAN_LAYER_OPTS, YINYANG_OPTS, JX_CLASS, NUM_GUA, ON_OFF_USE } from './liqiWorkspace/options';
import { LIQI_UNAVAILABLE_HINT, computeLiqi, zuoShanYearCheck } from './liqiWorkspace/compute';
import { buildSnapshot, SCHOOL_CN } from './liqiWorkspace/snapshot';
export { liqiDefaultState } from './liqiWorkspace/options';
export { LIQI_UNAVAILABLE_HINT, computeLiqi, luopanReading, zuoShanYearCheck } from './liqiWorkspace/compute';
export { buildSnapshot, SCHOOL_CN } from './liqiWorkspace/snapshot';
export default function LiqiWorkspace({ school, geo = null, active = true }) {
	// 中栏可用面积量测:综合罗经按 min(宽,高) 打满可视区(不超屏、不留大片空白)。
	const chartBoxRef = useRef(null);
	const [chartBox, setChartBox] = useState({ w: 0, h: 0 });
	useEffect(()=>{
		const el = chartBoxRef.current;
		if(!el || typeof ResizeObserver === 'undefined'){ return undefined; }
		const ro = createDeferredResizeObserver((entries)=>{
			const r = entries[0] && entries[0].contentRect;
			if(r){ setChartBox((prev)=>(Math.abs(prev.w - r.width) > 2 || Math.abs(prev.h - r.height) > 2 ? { w: r.width, h: r.height } : prev)); }
		});
		ro.observe(el);
		return ()=>ro.disconnect();
	}, []);
	const [xiangShan, setXiangShan] = useState('午');
	const [yun, setYun] = useState(9);
	const [year, setYear] = useState(new Date().getFullYear());
	const [zuoGua, setZuoGua] = useState('坎');
	const [ming, setMing] = useState({ year: null, isMale: true });   // 命主年缺省空:未录命主不再按 1990·男 算命卦进快照
	const [shuiKou, setShuiKou] = useState('戌');
	const [waterFlow, setWaterFlow] = useState('leftToRight');
	const [sectors, setSectors] = useState({});
	const [waters, setWaters] = useState({});
	const [jian, setJian] = useState(false);
	const [tiVariant, setTiVariant] = useState('shen');
	const [month, setMonth] = useState(0);
	const [zhaiMode, setZhaiMode] = useState('zhai');
	// 深化/新派参数。
	// xiangFaType 初值必须是 ''（按水势自动），否则「水势」控件恒被覆盖成死开关。
	// 零回归：水势默认 leftToRight → 引擎 defType 仍取 '正旺向'，与旧写死初值同结果。
	const [sanheDeep, setSanheDeep] = useState({ xiangFaType: '', zuoDeg: '', boshaVariant: 'shuangshan', zuoShanForBosha: '子', laiLong: '' });
	const [sands, setSands] = useState({});
	const [bazhaiDeep, setBazhaiDeep] = useState({ doorGua: '', mainGua: '', stoveGua: '', zhaiType: 'jing', faMai: 'zuoshan', lunMing: true });
	// 玄空：门派/兼向度界/五黄分运 三者彼此独立（门派只带描述与侧重，不暗改替星与度界）。
	const [xkDeep, setXkDeep] = useState({ deg: '', yinYangZhai: 'yang', school: 'shen', jianBoundary: 3, wuHuangSplit: 'xiagua', shousha: {} });
	const [zbDate, setZbDate] = useState({ m: '', d: '', hour: '' });
	const [fx, setFx] = useState({ benGua: '坎', qiFrom: 'xiang' });
	const [fxWaters, setFxWaters] = useState({});
	const [jy, setJy] = useState({ long: '乾', xiang: '甲', water: '坤' });
	const [dg, setDg] = useState({ lower: '乾', upper: '乾', yunScheme: 'struct', xiangYun: '', zuoYun: '', deg: '',
		showDeep: false, longLower: '', longUpper: '', chouYao: 0 });
	// 形势 sel 显式初值（此前多键以 undefined 起步）；shaYouQing 必须是 null 而非 false —— false 记 −1 分。
	const [xs, setXs] = useState({
		longSheng: true, longStar: '', boHuan: false, guoXiaGood: false,
		xueType: '', dingXue: '', zhengXue: [], daoZhang: '',
		shaYouQing: null, guiSha: [], xiongSha: [],
		shuiCheng: '', laiShuiKai: false, quShuiGuan: false, xiangChaoJi: false, xiangChongSha: false,
	});
	const [zr, setZr] = useState({ year: new Date().getFullYear(), zuoShan: '子', m: '', d: '', laiLong: '', zhuYear: '', zhuMale: true,
		showDeep: false, yongShi: '', hourGanZhi: '', zibaiA: 0, zibaiB: 0, chongFuStar: 0, chongFuGong: 0, dongCombo: '', yun: 9 });
	// 新增三派 + 金锁应期。
	const [jsDeep, setJsDeep] = useState({ yun: 9, year: new Date().getFullYear(), gran: 'gong8' });
	const [jsShans, setJsShans] = useState({});
	const [jsXings, setJsXings] = useState({});
	const [lf, setLf] = useState({ yun: 9, zuoShan: '子', xiangShan: '午', year: new Date().getFullYear() });
	const [ml, setMl] = useState({ mingYear: null, isMale: true, zhaiZuoGua: '坎' });   // 命主年缺省空
	const [lp, setLp] = useState({ deg: 0, zuoShan: '子', xiangShan: '午', layers: LUOPAN_DEFAULT_LAYERS,
		panType: 'zonghe', jianShan: '', jianDeg: 0, jianSchool: 'xuankong',
		city: '', trueDeg: '', decSource: 'book',
		isDanyuan: false, hasWater: null, hasMingtang: null, mingtangDominant: null,
		fourSidesSimilar: null, innerOuterMatch: null, outerStrong: null });
	// registry 派（新派）共用一份 state：{ [school]: patchObj }；取值时与该派 defaults 合并。
	// 旧十四派保持各自 useState 不动 —— 迁移零收益高风险。
	const [regStates, setRegStates] = useState({});
	const impl = implOf(school);
	const regP = impl ? { ...impl.defaults, ...(regStates[school] || {}) } : null;
	const regPatch = (patch)=>setRegStates((prev)=>({ ...prev, [school]: { ...(prev[school] || {}), ...patch } }));

	const result = useMemo(()=>computeLiqi(school, { xiangShan, yun, year, month, jian, tiVariant, zuoGua, ming, shuiKou, waterFlow, sectors, waters, zhaiMode, sanheDeep, sands, bazhaiDeep, xkDeep, zbDate, fx, fxWaters, jy, dg, xs, zr, jsDeep, jsShans, jsXings, lf, ml, lp, regStates }, { geo }),
	[school, impl, regStates, xiangShan, yun, year, month, jian, tiVariant, zuoGua, ming, shuiKou, waterFlow, sectors, waters, zhaiMode, sanheDeep, sands, bazhaiDeep, xkDeep, zbDate, fx, fxWaters, jy, dg, xs, zr, jsDeep, jsShans, jsXings, lf, ml, lp, geo]);

	useEffect(()=>{
		if (active === false) { return; }   // 隐藏保活期间不写快照(画布派快照为准);切回时按 active 依赖重存
		if (!result || !result.available) { return; }
		const text = buildSnapshot(school, result);
		if (text) { saveModuleAISnapshot('fengshui', text, { source: 'liqi', school }); }
	}, [result, school, active]);

	if (!result) { return null; }
	// 参数不全时各派 compute 返回 { available:false }(如命理派命主年缺省为空)——盘与右栏都读不到字段,
	// 一律在这里收口成提示,不进各派的 renderChart / renderPanel(此前命理派直接读 fangwei.map 让整个风水页报错,
	// 且流派随页保存,之后每次进页都报错)。左栏参数照常显示,补齐即排盘。
	const unavailable = result.available === false;

	return (
		<div className="horosa-fengshui-liqi">
			<div className="horosa-fengshui-liqi-params">{renderParams()}</div>
			<div className="horosa-fengshui-liqi-chart" ref={chartBoxRef}>{unavailable ? <div className="horosa-empty-line horosa-fengshui-liqi-unavailable" role="note">{LIQI_UNAVAILABLE_HINT[school] || LIQI_UNAVAILABLE_HINT.default}</div> : renderChart()}</div>
			<div className="horosa-fengshui-liqi-panel">{unavailable ? null : renderPanel()}</div>
		</div>
	);

	function sel(label, value, opts, onCh, key) {
		return (
			<label key={key} className="horosa-fengshui-liqi-field"><span>{label}</span>
				<XQSelect value={value} options={opts} onChange={(ev)=>onCh(ev && ev.target ? ev.target.value : ev)} dropdownMatchSelectWidth={false} /></label>
		);
	}
	function segField(label, value, opts, onCh, key) {
		return (
			<label key={key} className="horosa-fengshui-liqi-field"><span>{label}</span>
				<XQSegmented value={value} options={opts} onChange={(ev)=>onCh(ev.target ? ev.target.value : ev)} /></label>
		);
	}
	// 该月最后一天(民用历单源:1500-02 有 29 日;lunar-javascript 对 2 月 31 日不报错而滚到下月,日框须按月夹取)
	function daysInMonthOf(y, m) {
		const yy = +y, mm = +m;
		if (!Number.isInteger(yy) || yy === 0 || !Number.isInteger(mm) || mm < 1 || mm > 12) { return 31; }
		return civilLastDayOfMonth(yy, mm);
	}
	function clampDay(y, m, d) {
		if (d === '' || d === null || d === undefined) { return d; }
		const n = +d;
		if (!Number.isFinite(n)) { return d; }
		return String(Math.max(1, Math.min(daysInMonthOf(y, m), Math.trunc(n))));
	}
	// 数字框走全站数字输入(步进箭头 / 主题 / 焦点环与别页一致);对外仍是字符串口径:清空回 ''。
	function numField(label, value, onCh, extra = {}, key) {
		const n = (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) ? null : Number(value);
		return (
			<label key={key} className="horosa-fengshui-liqi-field"><span>{label}</span>
				<XQInputNumber value={n} onChange={(v)=>onCh(v === null || v === undefined ? '' : `${v}`)} {...extra} /></label>
		);
	}
	// 日期走全站时间组件(单击弹编辑器、双击键入;只选日期)。未填(月 / 日为空)= 不启用,先给一个开关。
	// 不用 <label> 包:标签会把点击再转发给里面的触发块,弹层一开即关。
	function dateField(label, y, m, d, onPick, key) {
		const dt = new DateTime();
		dt.setDateTime(Number(y) || dt.year, Number(m) || 1, Number(d) || 1, 0, 0, 0);
		return (
			<div key={key} className="horosa-fengshui-liqi-field horosa-fengshui-liqi-date"><span>{label}</span>
				<CompactTimeField label="" hint="" noAdjust needZone={false} showTime={false} value={dt}
					timeText={dt.format('YYYY-MM-DD')}
					onChange={(res)=>{ const t = res && res.time; if(t){ onPick(t.year, t.month, t.date); } }} /></div>
		);
	}
	function todayMD() {
		const now = new Date();
		return { m: `${now.getMonth() + 1}`, d: `${now.getDate()}` };
	}

	function renderParams() {
		if (impl) { return <impl.Params p={regP} patch={regPatch} ui={{ sel, segField, numField }} />; }
		if (school === 'xuankong') {
			return (<>
				{sel('门派', xkDeep.school, XK_SCHOOL_OPTS, pickXkSchool)}
				{sel('元运', yun, YUN_OPTS, setYun)}
				{sel('向首', xiangShan, SHAN_OPTS, setXiangShan)}
				{numField('向首度数(空=不用)', xkDeep.deg, (v)=>setXkDeep({ ...xkDeep, deg: v }), { min: 0, max: 360, step: 0.5 })}
				{segField('起卦法', jian ? 'y' : 'n', [{ value: 'n', label: '下卦(正向)' }, { value: 'y', label: '替卦(兼向)' }], (v)=>setJian(v === 'y'))}
				{jian ? sel('替星方案', tiVariant, TIVAR_OPTS, setTiVariant) : null}
				{segField('兼向度界', `${xkDeep.jianBoundary}`, JIANB_OPTS, (v)=>setXkDeep({ ...xkDeep, jianBoundary: Number(v) }))}
				{segField('五黄分运', xkDeep.wuHuangSplit, WUHUANG_OPTS, (v)=>setXkDeep({ ...xkDeep, wuHuangSplit: v }))}
				{segField('阴阳宅', xkDeep.yinYangZhai, YINYANG_OPTS, (v)=>setXkDeep({ ...xkDeep, yinYangZhai: v }))}
				{numField('流年', year, (v)=>setYear(+v || year), { min: 1864, max: 2043 })}
				{numField('流月(0=不显)', month, (v)=>setMonth(Math.max(0, Math.min(12, +v || 0))), { min: 0, max: 12 })}
				<div className="horosa-fengshui-liqi-subhead">八方实况（收山出煞）</div>
				{[{ g: 1, n: '坎(北)' }, { g: 2, n: '坤(西南)' }, { g: 3, n: '震(东)' }, { g: 4, n: '巽(东南)' },
					{ g: 6, n: '乾(西北)' }, { g: 7, n: '兑(西)' }, { g: 8, n: '艮(东北)' }, { g: 9, n: '离(南)' }].map((o)=>sel(o.n,
					(xkDeep.shousha || {})[o.g] || '',
					[{ value: '', label: '未定' }, { value: 'shan', label: '见山' }, { value: 'gao', label: '高物/建筑' }, { value: 'shui', label: '见水' }, { value: 'kong', label: '空地/低洼' }],
					(v)=>setXkDeep({ ...xkDeep, shousha: { ...(xkDeep.shousha || {}), [o.g]: v } }), `ss-${o.g}`))}
			</>);
		}
		if (school === 'sanhe') {
			return (<>
				{sel('水口(去水)', shuiKou, SK_OPTS, setShuiKou)}
				{segField('水势', waterFlow, [{ value: 'leftToRight', label: '左水倒右' }, { value: 'rightToLeft', label: '右水倒左' }], setWaterFlow)}
				{sel('立向法', sanheDeep.xiangFaType, XIANGFA_OPTS, (v)=>setSanheDeep({ ...sanheDeep, xiangFaType: v }))}
				{numField('坐山度数(线法·0-360)', sanheDeep.zuoDeg, (v)=>setSanheDeep({ ...sanheDeep, zuoDeg: v }), { min: 0, max: 360, step: 0.5 })}
				{segField('消砂取「我」', sanheDeep.boshaVariant, BOSHA_OPTS, (v)=>setSanheDeep({ ...sanheDeep, boshaVariant: v }))}
				{sanheDeep.boshaVariant === 'laigong' ? sel('坐山(中针取我)', sanheDeep.zuoShanForBosha, SHAN_OPTS, (v)=>setSanheDeep({ ...sanheDeep, zuoShanForBosha: v })) : null}
				{sel('来龙(格龙·空=不评)', sanheDeep.laiLong, [{ value: '', label: '（不评）' }, ...SHAN_OPTS], (v)=>setSanheDeep({ ...sanheDeep, laiLong: v }))}
				<div className="horosa-fengshui-liqi-subhead">八方砂（拨砂）</div>
				{GUA8_OPTS.map((o)=>segField(`${o.label}方`, sands[o.value] || 'flat', SAND_WATER, (v)=>setSands({ ...sands, [o.value]: v }), `bs-${o.value}`))}
			</>);
		}
		if (school === 'zibai') {
			return (<>
				{numField('年份', year, (v)=>setYear(+v || year))}
				{numField('流月(0=不显)', month, (v)=>setMonth(Math.max(0, Math.min(12, +v || 0))), { min: 0, max: 12 })}
				<div className="horosa-fengshui-liqi-subhead">日/时紫白</div>
				{segField('日紫白', (zbDate.m && zbDate.d) ? 'on' : 'off', ON_OFF_USE,
					(v)=>setZbDate(v === 'on' ? { ...zbDate, ...todayMD() } : { m: '', d: '', hour: '' }))}
				{(zbDate.m && zbDate.d) ? dateField('日期', year, zbDate.m, clampDay(year, zbDate.m, zbDate.d),
					(y, m, d)=>{ setYear(y); setZbDate({ ...zbDate, m: `${m}`, d: `${d}` }); }, 'zb-date') : null}
				{(zbDate.m && zbDate.d) ? numField('时(0-23,空=不显)', zbDate.hour, (v)=>setZbDate({ ...zbDate, hour: v }), { min: 0, max: 23 }) : null}
			</>);
		}
		if (school === 'bazhai') {
			return (<>
				{sel('坐山', zuoGua, GUA8_OPTS, setZuoGua)}
				{numField('命主年（空=未录）', ming.year, (v)=>setMing({ ...ming, year: (v === '' || v === null || v === undefined) ? null : (+v || ming.year) }))}
				{segField('性别', ming.isMale ? 'm' : 'f', [{ value: 'm', label: '男' }, { value: 'f', label: '女' }], (v)=>setMing({ ...ming, isMale: v === 'm' }))}
				{segField('法脉', bazhaiDeep.faMai, [{ value: 'zuoshan', label: '坐山起伏位' }, { value: 'menshang', label: '门上起伏位' }, { value: 'sanyuan', label: '三元阳宅' }], (v)=>setBazhaiDeep({ ...bazhaiDeep, faMai: v }))}
			{bazhaiDeep.faMai === 'sanyuan' ? sel('元运(三元衰旺)', yun, YUN_OPTS, setYun) : null}
			{segField('论命卦', bazhaiDeep.lunMing ? 'y' : 'n', [{ value: 'y', label: '论' }, { value: 'n', label: '不论(真八宅)' }], (v)=>setBazhaiDeep({ ...bazhaiDeep, lunMing: v === 'y' }))}
			{segField('门主灶基准', zhaiMode, [{ value: 'zhai', label: '以宅' }, { value: 'ming', label: '以命' }], setZhaiMode)}
				{sel('进深(静动变化)', bazhaiDeep.zhaiType, ZHAI_TYPE_OPTS, (v)=>setBazhaiDeep({ ...bazhaiDeep, zhaiType: v }))}
				<div className="horosa-fengshui-liqi-subhead">阳宅三要（门/主/灶各在何卦）</div>
				{sel('门卦', bazhaiDeep.doorGua, [{ value: '', label: '（不设）' }, ...GUA8_OPTS], (v)=>setBazhaiDeep({ ...bazhaiDeep, doorGua: v }))}
				{sel('主卦', bazhaiDeep.mainGua, [{ value: '', label: '（不设）' }, ...GUA8_OPTS], (v)=>setBazhaiDeep({ ...bazhaiDeep, mainGua: v }))}
				{sel('灶卦', bazhaiDeep.stoveGua, [{ value: '', label: '（不设）' }, ...GUA8_OPTS], (v)=>setBazhaiDeep({ ...bazhaiDeep, stoveGua: v }))}
			</>);
		}
		if (school === 'qiankun') {
			return (<>
				{sel('坐山', zuoGua, GUA8_OPTS, setZuoGua)}
				<div className="horosa-fengshui-liqi-subhead">九大水位来去水</div>
				{QK_POS9.map((p)=>segField(`${p.label}`, waters[p.key] || '', COME_GO, (v)=>setWaters({ ...waters, [p.key]: v }), `qk-${p.key}`))}
			</>);
		}
		if (school === 'jinsuo') {
			return (<>
				{sel('元运（应期）', jsDeep.yun, YUN_OPTS, (v)=>setJsDeep({ ...jsDeep, yun: +v }))}
				{numField('流年（应期）', jsDeep.year, (v)=>setJsDeep({ ...jsDeep, year: +v || jsDeep.year }), { min: 1864, max: 2043 })}
				{segField('录入粒度', jsDeep.gran, [{ value: 'gong8', label: '八方简式' }, { value: 'shan24', label: '24山细式' }], (v)=>setJsDeep({ ...jsDeep, gran: v }))}
				{jsDeep.gran === 'gong8' ? (<>
					<div className="horosa-fengshui-liqi-subhead">八方砂水</div>
					{GUA8_OPTS.map((o)=>segField(`${o.label}方`, sectors[o.value] || 'flat', SAND_WATER, (v)=>setSectors({ ...sectors, [o.value]: v }), `js-${o.value}`))}
				</>) : (<>
					<div className="horosa-fengshui-liqi-subhead">二十四山砂水（逐山）</div>
					{JINSUO_GUA_SHANS.map(([gua, shans])=>(<div key={`jsg-${gua}`}>
						<div className="horosa-fengshui-liqi-subhead">{gua}宫</div>
						{shans.map((sn)=>(<div key={`jss-${sn}`}>
							{segField(`${sn}山`, jsShans[sn] || 'flat', SAND_WATER, (v)=>{
								setJsShans({ ...jsShans, [sn]: v });
								// 砂 / 水 / 平切换后,原选的形态不在新一侧的档里 → 清掉(此前保留,下拉露出内部键名)
								const nx = pruneJinsuoXing(jsXings, sn, v);
								if(nx !== jsXings){ setJsXings(nx); }
							}, `js24-${sn}`)}
							{/* 只列该山该侧断诀里真会命中的形态(无则不出下拉) */}
							{jsShans[sn] && jsShans[sn] !== 'flat' && jinsuoXingOptionsFor(sn, jsShans[sn]).length
								? sel(`${sn}·形态`, pruneJinsuoXing(jsXings, sn, jsShans[sn])[sn] || '', [{ value: '', label: '（不限形）' },
									...jinsuoXingOptionsFor(sn, jsShans[sn]).map((x)=>({ value: x.key, label: x.label }))],
								(v)=>setJsXings({ ...jsXings, [sn]: v }), `jsx-${sn}`)
								: null}
						</div>))}
					</div>))}
				</>)}
			</>);
		}
		if (school === 'fuxing') {
			return (<>
				{sel('起卦本卦', fx.benGua, GUA8_OPTS, (v)=>setFx({ ...fx, benGua: v }))}
				{sel('起卦来源', fx.qiFrom, FROM_OPTS, (v)=>setFx({ ...fx, qiFrom: v }))}
				<div className="horosa-fengshui-liqi-subhead">八方来去水</div>
				{GUA8_OPTS.map((o)=>segField(`${o.label}方`, fxWaters[o.value] || '', COME_GO, (v)=>setFxWaters({ ...fxWaters, [o.value]: v }), `fx-${o.value}`))}
			</>);
		}
		if (school === 'jingyin') {
			return (<>
				{sel('龙(入首)', jy.long, SHAN_OPTS, (v)=>setJy({ ...jy, long: v }))}
				{sel('向', jy.xiang, SHAN_OPTS, (v)=>setJy({ ...jy, xiang: v }))}
				{sel('水(来水方)', jy.water, SHAN_OPTS, (v)=>setJy({ ...jy, water: v }))}
			</>);
		}
		if (school === 'dagua') {
			const byDeg = dg.deg !== '' && !Number.isNaN(Number(dg.deg));
			return (<>
				{sel('元运', yun, YUN_OPTS, setYun)}
				{numField('向首度数(空=手选上下卦)', dg.deg, (v)=>setDg({ ...dg, deg: v }), { min: 0, max: 360, step: 0.1 })}
				{byDeg ? null : sel('向·下卦(内)', dg.lower, GUA8_OPTS, (v)=>setDg({ ...dg, lower: v }))}
				{byDeg ? null : sel('向·上卦(外)', dg.upper, GUA8_OPTS, (v)=>setDg({ ...dg, upper: v }))}
				{segField('卦运方案', dg.yunScheme, [{ value: 'struct', label: '结构推定' }, { value: 'input', label: '按易盘输入' }], (v)=>setDg({ ...dg, yunScheme: v }))}
				{dg.yunScheme === 'input' ? numField('向卦运(1-9,按易盘)', dg.xiangYun, (v)=>setDg({ ...dg, xiangYun: v }), { min: 1, max: 9 }) : null}
				{dg.yunScheme === 'input' ? numField('坐卦运(1-9,按易盘)', dg.zuoYun, (v)=>setDg({ ...dg, zuoYun: v }), { min: 1, max: 9 }) : null}
				{segField('二元八运·四数·些子', dg.showDeep ? 'on' : 'off', [{ value: 'off', label: '不用' }, { value: 'on', label: '启用' }], (v)=>setDg({ ...dg, showDeep: v === 'on' }))}
				{dg.showDeep ? (<>
					<div className="horosa-fengshui-liqi-subhead">些子法（抽爻换象）</div>
					{sel('来龙·下卦(内)', dg.longLower, [{ value: '', label: '（不设）' }, ...GUA8_OPTS], (v)=>setDg({ ...dg, longLower: v }))}
					{sel('来龙·上卦(外)', dg.longUpper, [{ value: '', label: '（不设）' }, ...GUA8_OPTS], (v)=>setDg({ ...dg, longUpper: v }))}
					{sel('抽第几爻', String(dg.chouYao || 0), [{ value: '0', label: '（不抽）' },
						...[1, 2, 3, 4, 5, 6].map((n)=>({ value: String(n), label: `抽${['初', '二', '三', '四', '五', '上'][n - 1]}爻` }))],
					(v)=>setDg({ ...dg, chouYao: +v }))}
				</>) : null}
			</>);
		}
		if (school === 'xingshi') {
			const nine = xs.scoreMode === 'nine';
			const optsOf = (arr, get)=>[{ value: '', label: '（不定）' }, ...arr.map(get)];
			return (<>
				{segField('评分口径', xs.scoreMode || 'five', [{ value: 'five', label: '五诀简版' }, { value: 'nine', label: '九纲全参' }], (v)=>setXs({ ...xs, scoreMode: v }))}
				<div className="horosa-fengshui-liqi-subhead">龙</div>
				{segField('龙之生死', xs.longSheng ? 'sheng' : 'si', [{ value: 'sheng', label: '生龙' }, { value: 'si', label: '死龙' }], (v)=>setXs({ ...xs, longSheng: v === 'sheng' }))}
				{sel('九星形体', xs.longStar || '', [{ value: '', label: '（不定）' }, ...XINGSHI_TABLES.nineStar.map((s)=>({ value: s.name, label: `${s.name}(${s.wuxing}·${s.jx === 'good' ? '吉' : s.jx === 'bad' ? '凶' : '平'})` }))], (v)=>setXs({ ...xs, longStar: v }))}
				{segField('剥换脱煞', xs.boHuan ? 'y' : 'n', [{ value: 'y', label: '多' }, { value: 'n', label: '少' }], (v)=>setXs({ ...xs, boHuan: v === 'y' }))}
				{segField('过峡束气', xs.guoXiaGood ? 'y' : 'n', [{ value: 'y', label: '紧凑吉' }, { value: 'n', label: '断散' }], (v)=>setXs({ ...xs, guoXiaGood: v === 'y' }))}
				{nine ? segField('入首数节', xs.ruShouGe === true ? 'y' : (xs.ruShouGe === false ? 'n' : 'na'), [{ value: 'y', label: '合格' }, { value: 'na', label: '未定' }, { value: 'n', label: '不合' }], (v)=>setXs({ ...xs, ruShouGe: v === 'y' ? true : (v === 'n' ? false : null) })) : null}
				{nine ? segField('龙之贵贱', xs.longGuiJian || 'na', [{ value: 'gui', label: '贵龙' }, { value: 'na', label: '未定' }, { value: 'jian', label: '贱龙' }], (v)=>setXs({ ...xs, longGuiJian: v === 'na' ? null : v })) : null}
				{nine ? sel('枝脚四格（参考·不计分）', xs.zhijiao || '', optsOf(XINGSHI_TABLES.zhijiao4, (x)=>({ value: x.name, label: `${x.name}(${x.rank})` })), (v)=>setXs({ ...xs, zhijiao: v })) : null}
				{nine ? sel('开帐三格（参考·不计分）', xs.kaizhang || '', optsOf(XINGSHI_TABLES.kaizhang3, (x)=>({ value: x.name, label: `${x.name}·${x.zhu}` })), (v)=>setXs({ ...xs, kaizhang: v })) : null}
				<div className="horosa-fengshui-liqi-subhead">穴</div>
				{sel('穴形', xs.xueType || '', [{ value: '', label: '（不定）' }, ...XINGSHI_TABLES.xueType.map((x)=>({ value: x.name, label: x.name }))], (v)=>setXs({ ...xs, xueType: v }))}
				{sel('定穴九法', xs.dingXue || '', [{ value: '', label: '（不定）' }, ...XINGSHI_TABLES.dingXue.map((x)=>({ value: x, label: x }))], (v)=>setXs({ ...xs, dingXue: v }))}
				{sel('倒杖十二法', xs.daoZhang || '', [{ value: '', label: '（不定）' }, ...XINGSHI_TABLES.daoZhang.map((x)=>({ value: x.name, label: `${x.name}（${x.use}）` }))], (v)=>setXs({ ...xs, daoZhang: v }))}
				{segField('朝案证穴', (xs.zhengXue || []).indexOf('朝山证') >= 0 ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>toggleZheng('朝山证', v === 'y'))}
				{segField('龙虎证穴', (xs.zhengXue || []).indexOf('龙虎证') >= 0 ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>toggleZheng('龙虎证', v === 'y'))}
				{segField('明堂证穴', (xs.zhengXue || []).indexOf('明堂证') >= 0 ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>toggleZheng('明堂证', v === 'y'))}
				{nine ? sel('定穴十三法', xs.dingXue13 || '', optsOf(XINGSHI_TABLES.dingXue13, (x)=>({ value: x.name, label: x.name })), (v)=>setXs({ ...xs, dingXue13: v })) : null}
				{nine ? sel('结穴局势', xs.jieXueJu || '', optsOf(XINGSHI_TABLES.jieXue5, (x)=>({ value: x, label: x })), (v)=>setXs({ ...xs, jieXueJu: v })) : null}
				{nine ? sel('怪穴八种', xs.guaiXue || '', optsOf(XINGSHI_TABLES.guaiXue8, (x)=>({ value: x.name, label: x.name })), (v)=>setXs({ ...xs, guaiXue: v })) : null}
				{nine ? sel('九星变穴(八法)（参考·不计分）', xs.bianXue || '', optsOf(XINGSHI_TABLES.bianXue8, (x)=>({ value: x.star, label: `${x.star}→${x.xue}` })), (v)=>setXs({ ...xs, bianXue: v })) : null}
				{nine ? segField('唇毡', xs.chunZhan === false ? 'n' : (xs.chunZhan ? 'y' : 'na'), [{ value: 'y', label: '有' }, { value: 'na', label: '未定' }, { value: 'n', label: '无' }], (v)=>setXs({ ...xs, chunZhan: v === 'y' ? true : (v === 'n' ? false : null) })) : null}
				{nine ? segField('分合(界水)', xs.fenHe === false ? 'n' : (xs.fenHe ? 'y' : 'na'), [{ value: 'y', label: '分合明' }, { value: 'na', label: '未定' }, { value: 'n', label: '不明' }], (v)=>setXs({ ...xs, fenHe: v === 'y' ? true : (v === 'n' ? false : null) })) : null}
				{nine ? segField('地心十道', xs.dixinQue === true ? 'que' : 'ok', [{ value: 'ok', label: '四应登对' }, { value: 'que', label: '有空缺' }], (v)=>setXs({ ...xs, dixinQue: v === 'que' })) : null}
				<div className="horosa-fengshui-liqi-subhead">砂</div>
				{segField('砂之向背', xs.shaYouQing === false ? 'wu' : (xs.shaYouQing ? 'you' : 'na'), [{ value: 'you', label: '有情' }, { value: 'na', label: '一般' }, { value: 'wu', label: '无情' }], (v)=>setXs({ ...xs, shaYouQing: v === 'you' ? true : (v === 'wu' ? false : null) }))}
				{segField('贵/富砂', (xs.guiSha || []).length ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>setXs({ ...xs, guiSha: v === 'y' ? ['贵砂'] : [] }))}
				{segField('凶砂', (xs.xiongSha || []).length ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>setXs({ ...xs, xiongSha: v === 'y' ? ['凶砂'] : [] }))}
				<div className="horosa-fengshui-liqi-subhead">水 / 向</div>
				{sel('水城五星', xs.shuiCheng || '', [{ value: '', label: '（不定）' }, ...XINGSHI_TABLES.shuiCheng.map((x)=>({ value: x.name, label: `${x.name}(${x.jx === 'good' ? '吉' : x.jx === 'bad' ? '凶' : '平'})` }))], (v)=>setXs({ ...xs, shuiCheng: v }))}
				{segField('来水开(天门)', xs.laiShuiKai ? 'y' : 'n', [{ value: 'y', label: '开' }, { value: 'n', label: '否' }], (v)=>setXs({ ...xs, laiShuiKai: v === 'y' }))}
				{segField('去水关(地户)', xs.quShuiGuan ? 'y' : 'n', [{ value: 'y', label: '关锁' }, { value: 'n', label: '直泻' }], (v)=>setXs({ ...xs, quShuiGuan: v === 'y' }))}
				{segField('立向朝吉', xs.xiangChaoJi ? 'y' : 'n', [{ value: 'y', label: '朝秀' }, { value: 'n', label: '否' }], (v)=>setXs({ ...xs, xiangChaoJi: v === 'y' }))}
				{segField('向犯冲煞', xs.xiangChongSha ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>setXs({ ...xs, xiangChongSha: v === 'y' }))}
				{nine ? segField('无案无朝', xs.wuAnChao ? 'y' : 'n', [{ value: 'y', label: '是' }, { value: 'n', label: '否' }], (v)=>setXs({ ...xs, wuAnChao: v === 'y' })) : null}
				{nine && xs.wuAnChao ? segField('逆水朝入/堂有聚水', xs.niShuiOrJuShui ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>setXs({ ...xs, niShuiOrJuShui: v === 'y' })) : null}
				{nine ? sel('水之五局（参考·不计分）', xs.shui5ju || '', optsOf(XINGSHI_TABLES.shui5ju, (x)=>({ value: x.name, label: x.name })), (v)=>setXs({ ...xs, shui5ju: v })) : null}
				{nine ? <div className="horosa-fengshui-liqi-subhead">明堂</div> : null}
				{nine ? sel('明堂吉格', xs.mingtangJi || '', optsOf(XINGSHI_TABLES.mingtangJi, (x)=>({ value: x.name, label: x.name })), (v)=>setXs({ ...xs, mingtangJi: v })) : null}
				{nine ? sel('明堂凶格', xs.mingtangXiong || '', optsOf(XINGSHI_TABLES.mingtangXiong, (x)=>({ value: x.name, label: x.name })), (v)=>setXs({ ...xs, mingtangXiong: v })) : null}
				{nine ? XINGSHI_TABLES.mingtang4.map((y)=>segField(y.name, (xs.mingtang4 || []).indexOf(y.name) >= 0 ? 'y' : 'n',
					[{ value: 'y', label: '合' }, { value: 'n', label: '否' }],
					(v)=>{ const cur = new Set(xs.mingtang4 || []); if (v === 'y') { cur.add(y.name); } else { cur.delete(y.name); } setXs({ ...xs, mingtang4: Array.from(cur) }); }, `mt4-${y.name}`)) : null}
				{nine ? <div className="horosa-fengshui-liqi-subhead">龙虎</div> : null}
				{nine ? sel('龙虎形态(断)', xs.longhuXing || '', optsOf(XINGSHI_TABLES.longhuDuan, (x)=>({ value: x.xing, label: `${x.xing}→${x.duan}` })), (v)=>setXs({ ...xs, longhuXing: v })) : null}
				{nine ? sel('龙虎六忌', (xs.longhu6ji || [])[0] || '', optsOf(XINGSHI_TABLES.longhu6ji, (x)=>({ value: x, label: x })), (v)=>setXs({ ...xs, longhu6ji: v ? [v] : [] })) : null}
				{nine ? segField('缺失补偿', xs.longhuBuchang ? 'y' : 'n', [{ value: 'y', label: '水饶/水归' }, { value: 'n', label: '无' }], (v)=>setXs({ ...xs, longhuBuchang: v === 'y' })) : null}
				{nine ? <div className="horosa-fengshui-liqi-subhead">水口</div> : null}
				{nine ? sel('水口五砂', xs.shuikouSha || '', optsOf(XINGSHI_TABLES.shuikou5, (x)=>({ value: x.name, label: x.name })), (v)=>setXs({ ...xs, shuikouSha: v })) : null}
				{nine ? XINGSHI_TABLES.shuikou3guan.map((g)=>segField(g, (xs.shuikouGuan || []).indexOf(g) >= 0 ? 'y' : 'n',
					[{ value: 'y', label: '有' }, { value: 'n', label: '无' }],
					(v)=>{ const cur = new Set(xs.shuikouGuan || []); if (v === 'y') { cur.add(g); } else { cur.delete(g); } setXs({ ...xs, shuikouGuan: Array.from(cur) }); }, `sk3-${g}`)) : null}
				{nine ? segField('水口关锁', xs.shuikouLock === false ? 'n' : (xs.shuikouLock ? 'y' : 'na'), [{ value: 'y', label: '紧闭' }, { value: 'na', label: '未定' }, { value: 'n', label: '旷荡' }], (v)=>setXs({ ...xs, shuikouLock: v === 'y' ? true : (v === 'n' ? false : null) })) : null}
				{nine ? <div className="horosa-fengshui-liqi-subhead">太极（穴证）</div> : null}
				{nine ? XINGSHI_TABLES.zhengXue13.map((z)=>segField(z.name.replace('证穴', '').replace('审穴', '').replace('上判定', ''), (xs.zhengXue13 || []).indexOf(z.key) >= 0 ? 'y' : 'n',
					[{ value: 'y', label: z.main ? '证' : '特' }, { value: 'n', label: '无' }],
					(v)=>{ const cur = new Set(xs.zhengXue13 || []); if (v === 'y') { cur.add(z.key); } else { cur.delete(z.key); } setXs({ ...xs, zhengXue13: Array.from(cur) }); }, `zx13-${z.key}`)) : null}
				{nine ? segField('明堂倾泻', xs.mingtangQingxie ? 'y' : 'n', [{ value: 'y', label: '倾泻倒侧' }, { value: 'n', label: '否' }], (v)=>setXs({ ...xs, mingtangQingxie: v === 'y' })) : null}
			</>);
		}
		if (school === 'zeri') {
			return (<>
				{numField('流年', zr.year, (v)=>setZr({ ...zr, year: +v || zr.year }), { min: 1900, max: 2100 })}
				{sel('坐山（扶山）', zr.zuoShan, SHAN_OPTS, (v)=>setZr({ ...zr, zuoShan: v }))}
				{sel('来龙（补龙·空=不评）', zr.laiLong, [{ value: '', label: '（不设）' }, ...SHAN_OPTS], (v)=>setZr({ ...zr, laiLong: v }))}
				{numField('主命年（相主·空=不评）', zr.zhuYear, (v)=>setZr({ ...zr, zhuYear: v }), { min: 1900, max: 2100 })}
				{segField('主命性别', zr.zhuMale ? 'm' : 'f', [{ value: 'm', label: '男' }, { value: 'f', label: '女' }], (v)=>setZr({ ...zr, zhuMale: v === 'm' }))}
				<div className="horosa-fengshui-liqi-subhead">候选日课（造命/日课）</div>
				{segField('候选日课', (zr.m && zr.d) ? 'on' : 'off', ON_OFF_USE,
					(v)=>setZr(v === 'on' ? { ...zr, ...todayMD() } : { ...zr, m: '', d: '' }))}
				{(zr.m && zr.d) ? dateField('日期', zr.year, zr.m, clampDay(zr.year, zr.m, zr.d),
					(y, m, d)=>setZr({ ...zr, year: y, m: `${m}`, d: `${d}` }), 'zr-date') : null}
				{segField('深化（用事/紫白/三步/斗首）', zr.showDeep ? 'on' : 'off', [{ value: 'off', label: '不用' }, { value: 'on', label: '启用' }], (v)=>setZr({ ...zr, showDeep: v === 'on' }))}
				{zr.showDeep ? (<>
					{sel('用事（十四事）', zr.yongShi, [{ value: '', label: '（不定）' },
						...YONGSHI_ALL.map((x)=>({ value: x.key, label: `${x.cls}·${x.name}` }))], (v)=>setZr({ ...zr, yongShi: v }))}
					{sel('时柱干支（空=只算三柱）', zr.hourGanZhi, [{ value: '', label: '（不设）' },
						...GANZHI60.map((g)=>({ value: g, label: g }))], (v)=>setZr({ ...zr, hourGanZhi: v }))}
					<div className="horosa-fengshui-liqi-subhead">紫白查检</div>
					{sel('组合·星甲', String(zr.zibaiA || 0), STAR09_OPTS, (v)=>setZr({ ...zr, zibaiA: +v }))}
					{sel('组合·星乙', String(zr.zibaiB || 0), STAR09_OPTS, (v)=>setZr({ ...zr, zibaiB: +v }))}
					{/* 🔴 元运只在紫白组合判定里用得上，且只对 75／57 这一对起作用（「只有五运时可以组合」）。
					    故未选组合两星时不显示此栏——否则它是个改了毫无反应的半死开关。 */}
					{(zr.zibaiA && zr.zibaiB)
						? sel('元运（仅 75／57 组合用得上）', String(zr.yun), YUN_OPTS, (v)=>setZr({ ...zr, yun: +v }))
						: null}
					{sel('冲伏·星', String(zr.chongFuStar || 0), STAR09_OPTS, (v)=>setZr({ ...zr, chongFuStar: +v }))}
					{sel('冲伏·到宫', String(zr.chongFuGong || 0), GONG9_OPTS, (v)=>setZr({ ...zr, chongFuGong: +v }))}
					{sel('动象宫凶组合（化煞选星）', zr.dongCombo, [{ value: '', label: '（不查）' },
						...['21', '51', '35', '57', '275', '792', '795', '79', '96', '34'].map((c)=>({ value: c, label: c }))], (v)=>setZr({ ...zr, dongCombo: v }))}
				</>) : null}
			</>);
		}
		if (school === 'liufa') {
			return (<>
				{sel('元运', lf.yun, YUN_OPTS, (v)=>setLf({ ...lf, yun: +v }))}
				{sel('坐山', lf.zuoShan, SHAN_OPTS, (v)=>setLf({ ...lf, zuoShan: v, xiangShan: oppositeShan(v) }))}{/* 选坐自动定向(对宫) */}
				{sel('向首', lf.xiangShan, SHAN_OPTS, (v)=>setLf({ ...lf, xiangShan: v }))}
				{oppositeShan(lf.zuoShan) !== lf.xiangShan ? <div className="horosa-fengshui-liqi-hint" style={{ color: 'var(--horosa-warn, #d48806)' }}>坐向非对宫（坐{lf.zuoShan}应向{oppositeShan(lf.zuoShan)}），零正 / 雌雄 / 兼向判语按所填坐向出，请核对</div> : null}
				{numField('流年（太岁）', lf.year, (v)=>setLf({ ...lf, year: +v || lf.year }), { min: 1864, max: 2100 })}
			</>);
		}
		if (school === 'mingli') {
			return (<>
				{numField('命主年（空=未录）', ml.mingYear, (v)=>setMl({ ...ml, mingYear: (v === '' || v === null || v === undefined) ? null : (+v || ml.mingYear) }), { min: 1900, max: 2100 })}
				{segField('性别', ml.isMale ? 'm' : 'f', [{ value: 'm', label: '男' }, { value: 'f', label: '女' }], (v)=>setMl({ ...ml, isMale: v === 'm' }))}
				{sel('宅坐卦', ml.zhaiZuoGua, GUA8_OPTS, (v)=>setMl({ ...ml, zhaiZuoGua: v }))}
			</>);
		}
		if (school === 'luopan') {
			const CITY_OPTS = [{ value: '', label: '（不选·可直接填磁偏角）' }].concat(
				Object.keys(DECLINATION_TABLE).reduce((acc, prov)=>acc.concat(
					DECLINATION_TABLE[prov].map(([c, d])=>({ value: c, label: `${prov}·${c} ${d > 0 ? '西偏' : '东偏'}${Math.abs(d)}°` }))), []));
			const TRI = (v, on, off)=>[{ value: 'y', label: on }, { value: 'n', label: off }, { value: 'na', label: '未定' }]
				.map((o)=>o) && [{ value: 'y', label: on }, { value: 'na', label: '未定' }, { value: 'n', label: off }];
			const triVal = (v)=>(v === true ? 'y' : (v === false ? 'n' : 'na'));
			const triSet = (k)=>(v)=>setLp({ ...lp, [k]: v === 'y' ? true : (v === 'n' ? false : null) });
			return (<>
				{segField('盘式', lp.panType, LUOPAN_TYPES.map((t)=>({ value: t.key, label: t.name })), (v)=>setLp({ ...lp, panType: v }))}
				{numField('度数游标(0-360)', lp.deg, (v)=>setLp({ ...lp, deg: Math.max(0, Math.min(360, Number(v) || 0)) }), { min: 0, max: 360, step: 0.1 })}
				{sel('坐山', lp.zuoShan, SHAN_OPTS, (v)=>setLp({ ...lp, zuoShan: v, xiangShan: oppositeShan(v) }))}{/* 选坐自动定向(对宫) */}
				{sel('向首', lp.xiangShan, SHAN_OPTS, (v)=>setLp({ ...lp, xiangShan: v }))}
				{oppositeShan(lp.zuoShan) !== lp.xiangShan ? <div className="horosa-fengshui-liqi-hint" style={{ color: 'var(--horosa-warn, #d48806)' }}>坐向非对宫（坐{lp.zuoShan}应向{oppositeShan(lp.zuoShan)}），兼向核只按坐山,请核对</div> : null}

				<div className="horosa-fengshui-liqi-subhead">兼线合法性校验</div>
				{sel('兼向之山（空=不校）', lp.jianShan, [{ value: '', label: '（不校）' }, ...SHAN_OPTS], (v)=>setLp({ ...lp, jianShan: v }))}
				{lp.jianShan ? numField('兼出度数', lp.jianDeg, (v)=>setLp({ ...lp, jianDeg: Math.max(0, Math.min(15, Number(v) || 0)) }), { min: 0, max: 15, step: 0.5 }) : null}
				{lp.jianShan ? segField('依何派度界', lp.jianSchool, [{ value: 'xuankong', label: '玄空' }, { value: 'sanhe', label: '三合' }], (v)=>setLp({ ...lp, jianSchool: v })) : null}

				<div className="horosa-fengshui-liqi-subhead">磁偏角换算（经纬度 → 罗盘）</div>
				{numField('真方位角(0-360·空=不算)', lp.trueDeg, (v)=>setLp({ ...lp, trueDeg: v }), { min: 0, max: 360, step: 0.01 })}
				{sel('所在城市', lp.city, CITY_OPTS, (v)=>setLp({ ...lp, city: v }))}
				{segField('数据源符号', lp.decSource, [{ value: 'book', label: '本表(西偏为正)' }, { value: 'wmm', label: 'WMM/IGRF(东偏为正)' }], (v)=>setLp({ ...lp, decSource: v }))}

				<div className="horosa-fengshui-liqi-subhead">判向向导</div>
				{segField('房屋类型', lp.isDanyuan ? 'dy' : 'du', [{ value: 'du', label: '单门独户' }, { value: 'dy', label: '城市单元住宅' }], (v)=>setLp({ ...lp, isDanyuan: v === 'dy' }))}
				{lp.isDanyuan ? (<>
					{segField('内局阳面与外局空旷面', triVal(lp.innerOuterMatch), TRI(0, '一致', '不一致'), triSet('innerOuterMatch'))}
					{segField('外局气场是否明显强大', triVal(lp.outerStrong), TRI(0, '是', '否'), triSet('outerStrong'))}
				</>) : (<>
					{segField('前方有真水（海/江/河/湖/大塘）', triVal(lp.hasWater), TRI(0, '有', '无'), triSet('hasWater'))}
					{segField('前方有明堂（广场/街道/公园/大平地）', triVal(lp.hasMingtang), TRI(0, '有', '无'), triSet('hasMingtang'))}
					{lp.hasMingtang === true ? segField('　该方气场是否大大超过其他三方且开大窗', triVal(lp.mingtangDominant), TRI(0, '是', '否'), triSet('mingtangDominant')) : null}
					{segField('四面形势是否相当', triVal(lp.fourSidesSimilar), TRI(0, '相当', '不相当'), triSet('fourSidesSimilar'))}
				</>)}

				<div className="horosa-fengshui-liqi-subhead">层可见性（防信息过载）</div>
				<div className="horosa-fengshui-layer-toggles">
					{LUOPAN_LAYER_OPTS.map((l)=>(
						<button key={l.key} type="button" className={`horosa-fs-layer-chip${lp.layers.indexOf(l.key) >= 0 ? ' is-on' : ''}`}
							onClick={()=>toggleLayer(l.key)}>{l.label}</button>
					))}
				</div>
				<div className="horosa-fengshui-layer-quick">
					<button type="button" onClick={()=>setLp({ ...lp, layers: LUOPAN_LAYERS.map((l)=>l.key) })}>全开</button>
					<button type="button" onClick={()=>setLp({ ...lp, layers: LUOPAN_DEFAULT_LAYERS })}>三针</button>
				</div>
			</>);
		}
		return null;
	}

	// 门派联动：仅「中州 ⇒ 五黄两元八运」一条（古籍明载）；替星方案与兼向度界始终独立、不随门派暗改。
	function pickXkSchool(v) {
		const s = XUANKONG_SCHOOLS.find((x)=>x.key === v);
		const auto = s && s.auto ? s.auto : null;
		setXkDeep({ ...xkDeep, school: v, ...(auto && auto.wuHuangSplit ? { wuHuangSplit: auto.wuHuangSplit } : null) });
	}
	function toggleLayer(key) {
		const cur = new Set(lp.layers);
		if (cur.has(key)) { cur.delete(key); } else { cur.add(key); }
		setLp({ ...lp, layers: LUOPAN_LAYERS.filter((l)=>cur.has(l.key)).map((l)=>l.key) });
	}
	function toggleZheng(key, on) {
		const cur = new Set(xs.zhengXue || []);
		if (on) { cur.add(key); } else { cur.delete(key); }
		setXs({ ...xs, zhengXue: Array.from(cur) });
	}

	function renderChart() {
		if (impl) { return <impl.Chart result={result} p={regP} patch={regPatch} chartBox={chartBox} />; }
		if (school === 'xuankong') { return <LuoshuGrid palaces={result.palaces} mode="xuankong" highlightYun={result.yun} size={620} />; }
		if (school === 'zibai') { return <LuoshuGrid palaces={result.yearPalaces} mode="zibai" size={620} />; }
		if (school === 'bazhai') { return <LuoshuGrid palaces={result.palaces} mode="bazhai" size={620} />; }
		if (school === 'sanhe') {
			const hasDeg = sanheDeep.zuoDeg !== '' && !Number.isNaN(Number(sanheDeep.zuoDeg));
			if (!hasDeg) { return <TwentyFourShanRing ring={result.ring} zuoShan={null} xiangShan={null} size={700} />; }
			return (
				<div className="horosa-fengshui-chart-stack">
					<TwentyFourShanRing ring={result.ring} zuoShan={null} xiangShan={null} size={700} />
					<div className="horosa-fengshui-chart-sub"><XianfaRing deg={Number(sanheDeep.zuoDeg)} size={560} /></div>
				</div>
			);
		}
		if (school === 'jinsuo') {
			const p = result.palaces.map((x)=>({ gong: x.gong, gua: x.gua, dir: x.dir, primary: x.actual === 'sand' ? '砂' : (x.actual === 'water' ? '水' : '平'), secondary: x.deWei ? '得位' : '失位', jx: x.deWei ? 'good' : 'bad' }));
			return <EightPalaceDisk palaces={p} centerLabel={`金锁 ${result.score}分`} size={620} />;
		}
		if (school === 'qiankun') {
			const p = result.positions.filter((x)=>x.pos).map((x)=>({ gong: x.pos, dir: x.posName, primary: x.name.slice(0, 2), secondary: x.water === 'come' ? '来' : (x.water === 'go' ? '去' : ''), jx: x.jx }));
			return <EightPalaceDisk palaces={p} centerLabel={`坐${result.zuoGua}`} size={620} />;
		}
		if (school === 'fuxing') {
			const p = result.palaces.map((x)=>({ gong: x.gong, gua: x.gua, dir: x.dir, primary: x.star, secondary: x.water === 'come' ? '来' : (x.water === 'go' ? '去' : x.youxing), jx: x.verdictJx !== 'neutral' ? x.verdictJx : x.jx }));
			return <EightPalaceDisk palaces={p} centerLabel={`辅星 起${result.startGua || fx.benGua}`} size={620} />;
		}
		if (school === 'jingyin') {
			return <TwentyFourShanRing ring={null} zuoShan={result.items[0].shan} xiangShan={result.items[1].shan} size={700} />;
		}
		if (school === 'dagua') {
			// 有度数走圆图（管「落在哪」），否则走并列双卦（管「看清爻象」）。
			if (result.degInfo) {
				return (
					<div className="horosa-fengshui-chart-stack">
						<SixtyFourGuaCircle deg={result.deg} heShiOf={result.zuo ? result.zuo.name : null} size={620} />
						<div className="horosa-fengshui-chart-sub"><SixtyFourGuaRing xiang={result.xiang} zuo={result.zuo} zheng={result.zheng} ling={result.ling} flags={result.flags} size={560} /></div>
					</div>
				);
			}
			return <SixtyFourGuaRing xiang={result.xiang} zuo={result.zuo} zheng={result.zheng} ling={result.ling} flags={result.flags} size={620} />;
		}
		if (school === 'xingshi') {
			return (
				<div className="horosa-fengshui-chart-stack">
					{renderXingshiChart()}
					<XingshiFormGallery sel={xs} onPick={(f, v)=>setXs({ ...xs, [f]: v })} />
				</div>
			);
		}
		if (school === 'zeri') { return renderZeriChart(); }
		if (school === 'luopan') {
			// 罗盘直径吃满中栏可用面积(min(宽,高)-边距);量测未就绪时回退 760。
			// horosa_luopan_dial_viewport_cap_v1(issue #84):中栏格高实测由左栏参数列表撑到 ~1550 CSS px(栅格按内容撑高,并非视口约束),
			// 盘径吃满 min(宽,高) 即超出屏幕;界面缩放时「宽绑定 ↔ 高绑定」切换、栅格在窄档重排 ⇒ 视觉直径忽大忽小(真机 0.6→1.4 缩放实抓
			// 802→876→949→1022→1009→933)。改按可视高度封顶:盘始终贴合可视区域,缩放下尺寸稳定、不超屏、不来回跳。
			const viewportH = getLayoutViewportHeight();
			const viewportCap = viewportH > 200 ? viewportH - 24 : Infinity;
			const dialSize = (chartBox.w > 120 && chartBox.h > 120)
				? Math.max(640, Math.floor(Math.min(chartBox.w, chartBox.h, viewportCap)) - 16)
				: 760;
			// 🔴 用 effLayers（盘式过滤后）而非 lp.layers：三元盘明载没有人盘中针/天盘缝针廿四山、
			//    也没有七十二龙/一百二十龙/六十龙分金——切档时盘面上这些层必须真的消失。
			return <LuopanDial deg={result.deg} zuoShan={lp.zuoShan} xiangShan={lp.xiangShan} layers={result.effLayers} size={dialSize}
				onDegChange={(d)=>setLp({ ...lp, deg: d })} />;
		}
		if (school === 'liufa') {
			const lz = (result.items[0] || {}).extra || {};
			const ax = ((result.items[3] || {}).extra || {}).list || [];
			const p = ax.map((a)=>({
				gong: a.gong, gua: a.gua, dir: a.dir, primary: a.stage,
				secondary: a.gong === lz.zhengGong ? '正神' : (a.gong === lz.lingGong ? '零神' : (a.gong === result.gZuo ? '坐' : (a.gong === result.gXiang ? '向' : ''))),
				jx: a.jx,
			}));
			// 中栏＝八方卦气盘 + 六法条目板（一眼看六法各合与不合）；右栏另出逐条详解。
			return (
				<div className="horosa-fengshui-chart-stack">
					<EightPalaceDisk palaces={p} centerLabel={`六法 ${result.yun}运`} size={620} />
					<div className="horosa-fengshui-liufa-board">
						{result.items.map((it)=>(
							<div key={it.key} className={`horosa-fs-liufa-item ${JX_CLASS(it.jx)}`}>
								<div className="lf-name">{it.name}</div>
								<div className="lf-verdict">{it.verdict}</div>
							</div>
						))}
						<div className={`horosa-fs-liufa-sum ${JX_CLASS(result.summary.jx)}`}>
							综断 · {result.summary.text}（合 {result.goodN} · 违 {result.badN}）
						</div>
					</div>
				</div>
			);
		}
		if (school === 'mingli') {
			// 命理派依附八宅而行 → 复用八宅同款九宫吉方盘（LuoshuGrid bazhai 模式），
			// 视觉与八宅一致；其 name 字段即游年星名（mingli 的 fangwei 里叫 star）。
			const p = result.fangwei.map((f)=>({ gong: f.gong, gua: f.gua, dir: f.dir, name: f.star, jx: f.jx }));
			return <LuoshuGrid palaces={p} mode="bazhai" size={620} />;
		}
		return null;
	}

	function renderXingshiChart() {
		const rows = [
			{ k: '龙', v: result.long }, { k: '穴', v: result.xue }, { k: '砂', v: result.sha }, { k: '水', v: result.shui }, { k: '向', v: result.xiang },
		];
		// 九纲口径另出四纲条（五诀档不显示，保持原貌）。
		if (result.scoreMode === 'nine') {
			rows.push({ k: '明堂', v: result.mingtang }, { k: '龙虎', v: result.longhu }, { k: '水口', v: result.shuikou }, { k: '太极', v: result.taiji });
		}
		return (
			<div className="horosa-fengshui-xingshi-board">
				<div className={`horosa-fengshui-xingshi-total ${JX_CLASS(result.grade.jx)}`}>
					<div className="xt-num">{result.total}</div><div className="xt-lbl">{result.grade.text}</div>
				</div>
				<div className="horosa-fengshui-xingshi-bars">
					{rows.map((r)=>(
						<div key={r.k} className="horosa-fengshui-xingshi-bar">
							<span className="xb-key">{r.k}</span>
							<span className={`xb-score ${JX_CLASS(r.v.jx)}`}>{r.v.score > 0 ? `+${r.v.score}` : r.v.score}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	function renderZeriChart() {
		const yg = result.yg;
		const p = GUA8.map((g)=>null).filter(Boolean);
		const gongList = [1, 2, 3, 4, 6, 7, 8, 9].map((gong)=>{
			const isJi = yg.jiDongGongs.indexOf(gong) >= 0;
			const isTaisui = yg.taisui.gong === gong;
			let tag = '';
			if (yg.suipo.gong === gong) { tag = '岁破'; } else if (yg.wuHuang.gong === gong) { tag = '五黄'; }
			else if (yg.sansha.list.some((s)=>s.gong === gong)) { tag = '三煞'; } else if (isTaisui) { tag = '太岁'; }
			return { gong, dir: '', primary: tag || '', secondary: '', jx: isJi ? 'bad' : (isTaisui ? 'neutral' : 'neutral') };
		});
		return <EightPalaceDisk palaces={gongList} centerLabel={`${yg.yearGanZhi}年神`} size={620} />;
	}

	function renderPanel() {
		// children 整棵子树走行内加粗:右栏近 60 处直出 note/detail 全在 card 之内,
		// 在此一处覆盖,好过逐个出口接(逐个必漏,且新增条文还会再漏)。
		const card = (title, children)=>(<div className="horosa-fengshui-liqi-card"><div className="horosa-fengshui-liqi-card-title">{title}</div>{deepInlineBold(children, 'card')}</div>);
		// k 兼作默认 key；同一列表内 k 可能重复（如一柱既生扶又冲克）→ 传 rk 显式指定。
		// v 走行内加粗解析:各派条文数据用 `**要点**` 标重点,直出 JSX 会把星号原样画出来。
		const row = (k, v, jx, rk)=>(<div className="horosa-fengshui-liqi-row" key={rk || k}><span>{renderInlineBold(k, `k-${rk || k}`)}</span><strong className={JX_CLASS(jx)}>{renderInlineBold(v, `v-${rk || k}`)}</strong></div>);
		// p/patch 亦传右栏：几何自动检测之「采纳此条」须能回写勾选（其余派忽略即可）。
		if (impl) { return <impl.Panel result={result} ui={{ card, row }} p={regP} patch={regPatch} />; }
		if (school === 'xuankong') { return renderXuankongPanel(card, row); }
		if (school === 'sanhe') { return renderSanhePanel(card, row); }
		if (school === 'zibai') { return renderZibaiPanel(card, row); }
		if (school === 'bazhai') { return renderBazhaiPanel(card, row); }
		if (school === 'qiankun') { return renderQiankunPanel(card, row); }
		if (school === 'jinsuo') {
			return (<>{card(`得位 ${result.deCount}/8 · ${result.score} 分`, result.palaces.map((p)=>row(`${p.gua} ${p.needLabel}`, p.desc, p.deWei ? 'good' : (p.actual === 'flat' ? '' : 'bad'))))}
				{result.palaces.some((p)=>p.yingqi) ? card(`应期（${result.yun}运 · ${result.year}年）`, <>
					{result.palaces.map((p)=>row(`${p.gua}方`, p.yingqi.text, p.yingqi.jx === 'neutral' ? '' : p.yingqi.jx))}
					{result.palaces.filter((p)=>p.yingqi.nextYears.length).slice(0, 1).map((p)=>row('本卦星回宫年', `${p.gua}方 ${p.yingqi.nextYears.join('、')}（九年一循环，余方类推）`))}
				</>) : null}
				{result.mixedGuas && result.mixedGuas.length ? <div className="horosa-fengshui-liqi-note">{`三山参差之宫作未定：${result.mixedGuas.join('、')}（本法以宫论得位，一宫内砂水并见者不臆断）`}</div> : null}
				{result.duanjue ? card('断诀（二十四山）', <>
					{result.duanjue.rows.map((r)=>row(`${r.shan}${r.actual === 'water' ? '水' : '砂'}${r.fang ? `·${r.fang}` : ''}`,
						r.text, r.deWei ? 'good' : 'bad', `jd-${r.shan}`))}
					{result.duanjue.rows.filter((r)=>r.conds.length).map((r)=>(
						<div key={`jc-${r.shan}`} className="horosa-fengshui-liqi-note">{`${r.shan}·待验条件：${r.conds.map((c)=>`若${c.cond}则${c.text}`).join('；')}`}</div>))}
				</>) : null}
				{result.duanjue && result.duanjue.gongQuan.length ? card('本宫全砂／全水', result.duanjue.gongQuan.map((g)=>row(
					`${g.gua}宫全${g.side === 'shui' ? '水' : '砂'}`, g.text + (g.extraFired ? `；（${g.extraFired.cond}）${g.extraFired.text}` : ''), '', `jq-${g.gua}-${g.side}`))) : null}
				{result.duanjue && result.duanjue.kuaGong.length ? card('跨宫组合', result.duanjue.kuaGong.map((k, i)=>row(
					k.guas.join('') + (k.side === 'shui' ? '·水' : '·砂'), k.text, '', `jk-${i}`))) : null}
				{result.duanjue ? <div className="horosa-fengshui-liqi-note">{result.duanjue.note}</div> : null}
				{result.remedies.length ? card('化解', result.remedies.map((r, i)=>row(`化解${i + 1}`, r))) : null}</>);
		}
		if (school === 'fuxing') {
			return (<>{card(`辅星水法（${(FROM_OPTS.find((o)=>o.value === result.qiFrom) || {}).label || '向卦'}起${result.startGua || result.benGua}·${result.heFa ? '合法' : '待核'}）`, result.palaces.map((p)=>row(`${p.gua} ${p.youxing}(${p.star})`, p.result, p.verdictJx !== 'neutral' ? p.verdictJx : p.jx)))}
				<div className="horosa-fengshui-liqi-note">{result.note}</div></>);
		}
		if (school === 'jingyin') {
			return (<>{card('净阴净阳', <>{result.items.map((it)=>row(`${it.key} ${it.shan}`, it.yy || '—', it.yy === '阳' ? '' : (it.yy === '阴' ? '' : '')))}{row('判定', result.verdict.text, result.verdict.jx)}</>)}
				{result.liuxiu ? card('六秀催官', <div className="horosa-fengshui-liqi-note">{result.liuxiu.list.join('、')}：{result.liuxiu.text}</div>) : null}
				<div className="horosa-fengshui-liqi-note">{result.note}</div></>);
		}
		if (school === 'dagua') { return renderDaguaPanel(card, row); }
		if (school === 'xingshi') { return renderXingshiPanel(card, row); }
		if (school === 'zeri') { return renderZeriPanel(card, row); }
		if (school === 'luopan') { return renderLuopanPanel(card, row); }
		if (school === 'liufa') {
			return (<>
				{card(`玄空六法（${result.yun}运 坐${result.zuoShan} 向${result.xiangShan}）`, result.items.map((it)=>row(it.name, it.verdict, it.jx === 'neutral' ? '' : it.jx)))}
				{result.items.filter((it)=>it.detail).map((it)=>(
					<div className="horosa-fengshui-liqi-card" key={it.key}>
						<div className="horosa-fengshui-liqi-card-title">{it.name}</div>
						<div className="horosa-fengshui-liqi-note">{it.detail}</div>
					</div>
				))}
				{card('综断', row('六法合参', result.summary.text, result.summary.jx))}
				<div className="horosa-fengshui-liqi-note">{result.note}</div>
			</>);
		}
		if (school === 'mingli') {
			const m = result.ming; const z = result.zhai; const mt = result.match;
			return (<>
				{card('命主', <>{row('命卦', `${m.gua}（${m.group}·${m.ganzhi}年）`)}{row('命卦五行', `${m.wuxing}（河图 ${m.hetu}）`)}{row('宜居宜用', m.yiJu)}{row('喜忌', m.xiYong)}</>)}
				{card('宅', <>{row('宅坐卦', `${z.zuoGua}（${z.dir}·${z.group}）`)}{row('宅卦五行', z.wuxing)}</>)}
				{card('人—宅相配', <>{row('东西四组', mt.groupText, mt.sameGroup ? 'good' : 'bad')}
					{mt.star ? row('宅对命（大游年）', `${mt.star.name}·${mt.star.rank}`, mt.star.jx) : null}
					{mt.wuxing ? row('五行生克', `${mt.wuxing.label}——${mt.wuxing.text}`, mt.wuxing.jx) : null}
					{row('综断', mt.verdict.text, mt.verdict.jx)}</>)}
				{card('个人吉方（大游年四吉）', result.jiFang.map((f)=>row(`${f.dir} ${f.star}`, `${f.rank}·${f.desc}`, 'good')))}
				{card('个人凶方（四凶）', result.xiongFang.map((f)=>row(`${f.dir} ${f.star}`, `${f.rank}·${f.desc}`, 'bad')))}
				<div className="horosa-fengshui-liqi-note">{result.note}</div>
			</>);
		}
		return null;
	}

	function renderLuopanPanel(card, row) {
		const r = result;
		const g = r.gua64;
		// 坐/向此前只在盘上以蓝/金高亮体现，右栏一字不提 → 用户改了「像没反应」。此处如实读出。
		const zuoDeg = SHAN_CENTER_DEG[r.zuoShan]; const xiangDeg = SHAN_CENTER_DEG[r.xiangShan];
		const fmtRange = (d)=>(d === undefined ? '—' : `${((d - 7.5) + 360) % 360}°–${(d + 7.5) % 360}°`);
		return (<>
			{card('坐向', <>
				{row('坐山', `${r.zuoShan}（${fmtRange(zuoDeg)}）`, 'good')}
				{row('向首', `${r.xiangShan}（${fmtRange(xiangDeg)}）`)}
				{row('游标是否在坐山', zuoDeg !== undefined && Math.abs(((r.deg - zuoDeg + 540) % 360) - 180) <= 7.5 ? '是' : '否')}
				{row('游标是否在向首', xiangDeg !== undefined && Math.abs(((r.deg - xiangDeg + 540) % 360) - 180) <= 7.5 ? '是' : '否')}
			</>)}
			{card(`当前 ${r.deg.toFixed(2)}° 三针读数`, <>
				{r.needles.map((n)=>row(`${n.name}${n.offset ? `（${n.offset > 0 ? '+' : ''}${n.offset}°）` : ''}`, `${n.shan}山 · ${n.use.split(' · ')[1] || n.use}`, n.key === 'zheng' ? 'good' : ''))}
			</>)}
			{card('线法三层', <>
				{row('穿山七十二龙', `${r.chuanshan.ganzhi} · ${r.chuanshan.positional}`, r.chuanshan.jx)}
				{row('透地六十龙', `${r.toudi.ganzhi}${r.toudi.nayin ? ` · ${r.toudi.nayin.name}` : ''}${r.toudi.kong ? ' · 空亡' : ''}`, r.toudi.jx)}
				{row('百二十分金', `${r.fenjin.ganzhi} · ${r.fenjin.positional}`, r.fenjin.jx)}
			</>)}
			{card('卦爻 · 宿度', <>
				{row('六十四卦', `${g.gua}（${g.sector}宫）· ${g.yao}爻`)}
				{row('入卦度', `${g.degInGua.toFixed(3)}°（每卦 5.625°·每爻 0.9375°）`)}
				{r.xiu ? row('二十八宿', `${r.xiu.name}宿（${r.xiu.xiang}）`, r.xiu.jx) : null}
				<div className="horosa-fengshui-liqi-note">二十八宿层按四象七宿等分示意，非周天盈缩实度。</div>
			</>)}
			{card('卦宫 · 元龙', <>
				{row('所属宫', r.gongName || '—')}
				{row('三元龙', `${r.yuanlong || '—'}元 · ${r.yinyang || '—'}`)}
				{row('净阴净阳', r.jingYinYang || '—')}
			</>)}
			{card('三针分工', <div className="horosa-fengshui-liqi-note">
				正针（地盘）格龙立向、中针（人盘）退半山消砂、缝针（天盘）进半山纳水；三合盘三针俱全，三元盘以正针配六十四卦层为主。
			</div>)}

			{r.panTypeMeta ? card(`盘式：${r.panTypeMeta.name}`, <>
				{row('特征', r.panTypeMeta.feature)}
				{r.panTypeMeta.note ? row('口径', r.panTypeMeta.note, 'neutral') : null}
				{r.droppedLayers.length
					? row('本盘式无此层', `${r.droppedLayers.join('、')}——已从盘面移除（不是隐藏，是本盘式确实没有这些层）`, 'neutral')
					: row('层集', r.panTypeMeta.has == null ? '综合盘：全部层可选' : '本盘式层集完整')}
				{row('各派采参', Object.keys(r.paiNeedle).map((k)=>`${SCHOOL_CN[k] || k}：${r.paiNeedle[k].label}`).join('；'))}
				<div className="horosa-fengshui-liqi-note">{r.panTypeNote}</div>
			</>) : null}

			{r.fenjinPick ? card(`分金择优（坐${r.fenjinPick.shan}山 · 百二十分金）`, <>
				{row('结论', r.fenjinPick.verdict.text, r.fenjinPick.verdict.jx)}
				{r.fenjinPick.rows.map((x)=>row(`${x.ganzhi}（${x.deg0.toFixed(2)}°–${x.deg1.toFixed(2)}°）`,
					`${x.why}；位置性：${x.positional}`, x.usable ? 'good' : 'bad', `fp-${x.idx}`))}
				{r.fenjinPick.best ? row('首选', `${r.fenjinPick.best.ganzhi}（中线 ${r.fenjinPick.best.degMid.toFixed(2)}°，距山心最近）`, 'good') : null}
				<div className="horosa-fengshui-liqi-note">{r.fenjinPick.rule}</div>
			</>) : null}

			{r.chuanshanPick ? card(`穿山七十二龙择优（坐${r.chuanshanPick.shan}山）`, <>
				{row('结论', r.chuanshanPick.verdict.text, r.chuanshanPick.verdict.jx)}
				{r.chuanshanPick.rows.map((x)=>row(`${x.ganzhi}（${x.deg0.toFixed(2)}°–${x.deg1.toFixed(2)}°）`,
					`${x.why}；位置性：${x.positional}`, x.usable ? 'good' : 'bad', `cp-${x.idx}`))}
				<div className="horosa-fengshui-liqi-note">{r.chuanshanPick.rule}</div>
			</>) : null}

			{r.jian ? card(`兼线合法性（坐${r.jian.zuoShan} 兼${r.jian.jianShan} ${r.jian.jianDeg}°）`, <>
				{row('结论', r.jian.verdict.text, r.jian.verdict.jx)}
				{r.jian.items.map((x)=>row(x.name, x.text, x.ok ? 'good' : 'bad', `jc-${x.key}`))}
				<div className="horosa-fengshui-liqi-note">{r.jian.note}</div>
			</>) : null}

			{r.magnetic ? card('磁偏角换算', <>
				{row('结论', r.magnetic.verdict.text, r.magnetic.verdict.jx)}
				{r.magnetic.dec != null ? row('取值', `${r.magnetic.prov ? `${r.magnetic.prov}·` : ''}${r.magnetic.city || '—'} ${r.magnetic.dec}°（${r.magnetic.applyNote}）`) : null}
				<div className="horosa-fengshui-liqi-note">🔴 {r.magnetic.signNote}</div>
				<div className="horosa-fengshui-liqi-note">{r.magnetic.epochNote}</div>
			</>) : null}

			{card('立向向导（形势为体·理气为用）', <>
				{row('要旨', r.lixiang.tiyong, 'neutral')}
				{r.lixiang.steps.map((x)=>row(x.name, x.text, '', `lx-${x.key}`))}
				{row('三元龙相兼', r.lixiang.jianRules.map((x)=>x.text).join('；'))}
				{r.lixiang.jianDegRules.map((x)=>row(x.school === 'sanhe' ? '三合度界' : '玄空度界', x.text, '', `ld-${x.school}`))}
				<div className="horosa-fengshui-liqi-note">{r.lixiang.importance}</div>
			</>)}

			{card('判向向导', <>
				{r.panxiang.verdict ? row('结论', r.panxiang.verdict.text, r.panxiang.verdict.jx) : null}
				{r.panxiang.steps.map((x, i)=>row(x.name, x.text, x.jx || '', `px-${i}`))}
				{r.panxiang.concepts.map((c)=>row(`概念·${c.name}`, c.text, '', `pc-${c.key}`))}
				<div className="horosa-fengshui-liqi-note">{r.panxiang.conceptNote}</div>
			</>)}

			{card('廿四天星（三吉六秀八贵）', <>
				{Object.keys(r.tianxing.ji).map((k)=>row(r.tianxing.ji[k].name, r.tianxing.ji[k].shans.join('、') + ' 山', 'good', `tx-${k}`))}
				{row('八贵合计', r.tianxing.baGui.join('、') + ' 八山所配天星特别吉利', 'good')}
				{row('用法', r.tianxing.use)}
				<div className="horosa-fengshui-liqi-note">{r.tianxing.note}</div>
			</>)}

			{card('地母翻卦九星（坐山九星）', <>
				{row('九星', r.dimu9.stars.join('·'))}
				<div className="horosa-fengshui-liqi-note">{r.dimu9.note}</div>
			</>)}

			{card('易盘内容（三元盘）', <>
				{r.yipan.map((y)=>row(y.name, y.text, '', `yp-${y.key}`))}
				<div className="horosa-fengshui-liqi-note">{r.yao384Note}</div>
			</>)}

			{card('下罗盘的位置（关键）', <>
				{r.xiaLuopan.nei.map((x)=>row(`内六事·${x.scene}`, x.how, '', `xn-${x.key}`))}
				{r.xiaLuopan.wai.map((x)=>row(`外六事·${x.scene}`, x.how, '', `xw-${x.key}`))}
				<div className="horosa-fengshui-liqi-note">🔴 {r.xiaLuopan.note}</div>
			</>)}

			{card('罗盘使用要求', r.useRules.map((x)=>row(LUOPAN_RULE_LABEL[x.key] || '要求', x.text, LUOPAN_RULE_JX[x.key] || '', `ur-${x.key}`)))}
			{card('罗盘构成', r.parts.map((x)=>row(x.name, x.text, '', `pt-${x.key}`)))}
			{card('八煞黄泉盘', <div className="horosa-fengshui-liqi-note">{r.huangquanNote}</div>)}
			{card('廿四节气两式', <div className="horosa-fengshui-liqi-note">{r.jieqiNote}</div>)}
		</>);
	}

	function renderXuankongPanel(card, row) {
		const ss = result.shousha;
		const wuG = result.monthPan ? [1, 2, 3, 4, 5, 6, 7, 8, 9].find((g)=>result.monthPan[g] === 5) : null;
		const wuName = wuG ? (result.palaces.find((p)=>p.gong === wuG) || {}).name : null;
		return (<>
			{card('格局', <>{row('坐向', `坐${result.zuoShan} 向${result.xiangShan}`)}{result.jianInfo ? row('兼向判别', result.jianInfo.mode, result.jianInfo.kong ? 'bad' : (result.jianInfo.jian ? 'good' : '')) : null}{row('起卦', result.method + (result.jian && result.sameAsXiaGua ? '（替=下卦·同卦）' : ''), result.jian ? 'good' : '')}{row('格局', result.ge, result.ge.indexOf('旺山旺向') >= 0 ? 'good' : (result.ge.indexOf('上山下水') >= 0 ? 'bad' : ''))}{row('零正', `正神 ${result.zhengShen.name} / 零神 ${result.lingShen.name}`)}{row('阴阳宅', result.yinYangZhai === 'yin' ? '阴宅(墓碑坐穴·重龙脉水口)' : '阳宅(门向纳气·重室内分房)')}</>)}
			{renderShouShaCard(card, row, ss)}
			{(()=>{
				const hits = duanyuByPan(result.palaces);
				return card(`玄空断语库（${XUANKONG_DUANYU.length} 条 · 按本盘逐宫检索）`, <>
					{hits.length ? hits.map((h)=>row(`${h.dir || h.gua}（山${h.stars[0]}向${h.stars[1]}运${h.stars[2]}）`,
						h.hits.map((d)=>`《${d.src}》${d.text}`).join('　｜　'), '', `dy-${h.gong}`))
						: row('本盘', '本盘诸宫之星卦，赋文中未见明写者——不臆断（详见下条口径）', 'neutral')}
					{DUANYU_SOURCES.map((x)=>row(x.name, x.note, '', `ds-${x.key}`))}
					<div className="horosa-fengshui-liqi-note">{DUANYU_INDEX_NOTE}</div>
					<div className="horosa-fengshui-liqi-note">🔴 {DUANYU_MISSING_NOTE}</div>
				</>);
			})()}
			{card('取用口径', <>
				{row('门派', result.school ? `${result.school.name}${result.school.focus && result.school.focus.length ? `（重${result.school.focus.join('·')}）` : ''}` : '—')}
				{row('替星方案', (TIVAR_OPTS.find((o)=>o.value === result.tiVariant) || {}).label || result.tiVariant)}
				{row('兼向度界', `出中 ${result.jianBoundary}°`)}
				{row('五黄分运', result.wuHuangSplit === 'liangyuan' ? '两元八运（五黄分属二·八）' : '下卦运（五运自成一运）')}
				{result.wuHuang ? row('本运元属', result.wuHuang.text) : null}
				{result.school && result.school.desc ? <div className="horosa-fengshui-liqi-note" key="sd">{result.school.desc}</div> : null}
				<div className="horosa-fengshui-liqi-note" key="jb">{JIAN_BOUNDARY_NOTE}替星方案与度界彼此独立，可任意组合。</div>
			</>)}
			{result.flags.length ? card('结构', result.flags.map((f)=>row(f.label, f.nature === 'good' ? '吉' : (f.nature === 'mild' ? '吉（假打劫·力缓）' : '凶'), f.nature))) : null}
			{result.gate && result.gate.available ? card('城门诀', <>{result.gate.zheng ? row('正城门', `${result.gate.zheng.name}（向星${result.gate.zheng.xiangStar}·${result.gate.zheng.heShi ? '合十' : '旺'}）`, 'good') : null}{result.gate.fu ? row('副城门', `${result.gate.fu.name}（向星${result.gate.fu.xiangStar}）`, 'good') : null}</>) : null}
			{card('双星断（逐宫）', result.palaces.map((p)=>row(`${p.name} ${p.shan}·${p.xiang}`, p.combo.note, p.combo.badge)))}
			{result.yearHui && result.yearHui.length ? card('流年会断', result.yearHui.map((h, i)=>row(`${result.palaces.find((p)=>p.gong === h.gong).name}`, h.warn, h.jx))) : null}
			{result.monthPan ? card('流月飞星', <>{row('月入中', `${result.monthPan[5]}`)}{row('向首流月星', `${result.monthPan[result.gXiang]}`)}{wuName ? row('五黄到（忌动）', wuName, 'bad') : null}</>) : null}
		</>);
	}
	function renderShouShaCard(card, row, ss) {
		if (!ss) { return null; }
		return (<>
			{card('收山出煞（形势理气合参）', <>
				{row('结论', ss.verdict.text, ss.verdict.jx === 'neutral' ? '' : ss.verdict.jx)}
				{row('三吉星', ss.sanJi.join('·') + '（当令+生气+次生）')}
				{ss.rows.map((r)=>row(`${r.gua}方(${r.env === 'shan' ? '见山' : r.env === 'gao' ? '高物' : r.env === 'shui' ? '见水' : '空地'})`,
					r.hits.map((h)=>`${h.ok ? '✓' : '✗'}${h.text}`).join('；'), r.badN === 0 ? 'good' : (r.okN === 0 ? 'bad' : ''), `ss-${r.gong}`))}
			</>)}
			<div className="horosa-fengshui-liqi-note">{ss.note}</div>
		</>);
	}

	function renderSanhePanel(card, row) {
		const autoXf = !sanheDeep.xiangFaType;
		return (<>{card('定局', <>{row('水口', `${result.shuiKou} → ${result.ju || '未定'}`)}
			{row('水势', waterFlow === 'rightToLeft' ? '右水倒左' : '左水倒右')}
			{result.xiangFa ? row('立向', `${result.xiangFa.type}（${result.xiangFa.shuangshan || ''}）`, 'good') : null}
			{row('立向取法', autoXf ? '按水势自动（左水倒右→正旺向 / 右水倒左→正生向）' : `显式指定「${sanheDeep.xiangFaType}」（覆盖水势）`)}</>)}
			{result.xiangFa ? card('收水', <div className="horosa-fengshui-liqi-note">{result.xiangFa.note}</div>) : null}
			{result.huangquan ? card('黄泉八煞', <>{result.huangquan.baYao ? row('八曜煞', result.huangquan.baYao.text, 'bad') : null}{result.huangquan.siDa ? result.huangquan.siDa.map((s, i)=>row(`四大黄泉${i + 1}`, s.text, 'bad')) : row('四大黄泉', '本向无', '')}</>) : null}
			{result.shuiFa13 ? card(`十三水法（${result.shuiFa13.ju}·${result.shuiFa13.source}）`, <>
				<div className="horosa-fengshui-liqi-note">{result.shuiFa13.head}</div>
				{result.shuiFa13.rows.map((r)=>row(result.shuiFa13Cur && result.shuiFa13Cur.no === r.no ? <>{`${r.no}. ${r.name}`}<span style={{ marginLeft: 6 }}><XQCurrentMark />当前</span></> : `${r.no}. ${r.name}`,
					r.text, result.shuiFa13Cur && result.shuiFa13Cur.no === r.no ? (r.jx === 'neutral' ? '' : r.jx) : '', `sf-${r.no}`))}
				<div className="horosa-fengshui-liqi-note">{result.shuiFa13.ji}　{result.shuiFa13.xiangFaNote}</div>
				{result.shuiFa13.derived ? <div className="horosa-fengshui-liqi-note">{result.shuiFa13.deriveNote}</div> : null}
			</>) : null}
			{result.geLong ? card('格龙（来龙）', <>{row(result.geLong.laiLong + '龙', result.geLong.text, result.geLong.jx)}
				<div className="horosa-fengshui-liqi-note">{result.geLong.note}</div></>) : null}
			{result.bosha ? card(`拨砂五格（我＝${result.bosha.myWuxing}${result.bosha.boshaVariant === 'laigong' ? `·${result.bosha.myShan}山中针${result.bosha.mySub ? `(${result.bosha.mySub})` : ''}` : ''}）`, result.bosha.sands.filter((s)=>s.wuGe).length ? result.bosha.sands.filter((s)=>s.wuGe).map((s)=>row(`${s.gua}砂(${s.shaWuxing})`, `${s.wuGe.ge}·${s.wuGe.zhu}`, s.wuGe.jx === 'mild' ? '' : s.wuGe.jx)) : [<div key="n" className="horosa-fengshui-liqi-note">未登记砂（左栏八方砂设「砂」）</div>]) : null}
			{result.bosha && result.bosha.note ? <div className="horosa-fengshui-liqi-note">{result.bosha.note}</div> : null}
			{result.xianfa ? card('线法（坐度）', <>{row('穿山72龙', `${result.xianfa.chuanshan.shan}·${result.xianfa.chuanshan.ganzhi}·${result.xianfa.chuanshan.positional}`, result.xianfa.chuanshan.jx)}{row('透地60龙', `${result.xianfa.toudi.ganzhi}${result.xianfa.toudi.kong ? '·空亡' : ''}${result.xianfa.toudi.nayin ? '·' + result.xianfa.toudi.nayin.name : ''}`, result.xianfa.toudi.jx)}{row('120分金', `${result.xianfa.fenjin.ganzhi}·${result.xianfa.fenjin.positional}`, result.xianfa.fenjin.jx)}</>) : null}
			{result.laosanhe ? card('老三合纳音', <div className="horosa-fengshui-liqi-note">{result.laosanhe.note}</div>) : null}</>);
	}
	function renderZibaiPanel(card, row) {
		return (<>
			{card(`${result.year}年 紫白（入中 ${result.yearCenterStar}）`, result.yearPalaces.map((p)=>row(`${p.name} ${p.gua}`, `${p.starName} ${p.jx === 'good' ? '吉' : '凶'}`, p.jx)))}
			{result.monthPalaces ? card(`${result.month}月 流月紫白（入中 ${result.monthCenterStar}）`, result.monthPalaces.map((p)=>row(`${p.name} ${p.gua}`, `${p.starName} ${p.jx === 'good' ? '吉' : '凶'}`, p.jx))) : null}
			{result.dayInfo ? card(`日紫白（${result.dayInfo.dayGanZhi}·${result.dayInfo.yang ? '阳遁' : '阴遁'}${result.dayInfo.yuanName ? `${result.dayInfo.yuanName}` : ''}·入中${result.dayInfo.center}）`, result.dayPalaces.map((p)=>row(`${p.name}`, `${p.starName}`, p.jx))) : null}
			{result.hourInfo ? card(`时紫白（${result.hourInfo.shiZhi}时·入中${result.hourInfo.center}）`, result.hourPalaces.map((p)=>row(`${p.name}`, `${p.starName}`, p.jx))) : null}
			{/* 日紫白要先启用并选日期、时紫白再须时——未启用时右栏不出卡，此处明说还缺什么，免得被当成控件无效。 */}
			{(!result.dayInfo || !result.hourInfo) ? card('日 / 时 紫白', <>
				{row('日紫白', result.dayInfo ? '已出（见上卡）' : '在左栏把「日紫白」切到启用并选定日期')}
				{row('时紫白', result.hourInfo ? '已出（见上卡）' : '需先出日紫白，再填「时(0-23)」')}
			</>) : null}
			{card('紫白诀', result.jue.map((j, i)=>row(`诀${i + 1}`, j.text)))}
		</>);
	}
	function renderBazhaiPanel(card, row) {
		const sy = result.sanyuan;
		return (<>{sy ? card('三元阳宅（以门向定宅·游年只断时日）', <>
				{row('结论', sy.verdict.text, sy.verdict.jx)}
				{row('门卦', `${sy.menGua || '—'}${sy.menGong ? `（${sy.menGong}宫）` : ''} · ${sy.yun}运`)}
				{row('游年之用', sy.youNianRole)}
				{row('兴替反转', sy.fanZhuan, sy.xingTi === 'xing' ? 'good' : 'bad')}
				<div className="horosa-fengshui-liqi-note">{sy.note}</div>
			</>) : null}
			{card('宅命', <>{row('法脉', result.faMai === 'menshang' ? `门上起伏位（伏位卦＝${result.fuweiGua}）` : (result.faMai === 'sanyuan' ? `三元阳宅（伏位卦＝${result.fuweiGua}）` : '坐山起伏位（通行）'), result.faMai === 'zuoshan' ? '' : 'good')}
			{result.lunMing === false ? row('论命卦', '不论（真八宅只论宅不论命）', 'neutral') : null}
			{row('宅卦', `坐${result.zuoGua} · ${result.zhaiGroup}`)}{result.mingGua ? row('命卦', `${NUM_GUA[result.mingGua] || result.mingGua} · ${result.mingGroup}`) : null}{result.match ? row('相配', result.match.text, result.match.same ? 'good' : 'bad') : null}{row('宅类', result.zhaiTypeInfo.name + '（仅分类标注；八方游星仍按静宅单盘）')}</>)}
			{result.sanYao ? card('阳宅三要（门主灶）', <>{row('门→主', result.sanYao.menMain.name, result.sanYao.menMain.jx)}{row('主→灶', result.sanYao.mainStove.name, result.sanYao.mainStove.jx)}{row('门→灶', result.sanYao.menStove.name, result.sanYao.menStove.jx)}{row('综断', result.sanYao.verdict.text, result.sanYao.verdict.jx)}</>) : card(`门主灶（${result.mode === 'ming' ? '以命卦' : '以宅卦'}）`, <>
				{row('门', result.doorMainStove.door)}{row('主', result.doorMainStove.main)}{row('灶', result.doorMainStove.stove)}
				{/* 三要须门/主/灶全设才成两两相配判读。只设一两个时，仍即时报出该卦所落游年星吉凶
				    （否则用户设了门卦却「左右都不动」，会误判成控件坏了），并明说还缺哪个。 */}
				{[['门卦', bazhaiDeep.doorGua], ['主卦', bazhaiDeep.mainGua], ['灶卦', bazhaiDeep.stoveGua]].map(([k, g])=>{
					if (!g) { return null; }
					const pal = (result.palaces || []).find((p)=>p.gua === g);
					return pal ? row(k, `${g}（${pal.dir}）· ${pal.name}·${pal.rank || ''}${pal.jx === 'good' ? '（吉方）' : (pal.jx === 'bad' ? '（凶方）' : '')}`, pal.jx, `sy-${k}`) : row(k, g, '', `sy-${k}`);
				})}
				{(()=>{ const miss = ['门卦', '主卦', '灶卦'].filter((k, i)=>![bazhaiDeep.doorGua, bazhaiDeep.mainGua, bazhaiDeep.stoveGua][i]);
					return row('阳宅三要', miss.length ? `尚缺 ${miss.join('、')}——三卦全设后此卡改出门→主/主→灶/门→灶两两相配与综断` : '已全设');
				})()}
			</>)}
			{card('九星配六事', result.liushi.map((p)=>row(`${p.dir} ${p.star}`, p.advice, p.jx)))}</>);
	}
	function renderQiankunPanel(card, row) {
		return (<>{card('先后天位', <>{row('先天位(主丁)', result.xianTian, 'good')}{row('后天位(主财)', result.houTian, 'good')}{row('案劫(向首)', result.anJie)}{row('合局', result.heJu ? '丁财两旺·合局' : '未合局', result.heJu ? 'good' : '')}</>)}
			{card('九大水位来去水', result.positions.map((p)=>row(`${p.name}${p.posName && p.pos ? '·' + p.posName.replace(/[（(].*/, '') : '(依局图)'}`, p.result, p.jx)))}
			<div className="horosa-fengshui-liqi-note">{result.note}</div></>);
	}
	function renderDaguaPanel(card, row) {
		return (<>{card('六十四卦', <>{row('向卦', `${result.xiang.name}（卦运${result.xiang.yun}·${result.xiang.yuan}）`, result.xiangDeLing ? 'good' : '')}{row('坐卦', `${result.zuo.name}（卦运${result.zuo.yun}·${result.zuo.yuan}）`, result.zuoDeLing ? 'good' : '')}</>)}
			{card('零正收山出煞', <>{row('正神', result.zheng.text, 'good')}{row('零神', result.ling.text)}</>)}
			{card('卦气', result.flags.map((f, i)=>row(`结构${i + 1}`, f.label, f.jx)))}
			{card('三般卦（天玉经）', result.sanban.map((s)=>row(s.name, s.text)))}
			{result.deep ? renderDaguaDeep(card, row, result.deep) : null}
			<div className="horosa-fengshui-liqi-note">{result.note}</div></>);
	}

	function renderDaguaDeep(card, row, d) {
		const ROLE = { xiang: '向', shan: '山(坐)', long: '龙', shui: '水' };
		const four = ['xiang', 'shan', 'long', 'shui'].map((k)=>[k, d.siShu.after[k]]).filter(([, v])=>v);
		return (<>
			{card('二元八运（阳爻九年·阴爻六年·无五运）', <>
				{d.eryuan.cur ? row('当运', `${d.eryuan.cur.gua}${d.eryuan.cur.yun}运 ${d.eryuan.cur.from}–${d.eryuan.cur.to}（${d.eryuan.cur.years}年·${d.eryuan.cur.yuan}）`, 'good') : null}
				{d.eryuan.list.map((e)=>row(`${e.gua}${e.yun}运`, `${e.from}–${e.to}　${e.note}`,
					d.eryuan.cur && d.eryuan.cur.yun === e.yun ? 'good' : '', `ey-${e.yun}`))}
				{row('正神／零神', `${d.eryuan.zhengLing.yuan}：正神 ${d.eryuan.zhengLing.zheng.join('·')} ／ 零神 ${d.eryuan.zhengLing.ling.join('·')}`)}
			</>)}
			{card(`六十四卦四数${d.changed ? '' : ''}${d.chouYao ? `（已抽第${d.chouYao}爻）` : ''}`, <>
				{four.map(([k, v])=>row(`${ROLE[k]}·${v.name}`,
					`先天卦气${v.xianTianQi}／先天卦位${v.xianTianWei}／星运${v.xingYun || '—'}(${v.xingYunCls || '—'})／后天卦位${v.houTianWei}(${v.gong}宫)`,
					'', `ss-${k}`))}
				{d.chouYao ? four.map(([k])=>row(`${ROLE[k]}·抽前`, d.siShu.before[k].name, '', `sb-${k}`)) : null}
			</>)}
			{d.jiaoTong.length ? card('些子法三校（雌雄／生旺／交通）', <>
				{row('结论', d.verdict.text, d.verdict.jx === 'neutral' ? '' : d.verdict.jx)}
				{d.ciXiong.map((c)=>row(`讲雌雄·${c.label}`, c.verdict ? `${c.verdict.a}与${c.verdict.b}：${c.verdict.name}——${c.verdict.text}` : '—',
					c.verdict && c.verdict.jx !== 'neutral' ? c.verdict.jx : '', `cx-${c.label}`))}
				{d.shengWang.map((x)=>row(`求生旺·${ROLE[x.role]}`, `五行(先天卦气) ${x.qi}／卦运 ${x.yun}`, '', `sw-${x.role}`))}
				{d.jiaoTong.map((p)=>row(`交通·${p.label}`,
					[`五行：${p.wuxing ? p.wuxing.text : '—'}`, `卦运：${p.guayun ? p.guayun.text : '—'}`,
						`亲缘：${p.qinyuan ? p.qinyuan.text : '—'}`, `打劫：${p.dajie ? p.dajie.text : '—'}`,
						`后天卦位：${p.houtian ? p.houtian.name : '—'}`].join('；'),
					p.okN >= 3 ? 'good' : (p.okN === 0 ? 'bad' : ''), `jt-${p.label}`))}
				{d.jiaoTong.some((p)=>p.guayun && p.guayun.undefinedGe)
					? <div className="horosa-fengshui-liqi-note">{d.jiaoTong.find((p)=>p.guayun && p.guayun.undefinedGe).guayun.undefinedGe}</div> : null}
			</>) : <div className="horosa-fengshui-liqi-note">{d.verdict.text}</div>}
			{card('五种交通方式', d.jiaoTongKinds.map((j)=>row(j.name, j.ge.join('／'), '', `jk-${j.key}`)))}
			<div className="horosa-fengshui-liqi-note">{d.note}</div>
			<div className="horosa-fengshui-liqi-note">{d.luopanNote}</div>
			<div className="horosa-fengshui-liqi-note">{d.yaoXuNote}</div>
		</>);
	}
	function renderXingshiPanel(card, row) {
		const seg = (t)=>{
			const v = t.v;
			return row(t.k, `${v.score > 0 ? '+' : ''}${v.score} 分`, v.jx);
		};
		const nine = result.scoreMode === 'nine';
		const wuJue = [{ k: '龙法', v: result.long }, { k: '穴法', v: result.xue }, { k: '砂法', v: result.sha }, { k: '水法', v: result.shui }, { k: '向法', v: result.xiang }];
		const siGang = nine ? [{ k: '明堂', v: result.mingtang }, { k: '龙虎', v: result.longhu }, { k: '水口', v: result.shuikou }, { k: '太极(穴证)', v: result.taiji }] : [];
		return (<>{card(nine ? '九纲评分 · 五诀' : '五诀评分', wuJue.map(seg))}
			{nine ? card('九纲评分 · 四纲', siGang.map(seg)) : null}
			{nine && result.modulation.length ? card('权重调制（古籍规则，非线性叠加）',
				result.modulation.map((m)=>row(m.key === 'jiaLong' ? '入首定真假' : (m.key === 'zhenLong' ? '入首定真假' : (m.key === 'shaByLong' ? '砂受龙格调制' : '朝山权重')),
					m.text, m.jx === 'neutral' ? '' : m.jx, `mod-${m.key}`))) : null}
			{card('已定形体', <>
				{row('九星形体', result.long.star ? `${result.long.star.name}（${result.long.star.wuxing}·${result.long.star.shape}）` : '—', result.long.star ? result.long.star.jx : '')}
				{row('穴形', result.xue.type || '—')}
				{row('定穴九法', result.xue.dingXue || '—', result.xue.dingXue ? 'good' : '')}
				{row('倒杖', result.xue.daoZhang || '—')}
				{row('水城', result.shui.cheng ? `${result.shui.cheng.name}（${result.shui.cheng.shape}）` : '—', result.shui.cheng ? result.shui.cheng.jx : '')}
			</>)}
			{nine ? card('九纲已定项', <>
				{row('明堂', `${result.mingtang.ji ? result.mingtang.ji.name : '—'}${result.mingtang.xiong ? ` / ${result.mingtang.xiong.name}` : ''}${result.mingtang.yao.length ? `（合${result.mingtang.yao.length}要求）` : ''}`, result.mingtang.jx)}
				{row('龙虎断', result.longhu.duan ? `${result.longhu.duan.xing} → ${result.longhu.duan.duan}` : '—', result.longhu.duan ? result.longhu.duan.jx : '')}
				{result.longhu.buchangText ? row('缺失补偿', result.longhu.buchangText, 'good') : null}
				{row('水口', `${result.shuikou.sha ? result.shuikou.sha.name : '—'}${result.shuikou.guan.length ? `·${result.shuikou.guan.join('/')}` : ''}${result.shuikou.lock === true ? '·关锁紧闭' : (result.shuikou.lock === false ? '·旷荡不关' : '')}`, result.shuikou.jx)}
				{row('证穴', `${result.taiji.zhengMain} 主法${result.taiji.zhengSpec ? ` + ${result.taiji.zhengSpec} 特法` : ''}`, result.taiji.zhengCount ? 'good' : '')}
				{row('定穴十三法', result.taiji.dingXue ? result.taiji.dingXue.name : '—', result.taiji.dingXue ? 'good' : '')}
				{result.taiji.jieJu ? row('结穴局势', result.taiji.jieJu) : null}
				{result.taiji.guaiXue ? row('怪穴', `${result.taiji.guaiXue.name} → ${result.taiji.guaiXue.how}`) : null}
			</>) : null}
			{nine && result.taiji.veto.length ? card('否决条款（古籍明载）', result.taiji.veto.map((t, i)=>row(`否决${i + 1}`, t, 'bad', `veto-${i}`))) : null}
			{card('综合', <>{row('总分', `${result.total} · ${result.grade.text}`, result.grade.jx)}
				{nine ? row('贵贱之权', result.weightNote, '') : null}</>)}
			<div className="horosa-fengshui-liqi-note">{result.note}</div></>);
	}
	function renderZeriDeep(card, row, d) {
		return (<>
			{d.yongShi ? card(`用事：${d.yongShi.cls}·${d.yongShi.name}`, <>
				{row('释义', d.yongShi.text)}
				{row('轻重', d.yongShi.rank === 1 ? '最重之事' : (d.yongShi.rank === 2 ? '次重' : '其余'))}
				<div className="horosa-fengshui-liqi-note">{d.yongShiNote}</div>
			</>) : null}
			{card('紫白法 · 四流歌诀', d.zibai.jue4.map((j)=>row(j.name, j.lines.join(''), '', `zj-${j.key}`)))}
			{d.zibai.combo ? card('紫白 · 组合查检', <>
				{row(d.zibai.combo.k, d.zibai.combo.text, d.zibai.combo.jx === 'neutral' ? '' : d.zibai.combo.jx)}
				<div className="horosa-fengshui-liqi-note">{d.zibai.comboNote}</div>
			</>) : null}
			{d.zibai.chongFu ? card('紫白 · 冲伏', row(d.zibai.chongFu.kind, d.zibai.chongFu.text,
				d.zibai.chongFu.jx === 'neutral' ? '' : d.zibai.chongFu.jx)) : null}
			{d.zibai.huaSha ? card('动象宫 · 化煞选星', <>
				{row(`宜取 ${d.zibai.huaSha.star} 白／紫`, d.zibai.huaSha.why, 'good')}
				<div className="horosa-fengshui-liqi-note">{d.zibai.huaSha.note}</div>
			</>) : null}
			{card('紫白 · 时间旺衰', d.zibai.shiJian.map((x, i)=>row(`${x.stars.join('·')}星`, `${x.wang}；${x.ke}。${x.note}`, '', `zs-${i}`)))}
			{card('紫白 · 空间旺衰与冲伏', d.zibai.kongJian.map((x, i)=>row(`${x.stars.join('·')}星`, x.text, '', `zk-${i}`)))}
			{card('紫白 · 用事宫四选', d.zibai.gong4.map((g)=>row(g.name, g.text, '', `zg-${g.key}`)))}
			{card('紫白 · 两说并陈', <>
				{row('《宗镜》', d.zibai.liangShuo.zongJing)}
				{row('《诹吉述正》', d.zibai.liangShuo.zhuJi)}
			</>)}
			{d.sanBu.ganZhi ? card('三步选课 ② 干支搭配（自动检测）', <>
				{row('四柱', d.sanBu.ganZhi.pillars.join(' '))}
				{row('结论', d.sanBu.ganZhi.verdict.text, d.sanBu.ganZhi.verdict.jx === 'neutral' ? '' : d.sanBu.ganZhi.verdict.jx)}
				{d.sanBu.ganZhi.tuanJie.length ? row('团结', d.sanBu.ganZhi.tuanJie.map((t)=>`${t.kind}：${t.text}`).join('；'), 'good') : null}
				{d.sanBu.ganZhi.xiangZhan.length ? row('相战', d.sanBu.ganZhi.xiangZhan.map((z)=>`${z.kind}：${z.text}`).join('；'), 'bad') : null}
				{d.sanBu.ganZhi.hanNuan ? row('寒暖调候', `${d.sanBu.ganZhi.hanNuan.need}——${d.sanBu.ganZhi.hanNuan.ok ? `已有 ${d.sanBu.ganZhi.hanNuan.got.join('、')}` : '课中未见'}`,
					d.sanBu.ganZhi.hanNuan.ok ? 'good' : 'bad') : null}
				{d.sanBu.ganZhi.rules.map((r)=>row(r.name, r.text, '', `zr-${r.key}`))}
			</>) : null}
			{card('三步选课 ① 客星趋避', <>
				{row('释义', d.sanBu.keXing.def)}
				{row('次第', d.sanBu.keXing.order)}
				{d.sanBu.keXing.aim.map((a, i)=>row(`目的${i + 1}`, a, '', `za-${i}`))}
				{d.sanBu.keXing.biList.map((b)=>row(b.name, b.text, 'bad', `zb-${b.key}`))}
			</>)}
			{card('三步选课 ③ 天地人沟通', d.sanBu.gouTong.map((g)=>row(g.name, g.items.join('；'), '', `zt-${g.key}`)))}
			{d.douShou ? card(`斗首法（坐${d.douShou.zuoShan} · 斗首五行${d.douShou.myWuxing}）`, <>
				{d.douShou.rows.map((x, i)=>row(`${x.pillar}柱 ${x.gz}`, `天干${x.gan}化气${x.huaQi || '—'}→${x.liuQin || '—'}（${x.rel || '—'}）；地支正五行${x.zhiWuxing || '—'}`, '', `zd-${i}`))}
				{d.douShou.checks.map((c)=>row(c.name, `${c.text}　｜　要点：${c.want}`, c.ok === null ? '' : (c.ok ? 'good' : 'bad'), `zc-${c.key}`))}
				{row('当令', d.douShou.dangLing)}
				<div className="horosa-fengshui-liqi-note">{`斗首五行：${d.douShou.jue.shan}`}</div>
				<div className="horosa-fengshui-liqi-note">{`化气五行：${d.douShou.jue.gan}`}</div>
				<div className="horosa-fengshui-liqi-note">{`正五行：${d.douShou.jue.zhi}`}</div>
				<div className="horosa-fengshui-liqi-note">{d.douShou.note}</div>
			</>) : null}
			<div className="horosa-fengshui-liqi-note">{d.sanBu.note}</div>
			<div className="horosa-fengshui-liqi-note">{d.note}</div>
		</>);
	}

	function renderZeriPanel(card, row) {
		const yg = result.yg;
		return (<>{card(`${yg.yearGanZhi}年 年神方位`, <>{row('太岁', `${yg.taisui.dir}（${yg.taisui.note}）`, 'neutral')}{row('岁破', `${yg.suipo.dir}（大凶忌动）`, 'bad')}{row('三煞', `${yg.sansha.ju}·${yg.sansha.list.map((s)=>`${s.name}${s.zhi}`).join('/')}`, 'bad')}{yg.wuHuang.dir ? row('年五黄', `${yg.wuHuang.dir}（忌动土）`, 'bad') : null}{row('忌动方', yg.jiDongDirs.join('、'), 'bad')}</>)}
			{/* 坐山只在填了月+日、出了造命卡之后才被消费 → 未填日期时左栏改坐山「毫无反应」。
			    此处按年神即时判「本年此坐山能不能动」，使坐山单独成立；不依赖月日。 */}
			{(()=>{
				const chk = result.zuoShanCheck || zuoShanYearCheck(zr.zuoShan, yg);   // 与快照同源
				if (!chk) { return null; }
				return card(`坐山 ${zr.zuoShan} · 本年可动否`, <>
					{row('坐山所在', chk.gongName)}
					{row('本年犯忌', chk.text, chk.hits.length ? 'bad' : 'good')}
				</>);
			})()}
			{result.course ? card(`日课（${result.course.dayGanZhi}）`, <>{row('建除', result.course.jianChu.name, result.course.jianChu.jx)}{row('黄黑道', `${result.course.huangHei.shen}·${result.course.huangHei.dao}`, result.course.huangHei.jx)}{row('值宿', `${result.course.xiu.name}宿（${result.course.xiu.xiang}）`, result.course.xiu.jx)}</>) : null}
			{/* 日课与造命都须先启用候选日课并选日期；来龙/主命再决定四纲评几纲。未启用时明说缺什么。 */}
			{!result.zaoming ? card('日课 / 杨公造命', <>
				{row('尚缺', '候选日课未启用——在左栏切到启用并选定日期后，出建除·黄黑道·值宿日课与造命四纲评分')}
				{row('来龙（补龙）', zr.laiLong ? `已设 ${zr.laiLong}（待日期齐备后评）` : '未设 → 造命不评补龙纲')}
				{row('主命（相主）', zr.zhuYear ? `已设 ${zr.zhuYear} ${zr.zhuMale ? '男' : '女'}（待日期齐备后评）` : '未设 → 造命不评相主纲')}
			</>) : null}
			{result.zaoming ? card(`杨公造命 四纲（坐${result.zaoming.zuoShan}）`, <>
				{result.zaoming.laiLong ? row('来龙', `${result.zaoming.laiLong.shan}山 · ${result.zaoming.laiLong.ju}（龙五行 ${result.zaoming.laiLong.wuxing}）`) : null}
				{result.zaoming.zhuMing ? row('主命', `${result.zaoming.zhuMing.year}年 ${result.zaoming.zhuMing.isMale ? '男' : '女'} · ${result.zaoming.zhuMing.gua}命（${result.zaoming.zhuMing.group}·${result.zaoming.zhuMing.wuxing}）`) : null}
				{['补龙', '扶山', '相主', '避煞'].map((gang)=>{
					const list = result.zaoming.items.filter((it)=>it.gang === gang);
					const done = result.zaoming.gangDone.indexOf(gang) >= 0;
					return (
						<div className="horosa-fengshui-liqi-subgroup" key={gang}>
							<div className="horosa-fengshui-liqi-subhead">{gang}{done ? '' : '（未填入参·不评）'}</div>
							{list.length ? list.map((it, i)=>row(`${it.pillar}柱 ${it.zhi}`, it.effect, it.jx, `${gang}-${i}`)) : <div className="horosa-fengshui-liqi-note" key="none">{done ? '本纲无应' : '—'}</div>}
						</div>
					);
				})}
				{row('课评', `${result.zaoming.score} · ${result.zaoming.grade.text}`, result.zaoming.grade.jx)}
			</>) : null}
			{result.zaoming && result.zaoming.deep ? renderZeriDeep(card, row, result.zaoming.deep) : null}
			<div className="horosa-fengshui-liqi-note">年神方位叠盘标忌动；造命四纲＝补龙·扶山·相主·避煞，来龙与主命留空则该纲不评。</div></>);
	}
}
