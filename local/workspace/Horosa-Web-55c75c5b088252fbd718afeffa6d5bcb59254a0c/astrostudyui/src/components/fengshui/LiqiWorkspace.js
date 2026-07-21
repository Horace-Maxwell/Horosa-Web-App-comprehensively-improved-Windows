// 风水 · 理气/水法/大卦/形势/择日 统一工作区（十一派 左参数 / 中SVG盘 / 右断事）。自含 state + useMemo 实时重算。
// 与户型图两法(canvas)互斥;选纯前端流派时由 FengShuiMain 渲染本组件。
import React, { useEffect, useMemo, useState } from 'react';
import { XQSelect, XQSegmented } from '../xq-ui';
import LuoshuGrid from './charts/LuoshuGrid';
import TwentyFourShanRing from './charts/TwentyFourShanRing';
import EightPalaceDisk from './charts/EightPalaceDisk';
import SixtyFourGuaRing from './charts/SixtyFourGuaRing';
import { xuankong } from './xuankong';
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
import { SHAN_ORDER, YUN_YEARS, TIXING_VARIANTS, SANHE_XIANGFA_LIST } from './fengshuiData';
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
const XIANGFA_OPTS = SANHE_XIANGFA_LIST.map((t)=>({ value: t, label: t }));
const SAND_WATER = [{ value: 'sand', label: '砂' }, { value: 'water', label: '水' }, { value: 'flat', label: '平' }];
const COME_GO = [{ value: 'come', label: '来水' }, { value: 'go', label: '去水' }, { value: '', label: '无' }];
const ZHAI_TYPE_OPTS = [{ value: 'jing', label: '静宅(1进)' }, { value: 'dong', label: '动宅(2-5)' }, { value: 'bian', label: '变宅(6-10)' }, { value: 'hua', label: '化宅(11-15)' }];
const QK_POS9 = [
	{ key: 'xianTian', label: '先天位(丁)' }, { key: 'houTian', label: '后天位(财)' }, { key: 'anJie', label: '案劫(向首)' },
	{ key: 'tianJie', label: '天劫(左前)' }, { key: 'diXing', label: '地刑(右前)' },
	{ key: 'bin', label: '宾位' }, { key: 'ke', label: '客位' }, { key: 'fu', label: '辅卦位' }, { key: 'zhengQiao', label: '正窍位' },
];
const FROM_OPTS = [{ value: 'xiang', label: '向卦' }, { value: 'zuo', label: '坐卦' }, { value: 'shuikou', label: '水口对宫' }];
const JX_CLASS = (jx)=>(jx === 'good' ? 'is-good' : (jx === 'bad' ? 'is-warn' : ''));
const NUM_GUA = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 6: '乾', 7: '兑', 8: '艮', 9: '离' };

