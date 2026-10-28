// 紫微按盘临时覆盖(挂载快照 / 盘面截图共用 applyZiweiRecordOverride)的在途登记。
// 紫微左栏构造时会按本机偏好重写引擎单例;若此刻有临时覆盖在途(截图正在按这张盘的随盘设置出图),
// 偏好同步完后须把在途覆盖重新压回单例,并把「还原后应回到的值」改成刚同步的本机偏好 ——
// 否则截图按本机偏好出图,还原时又回到同步前的旧值。
const active = [];

export function registerZiweiTempOverride(entry){
	active.push(entry);
	return function unregister(){
		const i = active.indexOf(entry);
		if(i >= 0){ active.splice(i, 1); }
	};
}

// 偏好同步之后调用:按登记先后把每个在途覆盖重新压回(各自的「还原值」改记为压回前的单例值)
export function reassertZiweiTempOverrides(){
	active.slice().forEach((entry)=>{
		try{ entry.reassert(); }catch(e){ /* 单个覆盖失败不影响其余 */ }
	});
}

// 覆盖在途期间有紫微页首次挂载(左栏构造时压回过覆盖):那一页第一次排盘可能用的是覆盖值。
// 覆盖还原后广播这个事件,紫微页按当前字段重排一次,回到本机偏好(单例已还原);期间没有页面挂载就不广播。
export const ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT = 'horosa:ziwei-temp-override-restored';
export function notifyZiweiTempOverrideRestored(){
	if(typeof window === 'undefined' || typeof window.dispatchEvent !== 'function'){ return; }
	window.dispatchEvent(new CustomEvent(ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT));
}

export function __activeZiweiTempOverrideCountForTests(){ return active.length; }
