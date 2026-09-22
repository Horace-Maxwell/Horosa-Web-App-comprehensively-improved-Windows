// [#80] 推运(progressions)AI 快照单一真值源。
//
// 由来:`/astroextra/progressions` 一直只有**恒星黄道**那一支(vedicprog)能挂给 AI,
// 页面上主流的**回归黄道**二次/三次/小推运(AstroProgressions.js)从来没有技法键 ——
// 用户问「西占的行运推运呢」时,AI 手上确实一个字都没有。两支的差别只有一个 `zodiacal`
// 参数与三处文案,故抽同一个 builder 按 variant 出文,免得日后两支各自漂移。
//
// 恒星支输出与抽取前逐字相同(variant 表复刻原字面);回归支为新增。
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroText from '../../constants/AstroText';
import { unwrapResult, fmtDegree, fmtNum, chartParams } from './AstroExtraCommon';
import { buildStarAndLotPositionLines, buildHouseCuspLines, buildPredictiveBirthLines, buildCurrentMomentLines, buildMethodNoteLines, } from '../../utils/astroAiSnapshot';
import { MINOR_VARIANT_LABEL } from './AstroProgChart';

function today(){
	const dt = new Date();
	return `${dt.getFullYear()}-${`${dt.getMonth() + 1}`.padStart(2, '0')}-${`${dt.getDate()}`.padStart(2, '0')}`;
}

const EVENT_POINTS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Asc', 'MC'];

// [YB v42] 补厚 helper 容错:个别测试套件整模块 mock astroAiSnapshot 且只保留部分导出,
// 缺失导出经 import 拿到 undefined → 直接调用会炸掉整个 builder;生产环境恒为函数,此守卫零行为差。
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);

function methodTab(method){
	return method.method === 'secondary' ? '二次推运' : (method.method === 'tertiary' ? '三次推运' : '小推运');
}

// zodiacal:1 = 恒星黄道强制;回归支**不下发该键**,由 chartParams 透传盘自身黄道 ——
// 与 AstroProgressions.js 页面 load() 的请求体逐字同形(页面同样只透传不覆盖)。
// 故本命是恒星盘时回归支实算亦为恒星:这是与页面一致的既有语义,不在此处另立一套。
export const PROG_SNAPSHOT_VARIANTS = {
	vedicprog: {
		zodiacal: 1,
		section: '恒星推运（Vedic Sidereal）',
		// [Q-176/T-116b] 「截至今日」写死,而紧接的下一行就是非今日的「目标日期」→ 改成中性说法。
		intro: '二次/三次/小限推运在恒星黄道（sidereal）下计算；下表为二次推运，推至下方所列目标日期。',
		posCol: '恒星推运位置',
	},
	prog: {
		zodiacal: null,
		section: '二次推运（回归黄道）',
		intro: '二次/三次/小限推运在回归黄道（tropical）下计算；下表为二次推运，推至下方所列目标日期。',
		posCol: '推运位置',
	},
};

