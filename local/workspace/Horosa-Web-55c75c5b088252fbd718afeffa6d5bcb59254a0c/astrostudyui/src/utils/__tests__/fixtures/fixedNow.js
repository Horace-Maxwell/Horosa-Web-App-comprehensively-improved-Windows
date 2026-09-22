// 零回归指纹用的「钉住此刻」钩:HOROSA_FIXED_NOW=<ISO 时刻> 时把测试沙箱的 Date 换成「无参构造与 Date.now 恒返回该时刻」的子类;
// 未设环境变量时什么都不做(断言与产物不变)。
// 只给指纹 dump 用:推运类技法目标时刻缺省 = 此刻,不钉住的话两次拍指纹之间墙钟一走,角分乃至界主都会漂(不是行为变化)。
// 源码里没有按 Date.now 忙等的循环(已核),冻结时钟不会挂死;jest 自己的超时走真实定时器,不受影响。
export function installFixedNow(){
	const iso = process.env.HOROSA_FIXED_NOW;
	if(!iso){ return false; }
	const fixed = new Date(iso).getTime();
	if(!Number.isFinite(fixed)){ return false; }
	const RealDate = global.Date;
	if(RealDate.__horosaFixed){ return true; }
	class FixedDate extends RealDate {
		constructor(...args){
			if(args.length === 0){ super(fixed); } else { super(...args); }
		}
		static now(){ return fixed; }
	}
	FixedDate.UTC = RealDate.UTC;
	FixedDate.parse = RealDate.parse;
	FixedDate.__horosaFixed = true;
	global.Date = FixedDate;
	return true;
}
