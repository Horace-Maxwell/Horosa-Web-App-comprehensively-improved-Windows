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

export function checkUser(values) {
	return request(`${ServerRoot}/user/check`, {
		body: JSON.stringify(values),
	});
}

// [R4] 服务端命盘 CRUD 八函数已删(getUserCharts/addChart/updateChart/saveMemo/deleteChart/
// fetchAllowedCharts/importChart/exportChart):models/user.js 从未 call 过任何一个(命盘
// 全走本地 localcharts),属登录多用户时代残留。日后如做云同步按当时协议重写,不留假接口。


export function listBooks(values){
    return request(`${ServerRoot}/astroreader/listbooks`, {
        body: JSON.stringify(values),
    });
}

export function allBooks(values){
    return request(`${ServerRoot}/astroreader/allbooks`, {
        body: JSON.stringify(values),
    });
}

export function getChapter(values){
    return request(`${ServerRoot}/astroreader/getchapter`, {
        body: JSON.stringify(values),
    });
}

export function updateBook(values){
    return request(`${ServerRoot}/astroreader/updatebook`, {
        body: JSON.stringify(values),
    });
}

export function deleteBook(values){
    return request(`${ServerRoot}/astroreader/deletebook`, {
        body: JSON.stringify(values),
    });
}

export function removeBook(values){
    return request(`${ServerRoot}/astroreader/removebook`, {
        body: JSON.stringify(values),
    });
}

export function readprogress(values){
    return request(`${ServerRoot}/astroreader/readprogress`, {
        body: JSON.stringify(values),
    });
}
