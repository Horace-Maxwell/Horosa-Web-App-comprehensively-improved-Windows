import React from 'react';
import { connect  } from 'dva';
import { Layout,  BackTop, Spin,  } from 'antd';
import * as AstroConst from '../constants/AstroConst';
import PageHeader from '../components/homepage/PageHeader';
import PageFooter from '../components/homepage/PageFooter';
import styles from './app.less';

const App = ({children, dispatch, app, user, })=>{
    const { userInfo, charts, admin, } = user;
    const { chartDisplay, colorTheme,} = app;
    const { Header, Content, Footer } = Layout;

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

    AstroConst.setColorTheme(colorTheme);

    let mainstyle = {
        height: '100vh',
        overflow: 'hidden',
        background: AstroConst.AstroColor.Background,
        color: AstroConst.AstroColor.TextStroke,
        stroke: AstroConst.AstroColor.TextStroke,
    };
    let headerstyle = {
        position: 'fixed', width:'100%', zIndex: 100, 
        backgroundColor: AstroConst.AstroColor.Backgroud, 
        height:64, padding: 0,
        borderBottom: '2px solid', 
        borderBottomColor: '#e8e8e8',
        color: AstroConst.AstroColor.TextStroke,
        stroke: AstroConst.AstroColor.TextStroke,
    };
    let contentStyle = {
        marginTop: 64,
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        backgroundColor: AstroConst.AstroColor.Backgroud, 
        color: AstroConst.AstroColor.TextStroke,
        stroke: AstroConst.AstroColor.TextStroke,
    };
    let footerStyle = { 
        display: 'none',
        padding: 0,
        height: 0,
        minHeight: 0,
        textAlign: 'center', 
        backgroundColor: AstroConst.AstroColor.Backgroud,
        color: AstroConst.AstroColor.TextStroke,
        stroke: AstroConst.AstroColor.TextStroke,
    };

    return (
        <Layout style={mainstyle}>
            <Header style={headerstyle}>
                <PageHeader 
                    admin={admin}
                    chartDisplay={chartDisplay}
                    colorTheme={colorTheme}
                    userInfo={userInfo} 
                    onMenuClick={menuClick}
                    dispatch={dispatch}
                />
            </Header>

            <Content id='mainContent' style={contentStyle}>
                <div style={{ width:'100%', height:'100%', paddingLeft: 30, paddingRight:30, overflow:'hidden', boxSizing:'border-box' }}>
                    <BackTop visibilityHeight={50}/>
                    <div id='workspaceContentHost' style={{ height:'100%', paddingLeft: 30, paddingRight:30, paddingTop:12, paddingBottom:12, overflow:'hidden', boxSizing:'border-box' }}>
                        {children}
                    </div>
                </div>
            </Content>

            <Footer id='globalFooter' style={footerStyle}>
                <PageFooter />
            </Footer>
        </Layout>
    );
};


function mapStateToProps(state){
    const { app, user, router } = state;
    const { location } = router;
    const { query } = location;

    return {
        app: app,
        user: user,
        query: query,
    };
}


export default connect(mapStateToProps)(App);
