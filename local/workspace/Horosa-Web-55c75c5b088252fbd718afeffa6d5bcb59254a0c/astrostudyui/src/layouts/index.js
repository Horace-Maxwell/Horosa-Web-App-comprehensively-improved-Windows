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

    return (
        <ConfigProvider locale={zhCN}>
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

