import React from 'react';
import { connect  } from 'dva';
import { withRouter } from 'umi';
import { ConfigProvider } from "antd";
import zhCN from "antd/es/locale/zh_CN";
import App from './app';
import moment from 'moment';
import 'moment/locale/zh-cn';
import { setGlobalStore, } from '../utils/storageutil';

function RootLayout(props){
    const {children, location} = props;
    moment.locale('zh-cn');

    // 两字按钮不自动插空格(「今 日」挨着「3天」字距不一):全站统一关掉
    return (
        <ConfigProvider locale={zhCN} autoInsertSpaceInButton={false}>
            <App>
                {children}
            </App>
        </ConfigProvider>
    );    
}

function mapStateToProps(state){
    setGlobalStore(state);
    return {
        ...state,
    };
}

export default withRouter(connect(mapStateToProps)(RootLayout));

