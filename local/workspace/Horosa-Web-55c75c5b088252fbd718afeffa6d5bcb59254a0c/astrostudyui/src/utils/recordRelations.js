// 记录深化三件纯函数层:断事日志追加 / 关系边(双向) / 重复检测与合并。
// 全部走「字段进记录体+未知键保全」范式:journal/relations 数组随记录全链(导出/导入/
// 副本/回收站/影子/版本历史)自动保真,零内核改动。
import { listLocalCharts, upsertLocalChart, removeLocalChart } from './localcharts';
import { listLocalCases, upsertLocalCase, removeLocalCase } from './localcases';
import { RECORD_COPY_STRIP_KEYS } from './localRecordStore';
import { parseLocalDateTimeMs } from './dateTimeParse';

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

// 断事日志追加:journal=[{at,text}],新在前;记录内容更新语义(刷新 updateTime,
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

// 双向关系边:A.relations 加 {cid:B,type},B 侧写反向(parent↔child 互逆,其余对称)。
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
	try{
		setEdge(b, cidA, RELATION_INVERSE[type] || type);
	}catch(e){
		rollbackRelations(upsert, a);   // 第二笔没写进(配额满):第一笔回滚,不留单向边;错误照抛给调用方提示
		throw e;
	}
	return true;
}

// 回到写前的关系边(与 AI 关联工具同一回滚语义);回滚本身失败只能如实报,不再抛第二次
function rollbackRelations(upsert, rec){
	try{
		upsert({ cid: rec.cid, relations: Array.isArray(rec.relations) ? rec.relations : [], preserveUpdateTime: true, updateTime: rec.updateTime });
	}catch(_e){ /* 回滚失败:由调用方的报错覆盖 */ }
}

export function unlinkRecords(kind, cidA, cidB){
	const { list, upsert } = api(kind);
	const all = list({ includeArchived: true });
	const done = [];
	[[cidA, cidB], [cidB, cidA]].forEach(([selfCid, otherCid])=>{
		const rec = all.find((r)=>r && r.cid === selfCid);
		if(rec && Array.isArray(rec.relations)){
			try{
				upsert({ cid: selfCid, relations: rec.relations.filter((e)=>e && e.cid !== otherCid), preserveUpdateTime: true, updateTime: rec.updateTime });
				done.push(rec);
			}catch(e){
				done.forEach((r)=>rollbackRelations(upsert, r));   // 只解了一侧:回滚已解的那侧
				throw e;
			}
		}
	});
}

// 重复检测:精确=同名+同生辰(分钟级);近似=同名+生辰差≤24h。返回分组(每组≥2)。
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
		// 生辰按本地钟面经单源解析(引擎无关;负年照认)—— 此前 Date.parse('YYYY/MM-DD …') 在 WebKit 回 NaN,近似组永远不出
		const t1 = parseLocalDateTimeMs(list[i][tf]);
		const group = [list[i]];
		for(let j = i + 1; j < list.length; j++){
			if(used.has(list[j].cid)){
				continue;
			}
			const name2 = `${list[j].name || list[j].event || ''}`.trim();
			if(name !== name2){
				continue;
			}
			const t2 = parseLocalDateTimeMs(list[j][tf]);
			const exact = `${list[i][tf] || ''}`.slice(0, 16) === `${list[j][tf] || ''}`.slice(0, 16);
			const near = Number.isFinite(t1) && Number.isFinite(t2) && Math.abs(t1 - t2) <= 24 * 3600 * 1000;
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

// 合并:主记录吸收副记录 —— 备注拼接、标签/journal/relations 并集,其余字段主优先
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
	// 名人库旧档(早先导入的只在 cid 里带「adb-…」身份,没有 celebrityId 字段):副记录是这种形态时编号取自它的 cid
	const sCelebrityId = s.celebrityId || (/^adb-/.test(`${s.cid || ''}`) ? `${s.cid}` : undefined);
	if((merged.celebrityId === undefined || merged.celebrityId === null || merged.celebrityId === '') && sCelebrityId){
		merged.celebrityId = sCelebrityId;
	}
	Object.keys(s).forEach((k)=>{
		// 存储身份 / 管理字段 / 外部身份 / 关系边不从副记录补(此前把已归档、置底的副记录并进来,主记录也变成归档 / 置底)
		// 名人库编号例外:主记录缺时照补 —— 合并后的这条就是那位名人的档案,缺了编号名人库 / AI 建档会再建一条
		if(RECORD_COPY_STRIP_KEYS.indexOf(k) >= 0 && k !== 'celebrityId'){
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
				if(!e || !e.cid || e.cid === primaryCid || e.cid === secondaryCid || seen.has(e.cid)){
					return false;
				}
				seen.add(e.cid);
				return true;
			});
	}
	const saved = upsert(merged);
	// 第三方记录指向副记录的边改指主记录(已有指向主记录的边就保留那条、不重复):此前不改,
	// 副记录进回收站后这些边悬空,主记录从副记录继承来的边又成了单向边。中途写不进 → 已改的回滚,副记录不删,照抛
	const redirected = [];
	try{
		all.forEach((r)=>{
			if(!r || !r.cid || r.cid === primaryCid || r.cid === secondaryCid || !Array.isArray(r.relations)){ return; }
			if(!r.relations.some((e)=>e && e.cid === secondaryCid)){ return; }
			const hasPrimary = r.relations.some((e)=>e && e.cid === primaryCid);
			const edges = [];
			r.relations.forEach((e)=>{
				if(e && e.cid === secondaryCid){
					if(!hasPrimary && !edges.some((x)=>x && x.cid === primaryCid)){ edges.push({ ...e, cid: primaryCid }); }
					return;
				}
				edges.push(e);
			});
			upsert({ cid: r.cid, relations: edges, preserveUpdateTime: true, updateTime: r.updateTime });
			redirected.push(r);
		});
	}catch(e){
		redirected.forEach((r)=>rollbackRelations(upsert, r));
		const err = new Error('relations-not-redirected');
		err.partial = true;
		err.saved = saved;
		throw err;
	}
	const w = remove(secondaryCid);
	if(w && !w.persisted && w.reason === 'quota'){
		// 主记录已并好,副本没能移入回收站(配额满):两条都还在,不丢数据;如实告诉调用方
		const err = new Error('secondary-not-removed');
		err.partial = true;
		err.saved = saved;
		throw err;
	}
	return saved;
}
