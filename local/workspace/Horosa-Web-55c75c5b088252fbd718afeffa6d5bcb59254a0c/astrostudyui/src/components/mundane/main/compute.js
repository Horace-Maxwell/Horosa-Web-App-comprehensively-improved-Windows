// 世运盘 · 起盘与计算:入宫 / 季节盘 / 事件扫描 / 日月食 / 地区、大合与周期、返照与推运、校正、吠陀入宫、AI 快照
// 从 MundaneMain.js 按职责拆出的 MundaneMain 方法:this 仍是 MundaneMain 实例,门面里 mixinMethods(MundaneMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import DateTime from '../../comp/DateTime';
import { fetchPreciseJieqiSeed } from '../../../utils/preciseCalcBridge';
import { SIGNS } from '../../../divination/data/signs';
import { buildFacts } from '../../../divination/engine/chartFacts';
import { buildAstroSnapshotContent } from '../../../utils/astroAiSnapshot';
import { fetchMundaneEvents, momentToDateTime } from '../../../divination/mundane/momentPipeline';
import { describeMundaneChart, describeIngressSkeleton, describeMundaneVictor, describeMundaneSyzygy, PLANET_CN as MUN_PLANET_CN } from '../../../divination/mundane/describe';
import { detectMarsSaturnCancer } from '../../../divination/mundane/conjunctionEras';
import { computeAngularity, rulerDeathSignature, solveSiderealIngress, describeSolunar } from '../../../divination/mundane/solunar';
import { PLANET_CN_V, computeNavanayaka, solveVedicSolarIngress } from '../../../divination/mundane/vedicMundane';
import { MUNDANE_HORARY_KINDS, describeWarQuestion, describeWeatherQuestion, describePriceQuestion } from '../../../divination/mundane/mundaneHorary';
import { rulesetConfig } from '../../../divination/mundane/ruleset';
import { describeChorography } from '../../../divination/mundane/chorography';
import { mundaneProfection, mundaneFirdaria } from '../../../divination/mundane/progressions';
import { allRegions, saveUserRegion, regionCandidates } from '../../../divination/data/regionCharts';
import { chartParams, fmtDegree, chartRequestKey, unwrapResult } from '../../astro/AstroExtraCommon';
import { MUNDANE_CYCLE_SETTINGS, mundaneCycleRequestFields, buildMundaneCycleText } from '../../../utils/mundaneCycles';
import request from '../../../utils/request';
import { formatSignedDate, leadingYearOf } from '../../../utils/dateStrSafe';
import * as Constants from '../../../utils/constants';
import { PLANET_CN, MUNDANE_ORB_SCHEME_CN, MUNDANE_INGRESS_RULE_CN, PLANET_ASTRO_ID, BARBAULT_SETS, currentYear, safeFacts, clampYear, ymd, formatMundaneHouseTable, formatMundaneChorographyTable } from './tables';
import { buildMundaneCardSections } from './cards';

