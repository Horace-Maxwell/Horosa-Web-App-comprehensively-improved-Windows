// 六爻页 · 起卦各法(时间 / 数字 / 揲蓍 / 手录 / 随机)、取农历与卦辞、逐爻翻动与成卦
// 从 GuaZhanMain.js 按职责拆出的 GuaZhanMain 方法:this 仍是 GuaZhanMain 实例,门面里 mixinMethods(GuaZhanMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { lockDayBoundary } from '../../../utils/dayBoundaryLock';
import { message, Modal } from 'antd';
import * as AstroConst from '../../../constants/AstroConst';
import { randomNum, littleEndian } from '../../../utils/helper';
import { randomInt } from '../../../utils/trueRandom';
import { getGua64, Gua64, Gua8, randYao, ZiList, HourZi, SixGods } from '../../gua/GuaConst';
import { yarrowYao } from '../../gua/LiuYaoConst';
import { normalizeLiuyaoSettings } from '../../gua/liuyaoSchools';
import { singleNumberGua } from '../LiuYaoCastPad';
import DateTime from '../../comp/DateTime';
import { fetchPreciseNongli } from '../../../utils/preciseCalcBridge';
import { setNongliLocalCache } from '../../../utils/localCalcCache';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
import { matchesUserQuery } from '../../../utils/scriptMode';
import { guaDescIdsOf, fetchGuaDescByIds, GUAZHAN_PAGE_SETTINGS } from './snapshot';
import { markPanelReady } from '../../../utils/perfMark';

