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

export function getUserCharts(values){
    return request(`${ServerRoot}/user/charts`, {
        body: JSON.stringify(values),
    });
}

export function addChart(values){
    return request(`${ServerRoot}/user/charts/add`, {
        body: JSON.stringify(values),
    });
}

export function updateChart(values){
    return request(`${ServerRoot}/user/charts/update`, {
        body: JSON.stringify(values),
    });
}

export function saveMemo(values){
    return request(`${ServerRoot}/user/charts/memo`, {
        body: JSON.stringify(values),
    });
}

export function deleteChart(values){
    return request(`${ServerRoot}/user/charts/delete`, {
        body: JSON.stringify(values),
    });
}

export function fetchAllowedCharts(values){
    return request(`${ServerRoot}/allowedcharts`, {
        body: JSON.stringify(values),
    });
}

export function importChart(values){
    return request(`${ServerRoot}/user/charts/import`, {
        body: JSON.stringify(values),
    });
}

export function exportChart(values){
    return request(`${ServerRoot}/user/charts/export`, {
        body: JSON.stringify(values),
    });
}


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
