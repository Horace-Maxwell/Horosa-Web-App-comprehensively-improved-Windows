// 神数正传 · 五流派之名 —— 单一真源（纯常量，零依赖）。
//
// 🔴 何以独立成文件，而不搁在 ZhengChuanMain 里：
//    ZhengChuanMain 是被数算宿主 React.lazy 载入的，宿主若再静态 import 它取常量 →
//    成【循环依赖】：宿主 → ZhengChuanMain → …，其时 lazy 的那个导出解析为 undefined，
//    整页当场崩「Element type is invalid … got: undefined」(实测如此)。
//    且静态 import 亦会把其引擎从 lazy chunk 里拖回宿主 chunk，前功尽弃。
//    故常量另置一处：宿主与组件各自引之，两不相涉。
export const SCHOOL_LABEL = {
	tieban: '铁板神数',
	shaozi: '邵子神数',
	dading: '大定神数',
	liuqin: '六亲属相姓氏断',
	xinyi: '铁算心易（查询）',
};

export const SCHOOL_KEYS = Object.keys(SCHOOL_LABEL);

export default SCHOOL_LABEL;
