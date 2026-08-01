// 风水 · 理气/水法/大卦/形势/择日 统一工作区（十一派 左参数 / 中SVG盘 / 右断事）。自含 state + useMemo 实时重算。
// 与户型图两法(canvas)互斥;选纯前端流派时由 FengShuiMain 渲染本组件。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { XQSelect, XQSegmented } from '../xq-ui';
import LuoshuGrid from './charts/LuoshuGrid';
import TwentyFourShanRing from './charts/TwentyFourShanRing';
import EightPalaceDisk from './charts/EightPalaceDisk';
import SixtyFourGuaRing from './charts/SixtyFourGuaRing';
import LuopanDial from './charts/LuopanDial';
import XianfaRing from './charts/XianfaRing';
import SixtyFourGuaCircle from './charts/SixtyFourGuaCircle';
import XingshiFormGallery from './charts/XingshiFormGallery';
import { xuankong } from './xuankong';
import { xuankongLiufa } from './xuankongLiufa';
import { mingli } from './mingli';
import { sanhe } from './sanhe';
import { zibai } from './zibai';
import { qiankun } from './qiankun';
import { bazhai } from './bazhai';
import { jinsuo } from './jinsuo';
import { fuxing } from './fuxing';
import { jingyin } from './jingyin';
import { dagua } from './dagua';
import { xingshi, XINGSHI_TABLES } from './xingshi';
import { yearGods, dayCourse, zaoMing } from './zeri';
import { SHAN_ORDER, YUN_YEARS, TIXING_VARIANTS, SANHE_XIANGFA_LIST,
	XUANKONG_SCHOOLS, JIAN_BOUNDARY_OPTIONS, JIAN_BOUNDARY_NOTE, WUHUANG_SPLIT_OPTIONS,
	LUOPAN_LAYERS, LUOPAN_DEFAULT_LAYERS, NEEDLE_USE, LIUFA_NOTE, MINGLI_NOTE,
	SHAN_24, XIU28_RING, SHAN_CENTER_DEG, GONG_NAME as GONG_NAME_MAP } from './fengshuiData';
import { shanAtDeg, chuanshanAt, toudiAt, fenjinAt, gua64AtDeg, najiaYinYang } from './liqiCore';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';

const SHAN_OPTS = SHAN_ORDER.map((s)=>({ value: s, label: s }));
const GUA8 = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];
const GUA8_OPTS = GUA8.map((g)=>({ value: g, label: g }));
const YUN_OPTS = Object.keys(YUN_YEARS).map((y)=>({ value: +y, label: `${y}运 ${YUN_YEARS[y][0]}–${YUN_YEARS[y][1]}` }));
const TIVAR_OPTS = TIXING_VARIANTS.map((v)=>({ value: v.value, label: v.label }));
const SK_OPTS = [
	{ value: '辛', label: '辛 · 火局' }, { value: '戌', label: '戌 · 火局(墓库)' }, { value: '乾', label: '乾 · 火局' },
	{ value: '癸', label: '癸 · 金局' }, { value: '丑', label: '丑 · 金局(墓库)' }, { value: '艮', label: '艮 · 金局' },
	{ value: '乙', label: '乙 · 水局' }, { value: '辰', label: '辰 · 水局(墓库)' }, { value: '巽', label: '巽 · 水局' },
	{ value: '丁', label: '丁 · 木局' }, { value: '未', label: '未 · 木局(墓库)' }, { value: '坤', label: '坤 · 木局' },
];
// 🔴 首项「按水势自动」(value '') 不可删：sanhe 引擎是「显式 xiangFaType 优先、否则由 waterFlow 定」，
//    若下拉无空值档、初值又给了具体向法，则 waterFlow 永远被覆盖 → 左栏「水势」变死开关（曾如此）。
const XIANGFA_OPTS = [{ value: '', label: '（按水势自动）' }, ...SANHE_XIANGFA_LIST.map((t)=>({ value: t, label: t }))];
const SAND_WATER = [{ value: 'sand', label: '砂' }, { value: 'water', label: '水' }, { value: 'flat', label: '平' }];
const COME_GO = [{ value: 'come', label: '来水' }, { value: 'go', label: '去水' }, { value: '', label: '无' }];
const ZHAI_TYPE_OPTS = [{ value: 'jing', label: '静宅(1进)' }, { value: 'dong', label: '动宅(2-5)' }, { value: 'bian', label: '变宅(6-10)' }, { value: 'hua', label: '化宅(11-15)' }];
const QK_POS9 = [
	{ key: 'xianTian', label: '先天位(丁)' }, { key: 'houTian', label: '后天位(财)' }, { key: 'anJie', label: '案劫(向首)' },
	{ key: 'tianJie', label: '天劫(左前)' }, { key: 'diXing', label: '地刑(右前)' },
	{ key: 'bin', label: '宾位' }, { key: 'ke', label: '客位' }, { key: 'fu', label: '辅卦位' }, { key: 'zhengQiao', label: '正窍位' },
];
const FROM_OPTS = [{ value: 'xiang', label: '向卦' }, { value: 'zuo', label: '坐卦' }, { value: 'shuikou', label: '水口对宫' }];
const XK_SCHOOL_OPTS = XUANKONG_SCHOOLS.map((s)=>({ value: s.key, label: s.name }));
const JIANB_OPTS = JIAN_BOUNDARY_OPTIONS.map((o)=>({ value: `${o.value}`, label: o.label }));
const WUHUANG_OPTS = WUHUANG_SPLIT_OPTIONS.map((o)=>({ value: o.value, label: o.value === 'xiagua' ? '下卦运' : '两元八运' }));
const BOSHA_OPTS = [{ value: 'shuangshan', label: '以向为我' }, { value: 'zuo', label: '以坐山为我' }];
const LUOPAN_LAYER_OPTS = LUOPAN_LAYERS.map((l)=>({ key: l.key, label: l.label }));
const YINYANG_OPTS = [{ value: 'yang', label: '阳宅' }, { value: 'yin', label: '阴宅' }];
const JX_CLASS = (jx)=>(jx === 'good' ? 'is-good' : (jx === 'bad' ? 'is-warn' : ''));
const NUM_GUA = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 6: '乾', 7: '兑', 8: '艮', 9: '离' };

