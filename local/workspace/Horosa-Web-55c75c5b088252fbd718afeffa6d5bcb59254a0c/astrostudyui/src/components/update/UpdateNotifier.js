import React from 'react';
import {
	isDesktopBridgeAvailable,
	updateCheckSilent,
	updateStartBackground,
	updateInstallAndRestart,
} from '../../utils/aiAnalysisDesktop';
import styles from './UpdateNotifier.less';

// v2.2.1 软件内升级·非阻塞 UX。
// 复用 Rust 自研 updater 核心(下载/校验/双件/重启),这里只做主窗口内的非模态交互:
//   启动自动检测 → 右下角卡片(更新/稍后/查看更新内容)→ 后台下载(可最小化为进度药丸,不挡使用)
//   → 下载完成「重启更新」由用户主动触发。非桌面环境整体静默不渲染。
// 事件来自 Rust emit_update_event → window.__horosaUpdateEvent;手动检查入口 window.__horosaTriggerUpdateCheck。

const PHASE_IDLE = 'idle';
const PHASE_AVAILABLE = 'available';
const PHASE_DOWNLOADING = 'downloading';
const PHASE_READY = 'ready';
const PHASE_APPLYING = 'applying';
const PHASE_ERROR = 'error';

// 可视化 v2:字节/速度/ETA/部件/模式徽标。全部字段判空退化(旧壳+新前端可用),
// kill-switch localStorage horosaUpdateUiV2=0 关新排版(与 perfFlags 风格对齐)。
function uiV2Enabled(){
	try{ return window.localStorage.getItem('horosaUpdateUiV2') !== '0'; }catch(e){ return true; }
}
function fmtMB(bytes){
	if(bytes == null || !isFinite(bytes)){ return ''; }
	const mb = bytes / 1048576;
	return mb >= 100 ? `${Math.round(mb)}` : `${mb.toFixed(1)}`;
}
function fmtSpeed(bps){
	if(bps == null || !isFinite(bps) || bps <= 0){ return ''; }
	return `${(bps / 1048576).toFixed(1)} MB/s`;
}
function fmtEta(secs){
	if(secs == null || !isFinite(secs) || secs <= 0){ return ''; }
	if(secs >= 60){ return `约剩 ${Math.floor(secs / 60)} 分 ${Math.round(secs % 60)} 秒`; }
	return `约剩 ${Math.round(secs)} 秒`;
}
function modeBadgeText(mode){
	if(mode === 'incremental'){ return '增量'; }
	if(mode === 'full'){ return '完整'; }
	return '';
}