export default function LiqiWorkspace({ school }) {
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
	const [sanheDeep, setSanheDeep] = useState({ xiangFaType: '正旺向', zuoDeg: '', boshaVariant: 'shuangshan' });
	const [sands, setSands] = useState({});
	const [bazhaiDeep, setBazhaiDeep] = useState({ doorGua: '', mainGua: '', stoveGua: '', zhaiType: 'jing' });
	const [xkDeep, setXkDeep] = useState({ deg: '', yinYangZhai: 'yang' });
	const [zbDate, setZbDate] = useState({ m: '', d: '', hour: '' });
	const [fx, setFx] = useState({ benGua: '坎', qiFrom: 'xiang' });
	const [fxWaters, setFxWaters] = useState({});
	const [jy, setJy] = useState({ long: '乾', xiang: '甲', water: '坤' });
	const [dg, setDg] = useState({ lower: '乾', upper: '乾', yunScheme: 'struct', xiangYun: '', zuoYun: '' });
	const [xs, setXs] = useState({ longSheng: true, longStar: '', shuiCheng: '' });
	const [zr, setZr] = useState({ year: new Date().getFullYear(), zuoShan: '子', m: '', d: '' });

	const result = useMemo(()=>{
		switch (school) {
			case 'xuankong': return xuankong(yun, xiangShan, { year, month: month || undefined, jian, tiVariant, deg: xkDeep.deg, yinYangZhai: xkDeep.yinYangZhai });
			case 'sanhe': return sanhe({ shuiKou, waterFlow, xiangFaType: sanheDeep.xiangFaType, zuoDeg: sanheDeep.zuoDeg, sands, boshaVariant: sanheDeep.boshaVariant });
			case 'zibai': return zibai({ year, month: month || undefined, date: (zbDate.m && zbDate.d) ? { y: year, m: +zbDate.m, d: +zbDate.d, hour: zbDate.hour !== '' ? +zbDate.hour : undefined } : undefined });
			case 'qiankun': return qiankun({ zuoGua, waters });
			case 'bazhai': return bazhai({ zuoGua, ming, mode: zhaiMode, doorGua: bazhaiDeep.doorGua || undefined, mainGua: bazhaiDeep.mainGua || undefined, stoveGua: bazhaiDeep.stoveGua || undefined, zhaiType: bazhaiDeep.zhaiType });
			case 'jinsuo': return jinsuo({ sectors });
			case 'fuxing': return fuxing({ benGua: fx.benGua, qiFrom: fx.qiFrom, waters: fxWaters });
			case 'jingyin': return jingyin(jy);
			case 'dagua': return dagua({ xiangLower: dg.lower, xiangUpper: dg.upper, yun, yunScheme: dg.yunScheme, xiangYunInput: dg.xiangYun, zuoYunInput: dg.zuoYun });
			case 'xingshi': return xingshi(xs);
			case 'zeri': return { available: true, isZeri: true, yg: yearGods(zr.year), course: (zr.m && zr.d) ? dayCourse(zr.year, +zr.m, +zr.d) : null, zaoming: (zr.m && zr.d) ? zaoMing({ zuoShan: zr.zuoShan, y: zr.year, m: +zr.m, d: +zr.d }) : null };
			default: return null;
		}
	}, [school, xiangShan, yun, year, month, jian, tiVariant, zuoGua, ming, shuiKou, waterFlow, sectors, waters, zhaiMode, sanheDeep, sands, bazhaiDeep, xkDeep, zbDate, fx, fxWaters, jy, dg, xs, zr]);

	useEffect(()=>{
		if (!result || !result.available) { return; }
		const text = buildSnapshot(school, result);
		if (text) { saveModuleAISnapshot('fengshui', text, { source: 'liqi', school }); }
	}, [result, school]);

	if (!result) { return null; }

	return (
		<div className="horosa-fengshui-liqi">
			<div className="horosa-fengshui-liqi-params">{renderParams()}</div>
			<div className="horosa-fengshui-liqi-chart">{renderChart()}</div>
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
				{sel('元运', yun, YUN_OPTS, setYun)}
				{sel('向首', xiangShan, SHAN_OPTS, setXiangShan)}
				{numField('向首度数(0=不用)', xkDeep.deg, (v)=>setXkDeep({ ...xkDeep, deg: v }), { min: 0, max: 360, step: 0.5 })}
				{segField('起卦法', jian ? 'y' : 'n', [{ value: 'n', label: '下卦(正向)' }, { value: 'y', label: '替卦(兼向)' }], (v)=>setJian(v === 'y'))}
				{jian ? sel('替星方案', tiVariant, TIVAR_OPTS, setTiVariant) : null}
				{segField('阴阳宅', xkDeep.yinYangZhai, [{ value: 'yang', label: '阳宅' }, { value: 'yin', label: '阴宅' }], (v)=>setXkDeep({ ...xkDeep, yinYangZhai: v }))}
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
			return GUA8_OPTS.map((o)=>segField(`${o.label}方`, sectors[o.value] || 'flat', SAND_WATER, (v)=>setSectors({ ...sectors, [o.value]: v }), `js-${o.value}`));
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
			return (<>
				{sel('元运', yun, YUN_OPTS, setYun)}
				{sel('向·下卦(内)', dg.lower, GUA8_OPTS, (v)=>setDg({ ...dg, lower: v }))}
				{sel('向·上卦(外)', dg.upper, GUA8_OPTS, (v)=>setDg({ ...dg, upper: v }))}
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
				{sel('坐山', zr.zuoShan, SHAN_OPTS, (v)=>setZr({ ...zr, zuoShan: v }))}
				<div className="horosa-fengshui-liqi-subhead">候选日课（造命/日课）</div>
				{numField('月', zr.m, (v)=>setZr({ ...zr, m: v }), { min: 1, max: 12 })}
				{numField('日', zr.d, (v)=>setZr({ ...zr, d: v }), { min: 1, max: 31 })}
			</>);
		}
		return null;
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
		if (school === 'sanhe') { return <TwentyFourShanRing ring={result.ring} zuoShan={null} xiangShan={null} size={700} />; }
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
			return <SixtyFourGuaRing xiang={result.xiang} zuo={result.zuo} zheng={result.zheng} ling={result.ling} flags={result.flags} size={620} />;
		}
		if (school === 'xingshi') { return renderXingshiChart(); }
		if (school === 'zeri') { return renderZeriChart(); }
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
		const row = (k, v, jx)=>(<div className="horosa-fengshui-liqi-row" key={k}><span>{k}</span><strong className={JX_CLASS(jx)}>{v}</strong></div>);
		if (school === 'xuankong') { return renderXuankongPanel(card, row); }
		if (school === 'sanhe') { return renderSanhePanel(card, row); }
		if (school === 'zibai') { return renderZibaiPanel(card, row); }
		if (school === 'bazhai') { return renderBazhaiPanel(card, row); }
		if (school === 'qiankun') { return renderQiankunPanel(card, row); }
		if (school === 'jinsuo') {
			return (<>{card(`得位 ${result.deCount}/8 · ${result.score} 分`, result.palaces.map((p)=>row(`${p.gua} ${p.needLabel}`, p.desc, p.deWei ? 'good' : (p.actual === 'flat' ? '' : 'bad'))))}
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
		return null;
	}

	function renderXuankongPanel(card, row) {
		const wuG = result.monthPan ? [1, 2, 3, 4, 5, 6, 7, 8, 9].find((g)=>result.monthPan[g] === 5) : null;
		const wuName = wuG ? (result.palaces.find((p)=>p.gong === wuG) || {}).name : null;
		return (<>
			{card('格局', <>{row('坐向', `坐${result.zuoShan} 向${result.xiangShan}`)}{result.jianInfo ? row('兼向判别', result.jianInfo.mode, result.jianInfo.kong ? 'bad' : (result.jianInfo.jian ? 'good' : '')) : null}{row('起卦', result.method + (result.jian && result.sameAsXiaGua ? '（替=下卦·同卦）' : ''), result.jian ? 'good' : '')}{row('格局', result.ge, result.ge.indexOf('旺山旺向') >= 0 ? 'good' : (result.ge.indexOf('上山下水') >= 0 ? 'bad' : ''))}{row('零正', `正神 ${result.zhengShen.name} / 零神 ${result.lingShen.name}`)}{row('阴阳宅', result.yinYangZhai === 'yin' ? '阴宅(墓碑坐穴·重龙脉水口)' : '阳宅(门向纳气·重室内分房)')}</>)}
			{result.flags.length ? card('结构', result.flags.map((f)=>row(f.label, f.nature === 'good' ? '吉' : '凶', f.nature))) : null}
			{result.gate && result.gate.available ? card('城门诀', <>{result.gate.zheng ? row('正城门', `${result.gate.zheng.name}（向星${result.gate.zheng.xiangStar}·${result.gate.zheng.heShi ? '合十' : '旺'}）`, 'good') : null}{result.gate.fu ? row('副城门', `${result.gate.fu.name}（向星${result.gate.fu.xiangStar}）`, 'good') : null}</>) : null}
			{card('双星断（逐宫）', result.palaces.map((p)=>row(`${p.name} ${p.shan}·${p.xiang}`, p.combo.note, p.combo.badge)))}
			{result.yearHui && result.yearHui.length ? card('流年会断', result.yearHui.map((h, i)=>row(`${result.palaces.find((p)=>p.gong === h.gong).name}`, h.warn, h.jx))) : null}
			{result.monthPan ? card('流月飞星', <>{row('月入中', `${result.monthPan[5]}`)}{row('向首流月星', `${result.monthPan[result.gXiang]}`)}{wuName ? row('五黄到（忌动）', wuName, 'bad') : null}</>) : null}
		</>);
	}
	function renderSanhePanel(card, row) {
		return (<>{card('定局', <>{row('水口', `${result.shuiKou} → ${result.ju || '未定'}`)}{result.xiangFa ? row('立向', `${result.xiangFa.type}（${result.xiangFa.shuangshan || ''}）`, 'good') : null}</>)}
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
			{card('紫白诀', result.jue.map((j, i)=>row(`诀${i + 1}`, j.text)))}
		</>);
	}
	function renderBazhaiPanel(card, row) {
		return (<>{card('宅命', <>{row('宅卦', `坐${result.zuoGua} · ${result.zhaiGroup}`)}{result.mingGua ? row('命卦', `${NUM_GUA[result.mingGua] || result.mingGua} · ${result.mingGroup}`) : null}{result.match ? row('相配', result.match.text, result.match.same ? 'good' : 'bad') : null}{row('宅类', result.zhaiTypeInfo.name + '·' + result.zhaiTypeInfo.method)}</>)}
			{result.sanYao ? card('阳宅三要（门主灶）', <>{row('门→主', result.sanYao.menMain.name, result.sanYao.menMain.jx)}{row('主→灶', result.sanYao.mainStove.name, result.sanYao.mainStove.jx)}{row('门→灶', result.sanYao.menStove.name, result.sanYao.menStove.jx)}{row('综断', result.sanYao.verdict.text, result.sanYao.verdict.jx)}</>) : card(`门主灶（${result.mode === 'ming' ? '以命卦' : '以宅卦'}）`, <>{row('门', result.doorMainStove.door)}{row('主', result.doorMainStove.main)}{row('灶', result.doorMainStove.stove)}</>)}
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
			{card('综合', row('总分', `${result.total} · ${result.grade.text}`, result.grade.jx))}
			<div className="horosa-fengshui-liqi-note">{result.note}</div></>);
	}
	function renderZeriPanel(card, row) {
		const yg = result.yg;
		return (<>{card(`${yg.yearGanZhi}年 年神方位`, <>{row('太岁', `${yg.taisui.dir}（${yg.taisui.note}）`, 'neutral')}{row('岁破', `${yg.suipo.dir}（大凶忌动）`, 'bad')}{row('三煞', `${yg.sansha.ju}·${yg.sansha.list.map((s)=>`${s.name}${s.zhi}`).join('/')}`, 'bad')}{yg.wuHuang.dir ? row('年五黄', `${yg.wuHuang.dir}（忌动土）`, 'bad') : null}{row('忌动方', yg.jiDongDirs.join('、'), 'bad')}</>)}
			{result.course ? card(`日课（${result.course.dayGanZhi}）`, <>{row('建除', result.course.jianChu.name, result.course.jianChu.jx)}{row('黄黑道', `${result.course.huangHei.shen}·${result.course.huangHei.dao}`, result.course.huangHei.jx)}{row('值宿', `${result.course.xiu.name}宿（${result.course.xiu.xiang}）`, result.course.xiu.jx)}</>) : null}
			{result.zaoming ? card(`杨公造命（坐${result.zaoming.zuoShan}）`, <>{result.zaoming.items.length ? result.zaoming.items.map((it, i)=>row(`${it.pillar}柱`, it.effect, it.jx)) : [<div key="n" className="horosa-fengshui-liqi-note">四柱无扶山/犯煞项</div>]}{row('课评', `${result.zaoming.score} · ${result.zaoming.grade.text}`, result.zaoming.grade.jx)}</>) : null}
			<div className="horosa-fengshui-liqi-note">年神方位叠盘标忌动;造命=扶山避煞(补龙相主须来龙五行与主命)</div></>);
	}
}

