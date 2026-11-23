// 主页外壳 · 命盘 / 事盘与盘面抽屉:添加 / 编辑 / 列表、相位 / 容许度 / 星体 / 星盘设置、命盘分布、批注、小工具、命主实况、首页弹窗
// 从 index.js 按职责拆出的 AstroIndex 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import ChartAddFormComp from '../../../components/user/ChartAddFormComp';
import ChartEditFormComp from '../../../components/user/ChartEditFormComp';
import ChartList from '../../../components/user/ChartList';
import CaseAddFormComp from '../../../components/user/CaseAddFormComp';
import CaseEditFormComp from '../../../components/user/CaseEditFormComp';
import CaseList from '../../../components/user/CaseList';
import AspSelector from '../../../components/astro/AspSelector';
import AstroOrbSetting from '../../../components/astro/AstroOrbSetting';
import PlanetSelector from '../../../components/astro/PlanetSelector';
import ChartDisplaySelector from '../../../components/astro/ChartDisplaySelector';
import ChartsGps from '../../../components/user/ChartsGps';
import DLFeature from '../../../components/deeplearn/DLFeature';
import HomePageSetup from '../../../components/HomePageSetup';
import { XQDrawer as Drawer, XQModal } from '../../../components/xq-ui';

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderChartAddDrawer = ({ closeDrawer, drawerVisible, currentChart, arychartflds, dispatch })=>(
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
	    <ChartAddFormComp 
	        {...currentChart}
	        fields={currentChart}
	        fieldsAry={arychartflds}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderChartEditDrawer = ({ closeDrawer, drawerVisible, currentChart, arychartflds, dispatch })=>(
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
	    <ChartEditFormComp 
	        {...currentChart}
	        fields={currentChart}
	        fieldsAry={arychartflds}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderChartListDrawer = ({
	closeDrawer, drawerVisible, height, userInfo, charts, pageSize, pageIndex, total, dispatch,
})=>(
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
	    <ChartList
	        height={height} 
	        userInfo={userInfo}
	        charts={charts}
	        pageSize={pageSize}
	        pageIndex={pageIndex}
	        total={total}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderCaseAddDrawer = ({ closeDrawer, drawerVisible, currentCase, arycaseflds, dispatch })=>(
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
	    <CaseAddFormComp
	        {...currentCase}
	        fields={currentCase}
	        fieldsAry={arycaseflds}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderCaseEditDrawer = ({ closeDrawer, drawerVisible, currentCase, arycaseflds, dispatch })=>(
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
	    <CaseEditFormComp
	        {...currentCase}
	        fields={currentCase}
	        fieldsAry={arycaseflds}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderCaseListDrawer = ({
	closeDrawer, drawerVisible, height, userInfo, cases, casePageSize, casePageIndex, caseTotal,
	dispatch,
})=>(
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
	    <CaseList
	        height={height}
	        userInfo={userInfo}
	        cases={cases}
	        casePageSize={casePageSize}
	        casePageIndex={casePageIndex}
	        caseTotal={caseTotal}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderSelectAspectDrawer = ({ closeDrawer, drawerVisible, aspects, dispatch })=>(
	<Drawer
	    title='相位选择'
	    width={340}
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
	        layout="drawer"
	        value={aspects}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderSelectOrbDrawer = ({ closeDrawer, drawerVisible, fields, chartObj, dispatch })=>(
	<Drawer
	    title='容许度设置'
	    width={380}
	    placement="left"
	    onClose={closeDrawer}
	    maskClosable={true}
	    destroyOnClose={true}
	    open={drawerVisible.selectorb}
	    style={{
	        height: 'calc(100% - 0px)',
	        overflow: 'auto',
	        paddingBottom: 53,
	        backgroundColor: 'transparent',
	    }}
	>
	    <AstroOrbSetting
	        fields={fields}
	        chartObj={chartObj}
	        dispatch={dispatch}
	        onClose={closeDrawer}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderSelectPlanetDrawer = ({ closeDrawer, drawerVisible, planetDisplay, lotsDisplay, dispatch })=>(
	<Drawer
	    title='显示星体'
	    width={400}
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
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderChartDisplayDrawer = ({
	closeDrawer, drawerVisible, chartDisplay, fields, showPdBounds, showPlanetHouseInfo,
	showAstroMeaning, showOnlyRulExaltReception, wheelArt, app, voidClassical, dispatch,
})=>(
	<Drawer
	    title='星盘设置'
	    className='horosa-chart-settings-drawer'
	    width={940}
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
	        layout="drawer"
	        value={chartDisplay}
	        showPdBounds={fields && fields.showPdBounds ? fields.showPdBounds.value : showPdBounds}
	        showPlanetHouseInfo={showPlanetHouseInfo}
	        showAstroMeaning={showAstroMeaning}
	        showOnlyRulExaltReception={showOnlyRulExaltReception}
	        wheelArt={wheelArt}
	        planetListStyle={app.planetListStyle}
	        termsVariant={fields && fields.termsVariant ? fields.termsVariant.value : 0}
	        voidClassical={voidClassical}
	        fields={fields}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderChartsGpsDrawer = ({ closeDrawer, drawerVisible, height, charts, userInfo, dispatch })=>(
	<Drawer
	    title='我的命盘分布'   /* 与公共菜单「命盘分布」同词;数据源=本机命盘库 */
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
	    <ChartsGps
	        height={height} 
	        charts={charts}
	        userInfo={userInfo}
	        dispatch={dispatch}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderMemoDrawer = ({
	closeDrawer, drawerVisible, ChartMemo, memoType, memo, currentSubTab, activeMainTab, userInfo,
	currentChart, dispatch, loading,
})=>(
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
	        currentTab={activeMainTab}
	        userInfo={userInfo}
	        currentChart={currentChart}
	        dispatch={dispatch}
	        loading={loading}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderCommToolsDrawer = ({ closeDrawer, drawerVisible, CommToolsMain, fields, dispatch, loading })=>(
	<Drawer
	    title='小工具'
	    width={960}
	    placement="left"
	    className="horosa-commtools-drawer"
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
	    <CommToolsMain
	        fields={fields}
	        dispatch={dispatch}
	        loading={loading}
	    />
	</Drawer>
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderChartDeepLearnDrawer = ({
	closeDrawer, drawerVisible, currentChart, arychartflds, deeplearn, height, dispatch, loading,
})=>(
	<Drawer
	    title='命主实况'
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
);

// AstroIndex 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderHomepageModal = ({
	drawerVisible, closeDrawer, dispatch, loading, navigationPages, activeMainTab, changeTab, openDrawer,
})=>(
	<XQModal
	    title={null}
	    footer={null}
	    centered
	    closable={false}
	    width={1228}
	    destroyOnClose={true}
	    maskClosable={true}
	    open={drawerVisible.homepage}
	    onCancel={closeDrawer}
	    className="xq-nav-popup"
	    transitionName="xq-nav-popup-motion"
	    maskTransitionName="xq-nav-popup-mask-motion"
	>
	    <div className="xq-nav-popup-shell">
	        <HomePageSetup
	            dispatch={dispatch}
	            loading={loading}
	            pages={navigationPages}
	            currentKey={activeMainTab}
	            onNavigate={changeTab}
	            onOpenTools={()=>openDrawer('commtools')}
	            onClose={closeDrawer}
	        />
	    </div>
	</XQModal>
);
