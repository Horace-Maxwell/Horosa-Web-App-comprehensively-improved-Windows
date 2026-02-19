import ev10000 from '../data/deeplearn/10000.json';
import ev20000 from '../data/deeplearn/20000.json';
import ev30000 from '../data/deeplearn/30000.json';
import ev40000 from '../data/deeplearn/40000.json';

const LocalDeepLearnKey = 'HorosaLocalDeepLearn';

const DefaultEvents = {
    Evt10000: ev10000,
    Evt20000: ev20000,
    Evt30000: ev30000,
    Evt40000: ev40000,
};

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

function readLocalStore(){
    try{
        const txt = localStorage.getItem(LocalDeepLearnKey);
        if(!txt){
            return {};
        }
        const json = JSON.parse(txt);
        if(!json || typeof json !== 'object'){
            return {};
        }
        return json;
    }catch(e){
        return {};
    }
}

function writeLocalStore(data){
    try{
        localStorage.setItem(LocalDeepLearnKey, JSON.stringify(data));
    }catch(e){
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

export function saveLocalFateEvents(data){
    if(!data || !data.Cid){
        return;
    }
    const cid = data.Cid;
    const store = readLocalStore();
    store[cid] = {
        Val10000: data.Val10000 || {},
        Val20000: data.Val20000 || {},
        Val30000: data.Val30000 || {},
        Val40000: data.Val40000 || {},
    };
    writeLocalStore(store);
}