// 事件→状态的纯 reducer(可测):返回要 setState 的补丁,或 {toast}/null。
// 全部 v2 字段判空透传——旧壳(无字段)与新壳(带字段)任意组合可退化。
export function reduceUpdateEvent(state, payload){
	if(!payload){ return null; }
	const phase = payload.phase;
	if(phase === 'available'){
		return {
			phase: PHASE_AVAILABLE,
			minimized: false,
			latestVersion: payload.latestVersion || '',
			currentVersion: payload.currentVersion || '',
			notes: payload.notes || '',
			releaseUrl: payload.releaseUrl || '',
			mode: payload.mode || '',
			estimateBytes: payload.downloadBytes != null ? payload.downloadBytes : null,
			reusePct: payload.reusePct != null ? payload.reusePct : null,
		};
	}
	if(phase === 'planning'){
		return {
			phase: PHASE_DOWNLOADING,
			pct: typeof payload.pct === 'number' ? payload.pct : state.pct,
			message: payload.message || state.message,
			mode: payload.mode || state.mode,
			totalBytes: payload.totalBytes != null ? payload.totalBytes : null,
			reusePct: payload.reusePct != null ? payload.reusePct : state.reusePct,
		};
	}
	if(phase === 'checking' || phase === 'downloading'){
		const next = {
			phase: PHASE_DOWNLOADING,
			pct: typeof payload.pct === 'number' ? payload.pct : state.pct,
			message: payload.message || state.message,
		};
		if(payload.mode){ next.mode = payload.mode; }
		if(payload.totalBytes != null){ next.totalBytes = payload.totalBytes; }
		if(payload.downloadedBytes != null){ next.downloadedBytes = payload.downloadedBytes; }
		if(payload.speedBps != null){ next.speedBps = payload.speedBps; }
		if(payload.etaSecs != null){ next.etaSecs = payload.etaSecs; }
		if(payload.component != null){ next.component = payload.component; }
		if(payload.componentIndex != null){ next.componentIndex = payload.componentIndex; }
		if(payload.componentTotal != null){ next.componentTotal = payload.componentTotal; }
		return next;
	}
	if(phase === 'ready'){
		return {
			phase: PHASE_READY,
			minimized: false,
			pct: 100,
			latestVersion: payload.version || state.latestVersion,
			mode: payload.mode || state.mode,
			readyBytes: payload.downloadedBytes != null ? payload.downloadedBytes : null,
		};
	}
	if(phase === 'applying'){
		// 安装阶段(增量手术/展开运行时/原子切换):旧壳不发此 phase,零影响。
		return {
			phase: PHASE_APPLYING,
			minimized: false,
			message: payload.message || '正在安装更新…',
		};
	}
	if(phase === 'uptodate'){
		return { phase: PHASE_IDLE, toast: '已是最新版本' };
	}
	if(phase === 'check-failed'){
		// 自动检查失败:低打扰 toast(不改 phase、不打断任何进行中的下载 UI);
		// 旧壳不发此 phase,零影响。
		return { toast: payload.message || '更新检查未完成，稍后会自动重试' };
	}
	if(phase === 'downgrade-blocked'){
		// 线上版本低于本机(防降级拦截):同样只 toast 提示,不进入更新流程。
		return { toast: payload.message || '线上版本低于本机，已跳过本次更新' };
	}
	if(phase === 'error'){
		return { phase: PHASE_ERROR, message: payload.message || '更新失败' };
	}
	return null;
}

export { fmtMB, fmtSpeed, fmtEta, modeBadgeText };

class UpdateNotifier extends React.Component {
	constructor(props){
		super(props);
		this.state = {
			phase: PHASE_IDLE,
			minimized: false,
			pct: 0,
			message: '',
			latestVersion: '',
			currentVersion: '',
			notes: '',
			releaseUrl: '',
			toast: '',
			// 可视化 v2(全部可空,空即退回老样式)
			mode: '',            // 'incremental' | 'full'
			estimateBytes: null, // 检查阶段预计下载量
			reusePct: null,      // 增量复用率
			totalBytes: null,    // 下载阶段计划总量
			downloadedBytes: null,
			speedBps: null,
			etaSecs: null,
			component: '',
			componentIndex: 0,
			componentTotal: 0,
			readyBytes: null,    // ready 时实际下载量
		};
		this.mounted = false;
		this.toastTimer = null;
		this.onEvent = this.onEvent.bind(this);
		this.onUpdate = this.onUpdate.bind(this);
		this.onLater = this.onLater.bind(this);
		this.onViewNotes = this.onViewNotes.bind(this);
		this.onRestart = this.onRestart.bind(this);
		this.onRetry = this.onRetry.bind(this);
		this.triggerManualCheck = this.triggerManualCheck.bind(this);
	}

	componentDidMount(){
		this.mounted = true;
		if(!isDesktopBridgeAvailable()){
			return;
		}
		window.__horosaUpdateEvent = this.onEvent;
		window.__horosaTriggerUpdateCheck = this.triggerManualCheck;
		// 补读启动期间可能已发出的 pending 事件(镜像 launcher __horosaPending* 模式)。
		if(window.__horosaPendingUpdateEvent){
			try{ this.onEvent(window.__horosaPendingUpdateEvent); }catch(e){ /* noop */ }
		}
	}

	componentWillUnmount(){
		this.mounted = false;
		if(this.toastTimer){ clearTimeout(this.toastTimer); }
		if(window.__horosaUpdateEvent === this.onEvent){ window.__horosaUpdateEvent = null; }
		if(window.__horosaTriggerUpdateCheck === this.triggerManualCheck){ window.__horosaTriggerUpdateCheck = null; }
	}

	showToast(text){
		if(!this.mounted){ return; }
		this.setState({ toast: text });
		if(this.toastTimer){ clearTimeout(this.toastTimer); }
		this.toastTimer = setTimeout(()=>{
			if(this.mounted){ this.setState({ toast: '' }); }
		}, 3200);
	}

