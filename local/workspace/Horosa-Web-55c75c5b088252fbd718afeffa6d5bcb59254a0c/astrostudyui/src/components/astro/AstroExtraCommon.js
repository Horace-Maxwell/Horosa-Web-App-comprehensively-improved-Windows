import * as AstroText from '../../constants/AstroText';
import { classicalBackendOverridesFromPlain } from '../../utils/classicalChartGlobals';
import * as AstroConst from '../../constants/AstroConst';
import { buildMeaningTipByCategory } from './AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning } from './AstroMeaningPopover';

export function unwrapResult(data){
	return data && data.Result ? data.Result : data;
}

// 字形 + 富「悬浮释义」弹窗（gated showAstroMeaning），供新推运技法与既有技法同步 hover 释义。
export function symbolWithMeaning(id, showAstroMeaning, category = 'planet'){
	return wrapWithMeaning(astroSymbol(id), isMeaningEnabled(showAstroMeaning), buildMeaningTipByCategory(category, id));
}

export function planetName(id){
	return (AstroText.AstroMsg && AstroText.AstroMsg[id]) || (AstroText.AstroTxtMsg && AstroText.AstroTxtMsg[id]) || id || '-';
}

export const astroSymbolStyle = {
	fontFamily: AstroConst.AstroFont,
	fontSize: '1.1em',
	lineHeight: 1,
	display: 'inline-block',
};

function isGlyphCode(value){
	if(value === undefined || value === null){
		return false;
	}
	const text = `${value}`;
	if(text.length !== 1){
		return false;
	}
	return /^[A-Za-z0-9{}$]$/.test(text);
}

export function astroSymbol(id){
	const glyph = (AstroText.AstroMsg && AstroText.AstroMsg[id]) || (isGlyphCode(id) ? `${id}` : '');
	const title = (AstroText.AstroTxtMsg && AstroText.AstroTxtMsg[id]) || (AstroText.AstroMsgCN && AstroText.AstroMsgCN[id]) || `${id || ''}`;
	if(!glyph){
		return title || '-';
	}
	return <span style={astroSymbolStyle} title={title}>{glyph}</span>;
}

export function astroSymbolList(ids, separator = ' / '){
	const items = ids || [];
	if(!items.length){
		return '-';
	}
	const parts = [];
	items.forEach((id, idx)=>{
		if(idx > 0){
			parts.push(<span key={`sep-${idx}`}>{separator}</span>);
		}
		parts.push(<span key={`${id}-${idx}`}>{astroSymbol(id)}</span>);
	});
	return parts;
}

export function signName(id){
	return (AstroText.AstroTxtMsg && AstroText.AstroTxtMsg[id]) || (AstroText.AstroMsg && AstroText.AstroMsg[id]) || id || '-';
}

export function fmtNum(value, digits = 2){
	const num = Number(value);
	if(!Number.isFinite(num)){
		return '-';
	}
	return num.toFixed(digits);
}

export function fmtDegree(item){
	if(!item){
		return '-';
	}
	const sign = signName(item.sign);
	const signlon = item.signlon !== undefined ? item.signlon : (Number(item.lon) % 30);
	return `${sign} ${fmtNum(signlon, 2)}°`;
}

export function chartParams(chartObj){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const birth = params.birth || '';
	const parts = birth.split(' ');
	return {
		date: params.date || parts[0],
		time: params.time || parts[1] || '12:00:00',
		ad: params.ad || 1,
		zone: params.zone || '+00:00',
		lat: params.lat || '0n00',
		lon: params.lon || '0e00',
		hsys: params.hsys !== undefined ? params.hsys : 0,
		zodiacal: params.zodiacal !== undefined ? params.zodiacal : 0,
		siderealAyanamsa: params.siderealAyanamsa !== undefined ? params.siderealAyanamsa : '',
		tradition: false,
		predictive: false,
		orbs: params.orbs,
		orbScale: params.orbScale,
		// 界系(bounds)随本命盘透传:本命 params.termsVariant 非 0 才带(默认埃及 不下发=零回归)。
		...(params.termsVariant ? { termsVariant: params.termsVariant } : {}),
		// 双子界序(仅经典传本受影响):同款条件透传。
		...(params.geminiBoundEmended ? { geminiBoundEmended: 1 } : {}),
		// 古典占星参数随本命盘透传(三分集/福点反转/界系/交点真平/宗派缓冲/狮子木首):本命非默认才带,与主盘 fieldsToParams 同口径,默认不下发=零回归。
		...(params.westNodeType === 'true' ? { westNodeType: 'true' } : {}),
		...(params.sectBuffer === 'ptolemy5' ? { sectBuffer: 'ptolemy5' } : {}),
		...((params.leoBoundFirst === 1 || params.leoBoundFirst === '1') ? { leoBoundFirst: 1 } : {}),
		...((params.triplicity && params.triplicity !== 'Dorothean') ? { triplicity: params.triplicity } : {}),
		...((params.lotReversal === 0 || params.lotReversal === '0') ? { lotReversal: 0 } : {}),
		// 2026-07 二批九键:共享 helper(平面版)条件透传。
		...classicalBackendOverridesFromPlain(params),
	};
}

