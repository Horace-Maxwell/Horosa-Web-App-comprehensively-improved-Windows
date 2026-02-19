
let _globalStore = {};
export function setGlobalStore(store){
    _globalStore = store;
}

export function getStore(){
    return _globalStore;
}
  
function traverseMenus(menumap, menus){
    if(menus === undefined || menus === null || menus.length === undefined || menus.length === 0){
        return;
    }

    menus.forEach((menu)=>{
        menu.key = menu.id;
        menumap.set(menu.id, menu);
        if(menu.submenu && menu.submenu.length > 0){
            traverseMenus(menumap, menu.submenu);
        }
    });
}

export function generateMenuInfo(menus){
    if(menus === undefined || menus === null){
        return {};
    }

    let menuMap = new Map();
    traverseMenus(menuMap, menus);

    let menuOpenKeys = [];
    let rootSubmenuKeys = [];
    if(menus.length !== undefined && menus.length > 0){
        menuOpenKeys.push(menus[0].id);
        rootSubmenuKeys = menus.map((item)=>{
            return item.id;
        });
    }

    return {
        menuMap: menuMap,
        menuOpenKeys: menuOpenKeys,
        rootSubmenuKeys: rootSubmenuKeys
    }
}