	onEvent(payload){
		if(!this.mounted || !payload){ return; }
		const patch = reduceUpdateEvent(this.state, payload);
		if(!patch){ return; }
		const { toast, ...stateChange } = patch;
		if(Object.keys(stateChange).length){ this.setState(stateChange); }
		if(toast){ this.showToast(toast); }
	}

	async triggerManualCheck(){
		if(!isDesktopBridgeAvailable()){ return; }
		this.showToast('正在检查更新…');
		try{
			const res = await updateCheckSilent();
			if(res && res.available){
				this.onEvent({
					phase: 'available',
					latestVersion: res.latestVersion,
					currentVersion: res.currentVersion,
					notes: res.notes,
					releaseUrl: res.releaseUrl,
					mode: res.updateMode,
					downloadBytes: res.downloadBytes,
					reusePct: res.reusePct,
				});
			}else{
				this.showToast('已是最新版本');
			}
		}catch(e){
			this.showToast('检查更新失败,请稍后再试');
		}
	}

	async onUpdate(){
		this.setState({ phase: PHASE_DOWNLOADING, pct: 2, message: '准备下载…', minimized: false });
		try{
			await updateStartBackground();
		}catch(e){
			this.setState({ phase: PHASE_ERROR, message: '无法开始下载,请稍后再试' });
		}
	}

	onLater(){
		this.setState({ phase: PHASE_IDLE });
	}

	onViewNotes(){
		const url = this.state.releaseUrl;
		if(url){
			try{ window.open(url, '_blank'); }catch(e){ /* noop */ }
		}
	}

	async onRestart(){
		// 点下即给反馈(Rust applying 事件随后细化 message),不再是「点了没反应」。
		this.setState({ phase: PHASE_APPLYING, minimized: false, message: '正在安装更新…' });
		try{
			await updateInstallAndRestart();
		}catch(e){
			this.setState({ phase: PHASE_ERROR, message: '重启更新失败,请稍后再试' });
		}
	}

	onRetry(){
		this.onUpdate();
	}

	renderToast(){
		if(!this.state.toast){ return null; }
		return <div className={styles.toast}>{this.state.toast}</div>;
	}