// 失败泊车(2026-07-12 实案 第二路径):load 失败时绝不把 key 记成「已完成」——那会让表(props 已新)
// 与盘(state 旧)永久分叉且永不重试;但失败后立即无限重试又会死循环(didUpdate→load→catch→setState→didUpdate)。
// 语义:失败记 (key, 时刻),同 key 在窗口期内不自动重试;新 key(改日期/换盘)立即放行;窗口期过后
// 下一次更新自然重试;成功后 clear。宿主组件在 componentDidUpdate/ensureLoaded 的重载条件里并入 !loadParked。
export const LOAD_RETRY_PARK_MS = 15000;
export function parkLoadFailure(inst, key){ inst._loadFailKey = key; inst._loadFailAt = Date.now(); }
export function clearLoadFailure(inst){ inst._loadFailKey = null; inst._loadFailAt = 0; }
export function loadParked(inst, key){
	return !!(key && inst._loadFailKey === key && inst._loadFailAt && (Date.now() - inst._loadFailAt) < LOAD_RETRY_PARK_MS);
}

export function chartRequestKey(chartObj, extra = ''){
	if(!chartObj){
		return '';
	}
	const params = chartObj.params || {};
	const parts = [
		params.birth || '',
		params.date || '',
		params.time || '',
		params.zone || '',
		params.lat || '',
		params.lon || '',
		params.hsys !== undefined ? params.hsys : '',
		params.zodiacal !== undefined ? params.zodiacal : '',
		params.siderealAyanamsa !== undefined ? params.siderealAyanamsa : '',
		params.orbScale !== undefined ? params.orbScale : '',
		params.orbs ? JSON.stringify(params.orbs) : '',
		// 古典占星参数纳入缓存键:改三分/界/福点反转等后派生盘(调波/龙盘)须重取,不能命中旧缓存。
		params.termsVariant || '',
		params.triplicity || '',
		(params.lotReversal === 0 || params.lotReversal === '0') ? '0' : '',
		params.westNodeType === 'true' ? 'true' : '',
		params.sectBuffer === 'ptolemy5' ? 'ptolemy5' : '',
		(params.leoBoundFirst === 1 || params.leoBoundFirst === '1') ? '1' : '',
		extra,
	];
	return parts.join('|');
}

export function paramsRequestKey(params){
	if(!params){
		return '';
	}
	try{
		return JSON.stringify(params);
	}catch(e){
		return `${params}`;
	}
}

// [观象统一] 星历附卡对齐七政金标(原中性灰蓝 rgba(148,163,184,.28)/8radius →
//   主题金丝边 var(--horosa-border)/6radius/中性面 var(--horosa-surface-solid));
//   为 21 处星历附加面板(辅盘谐波/龙盘/换置等)共享,一处齐平全族与全 App 卡一致。
export const cardStyle = {
	border: '1px solid var(--horosa-border, rgba(215, 173, 105, .16))',
	borderRadius: 6,
	padding: 12,
	marginBottom: 12,
	background: 'var(--horosa-surface-solid, rgba(255,255,255,.72))',
};

export const gridStyle = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
	gap: 8,
};

// rowStyle(row, idx)→style 与 rowRef(node, row, idx) 均为可选；不传时行为与旧版逐字一致。
// 供「当前时刻高亮 + 锚点行定位」等场景按行注入样式/捕获 DOM 节点（如波斯向运应期长表）。
// scrollX（可选）：宽表专用——外包横滚容器且表**不写 width:100%**。
// 🔴 为什么必须两件一起做:原生 table 的 width:100% 在 auto layout 下压不到 min-content 以下,
// 列一多就撑破容器,再撞上右栏的 overflow-x:hidden 就被直接裁字(埃及旬名录实测「Chenlacho…」
// 被切、「旬位」列被压成逐字竖排)。缺省不传=旧行为逐字节不变(全站 41+ 处窄表靠 100% 撑满)。
export function SmallTable({columns, rows, rowKey, rowStyle, rowRef, scrollX}){
	const table = (
		<table style={scrollX ? {borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap'} : {width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
			<thead>
				<tr>
					{columns.map((col)=>(
						<th key={col.key} style={{textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,.35)', padding: '6px 4px'}}>
							{col.title}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{(rows || []).map((row, idx)=>(
					<tr key={rowKey ? rowKey(row, idx) : idx}
						ref={rowRef ? (node)=>rowRef(node, row, idx) : undefined}
						style={rowStyle ? rowStyle(row, idx) : undefined}>
						{columns.map((col)=>(
							<td key={col.key} style={{borderBottom: '1px solid rgba(148,163,184,.16)', padding: '6px 4px', verticalAlign: 'top'}}>
								{col.render ? col.render(row[col.key], row, idx) : row[col.key]}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
	return scrollX ? <div style={{overflowX: 'auto', maxWidth: '100%'}}>{table}</div> : table;
}
