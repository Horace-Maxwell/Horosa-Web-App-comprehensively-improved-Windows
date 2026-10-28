import request from '../utils/request';
import {ServerRoot} from '../utils/constants';


export function changepwd(values){
    return request(`${ServerRoot}/user/changepwd`, {
        body: JSON.stringify(values),
    });
}

export function changeparams(values){
    return request(`${ServerRoot}/user/changeparams`, {
        body: JSON.stringify(values),
    });
}

// 服务端命盘 CRUD 八函数已删(getUserCharts/addChart/updateChart/saveMemo/deleteChart/
// fetchAllowedCharts/importChart/exportChart):models/user.js 从未 call 过任何一个(命盘
// 全走本地 localcharts),属登录多用户时代残留。日后如做云同步按当时协议重写,不留假接口。

