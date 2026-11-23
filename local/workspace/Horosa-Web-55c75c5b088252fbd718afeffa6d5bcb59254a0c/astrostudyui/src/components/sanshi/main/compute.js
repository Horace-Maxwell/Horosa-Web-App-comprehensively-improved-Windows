// 三式合一页 · 起盘取数:奇门 / 太乙 / 命盘取数、参数组装、节气种子与农历预取
// 从 SanShiUnitedMain.js 按职责拆出的 SanShiUnitedMain 方法:this 仍是 SanShiUnitedMain 实例,门面里 mixinMethods(SanShiUnitedMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { castChartFor } from '../../../utils/derivedChartSource';
import { calcDunJia, fetchQimenPan, normalizeKinqimenData, isQimenLocalRoute, needJieqiYearSeed, jieqiSeedYears, jieqiSeedSignature } from '../../dunjia/DunJiaCalc';
import { getNongliLocalCache, setNongliLocalCache } from '../../../utils/localCalcCache';
import { fetchPreciseNongli, fetchPreciseJieqiSeed } from '../../../utils/preciseCalcBridge';
import { fetchTaiyiPan } from '../../taiyi/TaiYiCalc';
import { applyTaiyiSchool } from '../../taiyi/core/taiyiSchool';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
import { safe, resolveCalcGeo, buildDisplaySolarParams, getNongliKey } from '../../dunjia/qimenPageShared';
import { resolveAfter23NewDay, resolveLateZiHourUseNextDay } from '../../../utils/dayBoundaryResolve';
import { QIMEN_OPTIONS } from './options';
import { normalizeTimeAlg, normalizeZoneOffset, normalizeAdValue, getFieldKey, getQimenOptionsKey } from './format';

