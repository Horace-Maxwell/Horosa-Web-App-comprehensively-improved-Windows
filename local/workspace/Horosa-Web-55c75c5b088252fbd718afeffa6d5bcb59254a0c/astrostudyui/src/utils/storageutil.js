
let _globalStore = {};
export function setGlobalStore(store){
    _globalStore = store;
}

export function getStore(){
    return _globalStore;
}
