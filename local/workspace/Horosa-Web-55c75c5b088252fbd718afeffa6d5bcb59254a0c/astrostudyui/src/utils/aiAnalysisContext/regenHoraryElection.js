// AI 分析挂载上下文 · 卜卦与择日无头重算:随案设置回放、流派变更判定、扫描时点。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import DateTime from '../../components/comp/DateTime';
import { HORARY_JUDGE_EMPTY } from '../techniqueMountSettings';
// 卜卦/择日「判读参数/流派口径」单一真值(叶子模块,无环):齿轮 hp_/ep_ 扁平键按此表解码。
import { HORARY_PARAM_SPEC, horaryBackendFields } from '../../divination/horary/horarySchools';
import { ELECTION_PARAM_SPEC } from '../../divination/election/electionParams';
import { DIVINATION_CASE_SETTING_KEYS } from '../divinationCaseSave';
import { runHorary } from '../../divination/horary/horaryEngine';
import { horaryJudgeOpts, keepQuestionScoped, horaryStoredSchool } from '../../divination/horary/horarySchools';
import { judgeLayerOverrides } from '../judgeLayerOverrides';
import { buildHorarySnapshot } from '../../divination/horary/horarySnapshot';
import { runElection } from '../../divination/election/electionEngine';
import { buildElectionSnapshot } from '../../divination/election/electionSnapshot';
import { fetchChartResultForRecord } from './chartParams';

// 卜卦盘 horary：仅凭起课时间+地点起西洋盘(无需人工摇卦),用引擎默认类别 general 出结构化裁决快照。
// 与 DivinationChartShell 同源(fetchChart→Result→runHorary);后端不可达 → 无盘返 '' → 显「缺失」(西洋盘必后端)。
// 🔴 卜卦/择日事盘的随案技法设置(payload.settings:黄道/宫制/守护+古典 20 键,
// 与 divinationCaseSave 落档、DivinationChartShell 还原白名单三方 lockstep)播回排盘 record——
// 此前两 regenerate 从不读 settings ⇒ 挂载补算按 buildFieldObject 回退起盘:择日页面默认
// 整宫制(hsys=0),hsys 回退修为 1 后挂载与页面新分叉;卜卦存档口径同被无视。settings 打底、
// 流派 backend 播种(显式换派)覆盖 —— 与页面「先还原存档再按换派播 backend」同序。
// 三方单源:古典段 import 自 divinationCaseSave(保存侧真源),本地只保留 4 基础键前缀。
const DIVINATION_SETTINGS_KEYS = ['zodiacal', 'siderealAyanamsa', 'hsys', 'tradition',
	...DIVINATION_CASE_SETTING_KEYS];
function divinationSettingsFields(record){
	try{
		const raw = record && record.payload;
		const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
		const settings = payload && payload.settings && typeof payload.settings === 'object' ? payload.settings : null;
		if(!settings){
			return null;
		}
		const out = {};
		DIVINATION_SETTINGS_KEYS.forEach((k)=>{
			if(settings[k] !== undefined && settings[k] !== null){ out[k] = settings[k]; }
		});
		return Object.keys(out).length ? out : null;
	}catch(_e){
		return null;
	}
}

// 齿轮换没换卜卦流派:合并后顶层 horarySchool(只由齿轮写,剪枝后只在≠存档时留下)≠ 存档流派
// (horaryStoredSchool:没存流派按存档宫制反推,与挂载基线同口径)
function horaryGearSchoolChanged(options, savedSettings){
	const o = options && typeof options === 'object' ? options : {};
	if(o.horarySchool === undefined || o.horarySchool === null || o.horarySchool === ''){ return false; }
	return `${o.horarySchool}` !== horaryStoredSchool(o, savedSettings);
}

