import { ServerRoot } from '../utils/constants';
import request from '../utils/request';
import { memoizedJsonRequest } from '../utils/apiMemo';


export function fetchChart(values, requestOptions){
    return memoizedJsonRequest(`${ServerRoot}/chart`, values, requestOptions || {}, {
        namespace: 'astro.chart',
        maxSize: 128,
    });
}

export function fetchIndiaChart(values, requestOptions){
    return memoizedJsonRequest(`${ServerRoot}/india/chart`, values, requestOptions || {}, {
        namespace: 'india.chart',
        maxSize: 128,
    });
}

export function fetchAllowedCharts(values){
    return request(`${ServerRoot}/allowedcharts`, {
        body: JSON.stringify(values),
    });
}

export function fetchFateEvents(values){
    return request(`${ServerRoot}/deeplearn/fateevents`, {
        body: JSON.stringify(values),
    });
}

export function dlTrain(values){
    return request(`${ServerRoot}/deeplearn/train`, {
        body: JSON.stringify(values),
    });
}
