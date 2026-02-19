import request from '../utils/request';
import {ServerRoot} from '../utils/constants';

export function getImgToken(){
    return request(`${ServerRoot}/common/imgToken`);
}

export function login(values){
    return request(`${ServerRoot}/user/login`, {
        body: JSON.stringify(values),
    });
}

export function register(values, headers){
    return request(`${ServerRoot}/user/register`, {
		body: JSON.stringify(values),
		headers: headers,
    });
}

export function resetpwd(values, headers){
    return request(`${ServerRoot}/user/resetpwd`, {
        body: JSON.stringify(values),
        headers: headers,
    });
}

export function checkUser(values) {
	return request(`${ServerRoot}/user/check`, {
		body: JSON.stringify(values),
	});
}

export function logout() {
	return request(`${ServerRoot}/user/logout`, {
		body: '',
	});
}

export function systime() {
	return request(`${ServerRoot}/common/time`, {
		body: null,
	});
}
