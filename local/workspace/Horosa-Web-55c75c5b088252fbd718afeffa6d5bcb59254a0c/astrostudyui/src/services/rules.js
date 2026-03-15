import request from '../utils/request';
import {ServerRoot} from '../utils/constants';

export function ziweirules(values, requestOptions = {}){
    return request(`${ServerRoot}/ziwei/rules`, {
        body: JSON.stringify(values),
        ...requestOptions,
    });
}
