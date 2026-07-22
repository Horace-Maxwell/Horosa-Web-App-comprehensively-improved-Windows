import { history } from 'umi';
import { safeLocalStorageSet } from '../utils/safeStorage';
import { Modal,  } from 'antd';
import {getStore, } from '../utils/storageutil';
import * as Constants from '../utils/constants';
import * as appService from '../services/app';
import {setDispatch} from '../utils/request';
import {detectPlatform} from '../utils/helper';
import { loadBootChartSnapshot } from '../utils/bootChartRestore';
import * as AstroConst from '../constants/AstroConst';
import { setTmDelta } from '../utils/request';
import { normalizeAppearanceMode } from '../utils/appearance';
import { normalizeDayBoundary, DAY_BOUNDARY_AFTER23, normalizeLateZiHourMode, LATE_ZI_HOUR_NEXT_DAY } from '../utils/dayBoundary';

const MinWorkspaceHeight = 660;
const WorkspaceReservedHeight = 88;
const ChartDisplayDefaultsVersion = 2;
const PlanetDisplayDefaultsVersion = 2;
const DefaultHouseSystem = 1;
const HouseSystemDefaultsVersion = 2;
const HouseSystemDefaultVersionKey = 'horosaHouseSystemDefaultsVersion';
const ChartDisplayDefaultOffOptions = new Set([
    AstroConst.CHART_SIGNRULER,
    AstroConst.CHART_TERM,
    AstroConst.CHART_OUTERDEG,
    AstroConst.CHART_INNERDEG,
]);
const PlanetDisplayDefaultOffOptions = new Set([
    AstroConst.DARKMOON,
    AstroConst.PURPLE_CLOUDS,
    AstroConst.DESC,
    AstroConst.IC,
]);

function normalizeWorkspaceHeight(viewportHeight){
    const raw = Number(viewportHeight) - WorkspaceReservedHeight;
    if(!Number.isFinite(raw)){
        return MinWorkspaceHeight;
    }
    return raw <= MinWorkspaceHeight ? MinWorkspaceHeight : raw;
}

function normalizeDisplayList(raw, fallback, allowSet, allowEmpty = false){
    const fallbackArr = Array.isArray(fallback) ? fallback.slice(0) : [];
    const allow = new Set(Array.isArray(allowSet) ? allowSet : []);

    let arr = raw;
    let fromExplicitArray = Array.isArray(arr);
    if(!Array.isArray(arr)){
        if(typeof arr === 'string' && arr){
            arr = [arr];
        }else{
            arr = fallbackArr;
            fromExplicitArray = false;
        }
    }

    const uniq = [];
    const seen = new Set();
    for(let i=0; i<arr.length; i++){
        const id = arr[i];
        if(typeof id !== 'string'){
            continue;
        }
        if(allow.size > 0 && !allow.has(id)){
            continue;
        }
        if(seen.has(id)){
            continue;
        }
        seen.add(id);
        uniq.push(id);
    }
    if(uniq.length > 0){
        return uniq;
    }
    if(allowEmpty && fromExplicitArray){
        return [];
    }
    return fallbackArr;
}

function normalizeGlobalSetup(setup){
    if(!setup || typeof setup !== 'object'){
        return setup;
    }
    const normalized = { ...setup };
    if(normalized.chartDisplayDefaultsVersion !== ChartDisplayDefaultsVersion){
        if(Array.isArray(normalized.chartDisplay)){
            normalized.chartDisplay = normalized.chartDisplay.filter((opt)=>!ChartDisplayDefaultOffOptions.has(Number(opt)));
        }
        normalized.chartDisplayDefaultsVersion = ChartDisplayDefaultsVersion;
    }
    if(normalized.planetDisplayDefaultsVersion !== PlanetDisplayDefaultsVersion){
        if(Array.isArray(normalized.planetDisplay)){
            normalized.planetDisplay = normalized.planetDisplay.filter((opt)=>!PlanetDisplayDefaultOffOptions.has(opt));
        }
        normalized.planetDisplayDefaultsVersion = PlanetDisplayDefaultsVersion;
    }
    normalized.chartStyle = AstroConst.normalizeChartStyle(normalized.chartStyle);
    normalized.indiaChartStyle = AstroConst.normalizeIndiaChartStyle(normalized.indiaChartStyle);
    normalized.dayBoundary = normalizeDayBoundary(normalized.dayBoundary);
    normalized.lateZiHourMode = normalizeLateZiHourMode(normalized.lateZiHourMode);
    return normalized;
}

function shouldMigrateHouseSystemDefault(hsys){
    if(hsys === undefined || hsys === null || hsys === ''){
        return true;
    }
    if(Number(hsys) !== 0){
        return false;
    }
    try{
        return localStorage.getItem(HouseSystemDefaultVersionKey) !== `${HouseSystemDefaultsVersion}`;
    }catch(e){
        return false;
    }
}

