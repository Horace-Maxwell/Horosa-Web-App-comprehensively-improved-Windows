// 主限法表 · 应星极点取数与行内透镜(请求体 / 键 / 签名、取点、坐标文本、浮层)
// 从 AstroPrimaryDirection.js 按职责拆出的 AstroPrimaryDirection 方法:this 仍是 AstroPrimaryDirection 实例,门面里 mixinMethods(AstroPrimaryDirection, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { fetchPdPoles } from '../../../services/astroPd3d';
import { fetchPd3D } from '../../../services/astroPd3d';
import { Popover } from 'antd';
import { pdExtraRequestParams } from '../../../utils/primaryDirectionSync';
import { toSlashDate } from '../../../utils/dateStrSafe';
import { pickKeyedDerived } from '../../../utils/derivedChartSource';

export const lensMethods = {
	// Pole 列请求体(盘 + 投影 + 定局 + S 集):既是请求,也是结果的来源键(结果只在键一致时用)
	pdPolesRequestBody(){
		const chart = this.props.value || {};
		const params = chart.params || {};
		if(!params.birth){ return null; }
		const applied = this.getAppliedPdState();
		const birthParts = `${params.birth}`.split(' ');
		const body = {
			date: birthParts[0], time: birthParts[1] || '00:00:00',
			ad: params.ad ? params.ad : 1, zone: params.zone,
			lat: params.lat, lon: params.lon, gpsLat: params.gpsLat, gpsLon: params.gpsLon,
			hsys: params.hsys, zodiacal: params.zodiacal, siderealAyanamsa: params.siderealAyanamsa,
			pdProjection: applied.pdProjection, pdFrame: applied.pdFrame,
			pdtype: applied.pdtype,
			...(Array.isArray(params.pdSignificators) && params.pdSignificators.length ? { pdSignificators: params.pdSignificators } : {}),
			// 点表设置项(真位置 / 忽略应星黄纬)改变应星位置 → 极点跟着变
			...pdExtraRequestParams(applied.pdExtra),
		};
		return body;
	},

	pdPolesRequestKey(){
		const body = this.pdPolesRequestBody();
		return body ? JSON.stringify(body) : '';
	},

	// 出自当前请求键的极点表才用:换盘 / 改投影后旧极点表作废(此前只要有过一份就不再取 → 一直显示上一张盘的极点)
	shownPdPolesData(){
		return pickKeyedDerived(this.state.pdPolesData, this.state.pdPolesDataSig, this.pdPolesRequestKey());
	},

	requestPdPoles(){
		// Pole 列:极点随 (盘,投影,S 集) 变;按组合键去重,列开着才取。
		const body = this.pdPolesRequestBody();
		if(!body){ return; }
		const key = JSON.stringify(body);
		if(this.pdPolesKey === key){ return; }
		this.pdPolesKey = key;
		fetchPdPoles(body).then((res)=>{
			if(this.pdPolesKey !== key){ return; }
			const poles = res && res.poles ? res.poles : (res && res.data && res.data.poles ? res.data.poles : null);
			this.setState({ pdPolesData: poles || {}, pdPolesDataSig: key });
		}).catch(()=>{
			if(this.pdPolesKey === key){ this.setState({ pdPolesData: {}, pdPolesDataSig: key }); }
		});
	},

	// pd3d 调试透镜:首次 hover 懒拉一次 pd3d(与主限天球同引擎同参),Popover 显示
	// 该行迫星/应星的引擎坐标(λ/β/α/δ 双口径)。失败静默(透镜是调试辅助,不打扰主表)。
	// 透镜坐标必须跟着「这张盘 + 这套设置」走(本组件换盘不重挂载):签名 = 请求本身,一变即作废重拉。
	// 请求优先用宿主的构参函数(buildRequest = AstroDirectMain.buildPrimaryDirectionRequest,与主限天球、
	// /predict/pd 同一个,与天球同参还直接命中 pd3d 缓存);独立挂载时按已应用设置自拼全套键。
	// 曾手拼一份漏了应星 / 迫星扩展与投影定局,恒星等扩展迫星一律「引擎点表无此 id」。
	// 同一份 props 只构一次(每行渲染都要读签名)。
	lensRequest(){
		if(this._lensReqProps !== this.props){
			this._lensReqProps = this.props;
			this._lensReq = this.buildLensRequest();
			this._lensReqSig = this._lensReq ? JSON.stringify(this._lensReq) : '';
		}
		return this._lensReq;
	},

	buildLensRequest(){
		const chart = this.props.value || {};
		if(typeof this.props.buildRequest === 'function'){
			return this.props.buildRequest(chart) || null;
		}
		const p = chart.params || {};
		if(!p.birth && !p.date){ return null; }
		const a = this.getAppliedPdState();
		const birthParts = `${p.birth || ''}`.trim().split(/\s+/);
		return {
			date: (p.date || toSlashDate(birthParts[0] || '')),
			time: (p.time || birthParts[1] || '12:00:00'),
			ad: p.ad !== undefined ? p.ad : 1,
			zone: p.zone, lat: p.lat, lon: p.lon, gpsLat: p.gpsLat, gpsLon: p.gpsLon,
			hsys: p.hsys !== undefined ? p.hsys : 0, southchart: p.southchart || 0,
			zodiacal: p.zodiacal || 0, siderealAyanamsa: p.siderealAyanamsa || '',
			tradition: 0, predictive: true, includePrimaryDirection: true,
			showPdBounds: 1,
			pdtype: a.pdtype, pdMethod: a.pdMethod, pdTimeKey: a.pdTimeKey, pdYears: a.pdYears,
			pdDirect: 1, pdConverse: 1,
			pdAntiscia: a.pdAntiscia, pdTerms: a.pdTerms,
			pdProjection: a.pdProjection, pdFrame: a.pdFrame, pdFramework: a.pdFramework,
			pdParallel: a.pdParallel, pdRaptParallel: a.pdRaptParallel,
			...(a.pdTimeKeyCustom ? { pdTimeKeyCustom: a.pdTimeKeyCustom } : {}),
			...(Array.isArray(a.pdSignificators) && a.pdSignificators.length ? { pdSignificators: a.pdSignificators } : {}),
			...(Array.isArray(a.pdPromissorTypes) && a.pdPromissorTypes.length ? { pdPromissorTypes: a.pdPromissorTypes } : {}),
			...pdExtraRequestParams(a.pdExtra),
			termsVariant: a.termsVariant,
			pdaspects: [0, 60, 90, 120, 180],
		};
	},

	lensSignature(){
		this.lensRequest();
		return this._lensReqSig;
	},

	ensureLensPoints(){
		const req = this.lensRequest();
		const sig = this._lensReqSig;
		if(this._lensSig !== sig){
			// 盘或设置换了:作废旧坐标(并让在途请求的回包按签名自弃),下面重新拉一次。
			this._lensSig = sig;
			this._lensLoading = false;
			// 旧坐标由 shownLensPoints 按签名自动作废(不必再清 state)
		}
		if(!req || this._lensLoading || this.shownLensPoints()){ return; }
		this._lensLoading = true;
		const reqSig = this._lensSig;
		fetchPd3D(req).then((res)=>{
			if(this._lensSig !== reqSig){ return; }   // 回包晚于换盘 → 丢弃(否则新盘又被旧坐标盖住)
			this._lensLoading = false;
			const r = res && (res.Result || res);
			if(r && r.points){ this.setState({ lensPoints: r.points, lensPointsSig: reqSig }); }
		}).catch(()=>{ if(this._lensSig === reqSig){ this._lensLoading = false; } });
	},

	// 透镜坐标只用出自当前盘参签名的那份
	shownLensPoints(){
		return pickKeyedDerived(this.state.lensPoints, this.state.lensPointsSig, this.lensSignature());
	},

	lensCoordText(id){
		const pts = this.shownLensPoints() || null;
		const pt = pts && pts[id];
		if(!pt){ return pts ? '(引擎点表无此 id)' : '坐标载入中…(hover 稍候)'; }
		const f = (v)=>{ const d = Math.floor(Math.abs(v)); const mn = Math.round((Math.abs(v) - d) * 60); return `${v < 0 ? '-' : ''}${d}°${mn < 10 ? '0' : ''}${mn}′`; };
		return `λ=${f(((Number(pt.lon) % 360) + 360) % 360)} β=${f(Number(pt.lat) || 0)} · α=${f(Number(pt.ra))} δ=${f(Number(pt.decl))}${Number.isFinite(Number(pt.raZ)) ? ` · 投影α=${f(Number(pt.raZ))} δ=${f(Number(pt.declZ))}` : ''}`;
	},

	renderLensPopover(text, record){
		return (
			<Popover trigger="hover" mouseEnterDelay={0.35}
				onOpenChange={(open)=>{ if(open){ this.ensureLensPoints(); } }}
				content={
					<div style={{ fontSize: 12, lineHeight: 1.8, maxWidth: 380 }}>
						<div><b>迫星</b> {this.convertText(record.Promittor)}：{this.lensCoordText(record.Promittor)}</div>
						<div><b>应星</b> {this.convertText(record.Significator)}：{this.lensCoordText(record.Significator)}</div>
						<div style={{ color: 'var(--horosa-text-secondary)' }}>引擎坐标与主限天球/表格同源(pd3d);λβ=黄道 αδ=赤道,投影=β取0。</div>
					</div>
				}>
				<span style={{ cursor: 'help' }}>{this.convertText(text)}</span>
			</Popover>
		);
	},
};