export default function LiqiWorkspace({ school }) {
	// 中栏可用面积量测:综合罗经按 min(宽,高) 打满可视区(不超屏、不留大片空白)。
	const chartBoxRef = useRef(null);
	const [chartBox, setChartBox] = useState({ w: 0, h: 0 });
	useEffect(()=>{
		const el = chartBoxRef.current;
		if(!el || typeof ResizeObserver === 'undefined'){ return undefined; }
		const ro = new ResizeObserver((entries)=>{
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
	const [ming, setMing] = useState({ year: 1990, isMale: true });
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
	const [sanheDeep, setSanheDeep] = useState({ xiangFaType: '', zuoDeg: '', boshaVariant: 'shuangshan' });
	const [sands, setSands] = useState({});
	const [bazhaiDeep, setBazhaiDeep] = useState({ doorGua: '', mainGua: '', stoveGua: '', zhaiType: 'jing' });
	// 玄空：门派/兼向度界/五黄分运 三者彼此独立（门派只带描述与侧重，不暗改替星与度界）。
	const [xkDeep, setXkDeep] = useState({ deg: '', yinYangZhai: 'yang', school: 'shen', jianBoundary: 3, wuHuangSplit: 'xiagua' });
	const [zbDate, setZbDate] = useState({ m: '', d: '', hour: '' });
	const [fx, setFx] = useState({ benGua: '坎', qiFrom: 'xiang' });
	const [fxWaters, setFxWaters] = useState({});
	const [jy, setJy] = useState({ long: '乾', xiang: '甲', water: '坤' });
	const [dg, setDg] = useState({ lower: '乾', upper: '乾', yunScheme: 'struct', xiangYun: '', zuoYun: '', deg: '' });
	// 形势 sel 显式初值（此前多键以 undefined 起步）；shaYouQing 必须是 null 而非 false —— false 记 −1 分。
	const [xs, setXs] = useState({
		longSheng: true, longStar: '', boHuan: false, guoXiaGood: false,
		xueType: '', dingXue: '', zhengXue: [], daoZhang: '',
		shaYouQing: null, guiSha: [], xiongSha: [],
		shuiCheng: '', laiShuiKai: false, quShuiGuan: false, xiangChaoJi: false, xiangChongSha: false,
	});
	const [zr, setZr] = useState({ year: new Date().getFullYear(), zuoShan: '子', m: '', d: '', laiLong: '', zhuYear: '', zhuMale: true });
	// 新增三派 + 金锁应期。
	const [jsDeep, setJsDeep] = useState({ yun: 9, year: new Date().getFullYear() });
	const [lf, setLf] = useState({ yun: 9, zuoShan: '子', xiangShan: '午', year: new Date().getFullYear() });
	const [ml, setMl] = useState({ mingYear: 1990, isMale: true, zhaiZuoGua: '坎' });
	const [lp, setLp] = useState({ deg: 0, zuoShan: '子', xiangShan: '午', layers: LUOPAN_DEFAULT_LAYERS });

	const result = useMemo(()=>{
		switch (school) {
			case 'xuankong': return xuankong(yun, xiangShan, { year, month: month || undefined, jian, tiVariant, deg: xkDeep.deg, yinYangZhai: xkDeep.yinYangZhai, school: xkDeep.school, jianBoundary: xkDeep.jianBoundary, wuHuangSplit: xkDeep.wuHuangSplit });
			case 'sanhe': return sanhe({ shuiKou, waterFlow, xiangFaType: sanheDeep.xiangFaType, zuoDeg: sanheDeep.zuoDeg, sands, boshaVariant: sanheDeep.boshaVariant });
			case 'zibai': return zibai({ year, month: month || undefined, date: (zbDate.m && zbDate.d) ? { y: year, m: +zbDate.m, d: +zbDate.d, hour: zbDate.hour !== '' ? +zbDate.hour : undefined } : undefined });
			case 'qiankun': return qiankun({ zuoGua, waters });
			case 'bazhai': return bazhai({ zuoGua, ming, mode: zhaiMode, doorGua: bazhaiDeep.doorGua || undefined, mainGua: bazhaiDeep.mainGua || undefined, stoveGua: bazhaiDeep.stoveGua || undefined, zhaiType: bazhaiDeep.zhaiType });
			case 'jinsuo': return jinsuo({ sectors, yun: jsDeep.yun, year: jsDeep.year });
			case 'fuxing': return fuxing({ benGua: fx.benGua, qiFrom: fx.qiFrom, waters: fxWaters });
			case 'jingyin': return jingyin(jy);
			case 'dagua': return dagua({ xiangLower: dg.lower, xiangUpper: dg.upper, yun, yunScheme: dg.yunScheme, xiangYunInput: dg.xiangYun, zuoYunInput: dg.zuoYun, deg: dg.deg });
			case 'xingshi': return xingshi(xs);
			case 'zeri': return { available: true, isZeri: true, yg: yearGods(zr.year), course: (zr.m && zr.d) ? dayCourse(zr.year, +zr.m, +zr.d) : null,
				zaoming: (zr.m && zr.d) ? zaoMing({ zuoShan: zr.zuoShan, y: zr.year, m: +zr.m, d: +zr.d,
					laiLong: zr.laiLong || undefined, zhuMing: zr.zhuYear ? { year: +zr.zhuYear, isMale: zr.zhuMale } : undefined }) : null };
			case 'liufa': return xuankongLiufa({ yun: lf.yun, zuoShan: lf.zuoShan, xiangShan: lf.xiangShan, year: lf.year });
			case 'mingli': return mingli({ mingYear: ml.mingYear, isMale: ml.isMale, zhaiZuoGua: ml.zhaiZuoGua });
			case 'luopan': return luopanReading(lp);
			default: return null;
		}
	}, [school, xiangShan, yun, year, month, jian, tiVariant, zuoGua, ming, shuiKou, waterFlow, sectors, waters, zhaiMode, sanheDeep, sands, bazhaiDeep, xkDeep, zbDate, fx, fxWaters, jy, dg, xs, zr, jsDeep, lf, ml, lp]);

	useEffect(()=>{
		if (!result || !result.available) { return; }
		const text = buildSnapshot(school, result);
		if (text) { saveModuleAISnapshot('fengshui', text, { source: 'liqi', school }); }
	}, [result, school]);

	if (!result) { return null; }

	return (
		<div className="horosa-fengshui-liqi">
			<div className="horosa-fengshui-liqi-params">{renderParams()}</div>
			<div className="horosa-fengshui-liqi-chart" ref={chartBoxRef}>{renderChart()}</div>
			<div className="horosa-fengshui-liqi-panel">{renderPanel()}</div>
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
	function numField(label, value, onCh, extra = {}, key) {
		return (
			<label key={key} className="horosa-fengshui-liqi-field"><span>{label}</span>
				<input type="number" value={value} onChange={(e)=>onCh(e.target.value)} {...extra} /></label>
		);
	}

	function renderParams() {
		if (school === 'xuankong') {
			return (<>
				{sel('门派', xkDeep.school, XK_SCHOOL_OPTS, pickXkSchool)}
				{sel('元运', yun, YUN_OPTS, setYun)}
				{sel('向首', xiangShan, SHAN_OPTS, setXiangShan)}
				{numField('向首度数(0=不用)', xkDeep.deg, (v)=>setXkDeep({ ...xkDeep, deg: v }), { min: 0, max: 360, step: 0.5 })}
				{segField('起卦法', jian ? 'y' : 'n', [{ value: 'n', label: '下卦(正向)' }, { value: 'y', label: '替卦(兼向)' }], (v)=>setJian(v === 'y'))}
				{jian ? sel('替星方案', tiVariant, TIVAR_OPTS, setTiVariant) : null}
				{segField('兼向度界', `${xkDeep.jianBoundary}`, JIANB_OPTS, (v)=>setXkDeep({ ...xkDeep, jianBoundary: Number(v) }))}
				{segField('五黄分运', xkDeep.wuHuangSplit, WUHUANG_OPTS, (v)=>setXkDeep({ ...xkDeep, wuHuangSplit: v }))}
				{segField('阴阳宅', xkDeep.yinYangZhai, YINYANG_OPTS, (v)=>setXkDeep({ ...xkDeep, yinYangZhai: v }))}
				{numField('流年', year, (v)=>setYear(+v || year), { min: 1864, max: 2043 })}
				{numField('流月(0=不显)', month, (v)=>setMonth(Math.max(0, Math.min(12, +v || 0))), { min: 0, max: 12 })}
			</>);
		}
		if (school === 'sanhe') {
			return (<>
				{sel('水口(去水)', shuiKou, SK_OPTS, setShuiKou)}
				{segField('水势', waterFlow, [{ value: 'leftToRight', label: '左水倒右' }, { value: 'rightToLeft', label: '右水倒左' }], setWaterFlow)}
				{sel('立向法', sanheDeep.xiangFaType, XIANGFA_OPTS, (v)=>setSanheDeep({ ...sanheDeep, xiangFaType: v }))}
				{numField('坐山度数(线法·0-360)', sanheDeep.zuoDeg, (v)=>setSanheDeep({ ...sanheDeep, zuoDeg: v }), { min: 0, max: 360, step: 0.5 })}
				{segField('消砂取「我」', sanheDeep.boshaVariant, BOSHA_OPTS, (v)=>setSanheDeep({ ...sanheDeep, boshaVariant: v }))}
				<div className="horosa-fengshui-liqi-subhead">八方砂（拨砂）</div>
				{GUA8_OPTS.map((o)=>segField(`${o.label}方`, sands[o.value] || 'flat', SAND_WATER, (v)=>setSands({ ...sands, [o.value]: v }), `bs-${o.value}`))}
			</>);
		}
		if (school === 'zibai') {
			return (<>
				{numField('年份', year, (v)=>setYear(+v || year))}
				{numField('流月(0=不显)', month, (v)=>setMonth(Math.max(0, Math.min(12, +v || 0))), { min: 0, max: 12 })}
				<div className="horosa-fengshui-liqi-subhead">日/时紫白（填月日）</div>
				{numField('月', zbDate.m, (v)=>setZbDate({ ...zbDate, m: v }), { min: 1, max: 12 })}
				{numField('日', zbDate.d, (v)=>setZbDate({ ...zbDate, d: v }), { min: 1, max: 31 })}
				{numField('时(0-23,空=不显)', zbDate.hour, (v)=>setZbDate({ ...zbDate, hour: v }), { min: 0, max: 23 })}
			</>);
		}
		if (school === 'bazhai') {
			return (<>
				{sel('坐山', zuoGua, GUA8_OPTS, setZuoGua)}
				{numField('命主年', ming.year, (v)=>setMing({ ...ming, year: +v || ming.year }))}
				{segField('性别', ming.isMale ? 'm' : 'f', [{ value: 'm', label: '男' }, { value: 'f', label: '女' }], (v)=>setMing({ ...ming, isMale: v === 'm' }))}
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
				<div className="horosa-fengshui-liqi-subhead">八方砂水</div>
				{GUA8_OPTS.map((o)=>segField(`${o.label}方`, sectors[o.value] || 'flat', SAND_WATER, (v)=>setSectors({ ...sectors, [o.value]: v }), `js-${o.value}`))}
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
			</>);
		}
		if (school === 'xingshi') {
			return (<>
				<div className="horosa-fengshui-liqi-subhead">龙</div>
				{segField('龙之生死', xs.longSheng ? 'sheng' : 'si', [{ value: 'sheng', label: '生龙' }, { value: 'si', label: '死龙' }], (v)=>setXs({ ...xs, longSheng: v === 'sheng' }))}
				{sel('九星形体', xs.longStar || '', [{ value: '', label: '（不定）' }, ...XINGSHI_TABLES.nineStar.map((s)=>({ value: s.name, label: `${s.name}(${s.wuxing}·${s.jx === 'good' ? '吉' : s.jx === 'bad' ? '凶' : '平'})` }))], (v)=>setXs({ ...xs, longStar: v }))}
				{segField('剥换脱煞', xs.boHuan ? 'y' : 'n', [{ value: 'y', label: '多' }, { value: 'n', label: '少' }], (v)=>setXs({ ...xs, boHuan: v === 'y' }))}
				{segField('过峡束气', xs.guoXiaGood ? 'y' : 'n', [{ value: 'y', label: '紧凑吉' }, { value: 'n', label: '断散' }], (v)=>setXs({ ...xs, guoXiaGood: v === 'y' }))}
				<div className="horosa-fengshui-liqi-subhead">穴</div>
				{sel('穴形', xs.xueType || '', [{ value: '', label: '（不定）' }, ...XINGSHI_TABLES.xueType.map((x)=>({ value: x.name, label: x.name }))], (v)=>setXs({ ...xs, xueType: v }))}
				{sel('定穴九法', xs.dingXue || '', [{ value: '', label: '（不定）' }, ...XINGSHI_TABLES.dingXue.map((x)=>({ value: x, label: x }))], (v)=>setXs({ ...xs, dingXue: v }))}
				{sel('倒杖十二法', xs.daoZhang || '', [{ value: '', label: '（不定）' }, ...XINGSHI_TABLES.daoZhang.map((x)=>({ value: x.name, label: `${x.name}（${x.use}）` }))], (v)=>setXs({ ...xs, daoZhang: v }))}
				{segField('朝案证穴', (xs.zhengXue || []).indexOf('朝山证') >= 0 ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>toggleZheng('朝山证', v === 'y'))}
				{segField('龙虎证穴', (xs.zhengXue || []).indexOf('龙虎证') >= 0 ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>toggleZheng('龙虎证', v === 'y'))}
				{segField('明堂证穴', (xs.zhengXue || []).indexOf('明堂证') >= 0 ? 'y' : 'n', [{ value: 'y', label: '有' }, { value: 'n', label: '无' }], (v)=>toggleZheng('明堂证', v === 'y'))}
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
				{numField('月', zr.m, (v)=>setZr({ ...zr, m: v }), { min: 1, max: 12 })}
				{numField('日', zr.d, (v)=>setZr({ ...zr, d: v }), { min: 1, max: 31 })}
			</>);
		}
		if (school === 'liufa') {
			return (<>
				{sel('元运', lf.yun, YUN_OPTS, (v)=>setLf({ ...lf, yun: +v }))}
				{sel('坐山', lf.zuoShan, SHAN_OPTS, (v)=>setLf({ ...lf, zuoShan: v }))}
				{sel('向首', lf.xiangShan, SHAN_OPTS, (v)=>setLf({ ...lf, xiangShan: v }))}
				{numField('流年（太岁）', lf.year, (v)=>setLf({ ...lf, year: +v || lf.year }), { min: 1864, max: 2100 })}
			</>);
		}
		if (school === 'mingli') {
			return (<>
				{numField('命主年', ml.mingYear, (v)=>setMl({ ...ml, mingYear: +v || ml.mingYear }), { min: 1900, max: 2100 })}
				{segField('性别', ml.isMale ? 'm' : 'f', [{ value: 'm', label: '男' }, { value: 'f', label: '女' }], (v)=>setMl({ ...ml, isMale: v === 'm' }))}
				{sel('宅坐卦', ml.zhaiZuoGua, GUA8_OPTS, (v)=>setMl({ ...ml, zhaiZuoGua: v }))}
			</>);
		}
		if (school === 'luopan') {
			return (<>
				{numField('度数游标(0-360)', lp.deg, (v)=>setLp({ ...lp, deg: Math.max(0, Math.min(360, Number(v) || 0)) }), { min: 0, max: 360, step: 0.1 })}
				{sel('坐山', lp.zuoShan, SHAN_OPTS, (v)=>setLp({ ...lp, zuoShan: v }))}
				{sel('向首', lp.xiangShan, SHAN_OPTS, (v)=>setLp({ ...lp, xiangShan: v }))}
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
			// 罗盘直径吃满中栏可用面积(min(宽,高)-边距;容器即视口约束,天然不超屏);量测未就绪时回退 760。
			const dialSize = (chartBox.w > 120 && chartBox.h > 120)
				? Math.max(640, Math.floor(Math.min(chartBox.w, chartBox.h)) - 16)
				: 760;
			return <LuopanDial deg={result.deg} zuoShan={lp.zuoShan} xiangShan={lp.xiangShan} layers={lp.layers} size={dialSize}
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
		const card = (title, children)=>(<div className="horosa-fengshui-liqi-card"><div className="horosa-fengshui-liqi-card-title">{title}</div>{children}</div>);
		// k 兼作默认 key；同一列表内 k 可能重复（如一柱既生扶又冲克）→ 传 rk 显式指定。
		const row = (k, v, jx, rk)=>(<div className="horosa-fengshui-liqi-row" key={rk || k}><span>{k}</span><strong className={JX_CLASS(jx)}>{v}</strong></div>);
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
		</>);
	}

	function renderXuankongPanel(card, row) {
		const wuG = result.monthPan ? [1, 2, 3, 4, 5, 6, 7, 8, 9].find((g)=>result.monthPan[g] === 5) : null;
		const wuName = wuG ? (result.palaces.find((p)=>p.gong === wuG) || {}).name : null;
		return (<>
			{card('格局', <>{row('坐向', `坐${result.zuoShan} 向${result.xiangShan}`)}{result.jianInfo ? row('兼向判别', result.jianInfo.mode, result.jianInfo.kong ? 'bad' : (result.jianInfo.jian ? 'good' : '')) : null}{row('起卦', result.method + (result.jian && result.sameAsXiaGua ? '（替=下卦·同卦）' : ''), result.jian ? 'good' : '')}{row('格局', result.ge, result.ge.indexOf('旺山旺向') >= 0 ? 'good' : (result.ge.indexOf('上山下水') >= 0 ? 'bad' : ''))}{row('零正', `正神 ${result.zhengShen.name} / 零神 ${result.lingShen.name}`)}{row('阴阳宅', result.yinYangZhai === 'yin' ? '阴宅(墓碑坐穴·重龙脉水口)' : '阳宅(门向纳气·重室内分房)')}</>)}
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
	function renderSanhePanel(card, row) {
		const autoXf = !sanheDeep.xiangFaType;
		return (<>{card('定局', <>{row('水口', `${result.shuiKou} → ${result.ju || '未定'}`)}
			{row('水势', waterFlow === 'rightToLeft' ? '右水倒左' : '左水倒右')}
			{result.xiangFa ? row('立向', `${result.xiangFa.type}（${result.xiangFa.shuangshan || ''}）`, 'good') : null}
			{row('立向取法', autoXf ? '按水势自动（左水倒右→正旺向 / 右水倒左→正生向）' : `显式指定「${sanheDeep.xiangFaType}」（覆盖水势）`)}</>)}
			{result.xiangFa ? card('收水', <div className="horosa-fengshui-liqi-note">{result.xiangFa.note}</div>) : null}
			{result.huangquan ? card('黄泉八煞', <>{result.huangquan.baYao ? row('八曜煞', result.huangquan.baYao.text, 'bad') : null}{result.huangquan.siDa ? result.huangquan.siDa.map((s, i)=>row(`四大黄泉${i + 1}`, s.text, 'bad')) : row('四大黄泉', '本向无', '')}</>) : null}
			{result.bosha ? card(`拨砂五格（我＝${result.bosha.myWuxing}）`, result.bosha.sands.filter((s)=>s.wuGe).length ? result.bosha.sands.filter((s)=>s.wuGe).map((s)=>row(`${s.gua}砂(${s.shaWuxing})`, `${s.wuGe.ge}·${s.wuGe.zhu}`, s.wuGe.jx === 'mild' ? '' : s.wuGe.jx)) : [<div key="n" className="horosa-fengshui-liqi-note">未登记砂（左栏八方砂设「砂」）</div>]) : null}
			{result.xianfa ? card('线法（坐度）', <>{row('穿山72龙', `${result.xianfa.chuanshan.shan}·${result.xianfa.chuanshan.ganzhi}·${result.xianfa.chuanshan.positional}`, result.xianfa.chuanshan.jx)}{row('透地60龙', `${result.xianfa.toudi.ganzhi}${result.xianfa.toudi.kong ? '·空亡' : ''}${result.xianfa.toudi.nayin ? '·' + result.xianfa.toudi.nayin.name : ''}`, result.xianfa.toudi.jx)}{row('120分金', `${result.xianfa.fenjin.ganzhi}·${result.xianfa.fenjin.positional}`, result.xianfa.fenjin.jx)}</>) : null}
			{result.laosanhe ? card('老三合纳音', <div className="horosa-fengshui-liqi-note">{result.laosanhe.note}</div>) : null}</>);
	}
	function renderZibaiPanel(card, row) {
		return (<>
			{card(`${result.year}年 紫白（入中 ${result.yearCenterStar}）`, result.yearPalaces.map((p)=>row(`${p.name} ${p.gua}`, `${p.starName} ${p.jx === 'good' ? '吉' : '凶'}`, p.jx)))}
			{result.monthPalaces ? card(`${result.month}月 流月紫白（入中 ${result.monthCenterStar}）`, result.monthPalaces.map((p)=>row(`${p.name} ${p.gua}`, `${p.starName} ${p.jx === 'good' ? '吉' : '凶'}`, p.jx))) : null}
			{result.dayInfo ? card(`日紫白（${result.dayInfo.dayGanZhi}·${result.dayInfo.yang ? '阳遁' : '阴遁'}·入中${result.dayInfo.center}）`, result.dayPalaces.map((p)=>row(`${p.name}`, `${p.starName}`, p.jx))) : null}
			{result.hourInfo ? card(`时紫白（${result.hourInfo.shiZhi}时·入中${result.hourInfo.center}）`, result.hourPalaces.map((p)=>row(`${p.name}`, `${p.starName}`, p.jx))) : null}
			{/* 日紫白须月+日同填、时紫白再须时——只填其一时右栏不出卡，此处明说还缺什么，免得被当成控件无效。 */}
			{(!result.dayInfo || !result.hourInfo) ? card('日 / 时 紫白', <>
				{row('日紫白', result.dayInfo ? '已出（见上卡）' : `需同时填「月」与「日」——现${zbDate.m ? '' : '缺月、'}${zbDate.d ? '' : '缺日'}${zbDate.m && zbDate.d ? '（已齐）' : ''}`)}
				{row('时紫白', result.hourInfo ? '已出（见上卡）' : '需先出日紫白，再填「时(0-23)」')}
			</>) : null}
			{card('紫白诀', result.jue.map((j, i)=>row(`诀${i + 1}`, j.text)))}
		</>);
	}
	function renderBazhaiPanel(card, row) {
		return (<>{card('宅命', <>{row('宅卦', `坐${result.zuoGua} · ${result.zhaiGroup}`)}{result.mingGua ? row('命卦', `${NUM_GUA[result.mingGua] || result.mingGua} · ${result.mingGroup}`) : null}{result.match ? row('相配', result.match.text, result.match.same ? 'good' : 'bad') : null}{row('宅类', result.zhaiTypeInfo.name + '·' + result.zhaiTypeInfo.method)}</>)}
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
			<div className="horosa-fengshui-liqi-note">{result.note}</div></>);
	}
	function renderXingshiPanel(card, row) {
		const seg = (t)=>{
			const v = t.v;
			return row(t.k, `${v.score > 0 ? '+' : ''}${v.score} 分`, v.jx);
		};
		return (<>{card('五诀评分', [{ k: '龙法', v: result.long }, { k: '穴法', v: result.xue }, { k: '砂法', v: result.sha }, { k: '水法', v: result.shui }, { k: '向法', v: result.xiang }].map(seg))}
			{card('已定形体', <>
				{row('九星形体', result.long.star ? `${result.long.star.name}（${result.long.star.wuxing}·${result.long.star.shape}）` : '—', result.long.star ? result.long.star.jx : '')}
				{row('穴形', result.xue.type || '—')}
				{row('定穴九法', result.xue.dingXue || '—', result.xue.dingXue ? 'good' : '')}
				{row('倒杖', result.xue.daoZhang || '—')}
				{row('水城', result.shui.cheng ? `${result.shui.cheng.name}（${result.shui.cheng.shape}）` : '—', result.shui.cheng ? result.shui.cheng.jx : '')}
			</>)}
			{card('综合', row('总分', `${result.total} · ${result.grade.text}`, result.grade.jx))}
			<div className="horosa-fengshui-liqi-note">{result.note}</div></>);
	}
	function renderZeriPanel(card, row) {
		const yg = result.yg;
		return (<>{card(`${yg.yearGanZhi}年 年神方位`, <>{row('太岁', `${yg.taisui.dir}（${yg.taisui.note}）`, 'neutral')}{row('岁破', `${yg.suipo.dir}（大凶忌动）`, 'bad')}{row('三煞', `${yg.sansha.ju}·${yg.sansha.list.map((s)=>`${s.name}${s.zhi}`).join('/')}`, 'bad')}{yg.wuHuang.dir ? row('年五黄', `${yg.wuHuang.dir}（忌动土）`, 'bad') : null}{row('忌动方', yg.jiDongDirs.join('、'), 'bad')}</>)}
			{/* 坐山只在填了月+日、出了造命卡之后才被消费 → 未填日期时左栏改坐山「毫无反应」。
			    此处按年神即时判「本年此坐山能不能动」，使坐山单独成立；不依赖月日。 */}
			{(()=>{
				const meta = SHAN_24[zr.zuoShan] || [];
				const g = meta[0];
				if (!g) { return null; }
				const hits = [];
				if (yg.suipo.gong === g) { hits.push('犯岁破（大凶忌动）'); }
				if (yg.taisui.gong === g) { hits.push('坐太岁（可向不宜坐犯）'); }
				if ((yg.sansha.list || []).some((s)=>s.gong === g)) { hits.push(`犯三煞（${yg.sansha.ju}）`); }
				if (yg.wuHuang.gong === g) { hits.push('年五黄飞临（忌动土）'); }
				return card(`坐山 ${zr.zuoShan} · 本年可动否`, <>
					{row('坐山所在', GONG_NAME_MAP[g] || '—')}
					{row('本年犯忌', hits.length ? hits.join('；') : '不犯岁破/太岁/三煞/年五黄', hits.length ? 'bad' : 'good')}
				</>);
			})()}
			{result.course ? card(`日课（${result.course.dayGanZhi}）`, <>{row('建除', result.course.jianChu.name, result.course.jianChu.jx)}{row('黄黑道', `${result.course.huangHei.shen}·${result.course.huangHei.dao}`, result.course.huangHei.jx)}{row('值宿', `${result.course.xiu.name}宿（${result.course.xiu.xiang}）`, result.course.xiu.jx)}</>) : null}
			{/* 日课与造命都须月+日齐备；来龙/主命再决定四纲评几纲。未齐时明说缺什么。 */}
			{!result.zaoming ? card('日课 / 杨公造命', <>
				{row('尚缺', `${zr.m ? '' : '「月」'}${(!zr.m && !zr.d) ? '与' : ''}${zr.d ? '' : '「日」'}——填齐后出建除·黄黑道·值宿日课与造命四纲评分`)}
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
			<div className="horosa-fengshui-liqi-note">年神方位叠盘标忌动；造命四纲＝补龙·扶山·相主·避煞，来龙与主命留空则该纲不评。</div></>);
	}
}

// 综合罗经：当前度数的逐层读数（正针/中针/缝针三针 + 线法三层 + 64卦 + 28宿 + 卦宫元龙）。
//   中针较正针退半山 → 该度在中针环读到的山 = shanAtDeg(deg + 7.5)；缝针进半山 → shanAtDeg(deg − 7.5)。
function luopanReading(lp) {
	const d = ((Number(lp.deg) % 360) + 360) % 360;
	const zheng = shanAtDeg(d);
	const meta = SHAN_24[zheng] || [];
	const xiu = XIU28_RING.find((c)=>((d - c.deg0) % 360 + 360) % 360 < (((c.deg1 - c.deg0) % 360 + 360) % 360 || 360)) || null;
	return {
		available: true, isLuopan: true, deg: d, layers: lp.layers, zuoShan: lp.zuoShan, xiangShan: lp.xiangShan,
		needles: [
			{ key: 'zheng', name: '地盘正针', shan: zheng, use: NEEDLE_USE.zheng, offset: 0 },
			{ key: 'ren', name: '人盘中针', shan: shanAtDeg(d + 7.5), use: NEEDLE_USE.ren, offset: -7.5 },
			{ key: 'feng', name: '天盘缝针', shan: shanAtDeg(d - 7.5), use: NEEDLE_USE.feng, offset: 7.5 },
		],
		chuanshan: chuanshanAt(d), toudi: toudiAt(d), fenjin: fenjinAt(d), gua64: gua64AtDeg(d),
		xiu: xiu ? { name: xiu.label, xiang: xiu.xiang, jx: xiu.jx } : null,
		gong: meta[0] || null, gongName: meta[0] ? GONG_NAME_MAP[meta[0]] : null,
		yuanlong: meta[1] || null, yinyang: meta[2] === 1 ? '阳' : (meta[2] === -1 ? '阴' : null),
		jingYinYang: najiaYinYang(zheng),
	};
}

// AI 快照文本（各派）。
function buildSnapshot(school, r) {
	const L = [`【风水·${SCHOOL_CN[school] || school}】`];
	if (school === 'xuankong') {
		L.push(`坐${r.zuoShan}向${r.xiangShan} ${r.yun}运 · ${r.method}${r.jian ? `(${r.tiVariant})` : ''} · 格局：${r.ge}`);
		L.push(`取用：门派${r.school ? r.school.name : '—'} · 替星${r.tiVariant} · 兼向度界出中${r.jianBoundary}° · 五黄${r.wuHuangSplit === 'liangyuan' ? '两元八运' : '下卦运'}`
			+ (r.wuHuang ? ` · ${r.wuHuang.text}` : ''));
		if (r.jianInfo) { L.push(`兼向：${r.jianInfo.mode}`); }
		L.push(`零正：正神${r.zhengShen.name}/零神${r.lingShen.name} · ${r.yinYangZhai === 'yin' ? '阴宅' : '阳宅'}`);
		if (r.gate && r.gate.available && r.gate.zheng) { L.push(`城门：正城门${r.gate.zheng.name}${r.gate.fu ? `、副${r.gate.fu.name}` : ''}`); }
		if (r.flags.length) { L.push(`结构：${r.flags.map((f)=>`${f.label}${f.nature === 'mild' ? '(力缓)' : ''}`).join('、')}`); }
		if (r.yearHui && r.yearHui.length) { L.push(`流年会断：${r.yearHui.map((h)=>h.warn).join('；')}`); }
		L.push('双星：' + r.palaces.map((p)=>`${p.name}${p.shan}·${p.xiang}(${p.combo.note})`).join('；'));
	} else if (school === 'sanhe') {
		L.push(`水口${r.shuiKou}→${r.ju}` + (r.xiangFa ? ` · 立${r.xiangFa.type}(${r.xiangFa.shuangshan || ''})` : ''));
		if (r.huangquan && r.huangquan.baYao) { L.push(`黄泉：${r.huangquan.baYao.text}`); }
		if (r.bosha) { const s = r.bosha.sands.filter((x)=>x.wuGe); if (s.length) { L.push('拨砂：' + s.map((x)=>`${x.gua}${x.wuGe.ge}`).join('、')); } }
		if (r.xianfa) { L.push(`坐度线法：穿山${r.xianfa.chuanshan.ganzhi}/透地${r.xianfa.toudi.ganzhi}/分金${r.xianfa.fenjin.positional}`); }
	} else if (school === 'zibai') {
		L.push(`${r.year}年入中${r.yearCenterStar}`);
		L.push(r.yearPalaces.map((p)=>`${p.name}${p.starName}${p.jx === 'good' ? '吉' : '凶'}`).join(' '));
		if (r.monthPalaces) { L.push(`${r.month}月入中${r.monthCenterStar}`); }
		if (r.dayInfo) { L.push(`日紫白${r.dayInfo.dayGanZhi}入中${r.dayInfo.center}(${r.dayInfo.yang ? '阳遁' : '阴遁'})`); }
		if (r.hourInfo) { L.push(`时紫白${r.hourInfo.shiZhi}时入中${r.hourInfo.center}`); }
	} else if (school === 'bazhai') {
		L.push(`坐${r.zuoGua}${r.zhaiGroup}` + (r.mingGua ? ` · 命卦${NUM_GUA[r.mingGua] || r.mingGua}${r.mingGroup}${r.match ? '·' + r.match.text : ''}` : ''));
		if (r.sanYao) { L.push(`三要：门→主${r.sanYao.menMain.name}/主→灶${r.sanYao.mainStove.name}/门→灶${r.sanYao.menStove.name}·${r.sanYao.verdict.text}`); }
		L.push('游星：' + r.palaces.map((p)=>`${p.dir}${p.name}`).join(' '));
	} else if (school === 'qiankun') {
		L.push(`坐${r.zuoGua} · 先天位${r.xianTian}(主丁)/后天位${r.houTian}(主财)/案劫${r.anJie}` + (r.heJu ? ' · 合局' : ''));
		L.push('九水位：' + r.positions.map((p)=>`${p.name}${p.result}`).join('；'));
	} else if (school === 'jinsuo') {
		L.push(`得位${r.deCount}/8 ${r.score}分`);
		L.push(r.palaces.map((p)=>`${p.gua}${p.deWei ? '得位' : (p.actual === 'flat' ? '平' : '失位')}`).join(' '));
		if (r.palaces.some((p)=>p.yingqi)) {
			L.push(`应期（${r.yun}运·${r.year}年）：` + r.palaces.map((p)=>`${p.gua}${p.yingqi.text}`).join('；'));
		}
	} else if (school === 'fuxing') {
		L.push(`辅星${(FROM_OPTS.find((o)=>o.value === r.qiFrom) || {}).label || '向卦'}起${r.startGua || r.benGua}${r.heFa ? '·合法' : ''}`);
		L.push(r.palaces.map((p)=>`${p.gua}${p.youxing}${p.water ? (p.water === 'come' ? '来' : '去') : ''}`).join(' '));
	} else if (school === 'jingyin') {
		L.push(`龙${r.items[0].shan}${r.items[0].yy || ''}/向${r.items[1].shan}${r.items[1].yy || ''}/水${r.items[2].shan}${r.items[2].yy || ''} · ${r.verdict.text}`);
		if (r.liuxiu) { L.push(`六秀：${r.liuxiu.list.join('、')}`); }
	} else if (school === 'dagua') {
		L.push(`向${r.xiang.name}(卦运${r.xiang.yun})/坐${r.zuo.name}(卦运${r.zuo.yun}) · 正神${r.zheng.yun}零神${r.ling.yun}`);
		if (r.degInfo) { L.push(`向首度数 ${r.deg}° → ${r.degInfo.gua} ${r.degInfo.yao}爻（${r.degInfo.sector}宫·入卦 ${r.degInfo.degInGua}°）`); }
		L.push('卦气：' + r.flags.map((f)=>f.label).join('、'));
	} else if (school === 'xingshi') {
		L.push(`龙${r.long.score}穴${r.xue.score}砂${r.sha.score}水${r.shui.score}向${r.xiang.score} · 总${r.total}·${r.grade.text}`);
		L.push(`形体：九星${r.long.star ? r.long.star.name : '—'}/穴形${r.xue.type || '—'}/定穴${r.xue.dingXue || '—'}/倒杖${r.xue.daoZhang || '—'}/水城${r.shui.cheng ? r.shui.cheng.name : '—'}`);
	} else if (school === 'zeri') {
		const yg = r.yg;
		L.push(`${yg.yearGanZhi}年神：太岁${yg.taisui.dir}/岁破${yg.suipo.dir}/三煞${yg.sansha.list.map((s)=>s.zhi).join('')}/五黄${yg.wuHuang.dir || '—'} · 忌动${yg.jiDongDirs.join('、')}`);
		if (r.course) { L.push(`日课：建除${r.course.jianChu.name}/${r.course.huangHei.dao}/${r.course.xiu.name}宿`); }
		if (r.zaoming) {
			const z = r.zaoming;
			L.push(`造命四纲（坐${z.zuoShan}）：已评 ${z.gangDone.join('·')}`
				+ (z.laiLong ? ` · 来龙${z.laiLong.shan}(${z.laiLong.ju})` : '')
				+ (z.zhuMing ? ` · 主命${z.zhuMing.year}${z.zhuMing.isMale ? '男' : '女'}${z.zhuMing.gua}命(${z.zhuMing.wuxing})` : ''));
			['补龙', '扶山', '相主', '避煞'].forEach((g)=>{
				const list = z.items.filter((it)=>it.gang === g);
				if (list.length) { L.push(`　${g}：${list.map((it)=>`${it.pillar}柱${it.effect}`).join('；')}`); }
			});
			L.push(`课评：${z.grade.text}(${z.score})`);
		}
	} else if (school === 'liufa') {
		L.push(`${r.yun}运 坐${r.zuoShan} 向${r.xiangShan}${r.yunRange ? `（${r.yunRange[0]}–${r.yunRange[1]}）` : ''}`);
		r.items.forEach((it)=>{ L.push(`${it.name}：${it.verdict}${it.detail ? ` —— ${it.detail}` : ''}`); });
		L.push(`综断：${r.summary.text}（合${r.goodN}·违${r.badN}）`);
		L.push(r.note);
	} else if (school === 'mingli') {
		const m = r.ming; const mt = r.match;
		L.push(`命主 ${m.year}年${m.isMale ? '男' : '女'} · ${m.gua}命（${m.group}·${m.wuxing}）· ${m.yiJu}`);
		L.push(`喜忌：${m.xiYong}`);
		L.push(`宅：坐${r.zhai.zuoGua}（${r.zhai.dir}·${r.zhai.group}·${r.zhai.wuxing}）`);
		L.push(`相配：${mt.groupText}；宅对命${mt.star ? `${mt.star.name}(${mt.star.rank})` : '—'}；五行${mt.wuxing ? mt.wuxing.label : '—'} → ${mt.verdict.text}`);
		L.push(`个人吉方：${r.jiFang.map((f)=>`${f.dir}${f.star}`).join('、')}`);
		L.push(`个人凶方：${r.xiongFang.map((f)=>`${f.dir}${f.star}`).join('、')}`);
		L.push(r.note);
	} else if (school === 'luopan') {
		L.push(`坐${r.zuoShan} 向${r.xiangShan} · 度数 ${r.deg.toFixed(2)}°`);
		L.push('三针：' + r.needles.map((n)=>`${n.name}${n.offset ? `(${n.offset > 0 ? '+' : ''}${n.offset}°)` : ''}＝${n.shan}山`).join('；'));
		L.push(`线法：穿山${r.chuanshan.ganzhi}(${r.chuanshan.positional})/透地${r.toudi.ganzhi}${r.toudi.nayin ? `·${r.toudi.nayin.name}` : ''}${r.toudi.kong ? '·空亡' : ''}/分金${r.fenjin.ganzhi}(${r.fenjin.positional})`);
		L.push(`卦爻：${r.gua64.gua} ${r.gua64.yao}爻（${r.gua64.sector}宫·入卦${r.gua64.degInGua}°）`);
		if (r.xiu) { L.push(`二十八宿：${r.xiu.name}宿（${r.xiu.xiang}）—— 等分示意，非周天盈缩实度`); }
		L.push(`卦宫：${r.gongName || '—'} · ${r.yuanlong || '—'}元${r.yinyang || ''} · 净${r.jingYinYang || '—'}`);
		L.push('三针分工：正针格龙立向、中针消砂、缝针纳水。');
	}
	return L.join('\n');
}

export const SCHOOL_CN = {
	naqi: '纳气盘', bagua: '八卦阳宅', bazhai: '八宅大游年', xuankong: '玄空飞星', sanhe: '三合水法',
	jinsuo: '金锁玉关', qiankun: '乾坤国宝', zibai: '紫白飞星',
	fuxing: '辅星水法', jingyin: '净阴净阳', dagua: '玄空大卦', xingshi: '形势峦头', zeri: '择日选择',
	liufa: '玄空六法', mingli: '命理派', luopan: '综合罗经',
};
