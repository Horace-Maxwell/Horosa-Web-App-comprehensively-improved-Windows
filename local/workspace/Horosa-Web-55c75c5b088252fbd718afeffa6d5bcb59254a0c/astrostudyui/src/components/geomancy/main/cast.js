// 地占页 · 起卦与重起、问题 / 宫位 / 传本选项改值
// 从 GeomancyMain.js 按职责拆出的 GeomancyMain 方法:this 仍是 GeomancyMain 实例,门面里 mixinMethods(GeomancyMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import { saveModuleAISnapshotLazy, clearModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { castSourceKey, castFailureKeeps } from '../../../utils/derivedChartSource';
import { paramsFromFields, timePatchFromDateTime, geoPatchFromRec } from '../../../utils/divinationTimeDraft';
import { RECAST_DEBOUNCE_MS, QUESTION_TYPE_HOUSE, CAST_SKIN_MODES, computeTimeSeed, TRADITION_OPTIONS, TRADITION_SHORT_EXTRA, TRADITION_EXTRA_LABELS, GEOMANCY_PAGE_SETTINGS } from './tables';
import { postGeomancy, buildGeomancySnapshotText } from './snapshot';
import { isEntropySeed, newEntropySeed, seedDisplayText } from '../../../utils/trueRandom';

// 随机起一盘取的真随机记录长度(字节):与后端 astrostudy/geomancy/random_source.GEOMANCY_ENTROPY_BYTES 同值
// (主序 + 逐星定宫 / 上升取法 / 行星地占盘三段子记录,都读不完)。
const GEOMANCY_ENTROPY_BYTES = 192;

