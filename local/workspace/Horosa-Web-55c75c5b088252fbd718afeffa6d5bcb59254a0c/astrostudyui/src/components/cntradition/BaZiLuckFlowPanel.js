import { Component } from 'react';
import { julianDayIndex } from '../../utils/julianDayIndex';
import { Spin } from 'antd';
import { Solar, SolarMonth } from 'lunar-javascript';
import { BaziMonthTime, NaYin, SixtyJiaZi } from '../../constants/ZWConst';
import { fetchPreciseJieqiYear } from '../../utils/preciseCalcBridge';
import { buildFlowMonthsByYear } from '../../utils/baziLunarLocal';

const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const YANG_GANS = new Set(['甲', '丙', '戊', '庚', '壬']);
const GAN_ELEMENT = {
	甲: 'wood', 乙: 'wood',
	丙: 'fire', 丁: 'fire',
	戊: 'earth', 己: 'earth',
	庚: 'metal', 辛: 'metal',
	壬: 'water', 癸: 'water',
};
const ELEMENT_COLOR = {
	wood: 'var(--horosa-bazi-wood)',
	fire: 'var(--horosa-bazi-fire)',
	earth: 'var(--horosa-bazi-earth)',
	metal: 'var(--horosa-bazi-metal)',
	water: 'var(--horosa-bazi-water)',
};
const ELEMENT_GENERATES = {
	wood: 'fire',
	fire: 'earth',
	earth: 'metal',
	metal: 'water',
	water: 'wood',
};
const ELEMENT_CONTROLS = {
	wood: 'earth',
	fire: 'metal',
	earth: 'water',
	metal: 'wood',
	water: 'fire',
};
const BRANCH_MAIN_STEM = {
	子: '癸', 丑: '己', 寅: '甲', 卯: '乙',
	辰: '戊', 巳: '丙', 午: '丁', 未: '己',
	申: '庚', 酉: '辛', 戌: '戊', 亥: '壬',
};
const SOLAR_MONTHS = [
	{ name: '立春', month: 2, day: 4 },
	{ name: '惊蛰', month: 3, day: 5 },
	{ name: '清明', month: 4, day: 4 },
	{ name: '立夏', month: 5, day: 5 },
	{ name: '芒种', month: 6, day: 5 },
	{ name: '小暑', month: 7, day: 7 },
	{ name: '立秋', month: 8, day: 7 },
	{ name: '白露', month: 9, day: 7 },
	{ name: '寒露', month: 10, day: 8 },
	{ name: '立冬', month: 11, day: 7 },
	{ name: '大雪', month: 12, day: 7 },
	{ name: '小寒', month: 1, day: 5, nextYear: true },
];
const FLOW_JIEQI_TERMS = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];

function mod(num, base){
	return ((num % base) + base) % base;
}

function num(val, fallback){
	const n = Number(val);
	return Number.isFinite(n) ? n : fallback;
}

function getGanzi(value){
	if(!value){
		return '';
	}
	if(typeof value === 'string'){
		return value;
	}
	return value.ganzhi || value.ganzi || value.ganZhi || value.value || '';
}

function splitGanzi(ganzi){
	const str = `${ganzi || ''}`;
	return {
		stem: str.charAt(0),
		branch: str.charAt(1),
	};
}

function elementColorByStem(stem){
	const element = GAN_ELEMENT[stem];
	return element ? ELEMENT_COLOR[element] : undefined;
}

function elementColorByBranch(branch){
	return elementColorByStem(BRANCH_MAIN_STEM[branch]);
}

function relation(dayStem, targetStem){
	if(!dayStem || !targetStem){
		return '';
	}
	const me = GAN_ELEMENT[dayStem];
	const other = GAN_ELEMENT[targetStem];
	if(!me || !other){
		return '';
	}
	const samePolarity = YANG_GANS.has(dayStem) === YANG_GANS.has(targetStem);
	if(me === other){
		return samePolarity ? '比' : '劫';
	}
	if(ELEMENT_GENERATES[me] === other){
		return samePolarity ? '食' : '伤';
	}
	if(ELEMENT_GENERATES[other] === me){
		return samePolarity ? '枭' : '印';
	}
	if(ELEMENT_CONTROLS[me] === other){
		return samePolarity ? '才' : '财';
	}
	if(ELEMENT_CONTROLS[other] === me){
		return samePolarity ? '杀' : '官';
	}
	return '';
}

