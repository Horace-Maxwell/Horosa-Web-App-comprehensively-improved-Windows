import React, { lazy, Suspense } from 'react';
import { connect } from 'dva';
import { Drawer, Tabs, Row, Col, Button, Spin, } from 'antd';
import DateTime from '../components/comp/DateTime';
import AstroFormComp from '../components/astro/AstroFormComp';
import AspSelector from '../components/astro/AspSelector';
import PlanetSelector from '../components/astro/PlanetSelector';
import ChartDisplaySelector from '../components/astro/ChartDisplaySelector';
import ChartMemo from '../components/comp/ChartMemo';
import HomePageSetup from '../components/HomePageSetup';
import * as AstroConst from '../constants/AstroConst';
import {convertToArray} from '../utils/helper';
import { warmupCache } from '../utils/preciseCalcBridge';

// 懒加载组件 - 只有在用户切换到对应Tab时才加载
const LoginForm = lazy(() => import('../components/user/LoginForm'));
const RegisterForm = lazy(() => import('../components/user/RegisterForm'));
const ResetPwdForm = lazy(() => import('../components/user/ResetPwdForm'));
const ChangePwdForm = lazy(() => import('../components/user/ChangePwdForm'));
const ChangeParamsFormComp = lazy(() => import('../components/user/ChangeParamsFormComp'));
const ChartAddFormComp = lazy(() => import('../components/user/ChartAddFormComp'));
const ChartEditFormComp = lazy(() => import('../components/user/ChartEditFormComp'));
const ChartList = lazy(() => import('../components/user/ChartList'));
const CaseAddFormComp = lazy(() => import('../components/user/CaseAddFormComp'));
const CaseEditFormComp = lazy(() => import('../components/user/CaseEditFormComp'));
const CaseList = lazy(() => import('../components/user/CaseList'));
const AstroChartMain = lazy(() => import('../components/astro/AstroChartMain'));
const AstroChartMain3D = lazy(() => import('../components/astro3d/AstroChartMain3D'));
const HellenAstroMain = lazy(() => import('../components/hellenastro/HellenAstroMain'));
const LocAstroMain = lazy(() => import('../components/loc/LocAstroMain'));
const IndiaChartMain = lazy(() => import('../components/astro/IndiaChartMain'));
const AstroRelative = lazy(() => import('../components/astro/AstroRelative'));
const AstroDirectMain = lazy(() => import('../components/direction/AstroDirectMain'));
const ChartsGps = lazy(() => import('../components/user/ChartsGps'));
const AstroGermany = lazy(() => import('../components/germany/AstroGermany'));
const JieQiChartsMain = lazy(() => import('../components/jieqi/JieQiChartsMain'));
const CnTraditionMain = lazy(() => import('../components/cntradition/CnTraditionMain'));
const loadCnYiBuMain = () => import('../components/cnyibu/CnYiBuMain');
const CnYiBuMain = lazy(loadCnYiBuMain);
const CalendarMain = lazy(() => import('../components/calendar/CalendarMain'));
const OtherBuMain = lazy(() => import('../components/otherbu/OtherBuMain'));
const FengShuiMain = lazy(() => import('../components/fengshui/FengShuiMain'));
const loadSanShiUnitedMain = () => import('../components/sanshi/SanShiUnitedMain');
const SanShiUnitedMain = lazy(loadSanShiUnitedMain);
const BookMain = lazy(() => import('../components/reader/BookMain'));
const MediaMain = lazy(() => import('../components/multimedia/MediaMain'));
const AdminToolsMain = lazy(() => import('../components/admintools/AdminToolsMain'));
const GuoLaoChartMain = lazy(() => import('../components/guolao/GuoLaoChartMain'));
const CommToolsMain = lazy(() => import('../components/commtools/CommToolsMain'));
const DLFeature = lazy(() => import('../components/deeplearn/DLFeature'));

// 加载中的占位组件
const LoadingFallback = () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin tip="加载中..." /></div>;

const TabPane = Tabs.TabPane;
const PRECISE_WARMUP_TABS = new Set(['cnyibu', 'sanshiunited', 'cntradition', 'jieqichart']);