export const computeMethods = {
	async resolveDisplaySolarTime(params, primaryNongli){
		if(!params){
			return safe(primaryNongli && primaryNongli.birth, '');
		}
		const current = safe(primaryNongli && primaryNongli.birth, '');
		if(normalizeTimeAlg(params.timeAlg) === 0){
			return current;
		}
		const solarParams = buildDisplaySolarParams(params);
		const cachedSolar = getNongliLocalCache(solarParams);
		if(cachedSolar && cachedSolar.birth){
			return safe(cachedSolar.birth, current);
		}
		try{
			const solarNongli = await fetchPreciseNongli(solarParams);
			if(solarNongli){
				setNongliLocalCache(solarParams, solarNongli);
			}
			return safe(solarNongli && solarNongli.birth, current);
		}catch(e){
			return current;
		}
	},

	getCachedDunJia(fields, nongli, qimenOptions, year, isDiurnal, displaySolarTime){
		const key = [
			getFieldKey(fields),
			getNongliKey(nongli),
			getQimenOptionsKey(qimenOptions),
			`${year || ''}`,
			`${safe(isDiurnal, '')}`,
			`${safe(displaySolarTime, '')}`,
			// 种子签名(同独立页 getCachedPan):种子异步到达后键变 → 不命中缺种子时算出的退化盘。
			jieqiSeedSignature(this.jieqiYearSeeds),
		].join('|');
		if(this.panCache.has(key)){
			return this.panCache.get(key);
		}
		// ctx 与独立页 DunJiaMain.getContext 同构(含 displaySolarTime),否则本地年/月/日家盘与独立页分叉。
		const pan = calcDunJia(fields, nongli, qimenOptions, {
			year,
			jieqiYearSeeds: this.jieqiYearSeeds,
			isDiurnal,
			displaySolarTime,
		});
		this.panCache.set(key, pan);
		if(this.panCache.size > 48){
			const firstKey = this.panCache.keys().next().value;
			if(firstKey){
				this.panCache.delete(firstKey);
			}
		}
		return pan;
	},

	async getKinqimenDunJia(fields, nongli, qimenOptions, year, isDiurnal, displaySolarTime){
		const fallbackPan = this.getCachedDunJia(fields, nongli, qimenOptions, year, isDiurnal, displaySolarTime);
		// 🔴 路由与独立页 DunJiaMain.getResolvedPan 完全一致(否则结果分叉=用户报的「三式合一遁甲≠独立遁甲」):
		//   本地 calcDunJia ← 年/月/日/刻/金函家(各家局法) 或 飞盘/混合/报数(后端不支持) 或 七组本地口径任一非缺省;
		//   后端 fetchQimenPan ← 时家/综合·转盘·全缺省口径(保「时家=转盘」原有行为零回归)。
		// 本地 calcDunJia 返回的 pan 不带 source 字段(source:'kinqimen' 仅后端合并路径有),故本地分支不校验 source。
		const o = qimenOptions || {};
		// 路由单源 isQimenLocalRoute(DunJiaCalc,与独立页/择日弹窗同判据):本地家/飞盘/混合/报数/七组本地口径任一非缺省 → 本地。
		const localOnly = isQimenLocalRoute(o);
		if(localOnly){
			if(!fallbackPan){
				throw new Error('sanshi.qimen.kinqimen_unavailable');
			}
			return this.applySanshiFaRelated(fallbackPan, o);
		}
		const backendPan = await fetchQimenPan(fields, nongli, qimenOptions, {
			year,
			jieqiYearSeeds: this.jieqiYearSeeds,
			isDiurnal,
			displaySolarTime,
		});
		const pan = normalizeKinqimenData(backendPan, fallbackPan, qimenOptions, nongli);
		if(!pan || pan.source !== 'kinqimen'){
			throw new Error('sanshi.qimen.kinqimen_unavailable');
		}
		return this.applySanshiFaRelated(pan, o);
	},

	// 三式相关人员挂 pan(与独立页 applyFaRelatedToPan 同单源语义:法奇门 DunJiaFaCalc 读 pan.faRelatedPeople 数组)。
	// 三式侧输入为文本(逗号/空格分隔生年天干),此处解析为十干数组;空=空数组(显式)防兜底读独立页全局残留。
	applySanshiFaRelated(pan, opt){
		if(!pan){ return pan; }
		const raw = `${(opt && opt.faRelatedPeople) || ''}`;
		const gans = raw.split(/[\s,，、]+/).map((x)=>x.trim()).filter((x)=>'甲乙丙丁戊己庚辛壬癸'.indexOf(x) >= 0);
		pan.faRelatedPeople = gans;
		return pan;
	},

	async getKintaiyiPan(fields, nongli, options){
		const pan = await fetchTaiyiPan(fields, nongli, {
			style: options && options.taiyiStyle !== undefined ? options.taiyiStyle : 3,
			tn: options && options.taiyiAccum !== undefined ? options.taiyiAccum : 0,
			sex: options && options.sex === 0 ? '女' : '男',
			// 太乙时间基准:此前钉死 direct(独立太乙页却有下拉)→ 三式太乙区补同源控件 taiyiTimeBasis(缺省 direct 零回归);
			// 仍不随盘 timeAlg 串改(盘真太阳时只作用于奇门),用户显式选「真太阳时」才换基准。
			timeBasis: options && options.taiyiTimeBasis === 'trueSolar' ? 'trueSolar' : 'direct',
			after23NewDay: options && options.after23NewDay !== undefined ? options.after23NewDay : defaultAfter23NewDay(),
			lateZiHourUseNextDay: options && options.lateZiHourUseNextDay !== undefined ? options.lateZiHourUseNextDay : defaultLateZiHourUseNextDay(),
			// 博弈分析(去硬编码:对齐独立 TaiYiMain;默认 0=关闭,与原行为一致)。
			gameTheory: options && options.gameTheory === 1 ? 1 : 0,
		});
		if(!pan || pan.source !== 'kintaiyi'){
			throw new Error('sanshi.taiyi.kintaiyi_unavailable');
		}
		// 太乙流派覆盖层(对齐独立 TaiYiMain.recalc):以 base pan 为底按所选流派开关覆盖受影响神煞 + 几何重算主客算;
		// 默认全 default → applyTaiyiSchool 为空操作,字节不变(零回归)。
		const ov = applyTaiyiSchool(pan, options && options.taiyiSchool);
		return ov.pan || pan;
	},

	getActiveFields(){
		return this.state.localFields || this.props.fields || {};
	},

	// 紫微四化页的时空基准:时间算法取本页的(options.timeAlg),不取共享字段 —— 本页时间算法只作用本页、不写共享字段,
	// 共享字段里的可能是别的页的口径;两者不同时四化盘会按另一个时辰排
	getZiweiSihuaFields(){
		const opt = this.state.options || {};
		return { ...this.getActiveFields(), timeAlg: { value: normalizeTimeAlg(opt.timeAlg) } };
	},

	// 起课参照盘:只认与 flds 同一起课时刻地点的那张(castChartFor);主盘在途 / 取失败 / 宿主还没取到这一刻时 → null
	castChartOf(flds){
		return castChartFor(this.props.chartObj || this.props.chart || null, flds);
	},

	// 精确历法取不到时的兜底农历:只拿同一起课时刻的参照盘上的(上一刻的底盘农历不顶这一课)
	getChartNongliFallback(flds){
		const chartWrap = this.castChartOf(flds);
		const chart = chartWrap && chartWrap.chart ? chartWrap.chart : chartWrap;
		if(!chart || !chart.nongli){
			return null;
		}
		return {
			...chart.nongli,
		};
	},

	genParams(fields, overrideOptions){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return null;
		}
		const opt = {
			...(this.state.options || {}),
			...(overrideOptions || {}),
		};
		const calcGeo = resolveCalcGeo(flds, opt);
		const zoneValue = normalizeZoneOffset(safe(flds.zone && flds.zone.value, ''), '+08:00');
		const adRaw = (flds.ad && flds.ad.value !== undefined && flds.ad.value !== null)
			? flds.ad.value
			: 1;
		const adValue = normalizeAdValue(adRaw, 1);
		return {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: zoneValue,
			lon: calcGeo.lon,
			lat: calcGeo.lat,
			gpsLat: calcGeo.gpsLat,
			gpsLon: calcGeo.gpsLon,
			ad: adValue,
			gender: opt.sex,
			timeAlg: normalizeTimeAlg(opt.timeAlg),
			after23NewDay: resolveAfter23NewDay(opt.after23NewDay),
			// v2.2.1: 透传时柱开关给后端 /nongli/time。
			lateZiHourUseNextDay: resolveLateZiHourUseNextDay(opt.lateZiHourUseNextDay),
		};
	},

	genJieqiParams(fields, year, overrideOptions){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return null;
		}
		const opt = {
			...(this.state.options || {}),
			...(overrideOptions || {}),
		};
		const calcGeo = resolveCalcGeo(flds, opt);
		const zoneValue = normalizeZoneOffset(safe(flds.zone && flds.zone.value, ''), '+08:00');
		const adRaw = (flds.ad && flds.ad.value !== undefined && flds.ad.value !== null)
			? flds.ad.value
			: 1;
		return {
			year: `${year}`,
			ad: normalizeAdValue(adRaw, 1),
			zone: zoneValue,
			lon: calcGeo.lon,
			lat: calcGeo.lat,
			gpsLat: calcGeo.gpsLat,
			gpsLon: calcGeo.gpsLon,
			timeAlg: normalizeTimeAlg(opt.timeAlg),
			hsys: 0,
			zodiacal: 0,
			siderealAyanamsa: '',
			doubingSu28: false,
		};
	},

	getQimenOptions(overrideOptions){
		const opt = {
			...(this.state.options || {}),
			...(overrideOptions || {}),
		};
		return {
			...QIMEN_OPTIONS,
			sex: opt.sex,
			timeAlg: normalizeTimeAlg(opt.timeAlg),
			paiPanType: opt.paiPanType,
			zhiShiType: opt.zhiShiType,
			yueJiaQiJuType: opt.yueJiaQiJuType,
			qijuMethod: opt.qijuMethod,
			kongMode: opt.kongMode,
			yimaMode: opt.yimaMode,
			shiftPalace: opt.shiftPalace,
			// 奇门流派/起局补充(对齐独立 DunJiaMain):盘式(转盘/飞盘/混合) + 阴盘报数定局 + 封局 + 置闰天数。
			school: opt.school !== undefined ? opt.school : '转盘',
			shuziReportNumber: opt.shuziReportNumber !== undefined ? opt.shuziReportNumber : '',
			fengJu: !!opt.fengJu,
			zhirunLeapDays: opt.zhirunLeapDays !== undefined ? opt.zhirunLeapDays : 9,
			// 三式缺口补齐:盘类+相关人员透传(与独立页同语义;默认=事局/空=零回归)
			chartCategory: opt.chartCategory !== undefined ? opt.chartCategory : 'shi',
			faRelatedPeople: opt.faRelatedPeople !== undefined ? opt.faRelatedPeople : '',
			godsPreset: opt.godsPreset !== undefined ? opt.godsPreset : 'baihu_xuanwu',
			anGanMode: opt.anGanMode !== undefined ? opt.anGanMode : 'off',
			showAnZhi: !!opt.showAnZhi,
			jiGongMode: opt.jiGongMode || 'kun',
			showJiGan: !!opt.showJiGan,
			showTianQin: !!opt.showTianQin,
			tuiYanView: opt.tuiYanView || 'off',
			tuiYanGong: opt.tuiYanGong || 'shigan',
			feiXingShun: !!opt.feiXingShun,
			feiMenShun: !!opt.feiMenShun,
			feiShenShun: !!opt.feiShenShun,
			feiMenZhongCan: opt.feiMenZhongCan !== false,
			feiMenZhongShow: !!opt.feiMenZhongShow,
			mixTian: opt.mixTian || '',
			mixXing: opt.mixXing || '',
			mixMen: opt.mixMen || '',
			mixShen: opt.mixShen || '',
			kongMarkBoth: !!opt.kongMarkBoth,
			showAllKong: !!opt.showAllKong,
			shiftZhiFuMode: opt.shiftZhiFuMode === 'recalc' ? 'recalc' : 'follow',
			dayJiaJu: opt.dayJiaJu || 'yiyuan',
			keJiaFenDun: opt.keJiaFenDun || 'zihou',
			keZiZhengHuanShi: !!opt.keZiZhengHuanShi,
			jinhanMenPai: opt.jinhanMenPai === 'shun' ? 'shun' : 'book',
			yearJiaJu: opt.yearJiaJu === 'yinian' ? 'yinian' : 'sanyuan',
			// 三式合一统一按“交接时刻”计算，避免日级近似切换。
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
			after23NewDay: resolveAfter23NewDay(opt.after23NewDay),
			// v2.2.1: 透传时柱开关给奇门后端引擎。
			lateZiHourUseNextDay: resolveLateZiHourUseNextDay(opt.lateZiHourUseNextDay),
		};
	},

	async ensureJieqiSeed(fields, year){
		if(!year || Number.isNaN(year)){
			return null;
		}
		if(this.jieqiYearSeeds[year]){
			return this.jieqiYearSeeds[year];
		}
		if(this.jieqiSeedPromises[year]){
			return this.jieqiSeedPromises[year];
		}
		const params = this.genJieqiParams(fields, year);
		if(!params){
			return null;
		}
		this.jieqiSeedPromises[year] = Promise.resolve().then(async()=>{
			const seed = await fetchPreciseJieqiSeed(params);
			if(seed){
				this.jieqiYearSeeds[year] = seed;
			}
			return seed;
		}).finally(()=>{
			delete this.jieqiSeedPromises[year];
		});
		// 预加载失败静默：旁路 catch 防 unhandledrejection，不改变调用方拿到的 promise 语义
		this.jieqiSeedPromises[year].catch(()=>{});
		return this.jieqiSeedPromises[year];
	},

	prefetchJieqiSeedForFields(fields, overrideOptions){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !flds.date || !flds.date.value){
			return;
		}
		const qimenOptions = this.getQimenOptions(overrideOptions);
		if(!needJieqiYearSeed(qimenOptions)){
			return;
		}
		const year = parseInt(flds.date.value.format('YYYY'), 10);
		if(!year || Number.isNaN(year)){
			return;
		}
		// 种子年份集单源 jieqiSeedYears(日家/金函 y-1,y,y+1;其余 y-1,y)。
		Promise.all(jieqiSeedYears(qimenOptions, year).map((yy)=>this.ensureJieqiSeed(flds, yy))).catch(()=>null);
	},

	prefetchNongliForFields(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		const params = this.genParams(flds);
		if(!params){
			return;
		}
		fetchPreciseNongli(params).then((result)=>{
			if(result){
				setNongliLocalCache(params, result);
			}
		}).catch(()=>null);
	},
};
