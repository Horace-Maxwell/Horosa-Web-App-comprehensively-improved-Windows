// 本地记录存储 · 列表与单条操作:标签表、分页、星标 / 标签 / 置顶 / 打开记账、拖动排序
// 从 localRecordStore.js 按职责拆出的 createLocalRecordStore 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { safeParseJson, nowStr } from './recordShape';
import { effOrderKey } from './listSerialize';

// 标签筛选下拉的选项源:全量聚合去重(首次出现序),与 list 的 tag 筛选判据同源。
export function listTags({ readRaw }){
	const seen = new Set();
	const tags = [];
	readRaw().forEach((item)=>{
		const raw = item && item.group;
		const grp = raw instanceof Array ? raw : safeParseJson(raw, null);
		if(grp instanceof Array){
			grp.forEach((t)=>{
				const s = t === undefined || t === null ? '' : `${t}`;
				if(s && !seen.has(s)){
					seen.add(s);
					tags.push(s);
				}
			});
		}
	});
	return tags;
}

export function getPaged({ list }, params){
	const pidx = params && params.PageIndex ? parseInt(params.PageIndex + '', 10) : 1;
	const psz = params && params.PageSize ? parseInt(params.PageSize + '', 10) : 30;
	const all = list(params || {});
	const start = (pidx - 1) * psz;
	const end = start + psz;
	return {
		List: all.slice(start, end),
		Total: all.length,
		PageIndex: pidx,
		PageSize: psz,
	};
}

// [V 置顶/置底] tier: 1=置顶 | -1=置底 | 0/null=取消。内核直写(不经 buildRecord),
// 不刷新 updateTime(置顶不该改变「最近更新」语义);quota 拒写如实抛错。
// 归档/星标:布尔管理字段(true 落键/false 删键=零体积语义;不刷新 updateTime;
// 未知键保全 → 导出/导入/副本/回收站全链自动保真,零额外接线)。
export function setFlag({ readRaw, writeRaw, saveErrorCode }, cid, field, on){
	if(field !== 'archived' && field !== 'starred'){
		return null;
	}
	const all = readRaw();
	const idx = all.findIndex((r)=>r && r.cid === cid);
	if(idx < 0){
		return null;
	}
	const rec = { ...all[idx] };
	if(on){
		rec[field] = true;
	}else{
		delete rec[field];
	}
	all[idx] = rec;
	const saved = writeRaw(all);
	if(!saved.persisted && saved.reason === 'quota'){
		throw new Error(saveErrorCode);
	}
	return rec;
}

// 使用足迹:载入记录时悄悄记 lastOpenedAt/openCount —— 不刷新 updateTime、
// 不动排序数轴(effOrderKey 只认 orderKey/updateTime);写失败静默(足迹丢了无害)。
// 整体改写标签列表(只增工具用:追加一个 / 撤销时回到写前列表);内核直写不经 buildRecord,不刷新 updateTime。
export function setTags({ readRaw, writeRaw, saveErrorCode }, cid, tags){
	const all = readRaw();
	const idx = all.findIndex((r)=>r && r.cid === cid);
	if(idx < 0){
		return null;
	}
	const rec = { ...all[idx] };
	const list = (tags instanceof Array ? tags : []).map((t)=>`${t}`.trim()).filter(Boolean);
	if(list.length){
		rec.group = JSON.stringify(list);
	}else{
		delete rec.group;
	}
	all[idx] = rec;
	const saved = writeRaw(all);
	if(!saved.persisted && saved.reason === 'quota'){
		throw new Error(saveErrorCode);
	}
	return rec;
}

export function touchRecord({ readRaw, writeRaw }, cid){
	const all = readRaw();
	const idx = all.findIndex((r)=>r && r.cid === cid);
	if(idx < 0){
		return null;
	}
	const rec = { ...all[idx] };
	rec.lastOpenedAt = nowStr();
	rec.openCount = (parseInt(rec.openCount, 10) || 0) + 1;
	all[idx] = rec;
	try{
		writeRaw(all);
	}catch(_e){
		// 足迹写失败无害。
	}
	return rec;
}

export function setPin({ readRaw, writeRaw, saveErrorCode }, cid, tier){
	const all = readRaw();
	const idx = all.findIndex((r)=>r && r.cid === cid);
	if(idx < 0){
		return null;
	}
	const rec = { ...all[idx] };
	if(tier === 1 || tier === -1){
		rec.pinTier = tier;
		rec.pinAt = nowStr();
	}else{
		delete rec.pinTier;
		delete rec.pinAt;
	}
	all[idx] = rec;
	const saved = writeRaw(all);
	if(!saved.persisted && saved.reason === 'quota'){
		throw new Error(saveErrorCode);
	}
	return rec;
}

// [V 上移/下移] 与同层相邻记录交换有效排序键(dir: -1 上移 | 1 下移)。
// 无显式 orderKey 的一方当场固化为其时间戳负值 → 交换后两条都进显式数轴,其余记录零扰动。
// 仅默认序语义(表头字段排序激活时 UI 禁用);边界(已最前/最后)原样返回。
// 🔴 禁原地改共享引用(S9 缓存契约):map 重建两条。
export function moveRecord({ readRaw, writeRaw, saveErrorCode }, cid, dir){
	const all = readRaw();
	const rec = all.find((r)=>r && r.cid === cid);
	if(!rec){
		return null;
	}
	const tierOf = (r)=>(r && r.pinTier === 1 ? 1 : (r && r.pinTier === -1 ? -1 : 0));
	const tier = tierOf(rec);
	const layer = all.filter((r)=>tierOf(r) === tier).sort((a, b)=>effOrderKey(a) - effOrderKey(b));
	const idx = layer.findIndex((r)=>r.cid === cid);
	const j = idx + (dir < 0 ? -1 : 1);
	if(j < 0 || j >= layer.length){
		return rec;
	}
	const nb = layer[j];
	const ka = effOrderKey(rec);
	const kb = effOrderKey(nb);
	const next = all.map((r)=>{
		if(r && r.cid === rec.cid){
			return { ...r, orderKey: kb };
		}
		if(r && r.cid === nb.cid){
			return { ...r, orderKey: ka };
		}
		return r;
	});
	const saved = writeRaw(next);
	if(!saved.persisted && saved.reason === 'quota'){
		throw new Error(saveErrorCode);
	}
	return true;
}
