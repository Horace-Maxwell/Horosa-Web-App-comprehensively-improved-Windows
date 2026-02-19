import { history } from 'umi';
import { Modal,  } from 'antd';
import {getStore, } from '../utils/storageutil';
import * as Constants from '../utils/constants';
import * as appService from '../services/app';
import {setDispatch} from '../utils/request';
import {detectPlatform} from '../utils/helper';
import * as AstroConst from '../constants/AstroConst';
import { setTmDelta } from '../utils/request';

function userInfoToFields(flds, userInfo){
    flds.doubingSu28.value = userInfo.doubingSu28;
    flds.simpleAsp.value = userInfo.simpleAsp;
    flds.strongRecption.value = userInfo.strongRecption;
    flds.virtualPointReceiveAsp.value = userInfo.virtualPntReceiveAsp;
    flds.hsys.value = userInfo.hsys;
    flds.zodiacal.value = userInfo.zodiacal;
    flds.predictive.value = userInfo.predictive;
    flds.tradition.value = userInfo.tradition;
    flds.gpsLon.value = userInfo.gpsLon;
    flds.gpsLat.value = userInfo.gpsLat;
    flds.lat.value = userInfo.lat;
    flds.lon.value = userInfo.lon;    
    if(userInfo.pdaspects){
        flds.pdaspects.value = userInfo.pdaspects;
    }
}

