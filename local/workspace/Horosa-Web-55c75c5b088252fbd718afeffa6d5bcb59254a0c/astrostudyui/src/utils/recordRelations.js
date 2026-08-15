// [V5-D13/D14/D18] 记录深化三件纯函数层:断事日志追加 / 关系边(双向) / 重复检测与合并。
// 全部走「字段进记录体+未知键保全」范式:journal/relations 数组随记录全链(导出/导入/
// 副本/回收站/影子/版本历史)自动保真,零内核改动。
import { listLocalCharts, upsertLocalChart, removeLocalChart } from './localcharts';
import { listLocalCases, upsertLocalCase, removeLocalCase } from './localcases';

export const RELATION_TYPES = [
	{ value: 'spouse', label: '配偶' },
	{ value: 'parent', label: '父母' },
	{ value: 'child', label: '子女' },
	{ value: 'sibling', label: '兄弟姐妹' },
	{ value: 'client', label: '客户' },
	{ value: 'friend', label: '朋友' },
	{ value: 'other', label: '其他' },
];

const RELATION_INVERSE = { parent: 'child', child: 'parent' };

function api(kind){
	return kind === 'case'
		? { list: listLocalCases, upsert: upsertLocalCase, remove: removeLocalCase }
		: { list: listLocalCharts, upsert: upsertLocalChart, remove: removeLocalChart };
}

// [D14] 断事日志追加:journal=[{at,text}],新在前;记录内容更新语义(刷新 updateTime,
// 触发版本历史快照——都合理)。
export function appendRecordJournal(kind, cid, text){
	const { list, upsert } = api(kind);
	const rec = list({ includeArchived: true }).find((r)=>r && r.cid === cid);
	if(!rec || !`${text || ''}`.trim()){
		return null;
	}
	const now = new Date();
	const p = (n)=>`${n}`.padStart(2, '0');
	const at = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;
	const journal = [{ at, text: `${text}`.trim() }, ...(Array.isArray(rec.journal) ? rec.journal : [])];
	return upsert({ cid, journal });
}

// [D18] 双向关系边:A.relations 加 {cid:B,type},B 侧写反向(parent↔child 互逆,其余对称)。
// 同对已有边则覆盖类型(去重按对端 cid)。
export function linkRecords(kind, cidA, cidB, type){
	if(!cidA || !cidB || cidA === cidB){
		return false;
	}
	const { list, upsert } = api(kind);
	const all = list({ includeArchived: true });
	const a = all.find((r)=>r && r.cid === cidA);
	const b = all.find((r)=>r && r.cid === cidB);
	if(!a || !b){
		return false;
	}
	const setEdge = (rec, otherCid, t)=>{
		const edges = (Array.isArray(rec.relations) ? rec.relations : []).filter((e)=>e && e.cid !== otherCid);
		edges.push({ cid: otherCid, type: t });
		upsert({ cid: rec.cid, relations: edges, preserveUpdateTime: true, updateTime: rec.updateTime });
	};
	setEdge(a, cidB, type);
	setEdge(b, cidA, RELATION_INVERSE[type] || type);
	return true;
}

export function unlinkRecords(kind, cidA, cidB){
	const { list, upsert } = api(kind);
	const all = list({ includeArchived: true });
	[[cidA, cidB], [cidB, cidA]].forEach(([selfCid, otherCid])=>{
		const rec = all.find((r)=>r && r.cid === selfCid);
		if(rec && Array.isArray(rec.relations)){
			upsert({ cid: selfCid, relations: rec.relations.filter((e)=>e && e.cid !== otherCid), preserveUpdateTime: true, updateTime: rec.updateTime });
		}
	});
}

// [D13] 重复检测:精确=同名+同生辰(分钟级);近似=同名+生辰差≤24h。返回分组(每组≥2)。
export function findDuplicateGroups(records, timeField){
	const tf = timeField || 'birth';
	const groups = [];
	const used = new Set();
	const list = (records || []).filter((r)=>r && r.cid);
	for(let i = 0; i < list.length; i++){
		if(used.has(list[i].cid)){
			continue;
		}
		const name = `${list[i].name || list[i].event || ''}`.trim();
		if(!name){
			continue;
		}
		const t1 = Date.parse(`${list[i][tf] || ''}`.replace(/-/, '/')) || 0;
		const group = [list[i]];
		for(let j = i + 1; j < list.length; j++){
			if(used.has(list[j].cid)){
				continue;
			}
			const name2 = `${list[j].name || list[j].event || ''}`.trim();
			if(name !== name2){
				continue;
			}
			const t2 = Date.parse(`${list[j][tf] || ''}`.replace(/-/, '/')) || 0;
			const exact = `${list[i][tf] || ''}`.slice(0, 16) === `${list[j][tf] || ''}`.slice(0, 16);
			const near = t1 && t2 && Math.abs(t1 - t2) <= 24 * 3600 * 1000;
			if(exact || near){
				group.push(list[j]);
			}
		}
		if(group.length >= 2){
			group.forEach((r)=>used.add(r.cid));
			groups.push(group);
		}
	}
	return groups;
}

// [D13] 合并:主记录吸收副记录 —— 备注拼接、标签/journal/relations 并集,其余字段主优先
// 主缺则从副补(未知键含);副记录 remove(进回收站可反悔)。纯数据操作,调用方过确认 UI。
export function mergeRecords(kind, primaryCid, secondaryCid){
	const { list, upsert, remove } = api(kind);
	const all = list({ includeArchived: true });
	const p = all.find((r)=>r && r.cid === primaryCid);
	const s = all.find((r)=>r && r.cid === secondaryCid);
	if(!p || !s){
		return null;
	}
	const merged = { ...p };
	Object.keys(s).forEach((k)=>{
		if(k === 'cid' || k === 'schemaVersion' || k === 'updateTime'){
			return;
		}
		if(merged[k] === undefined || merged[k] === null || merged[k] === ''){
			merged[k] = s[k];
		}
	});
	if(p.memo && s.memo && p.memo !== s.memo){
		merged.memo = `${p.memo}\n—— 合并自副本 ——\n${s.memo}`;
	}
	try{
		const gp = JSON.parse(p.group || '[]');
		const gs = JSON.parse(s.group || '[]');
		const union = [...new Set([...(gp instanceof Array ? gp : []), ...(gs instanceof Array ? gs : [])])];
		if(union.length){
			merged.group = union;
		}
	}catch(_e){ /* 标签解析失败保主 */ }
	if(Array.isArray(p.journal) || Array.isArray(s.journal)){
		merged.journal = [...(Array.isArray(p.journal) ? p.journal : []), ...(Array.isArray(s.journal) ? s.journal : [])]
			.sort((x, y)=>`${(y && y.at) || ''}`.localeCompare(`${(x && x.at) || ''}`));
	}
	if(Array.isArray(p.relations) || Array.isArray(s.relations)){
		const seen = new Set();
		merged.relations = [...(Array.isArray(p.relations) ? p.relations : []), ...(Array.isArray(s.relations) ? s.relations : [])]
			.filter((e)=>{
				if(!e || !e.cid || e.cid === primaryCid || seen.has(e.cid)){
					return false;
				}
				seen.add(e.cid);
				return true;
			});
	}
	const saved = upsert(merged);
	remove(secondaryCid);
	return saved;
}
