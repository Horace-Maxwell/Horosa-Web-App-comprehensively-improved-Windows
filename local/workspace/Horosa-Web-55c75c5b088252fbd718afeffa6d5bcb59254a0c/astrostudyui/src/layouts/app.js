import React from 'react';
import { connect  } from 'dva';
import { Layout,  BackTop, message, notification } from 'antd';
import { reconcileShadowOnBoot } from '../utils/shadowMirror';
import { bindAutoBackupTicks } from '../utils/autoBackup';
import { bindMcpBridge } from '../utils/aiAgent/mcpBridge';
import { bindTaskCenter, bindSchedulerTicks, unbindSchedulerTicks } from '../utils/aiAgent/tasks';
import { bindAutomationEngine } from '../utils/aiAgent/automation/engine';
import { buildDefaultAutomationDeps } from '../utils/aiAgent/automation/deps';
import { bindCrossWindowPrefs } from '../utils/aiAgent/prefs';
import { emitAutomationEvent } from '../utils/aiAgent/automation/events';
import TaskCenterBell from '../components/aianalysis/TaskCenterBell';
import { reportDesktopBridgeDiag, reportPageTelemetry } from '../utils/desktopBridgeDiag';
import { subscribeServiceStatus } from '../utils/serviceStatus';
import { snapshot as requestTelemetrySnapshot } from '../utils/requestTelemetry';
import { remindersEnabled, upcomingBirthdays } from '../utils/upcomingReminders';
import { listLocalCharts } from '../utils/localcharts';
import * as AstroConst from '../constants/AstroConst';
import PageHeader from '../components/homepage/PageHeader';
import UpdateNotifier from '../components/update/UpdateNotifier';
import ServiceStatusBanner from '../components/common/ServiceStatusBanner';
import LocalStoreHealthBanner from '../components/common/LocalStoreHealthBanner';
import MultiInstanceNotice from '../components/common/MultiInstanceNotice';
import StartupGate from '../components/common/StartupGate';
import BackendStatusDot from '../components/common/BackendStatusDot';
import {
    APPEARANCE_DARK,
    applyAppearanceToDocument,
    applyLightFlavorToDocument,
    getStoredLightFlavor,
    resolveAppearance,
    syncChartPalette,
} from '../utils/appearance';
import styles from './app.less';

