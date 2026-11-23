// 印占页 · 卜卦(KP / 帕拉沙拉 / Tajika 卡)、出生时间校正(扫描与抽屉)、KP 择时
// 从 IndiaChartMain.js 按职责拆出的 IndiaChartMain 方法:this 仍是 IndiaChartMain 实例,门面里 mixinMethods(IndiaChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { fieldsToParams } from '../IndiaChart';
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import * as AstroConst from '../../../constants/AstroConst';
import { XQSelect as Select, XQInputNumber as InputNumber, XQDrawer } from '../../xq-ui';
import { confirmDialog } from '../../../utils/confirmDialog';
import { getJyotish, formatDegree, resolveJyotishChartObj, prashnaYogaNames, prashnaHigherYogaText, pakshaLabel, jyotishPartialNotice, isKpMuhurtaPartialName } from './jyotishData';
const { Option } = Select;

export const prashnaPanelMethods = {
	// [问事 Praśna · tab 14] KP 问时(1-249)+ Parāśarī + Tājika 三分区(§12.7/§25.1/§25.2)。
	// 🔴 起卦=显式动作:问事时刻由 castPrashna 一次性冻结,面板只读 chartObj.jyotish.prashna。
	renderPrashnaPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const pr = (jyotish || {}).prashna;
		const cast = this.state.prashnaCast;
		const schools = this.state.prashnaSchoolsInput || [];
		const toggleSchool = (key)=>{
			const cur = new Set(this.state.prashnaSchoolsInput || []);
			if(cur.has(key)){ cur.delete(key); }else{ cur.add(key); }
			if(!cur.size){ cur.add('kp'); }
			const arr = Array.from(cur);
			this.updatePrashnaParam({ prashnaSchoolsInput: arr }, { schools: arr.join(',') });
		};
		return (
			<div className="horosa-india-dasha-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">起卦(问事 Praśna)</div>
					<div className="horosa-india-select-grid">
						<div className="horosa-india-select-field">
							<span>问数(1–249)</span>
							<InputNumber min={1} max={249} size="small" style={{ width: '100%' }}
								value={this.state.prashnaNumberInput}
								onChange={(v)=>this.setState({ prashnaNumberInput: v || 1 })} />
						</div>
						<div className="horosa-india-select-field">
							<span>事项</span>
							<Select size="small" style={{ width: '100%' }} value={this.state.prashnaMatterInput}
								onChange={(v)=>{
									const m = AstroConst.normalizeIndiaPrashnaMatter(v);
									this.updatePrashnaParam({ prashnaMatterInput: m }, { matter: m });
								}}
								dropdownMatchSelectWidth={false}>
								{AstroConst.INDIA_PRASHNA_MATTER_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</div>
						<div className="horosa-india-select-field">
							<span>宫始定法</span>
							<Select size="small" style={{ width: '100%' }} value={this.state.prashnaCuspModeInput}
								onChange={(v)=>{
									const cm = AstroConst.normalizeIndiaPrashnaCuspMode(v);
									this.updatePrashnaParam({ prashnaCuspModeInput: cm }, { cuspMode: cm });
								}}
								dropdownMatchSelectWidth={false}>
								{AstroConst.INDIA_PRASHNA_CUSP_MODE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</div>
						<div className="horosa-india-select-field">
							<span>主判宫头(可改)</span>
							<InputNumber min={1} max={12} size="small" style={{ width: '100%' }}
								placeholder="按事项默认"
								value={this.state.prashnaPrimaryHouseInput}
								onChange={(v)=>this.updatePrashnaParam(
									{ prashnaPrimaryHouseInput: v || null }, { primaryHouse: v || undefined })} />
						</div>
					</div>
					<div className="horosa-india-prashna-schools">
						{AstroConst.INDIA_PRASHNA_SCHOOL_OPTIONS.map((o)=>(
							// 金色药丸开关:隐藏原生复选框 + 相邻 span 画药丸(选中态靠 input:checked + span),有意保留原生输入(键盘可达、样式依赖它)
							<label key={o.value} className="horosa-india-prashna-school">
								<input type="checkbox" checked={schools.indexOf(o.value) >= 0}
									onChange={()=>toggleSchool(o.value)} />
								<span>{o.label}</span>
							</label>
						))}
					</div>
					<div className="horosa-india-prashna-actions">
						<button type="button" className="horosa-india-pill-toggle is-active" onClick={this.castPrashna}>
							<strong>{cast ? '重新起卦(此刻)' : '起卦(此刻)'}</strong>
						</button>
						{cast ? (
							<button type="button" className="horosa-india-pill-toggle" onClick={this.clearPrashna}>
								<strong>清除</strong>
							</button>
						) : null}
					</div>
					{cast ? (
						<div className="horosa-india-card-note">已起卦 {cast.time} · 问数 {cast.number}(时刻与问数已冻结)</div>
					) : null}
				</div>
				{!cast ? null : !pr ? (
					<div className="horosa-india-dasha-empty">问事计算中…</div>
				) : (
					<>
						{pr.kp ? this.renderPrashnaKpCards(pr.kp) : null}
						{pr.parashari ? this.renderPrashnaParashariCard(pr.parashari) : null}
						{pr.tajika ? this.renderPrashnaTajikaCard(pr.tajika) : null}
					</>
				)}
			</div>
		);
	},

	renderPrashnaKpCards(kp){
		if(!kp || kp.available === false){
			return <div className="horosa-info-card"><div className="horosa-info-card-title">KP 问时盘</div><div className="horosa-india-card-note">不可用:{(kp || {}).reason || '未知'}</div></div>;
		}
		const j = kp.judgement || {};
		const seg = kp.segment || {};
		const verdictCls = j.verdict === 'favorable' ? 'is-ji' : (j.verdict === 'unfavorable' ? 'is-xiong' : '');
		return (
			<>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">KP 问时盘 · 裁决</div>
					<div className={`horosa-india-prashna-verdict ${verdictCls}`}>
						{j.verdict === 'favorable' ? '成' : j.verdict === 'mixed' ? '成中有碍' : j.verdict === 'unfavorable' ? '不成' : '不裁决'}
					</div>
					{(j.chain || []).map((line, i)=>(
						<div className="horosa-india-card-note" key={i}>{line}</div>
					))}
					<div className="horosa-india-card-note">
						问数段:{seg.nakName} · 宿主 {seg.starLord} · 子主 {seg.subLord} · 宫始:{kp.cuspMode}
						{kp.cuspAscMismatchDeg !== null && kp.cuspAscMismatchDeg !== undefined ? ` · 与问数上升差 ${kp.cuspAscMismatchDeg}°` : ''}
						{kp.invariantCslMatchesSegment === true ? ' · CSL₁≡问数子主 ✓' : ''}
					</div>
					{(kp.notes || []).map((n, i)=>(<div className="horosa-india-card-note" key={i}>{n}</div>))}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">十二宫始子主(CSL)· 宫主按宫始落座</div>
					<div className="horosa-india-data-list horosa-india-prashna-csl">
						{(kp.cuspalSubLords || []).map((c)=>(
							<div className="horosa-india-data-row" key={c.house}>
								<strong>宫{c.house}</strong>
								<span>{(c.cuspLon || 0).toFixed(2)}°</span>
								<span>宿主 {c.starLord}</span>
								<span>子主 {c.subLord}</span>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Ruling Planets(七项)与 Vara</div>
					<div className="horosa-india-card-note">
						RP:{((kp.rulingPlanets || {}).set || []).join(' · ') || '—'}
					</div>
					{kp.vara ? (
						<div className="horosa-india-card-note">
							Vara(日出日界):{kp.vara.sunrise}{kp.vara.civil !== kp.vara.sunrise ? `(民用日口径为 ${kp.vara.civil},二者不同,以日出为准)` : ''}
						</div>
					) : null}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">应期候选窗(打分排序 · 非二值判定)</div>
					<div className="horosa-india-data-list">
						{(kp.timingWindows || []).map((w, i)=>(
							<div className="horosa-india-data-row" key={i}>
								<strong>{w.levelName}</strong>
								<span>{w.lord}</span>
								<span>{w.start} ~ {w.end}</span>
								<span>分 {w.score}</span>
							</div>
						))}
						{!(kp.timingWindows || []).length ? <div className="horosa-india-card-note">无得分窗口</div> : null}
					</div>
					<div className="horosa-india-card-note">评分:窗主∈RP +2 / 窗主指示宫命中事项宫组逐宫 +1(权威未定义 RP 与 Significator 取交或并,故不作成败二值)</div>
				</div>
			</>
		);
	},

	renderPrashnaParashariCard(pa){
		if(!pa || pa.available === false){ return null; }
		const lg = pa.lagna || {};
		const moon = pa.moon || {};
		const nk = (moon.nakshatra || {});
		return (
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">Parāśarī 问事(页面框架)</div>
				<div className="horosa-india-data-list">
					<div className="horosa-india-data-row"><strong>问时 Lagna</strong><span>{lg.signLabel || lg.sign || '—'}</span></div>
					<div className="horosa-india-data-row"><strong>月亮(心念)</strong>
						<span>{nk.name || '—'}{nk.pada ? ` 第${nk.pada}pada` : ''}</span>
						<span>{(moon.tithi || {}).name || ''}</span>
						<span>{pakshaLabel(moon.paksha)}</span>
					</div>
					{pa.taraBala ? (
						<div className="horosa-india-data-row"><strong>Tārā(对本命月)</strong><span>{pa.taraBala.name}({pa.taraBala.quality})</span></div>
					) : null}
					{pa.chandraBala ? (
						<div className="horosa-india-data-row"><strong>Chandra Bala</strong><span>第 {pa.chandraBala.house} 宫 · {pa.chandraBala.good ? '吉' : '非吉位'}</span></div>
					) : null}
					{(pa.yogas || []).length ? (
						<div className="horosa-india-data-row"><strong>问时 Yoga</strong><span>{prashnaYogaNames(pa.yogas).join('、')}</span></div>
					) : null}
				</div>
			</div>
		);
	},

	renderPrashnaTajikaCard(tj){
		if(!tj || tj.available === false){ return null; }
		const it = tj.ithasala;
		return (
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">Tājika 问事(Ithasālā 入相)</div>
				<div className="horosa-india-data-list">
					<div className="horosa-india-data-row"><strong>Lagna 主</strong><span>{tj.lagnaLord || '—'}</span><strong>事项主(宫{tj.primaryHouse})</strong><span>{tj.karyaLord || '—'}</span></div>
					{it ? (
						<div className="horosa-india-data-row">
							<strong>{it.type === 'eesarpha' ? 'Īsārpha 离相(不成)' : `Ithasālā ${it.type || ''}(入相→成)`}</strong>
							<span>{it.aspect || ''}{it.withinOrb ? ' · 在 orb 内' : ''}</span>
						</div>
					) : (
						<div className="horosa-india-data-row"><span className="horosa-india-card-note">{tj.selfLordNote || '两主无 Tājika 相位'}</span></div>
					)}
					{(tj.higherYogas || []).length ? (
						<div className="horosa-india-data-row"><strong>传/集光</strong><span>{tj.higherYogas.map(prashnaHigherYogaText).join('、')}</span></div>
					) : null}
					{tj.saham ? (
						<div className="horosa-india-data-row"><strong>类别 Saham</strong><span>{tj.saham.label || tj.saham.key}:{tj.saham.sign || ''} {typeof tj.saham.signLon === 'number' ? tj.saham.signLon.toFixed(1) + '°' : ''}</span></div>
					) : null}
				</div>
				<div className="horosa-india-card-note">{tj.note}</div>
			</div>
		);
	},

	// [校时 · tab 15] 摘要卡 + 抽屉入口(§17)。边界提示未扫描也有值(§17.5 务必提示)。
	renderRectifyPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const spx = (jyotish || {}).sensitivePoints || {};
		const gnd = (spx.gandanta || {}).hits || [];
		const res = this.state.rectifyResult;
		const school = this.state.indiaSchool;
		const kpFrameOk = school !== 'kp'
			|| ((this.state.indiaAyanamsaValue || AstroConst.INDIA_AYANAMSA_DEFAULT) === 'krishnamurti');
		return (
			<div className="horosa-india-dasha-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">出生时间校正(半自动)</div>
					<div className="horosa-india-data-list">
						<div className="horosa-info-row"><span>当前采用时间</span><strong>{fields && fields.time && fields.time.value ? fields.time.value.format('HH:mm:ss') : '—'}</strong></div>
						<div className="horosa-info-row"><span>口径一致性</span>
							<span>{kpFrameOk ? '与流派口径一致 ✓' : 'KP 派应配 KP 岁差'}</span>
							{!kpFrameOk ? (
								<button type="button" className="horosa-india-pill-toggle" onClick={()=>this.changeIndiaAyanamsa('krishnamurti')}>
									<strong>切到 KP 口径</strong>
								</button>
							) : null}
						</div>
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">边界提示(无须扫描)</div>
					{gnd.length ? (
						<div className="horosa-india-data-list">
							{gnd.map((h, i)=>(
								<div className="horosa-india-data-row" key={i}>
									<strong>{h.bodyLabel || h.body}</strong>
									{h.gandanta ? <span className="horosa-india-flag-badge is-warn">Gandanta {h.gandanta.junctionLabel} 距界 {h.gandanta.arcminToBoundary}′</span> : null}
									{h.rasiSandhi ? <span className="horosa-india-flag-badge">Sandhi {h.rasiSandhi.position === 'sign_end' ? '座末' : '座初'} {h.rasiSandhi.arcminToBoundary}′</span> : null}
								</div>
							))}
						</div>
					) : (
						<div className="horosa-india-card-note">月亮/Lagna/九曜均不在 Gandanta/Sandhi 界位</div>
					)}
					<div className="horosa-india-card-note">月亮或 Lagna 落界 → 出生时间敏感,建议校时</div>
				</div>
				{res && (res.top || []).length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">上次扫描 Top {res.top.length}</div>
						<div className="horosa-india-data-list">
							{res.top.map((t, i)=>(
								<div className="horosa-india-data-row" key={i}>
									<strong>{t.time}</strong>
									<span>总分 {(t.score || {}).total}</span>
									<span>子主 {t.lagnaSubLord}</span>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-india-prashna-actions" style={{ marginTop: 0 }}>
						<button type="button" className="horosa-india-pill-toggle is-active" onClick={()=>this.setState({ rectifyDrawerOpen: true })}>
							<strong>打开校时器</strong>
						</button>
					</div>
				</div>
				{this.renderRectifyDrawer(fields)}
			</div>
		);
	},

	async runRectifyScan(fields){
		try{
			this.setState({ rectifyRunning: true });
			// 冻结扫描锚点(表单当前 DateTime):候选行的 offsetSeconds 全部相对它。
			// 「采用」= 锚点 + offsetSeconds(addSecond 自带跨日/跨月进位)——后端 top 行只回
			// HH:MM:SS,若按时分秒回写,跨午夜候选(窗口最大 ±240 分)会差整整 24 小时。
			const curT = this.props.fields && this.props.fields.time && this.props.fields.time.value;
			this._rectifyAnchorTime = curT && curT.clone ? curT.clone() : null;
			const params = fieldsToParams(this.withIndiaOptionFields(fields || this.props.fields));
			const payload = {
				...params,
				rectifyWindowMinutes: this.state.rectifyWindowMinutes,
				rectifyStepSeconds: this.state.rectifyStepSeconds,
				rectifyRpSource: this.state.rectifyRpSource,
			};
			// 🔴 必须走应用加密传输层(与 /india/chart 同通道):Java 网关收 RSA 密文,
			//    裸 fetch 发明文 → 解密拦截器 500 且不达 Python(实测抓获,勿回退裸 fetch)。
			const { default: request } = require('../../../utils/request');
			const Constants = require('../../../utils/constants');
			const data = await request(`${Constants.ServerRoot}/india/rectify`, {
				body: JSON.stringify(payload),
				silent: true,
			});
			const res = data ? data[Constants.ResultKey] : null;
			this.setState({ rectifyRunning: false, rectifyResult: res && res.available ? res : null });
			safeLocalStorageSet('horosa.india.rectify.prefs.v1', JSON.stringify({
				w: this.state.rectifyWindowMinutes, s: this.state.rectifyStepSeconds, rp: this.state.rectifyRpSource,
			}));
		}catch(e){
			this.setState({ rectifyRunning: false });
		}
	},

	// 试算 ≠ 采用(两级):试算只改本组件预览态,绝不碰 props.fields;采用走 changeTime 显式写表单。
	applyRectifyCandidate(t){
		if(!t){ return; }
		const cur = this.props.fields && this.props.fields.time && this.props.fields.time.value;
		if(!cur){ return; }
		// 🔴 fields.time.value 是应用自制 DateTime(month 1 基、自带 ad/zone),
		// moment(cur) 会把 1 基 month 当 0 基解析 → 日期整体 +1 月(真机实证)。
		// 必须走它自己的 clone()+addSecond/setHour 族,纪元/时区随 clone 保留。
		// 🔴 首选 offsetSeconds 相对扫描锚点加秒(跨午夜候选自动进位换日);
		//    后端 time 只有 HH:MM:SS,按时分秒回写会把「前/后一日 HH:MM」写成同日 → 差 24h。
		let next = null;
		const anchor = this._rectifyAnchorTime;
		if(typeof t.offsetSeconds === 'number' && anchor && anchor.clone){
			next = anchor.clone();
			next.addSecond(t.offsetSeconds);
		}else if(t.time){
			next = cur.clone();
			next.setHour(Number(t.time.slice(0, 2)));
			next.setMinute(Number(t.time.slice(3, 5)));
			next.setSecond(Number(t.time.slice(6, 8)));
		}
		if(!next){ return; }
		this.changeTime({ time: next, confirmed: true });
		this.setState({ rectifyDrawerOpen: false });
	},

	renderRectifyDrawer(fields){
		const res = this.state.rectifyResult;
		const diag = (res || {}).resolution;
		const LORD_CN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土', Rahu: '罗', Ketu: '计' };
		const lordFull = { Sun: '太阳', Moon: '月亮', Mars: '火星', Mercury: '水星', Jupiter: '木星', Venus: '金星', Saturn: '土星', Rahu: '罗睺', Ketu: '计都' };
		const runs = res ? (((res.runs || {}).lagnaSubLord) || []) : [];
		return (
			<XQDrawer
				className="horosa-india-rectify-xqdrawer"
				title="出生时间校正器(判据:RP / Pranapada / 边界;事件评分须录入事件后参评)"
				placement="right"
				width={860}
				mask={false}
				open={this.state.rectifyDrawerOpen}
				visible={this.state.rectifyDrawerOpen}
				onClose={()=>this.setState({ rectifyDrawerOpen: false })}
			>
				<div className="horosa-india-rectify-drawer">
					<div className="horosa-india-rectify-controls">
						<div className="horosa-india-rectify-field">
							<span>扫描半窗(分)</span>
							<InputNumber min={1} max={240} size="small" style={{ width: '100%' }}
								value={this.state.rectifyWindowMinutes}
								onChange={(v)=>this.setState({ rectifyWindowMinutes: v || 30 })} />
						</div>
						<div className="horosa-india-rectify-field">
							<span>步长(秒)</span>
							<InputNumber min={1} max={600} size="small" style={{ width: '100%' }}
								value={this.state.rectifyStepSeconds}
								onChange={(v)=>this.setState({ rectifyStepSeconds: v || 60 })} />
						</div>
						<div className="horosa-india-rectify-field is-wide">
							<span>RP 取法</span>
							<Select size="small" style={{ width: '100%' }} value={this.state.rectifyRpSource}
								onChange={(v)=>this.setState({ rectifyRpSource: v })} dropdownMatchSelectWidth={false}>
								<Option value="anchor">anchor(默认:原始钟表时刻,无自指)</Option>
								<Option value="candidate">candidate(字面读法,自动消解自指)</Option>
							</Select>
						</div>
						<div className="horosa-india-rectify-field is-action">
							<span>&nbsp;</span>
							<button type="button" className="horosa-india-pill-toggle is-active"
								disabled={this.state.rectifyRunning}
								onClick={()=>this.runRectifyScan(fields)}>
								{this.state.rectifyRunning ? '扫描中…' : '开始扫描'}
							</button>
						</div>
					</div>
					{diag ? (
						<div className={`horosa-india-rectify-diag${diag.adequate ? ' is-ok' : ' is-warn'}`}>
							<i />步长诊断:单步 Lagna 最大位移 {diag.maxLagnaDeltaDeg}° / KP 最窄 Sub {diag.narrowestSubDeg}°
							{diag.adequate ? ' · 充分' : ` · 会整段跳过子主,建议步长 ≤${diag.suggestedStepSeconds}s`}
						</div>
					) : null}
					{res ? (
						<>
							<div className="horosa-india-rectify-section">
								<em>Lagna 子主区段</em><i>校时之靶 · {runs.length} 段</i>
							</div>
							<div className="horosa-india-rectify-runs">
								{runs.map((r, i)=>(
									<div className="horosa-india-rectify-run" key={i}>
										<strong><i className="horosa-india-rectify-glyph" aria-hidden="true">{LORD_CN[r.value] || '—'}</i>{lordFull[r.value] || r.value || '—'}</strong>
										<span>{r.fromTime} ~ {r.toTime}</span>
										<em>{r.count} 采样</em>
									</div>
								))}
							</div>
							<div className="horosa-india-rectify-section">
								<em>Top {res.top.length} 候选</em><i>按判据总分排序</i>
							</div>
							<div className="horosa-india-rectify-tops">
								{(res.top || []).map((t, i)=>(
									<div className="horosa-india-rectify-top" key={i}>
										<b className="horosa-india-rectify-rank">{i + 1}</b>
										<strong>{t.time}</strong>
										<span className="horosa-india-rectify-score">总 {(t.score || {}).total}</span>
										<span className="horosa-india-rectify-badge">RP {(t.rp || {}).score}</span>
										<span className={`horosa-india-rectify-badge${((t.pranapada || {}).overall) === 'good' ? ' is-good' : ''}`}>PP {((t.pranapada || {}).overall) || '—'}</span>
										<button type="button" className="horosa-india-pill-toggle"
											onClick={()=>{ confirmDialog({ title: `采用 ${t.time} 为出生时间?`, content: '此操作写入表单并影响存盘与 AI 挂载。', okText: '采用' }).then((ok)=>{ if(ok){ this.applyRectifyCandidate(t); } }); }}>
											采用
										</button>
									</div>
								))}
							</div>
							{res.vara && res.vara.note ? <div className="horosa-india-rectify-note">{res.vara.note}</div> : null}
							<div className="horosa-india-rectify-note">{res.disclaimer}</div>
						</>
					) : (
						<div className="horosa-india-rectify-empty">设定窗口与步长后「开始扫描」;扫描不建全盘(精算路径),默认档 &lt;20ms</div>
					)}
				</div>
			</XQDrawer>
		);
	},

	renderKpMuhurtaPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const kp = jyotish ? jyotish.kp : null;
		const muhurta = jyotish ? jyotish.muhurta : null;
		const sublords = kp && kp.sublords ? kp.sublords : {};
		const kpLevels = kp && kp.kpLevels ? kp.kpLevels : {};
		const cuspalSubLords = kp && Array.isArray(kp.cuspalSubLords) ? kp.cuspalSubLords : [];
		const rulingPlanets = kp && kp.rulingPlanets ? kp.rulingPlanets : null;
		const kpSignificators = kp && kp.significators ? kp.significators : null;
		const KP_LORD_CN = { Sun: '太阳', Moon: '月亮', Mars: '火星', Mercury: '水星', Jupiter: '木星', Venus: '金星', Saturn: '土星', Rahu: '罗睺', Ketu: '计都', 'North Node': '罗睺', 'South Node': '计都' };
		const kpl = (x)=>KP_LORD_CN[x] || x || '—';
		const prasna = jyotish && jyotish.prasna && jyotish.prasna.available ? jyotish.prasna : null;   // Praśna 卜卦 KP249
		// KP / Muhurta / 问时子块未能计算时一行提示(引擎落账 jyotish.partialErrors)
		const kpPartialNote = jyotishPartialNotice(jyotish, isKpMuhurtaPartialName);
		const muhurtaFailed = (name)=>!!(muhurta && Array.isArray(muhurta.partialErrors) && muhurta.partialErrors.indexOf(name) >= 0);
		const SIGN_CN_KP = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		return (
			<div className="horosa-india-jyotish-panel">
				{kpPartialNote ? <div className="horosa-india-card-note horosa-india-partial-note">{kpPartialNote}</div> : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">KP Sublord</div>
					<div className="horosa-india-data-list">
						{Object.keys(sublords).map((key)=>(
							<div className="horosa-india-data-row" key={key}>
								<strong>{key}</strong>
								<span>{sublords[key].starLord ? sublords[key].starLord.label : '—'} / {sublords[key].subLord ? sublords[key].subLord.label : '—'}</span>
								<em>{sublords[key].nakshatra ? `${sublords[key].nakshatra.name} P${sublords[key].nakshatra.pada}` : '—'}</em>
							</div>
						))}
					</div>
				</div>
				{Object.keys(kpLevels).length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">KP 六级细分（Nak ⊃ Sub ⊃ Prati ⊃ Sook ⊃ Praana ⊃ Deha）</div>
						<div className="horosa-india-data-list">
							{Object.keys(kpLevels).map((pk)=>{
								const lv = kpLevels[pk] || {};
								return (
									<div className="horosa-india-data-row" key={pk}>
										<strong>{kpl(pk)}</strong>
										<span>{kpl(lv.Nak)} · {kpl(lv.Sub)} · {kpl(lv.Prati)}</span>
										<em>{kpl(lv.Sook)} · {kpl(lv.Praana)} · {kpl(lv.Deha)}</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
				{cuspalSubLords.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">宫头次主星 Cuspal Sub Lords（{kp && kp.cuspMode === 'equal_from_asc' ? '等宫近似' : ((kp && kp.cuspMode) || '—')}）</div>
						<div className="horosa-india-data-list">
							{cuspalSubLords.map((c)=>(
								<div className="horosa-india-data-row" key={c.house}>
									<strong>第{c.house}宫</strong>
									<span>{kpl(c.starLord)} / {kpl(c.subLord)}</span>
									<em>{formatDegree(c.cuspLon)}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{rulingPlanets ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">当令星 Ruling Planets</div>
						<div className="horosa-info-row"><span>命宫座·宿主</span><strong>{kpl(rulingPlanets.lagnaSignLord)} / {kpl(rulingPlanets.lagnaNakLord)}</strong></div>
						<div className="horosa-info-row"><span>月亮座·宿主</span><strong>{kpl(rulingPlanets.moonSignLord)} / {kpl(rulingPlanets.moonNakLord)}</strong></div>
						<div className="horosa-info-row"><span>星期主</span><strong>{kpl(rulingPlanets.weekdayLord)}</strong></div>
						<div className="horosa-info-row"><span>当令集</span><strong>{(rulingPlanets.set || []).map(kpl).join('、')}</strong></div>
					</div>
				) : null}
				{kpSignificators ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">意义者 Significators（KP 四级 A 星主所占 &gt; B 自占 &gt; C 星主所主 &gt; D 自主{kp && kp.basis === 'd1' ? ' · 恒按 D1' : ''}）</div>
						<div className="horosa-india-data-list">
							{Object.keys(kpSignificators).map((pk)=>{
								const sg = kpSignificators[pk] || {};
								return (
									<div className="horosa-india-data-row" key={pk}>
										<strong>{kpl(pk)}</strong>
										<span>司宫 {(sg.ranked || []).join(" · ")}</span>
										<em>{['A', 'B', 'C', 'D'].map((t)=>`${t} ${(sg[t] || []).length ? (sg[t] || []).join("/") : "—"}`).join(' · ')}</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Muhurta{muhurta && muhurta.vedicDate ? `（出生所在吠陀日 ${muhurta.vedicDate} · 日出起算）` : ''}</div>
					{muhurta && muhurta.available !== false ? (
						<>
							<div className="horosa-info-row"><span>日出</span><strong>{muhurta.sunrise || '—'}</strong></div>
							<div className="horosa-info-row"><span>日落</span><strong>{muhurta.sunset || '—'}</strong></div>
							<div className="horosa-info-row"><span>Rahu Kalam</span><strong>{muhurta.rahuKalam ? `${muhurta.rahuKalam.start} - ${muhurta.rahuKalam.end}` : '—'}</strong></div>
							<div className="horosa-info-row"><span>Yamaganda</span><strong>{muhurta.yamaganda ? `${muhurta.yamaganda.start} - ${muhurta.yamaganda.end}` : '—'}</strong></div>
							<div className="horosa-info-row"><span>Gulika</span><strong>{muhurta.gulika ? `${muhurta.gulika.start} - ${muhurta.gulika.end}` : '—'}</strong></div>
							{!muhurta.birthMuhurta && muhurtaFailed('birthMuhurta') ? (
								<div className="horosa-info-row"><span>出生须臾</span><strong className="is-warn">未能计算</strong></div>
							) : null}
							{muhurta.birthMuhurta ? (
								<div className="horosa-info-row"><span>出生须臾</span><strong>{muhurta.birthMuhurta.name}（{muhurta.birthMuhurta.nameEn}）· {muhurta.birthMuhurta.nature === 'auspicious' ? '吉' : (muhurta.birthMuhurta.nature === 'inauspicious' ? '凶' : '中')}{muhurta.birthMuhurta.isAbhijit ? (muhurta.birthMuhurta.abhijitAuspicious === false ? ' · Abhijit(周三不取)' : ' · Abhijit 吉') : ''}</strong></div>
							) : null}
							{muhurta.panchaka ? (
								<div className="horosa-info-row"><span>Panchaka</span><strong className={muhurta.panchaka.isPanchaka ? 'is-warn' : 'is-good'}>{muhurta.panchaka.typeLabel}（余{muhurta.panchaka.remainder}）</strong></div>
							) : (muhurtaFailed('panchaka') ? (
								<div className="horosa-info-row"><span>Panchaka</span><strong className="is-warn">未能计算</strong></div>
							) : null)}
							{muhurta.abhijit ? (
								<div className="horosa-info-row"><span>Abhijit</span><strong className={muhurta.abhijit.auspicious ? 'is-good' : 'is-warn'}>第 8 昼须臾 · {muhurta.abhijit.auspicious ? '大吉' : '周三不取'}</strong></div>
							) : null}
						</>
					) : (
						<div className="horosa-india-dasha-empty">暂无择时数据</div>
					)}
				</div>
				{(()=>{
					// P0-7 Hora 行星时表(昼夜各 12 段;日出首段=当日 vara 主,后按 Chaldean 序循环)。
					const ht = muhurta && muhurta.horaTable;
					if(!ht || !Array.isArray(ht.rows) || !ht.rows.length){ return null; }
					const day = ht.rows.filter((r)=>r.period === 'day');
					const night = ht.rows.filter((r)=>r.period === 'night');
					const fmtTime = (s)=>{ if(!s){ return '—'; } const m = String(s).match(/(\d{1,2}:\d{2})/); return m ? m[1] : s; };
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Hora 行星时（昼夜各 12 段 · 日出首段=当日 vara 主,Chaldean 序）</div>
							<div className="horosa-india-period-grid">
								{[['昼（日出→日落）', day], ['夜（日落→次日出）', night]].map((pair)=>(
									<table className="horosa-india-maitri-table horosa-india-shad-table" key={pair[0]}>
										<thead><tr><th colSpan={3}>{pair[0]}</th></tr><tr><th>段</th><th>主</th><th>起</th></tr></thead>
										<tbody>
											{pair[1].map((r)=>(<tr key={`h${r.index}`}><td>{r.index}</td><th>{r.lordCN || r.lord}</th><td>{fmtTime(r.start)}</td></tr>))}
										</tbody>
									</table>
								))}
							</div>
						</div>
					);
				})()}
				{(()=>{
					// P1 Choghadia 民用择时(昼夜各 8 段;吉:甘露/吉/利/动,凶:病/时/扰)。
					const cg = muhurta && muhurta.choghadia;
					if(!cg || !Array.isArray(cg.rows) || !cg.rows.length){ return null; }
					const day = cg.rows.filter((r)=>r.period === 'day');
					const night = cg.rows.filter((r)=>r.period === 'night');
					const fmtTime = (s)=>{ if(!s){ return '—'; } const m = String(s).match(/(\d{1,2}:\d{2})/); return m ? m[1] : s; };
					const PCN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土' };
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Choghadia 民用择时（昼夜各 8 段 · 吉:甘露/吉/利/动 · 凶:病/时/扰）</div>
							<div className="horosa-india-period-grid">
								{[['昼（日出→日落）', day], ['夜（日落→次日出）', night]].map((pair)=>(
									<table className="horosa-india-maitri-table horosa-india-shad-table" key={pair[0]}>
										<thead><tr><th colSpan={3}>{pair[0]}</th></tr><tr><th>段</th><th>类</th><th>起</th></tr></thead>
										<tbody>
											{pair[1].map((r)=>(
												<tr key={`cg${r.period}${r.index}`}>
													<td>{r.index}</td>
													<th className={r.nature === 'good' ? 'is-good' : (r.nature === 'bad' ? 'is-warn' : '')}>{r.cn}{r.key ? `·${r.key}` : ''} {PCN[r.planet] || ''}</th>
													<td>{fmtTime(r.start)}</td>
												</tr>
											))}
										</tbody>
									</table>
								))}
							</div>
						</div>
					);
				})()}
				{prasna && Array.isArray(prasna.table) && prasna.table.length ? (()=>{
					const n = Math.min(249, Math.max(1, this.state.prasnaNumber || 1));
					const row = prasna.table.find((r)=>r.index === n) || prasna.table[0];
					const base = row ? Math.floor(row.startLon / 30) * 30 : 0;
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Praśna 卜卦（KP 问数 1-249 → 问时上升）</div>
							<div className="horosa-india-transit-row">
								<span className="horosa-india-transit-label">问数</span>
								<InputNumber min={1} max={249} precision={0} value={this.state.prasnaNumber || 1}
									onChange={(v)=>{
										const n2 = Math.min(249, Math.max(1, Number(v) || 1));
										this.setState({ prasnaNumber: v, kpFullTablePage: Math.floor((n2 - 1) / 25) });
									}} size="small" className="horosa-india-transit-datepicker" />
							</div>
							{row ? (
								<div className="horosa-india-data-list">
									<div className="horosa-india-data-row"><strong>上升落座</strong><span>{SIGN_CN_KP[row.sign] || row.sign}</span><em>{(row.startLon - base).toFixed(1)}°–{(row.endLon - base).toFixed(1)}°</em></div>
									<div className="horosa-india-data-row"><strong>星宿 · 星主</strong><span>{row.nakName}</span><em>{kpl(row.starLord)}</em></div>
									<div className="horosa-india-data-row"><strong>子主链</strong><span>座主 {kpl(row.signLord)} · 星主 {kpl(row.starLord)}</span><em>子主 {kpl(row.subLord)}</em></div>
								</div>
							) : null}
							<div className="horosa-india-card-note">{prasna.note}</div>
							<div className="horosa-india-prashna-actions">
								<button type="button" className={`horosa-india-pill-toggle${this.state.kpFullTableOpen ? ' is-active' : ''}`}
									onClick={()=>{
										const n2 = Math.min(249, Math.max(1, Number(this.state.prasnaNumber) || 1));
										this.setState((prev)=>({ kpFullTableOpen: !prev.kpFullTableOpen, kpFullTablePage: Math.floor((n2 - 1) / 25) }));
									}}>
									{this.state.kpFullTableOpen ? '收起全表' : '展开全 249 段表'}
								</button>
							</div>
							{this.state.kpFullTableOpen ? (()=>{
								const page = Math.min(9, Math.max(0, this.state.kpFullTablePage || 0));
								const slice = prasna.table.slice(page * 25, page * 25 + 25);
								const hit = Math.min(249, Math.max(1, Number(this.state.prasnaNumber) || 1));
								return (
									<div>
										<div className="horosa-india-prashna-actions" style={{ flexWrap: 'wrap' }}>
											{Array.from({ length: 10 }, (_, i)=>(
												<button type="button" key={i}
													className={`horosa-india-pill-toggle${i === page ? ' is-active' : ''}`}
													onClick={()=>this.setState({ kpFullTablePage: i })}>
													{i * 25 + 1}–{Math.min(249, i * 25 + 25)}
												</button>
											))}
										</div>
										<div className="horosa-india-maitri-wrap">
											<table className="horosa-india-maitri-table horosa-india-shad-table">
												<thead><tr><th>#</th><th>星座</th><th>座内度区</th><th>宿（星主）</th><th>子主</th></tr></thead>
												<tbody>
													{slice.map((r)=>{
														const b = Math.floor(r.startLon / 30) * 30;
														const isHit = r.index === hit;
														return (
															<tr key={r.index} style={isHit ? { color: 'var(--horosa-astro-gold, #b8860b)', fontWeight: 600 } : undefined}>
																<td>{isHit ? <span className="horosa-india-flag-badge is-good">{r.index}</span> : r.index}</td>
																<td>{SIGN_CN_KP[r.sign] || r.sign}</td>
																<td>{(r.startLon - b).toFixed(2)}°–{(r.endLon - b).toFixed(2)}°</td>
																<td>{r.nakName}（{kpl(r.starLord)}）</td>
																<td>{kpl(r.subLord)}</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										</div>
										<div className="horosa-india-card-note">全 249 段(243 宿×Sub + 6 跨界拆);输入问数自动定位页并高亮该行。</div>
									</div>
								);
							})() : null}
						</div>
					);
				})() : null}
				{this.renderJudgmentNotes('6')}
			</div>
		);
	},
};