// AI 快照文本（各派）。
function buildSnapshot(school, r) {
	const L = [`【风水·${SCHOOL_CN[school] || school}】`];
	if (school === 'xuankong') {
		L.push(`坐${r.zuoShan}向${r.xiangShan} ${r.yun}运 · ${r.method}${r.jian ? `(${r.tiVariant})` : ''} · 格局：${r.ge}`);
		if (r.jianInfo) { L.push(`兼向：${r.jianInfo.mode}`); }
		L.push(`零正：正神${r.zhengShen.name}/零神${r.lingShen.name} · ${r.yinYangZhai === 'yin' ? '阴宅' : '阳宅'}`);
		if (r.gate && r.gate.available && r.gate.zheng) { L.push(`城门：正城门${r.gate.zheng.name}${r.gate.fu ? `、副${r.gate.fu.name}` : ''}`); }
		if (r.flags.length) { L.push(`结构：${r.flags.map((f)=>f.label).join('、')}`); }
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
	} else if (school === 'fuxing') {
		L.push(`辅星${(FROM_OPTS.find((o)=>o.value === r.qiFrom) || {}).label || '向卦'}起${r.startGua || r.benGua}${r.heFa ? '·合法' : ''}`);
		L.push(r.palaces.map((p)=>`${p.gua}${p.youxing}${p.water ? (p.water === 'come' ? '来' : '去') : ''}`).join(' '));
	} else if (school === 'jingyin') {
		L.push(`龙${r.items[0].shan}${r.items[0].yy || ''}/向${r.items[1].shan}${r.items[1].yy || ''}/水${r.items[2].shan}${r.items[2].yy || ''} · ${r.verdict.text}`);
		if (r.liuxiu) { L.push(`六秀：${r.liuxiu.list.join('、')}`); }
	} else if (school === 'dagua') {
		L.push(`向${r.xiang.name}(卦运${r.xiang.yun})/坐${r.zuo.name}(卦运${r.zuo.yun}) · 正神${r.zheng.yun}零神${r.ling.yun}`);
		L.push('卦气：' + r.flags.map((f)=>f.label).join('、'));
	} else if (school === 'xingshi') {
		L.push(`龙${r.long.score}穴${r.xue.score}砂${r.sha.score}水${r.shui.score}向${r.xiang.score} · 总${r.total}·${r.grade.text}`);
	} else if (school === 'zeri') {
		const yg = r.yg;
		L.push(`${yg.yearGanZhi}年神：太岁${yg.taisui.dir}/岁破${yg.suipo.dir}/三煞${yg.sansha.list.map((s)=>s.zhi).join('')}/五黄${yg.wuHuang.dir || '—'} · 忌动${yg.jiDongDirs.join('、')}`);
		if (r.course) { L.push(`日课：建除${r.course.jianChu.name}/${r.course.huangHei.dao}/${r.course.xiu.name}宿`); }
		if (r.zaoming) { L.push(`造命坐${r.zaoming.zuoShan}：${r.zaoming.grade.text}(${r.zaoming.score})`); }
	}
	return L.join('\n');
}

export const SCHOOL_CN = {
	naqi: '纳气盘', bagua: '八卦阳宅', bazhai: '八宅大游年', xuankong: '玄空飞星', sanhe: '三合水法',
	jinsuo: '金锁玉关', qiankun: '乾坤国宝', zibai: '紫白飞星',
	fuxing: '辅星水法', jingyin: '净阴净阳', dagua: '玄空大卦', xingshi: '形势峦头', zeri: '择日选择',
};
