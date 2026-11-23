// 金口诀页 · 取数:神煞 / 运年参数与请求、本命年干支
// 从 JinKouMain.js 按职责拆出的 JinKouMain 方法:this 仍是 JinKouMain 实例,门面里 mixinMethods(JinKouMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Modal } from 'antd';
import * as Constants from '../../../utils/constants';
import request from '../../../utils/request';
import * as LRConst from '../../liureng/LRConst';
import DateTime from '../../comp/DateTime';
import { fetchJinKouPan } from '../JinKouCalc';
import { resolveJinKouDiFen, normalizeZiFromText } from '../JinKouState';
import { clearModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { castSourceKey, castChartFor, castFailureKeeps } from '../../../utils/derivedChartSource';
import { castIsDiurnal } from '../../../utils/castDiurnal';
import { getBirthGanzhiLocalCache, getLiurengRunyearLocalCache, setBirthGanzhiLocalCache, setLiurengRunyearLocalCache } from '../../../utils/localCalcCache';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
import { resolveAfter23NewDay } from '../../../utils/dayBoundaryResolve';
import { buildBirthFields, extractGanZi, resolveGuaYearGanZi, MaleRunYearList, FemaleRunYearList, calcRunYearLocal, getSolarYearFromField, getAppliedBirth } from './runYear';
import { clonePlain, buildCacheKey, pushCache } from './pageState';
import { markPanelReady } from '../../../utils/perfMark';
import { rememberBirthGanZi } from './pageState';

export const requestMethods = {
	genRunYearParams(){
		const flds = getAppliedBirth(this.state);
		const calcFields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const guaDate = calcFields && calcFields.date && calcFields.date.value ? calcFields.date.value.format('YYYY-MM-DD') : '';
		const guaTime = calcFields && calcFields.time && calcFields.time.value ? calcFields.time.value.format('HH:mm:ss') : '';
		const guaAd = calcFields && calcFields.ad && calcFields.ad.value !== undefined
			? calcFields.ad.value
			: (calcFields && calcFields.date && calcFields.date.value ? calcFields.date.value.ad : 1);
		const guaZone = calcFields && calcFields.zone && calcFields.zone.value
			? calcFields.zone.value
			: (calcFields && calcFields.date && calcFields.date.value ? calcFields.date.value.zone : '');
		const guaLon = calcFields && calcFields.lon ? calcFields.lon.value : '';
		const guaLat = calcFields && calcFields.lat ? calcFields.lat.value : '';
		// 缺键取全局现值(此前写死 0 = 24 点换日,与页面初值 / 全局缺省不同)
		const guaAfter23 = resolveAfter23NewDay(calcFields && calcFields.after23NewDay && calcFields.after23NewDay.value);
		const lateZiVal = flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined
			? flds.lateZiHourUseNextDay.value
			: defaultLateZiHourUseNextDay();
		return {
			ad: flds.date.value.ad,
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: flds.date.value.zone,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gender: flds.gender.value,
			after23NewDay: flds.after23NewDay.value,
			lateZiHourUseNextDay: lateZiVal,
			guaYearGanZi: resolveGuaYearGanZi(this.state.liureng),
			guaDate: guaDate,
			guaTime: guaTime,
			guaAd: guaAd,
			guaZone: guaZone,
			guaLon: guaLon,
			guaLat: guaLat,
			guaAfter23NewDay: guaAfter23,
		};
	},

	// 时间基准 = 直接时间(缺省)时,盘的农历(占时 / 日柱)换成随时间算法的那份(/liureng/gods 带 timeAlg),
	// 中栏六壬式盘与四位、右栏解读同一时刻;两份农历不是同一时刻时不合并;按引用记忆化。
	jkChartFor(chart){
		const direct = (this.state.timeBasis || 'direct') !== 'trueSolar';
		const ln = this.state.liureng && this.state.liureng.nongli ? this.state.liureng.nongli : null;
		if(!chart || !direct || !ln || !chart.nongli){ return chart; }
		const a = chart.nongli.clockTime;
		const b = ln.clockTime;
		if(a && b && `${a}`.slice(0, 16) !== `${b}`.slice(0, 16)){ return chart; }
		const m = this._jkChartMemo;
		if(m && m.chart === chart && m.ln === ln){ return m.out; }
		const out = { ...chart, nongli: { ...chart.nongli, ...ln } };
		this._jkChartMemo = { chart, ln, out };
		return out;
	},

	genGodsParams(fields){
		let params = null;
		const flds = fields ? fields : this.props.fields;
		const after23 = flds.after23NewDay && flds.after23NewDay.value !== undefined ? flds.after23NewDay.value : defaultAfter23NewDay();
		const lateZi = flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined ? flds.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay();
		// 取四柱 / 占时的时间算法随页面「时间基准」(缺省直接时间 = 按钟表时;手册同):此前不带 → 后端恒按真太阳时,
		// 后端四位按钟表时、地分 / 旬空 / 神煞 / 应期按真太阳时,一张课两个时辰
		const tAlg = (this.state.timeBasis || 'direct') === 'trueSolar' ? 0 : 1;
		if(flds.params){
			const dtparts = flds.params.birth.split(' ');
			params = {
				...flds.params,
				date: dtparts[0],
				time: dtparts[1],
				after23NewDay: flds.params.after23NewDay !== undefined ? flds.params.after23NewDay : after23,
				lateZiHourUseNextDay: flds.params.lateZiHourUseNextDay !== undefined ? flds.params.lateZiHourUseNextDay : lateZi,
				timeAlg: tAlg,
			};
		}else{
			params = {
				date: flds.date.value.format('YYYY-MM-DD'),
				time: flds.time.value.format('HH:mm:ss'),
				zone: flds.date.value.zone,
				ad: flds.date.value.ad,
				lon: flds.lon.value,
				lat: flds.lat.value,
				after23NewDay: after23,
				lateZiHourUseNextDay: lateZi,
				timeAlg: tAlg,
			};
		}
		return params;
	},

	async requestBirthYearGanZi(){
		const flds = getAppliedBirth(this.state);
		if(!flds || !flds.date || !flds.time){
			return '';
		}
		const key = [
			flds.date.value.format('YYYY-MM-DD'),
			flds.time.value.format('HH:mm:ss'),
			flds.date.value.ad,
			flds.date.value.zone,
			flds.lon.value,
			flds.lat.value,
			flds.after23NewDay.value,
		].join('|');
		if(this.birthYearGanZiCache[key]){
			return this.birthYearGanZiCache[key];
		}
		const localHit = getBirthGanzhiLocalCache(key);
		if(localHit){
			rememberBirthGanZi(this.birthYearGanZiCache, key, localHit);
			return localHit;
		}
		const params = {
			ad: flds.date.value.ad,
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: flds.date.value.zone,
			lon: flds.lon.value,
			lat: flds.lat.value,
			after23NewDay: flds.after23NewDay.value,
			lateZiHourUseNextDay: flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined ? flds.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
		};
		try{
			const data = await request(`${Constants.ServerRoot}/liureng/gods`, {
				body: JSON.stringify(params),
				silent: true,
			});
			const lr = data && data[Constants.ResultKey] ? data[Constants.ResultKey].liureng : null;
			const ganzi = extractGanZi(
				lr && lr.fourColumns && lr.fourColumns.year ? lr.fourColumns.year.ganzi : ''
			) || extractGanZi(lr && lr.nongli ? (lr.nongli.yearGanZi || lr.nongli.yearJieqi || lr.nongli.year) : '');
			if(ganzi){
				rememberBirthGanZi(this.birthYearGanZiCache, key, ganzi);
				setBirthGanzhiLocalCache(key, ganzi);
			}
			return ganzi;
		}catch(e){
			return '';
		}
	},

	async requestGods(fields, chartObj){
		if(fields === undefined || fields === null){
			return;
		}
		// 请求代次:只认最后一次起课 —— 在途的起课晚回不得盖掉之后再起的课 / 之后载入的存档课;
		// 两个 await(起课神煞、金口诀排盘)之后都判;载入存案复原课时同样推进代次
		const seq = (this._godsReqSeq = (this._godsReqSeq || 0) + 1);
		const stale = ()=>seq !== this._godsReqSeq || this.unmounted;
		const params = this.genGodsParams(fields);
		const godsKey = buildCacheKey(params);
		let result = null;
		if(godsKey && this.godsCache.has(godsKey)){
			result = clonePlain(this.godsCache.get(godsKey));
		}else if(godsKey && this.godsInflight.has(godsKey)){
			result = clonePlain(await this.godsInflight.get(godsKey));
		}else{
			const req = request(`${Constants.ServerRoot}/liureng/gods`, {
				body: JSON.stringify(params),
				silent: true,
			}).then((data)=>{
				return data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
			}).finally(()=>{
				if(godsKey){
					this.godsInflight.delete(godsKey);
				}
			});
			if(godsKey){
				this.godsInflight.set(godsKey, req);
			}
			result = await req;
			if(godsKey && result){
				pushCache(this.godsCache, godsKey, clonePlain(result), 72);
			}
		}
		if(stale()){
			return;
		}
		// 这一课的底盘只认与起课同一时刻地点的那张(主盘在途 / 取失败时它是上一刻的)
		const calcChart = castChartFor(chartObj === undefined || chartObj === null ? this.props.value : chartObj, fields);
		if(!result || !result.liureng){
			// 取失败:与屏上那一课同一起课时刻地点(只改了设置)→ 留存;换了时刻 / 地点 → 屏上那一课是上一课,
			// 清掉(连同本页 AI 快照槽),之后同一组参数照常重取
			if(!castFailureKeeps(castSourceKey(this.state.calcFields), castSourceKey(fields))){
				this.setState({ liureng: null, jinkouPan: null, jinkouError: '', runyear: null, calcFields: fields, calcChart, calcIsDiurnal: castIsDiurnal(calcChart, fields) });
				clearModuleAISnapshot('jinkou');
			}
			return;
		}

		const dayGanZi = result.liureng.nongli.dayGanZi;
		const dayGan = dayGanZi.substr(0, 1);
		const wx = LRConst.GanZiWuXing[dayGan];
		const timeZi = normalizeZiFromText(result.liureng.nongli.time);
		const diFen = resolveJinKouDiFen(
			this.state.diFen,
			this.state.diFenAuto === true,
			timeZi,
			!!this.state.liureng
		);
		const calcIsDiurnal = castIsDiurnal(calcChart, fields);   // 昼夜单源:同一时刻的底盘才用它的,否则按起课时刻地点本地算
		const appliedBirth = buildBirthFields(this.state.birth, new DateTime());
		let jinkouPan = null;
		let jinkouError = '';
		try{
			jinkouPan = await fetchJinKouPan(fields, result.liureng.nongli, {
				diFen: diFen,
				yueJiang: this.state.yueJiang,
				zhanShi: this.state.zhanShi,
				timeBasis: this.state.timeBasis,
			});
		}catch(e){
			jinkouError = e && e.message ? e.message : '金口诀本地排盘服务尚未就绪';
			console.warn('kinjinkou backend failed, falling back to local JinKouCalc', e);
		}
		if(stale()){
			return;
		}
		const st = {
			liureng: result.liureng,
			calcBirth: appliedBirth,
			diFen: diFen,
			jinkouPan: jinkouPan,
			jinkouError: jinkouError,
			calcFields: fields,
			calcChart,
			calcIsDiurnal: calcIsDiurnal,
		};
		// 自动档才跟随日干；用户手选过就保留其选择（见 onWuXingChange）。
		if(this.state.wuxingAuto !== false){
			st.wuxing = wx;
		}

		this.setState(st, ()=>{
			// horosa_panel_ready_v1:金口诀「画完」= 中栏四位盘(本次 st)+ 右栏「流年」段(requestRunYear
			// 的二段 setState)都落定。requestRunYear 有多条早退分支(缺出生/年份校验 Modal),挂在它
			// 返回的 promise 上两态都能收口;markPanelReady 自带 generation 去重,重复调用为空操作。
			// tabKey 用顶层页签 key 'cnyibu'(金口诀是「其他」页内的子页面),与 markInteractionStart 同名。
			const markReady = ()=>{ markPanelReady('cnyibu'); };
			Promise.resolve(this.requestRunYear()).then(markReady, markReady);
			// 快照的五行须与页面实际所用一致（手选档下不能再写日干的 wx，否则快照与右栏两张表）。
			this.saveJinKouSnapshot(params, result.liureng, this.state.runyear, this.state.wuxing, this.state.guireng, diFen, jinkouPan);
		});
	},

	async requestRunYear(){
		if(this.state.liureng === null){
			return;
		}
		// 请求代次(与起课同法):只认最后一次取行年;每个 await 之后都判,载入存案复原行年时同样推进代次
		const seq = (this._runYearReqSeq = (this._runYearReqSeq || 0) + 1);
		const stale = ()=>seq !== this._runYearReqSeq || this.unmounted;
		const fields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		if(!fields || !fields.date || !fields.date.value){
			return;
		}
		const birthFields = getAppliedBirth(this.state);
		if(!birthFields || !birthFields.date || !birthFields.date.value){
			return;
		}
		const params = this.genRunYearParams();
		const birthSolarYear = getSolarYearFromField(birthFields.date);
		const guaSolarYear = getSolarYearFromField(fields.date);
		// 带符号天文年比较(公元前 3044 早于公元前 3040):绝不能用 abs 年,BC 侧会反向误判
		if(Number.isFinite(birthSolarYear) && Number.isFinite(guaSolarYear) && birthSolarYear > guaSolarYear){
			Modal.error({
				title: '出生年份必须小于卜卦年份',
			});
			return;
		}
		const genderVal = birthFields && birthFields.gender ? birthFields.gender.value : 1;
		let fallbackRunYear = null;
		if(Number.isFinite(birthSolarYear) && Number.isFinite(guaSolarYear) && guaSolarYear >= birthSolarYear){
			const age = guaSolarYear - birthSolarYear;
			const ageCycle = ((age % 60) + 60) % 60;
			const yearList = `${genderVal}` === '0' ? FemaleRunYearList : MaleRunYearList;
			fallbackRunYear = {
				age: age,
				ageCycle: ageCycle,
				year: yearList[ageCycle] || '',
			};
		}
		if(!params.guaYearGanZi && !fallbackRunYear){
			Modal.error({
				title: '无法识别卜卦年份干支，请先排盘后再试',
			});
			return;
		}

		let result = fallbackRunYear ? { ...fallbackRunYear } : {};
		const runyearKey = buildCacheKey(params);
		try{
			let serverRes = {};
			const localRunyearHit = runyearKey ? getLiurengRunyearLocalCache(runyearKey) : null;
			if(runyearKey && this.runYearServerCache.has(runyearKey)){
				serverRes = clonePlain(this.runYearServerCache.get(runyearKey)) || {};
			}else if(runyearKey && this.runYearServerInflight.has(runyearKey)){
				serverRes = clonePlain(await this.runYearServerInflight.get(runyearKey)) || {};
				if(stale()){ return; }
			}else if(localRunyearHit){
				serverRes = clonePlain(localRunyearHit) || {};
				pushCache(this.runYearServerCache, runyearKey, clonePlain(serverRes), 96);
			}else{
				const req = request(`${Constants.ServerRoot}/liureng/runyear`, {
					body: JSON.stringify(params),
					silent: true,
				}).then((data)=>{
					return data && data[Constants.ResultKey] ? { ...data[Constants.ResultKey] } : {};
				}).finally(()=>{
					if(runyearKey){
						this.runYearServerInflight.delete(runyearKey);
					}
				});
				if(runyearKey){
					this.runYearServerInflight.set(runyearKey, req);
				}
				serverRes = await req;
				if(runyearKey){
					pushCache(this.runYearServerCache, runyearKey, clonePlain(serverRes), 96);
					setLiurengRunyearLocalCache(runyearKey, clonePlain(serverRes));
				}
				if(stale()){ return; }
			}
			result = {
				...serverRes,
				...result,
			};
			const guaGanZi = extractGanZi(params.guaYearGanZi) || resolveGuaYearGanZi(this.state.liureng);
			const birthGanZi = await this.requestBirthYearGanZi();
			if(stale()){ return; }
			// 生年干支留档：金口诀行年（旬法）要以生年所在旬起一岁，与干支流年并存两法。
			result.birthGanZi = extractGanZi(birthGanZi) || '';
			let localRunYear = calcRunYearLocal(
				birthGanZi,
				guaGanZi,
				genderVal,
				birthSolarYear,
				guaSolarYear
			);
			if(!localRunYear && fallbackRunYear){
				localRunYear = fallbackRunYear;
			}
			if(!localRunYear && serverRes.age !== undefined && serverRes.age !== null){
				const age = Number(serverRes.age);
				if(Number.isFinite(age)){
					const ageCycle = ((age % 60) + 60) % 60;
					const yearList = `${genderVal}` === '0' ? FemaleRunYearList : MaleRunYearList;
					localRunYear = {
						age: age,
						ageCycle: ageCycle,
						year: yearList[ageCycle] || serverRes.year || '',
					};
				}
			}
			if(localRunYear){
				result.year = localRunYear.year;
				result.age = localRunYear.age;
				result.ageCycle = localRunYear.ageCycle;
			}
		}catch(e){
			if(fallbackRunYear){
				result = {
					...result,
					...fallbackRunYear,
				};
			}
		}
		if(fallbackRunYear){
			if(result.year === undefined || result.year === null || result.year === ''){
				result.year = fallbackRunYear.year;
			}
			if(result.age === undefined || result.age === null || Number.isNaN(Number(result.age))){
				result.age = fallbackRunYear.age;
			}
			if(result.ageCycle === undefined || result.ageCycle === null || Number.isNaN(Number(result.ageCycle))){
				result.ageCycle = fallbackRunYear.ageCycle;
			}
		}
		if(stale()){ return; }
		this.setState({
			runyear: result,
		}, ()=>{
			this.saveJinKouSnapshot(null, this.state.liureng, result, this.state.wuxing, this.state.guireng, this.state.diFen, this.state.jinkouPan);
		});
	},
};
