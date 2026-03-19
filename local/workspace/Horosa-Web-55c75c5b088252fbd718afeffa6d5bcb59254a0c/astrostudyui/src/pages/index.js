import React, { Suspense } from 'react';
import { connect  } from 'dva';
import { Drawer, Tabs, Row, Col, Button, Spin, } from 'antd';
import DateTime from '../components/comp/DateTime';
import LoginForm from '../components/user/LoginForm';
import RegisterForm from '../components/user/RegisterForm';
import ResetPwdForm from '../components/user/ResetPwdForm';
import ChangePwdForm from '../components/user/ChangePwdForm';
import ChangeParamsFormComp from '../components/user/ChangeParamsFormComp';
import ChartAddFormComp from '../components/user/ChartAddFormComp';
import ChartEditFormComp from '../components/user/ChartEditFormComp';
import ChartList from '../components/user/ChartList';
import CaseAddFormComp from '../components/user/CaseAddFormComp';
import CaseEditFormComp from '../components/user/CaseEditFormComp';
import CaseList from '../components/user/CaseList';
import AstroFormComp from '../components/astro/AstroFormComp';
import AstroChartMain from '../components/astro/AstroChartMain';
import HellenAstroMain from '../components/hellenastro/HellenAstroMain';
import IndiaChartMain from '../components/astro/IndiaChartMain';
import AstroRelative from '../components/astro/AstroRelative';
import AstroDirectMain from '../components/direction/AstroDirectMain';
import AspSelector from '../components/astro/AspSelector';
import PlanetSelector from '../components/astro/PlanetSelector';
import ChartDisplaySelector from '../components/astro/ChartDisplaySelector';
import ChartMemo from '../components/comp/ChartMemo';
import AstroGermany from '../components/germany/AstroGermany';
import JieQiChartsMain from '../components/jieqi/JieQiChartsMain';
import CnTraditionMain from '../components/cntradition/CnTraditionMain';
import CnYiBuMain from '../components/cnyibu/CnYiBuMain';
import CalendarMain from '../components/calendar/CalendarMain';
import OtherBuMain from '../components/otherbu/OtherBuMain';
import FengShuiMain from '../components/fengshui/FengShuiMain';
import SanShiUnitedMain from '../components/sanshi/SanShiUnitedMain';
import GuoLaoChartMain from '../components/guolao/GuoLaoChartMain';
import HomePageSetup from '../components/HomePageSetup';
import ModuleErrorBoundary from '../components/comp/ModuleErrorBoundary';
import * as AstroConst from '../constants/AstroConst';
import {convertToArray} from '../utils/helper';

const AstroChartMain3D = React.lazy(()=>import('../components/astro3d/AstroChartMain3D'));
const LocAstroMain = React.lazy(()=>import('../components/loc/LocAstroMain'));
const ChartsGps = React.lazy(()=>import('../components/user/ChartsGps'));
const BookMain = React.lazy(()=>import('../components/reader/BookMain'));
const MediaMain = React.lazy(()=>import('../components/multimedia/MediaMain'));
const AdminToolsMain = React.lazy(()=>import('../components/admintools/AdminToolsMain'));
const CommToolsMain = React.lazy(()=>import('../components/commtools/CommToolsMain'));
const DLFeature = React.lazy(()=>import('../components/deeplearn/DLFeature'));

const TabPane = Tabs.TabPane;
let fetchByFieldsTimer = null;
const MAIN_TAB_LABELS = {
	astrochart: '星盘',
	astrochart3D: '三维盘',
	direction: '推运盘',
	germanytech: '量化盘',
	relativechart: '关系盘',
	jieqichart: '节气盘',
	locastro: '星体地图',
	guolao: '七政四余',
	hellenastro: '希腊星术',
	indiachart: '印度律盘',
	cntradition: '八字紫微',
	cnyibu: '易与三式',
	calendar: '万年历',
	otherbu: '西洋游戏',
	astroreader: '书籍阅读',
	liveplayer: '星阙直播',
	admintools: '管理工具',
	fengshui: '风水',
	sanshiunited: '三式合一',
};