export async function regenerateHorarySnapshot(record, options){
	// 起课/事盘记录用 divTime,但西洋盘 fetch 走 buildFieldObject(读 record.birth)→ 须把起课时刻映射为 birth 才能起盘。
	let chartRecord = (record && record.birth) ? record : { ...record, birth: (record && (record.divTime || record.updateTime)) || '' };
	// 随案存档口径打底(present 才播;老案例缺 settings 零行为)。
	const savedSettings = divinationSettingsFields(record);
	if(savedSettings){
		chartRecord = { ...chartRecord, ...savedSettings };
	}
	// 🔴 流派 backend 参数组播入排盘 record(与技法页 HoraryMain 同源同函数):此前挂载
	// 重算只把流派用在判读层,盘本身仍按默认起 —— 换 Regiomontanus 档判读变了、宫头没变,
	// 与技法页同档盘面分叉(B-1 死开关)。存档 overrides(hp_ 前缀之外的 backend 键)随档覆盖。
	// 齿轮换了流派(顶层 horarySchool 只由齿轮写)= 页面换派:存档的逐项覆盖整组作废(HoraryMain 换派连同 horaryOverrides:{} 一起落)
	const gearSchoolChanged = horaryGearSchoolChanged(options, savedSettings);
	// 存档流派(没存流派按存档宫制反推)
	const storedSchool = horaryStoredSchool(options, savedSettings);
	try{
		const oo = options && typeof options === 'object' ? options : {};
		const oxx = (oo.extra && typeof oo.extra === 'object') ? oo.extra : {};
		const schoolId = gearSchoolChanged ? oo.horarySchool : storedSchool;
		if(schoolId){
			const backendFields = horaryBackendFields(schoolId, (!gearSchoolChanged && oxx.horaryOverrides && typeof oxx.horaryOverrides === 'object') ? oxx.horaryOverrides : null);
			// 不换派:存档里有的键为准(存档手改过的宫制等不被流派值顶掉,与页面载入存档同);齿轮换了派:新派后端字段覆盖存档
			chartRecord = gearSchoolChanged ? { ...chartRecord, ...backendFields } : { ...chartRecord, ...backendFields, ...(savedSettings || {}) };
		}
	}catch(_e){
		// 流派表异常不阻断(按原 record 起盘=旧行为)。
	}
	const chart = await fetchChartResultForRecord(chartRecord);
	if(!chart){
		return '';
	}
	try{
		const o = options && typeof options === 'object' ? options : {};
		const ox = (o.extra && typeof o.extra === 'object') ? o.extra : {};
		// 🔴 问卜类别键名兼容:齿轮/新档写 topicId,页面存档历来写 questionCategory(payload 顶层+extra 双落)。
		// 曾只读 topicId → 存了「婚姻」的卜卦事盘一动齿轮即回落「综合」,整盘判读换主题。
		const topicId = o.topicId || o.questionCategory || ox.topicId || ox.questionCategory || 'general';
		const horarySchool = gearSchoolChanged ? o.horarySchool : storedSchool;   // 判读同按存档流派(没存按宫制反推)
		// 判读参数(卜卦专属判读键(spec 单源自动扩,勿写死键数)):存档 extra.horaryOverrides 打底,齿轮 hp_* 扁平键覆盖 ——
		// 🔴 曾第二参写死 null:页面「判读参数」面板改的全部口径在挂载重算里整组蒸发。
		// 齿轮换了流派 = 页面换派:存档的逐项覆盖回随流派,只留「这一问」的键(问谁的事 / 问者性别,keepQuestionScoped 与页面同一函数)
		const savedOverrides = { ...((ox.horaryOverrides && typeof ox.horaryOverrides === 'object') ? (gearSchoolChanged ? keepQuestionScoped(ox.horaryOverrides) : ox.horaryOverrides) : {}) };
		const gearOverrides = {};
		HORARY_PARAM_SPEC.forEach((sp)=>{
			if(sp.scope !== 'horary'){ return; }
			const v = o['hp_' + sp.key];
			// 顶层 hp_* 只由齿轮写:'' = 选回「随流派」→ 去掉存档这一项的覆盖(页面判读参数回到随流派同义);此前跳过 → 仍按存档值
			if(v === ''){ delete savedOverrides[sp.key]; return; }
			if(v === undefined || v === null){ return; }
			if(v === HORARY_JUDGE_EMPTY){ gearOverrides[sp.key] = ''; return; }   // 齿轮里表达「空串档」的值,解码回空串
			gearOverrides[sp.key] = sp.type === 'switch' ? (v === 1 || v === '1' || v === true) : v;
		});
		const overrides = { ...savedOverrides, ...gearOverrides };
		// 定盘自评(问句真诚/年轻体貌)随档并入 opts(影响 radicality,与页面 HoraryJudgment 同构)。
		const j = runHorary(chart, topicId, {
			...horaryJudgeOpts(horarySchool, Object.keys(overrides).length ? overrides : null, judgeLayerOverrides()),
			...(ox.sincerityConfirmed !== undefined || ox.confirmYouthMatch !== undefined || ox.isEventChart !== undefined ? {
				sincerityConfirmed: ox.sincerityConfirmed,
				confirmYouthMatch: ox.confirmYouthMatch,
				isEventChart: ox.isEventChart,
			} : {}),
		});
		// 第三参问句/阵营 → [定盘考量] 段(页面 saveSnap 同构;曾缺参致该段在挂载里必然消失)。
		return j ? (buildHorarySnapshot(j, chart, { questionText: ox.questionText, castingCamp: ox.castingCamp }) || '') : '';
	}catch(e){
		return '';
	}
}