function normalizePillar(pillar, dayStem){
	const ganzi = getGanzi(pillar);
	const pair = splitGanzi(ganzi);
	const stemRel = pillar && pillar.stem && pillar.stem.relative ? pillar.stem.relative : relation(dayStem, pair.stem);
	const branchRel = pillar && pillar.branch && pillar.branch.relative ? pillar.branch.relative : relation(dayStem, BRANCH_MAIN_STEM[pair.branch]);
	return {
		ganzi,
		stem: pair.stem,
		branch: pair.branch,
		stemColor: elementColorByStem(pair.stem),
		branchColor: elementColorByBranch(pair.branch),
		stemRel,
		branchRel,
		naYin: NaYin[ganzi] || '',
	};
}

const DAY_REF_INDEX = SixtyJiaZi.indexOf('壬辰');
const DAY_OFFSET = mod(DAY_REF_INDEX - julianDayIndex(2026, 5, 18), 60);

function dayGanzi(date){
	const days = julianDayIndex(date.getFullYear(), date.getMonth() + 1, date.getDate());
	return SixtyJiaZi[mod(days + DAY_OFFSET, 60)];
}

function yearGanzi(year){
	return SixtyJiaZi[mod(year - 1984, 60)];
}

function dateLabel(date){
	return `${date.getMonth() + 1}/${date.getDate()}`;
}

function solarDateLabel(solar){
	return `${solar.getMonth()}/${solar.getDay()}`;
}

function dateFromSolar(solar){
	return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
}

function parseJieqiDate(time){
	const text = `${time || ''}`.trim();
	const match = text.match(/^(\d{3,4})-(\d{1,2})-(\d{1,2})/);
	if(!match){
		return null;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if(!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)){
		return null;
	}
	return new Date(year, month - 1, day);
}

function extractJieqiMap(result){
	const map = {};
	const list = result && Array.isArray(result.jieqi24) ? result.jieqi24 : [];
	list.forEach((item)=>{
		const term = item && item.jieqi ? `${item.jieqi}` : '';
		if(FLOW_JIEQI_TERMS.indexOf(term) < 0){
			return;
		}
		const date = parseJieqiDate(item.time);
		if(date){
			map[term] = date;
		}
	});
	return map;
}

function addDays(date, count){
	const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	next.setDate(next.getDate() + count);
	return next;
}

function birthYearFrom(value){
	const small = Array.isArray(value.smallDirection) ? value.smallDirection : [];
	if(small.length && small[0] && small[0].year !== undefined){
		return num(small[0].year, new Date().getFullYear());
	}
	const birth = value.nongli && value.nongli.birth ? `${value.nongli.birth}` : '';
	const match = birth.match(/^(\d{4})/);
	return match ? Number(match[1]) : new Date().getFullYear();
}

// 虚岁(默认,与原星阙梯位一致,出生=1岁) / 周岁(real=虚岁-1,出生=0岁)。仅展示层换算。
function ageNum(age, ageStyle){
	return ageStyle === 'real' ? Math.max(0, Number(age) - 1) : Number(age);
}