function AstroIndex({dispatch, astro, app, user, rules, }){
    const { tokenImg, registerFields, loginFields, loading, loadingText, refresh, chartDisplay, aspects, planetDisplay, lotsDisplay, colorTheme, showPdBounds} = app;
    const {
        pwdFields,
        userInfo,
        charts,
        currentChart,
        admin,
        pageSize,
        pageIndex,
        total,
        cases,
        currentCase,
        casePageSize,
        casePageIndex,
        caseTotal,
    } = user;
 	const { height, fields, chartObj, drawerVisible, predictHook, memo, memoType, currentTab, currentSubTab, deeplearn, chartPerf} = astro;
    const { ziwei, } = rules; 
    const bootWarmupRef = React.useRef(false);

    function shouldWarmupForTab(tabKey){
        return PRECISE_WARMUP_TABS.has(tabKey);
    }

    function warmupPreciseCalc(flds){
        if(!flds || !flds.date || !flds.time || !flds.zone || !flds.lon || !flds.lat){
            return;
        }
        try{
            // 仅预热当前参数相关数据，避免后台请求拥塞。
            warmupCache({
                date: flds.date.value.format('YYYY-MM-DD'),
                time: flds.time.value.format('HH:mm:ss'),
                zone: flds.zone.value,
                lon: flds.lon.value,
                lat: flds.lat.value,
                gpsLat: flds.gpsLat ? flds.gpsLat.value : '',
                gpsLon: flds.gpsLon ? flds.gpsLon.value : '',
                ad: flds.ad ? flds.ad.value : 1,
                gender: flds.gender ? flds.gender.value : 1,
            }, { mode: 'light' });
        }catch(e){
            // ignore warmup failures
        }
    }

    React.useEffect(()=>{
        if(bootWarmupRef.current){
            return;
        }
        bootWarmupRef.current = true;
        const preloadHeavyTabs = ()=>{
            loadCnYiBuMain().catch(()=>null);
            loadSanShiUnitedMain().catch(()=>null);
        };
        if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
            window.requestIdleCallback(preloadHeavyTabs, { timeout: 1200 });
        }else{
            setTimeout(preloadHeavyTabs, 220);
        }
        warmupPreciseCalc(fields);
    }, [fields]);

    function closeDrawer(){
        dispatch({
            type: 'astro/closeDrawer',
            payload:{},
        });
    }

    function changeTab(key){
        if(shouldWarmupForTab(key)){
            warmupPreciseCalc(fields);
        }
        if(predictHook[key] && predictHook[key].fun){
            if(key === 'indiachart' || key === 'cntradition' || key === 'jieqichart'
                || key === 'otherbu' || key === 'cnyibu' || key === 'germanytech'
                || key === 'guolao' || key === 'hellenastro'  || key === 'astrochart'
                || key === 'locastro' || key === 'admintools' || key === 'astrochart3D'
                || key === 'fengshui' || key === 'sanshiunited'){
                predictHook[key].fun(fields);
            }else if(key === 'astroreader'){
                predictHook[key].fun();
            }else{
                predictHook[key].fun(chartObj);
            }
        }
        
        dispatch({
            type: 'astro/save',
            payload:{ 
                chartObj: chartObj,
                currentTab: key,
            },
        });    

    }

    function changeCond(values){
        let flds = {
            ...fields,
        };  
        if(values.nohook){
            flds.nohook = true;
        }  

        if(values.tm !== undefined && values.tm != null){
            let birth = values.tm;
            flds.date.value = birth.clone();
            flds.time.value = birth.clone();
            flds.ad.value = birth.ad;
            flds.zone.value = birth.zone
        }

        if(values.hsys !== undefined && values.hsys !== null){
            flds.hsys.value = values.hsys;
        }
        if(values.zodiacal !== undefined && values.zodiacal !== null){
            flds.zodiacal.value = values.zodiacal;
        }
        if(values.lon !== undefined && values.lon !== null){
            flds.lon.value = values.lon;
            flds.lat.value = values.lat;
            flds.gpsLon.value = values.gpsLon;
            flds.gpsLat.value = values.gpsLat;
        }
        if(values.southchart !== undefined && values.southchart !== null){
            flds.southchart.value = values.southchart;
        }
        if(flds.lat.value >= 0){
            let lat = flds.lat.value;
            if(lat.toLowerCase().indexOf('n') >= 0){
                flds.southchart.value = 0;
            }
        }

        console.log("changeCond");
        dispatch({
            type: 'astro/fetchByFields',
            payload: flds,
        });    
        if(shouldWarmupForTab(currentTab)){
            warmupPreciseCalc(flds);
        }

        return flds;
    }

    function endRefresh(){
        setTimeout(()=>{
            dispatch({
                type: 'app/endRefresh',
                payload: {},
            });               
        }, 1000);
    }
    
    const themeIdx = AstroConst.normalizeColorThemeIndex(colorTheme);
    AstroConst.setColorTheme(themeIdx);
    
    let idxstyle = {
        backgroundColor: AstroConst.AstroColor.Backgroud,
        height: height-50,
    };

    if(refresh){
        endRefresh();
    }

    let tip = '载入中...';
    if(loadingText){
        tip = loadingText;
    }

    let aryfields = convertToArray(fields);
    let arychartflds = convertToArray(currentChart);
    let arycaseflds = convertToArray(currentCase);
    let aryregflds = convertToArray(registerFields);
    let aryloginflds = convertToArray(loginFields);

	return (
		<div style={idxstyle}>
        <Spin spinning={loading} size="large" tip={tip}>
            <Tabs 
                defaultActiveKey="astrochart" tabPosition='left' onChange={changeTab}
                activeKey={currentTab}
                style={{ height: height }}
            >
                <TabPane tab="星盘" key="astrochart">
                    <Suspense fallback={<LoadingFallback />}>
                        <AstroChartMain
                            value={chartObj}
                            onChange={changeCond}
                            fields={fields}
                            fieldsAry={aryfields}
                            height={height}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            lotsDisplay={lotsDisplay}
                            chartPerf={chartPerf}
                            dispatch={dispatch}
                            hook={predictHook.astrochart}
                        />
                    </Suspense>
                </TabPane>

                {
                    true && (
                    <TabPane tab="三维盘" key="astrochart3D">
                        <Suspense fallback={<LoadingFallback />}>
                            <AstroChartMain3D
                                value={chartObj}
                                onChange={changeCond}
                                fields={fields}
                                fieldsAry={aryfields}
                                height={height}
                                currentTab={currentTab}
                                chartDisplay={chartDisplay}
                                planetDisplay={planetDisplay}
                                lotsDisplay={lotsDisplay}
                                dispatch={dispatch}
                                hook={predictHook.astrochart3D}
                            />
                        </Suspense>
                    </TabPane>
                    )
                }

                <TabPane tab="推运盘" key="direction">
                    <Suspense fallback={<LoadingFallback />}>
                        <AstroDirectMain
                            height={height}
                            fields={fields}
                            fieldsAry={aryfields}
                            chartObj={chartObj}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            lotsDisplay={lotsDisplay}
                            hook={predictHook.direction}
                            dispatch={dispatch}
                            currentSubTab={currentSubTab}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="量化盘" key="germanytech">
                    <Suspense fallback={<LoadingFallback />}>
                        <AstroGermany
                            onChange={changeCond}
                            fields={fields}
                            fieldsAry={aryfields}
                            height={height}
                            chart={chartObj}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            lotsDisplay={lotsDisplay}
                            hook={predictHook.germanytech}
                            dispatch={dispatch}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="关系盘" key="relativechart">
                    <Suspense fallback={<LoadingFallback />}>
                        <AstroRelative
                            fields={fields}
                            fieldsAry={aryfields}
                            height={height}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            lotsDisplay={lotsDisplay}
                            hook={predictHook.relativechart}
                            dispatch={dispatch}
                            currentSubTab={currentSubTab}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="节气盘" key="jieqichart">
                    <Suspense fallback={<LoadingFallback />}>
                        <JieQiChartsMain
                            height={height}
                            fields={fields}
                            fieldsAry={aryfields}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            lotsDisplay={lotsDisplay}
                            hook={predictHook.jieqichart}
                            dispatch={dispatch}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="星体地图" key="locastro">
                    <Suspense fallback={<LoadingFallback />}>
                        <LocAstroMain
                            value={chartObj}
                            onChange={changeCond}
                            fields={fields}
                            fieldsAry={aryfields}
                            height={height}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            lotsDisplay={lotsDisplay}
                            hook={predictHook.locastro}
                            dispatch={dispatch}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="七政四余" key="guolao">
                    <Suspense fallback={<LoadingFallback />}>
                        <GuoLaoChartMain
                            value={chartObj}
                            onChange={changeCond}
                            fields={fields}
                            fieldsAry={aryfields}
                            height={height}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            lotsDisplay={lotsDisplay}
                            hook={predictHook.guolao}
                            dispatch={dispatch}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="希腊星术" key="hellenastro">
                    <Suspense fallback={<LoadingFallback />}>
                        <HellenAstroMain
                            value={chartObj}
                            onChange={changeCond}
                            fields={fields}
                            fieldsAry={aryfields}
                            height={height}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            lotsDisplay={lotsDisplay}
                            hook={predictHook.hellenastro}
                            dispatch={dispatch}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="印度律盘" key="indiachart">
                    <Suspense fallback={<LoadingFallback />}>
                        <IndiaChartMain
                            onChange={changeCond}
                            fields={fields}
                            fieldsAry={aryfields}
                            height={height}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            lotsDisplay={lotsDisplay}
                            hook={predictHook.indiachart}
                            dispatch={dispatch}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="八字紫微" key="cntradition">
                    <Suspense fallback={<LoadingFallback />}>
                        <CnTraditionMain
                            chart={chartObj}
                            height={height}
                            fields={fields}
                            fieldsAry={aryfields}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            hook={predictHook.cntradition}
                            dispatch={dispatch}
                            currentSubTab={currentSubTab}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="易与三式" key="cnyibu">
                    <Suspense fallback={<LoadingFallback />}>
                        <CnYiBuMain
                            chart={chartObj}
                            height={height}
                            fields={fields}
                            fieldsAry={aryfields}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            hook={predictHook.cnyibu}
                            dispatch={dispatch}
                            currentSubTab={currentSubTab}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="万年历" key="calendar">
                    <Suspense fallback={<LoadingFallback />}>
                        <CalendarMain
                            height={height}
                            fields={fields}
                            fieldsAry={aryfields}
                            hook={predictHook.calendar}
                            dispatch={dispatch}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="西洋游戏" key="otherbu">
                    <Suspense fallback={<LoadingFallback />}>
                        <OtherBuMain
                            height={height}
                            fields={fields}
                            fieldsAry={aryfields}
                            chartDisplay={chartDisplay}
                            planetDisplay={planetDisplay}
                            hook={predictHook.otherbu}
                            dispatch={dispatch}
                        />
                    </Suspense>
                </TabPane>

                {
                    userInfo && (
                        <TabPane tab="书籍阅读" key="astroreader">
                            <Suspense fallback={<LoadingFallback />}>
                                <BookMain
                                    height={height}
                                    userInfo={userInfo}
                                    dispatch={dispatch}
                                    hook={predictHook.astroreader}
                                />
                            </Suspense>
                        </TabPane>
                    )
                }

                {
                    userInfo && (
                        <TabPane tab="星阙直播" key="liveplayer">
                            <Suspense fallback={<LoadingFallback />}>
                                <MediaMain
                                    height={height}
                                    dispatch={dispatch}
                                    userInfo={userInfo}
                                    currentSubTab={currentSubTab}
                                    admin={admin}
                                />
                            </Suspense>
                        </TabPane>
                    )
                }

                {
                    admin && (
                        <TabPane tab="管理工具" key="admintools">
                            <Suspense fallback={<LoadingFallback />}>
                                <AdminToolsMain />
                            </Suspense>
                        </TabPane>
                    )
                }

                <TabPane tab="风水" key="fengshui">
                    <Suspense fallback={<LoadingFallback />}>
                        <FengShuiMain
                            height={height}
                            fields={fields}
                            fieldsAry={aryfields}
                            dispatch={dispatch}
                        />
                    </Suspense>
                </TabPane>

                <TabPane tab="三式合一" key="sanshiunited">
                    <Suspense fallback={<LoadingFallback />}>
                        <SanShiUnitedMain
                            height={height}
                            fields={fields}
                            fieldsAry={aryfields}
                            chartObj={chartObj}
                            dispatch={dispatch}
                            hook={predictHook.sanshiunited}
                        />
                    </Suspense>
                </TabPane>

            </Tabs>

            <Drawer
                title='星盘配置'
                width={720}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.query}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <AstroFormComp 
                    { ...fields }
                    fields={fields}
                    fieldsAry={aryfields}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='注册'
                width={300}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.register}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <RegisterForm
                        {...registerFields}
                        tokenImg={tokenImg}
                        fields={registerFields}
                        fieldsAry={aryregflds}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='登录'
                width={300}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.login}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <LoginForm
                        {...loginFields}
                        fields={loginFields}
                        fieldsAry={aryloginflds}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='忘记密码'
                width={300}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.resetpwd}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <ResetPwdForm
                        {...registerFields}
                        tokenImg={tokenImg}
                        fields={registerFields}
                        fieldsAry={aryregflds}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='修改密码'
                width={300}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.changepwd}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <ChangePwdForm
                        {...pwdFields}
                        fields={pwdFields}
                        fieldsAry={convertToArray(pwdFields)}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='修改参数'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.changeparams}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <ChangeParamsFormComp
                        {...fields}
                        fields={fields}
                        fieldsAry={aryfields}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='添加星盘'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.chartadd}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <ChartAddFormComp
                        {...currentChart}
                        fields={currentChart}
                        fieldsAry={arychartflds}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='编辑星盘'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.chartedit}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <ChartEditFormComp
                        {...currentChart}
                        fields={currentChart}
                        fieldsAry={arychartflds}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='星盘列表'
                width={950}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={false}
                open={drawerVisible.chartlist}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <ChartList
                        height={height}
                        userInfo={userInfo}
                        charts={charts}
                        pageSize={pageSize}
                        pageIndex={pageIndex}
                        total={total}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='添加起课'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.caseadd}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <CaseAddFormComp
                        {...currentCase}
                        fields={currentCase}
                        fieldsAry={arycaseflds}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='编辑起课'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.caseedit}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <CaseEditFormComp
                        {...currentCase}
                        fields={currentCase}
                        fieldsAry={arycaseflds}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='起课列表'
                width={950}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={false}
                open={drawerVisible.caselist}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <CaseList
                        height={height}
                        userInfo={userInfo}
                        cases={cases}
                        casePageSize={casePageSize}
                        casePageIndex={casePageIndex}
                        caseTotal={caseTotal}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='相位选择'
                width={250}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.selectasp}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <AspSelector
                    value={aspects}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='行星选择'
                width={250}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.selectplanet}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <PlanetSelector
                    value={planetDisplay}
                    lots={lotsDisplay}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='星盘组件'
                width={300}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.selectchartdisplay}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ChartDisplaySelector
                    value={chartDisplay}
                    showPdBounds={fields && fields.showPdBounds ? fields.showPdBounds.value : showPdBounds}
                    fields={fields}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='我的星盘分布'
                width={900}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.chartsgps}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <ChartsGps
                        height={height}
                        charts={charts}
                        userInfo={userInfo}
                        dispatch={dispatch}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='命盘批注'
                width={500}
                placement="right"
                destroyOnClose={true}
                onClose={closeDrawer}
                maskClosable={true}
                open={drawerVisible.memo}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <ChartMemo
                    memoType={memoType}
                    memo={memo}
                    currentSubTab={currentSubTab}
                    currentTab={currentTab}
                    userInfo={userInfo}
                    currentChart={currentChart}
                    dispatch={dispatch}
                    loading={loading}
                />
            </Drawer>

            <Drawer
                title='小工具'
                width={960}
                placement="left"
                destroyOnClose={true}
                onClose={closeDrawer}
                maskClosable={true}
                open={drawerVisible.commtools}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <CommToolsMain
                        fields={fields}
                        dispatch={dispatch}
                        loading={loading}
                    />
                </Suspense>
            </Drawer>

            <Drawer
                title='人生事件设置'
                width={1000}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={false}
                open={drawerVisible.chartdeeplearn}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <DLFeature
                        {...currentChart}
                        fields={currentChart}
                    fieldsAry={arychartflds}
                    deeplearn={deeplearn}
                    height={height} 
                    dispatch={dispatch}
                    loading={loading}
                />
            </Drawer>

            <Drawer
                title='首页设置'
                width={200}
                placement="left"
                destroyOnClose={true}
                onClose={closeDrawer}
                maskClosable={true}
                open={drawerVisible.homepage}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <HomePageSetup
                    dispatch={dispatch}
                    loading={loading}
                />
            </Drawer>

        </Spin>
		</div>
	);
}

function mapStateToProps(state){
    const { astro, app, user, rules, } = state;

    return {
		astro: astro,
        app: app,
        user: user,
        rules: rules,
    };
}

export default connect(mapStateToProps)(AstroIndex);
