// 七政四余页 · 择日取数与选时
// 从 GuoLaoChartMain.js 按职责拆出的 GuoLaoChartMain 方法:this 仍是 GuoLaoChartMain 实例,门面里 mixinMethods(GuoLaoChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as AstroConst from '../../../constants/AstroConst';
import { GUOLAO_CHART_STYLE_MOIRA, GUOLAO_CHART_STYLE_PICK, setStoredGuolaoElection, setStoredGuolaoEleLifeMode } from '../GuoLaoChartStyle';
import { fetchQizhengElection } from '../../../services/qizheng';
import { getMagneticDeclination } from '../electionGeomag';
import { paramsWithMoiraTransit } from './params';
import { toSlashDate, parseDateParts } from '../../../utils/dateStrSafe';
import { guolaoSunriseMode } from './params';

export const electionMethods = {
	// ── 天星择日双轮(pick 盘式)数据链 ──
	// 类A:择时时刻(moiraTransitTime)/立命时刻 → 重取端点;类B:electionOptions → 纯重绘。
	requestElectionData(){
		const fields = this.props.fields;
		// pick=择日双轮全量;MOIRA 圆盘也取(仅用 staticHousesBySystem 画西占不等宫宫位格:
		// 上升=1宫头、逆时针、格宽=真实宫宽,与择日盘同款做法)。
		const styleOk = this.state.chartStyle === GUOLAO_CHART_STYLE_PICK || this.state.chartStyle === GUOLAO_CHART_STYLE_MOIRA;
		if(!fields || !styleOk){
			return;
		}
		const tp = paramsWithMoiraTransit(fields, this.state.moiraTransitTime) || {};
		if(!tp.date || tp.gpsLat === undefined || tp.gpsLon === undefined){
			return;
		}
		const seq = ++this.electionReqSeq;
		this.setState({ electionLoading: true });
		// 紫炁黄经透传自流年 chartObj(与全站四余口径同源,防双引擎漂移)
		const transitChart = this.shownMoiraTransitChartObj() && this.shownMoiraTransitChartObj().chart;
		const extraBodies = [];
		if(transitChart && Array.isArray(transitChart.objects)){
			const ziqi = transitChart.objects.find((o)=>o && o.id === AstroConst.PURPLE_CLOUDS);
			if(ziqi && Number.isFinite(Number(ziqi.lon))){
				extraBodies.push({ id: 'PurpleClouds', label: '炁', lon: Number(ziqi.lon), lat: 0, speed: 0 });
			}
			// 天海冥透传择日动盘外圈(与炁同机制:后端按 lon/lat 算地平方位)。用其真黄纬/日行度以准方位与逆行徽标。
			[[AstroConst.URANUS, '天'], [AstroConst.NEPTUNE, '海'], [AstroConst.PLUTO, '冥']].forEach(([oid, lab])=>{
				const o = transitChart.objects.find((x)=>x && x.id === oid);
				if(o && Number.isFinite(Number(o.lon))){
					extraBodies.push({
						id: oid,
						label: lab,
						lon: Number(o.lon),
						lat: Number.isFinite(Number(o.lat)) ? Number(o.lat) : 0,
						speed: Number.isFinite(Number(o.lonspeed)) ? Number(o.lonspeed) : 0,
					});
				}
			});
		}
		const staticParams = this.genParams() || {};
		const values = {
			date: tp.date,
			time: tp.time || '12:00:00',
			// 静盘时刻(左栏顶部时间):内盘西占宫位/1宫头须与静盘上升同时刻同源
			staticDate: staticParams.date,
			staticTime: staticParams.time,
			zone: tp.zone || '8:00',
			gpsLat: tp.gpsLat,
			gpsLon: tp.gpsLon,
			eleLifeMode: this.state.eleLifeMode,
			// 罗计 / 月孛取法跟盘:与同页主盘、流年盘同一来源(tp = fieldsToParams:盘上的值,盘上缺这一项才回落本机值;
			// 择日里内嵌的盘 = 工作台口径)。此前七政页这里直读本机值,载入「盘上 ≠ 本机」的命盘时择时盘与主盘两套取法
			nodeType: tp.guolaoNodeType === 'true' ? 'true' : 'mean',
			lilithType: tp.guolaoLilithType === 'true' ? 'true' : 'mean',
			ayanamsaDeg: 0,
			extraBodies,
		};
		fetchQizhengElection(values).then((res)=>{
			if(this.unmounted || seq !== this.electionReqSeq){
				return;
			}
			this.setState({ electionData: res, electionLoading: false });
		}).catch(()=>{
			if(this.unmounted || seq !== this.electionReqSeq){
				return;
			}
			// 端点不可达:保留旧数据(有则续显),仅结束 loading;离线兜底由轮盘层的本地方位计算承担
			this.setState({ electionLoading: false });
		});
	},

	// horosa_guolao_render_memo_v1(PERF-R9 Ship 6):render() 内每次都现造的派生值做**按输入记忆化**。
	// 三处调用点(择日表/择日轮/左栏)每渲一帧就跑三遍 paramsWithMoiraTransit + WMM 磁偏模型;
	// 且每次返回新对象 → 下游 memo/浅比较必然失效。键=(fields, moiraTransitTime) 引用,
	// 与既有 componentDidUpdate 的判变口径(prevState.moiraTransitTime !== this.state.moiraTransitTime)
	// 完全一致:任一变化即重算,不存在陈旧。
	memoTransitParams(){
		const fields = this.props.fields;
		const tm = this.state.moiraTransitTime;
		// horosa_slice_prop_cover_v1:上游 v3.13.1 起 paramsWithMoiraTransit 还读「日出口径」—— fields 里没有时回落全局设置,
		// 全局改了而 fields 引用不变(嵌入宿主不回写)时只按 (fields, time) 记会一直给旧口径,故有效口径一并入键
		const sm = guolaoSunriseMode(fields);
		if(this._tpValue && this._tpFields === fields && this._tpTime === tm && this._tpSun === sm){
			return this._tpValue;
		}
		this._tpFields = fields;
		this._tpTime = tm;
		this._tpSun = sm;
		this._tpValue = paramsWithMoiraTransit(fields, tm);
		return this._tpValue;
	},

	// 磁偏解析:自行修正=WMM(按择时年月);手动=输入值恒优先。超模型年限打标供角注警示。
	// horosa_guolao_render_memo_v1:同帧多次调用只算一次(键=electionOptions/fields/moiraTransitTime 引用)。
	resolveElectionDeclination(){
		if(this._declValue !== undefined
			&& this._declEle === this.state.electionOptions
			&& this._declFields === this.props.fields
			&& this._declTime === this.state.moiraTransitTime){
			return this._declValue;
		}
		this._declEle = this.state.electionOptions;
		this._declFields = this.props.fields;
		this._declTime = this.state.moiraTransitTime;
		this._declValue = this.computeElectionDeclination();
		return this._declValue;
	},

	computeElectionDeclination(){
		const ele = this.state.electionOptions || {};
		if(ele.adjNorth === false){
			if(this.state.electionDeclOutOfRange){
				// 手动模式不涉模型,清残留标记(下轮 setState 合并,不在 render 中反复触发)
			}
			return Number(ele.magShiftManual) || 0;
		}
		const tp = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime) || {};
		if(tp.gpsLat === undefined || tp.gpsLon === undefined || !tp.date){
			return 0;
		}
		const dp = parseDateParts(tp.date);   // 民用日期串单源解析(公元前前导负号不丢)
		const year = (dp ? dp.year : NaN) + (Math.max(1, (dp && dp.month) || 1) - 1) / 12;
		const res = getMagneticDeclination(year, Number(tp.gpsLon), Number(tp.gpsLat));
		if(res.outOfRange !== this.state.electionDeclOutOfRange && !this._declFlagScheduled){
			this._declFlagScheduled = true;
			window.setTimeout(()=>{
				this._declFlagScheduled = false;
				if(!this.unmounted){
					this.setState({ electionDeclOutOfRange: res.outOfRange });
				}
			}, 0);
		}
		return res.declination;
	},

	// 分宫制 / 天星择日各项 / 立命时刻与其它显示偏好同律:只有七政主页写记忆,择日内嵌实例只改本页
	onGuolaoElectionChange(patch){
		const safe = setStoredGuolaoElection({ ...(this.state.electionOptions || {}), ...(patch || {}) }, { persist: this.persistsGuolaoPrefs(), base: this.state.electionOptions });
		this.setState({ electionOptions: safe });
	},

	// 搜索结果一键设为择日时刻(驱动双轮与流年盘同步重取)
	onPickElectionMoment(row){
		if(!row || !row.date){
			return;
		}
		const cur = this.state.moiraTransitTime;
		const next = cur && cur.clone ? cur.clone() : null;
		if(!next || !next.parse){
			return;
		}
		next.parse(`${toSlashDate(`${row.date}`)} ${row.time || '12:00:00'}`, 'YYYY-MM-DD HH:mm:ss');
		this.onMoiraTransitTimeChange({ value: next });
	},

	onEleLifeModeChange(val){
		const mode = setStoredGuolaoEleLifeMode(val, { persist: this.persistsGuolaoPrefs() });
		this.setState({ eleLifeMode: mode });
	},
};