function markHouseSystemDefaultMigrated(){
    try{
        safeLocalStorageSet(HouseSystemDefaultVersionKey, `${HouseSystemDefaultsVersion}`);
    }catch(e){
        // Ignore storage failures; the in-memory default still applies for this session.
    }
}

function normalizeUserHouseSystem(hsys){
    const numeric = Number(hsys);
    const normalized = shouldMigrateHouseSystemDefault(hsys) || !Number.isFinite(numeric) ? DefaultHouseSystem : numeric;
    markHouseSystemDefaultMigrated();
    return normalized;
}

function userInfoToFields(flds, userInfo){
    flds.doubingSu28.value = userInfo.doubingSu28;
    flds.simpleAsp.value = userInfo.simpleAsp;
    flds.strongRecption.value = userInfo.strongRecption;
    flds.virtualPointReceiveAsp.value = userInfo.virtualPntReceiveAsp;
    flds.hsys.value = normalizeUserHouseSystem(userInfo.hsys);
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

function applyPredictiveSetupToFields(flds, appst){
    if(!flds || !appst){
        return;
    }
    if(flds.showPdBounds){
        flds.showPdBounds.value = appst.showPdBounds === 0 ? 0 : 1;
    }
    if(flds.pdMethod){
        flds.pdMethod.value = appst.pdMethod || 'core_alchabitius';
    }
    if(flds.pdTimeKey){
        flds.pdTimeKey.value = appst.pdTimeKey || 'Ptolemy';
    }
}

export default {

    namespace: 'app',

    state: {
        systime: null,
        theme: 'light',
        appearanceMode: 'system',
        resolvedAppearance: 'light',
        loading: false,
        loadingText: null,
        refresh: false,
        tokenImg: null,
        imgTokenListName: null,

        chartDisplay: AstroConst.CHART_DEFAULTOPTS,
        chartStyle: AstroConst.CHART_STYLE_CURRENT,
        indiaChartStyle: AstroConst.INDIA_CHART_STYLE_SOUTH,
        planetDisplay: AstroConst.DEFAULT_OBJECTS,
        lotsDisplay: AstroConst.DEFAULT_LOTS,
        colorTheme: AstroConst.DefaultColorTheme,
        aspects: AstroConst.DEFAULT_ASPECTS,
        showPdBounds: 1,
        pdMethod: 'core_alchabitius',
        pdTimeKey: 'Ptolemy',
        showPlanetHouseInfo: 0,
        showAstroMeaning: 0,
        showOnlyRulExaltReception: 0,
        voidClassical: 0,                  // G10 空亡古典义(30°内):默认 OFF=按本座义(现状);开=固定 30°窗口。星盘组件开关,格局页相位动态读此重算。
        schoolPreset: 'brennan',           // G20 流派预设(默认 brennan = 现状默认四维 → 零回归)
        tripSystem: 'Dorothean',           // 三分体系(默认多罗特 = 三分主星页现状默认)
        dayBoundary: DAY_BOUNDARY_AFTER23,
        lateZiHourMode: LATE_ZI_HOUR_NEXT_DAY,
        chartDisplayDefaultsVersion: ChartDisplayDefaultsVersion,
        planetDisplayDefaultsVersion: PlanetDisplayDefaultsVersion,

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
            const payload = { ...(values || {}) };
            if(Object.prototype.hasOwnProperty.call(payload, 'planetDisplay')){
                payload.planetDisplay = normalizeDisplayList(
                    payload.planetDisplay,
                    state.planetDisplay,
                    AstroConst.LIST_POINTS,
                    true
                );
            }
            if(Object.prototype.hasOwnProperty.call(payload, 'lotsDisplay')){
                payload.lotsDisplay = normalizeDisplayList(
                    payload.lotsDisplay,
                    state.lotsDisplay,
                    AstroConst.LOTS,
                    true
                );
            }
            if(Object.prototype.hasOwnProperty.call(payload, 'chartStyle')){
                payload.chartStyle = AstroConst.normalizeChartStyle(payload.chartStyle);
            }
            if(Object.prototype.hasOwnProperty.call(payload, 'indiaChartStyle')){
                payload.indiaChartStyle = AstroConst.normalizeIndiaChartStyle(payload.indiaChartStyle);
            }

            let st = { ...state, ...payload };
            st.appearanceMode = normalizeAppearanceMode(st.appearanceMode);
            let globalSetup = {
                chartDisplay: st.chartDisplay,
                chartStyle: st.chartStyle,
                indiaChartStyle: st.indiaChartStyle,
                planetDisplay: st.planetDisplay,
                lotsDisplay: st.lotsDisplay,
                colorTheme: st.colorTheme,
                appearanceMode: st.appearanceMode,
                showPdBounds: st.showPdBounds,
                pdMethod: st.pdMethod,
                pdTimeKey: st.pdTimeKey,
                showPlanetHouseInfo: st.showPlanetHouseInfo,
                showAstroMeaning: st.showAstroMeaning,
                showOnlyRulExaltReception: st.showOnlyRulExaltReception,
                schoolPreset: st.schoolPreset,
                tripSystem: st.tripSystem,
                dayBoundary: st.dayBoundary,
                lateZiHourMode: st.lateZiHourMode,
                chartDisplayDefaultsVersion: ChartDisplayDefaultsVersion,
                planetDisplayDefaultsVersion: PlanetDisplayDefaultsVersion,
            };
            let json = JSON.stringify(globalSetup);
            safeLocalStorageSet(Constants.GlobalSetupKey, json);

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

        *login({payload: values}, { call, put, select }){
            if(values.rememberMe){
                safeLocalStorageSet(Constants.LoginIdKey, values.loginId);
            }else{
                localStorage.removeItem(Constants.LoginIdKey);
            }

            let params = {
                LoginId: values.loginId,
                Pwd: values.pwd,
            };
            const {Result} = yield call(appService.login, params);
 
            safeLocalStorageSet(Constants.TokenKey, Result.Token);

            const usrdata = {
                token: Result.Token,
                userInfo: Result.User,
                charts: Result.Charts,
                total: Result.ChartsTotal,
                admin: Result.IsAdmin ? true : false,
            };

            const store = yield select((s)=>s);
            const astrost = store.astro;
            const appst = store.app;

            const fld = {
                ...astrost.fields,                
            }
            userInfoToFields(fld, Result.User);
            applyPredictiveSetupToFields(fld, appst);
            
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

       },

        *register({payload: values}, { call, put, select }){
            const store = yield select((s)=>s);
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

            safeLocalStorageSet(Constants.TokenKey, Result.Token);

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
            
        },

		*resetPwd({ payload: values }, { call, put, select }){
            let params = {
				LoginId: values.loginId,
                ImgToken: values.imgToken,
			};
			
            const store = yield select((s)=>s);
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


        *checkUser({ payload: values }, { call, put, select }) {
            const param = {};
            let setupJson = localStorage.getItem(Constants.GlobalSetupKey);
            if(setupJson){
                let json = null;
                // 本地 globalSetup 损坏不能炸掉本 effect:它在 token 校验之前,炸了 = 每次启动静默登出 + 全局设置全不生效
                try{ json = normalizeGlobalSetup(JSON.parse(setupJson)); }catch(e){ json = null; }
                if(json && json.colorTheme !== undefined){
                    json.colorTheme = AstroConst.normalizeColorThemeIndex(json.colorTheme);
                }
                if(json && json.appearanceMode !== undefined){
                    json.appearanceMode = normalizeAppearanceMode(json.appearanceMode);
                }
                if(json){
                    yield put({
                        type: 'save',
                        payload: json,
                    });
                }
            }

            const rsp = yield call(appService.checkUser, param);
            if(!rsp || !rsp.Result){
                localStorage.removeItem(Constants.TokenKey);
                const store = yield select((s)=>s);
                const astrost = store.astro;
                const appst = store.app;
                const fld = {
                    ...astrost.fields,
                };
                applyPredictiveSetupToFields(fld, appst);
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
                    payload: {
                        fields: fld,
                    },
                });
                return;
            }
            const Result = rsp.Result;

            if(Result.Token === undefined || Result.Token === null){
                const store = yield select((s)=>s);
                const astrost = store.astro;
                const appst = store.app;
                const fld = {
                    ...astrost.fields,
                };
                applyPredictiveSetupToFields(fld, appst);
                yield put({
                    type: 'astro/nowChart',
                    payload: {
                        fields: fld,
                    },
                });    
                return;
            }
            
            safeLocalStorageSet(Constants.TokenKey, Result.Token);

            const usrdata = {
                token: Result.Token,
                userInfo: Result.User,
                charts: Result.Charts,
                total: Result.ChartsTotal,
                admin: Result.IsAdmin ? true : false,
            };

            const store = yield select((s)=>s);            
            const astrost = store.astro;
            const appst = store.app;

            const fld = {
                ...astrost.fields,                
            }
            userInfoToFields(fld, Result.User);
            applyPredictiveSetupToFields(fld, appst);
            
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

        },

        *checkOnlyUser({ payload: values }, { call, put, select }) {
            const param = {
                PageIndex: 1,
                PageSize: 30,
            };
            let setupJson = localStorage.getItem(Constants.GlobalSetupKey);
            if(setupJson){
                let json = null;
                try{ json = normalizeGlobalSetup(JSON.parse(setupJson)); }catch(e){ json = null; }
                if(json && json.colorTheme !== undefined){
                    json.colorTheme = AstroConst.normalizeColorThemeIndex(json.colorTheme);
                }
                if(json && json.appearanceMode !== undefined){
                    json.appearanceMode = normalizeAppearanceMode(json.appearanceMode);
                }
                if(json){
                    yield put({
                        type: 'save',
                        payload: json,
                    });
                }
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
            
            safeLocalStorageSet(Constants.TokenKey, Result.Token);

            const usrdata = {
                token: Result.Token,
                userInfo: Result.User,
                admin: Result.IsAdmin ? true : false,
            };

            const store = yield select((s)=>s);
            const astrost = store.astro;
            const appst = store.app;

            const fld = {
                ...astrost.fields,                
            }
            userInfoToFields(fld, Result.User);
            applyPredictiveSetupToFields(fld, appst);
            
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
                safeLocalStorageSet(AstroConst.AspKey, JSON.stringify(aspects));
            }else{
                // 启动订阅里的损坏值会让整个 app 起不来 → 回默认并自愈重写(画盘端读取已有同款守卫)
                try{ aspects = JSON.parse(aspects); }catch(e){
                    aspects = AstroConst.DEFAULT_ASPECTS;
                    try{ safeLocalStorageSet(AstroConst.AspKey, JSON.stringify(aspects)); }catch(e2){ /* ignore */ }
                }
            }
            if(!Array.isArray(aspects)){
                aspects = AstroConst.DEFAULT_ASPECTS;
            }
            const syncWorkspaceHeight = (extraPayload = {})=>{
                const nextViewportHeight = document.documentElement.clientHeight;
                const h = normalizeWorkspaceHeight(nextViewportHeight);
                if(h < MinWorkspaceHeight){
                    return;
                }
                // 箭头函数内不可 yield;此处 getStore() 渲染期快照即可(下一行本就有 astro 存在性守卫)
                const store = getStore();
                const currentHeight = store && store.astro ? store.astro.height : null;
                const hasExtraPayload = extraPayload && Object.keys(extraPayload).length > 0;
                if(!hasExtraPayload && currentHeight === h){
                    return;
                }
                dispatch({
                    type: 'astro/save',
                    payload:{
                        height: h,
                        ...extraPayload,
                    },
                });
            };

            let resizeTimer = null;
            const handleResize = ()=>{
                if(resizeTimer){
                    clearTimeout(resizeTimer);
                }
                resizeTimer = setTimeout(()=>{
                    resizeTimer = null;
                    syncWorkspaceHeight();
                }, 80);
            };
            window.addEventListener('resize', handleResize);

            syncWorkspaceHeight({
                aspects: aspects,
            });
            // 启动加载的相位集也要进 app model:pages/index 是从 app 取 aspects 传给
            // AstroChartMain/AspSelector 的,原先只随上面进了 astro model,app.aspects
            // 重启后一直停在默认值(被 AspSelector 自读 localStorage 掩盖,但 props 消费者拿到的是错的)。
            dispatch({
                type: 'save',
                payload: { aspects: aspects },
            });

            dispatch({
                type: 'getSysTime',
                payload:{},
            });                           

            dispatch({
                type: 'rules/ziwei',
                payload:{},
            });

            // horosa_boot_chart_restore_v1(PERF-R10 S2):温启恢复上次工作现场 —— 快照按
            // fetchByChartData 的 record 口径重放(与「手动载入命盘」逐字节同管线:选项条件
            // 还原/memo 覆盖/hook 全套)。L3 命中时后端未就绪也能先画;miss 时经 boot 门排队,
            // 与用户手动出盘无异。仅桌面壳 + 7 天窗 + kill-switch,全部在 loadBootChartSnapshot
            // 内裁决;用户启动瞬间手动出盘 → fieldsEpoch latest-wins 作废恢复响应,零打架。
            try{
                const bootSnap = loadBootChartSnapshot();
                if(bootSnap){
                    if(bootSnap.currentTab){
                        dispatch({ type: 'astro/save', payload: { currentTab: bootSnap.currentTab } });
                    }
                    dispatch({ type: 'astro/fetchByChartData', payload: bootSnap.record });
                }
            }catch(e){ /* 恢复是优化不是功能,失败静默回空白默认态 */ }

            return ()=>{
                window.removeEventListener('resize', handleResize);
                if(resizeTimer){
                    clearTimeout(resizeTimer);
                    resizeTimer = null;
                }
            };
        },

    },


};