function buildLuckItems(value, dayStem, showXiaoyun, ageStyle){
	const dirs = Array.isArray(value.direction) ? value.direction : [];
	const birthYear = birthYearFrom(value);
	const items = [];
	if(dirs.length && showXiaoyun !== false){
		const firstStart = num(dirs[0].startYear, birthYear);
		const firstAge = Math.max(1, num(dirs[0].age, firstStart - birthYear + 1) - 1);
		items.push({
			id: 'small',
			type: 'small',
			top: `${birthYear}`,
			sub: `${ageNum(1, ageStyle)}-${ageNum(firstAge, ageStyle)}岁`,
			labelOnly: ['小', '运'],
			startYear: birthYear,
			age: 1,
			years: buildSmallYears(value, birthYear, firstStart, dayStem, ageStyle),
		});
	}
	dirs.forEach((dir, idx)=>{
		const pillar = normalizePillar(dir.mainDirect, dayStem);
		const startYear = num(dir.startYear, birthYear + idx * 10);
		const age = num(dir.age, startYear - birthYear + 1);
		items.push({
			id: `direct-${idx}`,
			type: 'direct',
			top: `${startYear}`,
			sub: `${ageNum(age, ageStyle)}岁`,
			startYear,
			age,
			pillar,
			raw: dir,
		});
	});
	return items;
}

export function buildSmallYears(value, birthYear, firstStartYear, dayStem, ageStyle){
	const small = Array.isArray(value.smallDirection) ? value.smallDirection : [];
	const total = Math.max(1, firstStartYear - birthYear);
	return Array.from({ length: total }).map((_, idx)=>{
		const year = birthYear + idx;
		const src = small[idx] || small.find((item)=>num(item.year, -1) === year);
		// 🔴 小运干支源统一:Java /bazi/direct 的 smallDirection 元素小运柱在 src.direct(顶层无 ganzi),
		// 前端 buildLocalBaziResult 的 src.direct 亦为小运柱(且顶层另有 ganzi)。旧码 normalizePillar(src)
		// 对 Java 结构取不到 ganzi → 小运期「大运」列空(真机症:BC/极端年八字大运列没内容)。
		// 优先取 src.direct(两结构其 .ganzi 均为小运干支)→ 零回归修复。
		const smallSrc = (src && src.direct) ? src.direct : src;
		const pillar = normalizePillar(smallSrc || yearGanzi(year), dayStem);
		// 该年真正的流年（小运期：小运干支入「大运」列、流年入「流年」列）。
		const liunianPillar = normalizePillar((src && src.yearGanzi) ? src.yearGanzi : yearGanzi(year), dayStem);
		return {
			id: `small-year-${year}`,
			top: `${year}`,
			sub: `${ageNum(idx + 1, ageStyle)}岁`,
			year,
			age: idx + 1,
			pillar,
			liunianPillar,
			foot: pillar.naYin,
		};
	});
}

function buildYearItems(luck, dayStem, ageStyle){
	if(!luck){
		return [];
	}
	if(luck.type === 'small'){
		return luck.years || [];
	}
	const sub = Array.isArray(luck.raw && luck.raw.subDirect) ? luck.raw.subDirect : [];
	return Array.from({ length: 10 }).map((_, idx)=>{
		const year = luck.startYear + idx;
		const raw = sub[idx];
		const pillar = normalizePillar(raw || yearGanzi(year), dayStem);
		return {
			id: `year-${year}`,
			top: `${year}`,
			sub: `${ageNum(luck.age + idx, ageStyle)}岁`,
			year,
			age: luck.age + idx,
			pillar,
			raw,
			flowMonths: raw && Array.isArray(raw.flowMonths) ? raw.flowMonths : null,
			foot: pillar.naYin,
		};
	});
}

function exactTermDate(jieqiYears, year, term){
	const map = jieqiYears && jieqiYears[year] ? jieqiYears[year] : null;
	return map && map[term] ? map[term] : null;
}