const App = ({children, dispatch, app, user, astro, })=>{
    const { userInfo, admin, } = user;
    const { chartDisplay, appearanceMode, dayBoundary, lateZiHourMode, zeriSnapshotMaxRows, zeriSnapshotExplainRows, } = app;
    const currentTab = astro && astro.currentTab ? astro.currentTab : null;
    // 帮助弹窗要能认出子技法(如辅盘下的量化盘有自己那份手册)。
    const currentSubTab = astro && astro.currentSubTab ? astro.currentSubTab : null;
    const { Header, Content } = Layout;
    const [prefersDark, setPrefersDark] = React.useState(()=>{
        if(typeof window === 'undefined' || !window.matchMedia){
            return false;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    const resolvedAppearance = resolveAppearance(appearanceMode, prefersDark);

    // [V5-A3] 影子副本启动对账:主存(localStorage)键缺失而壳层镜像在 → 写回并提示;
    // 存在的主存永远优先(绝不覆盖)。非桌面环境 no-op。挂布局层与健康横幅同位。
    React.useEffect(()=>{
        reconcileShadowOnBoot().then((r)=>{
            if(r && r.restored && r.restored.length){
                message.info(`已从本机影子副本恢复 ${r.restored.length} 项本地档案数据`);
            }
        }).catch(()=>{});
        // [V5-B1] 自动备份心跳接线:壳侧每 30 分钟 emit,前端组 zip 回送写盘(内容没变自动跳过)。
        bindAutoBackupTicks();
        // AI 助手·外部智能体桥:总开关(默认关)开且在桌面壳内才挂钩;关=零挂钩零监听。
        bindMcpBridge();
        // [P1] 任务中心接线:启动对账(上次仍在跑的任务 → 中断);铃铛只在有任务/通知或行动能力开启时渲染=首启零变化
        bindTaskCenter();
        // [A4] 自动化引擎必须喂真依赖:selectSource / runBrief / archiveIdleConversations 三件公共动作(此前裸调=三件恒不可用)
        const automationDeps = buildDefaultAutomationDeps();
        bindAutomationEngine(automationDeps);
        // 多窗口:另一窗口改了 AI 助手偏好 → 本窗口重发偏好事件(订阅方重读)
        bindCrossWindowPrefs();
        emitAutomationEvent('app.start', {});
        // [P3] 定时任务接线:壳侧每 60 秒 __horosaSchedulerTick(偏好 scheduler_enabled 缺省关=壳零动作);页面按子开关决定跑不跑,缺省关=零定时器零执行
        bindSchedulerTicks();
        // [挂载自检] 真栈审计钩:仅 localStorage['horosa.debug.mountAudit']==='1' 时惰性装载(缺省键缺席=零路径零 chunk);
        // 暴露 window.__horosaMountAudit(无头重算/模块快照/段过滤同一份代码),供预览/自动化机读核对「无头重算=组件快照」。
        try{
            if(typeof localStorage !== 'undefined' && localStorage.getItem('horosa.debug.mountAudit') === '1'){
                import(/* webpackChunkName: "mount-audit-debug" */ '../utils/mountAuditDebug').then((m)=>m.installMountAuditHook()).catch(()=>{});
            }
        }catch(_e){ /* noop */ }
        // [FL-20260902-1] 桌面桥自检上报:全局/ACL 真值进壳侧账本(真机结论有据可查)
        reportDesktopBridgeDiag().catch(()=>{});
        // 页面侧请求失败计数进壳侧账本:后端离线跳变即报;此外每 10 分钟总数有变才报(无桥两者皆静默)。
        let prevOnline = null;
        const unsubServiceStatus = subscribeServiceStatus((isOnline)=>{
            if(prevOnline === true && !isOnline){
                reportPageTelemetry('offline').catch(()=>{});
            }
            prevOnline = !!isOnline;
        });
        let lastReportedTotal = 0;
        const telemetryTimer = typeof window !== 'undefined' ? window.setInterval(()=>{
            try{
                const total = requestTelemetrySnapshot().total;
                if(total !== lastReportedTotal){
                    lastReportedTotal = total;
                    reportPageTelemetry('periodic').catch(()=>{});
                }
            }catch(_e){ /* 上报失败绝不影响页面 */ }
        }, 10 * 60 * 1000) : null;
        // [V5-D15] 生日提醒(默认关;设置开启才扫):未来 7 天生日名单一次性卡片。
        try{
            if(remindersEnabled()){
                const ups = upcomingBirthdays(listLocalCharts({ includeArchived: false }), new Date(), 7);
                if(ups.length){
                    notification.info({
                        message: '近期生日提醒',
                        description: ups.slice(0, 6).map((u)=>`${u.name} · ${u.date}${u.inDays === 0 ? '（今天' : `（${u.inDays} 天后`}满 ${u.turnsAge} 岁${u.decade ? '，整寿' : ''}）`).join('；'),
                        duration: 12,
                    });
                }
            }
        }catch(_e){ /* 提醒失败绝不影响启动 */ }
        return ()=>{
            unsubServiceStatus();
            if(telemetryTimer !== null){
                window.clearInterval(telemetryTimer);
            }
            // [D81] 非桌面 60 秒兜底定时器此前没有解绑出口
            try{ unbindSchedulerTicks(); }catch(_e){ /* noop: 卸载期拆定时器失败无害 */ }
        };
    }, []);

    React.useEffect(()=>{
        if(typeof window === 'undefined' || !window.matchMedia){
            return;
        }
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (evt)=>{
            setPrefersDark(!!evt.matches);
        };
        if(media.addEventListener){
            media.addEventListener('change', handleChange);
        }else if(media.addListener){
            media.addListener(handleChange);
        }
        setPrefersDark(!!media.matches);
        return ()=>{
            if(media.removeEventListener){
                media.removeEventListener('change', handleChange);
            }else if(media.removeListener){
                media.removeListener(handleChange);
            }
        };
    }, []);

    React.useEffect(()=>{
        applyAppearanceToDocument(appearanceMode, resolvedAppearance);
        applyLightFlavorToDocument(getStoredLightFlavor()); // 亮色配色档(宣纸/经典白)开机回放
        if(dispatch){
            dispatch({
                type: 'app/save',
                payload: {
                    resolvedAppearance: resolvedAppearance,
                },
            });
        }
    }, [appearanceMode, resolvedAppearance]);

    function menuClick({item, key, keyPath}){
        dispatch({
            type: 'app/menuClick',
            payload: {
                item: item,
                key: key,
                keyPath: keyPath,
            },
        });
    }

    syncChartPalette(resolvedAppearance);   // 盘面调色板与外观的映射只住 utils/appearance.js(render 期先同步一次,首帧盘即正确;effect 期 applyAppearanceToDocument 再广播重画)

    let mainstyle = {
        position: 'fixed',
        inset: 0,
        width: '100%',
        // 🔴 勿用 100vh:缩放补偿域(html zoom)里 vh 钉物理视口不缩放,会把根壳钉矮
        // 造成恒定底空;100% 沿 body 补偿链传导,1:1 时与 100vh 等值(fixed inset:0 定界)。
        height: '100%',
        overflow: 'hidden',
        background: 'var(--horosa-bg)',
        color: 'var(--horosa-text)',
        stroke: 'var(--horosa-text)',
    };
    const astroHeaderBg = resolvedAppearance === APPEARANCE_DARK ? '#050607' : 'var(--horosa-header-bg)';
    const astroHeaderBorder = resolvedAppearance === APPEARANCE_DARK ? 'rgba(215, 173, 105, 0.18)' : 'var(--horosa-border)';
    let headerstyle = {
        position: 'fixed', width:'100%', zIndex: 100,
        backgroundColor: astroHeaderBg,
        height:72, padding: 0,
        borderBottom: '1px solid',
        borderBottomColor: astroHeaderBorder,
        color: 'var(--horosa-text)',
        stroke: 'var(--horosa-text)',
    };
    let contentStyle = {
        marginTop: 72,
        // 🔴 同上勿用 100vh(域劈叉:clientHeight 物理域 vs vh 布局域,缩放≠1 时两口径
        // 差出可平移空间=拖选后整页滚动的元凶);100% 基=根壳链,恒同域。
        height: 'calc(100% - 72px)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundColor: 'var(--horosa-bg)',
        color: 'var(--horosa-text)',
        stroke: 'var(--horosa-text)',
    };

    return (
        <Layout
            className={`${styles.horosaAppShell} horosa-workspace-shell`}
            data-appearance={resolvedAppearance}
            style={mainstyle}
        >
            <Header className="horosa-astro-header" style={headerstyle}>
                <PageHeader
                    admin={admin}
                    chartDisplay={chartDisplay}
                    appearanceMode={appearanceMode}
                    dayBoundary={dayBoundary}
                    lateZiHourMode={lateZiHourMode}
                    zeriSnapshotMaxRows={zeriSnapshotMaxRows}
                    zeriSnapshotExplainRows={zeriSnapshotExplainRows}
                    resolvedAppearance={resolvedAppearance}
                    currentTab={currentTab}
                    currentSubTab={currentSubTab}
                    userInfo={userInfo}
                    onMenuClick={menuClick}
                    dispatch={dispatch}
                />
            </Header>

            <Content id='mainContent' style={contentStyle}>
                <div className={styles.workspaceOuter}>
                    <BackTop visibilityHeight={50}/>
                    <div className={styles.workspaceInner}>
                        {children}
                    </div>
                </div>
            </Content>

            <div id='globalFooter' style={{height: 0, overflow: 'hidden'}} />
            <UpdateNotifier />
            <ServiceStatusBanner />
            <LocalStoreHealthBanner />
            <MultiInstanceNotice />
            <TaskCenterBell />
            <BackendStatusDot />
            <StartupGate />
        </Layout>
    );
};


function mapStateToProps(state){
    const { app, user, router, astro } = state;
    const { location } = router;
    const { query } = location;

    return {
        app: app,
        user: user,
        astro: astro,
        query: query,
    };
}


export default connect(mapStateToProps)(App);
