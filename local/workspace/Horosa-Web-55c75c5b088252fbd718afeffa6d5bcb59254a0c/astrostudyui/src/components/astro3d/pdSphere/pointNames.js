// 主限天球 · 点位命名:恒星本体集、点位短名 / 字形、相位度数、点的本体 ID
// 从 PDSphereEngine.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroText from '../../../constants/AstroText';

/** 本盘的恒星本体名(FS_/FSD_/FSS_ 迫星与 kind=star 的点):名牌一律保英文名,与表格 / 时间轴同源 */
export function pdStarBaseIds(points){
	const out = new Set();
	Object.keys(points || {}).forEach((pid)=>{
		const pt = points[pid] || {};
		if(/^FS[DS]?_/.test(pid) || pt.kind === 'star'){
			out.add(basePointIdOf(pid));
		}
	});
	return out;
}

/** 点位短名(名牌用):行星走 ywastrochart 字形(与 2D/3D 盘同源),宫/无字形词条回退中文;
 *  恒星(starBases 里的名字)保英文名 —— 字形表里只有部分恒星有三字以内的中文名,不分开会中英混排 */
export function pointGlyphOf(baseId, starBases){
	const b = `${baseId}`;
	if(starBases && starBases.has(b)){
		return { text: b, astroFont: false };
	}
	if(b.indexOf('House') === 0){
		return { text: `${b.slice(5)}宫`, astroFont: false };
	}
	// S/P 扩展体短标(与表格语义同源):中间宫头「N宫」/朔望·精神点/阿拉伯点去 Pars 前缀(中文优先)
	const mCusp = /^Cusp(\d+)$/.exec(b);
	if(mCusp){
		return { text: `${mCusp[1]}宫`, astroFont: false };
	}
	if(b === 'Syzygy'){
		return { text: '朔望', astroFont: false };
	}
	if(b === 'Spirit'){
		return { text: '精神点', astroFont: false };
	}
	if(b.indexOf('Pars ') === 0){
		const cnLot = AstroText.AstroMsgCN[b];
		return { text: cnLot ? `${cnLot}` : b.slice(5), astroFont: false };
	}
	const glyph = AstroText.AstroMsg[baseId];
	if(glyph !== undefined && glyph !== null && `${glyph}`.length <= 3){
		return { text: `${glyph}`, astroFont: true };
	}
	const cn = AstroText.AstroMsgCN[baseId];
	return { text: cn ? `${cn}` : `${baseId}`, astroFont: false };
}

/** 相位度数(D/S/N_x_120 → '120°';0=合相;非相位形态 → null) —— 连线中点标注用 */
export function aspectDegOf(pid){
	const m = /^[DSN]_.+_(\d+)$/.exec(`${pid || ''}`);
	if(!m){
		return null;
	}
	return m[1] === '0' ? '合' : `${m[1]}°`;
}

/** 点位 id 的本体(N_Sun_0 → Sun;T_Venus_Aries → Venus;A/C_x → x) —— 取色/字形用 */
export function basePointIdOf(pid){
	const parts = `${pid || ''}`.split('_');
	if(parts.length < 2){
		return `${pid || ''}`.trim();
	}
	if(parts[0] === 'T'){
		return `${parts[1] || ''}`.trim();
	}
	if(parts.length === 2 && (parts[0] === 'A' || parts[0] === 'C')){
		return parts[1];
	}
	return parts.slice(1, parts.length - 1).join('_').trim();
}