export const castMethods = {
	clickTimeGua(fields){
		const flds = this.genFields(fields);
		if(!flds){
			return;
		}
		this.stopFlipping();
		if(!fields){
			const patch = this.getTimeFieldsFromSelector();
			if(patch){
				this.onFieldsChange(patch);
			}
		}
		this.requestNongli(flds);
	},

	genParams(fields){
		let flds = fields ? fields : this.props.fields;
		const params = {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			gender: flds.gender.value,
			after23NewDay: defaultAfter23NewDay(),
			lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
			// 占时时间算法:左栏(页面 fields)> 全局 > 缺省真太阳时(0)。
			// 此前不带 timeAlg → 桥归一为 0 恒真太阳时,全局改「直接时间」后与小六壬 / 飞宫同刻占时不同支。
			timeAlg: (flds.timeAlg && flds.timeAlg.value !== undefined && flds.timeAlg.value !== null) ? flds.timeAlg.value : 0,
		}
		return params;
	},

	getTimeFieldsFromSelector(){
		if(!this.timeHook || !this.timeHook.getValue){
			return null;
		}
		const raw = this.timeHook.getValue();
		const dt = raw && raw.value && raw.value instanceof DateTime
			? raw.value
			: (raw && raw.time && raw.time instanceof DateTime ? raw.time : null);
		if(!dt){
			return null;
		}
		return {
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
	},

	genFields(baseFields){
		const flds = {
			...(baseFields || this.props.fields || {}),
		};
		// 调用方给了明确时间(左栏刚改的时刻经 onTimeGeoChanged 传进来)→ 以它为准,不被时间控件里的旧值覆盖
		// (此前一律用控件值盖:改了时间,时间卦却按旧时刻起)。没给才读控件(连点步进时父级还没追上)。
		const patch = baseFields ? null : this.getTimeFieldsFromSelector();
		if(patch){
			return {
				...flds,
				...patch,
			};
		}
		return flds;
	},

	getGuasId(){
		return guaDescIdsOf(this.state);
	},

	async requestGuaDescReturn(){
		return fetchGuaDescByIds(this.getGuasId());
	},

	async requestGuaDesc(){
		// 卦辞只落到请求时的那一卦:回来时卦已换(翻动 / 改起卦)就丢弃,不出现「卦辞是上一卦的」
		const ids = this.getGuasId();
		const key = ids ? `${ids.guaOrg}|${ids.guaRes}|${ids.guaMiddle}` : '';
		let desc = await this.requestGuaDescReturn();
		if(this.unmounted){ return; }
		const now = this.getGuasId();
		const nowKey = now ? `${now.guaOrg}|${now.guaRes}|${now.guaMiddle}` : '';
		if(nowKey !== key){ return; }
		this.setState({
			guaDesc: desc,
		}, ()=>{
			// horosa_panel_ready_v1:六爻的落定点。任何一次交互(改时间→requestNongli→genTimeGua、
			// 点爻、起卦)最终都收束到「取卦辞回来」这一次 setState —— 中栏卦象(yao/currentGua)
			// 在更早一次 setState 已落,右栏断卦(getLiuyaoAnalysis 由 yao+nongli 同步派生)与卦辞
			// 面板在本次落完。故这里是本族最后一次绘制提交。
			markPanelReady('guazhan');
		});
	},

	// 🔴 时间/地点/日界变动的唯一入口(左栏改字段 + 两个全局设置事件都走这里)。
	// 时间卦本就随时间派生 → 重起;而手摇/蓍草/报数/自定义/直选/随机/载回的卦是一次性成卦,
	// 只能刷新干支(日辰月建随之变,旺衰·旬空·神煞由渲染层按新 nongli 现算),卦象与动爻原样保留。
	// 从前这里无条件 clickTimeGua,用户摇完卦一改时间就被时间卦静默顶掉 —— 与「起出即冻结」直接冲突。
	onTimeGeoChanged(fields){
		if((this.state.guaOrigin || 'time') === 'time' && !this.castInFlight()){
			this.clickTimeGua(fields);
		}else{
			this.requestNongli(fields, ()=>{ this.requestGuaDesc(); }, { refreshOnly: true });
		}
	},

	// 是否正在随机翻动(整卦或单爻)
	isFlipping(){
		return this.guaPeriodTask !== null || this.periodTask !== null;
	},

	// 直选 / 载入事盘等不经农历请求就换上新卦:在途的起卦收尾一律作废(晚到也不能把新卦盖回去)。
	// dropNongli:连在途的干支也不落(载入事盘:存档自带那一刻的干支,晚到的旧时刻干支不能盖掉它)
	supersedePendingCast(opts){
		this._nongliCastSeq = (this._nongliCastSeq || 0) + 1;
		this._timeGuaOwed = undefined;
		this._castInFlight = undefined;
		if(opts && opts.dropNongli){
			this._nongliSeq = (this._nongliSeq || 0) + 1;
			this._nongliLandedSeq = this._nongliSeq;
			this._nongliLatestFailed = false;
		}
	},

	// 有起卦收尾在途(卦象等农历落定才上盘):这时改时间只刷新干支,不按时间卦重起(否则用户刚起的卦被时间卦顶掉)
	castInFlight(){
		return this._castInFlight !== undefined && this._castInFlight === this._nongliCastSeq;
	},

	// opts.refreshOnly:只刷新干支、不落卦(改时间 / 日界变动时的一次性成卦、直选卦补取干支、已当场落定的停止翻动)
	async requestNongli(fields, completeHandle, opts){
		if(fields === undefined || fields === null){
			return;
		}
		// 农历只认最新一次请求:农历要走网络时先发的慢回调会晚到,不能把后起时刻的干支盖回去。
		// 起卦类请求(落卦象 / 时间卦)另记一个序号,只被更晚的起卦作废;只刷新干支的请求不作废它 ——
		// 否则起卦收尾在农历在途时被改时间 / 日界变动顶掉
		const refreshOnly = !!(opts && opts.refreshOnly);
		const seq = (this._nongliSeq = (this._nongliSeq || 0) + 1);
		const castSeq = refreshOnly ? (this._nongliCastSeq || 0) : (this._nongliCastSeq = (this._nongliCastSeq || 0) + 1);
		if(!refreshOnly && completeHandle){ this._castInFlight = castSeq; }
		const params = this.genParams(fields);
		const result = await fetchPreciseNongli(params);
		if(this.unmounted){
			return;
		}
		if(this._castInFlight === castSeq && !refreshOnly){ this._castInFlight = undefined; }
		if(seq !== this._nongliSeq){
			// 已有更晚的农历请求:这次的干支不落;起卦收尾没被更晚的起卦作废就照样落卦
			if(refreshOnly || castSeq !== this._nongliCastSeq){
				return;
			}
			if(completeHandle){
				completeHandle();
			}else if(this._nongliLandedSeq === this._nongliSeq){
				// 时间卦:最新那次干支已落定,按它起;最新那次没算出来 → 与另一次序同样如实说、不拿旧干支起
				if(this._nongliLatestFailed){
					message.warning('这一时刻的农历没能算出来,时间卦没有更新');
					this.requestGuaDesc();
				}else{
					this.genTimeGua();
				}
			}else{
				this._timeGuaOwed = castSeq;   // 时间卦:等最新那次干支落定再起
			}
			return;
		}
		// 这次是最新的:若有欠着的时间卦(更早的时间卦请求被只刷新干支的请求顶掉),落定干支后补起;
		// 起卦收尾在途时已换上别的卦(直选 / 载入事盘 / 开始翻动):干支照落,收尾不落
		const owedTimeGua = refreshOnly && this._timeGuaOwed !== undefined && this._timeGuaOwed === this._nongliCastSeq;
		const castSuperseded = !refreshOnly && castSeq !== this._nongliCastSeq;
		this._timeGuaOwed = undefined;
		if(!result){
			this._nongliLandedSeq = seq;
			this._nongliLatestFailed = true;
			if(castSuperseded){
				return;
			}
			// 这一时刻的农历没算出来(本地与远端都给不出):已经起出的卦照样落定(干支沿用上一次),不停在半途;
			// 时间卦要靠农历起,起不了就如实说,卦辞对齐当前盘面
			if(completeHandle && !owedTimeGua){
				message.warning('这一时刻的农历没能算出来,日辰月建沿用上一次的');
				completeHandle();
			}else{
				message.warning('这一时刻的农历没能算出来,时间卦没有更新');
				this.requestGuaDesc();
			}
			return;
		}
		setNongliLocalCache(params, result);

		const st = {
			nongli: result,
		};

		this.setState(st, ()=>{
			this._nongliLandedSeq = seq;
			this._nongliLatestFailed = false;
			if(castSuperseded){
				return;
			}
			if(owedTimeGua){
				this.genTimeGua();
			}else if(completeHandle){
				completeHandle()
			}else{
				this.genTimeGua();
			}
		});
	},

	genTimeGua(){
		let nl = this.state.nongli;
		if(nl === undefined || nl === null){
			return;
		}

		let y = ZiList.indexOf(nl.year.substr(1)) + 1;
		let m = nl.monthInt;
		let d = nl.dayInt;
		let t = ZiList.indexOf(nl.time.substr(1)) + 1;
		let up = (y+m+d) % 8 - 1;
		let down = (y+m+d+t) % 8 - 1;
		up = up < 0 ? 7 : up;
		down = down < 0 ? 7 : down;
		let cyao = (y+m+d+t) % 6 - 1;
		cyao = cyao < 0 ? 5 : cyao;

		let upGua = Gua8[up];
		let downGua = Gua8[down];
		let yao = this.emptyYao();

		for(let i=0; i<downGua.value.length; i++){
			yao[i].value = downGua.value[i];
		}
		for(let i=0; i<upGua.value.length; i++){
			yao[i+3].value = upGua.value[i];
		}
		yao[cyao].change = true;
		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);

		this.setState({
			yao: yao,
			currentGua: guaidx,
			guaOrigin: 'time',
		}, ()=>{
			this.requestGuaDesc();
		});

	},

	clickNumGua(){
		if(this.state.number === undefined || this.state.number === null
			|| this.state.number === '' || this.state.number < 0){
			return;
		}
		this.stopFlipping();

		// 成卦与动爻算法单源 LiuYaoCastPad.singleNumberGua(AI 起卦同一份):addend = 时辰序数(-1)/ 随机数(-2)/ 0(-3 只取总和)
		let dyOpt = this.state.numGuaDongYao;
		let addend = 0;
		if(dyOpt === -1){
			// 附加时辰动爻按【左栏所选起卦时间】之时辰,非系统此刻——
			// 复现历史卦(改过左栏时间)时,盘面干支随所选时间而动爻曾随此刻漂移,同卦不同断。
			const tv = this.props.fields && this.props.fields.time && this.props.fields.time.value;
			let h = tv && tv.format ? parseInt(tv.format('HH'), 10) : new Date().getHours();
			let zi = HourZi[h];
			addend = ZiList.indexOf(zi) + 1;
		}else if(dyOpt === -2){
			// 附加随机数只经「对六取余」定动爻:直接在 0–5 上等概率取(真随机),六爻机会严格均等
			addend = randomInt(6);
		}
		const ng = singleNumberGua(this.state.number, addend);
		if(!ng){ return; }
		let upGua = Gua8[ng.up];
		let downGua = Gua8[ng.down];
		let yao = this.emptyYao();
		for(let i=0; i<3; i++){
			yao[i].value = downGua.value[i];
		}
		for(let i=0; i<3; i++){
			yao[i+3].value = upGua.value[i];
		}
		let idx = (dyOpt === -1 || dyOpt === -2 || dyOpt === -3) ? ng.dongIdx : dyOpt;
		yao[idx].change = true;

		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);

		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({
				yao: yao,
				currentGua: guaidx,
				guaOrigin: 'cast',
			}, ()=>{
				this.requestGuaDesc();
			});
		});
	},

	// 大衍蓍草起卦(WP-I):每爻按蓍草概率(老阳3/少阳5/少阴7/老阴1)生成,老阳老阴为动爻;余流程同自定义起卦。
	clickYarrowGua(){
		this.stopFlipping();
		let yao = this.emptyYao();
		for(let i = 0; i < 6; i++){
			const yy = yarrowYao();
			yao[i].value = yy.value;
			yao[i].change = yy.change;
		}
		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);
		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({ yao: yao, currentGua: guaidx, guaOrigin: 'cast' }, ()=>{ this.requestGuaDesc(); });
		});
	},

	clickCustGua(){
		if(this.state.upGuaIdx === undefined || this.state.upGuaIdx === null || this.state.upGuaIdx === '' ||
			this.state.downGuaIdx === undefined || this.state.downGuaIdx === null || this.state.downGuaIdx === ''){
			return;
		}
		this.stopFlipping();

		let up = Gua8[this.state.upGuaIdx];
		let down = Gua8[this.state.downGuaIdx];
		let yao = this.emptyYao();
		for(let i=0; i<3; i++){
			yao[i].value = down.value[i];
		}
		for(let i=0; i<3; i++){
			yao[i+3].value = up.value[i];
		}

		let idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1) % 6 - 1;
		idx = idx < 0 ? 5 : idx;
		let dyOpt = this.state.custGuaDongYao;
		if(dyOpt === -1){
			// 附加时辰动爻按【左栏所选起卦时间】之时辰,非系统此刻——
			// 复现历史卦(改过左栏时间)时,盘面干支随所选时间而动爻曾随此刻漂移,同卦不同断。
			const tv = this.props.fields && this.props.fields.time && this.props.fields.time.value;
			let h = tv && tv.format ? parseInt(tv.format('HH'), 10) : new Date().getHours();
			let zi = HourZi[h];
			let ziidx = ZiList.indexOf(zi) + 1;
			idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1 + ziidx) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -2){
			idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1 + randomInt(6)) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -3){
			idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else{
			idx = dyOpt;
		}
		yao[idx].change = true;

		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);

		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({
				yao: yao,
				currentGua: guaidx,
				guaOrigin: 'cast',
			}, ()=>{
				this.requestGuaDesc();
			});
		});
	},

	// 六爻是否都已成形(emptyYao 出来的是六个 value=-1 的占位,长度同样是 6 —— 不能用长度判)。
	isGuaComplete(){
		const yao = this.state.yao;
		return !!(yao && yao.length === 6 && yao.every((y)=>y && y.value >= 0));
	},

	emptyYao(){
		let yao = [{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		}];
		return yao;
	},

	getYaoColor(){
		return AstroConst.AstroColor.Stroke;
	},

	filterGua(value, option){
		const item = option.props.rec;
		let txt = item.name+'-'+item.house.name+'宫'+item.house.elem;
		if(matchesUserQuery(txt, value, { ci: false })){
			return true;
		}
		return false;
	},

	changeGua(value, option){
		this.stopFlipping();   // 直选 / 清空都是「换上新卦」(清空 = 空卦),翻动不停则下一帧被冲掉
		this.supersedePendingCast();
		let gua = Gua64[value];
		if(gua === undefined || gua === null){
			this.setState({
				yao: this.emptyYao(),
				currentGua: null,
				guaOrigin: 'time',
				upGuaIdx: null,
				downGuaIdx: null,
				number: null,
				nongli: null,
				guaDesc: null,
			});
			return;
		}
		let yao = [];
		for(let i=0; i<gua.value.length; i++){
			yao[i] = {
				value: gua.value[i],
				name: gua.yaoname[i],
				color: this.getYaoColor()
			};
		}
		this.setState({
			yao: yao,
			currentGua: value,
			guaOrigin: 'cast',
		}, ()=>{
			this.requestGuaDesc();
			// 直选卦时若本次还没取过干支,补取一次 —— 否则日辰月建全空,
			// 旺衰/六神/旬空/神煞会静默缺失(界面上看不出缺,只是全部算不出)。
			if(!this.state.nongli){
				this.requestNongli(this.genFields(), ()=>{}, { refreshOnly: true });
			}
		});
	},

	getCurrentGua(yaos){
		let bits = [];
		for(let i=0; i<yaos.length; i++){
			let yao = yaos[i];
			bits[i] = yao.value;
		}
		let key = littleEndian(bits);
		let gua = getGua64(key);
		if(gua){
			return gua.index;
		}
		return null;
	},

	// 随机起卦概率源分派:coins=三钱(randYao,老阳老阴各1/8) / yarrow=大衍蓍草(3/16·1/16)。
	// 整卦随机/逐爻随机共用;「蓍草起卦」独立按钮恒蓍草不受此档影响。
	rollYao(){
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		return s.randomAlgo === 'yarrow' ? yarrowYao() : randYao();
	},

	setupYao(yaos, guaidx){
		if(guaidx === undefined || guaidx === null){
			return;
		}
		let gua = Gua64[guaidx];
		if(gua === undefined || gua === null){
			return;
		}
		for(let i=0; i<yaos.length; i++){
			yaos[i].name = gua.yaoname[i];
		}
	},

	randomGua(stopAct){
		if(stopAct){
			if(this.guaPeriodTask !== null){
				clearInterval(this.guaPeriodTask);
				this.guaPeriodTask = null;
			}
			let yao = this.state.yao;
			let cnt = randomNum(2) % 10;
			while(cnt > 0){
				for(let i=0; i<yao.length; i++){
					let ryao = this.rollYao();
					yao[i].value = ryao.value;
					yao[i].change = ryao.change;
					yao[i].color = this.getYaoColor();
				}
				cnt = cnt - 1;
			}
			let guaidx = this.getCurrentGua(yao);
			this.setupYao(yao, guaidx);

			// 停下即当场落卦(爻与卦名同一次更新):此前等农历回来才落 currentGua,其间爻已改写、卦名仍是上一帧,
			// 这时保存 / 取快照会存进对不上的卦。干支随后按当前时间刷新,卦辞随之对齐
			this.supersedePendingCast();
			this.setState({
				yao: yao.slice(),
				currentGua: guaidx,
				guaOrigin: 'cast',
			}, ()=>{
				this.requestGuaDesc();
				this.requestNongli(this.genFields(), ()=>{}, { refreshOnly: true });
			});
		}else{
			if(this.guaPeriodTask === null){
				this.supersedePendingCast();   // 开始翻动:之前在途的起卦收尾晚到也不落
				this.guaPeriodTask = setInterval(()=>{
					let yao = this.state.yao;
					for(let i=0; i<yao.length; i++){
						let ryao = this.rollYao();
						yao[i].value = ryao.value;
						yao[i].change = ryao.change;
						yao[i].color = this.getYaoColor();
					}
					let guaidx = this.getCurrentGua(yao);
					this.setupYao(yao, guaidx);
					this.setState({
						yao: yao,
						currentGua: guaidx,
						guaOrigin: 'cast',
					});
				}, 200);
			}
		}
	},

	randomYao(idx, stopAct){
		if(stopAct){
			if(this.periodTask !== null){
				clearInterval(this.periodTask);
				this.periodTask = null;
			}
			let yao = this.state.yao;
			let cnt = randomNum(2) % 50;
			let ryao = this.rollYao();
			while(cnt > 0){
				ryao = this.rollYao();
				cnt = cnt - 1;
			}
			yao[idx].value = ryao.value;
			yao[idx].change = ryao.change;
			yao[idx].color = this.getYaoColor();
			let guaidx = this.getCurrentGua(yao);
			this.setupYao(yao, guaidx);
			this.supersedePendingCast();   // 这一爻直接落定:之前在途的起卦收尾晚到也不盖回去
			this.setState({
				yao: yao,
				currentGua: guaidx,
				guaOrigin: 'cast',
			});

			let completGua = true;
			for(let i=0; i<yao.length; i++){
				if(yao[i].value < 0){
					completGua = false;
					break;
				}
			}
			if(completGua){
				// 六爻齐了:卦已在上面当场落定,这里只刷新干支、对齐卦辞
				this.requestNongli(this.genFields(), ()=>{ this.requestGuaDesc(); }, { refreshOnly: true });
			}
		}else{
			if(this.periodTask === null){
				this.supersedePendingCast();
				this.periodTask = setInterval(() => {
					let yao = this.state.yao;
					let ryao = this.rollYao();
					yao[idx].value = ryao.value;
					yao[idx].change = ryao.change;
					this.colorIndex = this.colorIndex + 1;
					let coloridx = this.colorIndex % this.genColor.length;
					yao[idx].color = this.genColor[coloridx];
					let guaidx = this.getCurrentGua(yao);
					this.setupYao(yao, guaidx);
					this.setState({
						yao: yao,
						currentGua: guaidx,
						guaOrigin: 'cast',
					});
				}, 100);
			}
		}
	},

	// 翻动中(整卦 / 单爻随机)改用别的方式定卦:先停掉翻动并把按钮复位,否则定时器接着改爻,把刚定好的卦冲掉。
	// 只在「确实要换上新卦」那一步调(参数不全早退的不调 —— 否则翻动停了、卦却不收尾,停在半途且卦辞仍是上一卦)。
	// which:'all'(缺省)/ 'gua' 只停整卦 / 'yao' 只停单爻(开始整卦翻动时停单爻,反之亦然,两个定时器不并跑)。
	stopFlipping(which){
		const w = which || 'all';
		const st = {};
		if(w !== 'yao'){
			if(this.guaPeriodTask !== null){ clearInterval(this.guaPeriodTask); this.guaPeriodTask = null; }
			if(`${this.state.btnGenGua || ''}`.indexOf('停止') === 0){ st.btnGenGua = '整卦随机'; }
		}
		if(w !== 'gua'){
			if(this.periodTask !== null){ clearInterval(this.periodTask); this.periodTask = null; }
			const names = this.state.btnName || [];
			if(names.some((n)=>`${n}`.indexOf('停止') === 0)){
				st.btnName = names.map((n)=>(`${n}`.indexOf('停止') === 0 ? `随机${`${n}`.substr(2)}` : n));
				st.btnDisabled = (this.state.btnDisabled || []).map(()=>false);
			}
		}
		if(Object.keys(st).length && !this.unmounted){ this.setState(st); }
	},

	// 随机前确认:开启且当前卦为手动来源(摇卦/自定义/直选)时,启动随机先弹确认防误覆盖;
	// 时间卦/空盘直滚(时间卦本就随时可重起,无「心血覆盖」问题);「停止」动作永不拦。
	confirmRandomThen(run){
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		const origin = this.state.guaOrigin;
		if(!s.randomConfirm || !origin || origin === 'time'){ run(); return; }
		Modal.confirm({
			title: '覆盖当前卦象?',
			content: '当前卦为手动所起,随机起卦将覆盖它。',
			okText: '覆盖并随机', cancelText: '取消',
			onOk: run,
		});
	},

	genGua(){
		let btnName = this.state.btnGenGua;
		let stopAct = false;
		let act = btnName.substr(0, 2);
		if(act === '停止'){
			stopAct = true;
			btnName = '整卦随机';
		}else{
			btnName = '停止随机';
		}
		if(!stopAct){
			this.confirmRandomThen(()=>{
				this.stopFlipping('yao');
				this.setState({ btnGenGua: btnName }, ()=>{ this.randomGua(false); });
			});
			return;
		}

		this.setState({
			btnGenGua: btnName,
		}, ()=>{
			this.randomGua(stopAct);
		});

	},

	genYao(idx){
		let btnDisabled = this.state.btnDisabled;
		let btnName = this.state.btnName;
		let sz = btnDisabled.length;
		let stopAct = false;
		for(let i=0; i<sz; i++){
			let act = btnName[i].substr(0, 2);
			if(act === '停止'){
				stopAct = true;
				break;
			}
		}
		if(!stopAct){
			// 与整卦随机同守卫(启动侧才拦;停止恒放行)
			this.confirmRandomThen(()=>{ this.stopFlipping('gua'); this.genYaoRun(idx); });
			return;
		}
		this.genYaoRun(idx);
	},

	genYaoRun(idx){
		let btnDisabled = this.state.btnDisabled;
		let btnName = this.state.btnName;
		let sz = btnDisabled.length;
		let stopAct = false;
		for(let i=0; i<sz; i++){
			let act = btnName[i].substr(0, 2);
			if(act === '停止'){
				stopAct = true;
				break;
			}
		}

		let str = btnName[idx].substr(2);
		if(stopAct){
			btnName[idx] = '随机' + str;
			for(let i=0; i<sz; i++){
				btnDisabled[i] = false;
			}
		}else{
			btnName[idx] = '停止' + str;
			for(let i=0; i<sz; i++){
				btnDisabled[i] = true;
			}
			btnDisabled[idx] = false;
		}

		this.setState({
			btnDisabled: btnDisabled,
			btnName: btnName,
		}, ()=>{
			this.randomYao(idx, stopAct);
		});
	},

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖。
			if(field && Object.prototype.hasOwnProperty.call(field, 'after23NewDay')){
				lockDayBoundary(this, 'after23');
				this.props.dispatch({ type: 'astro/setAfter23BoundaryUserOverrode', payload: { value: true } });
			}
			// v2.2.1: 时柱开关同款局部覆盖 — 同时设本地 flag 和 dva 中央 flag
			if(field && Object.prototype.hasOwnProperty.call(field, 'lateZiHourUseNextDay')){
				lockDayBoundary(this, 'lateZi');
				this.props.dispatch({ type: 'astro/setLateZiHourUserOverrode', payload: { value: true } });
			}
			let flds = {
				fields: {
					...this.props.fields,
					...field,
				}
			};

			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds.fields
			});

			// __stepHint 只供 fetchByFields 消费;时间卦派生走净化副本(防瞬态键入卦链)
			let nextFields = flds.fields;
			if(Object.prototype.hasOwnProperty.call(nextFields, '__stepHint')){
				const { __stepHint, ...cleanFields } = nextFields;
				nextFields = cleanFields;
			}
			this.onTimeGeoChanged(nextFields);
		}
	},

	getDongYaos(){
		let values = [];
		for(let i=0; i<this.state.yao.length; i++){
			let obj = this.state.yao[i];
			if(obj.change){
				values.push(i);
			}
		}
		return values;
	},

	downGuaIdxChanged(val){
		this.setState({
			downGuaIdx: val,
		}, ()=>{
			this.clickCustGua();
		});
	},

	upGuaIdxChanged(val){
		this.setState({
			upGuaIdx: val,
		}, ()=>{
			this.clickCustGua();
		});
	},

	custGuaDongYaoChanged(val){
		GUAZHAN_PAGE_SETTINGS.save({ custGuaDongYao: val });   // 只收取法(负值);点具体某一爻是输入,被 schema 拒收
		this.setState({
			custGuaDongYao: val,
		}, ()=>{
			this.clickCustGua();
		});
	},

	numGuaDongYaoChanged(val){
		GUAZHAN_PAGE_SETTINGS.save({ numGuaDongYao: val });
		this.setState({
			numGuaDongYao: val,
		}, ()=>{
			this.clickNumGua();
		});
	},

	numberChanged(val){
		this.setState({
			number: val,
		});
	},

	dongyaoChanged(checkedValues){
		if(this.isFlipping()){ return; }   // 翻动中改动爻:下一帧就被冲掉,还会替半途卦请求一次卦辞
		let completGua = true;
		let yao = this.state.yao;
		for(let i=0; i<yao.length; i++){
			let obj = yao[i];
			if(obj.value < 0){
				completGua = false;
				break;
			}
		}
		if(completGua){
			for(let i=0; i<yao.length; i++){
				yao[i].change = false;
			}
			for(let i=0; i<checkedValues.length; i++){
				let val = checkedValues[i];
				yao[val].change = true;
			}
			this.setState({
				yao: yao,
			}, ()=>{
				this.requestGuaDesc();
			});
		}
	},

	fillYaoGods(yao){
		let nongli = this.state.nongli;
		if(nongli === undefined || nongli === null){
			return yao;
		}
		let daygan = nongli.dayGanZi.substr(0, 1);
		let gods = SixGods[daygan];
		let len = gods.length;
		for(let i=0; i<len; i++){
			yao[i].god = gods[i];
		}
		return yao;
	},
};