export const castMethods = {
	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields(){
		return this.state.localFields || this.props.fields || {};
	},

	// [自由起盘] 左栏时间选择 → 写本地草稿(不 dispatch)。时间起卦即用此时刻算种子;占星盘用此时刻。
	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...timePatchFromDateTime(dt) } });
	},

	// [自由起盘] 左栏经纬度选择 → 写本地草稿(经纬 + 时区自动校正 + 重锚时间 + 地名);占星盘用此地点。
	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...geoPatchFromRec(rec, base) } });
	},

	async clickCast(pinnedSeed){
		const seedMode = this.state.seedMode;
		// pinnedSeed(真随机记录或有限数)= 用既有母图种子定盘重算:同护盾盘、赋义随流派/范围/黄道变,不重新揲卦。
		// (onClick 透传的是 event 对象,两条判定都自然过滤掉,不会误当种子。)
		const pinned = isEntropySeed(pinnedSeed) ? pinnedSeed : (Number.isFinite(pinnedSeed) ? Math.floor(pinnedSeed) : null);
		const af = this.activeFields();
		const payload = {
			question: this.state.question || '',
			questionType: this.state.questionType || 'custom',
			quesitedHouse: Number(this.state.quesitedHouse) || (QUESTION_TYPE_HOUSE[this.state.questionType || 'custom'] || 1),
			seedMode: pinned !== null ? 'manual' : seedMode,
			tradition: this.state.tradition || 'european_classical',
			readingScope: this.state.readingScope || 'L3',
			zodiacSystem: this.state.zodiacSystem || 'classical',
		};
		// [自由起盘] 透传所选时间地理:占星定局(L4)/十二宫(L3)的星盘按此时刻地点起(后端不识则忽略,无害)。
		const gp = paramsFromFields(af);
		if(gp){
			payload.date = gp.date; payload.time = gp.time; payload.zone = gp.zone;
			payload.lon = gp.lon; payload.lat = gp.lat;
			// 纪元前才发 ad:公元后之请求体与本次改动前逐字节相同(负年之真实盘方能起对)
			if(Number(gp.ad) === -1){ payload.ad = -1; }
		}
		// [高级传本] 只发用户显式改过的项;未改的键根本不出现在请求里 → 后端回落所选流派默认。
		// 这是零回归的关键:不传 ≠ 传默认值,后者会在换流派时把旧流派的值钉死。
		const g = this.state.granular || {};
		Object.keys(g).forEach((k)=>{ if(g[k] !== null && g[k] !== undefined){ payload[k] = g[k]; } });
		if(Number.isFinite(Number(this.state.turnTo))){ payload.turnTo = Number(this.state.turnTo); }
		// [起卦诸法] 皮肤四法(掷骰/抛硬币/沙痕/掷片)走同一随机源,以 castMethod 如实回传所用之法;
		// 报数法真收十六数(奇=单点/偶=双点),数不足十六即报错不发,免得静默回落成随机盘。
		if(pinned === null && CAST_SKIN_MODES.indexOf(seedMode) >= 0){
			payload.castMethod = seedMode;
			payload.seedMode = 'random';
		}
		if(pinned === null && seedMode === 'numbers'){
			const nums = this.parsedCastNumbers();
			if(!nums){
				message.error('报数起卦须自报十六个正整数(奇数为单点、偶数为双点;序为母一至母四之火风水土)');
				return;
			}
			payload.castMethod = 'numbers';
			payload.castNumbers = nums;
			payload.seedMode = 'manual';
			// 盾牌由报数定,但辅助随机(另起四行点之上升、异或表盘等)仍须确定性,否则同一组数两次起盘不全同。
			payload.seed = isEntropySeed(this.state.manualSeed) ? this.state.manualSeed : (Number(this.state.manualSeed) || 0);
		}
		// [行星地占盘] 仅开启时发四键:关则请求体与开此功能前逐字节相同(零回归)。
		if(this.state.planetaryChart){
			payload.planetaryChart = true;
			payload.planetaryChartZodiac = this.state.planetaryChartZodiac || 'classical';
			if(this.state.planetaryChartNodes){ payload.planetaryChartNodes = true; }
			if(this.state.planetaryChartExtras){ payload.planetaryChartExtras = true; }
		}
		// [钉盘重算] 起卦源取**这副盘自己**回传的 settings,而非左栏现值 —— 左栏那串是下一次起卦的
		// 草稿,不该反噬已出之卦(用户改完报数框却没点起盘,不等于要换掉手上这一卦)。
		// 🔴 报数盘之母图全由那十六个数定、与种子无涉:只钉种子而不带数,后端即改由 RNG 重揲 ——
		//    切一次流派就换了一副卦(实测同种子下 Amissio×4 变成 Puella/Coniunctio…)。
		// 🔴 时间档只认 timeSeed(seed 对它无效),钉错字段即退化真随机 → 按档分派。
		// 八档起卦法逐档实证:回带起卦法 + 按档钉种子 = 八档全同盘,且「当初是怎么起的」不丢。
		if(pinned !== null){
			const fz = (this.state.result && this.state.result.reading && this.state.result.reading.settings) || {};
			const fzMethod = fz.cast_method || '';
			if(fzMethod === 'time'){ payload.castMethod = 'time'; payload.timeSeed = pinned; }
			else{
				payload.seed = pinned;
				if(fzMethod && fzMethod !== 'manual'){ payload.castMethod = fzMethod; }
				if(fzMethod === 'numbers' && Array.isArray(fz.cast_numbers) && fz.cast_numbers.length === 16){
					payload.castNumbers = fz.cast_numbers.slice();
				}
			}
		}
		else if(seedMode === 'manual'){ payload.seed = this.state.manualSeed || 0; }
		// 时间起卦:由左栏所选时间(精确到分)算确定性种子塞 timeSeed,使同一时刻起卦可复现;
		// 不塞则后端当场另取随机,刷新即变盘(后端 webgeomancysrv.py 已就绪接收 timeSeed)。
		else if(seedMode === 'time_seed'){ payload.timeSeed = computeTimeSeed(af); }
		// 随机/掷骰/抛硬币/沙痕/掷片 = 真随机:起盘时当场向系统随机源取一段原始字节作「真随机记录」入体,后端直接读它定每一爻
		// (不经伪随机数发生器)并原样回传 → 每次起盘新卦、同一记录原样重开、缓存按体命中自洽。
		if(payload.seed === undefined && payload.timeSeed === undefined && !(Array.isArray(payload.castNumbers) && payload.castNumbers.length)){
			payload.seed = newEntropySeed(GEOMANCY_ENTROPY_BYTES);
		}
		// 待触发的时地重排就此作废:用户改完时地立刻点「起盘」时,那一拍会在新盘出来后又多打一次
		// (盘不会错,requestSeq 挡得住乱序,但白费一次往返)。只在真发请求时作废 —— 报数不足等没发出去的点击
		// 不能把待触发的重排一并丢掉(否则那次时地改动就再也作用不到当前盘)。
		if(this._recastTimer){ clearTimeout(this._recastTimer); this._recastTimer = null; }
		// 序号在真发请求时才取:报数不足等没发出去的点击不作废在途的那一盘
		const seq = ++this.requestSeq;
		// 新起一盘(不钉种子)在途:期间要钉种子重排的(改流派 / 范围 / 时地等)先挂起,等新盘落定按新盘的种子补排 ——
		// 否则重排拿的是旧盘种子,又是更晚的请求,新起的那一盘被挡掉。新起盘的请求体已带全部当前设置,先前挂起的补排作废
		if(pinned === null){ this._freshCastSeq = seq; this._recastAfterFresh = false; }
		this.setState({ loading: true });
		const settleFresh = ()=>{
			const was = this._freshCastSeq === seq;
			if(was){ this._freshCastSeq = null; }
			if(was && this._recastAfterFresh){ this._recastAfterFresh = false; this.recastPinned(); }
		};
		// 起盘签名:时刻地点 + 种子。钉种子重排(改流派 / 范围 / 黄道)是同一盘换口径;新起一盘(取新种子)是另一盘
		const castBase = castSourceKey(af);
		const castSig = pinned !== null ? `${castBase}#${pinned}` : `${castBase}#new:${seq}`;
		try{
			const result = await postGeomancy('reading', payload);
			if(this.unmounted || seq !== this.requestSeq){ return; }
			const usedSeed = result && result.reading && result.reading.seed !== undefined && result.reading.seed !== null ? result.reading.seed : payload.seed;
			this.setState({ loading: false, result, resultSig: `${castBase}#${usedSeed}` }, ()=>{
				saveModuleAISnapshotLazy('geomancy', ()=>buildGeomancySnapshotText(result), this.snapshotMeta());
				this.pushHistory(result);
				settleFresh();
			});
		}catch(e){
			if(this.unmounted || seq !== this.requestSeq){ return; }
			// 取失败:同一盘只换口径 → 留存;新起的一盘 / 换了时刻地点 → 屏上那盘是上一盘,清掉(连同 AI 快照槽)
			const keep = castFailureKeeps(this.state.resultSig, castSig);
			this.setState(keep ? { loading: false } : { loading: false, result: null, resultSig: '' }, settleFresh);
			if(!keep){ clearModuleAISnapshot('geomancy'); }
			message.error('地占起盘失败，请稍后重试');
		}
	},

	clickReproduce(){
		// 把当前盘的种子锁定为手工种子,便于复现。
		const reading = this.state.result && this.state.result.reading;
		if(!reading || (reading.seed === undefined || reading.seed === null)){ return; }
		this.setState({ seedMode: 'manual', manualSeed: reading.seed });
		message.success(`已锁定种子 ${seedDisplayText(reading.seed)}，再次起盘可复现此盘`);
	},

	setRightPanelTab(key){ this.setState({ rightPanelTab: key }); },

	// centerViewTouched:用户一旦手点过视图,就不再被「结构对照模式自动落其专属盘」覆盖其选择。
	setCenterView(v){ this.setState({ centerView: v, centerViewTouched: true }); },

	// [实时重算·唯一入口] 左栏一改(流派/范围/黄道/传本/行星盘/问类/所问宫/时地)即重排判读,
	// 不必再点一次「起盘」。关键:用既有盘的实际起卦源定盘重算 → 同一母图(护盾盘不变),
	// 仅赋义随设置与时地变;否则随机/时间起卦下会重新揲卦得另一副盘,切一次流派整盘跳变(原 bug)。
	// 未起盘则什么都不算 —— 此时左栏改动只是下一次起卦的草稿。
	recastPinned(){
		// 新起的一盘还在途:挂起,等它落定按新盘的种子补排(见 clickCast)
		if(this._freshCastSeq !== null && this._freshCastSeq !== undefined && this._freshCastSeq === this.requestSeq){
			this._recastAfterFresh = true;
			return;
		}
		const reading = this.state.result && this.state.result.reading;
		if(!reading){ return; }
		const seed = reading.seed;
		if(isEntropySeed(seed)){ this.clickCast(seed); return; }
		if(seed === undefined || seed === null || !Number.isFinite(Number(seed))){ this.clickCast(); return; }
		this.clickCast(Number(seed));
	},

	// 时地面板逐段吐值(选年→选月→选日各一拍),逐拍打后端既慢又白费 → 并到静默期后一次算。
	scheduleRecastPinned(){
		if(this._recastTimer){ clearTimeout(this._recastTimer); }
		this._recastTimer = setTimeout(()=>{
			this._recastTimer = null;
			if(this.unmounted){ return; }
			this.recastPinned();
		}, RECAST_DEBOUNCE_MS);
	},

	// 时地判据:取**真正送进请求体的那几个值**,而非 fields 引用 —— 全局 fields 会因无关 dispatch
	// 换新引用(按引用判会平白重打后端),而本地草稿 localFields 每次都是新对象(按引用判则每敲一下都重算)。
	castParamSig(){
		const gp = paramsFromFields(this.activeFields());
		return gp ? [gp.date, gp.time, gp.zone, gp.lon, gp.lat, gp.ad].join('|') : '';
	},

	// 所问之事:失焦时若与盘上那份不同才重排(逐字重算 = 每敲一下打一次后端)。
	commitQuestion(){
		const rd = this.state.result && this.state.result.reading;
		if(rd && (rd.question || '') !== (this.state.question || '')){ this.recastPinned(); }
	},

	// 问类:选问类即填入其预设所问宫 —— 预设仍在,只是不再是唯一出路。
	changeQuestionType(value){
		this.setState({ questionType: value, quesitedHouse: QUESTION_TYPE_HOUSE[value] || 1 },
			()=>this.recastPinned());
	},

	// 所问宫定的是判读主宫(法官/证人取谁、得地算哪一宫),改了必须重排判读。
	// 手改所问宫即脱离预设 → 问类转「自订」,免得界面显示的问类与实际主宫不符。
	changeQuesitedHouse(value){
		const v = Number(value);
		this.setState({ quesitedHouse: v,
			questionType: (QUESTION_TYPE_HOUSE[this.state.questionType] === v) ? this.state.questionType : 'custom' },
			()=>this.recastPinned());
	},

	// 高级传本逐项改写:写入覆盖表 → 锁种子重算(护盾盘不变,仅判读随设置变)。
	changeGranular(key, value){
		const next = { ...(this.state.granular || {}) };
		if(value === null || value === undefined || value === '__profile__'){ delete next[key]; }
		else{ next[key] = value; }
		// 用户亲手改的逐项覆盖 → 落盘。只落**这一项**,以库里已保存的覆盖层为底:state 里那张覆盖层可能刚被一份事盘 / 历史记录
		// 回灌过,整张存下去就把事盘里的其它覆盖项也存成了你的缺省(之后每一卦都带着它们发给后端)。
		GEOMANCY_PAGE_SETTINGS.saveMapEntry('granular', key, (value === null || value === undefined || value === '__profile__') ? undefined : value);
		this.setState({ granular: next }, ()=>{
			this.recastPinned();
		});
	},

	// 下拉当前值:用户改过则显该值(bool 转字符串以配 Select),未改则显「跟随预设」。
	granularValue(key, backendKey){
		const g = this.state.granular || {};
		const v = g[key];
		if(v === undefined || v === null){ return '__profile__'; }
		return typeof v === 'boolean' ? String(v) : v;
	},

	// 「跟随预设」档标注的是**预设**取值(选回它会得到什么)。后端只回生效值:未覆盖时生效值即预设值,顺手记下;
	// 已覆盖时生效值是覆盖值 —— 曾直接拿它标「跟随预设（现为：右起）」,选回去却得左起。故覆盖态改用记下的预设值,记不到就不标。
	presetRaw(field){
		const st = ((this.state.result || {}).reading || {}).settings || {};
		const raw = st[field.backendKey];
		const g = this.state.granular || {};
		if(!this._presetEff){ this._presetEff = {}; }
		if(g[field.key] === undefined || g[field.key] === null){
			if(raw !== undefined && raw !== null){ this._presetEff[field.key] = raw; }
			return raw;
		}
		return this._presetEff[field.key];
	},

	effLabel(field){
		const raw = this.presetRaw(field);
		if(raw === undefined || raw === null){ return ''; }
		const k = typeof raw === 'boolean' ? String(raw) : raw;
		const hit = (field.options || []).find((o)=>o.key === k);
		return hit ? hit.label : String(raw);
	},

	// 生效值之**短名**:供闭合态显示。
	// 🔴 左栏仅 ~195px,而选项全称长至「跟随预设（现为:顺铺(一至十二卦入一至十二宫)）」(实测 277px)
	//    —— 闭合态必被省略号吃掉,等于「选项被遮挡」。故闭合态显短名、下拉列表显全称(optionLabelProp),
	//    并保留 title 悬浮全文;长值之项另改单列全宽,断无截断之理。
	effShort(field){
		const raw = this.presetRaw(field);
		if(raw === undefined || raw === null){ return ''; }
		const k = typeof raw === 'boolean' ? String(raw) : raw;
		const hit = (field.options || []).find((o)=>o.key === k);
		return hit ? (hit.short || hit.label) : String(raw);
	},

	// [行星地占盘] 选项变更:与 changeGeomancyOpt 同构(锁种子重算:盾牌盘不变,行星盘随选项重取)。
	changePlanetaryOpt(key, value){
		GEOMANCY_PAGE_SETTINGS.save({ [key]: value });
		this.setState({ [key]: value }, ()=>{
			this.recastPinned();
		});
	},

	// [报数起卦] 文本 → 十六个数;非十六个或含非数则返回 null(调用方据此报错不发请求)。
	parsedCastNumbers(){
		const raw = `${this.state.castNumbersText || ''}`.replace(/[，、]/g, ' ').replace(/,/g, ' ');
		const parts = raw.split(/\s+/).filter((x)=>x !== '');
		if(parts.length !== 16){ return null; }
		const nums = parts.map((x)=>Number(x));
		if(nums.some((n)=>!Number.isFinite(n) || n < 1 || Math.floor(n) !== n)){ return null; }
		return nums;
	},

	changeGeomancyOpt(key, value){
		// 换流派预设 = 批量写默认:清空逐项覆盖,让新预设的默认值全面生效(用户可再逐项改写)。
		const patch = key === 'tradition' ? { [key]: value, granular: {} } : { [key]: value };
		if(key === 'tradition'){ this._presetEff = {}; }   // 换预设:记下的旧预设取值作废(见 presetRaw)
		GEOMANCY_PAGE_SETTINGS.save(patch);   // 换预设连同「清空逐项覆盖」一起落盘
		this.setState(patch, ()=>{
			this.recastPinned();
		});
	},

	// 流派选项:优先后端回传 traditions(随内核),缺则静态。
	// 🔴 后端只回 id/label 而无短名 —— 若直接用,闭合态短名即丢、窄屏下被省略号截断(实测 63/57px)。
	//    故按 key 从静态表补 short;后端新出的流派无短名则回落其 label(照旧,不至于空)。
	traditionOptions(){
		const t = this.state.result && this.state.result.traditions;
		if(Array.isArray(t) && t.length){
			const shortByKey = { ...TRADITION_SHORT_EXTRA };
			TRADITION_OPTIONS.forEach((o)=>{ if(o.short){ shortByKey[o.key] = o.short; } });
			return t.map((x)=>({ key: x.id, label: x.label, short: shortByKey[x.id] }));
		}
		const cur = this.state.tradition;
		if(cur && !TRADITION_OPTIONS.some((o)=>o.key === cur)){
			return TRADITION_OPTIONS.concat([{ key: cur, label: TRADITION_EXTRA_LABELS[cur] || cur, short: TRADITION_SHORT_EXTRA[cur] }]);
		}
		return TRADITION_OPTIONS;
	},
};