function LazySection(props){
	return (
		<Suspense
			fallback={
				<div style={{display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100%'}}>
					<Spin size='large' tip='模块加载中...' />
				</div>
			}
		>
			{props.children}
		</Suspense>
	);
}

function AstroIndex({dispatch, astro, app, user, rules, }){
    const { tokenImg, registerFields, loginFields, loading, loadingText, refresh, chartDisplay, aspects, planetDisplay, lotsDisplay, colorTheme, showPdBounds, showPlanetHouseInfo, showAstroMeaning, showAstroAnnotation, showOnlyRulExaltReception, planetMetaDisplay} = app;
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
 	const { height, fields, chartObj, drawerVisible, predictHook, memo, memoType, currentTab, currentSubTab, deeplearn} = astro;
    const { ziwei, } = rules; 

    
	function closeDrawer(){
        dispatch({
            type: 'astro/closeDrawer',
            payload:{},
        });
	}

	function goSafeMainPage(){
		dispatch({
			type: 'astro/save',
			payload: {
				currentTab: 'astrochart',
				currentSubTab: null,
			},
		});
	}

	function renderProtectedModule(moduleName, node, options = {}){
		return (
			<ModuleErrorBoundary
				moduleName={moduleName}
				resetKey={options.resetKey || moduleName}
				onClose={options.onClose}
				onGoSafe={options.onGoSafe || goSafeMainPage}
			>
				{node}
			</ModuleErrorBoundary>
		);
	}

    function changeTab(key){
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

        const isUnconfirmedTime = values && values.tm !== undefined && values.tm !== null && values.confirmed === false;
        if(isUnconfirmedTime){
            if(fetchByFieldsTimer){
                clearTimeout(fetchByFieldsTimer);
            }
            const queuedPayload = {
                ...flds,
                __requestOptions: {
                    silent: true,
                },
            };
            fetchByFieldsTimer = setTimeout(()=>{
                dispatch({
                    type: 'astro/fetchByFields',
                    payload: queuedPayload,
                });
                fetchByFieldsTimer = null;
            }, 180);
            return flds;
        }

        if(fetchByFieldsTimer){
            clearTimeout(fetchByFieldsTimer);
            fetchByFieldsTimer = null;
        }

        dispatch({
            type: 'astro/fetchByFields',
            payload: flds,
        });

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
        height: height,
        maxHeight: height,
        overflow: 'hidden',
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
            {renderProtectedModule(
                MAIN_TAB_LABELS[currentTab] || '当前模块',
                <Tabs 
                    defaultActiveKey="astrochart" tabPosition='left' onChange={changeTab}
                    activeKey={currentTab}
                    className='mainRootTabs'
                    style={{ height: height }}
                >
                <TabPane tab="星盘" key="astrochart">
	                    <AstroChartMain 
	                        value={chartObj} 
                        onChange={changeCond}
                        fields={fields} 
                        fieldsAry={aryfields}
                        height={height} 
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        dispatch={dispatch}
	                        hook={predictHook.astrochart}
	                    />
                </TabPane>

                {
                    true && (
                    <TabPane tab="三维盘" key="astrochart3D">
                        <LazySection>
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
	                            showPlanetHouseInfo={showPlanetHouseInfo}
	                            showAstroMeaning={showAstroMeaning}
	                            dispatch={dispatch}
	                            hook={predictHook.astrochart3D}
	                        />
                        </LazySection>
                    </TabPane>   
                    )
                }

                <TabPane tab="推运盘" key="direction">
	                    <AstroDirectMain
                        active={currentTab === 'direction'}
                        height={height} 
                        fields={fields}
                        fieldsAry={aryfields}
                        chartObj={chartObj}
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        hook={predictHook.direction}
	                        dispatch={dispatch}
	                        currentSubTab={currentSubTab}
                    />
                </TabPane>

                <TabPane tab="量化盘" key="germanytech">
	                    <AstroGermany
                        onChange={changeCond}
                        fields={fields} 
                        fieldsAry={aryfields}
                        height={height} 
                        chart={chartObj}
	                        chartDisplay={chartDisplay}
	                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showAstroMeaning={showAstroMeaning}
	                        hook={predictHook.germanytech}
	                        dispatch={dispatch}
	                    />
                </TabPane>

                <TabPane tab="关系盘" key="relativechart">
	                    <AstroRelative
                        fields={fields} 
                        fieldsAry={aryfields}
                        height={height} 
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        hook={predictHook.relativechart}
	                        dispatch={dispatch}
	                        currentSubTab={currentSubTab}
                    />
                </TabPane>

                <TabPane tab="节气盘" key="jieqichart">
	                    <JieQiChartsMain
                        height={height} 
                        fields={fields}
                        fieldsAry={aryfields}
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        hook={predictHook.jieqichart}
	                        dispatch={dispatch}
	                    />
                </TabPane>

                <TabPane tab="星体地图" key="locastro">
                    <LazySection>
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
                    </LazySection>
                </TabPane>

                <TabPane tab="七政四余" key="guolao">
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
                </TabPane>

                <TabPane tab="希腊星术" key="hellenastro">
	                    <HellenAstroMain 
                        value={chartObj} 
                        onChange={changeCond}
                        fields={fields} 
                        fieldsAry={aryfields}
                        height={height} 
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        hook={predictHook.hellenastro}
	                        dispatch={dispatch}
	                    />
                </TabPane>

                <TabPane tab="印度律盘" key="indiachart">
	                    <IndiaChartMain
                        onChange={changeCond}
                        fields={fields} 
                        fieldsAry={aryfields}
                        height={height} 
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        hook={predictHook.indiachart}
	                        dispatch={dispatch}
	                    />
                </TabPane>

                <TabPane tab="八字紫微" key="cntradition">
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
                </TabPane>

                <TabPane tab="易与三式" key="cnyibu">
                    <CnYiBuMain
                        active={currentTab === 'cnyibu'}
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
                </TabPane>

                <TabPane tab="万年历" key="calendar">
                    <CalendarMain
                        height={height} 
                        fields={fields}
                        fieldsAry={aryfields}
                        hook={predictHook.calendar}
                        dispatch={dispatch}
                    />
                </TabPane>

                <TabPane tab="西洋游戏" key="otherbu">
	                    <OtherBuMain
                        height={height} 
                        fields={fields}
                        fieldsAry={aryfields}
	                        chartDisplay={chartDisplay}
	                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showAstroMeaning={showAstroMeaning}
	                        hook={predictHook.otherbu}
	                        dispatch={dispatch}
	                    />
                </TabPane>

                {
                    userInfo && (
                        <TabPane tab="书籍阅读" key="astroreader">
                            <LazySection>
                            <BookMain 
                                height={height}
                                userInfo={userInfo}
                                dispatch={dispatch}
                                hook={predictHook.astroreader}
                            />
                            </LazySection>
                        </TabPane>
                    )
                }

                {
                    userInfo && (
                        <TabPane tab="星阙直播" key="liveplayer">
                            <LazySection>
                            <MediaMain 
                                height={height}
                                dispatch={dispatch}
                                userInfo={userInfo}
                                currentSubTab={currentSubTab}
                                admin={admin}
                            />
                            </LazySection>
                        </TabPane>
                    )
                }

                {
                    admin && (
                        <TabPane tab="管理工具" key="admintools">
                            <LazySection>
                                <AdminToolsMain />
                            </LazySection>
                        </TabPane>
                    )
                }

                <TabPane tab="风水" key="fengshui">
                    <FengShuiMain
                        height={height}
                        fields={fields}
                        fieldsAry={aryfields}
                        dispatch={dispatch}
                    />
                </TabPane>

                <TabPane tab="三式合一" key="sanshiunited">
	                    <SanShiUnitedMain
	                        active={currentTab === 'sanshiunited'}
	                        height={height}
                        fields={fields}
                        fieldsAry={aryfields}
	                        chartObj={chartObj}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        dispatch={dispatch}
	                        hook={predictHook.sanshiunited}
	                    />
                </TabPane>

                </Tabs>,
                {
                    resetKey: `main:${currentTab}:${currentSubTab || ''}`,
                }
            )}

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
                {renderProtectedModule('星盘配置', (
                    <AstroFormComp 
                        { ...fields }
                        fields={fields}
                        fieldsAry={aryfields}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:query:${drawerVisible.query ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('注册', (
                    <RegisterForm 
                        {...registerFields}
                        tokenImg={tokenImg}
                        fields={registerFields}
                        fieldsAry={aryregflds}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:register:${drawerVisible.register ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('登录', (
                    <LoginForm 
                        {...loginFields}
                        fields={loginFields}
                        fieldsAry={aryloginflds}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:login:${drawerVisible.login ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('忘记密码', (
                    <ResetPwdForm 
                        {...registerFields}
                        tokenImg={tokenImg}
                        fields={registerFields}
                        fieldsAry={aryregflds}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:resetpwd:${drawerVisible.resetpwd ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('修改密码', (
                    <ChangePwdForm 
                        {...pwdFields}
                        fields={pwdFields}
                        fieldsAry={convertToArray(pwdFields)}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:changepwd:${drawerVisible.changepwd ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('修改参数', (
                    <ChangeParamsFormComp 
                        {...fields}
                        fields={fields}
                        fieldsAry={aryfields}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:changeparams:${drawerVisible.changeparams ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('添加星盘', (
                    <ChartAddFormComp 
                        {...currentChart}
                        fields={currentChart}
                        fieldsAry={arychartflds}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:chartadd:${drawerVisible.chartadd ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('编辑星盘', (
                    <ChartEditFormComp 
                        {...currentChart}
                        fields={currentChart}
                        fieldsAry={arychartflds}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:chartedit:${drawerVisible.chartedit ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('星盘列表', (
                    <ChartList
                        height={height} 
                        userInfo={userInfo}
                        charts={charts}
                        pageSize={pageSize}
                        pageIndex={pageIndex}
                        total={total}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:chartlist:${drawerVisible.chartlist ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('添加起课', (
                    <CaseAddFormComp
                        {...currentCase}
                        fields={currentCase}
                        fieldsAry={arycaseflds}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:caseadd:${drawerVisible.caseadd ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('编辑起课', (
                    <CaseEditFormComp
                        {...currentCase}
                        fields={currentCase}
                        fieldsAry={arycaseflds}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:caseedit:${drawerVisible.caseedit ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('起课列表', (
                    <CaseList
                        height={height}
                        userInfo={userInfo}
                        cases={cases}
                        casePageSize={casePageSize}
                        casePageIndex={casePageIndex}
                        caseTotal={caseTotal}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:caselist:${drawerVisible.caselist ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('相位选择', (
                    <AspSelector
                        value={aspects}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:selectasp:${drawerVisible.selectasp ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('行星选择', (
                    <PlanetSelector
                        value={planetDisplay}
                        lots={lotsDisplay}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:selectplanet:${drawerVisible.selectplanet ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('星盘组件', (
                    <ChartDisplaySelector
                        value={chartDisplay}
                        showPdBounds={fields && fields.showPdBounds ? fields.showPdBounds.value : showPdBounds}
                        showPlanetHouseInfo={showPlanetHouseInfo}
                        showAstroMeaning={showAstroMeaning}
                        showAstroAnnotation={showAstroAnnotation}
                        showOnlyRulExaltReception={showOnlyRulExaltReception}
                        planetMetaDisplay={planetMetaDisplay}
                        fields={fields}
                        dispatch={dispatch}
                    />
                ), {
                    resetKey: `drawer:selectchartdisplay:${drawerVisible.selectchartdisplay ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('我的星盘分布', (
                    <LazySection>
                    <ChartsGps
                        height={height} 
                        charts={charts}
                        userInfo={userInfo}
                        dispatch={dispatch}
                    />
                    </LazySection>
                ), {
                    resetKey: `drawer:chartsgps:${drawerVisible.chartsgps ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('命盘批注', (
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
                ), {
                    resetKey: `drawer:memo:${drawerVisible.memo ? 1 : 0}:${currentTab}:${currentSubTab || ''}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('小工具', (
                    <LazySection>
                    <CommToolsMain
                        fields={fields}
                        dispatch={dispatch}
                        loading={loading}
                    />
                    </LazySection>
                ), {
                    resetKey: `drawer:commtools:${drawerVisible.commtools ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('人生事件设置', (
                    <LazySection>
                    <DLFeature
                        {...currentChart}
                        fields={currentChart}
                        fieldsAry={arychartflds}
                        deeplearn={deeplearn}
                        height={height} 
                        dispatch={dispatch}
                        loading={loading}
                    />
                    </LazySection>
                ), {
                    resetKey: `drawer:chartdeeplearn:${drawerVisible.chartdeeplearn ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
                {renderProtectedModule('首页设置', (
                    <HomePageSetup
                        dispatch={dispatch}
                        loading={loading}
                    />
                ), {
                    resetKey: `drawer:homepage:${drawerVisible.homepage ? 1 : 0}`,
                    onClose: closeDrawer,
                })}
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
