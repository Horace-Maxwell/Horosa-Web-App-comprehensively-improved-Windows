// 进程内结果缓存登记处:持有「同参复用上次结果」缓存的模块,在模块载入时把清空本模块缓存的函数登记于此。
// 产品运行期从不调用清空 —— 同盘同参复用是对的,登记只存一个函数引用,零行为变化。
// 用途只有审计仪器(设置差分闸 / 探针):每次取样前一次清空全部登记缓存,使每一遍都真算一次、真发一次请求,
// 判据不随「这个请求体本进程里是否出现过」漂移。缓存若藏在请求捕获点之上却没登记,差分闸缺省两遍的请求数
// 就对不上,仪器自检当场报出是哪个端点 —— 照此在缓存所在模块补一行 registerProcessCache 即可。
const REGISTRY = new Map();

export function registerProcessCache(name, clear){
	if(!name || typeof clear !== 'function'){
		return;
	}
	REGISTRY.set(`${name}`, clear);
}

export function clearRegisteredProcessCaches(){
	REGISTRY.forEach((clear)=>{
		try{ clear(); }catch(e){ /* 单个缓存清空失败不影响其余 */ }
	});
}

export function registeredProcessCacheNames(){
	return [...REGISTRY.keys()];
}
