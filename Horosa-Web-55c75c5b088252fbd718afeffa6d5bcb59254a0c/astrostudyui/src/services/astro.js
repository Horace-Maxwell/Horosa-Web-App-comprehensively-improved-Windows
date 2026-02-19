import request from '../utils/request';
import { ServerRoot } from '../utils/constants';


export function fetchChart(values){
    return request(`${ServerRoot}/chart`, {
        body: JSON.stringify(values),
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

