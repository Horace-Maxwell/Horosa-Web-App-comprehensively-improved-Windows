import React from 'react';
import { connect  } from 'dva';
import { Layout,  BackTop,  } from 'antd';
import * as AstroConst from '../constants/AstroConst';
import PageHeader from '../components/homepage/PageHeader';
import UpdateNotifier from '../components/update/UpdateNotifier';
import ServiceStatusBanner from '../components/common/ServiceStatusBanner';
import StartupGate from '../components/common/StartupGate';
import BackendStatusDot from '../components/common/BackendStatusDot';
import {
    APPEARANCE_DARK,
    applyAppearanceToDocument,
    applyLightFlavorToDocument,
    getStoredLightFlavor,
    resolveAppearance,
} from '../utils/appearance';
import styles from './app.less';

const App = ({children, dispatch, app, user, astro, })=>{
    const { userInfo, admin, } = user;
    const { chartDisplay, appearanceMode, dayBoundary, lateZiHourMode,} = app;
    const currentTab = astro && astro.currentTab ? astro.currentTab : null;
    const { Header, Content } = Layout;
    const [prefersDark, setPrefersDark] = React.useState(()=>{
        if(typeof window === 'undefined' || !window.matchMedia){
            return false;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    const resolvedAppearance = resolveAppearance(appearanceMode, prefersDark);

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

    AstroConst.setColorTheme(resolvedAppearance === APPEARANCE_DARK ? 8 : AstroConst.DefaultColorTheme);

    let mainstyle = {
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100vh',
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
        height: 'calc(100vh - 72px)',
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
                    resolvedAppearance={resolvedAppearance}
                    currentTab={currentTab}
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