// 择日盘 election：同理,引擎默认 topicId=marriage(runElection 自带兜底)出总评/红线/分项/应期/建议快照。
export async function regenerateElectionSnapshot(record, options){
	// 同 horary:起课/事盘记录用 divTime,映射为 birth 后才能起西洋盘。
	let chartRecord = (record && record.birth) ? record : { ...record, birth: (record && (record.divTime || record.updateTime)) || '' };
	// 随案存档口径打底(择日页面默认整宫制随 settings 回放;流派 hsys 联动在后覆盖)。
	const savedSettings = divinationSettingsFields(record);
	if(savedSettings){
		chartRecord = { ...chartRecord, ...savedSettings };
	}
	// 流派 hsys 联动播入(westernSchools:hsys=null 的档=不联动保持现状,与技法页同语义)。
	try{
		const oo = options && typeof options === 'object' ? options : {};
		const storedWs = (oo.extra && oo.extra.westSchool) || '';
		const ws = oo.westSchool || storedWs;
		// 齿轮换没换西方流派(顶层 westSchool 只由齿轮写):不换派时存档里手改过的宫制为准(不被流派宫制顶掉,与页面载入存档同)
		const wsChanged = !!(oo.westSchool && `${oo.westSchool}` !== `${storedWs || 'modern_main'}`);
		if(ws){
			// eslint-disable-next-line global-require
			const { schoolOf: electionSchoolOf } = require('../../divination/election/westernSchools');
			const sc = electionSchoolOf(ws);
			if(sc && sc.hsys !== null && sc.hsys !== undefined){
				const savedHsys = savedSettings && savedSettings.hsys !== undefined && savedSettings.hsys !== null && savedSettings.hsys !== '' ? savedSettings.hsys : undefined;
				chartRecord = { ...chartRecord, hsys: (!wsChanged && savedHsys !== undefined) ? savedHsys : sc.hsys };
			}
		}
	}catch(_e){
		// 流派表异常不阻断。
	}
	const chart = await fetchChartResultForRecord(chartRecord);
	if(!chart){
		return '';
	}
	try{
		// AI 挂载「每技法设置」:用事类别经 options.topicId 透传（缺省 marriage=现状）。
		const topicId = (options && typeof options === 'object' && options.topicId) ? options.topicId : 'marriage';
		// 西方子流派:齿轮「每技法设置」落顶层 options.westSchool;储存记录落 payload.extra.westSchool。
		// 两处都查(缺省 undefined → 引擎兜底现代主流 = 现状)。
		const westSchool = (options && typeof options === 'object'
			&& (options.westSchool || (options.extra && options.extra.westSchool))) || undefined;
		const pick = (k) => (options && typeof options === 'object'
			&& (options[k] !== undefined ? options[k] : (options.extra ? options.extra[k] : undefined))) || undefined;
		// 流派口径覆盖/买卖方向/护符主星/部位对宫随存档 extra 全量透传——
		// 缺任一键=挂载再生快照与页面判读口径分叉(静默丢),故与 ElectionJudgment 的 opts 面保持同集。
		// 流派口径 13 键:存档 extra.electionParams(对象)打底,齿轮 ep_* 扁平键覆盖(''=随流派不覆盖)。
		const epSaved = pick('electionParams');
		const epBase = { ...((epSaved && typeof epSaved === 'object') ? epSaved : {}) };
		const epFlat = {};
		ELECTION_PARAM_SPEC.forEach((sp)=>{
			const v = options && options['ep_' + sp.key];
			// 顶层 ep_* 只由齿轮写:'' = 选回「随流派」→ 去掉存档这一项(此前跳过 → 仍按存档值)
			if(v === ''){ delete epBase[sp.key]; return; }
			if(v !== undefined && v !== null){ epFlat[sp.key] = v; }
		});
		const electionParams = { ...epBase, ...epFlat };
		// 判读全局层与页面(ElectionJudgment:278)同构——缺此 spread 时 AI 再生的择日判读
		// (太阳三态/空亡/partile/恒星轨/映点)全部跌回引擎默认,与页面判读卡分叉。
		const { judgeLayerOverrides } = require('../judgeLayerOverrides');
		const j = runElection(chart, topicId, undefined, undefined, {
			westSchool, surgeryPart: pick('surgeryPart'), crisisBase: pick('crisisBase'),
			...judgeLayerOverrides(),
			electionParams: Object.keys(electionParams).length ? electionParams : undefined, tradeSide: pick('tradeSide'),
			talismanStar: pick('talismanStar'), surgeryPartOpposite: !!pick('surgeryPartOpposite'),
		});
		return j ? (buildElectionSnapshot(j) || '') : '';
	}catch(e){
		return '';
	}
}

