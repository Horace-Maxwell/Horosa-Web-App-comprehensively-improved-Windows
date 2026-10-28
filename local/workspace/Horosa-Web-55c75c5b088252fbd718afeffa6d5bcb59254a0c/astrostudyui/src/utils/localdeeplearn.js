import ev10000 from '../data/deeplearn/10000.json';
import { safeLocalStorageSet, readUserDataJson } from '../utils/safeStorage';
import ev20000 from '../data/deeplearn/20000.json';
import ev30000 from '../data/deeplearn/30000.json';
import ev40000 from '../data/deeplearn/40000.json';

const LocalDeepLearnKey = 'HorosaLocalDeepLearn';
// 命主实况(问卷)保存后广播:AI 分析页的挂载预览据此重读(subjectFacts 订阅)
export const FATE_EVENTS_CHANGED_EVENT = 'horosa:subject-facts-changed';

const DefaultEvents = {
    Evt10000: ev10000,
    Evt20000: ev20000,
    Evt30000: ev30000,
    Evt40000: ev40000,
};

// 问卷四组(与问卷抽屉的四个页签同序同名;题目与缺省值取各组 JSON)
export const FATE_EVENT_GROUPS = [
    { id: '10000', title: '六亲', events: ev10000 },
    { id: '20000', title: '富贵程度', events: ev20000 },
    { id: '30000', title: '职业', events: ev30000 },
    { id: '40000', title: '死亡方式', events: ev40000 },
];

function cloneObj(obj){
    return JSON.parse(JSON.stringify(obj));
}

function buildDefaultVals(evtMap){
    const vals = {};
    if(!evtMap){
        return vals;
    }
    Object.keys(evtMap).forEach((key)=>{
        const cfg = evtMap[key];
        vals[key] = cfg && cfg.defval !== undefined ? cfg.defval : 0;
    });
    return vals;
}

function mergeVals(evtMap, vals){
    const res = {};
    if(!evtMap){
        return res;
    }
    Object.keys(evtMap).forEach((key)=>{
        const cfg = evtMap[key];
        const defval = cfg && cfg.defval !== undefined ? cfg.defval : 0;
        if(vals && vals[key] !== undefined && vals[key] !== null){
            res[key] = vals[key];
        }else{
            res[key] = defval;
        }
    });
    return res;
}

// 读端单源 readUserDataJson:坏数据先留档(留不成就不让之后的写盖掉原串),再当空
function readLocalStore(){
    return { ...readUserDataJson(LocalDeepLearnKey, {}) };
}

// 写不进(存储满 / 坏原串封锁)回 false
function writeLocalStore(data){
    try{
        return safeLocalStorageSet(LocalDeepLearnKey, JSON.stringify(data));
    }catch(e){
        return false;
    }
}

export function buildDefaultFateEvents(cid){
    return {
        Cid: cid,
        Evt10000: cloneObj(DefaultEvents.Evt10000),
        Evt20000: cloneObj(DefaultEvents.Evt20000),
        Evt30000: cloneObj(DefaultEvents.Evt30000),
        Evt40000: cloneObj(DefaultEvents.Evt40000),
        Val10000: buildDefaultVals(DefaultEvents.Evt10000),
        Val20000: buildDefaultVals(DefaultEvents.Evt20000),
        Val30000: buildDefaultVals(DefaultEvents.Evt30000),
        Val40000: buildDefaultVals(DefaultEvents.Evt40000),
    };
}

export function loadLocalFateEvents(cid){
    const def = buildDefaultFateEvents(cid);
    if(!cid){
        return def;
    }
    const store = readLocalStore();
    const localRec = store[cid];
    if(!localRec){
        return def;
    }
    return {
        ...def,
        Val10000: mergeVals(def.Evt10000, localRec.Val10000),
        Val20000: mergeVals(def.Evt20000, localRec.Val20000),
        Val30000: mergeVals(def.Evt30000, localRec.Val30000),
        Val40000: mergeVals(def.Evt40000, localRec.Val40000),
    };
}

// 某张命盘存下的原始答案({ Val10000, Val20000, Val30000, Val40000 });没填过 = null。只读,不补缺省、不克隆题目表
export function readLocalFateValues(cid){
    if(!cid){
        return null;
    }
    const rec = readLocalStore()[cid];
    return rec && typeof rec === 'object' && !Array.isArray(rec) ? rec : null;
}

// 回是否写进去了;写不进(存储满 / 坏原串封锁)不广播
export function saveLocalFateEvents(data){
    if(!data || !data.Cid){
        return false;
    }
    const cid = data.Cid;
    const store = readLocalStore();
    store[cid] = {
        Val10000: data.Val10000 || {},
        Val20000: data.Val20000 || {},
        Val30000: data.Val30000 || {},
        Val40000: data.Val40000 || {},
    };
    if(!writeLocalStore(store)){
        return false;
    }
    try{
        if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
            window.dispatchEvent(new CustomEvent(FATE_EVENTS_CHANGED_EVENT, { detail: { cid } }));
        }
    }catch(e){ /* 旧环境无 CustomEvent:不广播,挂载预览下次打开时照样重读 */ }
    return true;
}
