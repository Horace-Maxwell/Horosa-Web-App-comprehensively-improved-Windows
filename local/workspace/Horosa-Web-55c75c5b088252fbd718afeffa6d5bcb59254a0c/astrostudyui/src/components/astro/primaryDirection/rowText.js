// 主限法表 · 行数据与行文案:释义、星名、行类别判定、数据源转换、各类迫星 / 应星点的文案
// 从 AstroPrimaryDirection.js 按职责拆出的 AstroPrimaryDirection 方法:this 仍是 AstroPrimaryDirection 实例,门面里 mixinMethods(AstroPrimaryDirection, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText } from '../../../utils/planetHouseInfo';
import { buildMeaningTipByCategory } from '../AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning } from '../AstroMeaningPopover';
import { parsePdStarPointId, pdDisplayMethod, isPdExtensionPromissorId } from '../../../utils/primaryDirectionSync';
import { PD_ASPECT_GLYPHS, CORE_PD_SUPPORTED_BASE_IDS } from './rowLabels';

export const rowTextMethods = {
	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	},

	planetText(id){
		const base = AstroText.AstroMsg[id] ? AstroText.AstroMsg[id] : `${id || ''}`;
		const text = appendPlanetHouseInfoById(
			base,
			this.props.value,
			id,
			this.props.showPlanetHouseInfo
		);
		const one = splitPlanetHouseInfoText(text);
		const labelNode = (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
				{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
			</span>
		);
		return wrapWithMeaning(labelNode, this.showMeaning(), buildMeaningTipByCategory('planet', id));
	},

	isBoundRow(pd){
		if(!pd || !pd.length){
			return false;
		}
		const promittor = pd[1] ? `${pd[1]}` : '';
		const significator = pd[2] ? `${pd[2]}` : '';
		return promittor.indexOf('T_') === 0 || significator.indexOf('T_') === 0;
	},

	isAntisciaRow(pd){
		if(!pd || !pd.length){
			return false;
		}
		const promittor = pd[1] ? `${pd[1]}` : '';
		const significator = pd[2] ? `${pd[2]}` : '';
		return (
			promittor.indexOf('A_') === 0 || promittor.indexOf('C_') === 0 ||
			significator.indexOf('A_') === 0 || significator.indexOf('C_') === 0
		);
	},

	baseDirectionObjectId(text){
		const parts = `${text || ''}`.split('_');
		if(parts.length < 3){
			return `${text || ''}`;
		}
		return parts.slice(1, parts.length - 1).join('_').trim();
	},

	isExtensionRow(pd, appliedPdState){
		// 用户显式开启的扩展/平行行:按前缀与扩展体名放行(与引擎产出前缀一一对应)
		const prom = `${pd && pd[1] || ''}`;
		const sig = `${pd && pd[2] || ''}`;
		if(isPdExtensionPromissorId(prom)){ return true; }
		const st = appliedPdState || {};
		const sigKeys = Array.isArray(st.pdSignificators) ? st.pdSignificators : [];
		if(sigKeys.length){
			const sigBase = sig.split('_')[1] || '';
			if(sigKeys.indexOf('Syzygy') >= 0 && sigBase === 'Syzygy'){ return true; }
			if(sigKeys.indexOf('Spirit') >= 0 && sigBase === 'Spirit'){ return true; }
			if(sigKeys.indexOf('Cusps') >= 0 && /^Cusp\d+$/.test(sigBase)){ return true; }
			if(sigKeys.indexOf('Desc') >= 0 && sigBase === 'Desc'){ return true; }
			if(sigKeys.indexOf('IC') >= 0 && sigBase === 'IC'){ return true; }
			if(sigKeys.indexOf('Stars') >= 0 || sigKeys.indexOf('Lots') >= 0){
				// 恒星/阿点应星名不定长:非 core 白名单且被显式开启 → 放行
				if(sigBase && !/^(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)$/.test(sigBase)){ return true; }
			}
		}
		return false;
	},

	isCoreUnsupportedRow(pd){
		if(!pd || !pd.length){
			return false;
		}
		if(this.isBoundRow(pd)){
			return true;
		}
		const promBase = this.baseDirectionObjectId(pd[1]);
		const sigBase = this.baseDirectionObjectId(pd[2]);
		return !CORE_PD_SUPPORTED_BASE_IDS.has(promBase) || !CORE_PD_SUPPORTED_BASE_IDS.has(sigBase);
	},

	convertToDataSource(pds){
		let filterKeys = new Set();
		const showPdBounds = !(this.props.showPdBounds === 0 || this.props.showPdBounds === false);
		// 用户显式勾选「映点 / 界」后,core_alchabitius 也须显示对应行(纯公式核现已支持,
		// 不再像旧核那样恒滤——否则勾了开关却看不到任何变化)。
		const appliedPdState = this.getAppliedPdState();
		const appliedPdMethod = pdDisplayMethod(this.props.pdMethod, appliedPdState.pdProjection);
		const appliedAntiscia = appliedPdState.pdAntiscia === 1;
		const appliedTerms = appliedPdState.pdTerms === 1;
		const hideAntisciaRows = appliedPdMethod === 'core_alchabitius' && !appliedAntiscia;
		const hideUnsupportedCoreRows = appliedPdMethod === 'core_alchabitius';
		if(pds === undefined || pds === null){
			return {
				ds: [],
				filterKeys: filterKeys,
			};
		}
		// showPdBounds(显示界限法)只对 core_alchabitius 旧路径有意义(它恒算界限法、由此开关显隐)。
		// 新方位法的「界(T_)」行只在用户勾选 pdTerms 时才由引擎产出,故应直接显示,不再被 showPdBounds 隐藏
		// (否则用户勾了「界」却因 showPdBounds 关而看不到任何变化——映点同理由 pdAntiscia 控制、非 core 不隐藏)。
		const hideBoundRows = !showPdBounds && appliedPdMethod === 'core_alchabitius' && !appliedTerms;
		let res = [];
		for(let i=0; i<pds.length; i++){
			let pd = pds[i];
			// isCoreUnsupportedRow 把所有「界(T_)」行也判为 unsupported;用户勾选「界」后这些是
			// 合法行,须放行(否则 core_alchabitius 勾了界仍看不到 T_ 行)。
			// 🔴 扩展行放行:core 支持集是「历史默认体」白名单,用户显式勾选的扩展
			// (应星 Syzygy/Spirit/CuspN/恒星/阿点、迫星 HC_/FS_/LT_、平行 PD_/PC_/MP_/RP_)
			// 是引擎新算的合法行,被它误滤=勾了扩展表格恒 656 死不变(用户实锤三连)。
			if(hideUnsupportedCoreRows && this.isCoreUnsupportedRow(pd)
				&& !(appliedTerms && this.isBoundRow(pd))
				&& !this.isExtensionRow(pd, appliedPdState)){
				continue;
			}
			if(hideBoundRows && this.isBoundRow(pd)){
				continue;
			}
			if(hideAntisciaRows && this.isAntisciaRow(pd)){
				continue;
			}

			let data = {
				Seq: i,
				Degree: pd[0],
				Promittor: pd[1],
				Significator: pd[2],
				Cat: pd[3],
				Date: pd[4],
			}
			res.push(data);

			const promBase = this.baseDirectionObjectId(data.Promittor);
			const sigBase = this.baseDirectionObjectId(data.Significator);
			if(promBase){
				filterKeys.add(promBase);
			}
			if(sigBase){
				filterKeys.add(sigBase);
			}
		}
		return {
			ds: res,
			filterKeys: filterKeys
		};
	},

	T(parts){
		let dom = (
			<div>
				{this.planetText(parts[2])}&nbsp;的&nbsp;
				{this.planetText(parts[1])}&nbsp;界
			</div>
		);
		return dom;
	},

	A(parts){
		let dom = (
			<div>
				{this.planetText(parts[1])}&nbsp;的映点
			</div>
		);
		return dom;
	},

	C(parts){
		let dom = (
			<div>
				{this.planetText(parts[1])}&nbsp;的反映点
			</div>
		);
		return dom;
	},

	D(parts){
		// 类型融合:相位 glyph 织进语义文本(单行,「的」后度数前)
		let dom = (
			<div style={{whiteSpace: 'nowrap'}}>
				{this.planetText(parts[1])}&nbsp;的&nbsp;
				<span style={{opacity: 0.85}}>{PD_ASPECT_GLYPHS[Number(parts[2])] || ''}</span>
				<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度右相位处
			</div>
		);
		return dom;
	},

	S(parts){
		let dom = (
			<div style={{whiteSpace: 'nowrap'}}>
				{this.planetText(parts[1])}&nbsp;的&nbsp;
				<span style={{opacity: 0.85}}>{PD_ASPECT_GLYPHS[Number(parts[2])] || ''}</span>
				<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度左相位处
			</div>
		);
		return dom;
	},

	N(parts){
		let dom = (
			<div>
				{this.pdBodyText(parts[1])}&nbsp;
			</div>
		);
		if(parts[2] !== '0'){
			dom = (
				<div style={{whiteSpace: 'nowrap'}}>
					{this.planetText(parts[1])}&nbsp;的&nbsp;
					<span style={{opacity: 0.85}}>{PD_ASPECT_GLYPHS[Number(parts[2])] || ''}</span>
					<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度相位处
				</div>
			);
		}
		return dom;
	},

	convertText(text){
		let parts = text.split('_');
		let txt = text;
		if(parts[0] === 'T'){
			txt = this.T(parts);
		}else if(parts[0] === 'A'){
			txt = this.A(parts);
		}else if(parts[0] === 'C'){
			txt = this.C(parts);
		}else if(parts[0] === 'D'){
			txt = this.D(parts);
		}else if(parts[0] === 'S'){
			txt = this.S(parts);
		}else if(parts[0] === 'N'){
			txt = this.N(parts);
		}else if(parts[0] === 'PD'){
			txt = this.ParallelPoint(parts, '平行点');
		}else if(parts[0] === 'PC'){
			txt = this.ParallelPoint(parts, '反平行点');
		}else if(parts[0] === 'MP'){
			txt = this.MundaneParallel(parts, '世界平行');
		}else if(parts[0] === 'RP'){
			txt = this.MundaneParallel(parts, '急动平行');
		}else if(parsePdStarPointId(text)){
			txt = this.FixedStarPoint(text);
		}else if(parts[0] === 'LT'){
			txt = this.LotPoint(parts);
		}else if(parts[0] === 'HC'){
			txt = this.CuspPoint(parts);
		}
		return txt;
	},

	// ── 扩展点语义渲染(与既有 D/S/N 同风格;绝不裸 ID) ──
	ParallelPoint(parts, label){
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				{this.planetText(parts[1])}&nbsp;的{label}
			</div>
		);
	},

	MundaneParallel(parts, label){
		const axis = { '0': 'MC', '90': 'ASC', '180': 'IC', '270': 'DSC' }[parts[2]] || parts[2];
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				{this.planetText(parts[1])}&nbsp;的{label}·<span style={{fontFamily: AstroConst.NormalFont}}>{axis}</span>
			</div>
		);
	},

	FixedStarPoint(id){
		const sp = parsePdStarPointId(id);
		const hand = sp.head === 'D' ? '右' : (sp.head === 'S' ? '左' : '');
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				恒星·<span style={{fontFamily: AstroConst.NormalFont}}>{sp.name}</span>
				{sp.deg ? <span>&nbsp;的{sp.deg}度{hand}相位处</span> : null}
			</div>
		);
	},

	LotPoint(parts){
		const name = `${parts[1] || ''}`.replace(/^Pars /, '');
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				<span style={{fontFamily: AstroConst.NormalFont}}>{name}</span>&nbsp;点
			</div>
		);
	},

	CuspPoint(parts){
		const m = /^Cusp(\d+)$/.exec(`${parts[1] || ''}`);
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				第&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>{m ? m[1] : parts[1]}</span>&nbsp;宫头
			</div>
		);
	},

	// 应星侧扩展 body 语义(N_Syzygy_0/N_Spirit_0/N_CuspN_0/N_<Star|Pars X>_0)
	pdBodyText(name){
		const n = `${name || ''}`;
		if(n === 'Syzygy'){ return <span>产前朔望</span>; }
		if(n === 'Spirit'){ return <span>精神点</span>; }
		const mc = /^Cusp(\d+)$/.exec(n);
		if(mc){ return <span>第 {mc[1]} 宫头</span>; }
		if(/^Pars /.test(n) && n !== 'Pars Fortuna'){ return <span>{n.replace(/^Pars /, '')} 点</span>; }
		return this.planetText(n);
	},
};
