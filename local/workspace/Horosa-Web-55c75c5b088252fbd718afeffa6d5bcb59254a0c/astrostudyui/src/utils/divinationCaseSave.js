// utils/divinationCaseSave.js
// 卜卦盘 / 择日盘「存为事件盘」+ 重开时读回 payload。
// 复用占星事件盘管道（astro/openDrawer caseadd → upsertLocalCase → user.currentCase），与六壬
// kentangCaseSave 同款；区别在于卜卦/择日的「时间·地点」本身就是核心征象，故 record 完整存
// divTime/zone/经纬，payload 再存技法设置（黄道/宫制/守护）与问题类别(horary)/用事类型(election)。
import { getStore } from './storageutil';
import { caseFieldSnapshot, caseGenderValue, caseApplySeqSuffix } from './kentangCaseSave';

function fv(fields, key, fallback = ''){
	if(!fields || !fields[key]){
		return fallback;
	}
	const v = fields[key].value;
	return v === undefined || v === null ? fallback : v;
}

function caseDateTime(fields){
	const d = fv(fields, 'date', null);
	const t = fv(fields, 'time', null);
	if(d && t && d.format && t.format){
		return `${d.format('YYYY-MM-DD')} ${t.format('HH:mm:ss')}`;
	}
	if(d && d.format){
		return d.format('YYYY-MM-DD HH:mm:ss');
	}
	return '';
}

// 存为事件盘。module: 'horary' | 'election'；extra 取自 Shell 的 state.extra（questionCategory / topicId）。
export function openDivinationCaseDrawer({ dispatch, fields, module, label, extra, aiSnapshot }){
	if(!dispatch || !module){
		return;
	}
	const divTime = caseDateTime(fields);
	const ex = extra || {};
	// 技法设置随案存档，重开还原，避免被全局默认覆盖。
	const settings = {
		zodiacal: fv(fields, 'zodiacal', 0),
		siderealAyanamsa: fv(fields, 'siderealAyanamsa', ''),
		hsys: fv(fields, 'hsys', 0),
		tradition: fv(fields, 'tradition', 1),
	};
	// 古典占星参数(界系/双子界序/交点真平/昼夜缓冲/狮子首星/三分集/福点反转)：present 才落档
	// (老案例结构零变),重开按保存时口径还原——卜卦流派绑定值/全局偏好双双保真。
	['termsVariant', 'geminiBoundEmended', 'westNodeType', 'sectBuffer', 'leoBoundFirst', 'triplicity', 'lotReversal',
		'lotsDocReverse', 'nodeExaltation', 'saturnExalt20',
		'houseCuspAdvance', 'cazimiOrb', 'combustOrb', 'underBeamsOrb', 'vocMode', 'vocIncludeOuter', 'fixedStarOrb', 'fixedStarOrbMode', 'antisciaOrb',
		'viaCombustaVariant'].forEach((k)=>{
		const v = fv(fields, k, undefined);
		if(v !== undefined && v !== null && v !== ''){ settings[k] = v; }
	});
	dispatch({
		type: 'astro/openDrawer',
		payload: {
			key: 'caseadd',
			record: {
				event: `${label || (module === 'tianxing' ? '天星择日' : (module === 'election' ? '择日' : '卜卦'))}${divTime ? ` ${divTime}` : ''}`,
				caseType: module,
				divTime,
				zone: fv(fields, 'zone'),
				lat: fv(fields, 'lat'),
				lon: fv(fields, 'lon'),
				gpsLat: fv(fields, 'gpsLat'),
				gpsLon: fv(fields, 'gpsLon'),
				pos: fv(fields, 'pos'),
				gender: caseGenderValue(fields),
				payload: {
					module,
					version: 1,
					savedAt: new Date().toISOString(),
					// 🔴 口径快照必带:载档时 applyCase 从 payload.fieldSnapshot 回灌日界点/晚子时/
					// 卦日界/时间算法;不带则沿用全局当前值 → 载回来的盘可能与存档不同。
					fieldSnapshot: caseFieldSnapshot(fields),
					settings,
					extra: ex,
					// 世俗盘(入宫盘)等 astro 类事盘存档时带上格式化 astro 快照 →
					// AI分析挂载直接读 payload.aiSnapshot(extractCaseSnapshotText 'ready'),不再退回 JSON 裸转。
					aiSnapshot: (aiSnapshot && `${aiSnapshot}`.trim()) ? `${aiSnapshot}` : undefined,
					questionCategory: ex.questionCategory || null,
					topicId: ex.topicId || null,
				},
				sourceModule: module,
			},
		},
	});
}

function parsePayload(raw){
	if(!raw){
		return null;
	}
	if(typeof raw === 'string'){
		try{
			return JSON.parse(raw);
		}catch(e){
			return null;
		}
	}
	if(typeof raw === 'object'){
		return raw;
	}
	return null;
}

// 重开：从 user.currentCase 拉回属于本技法的案例（含时间/地点 + 设置 + 类别）。
// 技法页用 caseVersion 判断是否是「新」的待应用案例（变了才应用，避免重复灌入）。
export function getDivinationSavedCasePayload(module){
	const store = getStore();
	const userState = store && store.user ? store.user : null;
	const cc = userState && userState.currentCase ? userState.currentCase : null;
	if(!cc || !cc.cid || !cc.cid.value){
		return null;
	}
	const getV = (k) => (cc[k] && cc[k].value !== undefined ? cc[k].value : null);
	const sourceModule = getV('sourceModule');
	const caseType = getV('caseType');
	const payload = parsePayload(getV('payload'));
	const payloadModule = payload && payload.module ? payload.module : null;
	if(sourceModule !== module && caseType !== module && payloadModule !== module){
		return null;
	}
	const cid = `${cc.cid.value}`;
	const updateTime = getV('updateTime') ? `${getV('updateTime')}` : '';
	// caseVersion 必带载入代次后缀(单一真值源 caseApplySeqSuffix,理由见其头注):
	// DivinationChartShell 的 _appliedCaseVersion 只在构造函数初始化、从不重置,宿主 Tabs 常驻挂载;
	// 不带代次时同一条事盘第二次载入必被守卫拦掉 —— 四技法(卜卦/择日/世俗/天星)曾因此漏网退化。
	return {
		payload,
		caseVersion: `${module}|${cid}|${updateTime}${caseApplySeqSuffix(userState)}`,
		divTime: getV('divTime') || '',
		zone: getV('zone') || '',
		lat: getV('lat') || '',
		lon: getV('lon') || '',
		gpsLat: getV('gpsLat'),
		gpsLon: getV('gpsLon'),
		pos: getV('pos') || '',
	};
}

export default openDivinationCaseDrawer;