function buildMonthItems(yearItem, dayStem, jieqiYears){
	if(!yearItem){
		return [];
	}
	// perf 惰性化：本地引擎只对「当前公历年所在大运」eager 算 flowMonths，其余流年 flowMonths=null。
	// 读到 null 时按公历年 on-demand 补算（buildFlowMonthsByYear，与 eager 逐字等价），令展示口径与
	// 当前大运一致；补算不到（后端盘无 year / 异常）才退回下方 BaziMonthTime 静态表 fallback。
	let flowMonths = Array.isArray(yearItem.flowMonths) ? yearItem.flowMonths : null;
	if(flowMonths === null && Number.isFinite(Number(yearItem.year)) && dayStem){
		try{
			const recomputed = buildFlowMonthsByYear(Number(yearItem.year), null, dayStem);
			if(Array.isArray(recomputed) && recomputed.length){
				flowMonths = recomputed;
			}
		}catch(e){ /* 落回 BaziMonthTime fallback */ }
	}
	if(Array.isArray(flowMonths) && flowMonths.length){
		return flowMonths.map((item, idx, arr)=>{
			const startSolar = Solar.fromYmd(item.year, item.month, item.day || 1);
			const next = arr[idx + 1];
			const endSolar = next ? Solar.fromYmd(next.year, next.month, next.day || 1) : startSolar.next(30);
			const pillar = normalizePillar(item, dayStem);
			return {
				id: `month-${yearItem.year}-${idx}`,
				top: item.term || '',
				sub: solarDateLabel(startSolar),
				year: item.year,
				month: item.month,
				startDate: dateFromSolar(startSolar),
				endDate: dateFromSolar(endSolar),
				pillar,
				foot: pillar.naYin,
			};
		});
	}
	const year = yearItem.year;
	const yearStem = yearItem.pillar ? yearItem.pillar.stem : splitGanzi(yearGanzi(year)).stem;
	const months = BaziMonthTime.month[yearStem] || [];
	return SOLAR_MONTHS.map((cfg, idx)=>{
		const startYear = cfg.nextYear ? year + 1 : year;
		const startDate = exactTermDate(jieqiYears, startYear, cfg.name) || new Date(startYear, cfg.month - 1, cfg.day);
		const nextCfg = SOLAR_MONTHS[(idx + 1) % SOLAR_MONTHS.length];
		const nextYear = nextCfg.nextYear || idx === SOLAR_MONTHS.length - 1 ? year + 1 : year;
		const endDate = exactTermDate(jieqiYears, nextYear, nextCfg.name) || new Date(nextYear, nextCfg.month - 1, nextCfg.day);
		const pillar = normalizePillar(months[idx] || '', dayStem);
		return {
			id: `month-${year}-${idx}`,
			top: cfg.name,
			sub: dateLabel(startDate),
			year,
			startDate,
			endDate,
			pillar,
			foot: pillar.naYin,
		};
	});
}