// 推运 AI 快照(无头):内部 fetch /astroextra/progressions,与组件同口径。无数据返回 ''。
// opts:targetDate + targetTime(目标时刻)+ minorVariant(小推运月长,缺省 synodic=标准朔望月 [Q-180])。
export async function buildProgSnapshotText(chartObj, opts, variantKey){
	const variant = PROG_SNAPSHOT_VARIANTS[`${variantKey || ''}`];
	if(!chartObj || !variant){ return ''; }
	const o = opts && typeof opts === 'object' ? opts : {};
	const targetDate = `${o.targetDate || ''}`.trim() || today();
	const targetTime = `${o.targetTime || ''}`.trim() || '12:00:00';
	const minorVariant = `${o.minorVariant || ''}`.trim() || 'synodic';
	let result = null;
	try{
		const body = {
			...chartParams(chartObj),
			...(variant.zodiacal ? { zodiacal: variant.zodiacal } : {}),
			targetDate,
			targetTime,
			minorVariant,
			orb: 1.5,
		};
		const data = await request(`${Constants.ServerRoot}/astroextra/progressions`, {
			body: JSON.stringify(body),
			timeoutMs: 45000,
		});
		result = unwrapResult(data) || {};
	}catch(e){
		return '';
	}
	const methods = (result && Array.isArray(result.methods)) ? result.methods : [];
	const secondary = methods.find((m) => m.method === 'secondary') || methods[0];
	if(!secondary || !Array.isArray(secondary.positions) || secondary.positions.length === 0){ return ''; }
	const sym = (id) => (AstroText.AstroTxtMsg[id] || `${id}`);
	const lines = [];
	lines.push(`[${variant.section}]`);
	lines.push(variant.intro);
	// 目标日期与推运时刻的映射必须写明(推运法本义:目标日期折算成推运时刻;只写派生时刻会被误读为没吃目标日期)。
	lines.push(`目标日期：${targetDate} ${targetTime}（各法推运时刻=按该法折算，见各小节）`);
	const natalStars = buildStarAndLotPositionLines(chartObj);
	const natalHouses = buildHouseCuspLines(chartObj);
	// [YB v42] 生辰行并入既有 [本命盘配置] 段头部(裸行版,不新开段;无生辰数据 → 输出与现状逐字一致)。
	const natalBirth = safeHelperLines(buildPredictiveBirthLines, chartObj);
	if(natalStars.length || natalHouses.length || natalBirth.length){
		lines.push('');
		lines.push('[本命盘配置]');
		if(natalBirth.length){ lines.push(...natalBirth); }
		if(natalStars.length){ lines.push('星与虚点'); lines.push(...natalStars); }
		if(natalHouses.length){ lines.push('宫位宫头'); lines.push(...natalHouses); }
	}
	lines.push('');
	lines.push('[时段盘配置 二次推运位置]');
	lines.push(`| 点 | ${variant.posCol} |`);
	lines.push('| --- | --- |');
	secondary.positions.filter((p) => EVENT_POINTS.indexOf(p.id) >= 0).forEach((p) => {
		lines.push(`| ${sym(p.id)} | ${fmtDegree(p)} |`);
	});
	// [YB v42] UI 有 二次/三次/小推运 三法 Tab + 与本命相位表,此前导出只有二次推运位置一张表。
	// 单次 fetch 已带回全部三法(与组件同一接口同一回包),零额外成本 → 三法全量各出小节,
	// 段内纯增(◆ 子题并入既有 [时段盘配置 二次推运位置] 段,既有二次推运表逐字不动)。
	const aspTxt = (v) => (AstroText.AstroTxtMsg[`Asp${fmtNum(v, 0)}`] || `${fmtNum(v, 0)}°`);
	const pushMethodBlocks = (m, withPositions) => {
		if(!m){ return; }
		const label = methodTab(m);
		const when = m.progressedDate && m.progressedDate.datetime ? m.progressedDate.datetime : '';
		if(withPositions && Array.isArray(m.positions) && m.positions.length){
			lines.push('');
			lines.push(`◆ ${label} 推运位置`);
			if(when){ lines.push(`推运时刻：${when}`); }
			// [Q-180] 小推运写明所用月长档(此前三法全出却不写档,AI 无从分辨「引擎历史值≈无推进」与标准朔望月)。
			if(m.method === 'minor'){ lines.push(`月长算法：${MINOR_VARIANT_LABEL[minorVariant] || minorVariant}`); }
			lines.push(`| 点 | ${variant.posCol} | 速度 |`);
			lines.push('| --- | --- | --- |');
			m.positions.filter((p) => EVENT_POINTS.indexOf(p.id) >= 0).forEach((p) => {
				lines.push(`| ${sym(p.id)} | ${fmtDegree(p)} | ${fmtNum(p.lonspeed, 4)} |`);
			});
		}
		if(Array.isArray(m.aspectsToNatal) && m.aspectsToNatal.length){
			lines.push('');
			lines.push(`◆ ${label} 与本命相位`);
			lines.push('| 推运点 | 相位 | 本命点 | 误差 |');
			lines.push('| --- | --- | --- | --- |');
			m.aspectsToNatal.slice(0, 120).forEach((p) => {
				lines.push(`| ${sym(p.a)} | ${aspTxt(p.aspect)} | ${sym(p.b)} | ${fmtNum(p.orb, 3)} |`);
			});
		}
	};
	pushMethodBlocks(secondary, false);
	methods.forEach((m) => { if(m && m !== secondary){ pushMethodBlocks(m, true); } });
	// [YB v42] 尾部补 [当前时点]/[方法说明](共享 helper;段头已登 preset)。
	lines.push('');
	lines.push(...safeHelperLines(buildCurrentMomentLines, chartObj));
	lines.push(...safeHelperLines(buildMethodNoteLines, variantKey));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

export function buildVedicProgSnapshotText(chartObj, opts){
	return buildProgSnapshotText(chartObj, opts, 'vedicprog');
}

// [#80] 回归黄道二次推运(西占主流行运):此前只有页面、没有技法键,AI 挂不到。
export function buildTropicalProgSnapshotText(chartObj, opts){
	return buildProgSnapshotText(chartObj, opts, 'prog');
}