// ===== P4 区间扫描：把单一目标时刻扩展为「from→to 按 step」的多时点列表 =====
// 守铁律「默认即现状」：endStr 空 或 step 非 y/m/d → 返回单点 [startStr || now]（与扫描前逐字节一致）。
// 仅当 endStr 非空且 step 合法时才循环；段数上限 SCAN_SEGMENT_CAP（防快照爆），超限截断并置 truncated。
export const SCAN_SEGMENT_CAP = 30;
// 今日（YYYY-MM-DD）——date 型扫描起点兜底（与 vedic/jaynes builder 内 today() 同口径，单点时不用它，仅多点起点空时兜底）。
// zone(盘所用时区)给了 = 按它换算的「今日」(推运类缺省目标日,与页面同一入口 DateTime.nowForChart);不给 = 本机今日(原样)
export function todayDateStr(zone){
	if(zone){ return DateTime.nowForChart(zone).format('YYYY-MM-DD'); }
	const d = new Date();
	return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}
export function buildDatetimeScanPoints(startStr, endStr, step, fmt, nowFallback){
	const start = `${startStr || ''}`.trim();
	const end = `${endStr || ''}`.trim();
	const stp = (step === 'y' || step === 'm' || step === 'd') ? step : '';
	// 单点（现状）：无终点 / 无步进。
	if(!end || !stp){
		return { points: [start || nowFallback()], truncated: false };
	}
	let startDt = null;
	let endDt = null;
	try{
		const startSeed = start || nowFallback();
		startDt = new DateTime().parse(`${startSeed}`, fmt);
		endDt = new DateTime().parse(`${end}`, fmt);
	}catch(e){
		startDt = null;
		endDt = null;
	}
	if(!startDt || !endDt || !Number.isFinite(Number(startDt.jdn)) || !Number.isFinite(Number(endDt.jdn))){
		// 解析失败 → 退回单点（不破坏现状、不抛）。
		return { points: [start || nowFallback()], truncated: false };
	}
	// 终点早于起点 → 退回单点（避免空/反向循环）。
	if(Number(endDt.jdn) < Number(startDt.jdn)){
		return { points: [start || nowFallback()], truncated: false };
	}
	const points = [];
	let truncated = false;
	const cur = startDt.clone();
	let guard = 0;
	while(Number(cur.jdn) <= Number(endDt.jdn) + 1e-9){
		points.push(cur.format(fmt));
		if(points.length >= SCAN_SEGMENT_CAP){
			// 还没到终点就到上限 → 截断标记。
			const peek = cur.clone();
			peek.add(1, stp);
			if(Number(peek.jdn) <= Number(endDt.jdn) + 1e-9){
				truncated = true;
			}
			break;
		}
		cur.add(1, stp);
		guard += 1;
		if(guard > 5000){ break; } // 终极防呆（步进异常时不死循环）。
	}
	if(points.length === 0){
		points.push(startDt.format(fmt));
	}
	return { points, truncated };
}