function buildDayItems(monthItem, dayStem){
	if(!monthItem){
		return [];
	}
	if(monthItem.year && monthItem.month){
		const lunar = Solar.fromYmd(monthItem.year, monthItem.month, 1).getLunar();
		const startDay = lunar.getPrevJie(true).getSolar().getDay();
		const endDay = lunar.getNextJie(true).getSolar().getDay();
		const days = SolarMonth.fromYm(monthItem.year, monthItem.month).getDays();
		const nextMonth = monthItem.month < 12 ? monthItem.month + 1 : 1;
		const nextYear = monthItem.month < 12 ? monthItem.year : monthItem.year + 1;
		const nextDays = SolarMonth.fromYm(nextYear, nextMonth).getDays();
		const flowDays = [
			...days.filter((item)=>item.getDay() >= startDay),
			...nextDays.filter((item)=>item.getDay() < endDay),
		];
		return flowDays.map((solar)=>{
			const dayLunar = solar.getLunar();
			const ganzi = dayLunar.getDayInGanZhi();
			const pillar = normalizePillar(ganzi, dayStem);
			return {
				id: `day-${solar.getYear()}-${solar.getMonth()}-${solar.getDay()}`,
				top: solarDateLabel(solar),
				sub: '',
				date: dateFromSolar(solar),
				pillar,
				foot: pillar.naYin,
			};
		});
	}
	const start = monthItem.startDate;
	const end = monthItem.endDate || addDays(start, 30);
	const count = Math.max(1, Math.min(32, Math.round((end.getTime() - start.getTime()) / 86400000)));
	return Array.from({ length: count }).map((_, idx)=>{
		const date = addDays(start, idx);
		const pillar = normalizePillar(dayGanzi(date), dayStem);
		return {
			id: `day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
			top: dateLabel(date),
			sub: '',
			date,
			pillar,
			foot: pillar.naYin,
		};
	});
}

class BaZiLuckFlowPanel extends Component{
	constructor(props){
		super(props);
		this.state = {
			luckId: '',
			yearId: '',
			monthId: '',
			dayId: '',
			jieqiYears: {},
			jieqiLoading: {},
		};
		this.ensureJieqiYear = this.ensureJieqiYear.bind(this);
		this.emitSelection = this.emitSelection.bind(this);
	}

	componentDidMount(){
		if(!this.props.fullValue && this.props.onLoad){
			this.props.onLoad();
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(this.props.fullValue !== prevProps.fullValue && this.props.fullValue){
			this.resetSelection(this.props.fullValue);
		}
		if(!this.props.fullValue
			&& !this.props.loading
			&& !this.props.error
			&& this.props.onLoad
			&& (prevProps.loading !== this.props.loading
				|| prevProps.coreValue !== this.props.coreValue
				|| prevProps.fullValue !== this.props.fullValue)){
			this.props.onLoad();
		}
		if(this.props.fullValue && this.state.yearId && this.state.yearId !== prevState.yearId){
			const year = this.currentSelectedYear();
			if(year){
				this.ensureJieqiYear(year);
			}
		}
	}

	resetSelection(value){
		const dayStem = this.getDayStem(value);
		const luckItems = buildLuckItems(value, dayStem, this.props.showXiaoyun !== false, this.props.ageStyle);
		const now = new Date();
		let luck = luckItems.find((item)=>{
			if(item.type === 'small'){
				const years = item.years || [];
				return years.some((year)=>year.year === now.getFullYear());
			}
			return now.getFullYear() >= item.startYear && now.getFullYear() < item.startYear + 10;
		}) || luckItems[0];
		const years = buildYearItems(luck, dayStem, this.props.ageStyle);
		const year = years.find((item)=>item.year === now.getFullYear()) || years[0];
		const months = buildMonthItems(year, dayStem, this.state.jieqiYears);
		const month = months.find((item)=>now >= item.startDate && now < item.endDate) || months[0];
		const days = buildDayItems(month, dayStem);
		const day = days.find((item)=>item.date && item.date.getFullYear() === now.getFullYear() && item.date.getMonth() === now.getMonth() && item.date.getDate() === now.getDate()) || days[0];
		this.setState({
			luckId: luck ? luck.id : '',
			yearId: year ? year.id : '',
			monthId: month ? month.id : '',
			dayId: day ? day.id : '',
		}, ()=>{
			this.emitSelection();
			if(year && year.year){
				this.ensureJieqiYear(year.year);
			}
		});
	}

	emitSelection(){
		if(!this.props.onSelectionChange || !this.props.fullValue){
			return;
		}
		const value = this.props.fullValue || {};
		const dayStem = this.getDayStem(value);
		const luckItems = buildLuckItems(value, dayStem, this.props.showXiaoyun !== false, this.props.ageStyle);
		const luck = luckItems.find((item)=>item.id === this.state.luckId) || luckItems[0];
		const yearItems = buildYearItems(luck, dayStem, this.props.ageStyle);
		const year = yearItems.find((item)=>item.id === this.state.yearId) || yearItems[0];
		const monthItems = buildMonthItems(year, dayStem, this.state.jieqiYears);
		const month = monthItems.find((item)=>item.id === this.state.monthId) || monthItems[0];
		const dayItems = buildDayItems(month, dayStem);
		const day = dayItems.find((item)=>item.id === this.state.dayId) || dayItems[0];
		const isSmall = luck && luck.type === 'small';
		this.props.onSelectionChange({
			luckId: luck ? luck.id : '',
			yearId: year ? year.id : '',
			monthId: month ? month.id : '',
			dayId: day ? day.id : '',
			luckType: luck ? luck.type : '',
			luckStartYear: luck ? luck.startYear : null,
			year: year ? year.year : null,
			luckRaw: luck && luck.raw ? luck.raw : null,
			yearRaw: (isSmall || !(year && year.raw)) ? null : year.raw,
			// 小运期：小运干支(year.pillar)入大运列、当年流年(year.liunianPillar)入流年列。
			luckPillar: (luck && luck.pillar) ? luck.pillar : (isSmall && year ? year.pillar : null),
			yearPillar: year ? ((isSmall && year.liunianPillar) ? year.liunianPillar : year.pillar) : null,
			monthPillar: month && month.pillar ? month.pillar : null,
			dayPillar: day && day.pillar ? day.pillar : null,
		});
	}

	currentSelectedYear(){
		const value = this.props.fullValue || {};
		const dayStem = this.getDayStem(value);
		const luckItems = buildLuckItems(value, dayStem, this.props.showXiaoyun !== false, this.props.ageStyle);
		const luck = luckItems.find((item)=>item.id === this.state.luckId) || luckItems[0];
		const yearItems = buildYearItems(luck, dayStem, this.props.ageStyle);
		const year = yearItems.find((item)=>item.id === this.state.yearId) || yearItems[0];
		return year && year.year ? year.year : null;
	}

	async ensureJieqiYear(year){
		const params = this.props.jieqiParams || {};
		if(!year){
			return;
		}
		const years = [year, year + 1].filter((item, idx, arr)=>arr.indexOf(item) === idx);
		if(years.every((item)=>this.state.jieqiYears[item] || this.state.jieqiLoading[item])){
			return;
		}
		this.setState((prev)=>({
			jieqiLoading: {
				...prev.jieqiLoading,
				...years.reduce((acc, item)=>{
					if(!prev.jieqiYears[item]){
						acc[item] = true;
					}
					return acc;
				}, {}),
			},
		}));
		const results = await Promise.all(years.map(async(item)=>{
			if(this.state.jieqiYears[item]){
				return [item, this.state.jieqiYears[item]];
			}
			const result = await fetchPreciseJieqiYear({
				...params,
				year: item,
				ad: 1,
				needBazi: false,
				needCharts: false,
			});
			return [item, extractJieqiMap(result)];
		}));
		if(!this.props.fullValue){
			return;
		}
		this.setState((prev)=>{
			const nextYears = {
				...prev.jieqiYears,
			};
			const nextLoading = {
				...prev.jieqiLoading,
			};
			results.forEach(([item, map])=>{
				if(map && Object.keys(map).length){
					nextYears[item] = map;
				}
				delete nextLoading[item];
			});
			return {
				jieqiYears: nextYears,
				jieqiLoading: nextLoading,
			};
		});
	}

	getDayStem(value){
		const four = value && value.fourColumns ? value.fourColumns : {};
		return four.day && four.day.stem && four.day.stem.cell ? four.day.stem.cell : '';
	}

	renderAxis(label, badge, items, selectedId, onClick, className){
		return (
			<div className={`horosa-bazi-flow-row ${className || ''}`}>
				<div className="horosa-bazi-flow-label">
					<strong>{label}</strong>
					{badge ? <span>{badge}</span> : null}
				</div>
				<div className="horosa-bazi-flow-axis">
					{items.map((item)=>this.renderItem(item, item.id === selectedId, ()=>onClick(item)))}
				</div>
			</div>
		);
	}

	renderItem(item, selected, onClick){
		const pillar = item.pillar || {};
		const labelOnly = item.labelOnly;
		const stemStyle = pillar.stemColor ? { color: pillar.stemColor } : undefined;
		const branchStyle = pillar.branchColor ? { color: pillar.branchColor } : undefined;
		return (
			<button
				type="button"
				key={item.id}
				className={`horosa-bazi-flow-item ${selected ? 'is-selected' : ''} ${labelOnly ? 'is-label-only' : ''}`}
				onClick={onClick}
			>
				<span className="horosa-bazi-flow-cap" />
				<span className="horosa-bazi-flow-top">{item.top}</span>
				{item.sub ? <span className="horosa-bazi-flow-sub">{item.sub}</span> : null}
				{labelOnly ? (
					<span className="horosa-bazi-flow-label-only">
						{labelOnly.map((line)=><b key={line}>{line}</b>)}
					</span>
				) : (
					<span className="horosa-bazi-flow-pillar">
						<span><b style={stemStyle}>{pillar.stem || ''}</b><em>{pillar.stemRel || ''}</em></span>
						<span><b style={branchStyle}>{pillar.branch || ''}</b><em>{pillar.branchRel || ''}</em></span>
					</span>
				)}
				{item.foot ? <span className="horosa-bazi-flow-foot">{item.foot}</span> : null}
			</button>
		);
	}

	render(){
		const value = this.props.fullValue || {};
		const height = this.props.height || '100%';
		if(this.props.loading && !this.props.fullValue){
			return (
				<div className="horosa-bazi-flow-loading" style={{ minHeight: typeof height === 'number' ? height - 80 : 320 }}>
					<Spin />
					<span>正在生成行运系统</span>
				</div>
			);
		}
		if(!this.props.fullValue){
			return (
				<div className="horosa-bazi-flow-loading" style={{ minHeight: typeof height === 'number' ? height - 80 : 320 }}>
					<span>{this.props.error || '暂无行运数据'}</span>
				</div>
			);
		}
		const dayStem = this.getDayStem(value);
		const luckItems = buildLuckItems(value, dayStem, this.props.showXiaoyun !== false, this.props.ageStyle);
		const luck = luckItems.find((item)=>item.id === this.state.luckId) || luckItems[0];
		const yearItems = buildYearItems(luck, dayStem, this.props.ageStyle);
		const year = yearItems.find((item)=>item.id === this.state.yearId) || yearItems[0];
		const monthItems = buildMonthItems(year, dayStem);
		const month = monthItems.find((item)=>item.id === this.state.monthId) || monthItems[0];
		const dayItems = buildDayItems(month, dayStem);
		const day = dayItems.find((item)=>item.id === this.state.dayId) || dayItems[0];
		return (
			<div
				className={`horosa-bazi-flow-panel ${this.props.compact ? 'horosa-bazi-flow-panel-compact' : ''} ${this.props.className || ''}`}
				style={{ maxHeight: typeof height === 'number' ? height - 22 : undefined }}
			>
				{this.renderAxis('大运', '起运', luckItems, luck ? luck.id : '', (item)=>{
					const years = buildYearItems(item, dayStem, this.props.ageStyle);
					const months = buildMonthItems(years[0], dayStem, this.state.jieqiYears);
					const days = buildDayItems(months[0], dayStem);
					this.setState({
						luckId: item.id,
						yearId: years[0] ? years[0].id : '',
						monthId: months[0] ? months[0].id : '',
						dayId: days[0] ? days[0].id : '',
					}, this.emitSelection);
				})}
				{this.renderAxis('流年', '', yearItems, year ? year.id : '', (item)=>{
					const months = buildMonthItems(item, dayStem, this.state.jieqiYears);
					const days = buildDayItems(months[0], dayStem);
					this.setState({
						yearId: item.id,
						monthId: months[0] ? months[0].id : '',
						dayId: days[0] ? days[0].id : '',
					}, ()=>{
						this.emitSelection();
						this.ensureJieqiYear(item.year);
					});
				})}
				{this.renderAxis('流月', '', monthItems, month ? month.id : '', (item)=>{
					const days = buildDayItems(item, dayStem);
					this.setState({
						monthId: item.id,
						dayId: days[0] ? days[0].id : '',
					}, this.emitSelection);
				})}
				{this.renderAxis('流日', '', dayItems, day ? day.id : '', (item)=>{
					this.setState({
						dayId: item.id,
					}, this.emitSelection);
				}, 'horosa-bazi-flow-day-row')}
			</div>
		);
	}
}

export default BaZiLuckFlowPanel;