export default {

    namespace: 'app',

    state: {
        systime: null,
        theme: 'light',
        loading: false,
        loadingText: null,
        refresh: false,
        tokenImg: null,
        imgTokenListName: null,

        chartDisplay: AstroConst.CHART_DEFAULTOPTS,
        planetDisplay: AstroConst.DEFAULT_OBJECTS,
        lotsDisplay: AstroConst.DEFAULT_LOTS,
        colorTheme: AstroConst.DefaultColorTheme,
        aspects: AstroConst.DEFAULT_ASPECTS,
        showPdBounds: 1,

        loginFields:{
            loginId: {
                value: null,
                name: ['oginId'],
            },
            pwd: {
                value: null,
                name: ['pwd'],
            },
        },

        registerFields:{
            loginId: {
                value: null,
                name: ['loginId'],
            },
            pwd: {
                value: null,
                name: ['pwd'],
            },
            imgToken:{
                value: null,
                name: ['imgToken'],
            },
        },
    },

    reducers: {
        save(state, {payload: values}) {
            let st = { ...state, ...values };
            let globalSetup = {
                chartDisplay: st.chartDisplay,
                planetDisplay: st.planetDisplay,
                lotsDisplay: st.lotsDisplay,
                colorTheme: st.colorTheme,
                showPdBounds: st.showPdBounds,
            };
            let json = JSON.stringify(globalSetup);
            localStorage.setItem(Constants.GlobalSetupKey, json);

            return st;
        },

    },

    effects: {
        *fetchImgToken({payload: values}, {call, put}){
            const {Result} = yield call(appService.getImgToken);

            yield put({
                type: 'save',
                payload: {
                    tokenImg: 'data:image/jpeg;base64,' + Result.TokenImg,
                    imgTokenListName: Result.ImgTokenListName,
                },
            });
        },

        *login({payload: values}, {call, put}){
            if(values.rememberMe){
                localStorage.setItem(Constants.LoginIdKey, values.loginId);
            }else{
                localStorage.removeItem(Constants.LoginIdKey);
            }

            let params = {
                LoginId: values.loginId,
                Pwd: values.pwd,
            };
            const {Result} = yield call(appService.login, params);
 
            localStorage.setItem(Constants.TokenKey, Result.Token);

            const usrdata = {
                token: Result.Token,
                userInfo: Result.User,
                charts: Result.Charts,
                total: Result.ChartsTotal,
                admin: Result.IsAdmin ? true : false,
            };

            const store = getStore();
            const astrost = store.astro;
            const appst = store.app;

            const fld = {
                ...astrost.fields,                
            }
            userInfoToFields(fld, Result.User);
            if(fld.showPdBounds){
                fld.showPdBounds.value = appst.showPdBounds === 0 ? 0 : 1;
            }
            
            yield put({
                type: 'astro/save',
                payload: {
                    fields: fld,
                },
            });

            yield put({
                type: 'astro/closeDrawer',
                payload: {},
            });

            yield put({
                type: 'user/save',
                payload: {
                    ...usrdata,
                },
            });

            yield put({
                type: 'astro/doHook',
                payload: {
                    fields: fld,
                },
            });    

            let page = localStorage.getItem(Constants.HomePageKey);
            if(page){
                page = JSON.parse(page);
                yield put({
                    type: 'astro/setHomePage',
                    payload: page,
                });                               
            }

       },

        *register({payload: values}, {call, put}){
            const store = getStore();
            const state = store.app;

            let params = {
                LoginId: values.loginId,
                Pwd: values.pwd,
                ImgToken: values.imgToken,
            };
            let headers = {
                ImgTokenListName: state.imgTokenListName,
            };
            const {Result} = yield call(appService.register, params, headers);

            localStorage.setItem(Constants.TokenKey, Result.Token);

            const usrdata = {
                token: Result.Token,
                userInfo: Result.User,
            };

            yield put({
                type: 'astro/closeDrawer',
                payload: {},
            });

            yield put({
                type: 'user/save',
                payload: {
                    ...usrdata,
                },
            });

            let page = localStorage.getItem(Constants.HomePageKey);
            if(page){
                page = JSON.parse(page);
                yield put({
                    type: 'astro/setHomePage',
                    payload: page,
                });                               
            }
            
        },

		*resetPwd({ payload: values }, { call, put }){
            let params = {
				LoginId: values.loginId,
                ImgToken: values.imgToken,
			};
			
            const store = getStore();
            const state = store.app;

            let headers = {
                ImgTokenListName: state.imgTokenListName,
            };
			const { Result } = yield call(appService.resetpwd, params, headers);

            yield put({
                type: 'astro/closeDrawer',
                payload: {},
            });

            Modal.success({
                title: '新密码已发送到您的邮箱，请尽快修改密码。'
            });
		},


        *checkUser({ payload: values }, { call, put }) {
            const param = {};
            let setupJson = localStorage.getItem(Constants.GlobalSetupKey);
            if(setupJson){
                let json = JSON.parse(setupJson);
                if(json && json.colorTheme !== undefined){
                    json.colorTheme = AstroConst.normalizeColorThemeIndex(json.colorTheme);
                }
                yield put({
                    type: 'save',
                    payload: json,
                });
            }

            const rsp = yield call(appService.checkUser, param);
            if(!rsp || !rsp.Result){
                localStorage.removeItem(Constants.TokenKey);
                yield put({
                    type: 'user/save',
                    payload: {
                        token: null,
                        charts: [],
                        userInfo: null,
                        admin: false,
                    },
                });
                yield put({
                    type: 'astro/nowChart',
                    payload: {},
                });
                return;
            }
            const Result = rsp.Result;

            if(Result.Token === undefined || Result.Token === null){
                yield put({
                    type: 'astro/nowChart',
                    payload: {},
                });    
                return;
            }
            
            localStorage.setItem(Constants.TokenKey, Result.Token);

            const usrdata = {
                token: Result.Token,
                userInfo: Result.User,
                charts: Result.Charts,
                total: Result.ChartsTotal,
                admin: Result.IsAdmin ? true : false,
            };

            const store = getStore();            
            const astrost = store.astro;
            const appst = store.app;

            const fld = {
                ...astrost.fields,                
            }
            userInfoToFields(fld, Result.User);
            if(fld.showPdBounds){
                fld.showPdBounds.value = appst.showPdBounds === 0 ? 0 : 1;
            }
            
            yield put({
                type: 'user/save',
                payload: {
                    ...usrdata,
                },
            });

            yield put({
                type: 'astro/nowChart',
                payload: {
                    fields: fld,
                },
            });

            let page = localStorage.getItem(Constants.HomePageKey);
            if(page){
                page = JSON.parse(page);
                yield put({
                    type: 'astro/setHomePage',
                    payload: page,
                });                               
            }

        },

        *checkOnlyUser({ payload: values }, { call, put }) {
            const param = {
                PageIndex: 1,
                PageSize: 30,
            };
            let setupJson = localStorage.getItem(Constants.GlobalSetupKey);
            if(setupJson){
                let json = JSON.parse(setupJson);
                if(json && json.colorTheme !== undefined){
                    json.colorTheme = AstroConst.normalizeColorThemeIndex(json.colorTheme);
                }
                yield put({
                    type: 'save',
                    payload: json,
                });
            }

            const rsp = yield call(appService.checkUser, param);
            if(!rsp || !rsp.Result){
                localStorage.removeItem(Constants.TokenKey);
                yield put({
                    type: 'user/save',
                    payload: {
                        token: null,
                        charts: [],
                        userInfo: null,
                        admin: false,
                    },
                });
                return;
            }
            const Result = rsp.Result;
            
            localStorage.setItem(Constants.TokenKey, Result.Token);

            const usrdata = {
                token: Result.Token,
                userInfo: Result.User,
                admin: Result.IsAdmin ? true : false,
            };

            const store = getStore();
            const astrost = store.astro;
            const appst = store.app;

            const fld = {
                ...astrost.fields,                
            }
            userInfoToFields(fld, Result.User);
            if(fld.showPdBounds){
                fld.showPdBounds.value = appst.showPdBounds === 0 ? 0 : 1;
            }
            
            yield put({
                type: 'astro/save',
                payload: {
                    fields: fld,
                },
            });

           yield put({
                type: 'user/save',
                payload: {
                    ...usrdata,
                },
            });

        },

        *logout({ payload:values }, { put, call }){
            const usrToken = localStorage.getItem(Constants.TokenKey);
            const skipRemote = !!(values && values.skipRemote);
            localStorage.removeItem(Constants.TokenKey);
            try{
                if(!skipRemote && usrToken){
                    yield call(appService.logout);
                }
            }catch(e){
            }
            yield put({
                type: 'user/save',
                payload: {
                    token: null,
                    charts: [],
                    userInfo: null,
                    admin: false,
                },
            });

            let page = localStorage.getItem(Constants.HomePageKey);
            if(page){
                page = JSON.parse(page);
                yield put({
                    type: 'astro/setHomePage',
                    payload: page,
                });                               
            }

        },

        *menuClick({ payload:values }, { put, call }){
            if(values.key === 'logout'){
                yield put({
                    type: 'logout',
                    payload: {},
                });
    
            }else{
                yield put({
                    type: 'astro/openDrawer',
                    payload: {
                        key: values.key
                    },
                });    
            }
   
        },

        *getSysTime({ payload:values }, { put, call }){
            const Result = yield call(appService.systime);
            if(Result === undefined || Result === null){
                return;
            }
            yield put({
                type: 'save',
                payload: {
                    systime: Result,
                },
            });    
			let tm = new Number(Result);
			let dt = new Date();
			let tmS = dt.getTime();
			let delta = tmS - tm;
			setTmDelta(delta);
        },

        *beginRefresh({ payload:values }, { put, call }){
            yield put({
                type: 'save',
                payload: {
                    refresh: true,
                    loading: true,
                },
            });    
        },

        *endRefresh({ payload:values }, { put, call }){
            yield put({
                type: 'save',
                payload: {
                    refresh: false,
                    loading: false,
                },
            });        
        },

    },

    subscriptions: {
        setup({ dispatch, history }) {
            let docw = document.documentElement.clientWidth;
            let doch = document.documentElement.clientHeight;
            let mindim = Math.min(docw, doch);
            let platform = detectPlatform();
            const isLocalHost = window.location.protocol === 'file:' ||
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';
            if(platform === 'IPhone' || platform === 'IPod' || 
                (platform === 'Android' && mindim < 600)){
                    if(!isLocalHost){
                    window.location.href = Constants.MobileServer;
                    }
            }
            // alert(platform + '; ' + mindim + '; ' + navigator.userAgent + '; ' + navigator.platform);

            setDispatch(dispatch);
            const { location } = history;
            const { query } = location;
            if(location.pathname === '/' || location.pathname === ''){
                dispatch({
                    type: 'checkUser',
                    payload:{},
                });                           
            }

            let aspects = localStorage.getItem(AstroConst.AspKey);
            if(aspects === undefined || aspects === null){
                aspects = AstroConst.DEFAULT_ASPECTS;
                localStorage.setItem(AstroConst.AspKey, JSON.stringify(aspects));
            }else{
                aspects = JSON.parse(aspects);
            }
            let h = doch - 100;
            h = doch - 100;
            if(h > 660){
                dispatch({
                    type: 'astro/save',
                    payload:{
                        height: h,
                        aspects: aspects,
                    },
                });                               
            }

            dispatch({
                type: 'getSysTime',
                payload:{},
            });                           

            dispatch({
                type: 'rules/ziwei',
                payload:{},
            });                           

        },

    },


};