	render(){
		const { phase, minimized, pct, message, latestVersion, currentVersion, notes } = this.state;
		const { mode, estimateBytes, reusePct, totalBytes, downloadedBytes, speedBps, etaSecs, component, componentIndex, componentTotal, readyBytes } = this.state;
		const v2 = uiV2Enabled();
		if(!isDesktopBridgeAvailable()){
			return null;
		}
		if(phase === PHASE_IDLE){
			return this.renderToast();
		}

		// 最小化:收成右下角进度药丸(下载中),点开恢复卡片。
		if(minimized && phase === PHASE_DOWNLOADING){
			const pillSpeed = v2 ? fmtSpeed(speedBps) : '';
			return (
				<React.Fragment>
					{this.renderToast()}
					<button
						type="button"
						className={styles.pill}
						onClick={()=>this.setState({ minimized: false })}
						title="正在后台下载更新"
					>
						<span className={styles.pillSpinner} />
						<span className={styles.pillText}>更新 {Math.round(pct)}%{pillSpeed ? ` · ${pillSpeed}` : ''}</span>
					</button>
				</React.Fragment>
			);
		}

		const badge = v2 && modeBadgeText(mode) ? (
			<span className={styles.modeBadge}>{modeBadgeText(mode)}</span>
		) : null;

		let body = null;
		if(phase === PHASE_AVAILABLE){
			// 「本次需下载约 63 MB(增量更新,复用 90%)」/「完整更新,约 611 MB」/「大小待定」
			let sizeLine = null;
			if(v2){
				const mb = fmtMB(estimateBytes);
				if(mode === 'incremental'){
					sizeLine = mb
						? `本次需下载约 ${mb} MB(增量更新${reusePct != null ? `,复用 ${reusePct}%` : ''})`
						: `增量更新,大小待定`;
				}else if(mode === 'full'){
					sizeLine = mb ? `完整更新,约 ${mb} MB` : '完整更新,大小待定';
				}
			}
			body = (
				<React.Fragment>
					<div className={styles.title}>发现新版本 v{latestVersion}{badge}</div>
					<div className={styles.sub}>当前 v{currentVersion} → 新版 v{latestVersion}</div>
					{sizeLine ? <div className={styles.sizeLine}>{sizeLine}</div> : null}
					{notes ? <div className={styles.notes}>{notes}</div> : null}
					<div className={styles.actions}>
						<button type="button" className={styles.btnPrimary} onClick={this.onUpdate}>立即更新</button>
						<button type="button" className={styles.btnGhost} onClick={this.onLater}>稍后</button>
						<button type="button" className={styles.btnLink} onClick={this.onViewNotes}>查看更新内容</button>
					</div>
				</React.Fragment>
			);
		}else if(phase === PHASE_DOWNLOADING){
			// 字节行「214 / 649 MB · 6.1 MB/s · 约剩 1 分 10 秒」+ 部件行「部件 2/3:web-app」
			let byteLine = null;
			let componentLine = null;
			if(v2 && downloadedBytes != null){
				const done = fmtMB(downloadedBytes);
				const total = fmtMB(totalBytes);
				const speed = fmtSpeed(speedBps);
				const eta = fmtEta(etaSecs);
				const parts = [total ? `${done} / ${total} MB` : `已下载 ${done} MB`];
				if(speed){ parts.push(speed); }
				if(eta){ parts.push(eta); }
				byteLine = parts.join(' · ');
			}
			if(v2 && componentTotal > 0 && component){
				componentLine = `部件 ${componentIndex}/${componentTotal}:${component}`;
			}
			body = (
				<React.Fragment>
					<div className={styles.titleRow}>
						<div className={styles.title}>正在下载更新 v{latestVersion}{badge}</div>
						<button type="button" className={styles.iconBtn} onClick={()=>this.setState({ minimized: true })} title="最小化,继续使用">—</button>
					</div>
					<div className={styles.progressTrack}>
						<div className={styles.progressFill} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
					</div>
					{byteLine ? <div className={styles.byteLine}>{byteLine}</div> : null}
					{componentLine ? <div className={styles.componentLine}>{componentLine}</div> : null}
					<div className={styles.sub}>{message || '下载中…'} · {Math.round(pct)}%</div>
					<div className={styles.hint}>可最小化继续使用,下载完成后再重启更新。</div>
				</React.Fragment>
			);
		}else if(phase === PHASE_READY){
			const readyMb = v2 ? fmtMB(readyBytes) : '';
			body = (
				<React.Fragment>
					<div className={styles.title}>更新已就绪 v{latestVersion}{badge}</div>
					<div className={styles.sub}>
						{readyMb
							? `已下载并校验完成(本次共下载 ${readyMb} MB${modeBadgeText(mode) ? `,${modeBadgeText(mode)}` : ''}),准备好后即可重启完成更新。`
							: '已下载并校验完成,准备好后即可重启完成更新。'}
					</div>
					<div className={styles.actions}>
						<button type="button" className={styles.btnPrimary} onClick={this.onRestart}>重启更新</button>
						<button type="button" className={styles.btnGhost} onClick={this.onLater}>稍后</button>
					</div>
				</React.Fragment>
			);
		}else if(phase === PHASE_APPLYING){
			body = (
				<React.Fragment>
					<div className={styles.title}>正在安装更新 v{latestVersion}{badge}</div>
					<div className={styles.applyingRow}>
						<span className={styles.pillSpinner} />
						<span className={styles.sub}>{message || '正在安装更新…'}</span>
					</div>
					<div className={styles.hint}>正在切换本机组件,请勿关闭应用,完成后将自动重启。</div>
				</React.Fragment>
			);
		}else if(phase === PHASE_ERROR){
			body = (
				<React.Fragment>
					<div className={styles.title}>更新未完成</div>
					<div className={styles.sub}>{message}</div>
					<div className={styles.actions}>
						<button type="button" className={styles.btnPrimary} onClick={this.onRetry}>重试</button>
						<button type="button" className={styles.btnGhost} onClick={this.onLater}>关闭</button>
					</div>
				</React.Fragment>
			);
		}

		return (
			<React.Fragment>
				{this.renderToast()}
				<div className={styles.card} role="dialog" aria-label="软件更新">
					{body}
				</div>
			</React.Fragment>
		);
	}
}

export default UpdateNotifier;
