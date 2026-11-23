// 把按职责拆到别的文件里的组件方法挂回类原型(大类按职责拆成几个文件时用)。
// 与写在类里等价:方法照旧在原型上、照旧不可枚举 / 可改写 / 可重配(spyOn(类.prototype, '方法') 照常),this 照旧是实例,
// getter / setter 原样带过去。同名已在原型上(类里没删干净 / 两份拆片撞名)直接抛错 —— 绝不悄悄覆盖。
export function mixinMethods(Cls, ...groups){
	groups.forEach((group)=>{
		Object.getOwnPropertyNames(group).forEach((key)=>{
			if(Object.prototype.hasOwnProperty.call(Cls.prototype, key)){
				throw new Error(`mixinMethods: ${Cls.name}.prototype.${key} 已存在(类里没删干净,或两份拆片同名)`);
			}
			const desc = Object.getOwnPropertyDescriptor(group, key);
			Object.defineProperty(Cls.prototype, key, { ...desc, enumerable: false });
		});
	});
	return Cls;
}