export const computeMethods = {
	geoFromFields(fields){
		return {
			zone: fields.zone ? fields.zone.value : '+08:00',
			lon: fields.lon ? fields.lon.value : '116e23',
			lat: fields.lat ? fields.lat.value : '23n26',
			gpsLat: fields.gpsLat ? fields.gpsLat.value : 23.43,
			gpsLon: fields.gpsLon ? fields.gpsLon.value : 116.38,
		};
	},

	// 恒星入境 / 梅沙入境把壳改成恒星黄道 + 对应宫制;切回回归派类型排入宫盘时自动恢复排前的黄道 / 宫制 / 传统
	// (此前先排恒星盘再切回入宫盘 → 回归节气时刻 + 恒星黄道的杂盘)。备份只在当前为回归黄道时记录一次。
	captureTropicalBackup(fields){
		if(!fields || !fields.zodiacal || Number(fields.zodiacal.value) === 1){ return; }
		const v = (k, d)=>(fields[k] && fields[k].value !== undefined && fields[k].value !== null ? fields[k].value : d);
		this._tropicalBackup = { zodiacal: 0, siderealAyanamsa: v('siderealAyanamsa', ''), hsys: v('hsys', 0), tradition: v('tradition', 0) };
	},

	restoreTropicalIfNeeded(fields, patchFields){
		if(!patchFields || !fields || !fields.zodiacal || Number(fields.zodiacal.value) !== 1 || !this._tropicalBackup){ return false; }
		patchFields({ ...this._tropicalBackup });
		try{ message.info('已恢复排恒星 / 梅沙入境前的回归黄道与宫制，再排入宫盘'); }catch(e){ /* 提示失败不阻断 */ }
		return true;
	},

	async castIngress(extra, setExtra, fields, setTime, patchFields){
		this.restoreTropicalIfNeeded(fields, patchFields);
		const term = extra.ingressTerm || '春分';
		const year = clampYear(extra.ingressYear, currentYear());
		const zone = fields.zone ? fields.zone.value : '+08:00';
		this.setState({ casting: true, err: '' });
		try{
			const params = {
				year: String(year),
				ad: fields.ad ? fields.ad.value : 1,
				zone,
				lon: fields.lon ? fields.lon.value : '116e23',
				lat: '23n26',
				gpsLat: 23.43,
				gpsLon: fields.gpsLon ? fields.gpsLon.value : (fields.lon ? fields.lon.value : 0),
				timeAlg: 0,
				jieqis: [term],
			};
			const seed = await fetchPreciseJieqiSeed(params);
			const hit = seed && seed[term];
			if(!hit || !hit.time){ throw new Error('未取到入宫时刻'); }
			const dt = new DateTime();
			dt.parse(hit.time, 'YYYY-MM-DD HH:mm:ss');
			dt.zone = zone;
			dt.calcJdn();
			setExtra({ mundaneType: 'ingress', ingressTerm: term, ingressYear: year, ingressMoment: hit.time });
			setTime(dt);
			this.setState({ casting: false });
		}catch(e){
			this.setState({ casting: false, err: (e && e.message) || '入宫盘排盘失败' });
		}
	},

	// WP-1 四季入境盘:一次取春分/夏至/秋分/冬至四枢轴精确入境时刻(年盘上升落基本座时主管缩首季,须并参)。
	async scanSeasonalIngresses(extra){
		const fields = this._fields;
		if(!fields){ return; }
		const year = clampYear(extra.ingressYear, currentYear());
		const zone = fields.zone ? fields.zone.value : '+08:00';
		this.setState({ seasonLoading: true, seasonErr: '' });
		try{
			const params = {
				year: String(year), ad: fields.ad ? fields.ad.value : 1, zone,
				lon: fields.lon ? fields.lon.value : '116e23', lat: '23n26', gpsLat: 23.43,
				gpsLon: fields.gpsLon ? fields.gpsLon.value : (fields.lon ? fields.lon.value : 0),
				timeAlg: 0, jieqis: ['春分', '夏至', '秋分', '冬至'],
			};
			const seed = await fetchPreciseJieqiSeed(params);
			if(!seed){ throw new Error('未取到入境时刻'); }
			this.setState({ seasonLoading: false, seasonSeed: seed, seasonSeedYear: year });
		}catch(e){ this.setState({ seasonLoading: false, seasonErr: '四季入境计算失败：请确认本地服务。' }); }
	},

	// 点四季某季 → 按其精确入境时刻起该季入宫盘(复用 ingress 壳)。
	castSeasonalIngress(term, moment, year){
		if(!this._setExtra || !this._setTime || !this._fields){ return; }
		const zone = this._fields.zone ? this._fields.zone.value : '+08:00';
		const dt = new DateTime();
		dt.parse(moment, 'YYYY-MM-DD HH:mm:ss');
		dt.zone = zone;
		if(dt.calcJdn){ dt.calcJdn(); }
		this._setExtra({ mundaneType: 'ingress', ingressTerm: term, ingressYear: year, ingressMoment: moment });
		this._setTime(dt);
	},

	async scanEvents(type, extra, fields){
		const year = clampYear(extra.scanYear, currentYear());
		const geo = this.geoFromFields(fields);
		const kinds = (type === 'solecl' || type === 'lunecl') ? ['eclipses'] : ['lunations'];
		this.setState({ scanLoading: true, scanErr: '', scanType: type, scanRows: null });
		const res = await fetchMundaneEvents({
			startDate: ymd(year, 1, 1), endDate: ymd(year, 12, 31),
			zone: geo.zone, lon: geo.lon, lat: geo.lat, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon,
			kinds,
		});
		if(res.err){ this.setState({ scanLoading: false, scanErr: '事件扫描失败：请确认本地服务运行。' }); return; }
		let rows = [];
		if(type === 'newmoon'){ rows = (res.lunations || []).filter((l) => l.phase === 'New Moon'); }
		else if(type === 'fullmoon'){ rows = (res.lunations || []).filter((l) => l.phase === 'Full Moon'); }
		else if(type === 'solecl'){ rows = (res.eclipses || []).filter((e) => e.kind === 'solar'); }
		else if(type === 'lunecl'){ rows = (res.eclipses || []).filter((e) => e.kind === 'lunar'); }
		this.setState({ scanLoading: false, scanRows: rows });
	},

	useMoment(row, type, setExtra, fields, setTime){
		const geo = this.geoFromFields(fields);
		const dt = momentToDateTime(row.localTime, geo.zone);
		if(!dt){ return; }
		const patch = { mundaneType: type, selectedMoment: row.localTime, selectedSign: row.sign };
		if(type === 'solecl' || type === 'lunecl'){
			patch.eclipseKind = row.kind; patch.eclipseTypeText = row.eclipseType;
			this.setState({ eclipseDetail: null });
			this.fetchEclipseDetail(row.localTime, row.kind, geo);
		}
		setExtra(patch);
		setTime(dt);
	},

	// 食时长定则：日食 N 小时→约 N 年、月食 N 小时→约 N 月（/astroextra/eclipsedetail，swisseph 接触时刻）。
	fetchEclipseDetail(moment, kind, geo){
		const parts = `${moment || ''}`.split(' ');
		// 只认最后点的那条食:连点两条时先点那条的晚回不许显示在后点那条上(超时 60 秒,窗口不小)
		const detailSeq = (this._eclipseDetailSeq || 0) + 1;
		this._eclipseDetailSeq = detailSeq;
		request(`${Constants.ServerRoot}/astroextra/eclipsedetail`, {
			body: JSON.stringify({ date: parts[0], time: parts[1] || '00:00:00', zone: geo.zone, lat: geo.lat, lon: geo.lon, eclipseKind: kind }),
			timeoutMs: 60000,
		}).then((data) => {
			if(detailSeq !== this._eclipseDetailSeq){ return; }
			const r = (data && data.Result) ? data.Result : data;
			this.setState({ eclipseDetail: (r && !r.err) ? r : null });
		}).catch(() => { if(detailSeq === this._eclipseDetailSeq){ this.setState({ eclipseDetail: null }); } });
	},

	applyRegion(key, setExtra, patchFields, candidate){
		const rec = allRegions()[key];
		if(!rec){ return; }
		const cands = regionCandidates(key);
		const cand = candidate || (cands ? cands[0] : null);   // 多候选盘:默认首候选(最通行者)
		const useTime = (cand && cand.time) ? cand.time : (rec.time || '12:00:00');
		const dt = new DateTime();
		if(dt.setZone){ dt.setZone(rec.zone || '+00:00'); }
		dt.parse(`${rec.date} ${useTime}`, 'YYYY-MM-DD HH:mm:ss');
		if(dt.calcJdn){ dt.calcJdn(); }
		setExtra({ mundaneType: 'region', regionKey: key, regionCn: rec.cn + (cand ? ` · ${cand.label}` : ''), regionFoundingYear: leadingYearOf(rec.date) || null });
		// 换地区盘:清掉手填建置/目标年(否则推运卡沿用上一盘的手填年),令新 regionFoundingYear 重新权威。
		this.setState({ regionCandKey: (cand && cand.key) || null, progFoundingYear: null, progTargetYear: null });
		patchFields({
			date: dt, time: dt.clone ? dt.clone() : dt, zone: dt.zone, ad: dt.ad,
			lon: rec.lon, lat: rec.lat, gpsLon: rec.gpsLon, gpsLat: rec.gpsLat, pos: rec.cn,
		});
	},

	// 成熟方案：把「当前盘」（上方「时间」+「地点」设定好的时刻与坐标）命名后存为地区盘。
	addRegion(setExtra, patchFields, fields){
		const f = this.state.regionForm;
		if(!f.name || !f.name.trim()){ this.setState({ scanErr: '请填地区/事件名称' }); return; }
		const dt = fields && fields.date && fields.date.value;
		const dateStr = dt && dt.format ? dt.format('YYYY-MM-DD') : '';
		const timeStr = dt && dt.format ? dt.format('HH:mm:ss') : '12:00:00';
		const zone = (fields && fields.zone && fields.zone.value) || (dt && dt.zone) || '+08:00';
		const lon = (fields && fields.lon && fields.lon.value) || '116e23';
		const lat = (fields && fields.lat && fields.lat.value) || '39n54';
		const gpsLon = (fields && fields.gpsLon && fields.gpsLon.value != null) ? fields.gpsLon.value : 0;
		const gpsLat = (fields && fields.gpsLat && fields.gpsLat.value != null) ? fields.gpsLat.value : 0;
		if(!dateStr){ this.setState({ scanErr: '请先用上方「时间」设定建置时刻' }); return; }
		const key = `user_${f.name.trim()}_${dateStr}`.replace(/\s+/g, '');
		const rec = { cn: f.name.trim(), date: dateStr, time: timeStr, zone, lon, lat, gpsLon: Number(gpsLon) || 0, gpsLat: Number(gpsLat) || 0, note: '用户自定义' };
		saveUserRegion(key, rec);
		this.setState({ regionAddOpen: false, scanErr: '', regionForm: { ...this.state.regionForm, name: '' } });
		this.applyRegion(key, setExtra, patchFields);
	},

	async computeGreatConj(){
		const startYear = clampYear(this.state.gcStart, 1300);
		const endYear = clampYear(this.state.gcEnd, 2200);
		if(endYear < startYear){ this.setState({ gcErr: '结束年须不小于起始年' }); return; }
		const pair = this.state.gcPair || 'jupiter-saturn';
		const aspect = this.state.gcAspect || 0;
		const richJuSa = (pair === 'jupiter-saturn' && aspect === 0);
		this.setState({ gcLoading: true, gcErr: '' });
		try{
			if(richJuSa){
				const data = await request(`${Constants.ServerRoot}/astroextra/greatconj`, {
					body: JSON.stringify({ startYear, endYear }),
					timeoutMs: 90000,
				});
				const r = (data && data.Result) ? data.Result : data;
				const list = (r && r.conjunctions) ? r.conjunctions : (Array.isArray(r) ? r : []);
				this.setState({ gcLoading: false, gcResults: list, gcMode: 'ages' });
			}else{
				const parts = pair.split('-');
				// 地心/日心视角:helio 时带 center(Java 白名单已放行);geo 缺省不带=零回归。
				const data = await request(`${Constants.ServerRoot}/astroextra/planetcycles`, {
					body: JSON.stringify({ startYear, endYear, p1: PLANET_ASTRO_ID[parts[0]], p2: PLANET_ASTRO_ID[parts[1]], aspect, ...(this.state.gcCenter === 'helio' ? { center: 'helio' } : {}) }),
					timeoutMs: 90000,
				});
				const r = (data && data.Result) ? data.Result : data;
				const list = (r && r.events) ? r.events : [];
				this.setState({ gcLoading: false, gcResults: list, gcMode: 'flat' });
			}
		}catch(e){
			this.setState({ gcLoading: false, gcErr: '行星周期计算失败' });
		}
	},

	// Barbault 行星周期指数(§9.3):慢星两两角距和 → 「聚散」曲线,低谷=危机、高峰=扩张。
	async computeBarbault(){
		const startYear = clampYear(this.state.bbStart, 1900);
		const endYear = clampYear(this.state.bbEnd, 2050);
		if(endYear < startYear){ this.setState({ bbErr: '结束年须不小于起始年' }); return; }
		const set = BARBAULT_SETS.find((s) => s.key === this.state.bbSet) || BARBAULT_SETS[0];
		const span = endYear - startYear;
		const stepMonths = span > 160 ? 12 : (span > 80 ? 6 : 3);
		this.setState({ bbLoading: true, bbErr: '' });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/barbault`, {
				body: JSON.stringify({ startYear, endYear, stepMonths, planets: set.planets, ...(this.state.bbHarm > 1 ? { harm: this.state.bbHarm } : {}) }),
				timeoutMs: 90000,
			});
			const r = (data && data.Result) ? data.Result : data;
			// 记下这条曲线是按哪组慢星、哪个谐波、哪段年份算的:快照写算图时的口径,不取此刻下拉里改过、还没重画的值
			const drawn = (r && r.points) ? { ...r, setKey: set.key, harm: r.harm || this.state.bbHarm, startYear, endYear } : null;
			this.setState({ bbLoading: false, bbData: drawn, bbErr: drawn ? '' : 'Barbault 指数计算失败' });
		}catch(e){
			this.setState({ bbLoading: false, bbErr: 'Barbault 指数计算失败' });
		}
	},

	// WP-6 太阳返照(§11.2):复用 /astroextra/returns(getBaseParams 已白名单 startYear/count),以地区盘为命基排目标年年度图。
	async computeMundaneReturn(chart, year){
		if(!chart || !chart.params){ this.setState({ srErr: '需先排地区盘' }); return; }
		this.setState({ srLoading: true, srErr: '' });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/returns`, {
				body: JSON.stringify({ ...chartParams(chart), startYear: year, count: 1 }),
				timeoutMs: 45000,
			});
			const r = (data && data.Result) ? data.Result : data;
			const rows = (r && r.rows) ? r.rows : [];
			this.setState({ srLoading: false, srData: rows[0] || null, srYear: year, srKey: chartRequestKey(chart), srErr: rows.length ? '' : '返照计算失败' });
		}catch(e){
			this.setState({ srLoading: false, srErr: '返照计算失败' });
		}
	},

	// WP-2 相位格局(§17.2):surfacing 后端 /astroextra/analysis 的 detect_patterns(已 Java 代理 /analysis)。
	async computeMundanePatterns(chart){
		if(!chart || !chart.params){ this.setState({ patErr: '需先排盘' }); return; }
		this.setState({ patLoading: true, patErr: '' });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/analysis`, {
				body: JSON.stringify(chartParams(chart)),
				timeoutMs: 45000,
			});
			const r = (data && data.Result) ? data.Result : data;
			const pats = (r && r.patterns) ? r.patterns : [];
			this.setState({ patLoading: false, patData: pats, patKey: chartRequestKey(chart) });
		}catch(e){
			this.setState({ patLoading: false, patErr: '格局计算失败' });
		}
	},

	// WP-6 次限/太阳弧(§11.2):surfacing 后端 /astroextra/progressions(secondary;太阳弧前端从次限进太阳派生)。
	async computeMundaneSecondary(chart, year){
		if(!chart || !chart.params){ this.setState({ secErr: '需先排盘' }); return; }
		this.setState({ secLoading: true, secErr: '' });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/progressions`, {
				body: JSON.stringify({ ...chartParams(chart), targetDate: `${year}-01-01`, aspects: [0, 90, 180], orb: 1.5 }),
				timeoutMs: 45000,
			});
			const r = (data && data.Result) ? data.Result : data;
			const sec = (r && r.methods) ? r.methods.find((m) => m.method === 'secondary') : null;
			this.setState({ secLoading: false, secData: sec || null, secYear: year, secKey: chartRequestKey(chart), secErr: sec ? '' : '次限计算失败' });
		}catch(e){
			this.setState({ secLoading: false, secErr: '次限计算失败' });
		}
	},

	// WP-4 会合起盘(§9.1):点选会合→按其精确时刻(UT)起盘,作事件盘(复用 region 壳)进定局/判读。
	castConjunction(row){
		if(!this._setTime || !this._setExtra || !row || row.year == null){ return; }
		const hh = (row.hour != null) ? row.hour : 12;
		const h = Math.floor(hh); const mi = Math.floor((hh - h) * 60); const s = Math.max(0, Math.min(59, Math.floor((((hh - h) * 60) - mi) * 60)));
		const pad = (n) => String(n).padStart(2, '0');
		// row.year 是天文年(公元前 1 年 = 0,与本页年份输入 / yearLabel 同口径),月日按民用历;
		// 起盘串要历史纪年(没有 0 年)——公元前的会合不转就早一年。
		const displayYear = row.year <= 0 ? row.year - 1 : row.year;
		const str = `${formatSignedDate(displayYear, row.month, row.day)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
		const dt = new DateTime();
		if(dt.setZone){ dt.setZone('+00:00'); }   // 会合精确时刻为 UT
		dt.parse(str, 'YYYY-MM-DD HH:mm:ss');
		if(dt.calcJdn){ dt.calcJdn(); }
		this._setExtra({ mundaneType: 'region', regionKey: null, regionCn: `会合盘 ${row.year}`, regionFoundingYear: row.year });
		this.setState({ mundaneRightTab: 'judge', progFoundingYear: null, progTargetYear: null });
		this._setTime(dt);
	},

	// WP-7 重定位四轴(§12.4):复用后端 /astroextra/relocation(保黄经、换地点重算四轴/宫;已 Java 代理)。
	async computeMundaneRelocation(chart, city){
		if(!chart || !chart.params || !city){ this.setState({ relocErr: '需先排盘' }); return; }
		this.setState({ relocLoading: true, relocErr: '', relocCity: city.cn });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/relocation`, {
				body: JSON.stringify({ ...chartParams(chart), relocLat: city.lat, relocLon: city.lon }),
				timeoutMs: 45000,
			});
			const r = (data && data.Result) ? data.Result : data;
			const rc = (r && r.chart) ? r.chart : null;
			let meta = null;
			if(rc){ try{ meta = buildFacts(rc).meta; }catch(e){ meta = null; } }
			this.setState({ relocLoading: false, relocData: meta, relocErr: meta ? '' : '重定位计算失败' });
		}catch(e){
			this.setState({ relocLoading: false, relocErr: '重定位计算失败' });
		}
	},

	// WP-8 校正:把当前建置时刻平移 deltaMin 分钟并重排盘(看四轴随之移动)。
	nudgeFoundingTime(deltaMin){
		try{
			const fields = this._fields; const setTime = this._setTime;
			if(!fields || !fields.date || !fields.date.value || !setTime){ return; }
			const dtv = fields.date.value;
			if(!dtv || !dtv.clone || !dtv.addMinute){ return; }
			// 用 DateTime 自带 addMinute 进位链(含公元前与 1582 儒略切换):
			// 旧 new Date() 路径对 BC/五位年 Invalid → 步进静默失效
			const dt = dtv.clone();
			dt.zone = (fields.zone && fields.zone.value) || dtv.zone || '+08:00';
			dt.addMinute(deltaMin);
			setTime(dt);
		}catch(e){ /* noop */ }
	},

	// 事件年反推收敛:对每个历史事件年排太阳返照,统计返照上升是否命中本盘四轴(±3°)。
	// 命中率高 → 当前建置时刻较可信;微调时刻后重跑对比收敛度即校正流程(多技法收敛的返照支;
	// 主限支见主限专用页)。复用已接线 /astroextra/returns,逐年一次调用(≤8 年)。
	async computeEventRectification(chart){
		if(!chart || !chart.params){ this.setState({ rectErr: '需先排地区盘' }); return; }
		const raw = String(this.state.rectEvents || '').split(/[,，、\s]+/).map((s) => parseInt(s, 10)).filter((y) => Number.isFinite(y) && y > -3000 && y < 3001);
		const years = [...new Set(raw)].slice(0, 8);
		if(!years.length){ this.setState({ rectErr: '请输入 1–8 个事件年份(逗号分隔)' }); return; }
		this.setState({ rectLoading: true, rectErr: '', rectRows: null });
		try{
			const facts = safeFacts(chart);
			const ascLon = facts && facts.meta ? facts.meta.ascLon : null;
			const mcLon = facts && facts.meta ? facts.meta.mcLon : null;
			if(ascLon == null || mcLon == null){ this.setState({ rectLoading: false, rectErr: '本盘四轴数据不全' }); return; }
			const axes = [
				{ cn: '上升', lon: ascLon }, { cn: '天顶', lon: mcLon },
				{ cn: '下降', lon: (ascLon + 180) % 360 }, { cn: '天底', lon: (mcLon + 180) % 360 },
			];
			const ORB = 3;
			const dist = (a, b) => { const d = Math.abs((((a - b) % 360) + 360) % 360); return Math.min(d, 360 - d); };
			const rows = [];
			for(const y of years){
				const data = await request(`${Constants.ServerRoot}/astroextra/returns`, {
					body: JSON.stringify({ ...chartParams(chart), startYear: y, count: 1 }),
					timeoutMs: 45000, silent: true,
				});
				const r = (data && data.Result) ? data.Result : data;
				const row = (r && r.rows && r.rows[0]) || null;
				const srAsc = row && row.solarAsc && typeof row.solarAsc.lon === 'number' ? row.solarAsc.lon : null;
				const hits = srAsc != null ? axes.filter((ax) => dist(srAsc, ax.lon) <= ORB).map((ax) => ax.cn) : [];
				rows.push({ year: y, srAsc, hits });
			}
			this.setState({ rectLoading: false, rectRows: rows });
		}catch(e){
			this.setState({ rectLoading: false, rectErr: '事件反推计算失败' });
		}
	},

	// 恒星派入境左栏:盘种(8)+年份+权重口径+角化容许档+排盘。
	// 起盘=牛顿迭代求根(恒星黄道 Fagan/Bradley + Campanus 宫制,盘参随起盘写入 fields)。
	async castSolunar(extra, setExtra, fields, setTime, patchFields){
		const typeKey = extra.solunarType || 'capsolar';
		const year = extra.solunarYear != null ? extra.solunarYear : currentYear();
		this.setState({ solunarCasting: true, solunarErr: '' });
		try{
			const f = {
				zone: fields.zone && fields.zone.value, lat: fields.lat && fields.lat.value, lon: fields.lon && fields.lon.value,
				gpsLat: fields.gpsLat && fields.gpsLat.value, gpsLon: fields.gpsLon && fields.gpsLon.value,
			};
			const r = await solveSiderealIngress(typeKey, year, f);
			if(!r || !r.moment){ this.setState({ solunarCasting: false, solunarErr: '恒星入境求根失败' }); return; }
			// 盘参写入主 fields → 壳按恒星黄道+Campanus 重排主盘(与迭代用盘同口径)。
			this.captureTropicalBackup(fields);
			patchFields({ zodiacal: 1, siderealAyanamsa: 'fagan_bradley', hsys: 10, tradition: 0 });
			const dt = new DateTime();
			if(f.zone){ dt.setZone(f.zone); }
			const parsed = dt.parse ? dt.parse(r.moment, 'YYYY-MM-DD HH:mm:ss') : null;
			if(parsed){ setTime(parsed); }
			this.setState({ solunarCasting: false, solunarMoment: r.moment });
		}catch(e){
			this.setState({ solunarCasting: false, solunarErr: '恒星入境求根失败' });
		}
	},

	// 吠陀世运左栏:年份+排梅沙入境(年度主盘)+九主计算。
	async castVedicIngress(eventKey, extra, fields, setTime, patchFields){
		const year = extra.vedicYear != null ? extra.vedicYear : currentYear();
		this.setState({ vedicCasting: true, vedicErr: '' });
		try{
			const f = { zone: fields.zone && fields.zone.value, lat: fields.lat && fields.lat.value, lon: fields.lon && fields.lon.value, gpsLat: fields.gpsLat && fields.gpsLat.value, gpsLon: fields.gpsLon && fields.gpsLon.value };
			const r = await solveVedicSolarIngress(eventKey, year, f);
			if(!r || !r.moment){ this.setState({ vedicCasting: false, vedicErr: '入境求根失败' }); return; }
			this.captureTropicalBackup(fields);
			patchFields({ zodiacal: 1, siderealAyanamsa: 'lahiri', hsys: 0, tradition: 0 });
			const dt = new DateTime();
			if(f.zone){ dt.setZone(f.zone); }
			const parsed = dt.parse ? dt.parse(r.moment, 'YYYY-MM-DD HH:mm:ss') : null;
			if(parsed){ setTime(parsed); }
			this.setState({ vedicCasting: false, vedicMoment: r.moment });
		}catch(e){
			this.setState({ vedicCasting: false, vedicErr: '入境求根失败' });
		}
	},

	async computeVedicNavanayaka(extra, fields){
		const year = extra.vedicYear != null ? extra.vedicYear : currentYear();
		this.setState({ nvLoading: true, nvErr: '' });
		try{
			const f = { zone: fields.zone && fields.zone.value, lat: fields.lat && fields.lat.value, lon: fields.lon && fields.lon.value, gpsLat: fields.gpsLat && fields.gpsLat.value, gpsLon: fields.gpsLon && fields.gpsLon.value };
			const nv = await computeNavanayaka(year, f);
			this.setState({ nvLoading: false, navanayaka: nv, navanayakaYear: year });
		}catch(e){
			this.setState({ nvLoading: false, nvErr: '九主计算失败' });
		}
	},

	// 土火合巨蟹:惰性调 planetcycles(mars×saturn 合相)筛巨蟹座命中年。
	async computeMarsSaturnCancer(){
		const startYear = clampYear(this.state.gcStart, 1300);
		const endYear = clampYear(this.state.gcEnd, 2200);
		this.setState({ msLoading: true, msErr: '' });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/planetcycles`, {
				body: JSON.stringify({ startYear, endYear, p1: 'Mars', p2: 'Saturn', aspect: 0 }),
				timeoutMs: 90000,
			});
			const r = (data && data.Result) ? data.Result : data;
			const rows = detectMarsSaturnCancer((r && r.events) ? r.events : []);
			this.setState({ msLoading: false, msCancerRows: rows });
		}catch(e){
			this.setState({ msLoading: false, msErr: '土火合巨蟹计算失败' });
		}
	},

	buildAiSnapshot(chart, fields, extra){
		const ex = extra || {};
		const type = ex.mundaneType || 'ingress';
		const TITLE = { ingress: '世俗入宫', newmoon: '新月图', fullmoon: '满月图', solecl: '日食图', lunecl: '月食图', region: '地区盘', cycles: '行星周期', solunar: '恒星派入境', vedicmundane: '吠陀世运', mundanehorary: '世运卜卦' };
		const headLines = [`[${TITLE[type] || '世俗入宫'}]`, `规则集：${rulesetConfig(ex.mundaneRuleset).label}`];
		// 两个页面级覆盖此前不进快照:页面改了、AI 拿到的仍是流派缺省值。
		// 只在显式覆盖(非 auto)且本盘型真消费时补行 —— 缺省态快照逐字节不变。
		if(type === 'ingress'){
			headLines.push(`入宫节气：${ex.ingressTerm || '-'}`, `年份：${ex.ingressYear || '-'}`);
			if(ex.mundaneIngressRule && ex.mundaneIngressRule !== 'auto'){
				headLines.push(`入境主管制：${MUNDANE_INGRESS_RULE_CN[ex.mundaneIngressRule] || ex.mundaneIngressRule}（页面级覆盖）`);
			}
		}
		else if(type === 'newmoon' || type === 'fullmoon'){ headLines.push(`时刻：${ex.selectedMoment || '-'}`); }
		else if(type === 'solecl' || type === 'lunecl'){
			headLines.push(`时刻：${ex.selectedMoment || '-'}`, `类型：${ex.eclipseTypeText || '-'}`);
			if(ex.mundaneOrbScheme && ex.mundaneOrbScheme !== 'auto'){
				headLines.push(`受冲容许度：${MUNDANE_ORB_SCHEME_CN[ex.mundaneOrbScheme] || ex.mundaneOrbScheme}（页面级覆盖）`);
			}
		}
		else if(type === 'region'){ headLines.push(`地区：${ex.regionCn || '-'}`); }
		else if(type === 'solunar'){
			const st = describeSolunar(ex.solunarType || 'capsolar', ex.solunarWeights || 'scheme_a');
			if(st){ // 体系行=盘种固定设计(solunar 恒 Fagan/Bradley+Campanus,非可调参数)=事实标注;
			// 若未来做成可调参数,必须改从实际计算参数取值(禁字面量)。
			headLines.push(`盘种：${st.cn}`, `有效期：${st.span} · 权重 ${st.weight}`, '体系：恒星黄道 Fagan/Bradley · Campanus 量角化'); }
		}
		else if(type === 'vedicmundane'){
			headLines.push(`年份：${ex.vedicYear || currentYear()}`, '体系：恒星黄道 Lahiri · 梅沙入境为年度主盘');
		}
		else if(type === 'mundanehorary'){
			const kindCn = (MUNDANE_HORARY_KINDS.find((k) => k.key === (ex.mhKind || 'war')) || {}).cn || '战争';
			headLines.push(`问题类型：${kindCn}`, '机制同卜卦,问主=公众/国家,宫义按世运读');
		}
		// 世俗宫义判词段 + 定局/分野/骨架/推运 分析段(全部从 facts 派生,供 AI 解读)
		let judge = '';
		const extraSecs = [];
		try{
			const facts = buildFacts(chart);
			const rows = describeMundaneChart(facts);
			if(rows && rows.length){ judge = '[世俗宫义]\n' + formatMundaneHouseTable(rows); }
			const v = describeMundaneVictor(facts, ex.mundaneRuleset);
			if(v){
				// 年主卡逐星得分与偶然项明细(此前只有年主一行)。
				const scoreLines = (v.scores || []).filter((x) => x.score > 0).map((x) => `- ${x.cn} ${x.score}${x.accidentalItems && x.accidentalItems.length ? `（${x.accidentalItems.map((it) => `${it.cn} ${it.v > 0 ? '+' + it.v : it.v}`).join('，')}）` : ''}`);
				extraSecs.push(`[定局·年主/盘主]\n年主星：${v.victorCn}（累分 ${v.maxScore}）${v.victorMundane ? ' · ' + v.victorMundane.powerRole : ''}；取点 ${v.points.join(' / ')}${scoreLines.length ? '\n' + scoreLines.join('\n') : ''}`);
			}
			if(type === 'ingress'){
				const sk = describeIngressSkeleton(facts);
				if(sk){
					// 骨架卡补:上升气质/十宫内星/产前朔望/临四轴/外行星。
					let syz = null; try{ syz = describeMundaneSyzygy(facts); }catch(e){ syz = null; }
					const more = [];
					if(sk.ascTemper){ more.push(`上升气质 ${sk.ascTemper.temper}`); }
					if(sk.tenthPlanets && sk.tenthPlanets.length){ more.push(`10宫内 ${sk.tenthPlanets.map((x) => x.cn).join('、')}`); }
					if(syz){ more.push(`产前朔望 ${syz.signCn} ${syz.signlon != null ? syz.signlon.toFixed(1) + '°' : ''}${syz.kind ? '（' + syz.kind + '）' : ''}`); }
					more.push(`临四轴 ${sk.angular && sk.angular.length ? sk.angular.map((a) => `${a.cn}(第${a.house}宫)${a.malefic ? '⚠' : ''}`).join('、') : '无'}`);
					if(sk.outers && sk.outers.length){ more.push(`外行星 ${sk.outers.map((o) => `${o.cn} ${o.houseMeaning}`).join('；')}`); }
					extraSecs.push(`[入境骨架]\n上升 ${sk.ascSignCn} · 主星 ${sk.ascRulerCn} 落 ${sk.ascRulerHouse} 宫${sk.ascRulerAngular ? '(临轴)' : ''}${sk.ascRulerRetro ? '(逆)' : ''}；政权 10宫主 ${sk.tenthRulerCn} · 太阳 ${sk.sun ? sk.sun.house : '-'} 宫；民生 月亮 ${sk.moon ? sk.moon.house : '-'} 宫\n${more.join('；')}`);
				}
			}
			if(type === 'ingress' || type === 'region'){
				const ch = describeChorography(facts, rulesetConfig(ex.mundaneRuleset).chorographyDataset);
				if(ch && ch.axes.length){
					// 分野卡补:托勒密四象限三方主管。
					const quads = (ch.quadrants || []).map((q) => `${q.cn}（${q.signs.map((sg) => (SIGNS[sg] || {}).cn || sg).join('/')}）主星 ${PLANET_CN[q.rulers.day]}/${PLANET_CN[q.rulers.night]} · ${q.region}`).join('；');
					extraSecs.push('[地理分野]\n数据集：' + ch.datasetMeta.label + '\n' + formatMundaneChorographyTable(ch.axes) + (quads ? '\n托勒密四象限：' + quads : '') + '\n（多源综合·传统占星学术参考,非现实地缘断言）');
				}
			}
			if(type === 'vedicmundane' && this.state.navanayaka && this.state.navanayakaYear === (ex.vedicYear || currentYear())){
				const nv = this.state.navanayaka;
				const lines = ['[年之九主]'];
				nv.offices.forEach((o) => { lines.push(`${o.cn}：${o.lord ? (PLANET_CN_V[o.lord] || o.lord) : '—'} · ${o.domain}`); });
				nv.readings.forEach((t) => lines.push(t));
				lines.push('（九主属后世历书传统,非出自某一原典）');
				extraSecs.push(lines.join('\n'));
			}
			if(type === 'mundanehorary'){
				const kind = ex.mhKind || 'war';
				const lines = ['[世运问判]'];
				if(kind === 'war'){
					const w = describeWarQuestion(facts);
					if(w){ lines.push(`己方 ${w.us.cn}(${w.us.total}) vs 敌方 ${w.them.cn}(${w.them.total})${w.reception ? ' · 互容' : ''}`, w.verdict.text); }
				}else if(kind === 'weather'){
					const wq = describeWeatherQuestion(facts);
					if(wq){ lines.push(`月宿 ${wq.moonMansion || '-'} · ${wq.tone}`); }
				}else{
					const pq = describePriceQuestion(facts);
					if(pq){ lines.push(pq.trend.text, pq.cropNote); }
				}
				if(lines.length > 1){ extraSecs.push(lines.join('\n')); }
			}
			if(type === 'solunar'){
				const ang = computeAngularity(facts, ex.solunarOrb || 3);
				if(ang){
					const fg = ang.rows.filter((r) => r.foreground);
					const lines = ['[角化]', `容许 ${ang.orb}°(卯酉圈等分量角);${fg.length ? '' : '休眠盘——无星入角,无信息可略过'}`];
					fg.forEach((r) => { lines.push(`${MUN_PLANET_CN[r.planet] || r.planet} 距${r.axisCn} ${r.dist.toFixed(1)}°${r.strong ? '(尤强)' : ''}${r.omen ? ' → ' + r.omen.text : ''}`); });
					if(rulerDeathSignature(facts, ex.solunarOrb || 3)){ lines.push('⚠ 复合判据命中:土星与太阳皆在角且彼此无相位'); }
					extraSecs.push(lines.join('\n'));
				}
			}
			if(type === 'region'){
				const founding = (this.state.progFoundingYear != null) ? this.state.progFoundingYear : (ex.regionFoundingYear || null);
				const target = (this.state.progTargetYear != null) ? this.state.progTargetYear : currentYear();
				if(founding != null && facts.meta && facts.meta.ascSign){
					const age = Math.max(0, target - founding);
					const prof = mundaneProfection(facts.meta.ascSign, age);
					const fird = mundaneFirdaria(facts.meta.sect, age);
					const lines = ['[地区盘推运]', `盘龄 ${age} 年（建置 ${founding} → 目标 ${target}）`];
					if(prof){
						lines.push(`小限：年小限 ${prof.profectedSignCn} · 激活第 ${prof.activatedHouse} 宫(${prof.houseTheme}) · 年主 ${prof.lordCn}`);
						// 逐月小限 / 法达序列 / 返照 / 次限(后两者页面按需拉取,算过才成行)。
						if(prof.months && prof.months.length){ lines.push(`逐月小限：${prof.months.map((mm) => `${mm.month}月 ${(SIGNS[mm.sign] || {}).cn || mm.sign}`).join('、')}`); }
					}
					if(fird){
						lines.push(`法达(${fird.sectCn})：大期 ${fird.major.planetCn}（盘龄 ${fird.major.start}–${fird.major.end}）${fird.sub ? ' · 子期 ' + fird.sub.planetCn : ' · 交点期不分子期'}`);
						if(fird.sequence && fird.sequence.length){ lines.push(`法达序：${fird.sequence.map((x) => `${x.planetCn}${x.years}`).join(' · ')}（七政 70+南北交 5 = 75 年一轮）`); }
					}
					if(this.state.srData && this.state.srYear === target && this.state.srKey === chartRequestKey(chart)){
						const sr = this.state.srData;
						lines.push(`太阳返照 ${target}：返照时刻 ${sr.solarReturn ? sr.solarReturn.datetime : '-'}；返照上升 ${fmtDegree(sr.solarAsc)}${sr.lunarReturn ? '；首个月返照 ' + sr.lunarReturn.datetime : ''}`);
					}
					if(this.state.secData && this.state.secYear === target && this.state.secKey === chartRequestKey(chart)){
						const sec = this.state.secData; const pos = sec.positions || [];
						const pSun = pos.find((p) => p.id === 'Sun'); const pMoon = pos.find((p) => p.id === 'Moon');
						const natalSun = (facts.planets && facts.planets.sun) ? facts.planets.sun.lon : null;
						const arc = (pSun && natalSun != null) ? (((pSun.lon - natalSun) % 360 + 360) % 360) : null;
						const sCn2 = (sg) => (SIGNS[String(sg || '').toLowerCase()] || {}).cn || sg;
						const ASP_CN = { 0: '合', 60: '六合', 90: '刑', 120: '三合', 180: '冲' };
						const parts = [];
						if(pSun){ parts.push(`次限太阳 ${sCn2(pSun.sign)} ${pSun.signlon != null ? pSun.signlon.toFixed(1) + '°' : ''}`); }
						if(pMoon){ parts.push(`次限月亮 ${sCn2(pMoon.sign)} ${pMoon.signlon != null ? pMoon.signlon.toFixed(1) + '°' : ''}`); }
						if(arc != null){ parts.push(`太阳弧 ${arc.toFixed(1)}°`); }
						if(sec.aspectsToNatal && sec.aspectsToNatal.length){ parts.push(`应期 ${sec.aspectsToNatal.slice(0, 6).map((a) => `次限${MUN_PLANET_CN[String(a.a).toLowerCase()] || a.a}${ASP_CN[a.aspect] || a.aspect + '°'}本命${MUN_PLANET_CN[String(a.b).toLowerCase()] || a.b}(${a.orb != null ? a.orb.toFixed(1) : '?'}°)`).join('、')}`); }
						if(parts.length){ lines.push(`次限·太阳弧 ${target}：${parts.join('；')}`); }
					}
					extraSecs.push(lines.join('\n'));
				}
			}
		}catch(e){ /* noop */ }
		// 其余右栏卡(概览/判读/恒星/推运/各盘型专卡)折入既有盘型段:与 render*Card 同源纯函数,按需拉取物取自 state。
		let cardSecs = [];
		try{ cardSecs = buildMundaneCardSections(chart, ex, this.state, null); }catch(e){ cardSecs = []; }
		const head = headLines.join('\n');
		const body = buildAstroSnapshotContent(chart, fields) || '';
		return [head, judge, ...extraSecs, ...cardSecs, body].filter(Boolean).join('\n\n');
	},

	// 存案前补周期表正文:周期表页签没打开过(或还没算完)时,按周期表保存的设置现取一次,写进本页 state,
	// 随后存案快照照常把它带上。请求与周期表页签同一套构参(MundaneCycleTables.body)。
	async ensureCycleTableText(chart, extra){
		if(!chart || ((extra || {}).mundaneType || 'ingress') !== 'cycles'){ return; }
		if(this.state.cycleTableText && this.state.cycleTableKey === chartRequestKey(chart)){ return; }
		const settings = MUNDANE_CYCLE_SETTINGS.load();
		const base = chartParams(chart);
		const body = { ...base, targetDate: base.date, targetTime: base.time || '12:00:00', ...mundaneCycleRequestFields(settings, { startYear: null, endYear: null }) };
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/mundanecycles`, { body: JSON.stringify(body), silent: true, timeoutMs: 60000 });
			const result = unwrapResult(data);
			if(!result || result.err){ return; }
			const text = buildMundaneCycleText(result, body);
			if(text){ await new Promise((resolve)=>this.setState({ cycleTableText: text, cycleTableKey: chartRequestKey(chart) }, resolve)); }
		}catch(e){ /* 取不到只少这一段,存案照常 */ }
	},
};
