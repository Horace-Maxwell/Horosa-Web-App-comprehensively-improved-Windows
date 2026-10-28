import { SETTING_FACETS, validateFacetValues, snapshotFacet, applyFacetValues, preparePageFacet, describeFacet, captureWrittenValues, techniqueScopeNote, planMountWrite, planChartZoneForGeo, planSettingsWrite, settingsChangedKeys } from '../settingsFacets';
import { getStore } from '../../storageutil';
import { resolvePlaceOffline } from '../normalize/place';
import { castInputRejectMessage, pageCastTechnique } from '../castInputKeys';
import { GUIDE } from './_shared';
import { settingFacetTitle, settingTechniqueTitle, settingItemNamer } from '../settingNames';

// 审批卡与执行后的回包 / 动作条摘要 / 账本给用户看:设置面与技法用中文名,键名换成设置项名称、档值换成档名(找不到时才退回原值);
// 名字单源 settingNames(审批卡与执行后同一套)

// 无变化 → 最终回包(预览的 reject 与注册表的无变化预检同一份);判不了 / 有变化 → null
function noChangeOf(args, v, placeResult){
	const keys = Object.keys(v.values);
	if(!keys.length){ return null; }
	const plan = planSettingsWrite(args.facet, args.technique, v.values, placeResult ? { placeResult } : undefined);
	if(!plan.known || plan.changedKeys.length){ return null; }
	return { ok: false, code: 'E_SETTING_NO_CHANGE', message: `「${settingFacetTitle(args.facet, args.technique)}」设置没有变化(写的就是现值 / 删的项本来就没有),未写入` };
}

export default {
	name: 'set_settings',
	level: 'additive',
	category: 'settings',
	undoKind: 'restore-settings',
	description: `修改排盘口径或显示偏好(chart=当前盘口径 / mount=某技法的 AI 挂载默认 / app=全局显示偏好 / classical=古典占星全局参数 / technique=技法本地设置 / page=技法页保存的排盘设置,technique 填页键如 liureng / dunjia / taiyi)。${GUIDE}:仅当用户明确要求改设置时调用,先用 describe_settings 取合法键值;一次调用要么全部生效要么全部拒绝;不会删除档案;chart 面改地点(place 或 gpsLat+gpsLon)与页面换地点一致:时区随之换成该地在盘上日期的时区(钟面时刻不变),撤销一并还原;mount 面某个值传 null = 只把同类默认里的这一项删掉(回到不设;删完为空时拒绝,整个恢复默认请用户在挂载设置里点),「随流派」项的空串另有含义(见 describe_settings 的提示);起卦输入(种子 / 报数 / 起例模式 / 牌阵等;mount 与 page 面同一张表)不能写具体值,只能删掉(mount 面传 null)或写回「自动」那一档(见 describe_settings 的提示);密钥、模型接口、备份不在此面。撤销只还原本次改的键,且这些键之后被改过就不自动恢复;mount 面删键的撤销要求同类默认整张之后没再变过(之后同一技法又改过,请倒序撤)。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['facet', 'values'],
		properties: {
			facet: { type: 'string', enum: SETTING_FACETS },
			technique: { type: 'string', maxLength: 40 },
			values: { type: 'object', minProperties: 1, maxProperties: 20, additionalProperties: { type: ['string', 'number', 'boolean', 'array', 'null'] } },
		},
	},
	async snapshot(args){
		if(args.facet === 'page'){ await preparePageFacet(args.technique); }   // 页面面 schema 惰性载入
		const v = validateFacetValues(args.facet, args.technique, args.values);
		if(!v.ok){ return null; }
		return snapshotFacet(args.facet, args.technique, Object.keys(v.values));
	},
	// 写前预览:当前值 → 改后值(只含本次要改的键;纯读)
	async preview(args){
		if(args.facet === 'page'){ await preparePageFacet(args.technique); }
		const v = validateFacetValues(args.facet, args.technique, args.values);
		if(!v.ok){ return null; }
		const keys = Object.keys(v.values).sort();
		let placeResult = null;   // 按地名写:预览解析出的地名(无变化判定与执行同一份写入计划要它)
		let cur = {};
		if(args.facet === 'page' || args.facet === 'technique'){
			// 页面面的写前快照只记已存过的字段原值;technique 面的写前快照按存储键记(预览按字段名取):预览都改用 describe 的逐键现值(含缺省)
			const d = describeFacet(args.facet, args.technique, args.facet === 'technique' ? v.values : undefined);
			(d.ok ? d.items : []).forEach((it)=>{ cur[it.key] = it.current; });
		}else{
			const snap = snapshotFacet(args.facet, args.technique, keys);
			cur = snap && snap.snapshot && typeof snap.snapshot === 'object' ? snap.snapshot : {};
		}
		// 经纬按数写:只认严格十进制(数字串转成数,别的原样带引号;不拿 Number() 试探 '116E24' 这类写法)
		const num = (x)=>{
			if(x === undefined || x === null || x === ''){ return '(未设)'; }
			if(typeof x === 'number'){ return `${x}`; }
			const t = `${x}`.trim();
			return /^-?\d+(\.\d+)?$/.test(t) ? `${Number(t)}` : JSON.stringify(x);
		};
		const geoKey = (k)=>args.facet === 'chart' && (k === 'gpsLat' || k === 'gpsLon');
		// 设置项名与档名按本次要写的值判显隐(上级改档才显示出来的子项也用中文名;此刻隐藏着要删的旧键按字段表兜底)
		const namer = settingItemNamer(args.facet, args.technique, v.values);
		const nameOf = namer.nameOf;
		const val = (k, x)=>(geoKey(k) ? num(x) : namer.valueOf(k, x));
		// 只展示本次要改的键:当前值缺席写「(未设)」,改后值就是本次给的值
		const shown = (o, k)=>(Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null ? val(k, o[k]) : '(未设)');
		const fmt = (o)=>keys.filter((k)=>!(args.facet === 'chart' && k === 'place')).map((k)=>`${nameOf(k)}: ${shown(o, k)}`).join('\n');
		const after = { ...cur, ...v.values };
		const absent = (k)=>!Object.prototype.hasOwnProperty.call(cur, k);   // 与执行(apply)同一判据:有这个键就会删
		const fmtAfter = ()=>keys.filter((k)=>!(args.facet === 'chart' && k === 'place')).map((k)=>(v.values[k] === null ? `${nameOf(k)}: ${absent(k) ? '(本来就没有,不改动)' : '(删除,回到不设)'}` : `${nameOf(k)}: ${Object.prototype.hasOwnProperty.call(after, k) && after[k] !== undefined ? val(k, after[k]) : '(未设)'}`)).join('\n');
		// chart 面写地点:地名随之改(按经纬度写 = 清空,按地名写 = 解析出的地名);预览补这一行,执行结果不再出乎预览
		const join = (a, b)=>[a, b].filter((x)=>x).join('\n');
		let placeBefore = '';
		let placeAfter = '';
		if(args.facet === 'chart' && (v.values.place !== undefined || v.values.gpsLat !== undefined)){
			const name = (x)=>(x === undefined || x === null || x === '' ? '(无)' : JSON.stringify(x));
			placeBefore = `地名: ${name(cur.pos)}`;
			// 时区随地点(与页面换地点、与执行同一份计划 planChartZoneForGeo):要换时前后各写一行「时区」,不换时写明为什么不换
			let chartDay = '';
			try{
				const st = getStore() || {};
				const dv = st.astro && st.astro.fields && st.astro.fields.date ? st.astro.fields.date.value : undefined;
				chartDay = dv && typeof dv.format === 'function' ? `${dv.format('YYYY-MM-DD')}` : '';
			}catch(e){ chartDay = ''; }
			const zoneText = (plan)=>{
				if(plan.change){
					return { before: `时区: ${plan.before === undefined || plan.before === null || plan.before === '' ? '(未设)' : plan.before}`, after: `\n时区: ${plan.zone}(该地在盘上日期 ${plan.day} 的时区,夏令时按那一天;钟面时刻不变)` };
				}
				const why = plan.reason === 'same' ? '(时区不变:该地在盘上日期的时区与盘上相同)' : (plan.reason === 'no-date' ? '(盘上没有日期,时区不改)' : '(推不出该地时区,时区不改)');
				return { before: '', after: why };
			};
			const zoneOf = (lat, lon)=>{
				let plan;
				try{ plan = planChartZoneForGeo(lat, lon); }catch(e){ plan = { change: false, reason: 'unknown' }; }
				return zoneText(plan);
			};
			if(v.values.place !== undefined){
				// 按地名写:先解析一次,写出解析出的地名与经纬(与执行同一份解析;解析不出 = 执行也会拒;盘上日期只影响时区)
				// 解析单独限时(首次要载入地名库):超时就退回只写本次给的地名,不让整份预览为空
				let r = null;
				let timedOut = false;
				let timer = null;
				try{
					r = await Promise.race([resolvePlaceOffline(v.values.place, chartDay ? { dateStr: chartDay } : undefined), new Promise((res)=>{ timer = setTimeout(()=>{ timedOut = true; res(null); }, 1500); })]);
				}catch(e){ r = null; }finally{ if(timer !== null){ clearTimeout(timer); } }
				if(r && r.resolved && r.place){
					placeResult = r;
					const z = zoneOf(r.place.gpsLat, r.place.gpsLon);
					placeBefore = join(`${placeBefore}\n经纬: ${num(cur.gpsLat)}, ${num(cur.gpsLon)}`, z.before);
					placeAfter = `地名: ${JSON.stringify(r.place.name)}\n经纬: ${num(r.place.gpsLat)}, ${num(r.place.gpsLon)}${z.after}`;
				}else if(timedOut){
					placeAfter = `地名: ${JSON.stringify(v.values.place)}(地名库还在载入,预览没解析出:执行时再解析,找不到 / 有歧义照拒;时区按该地在盘上日期的时区换,钟面时刻不变)`;
				}else{
					placeAfter = `地名: ${JSON.stringify(v.values.place)} ${r && r.candidates && r.candidates.length ? '有歧义,执行会被拒' : '找不到,执行会被拒'}`;
				}
			}else{
				const z = zoneOf(v.values.gpsLat, v.values.gpsLon);
				placeBefore = join(placeBefore, z.before);
				placeAfter = `地名: (无)(按经纬度写,地名清空)${z.after}`;
			}
		}
		// technique 面:改后附上作用范围句,审批时就看得到(审批卡给用户看:用面向用户的那句)
		const scope = args.facet === 'technique' ? techniqueScopeNote(args.technique, keys, { forUser: true }) : '';
		// 挂载面:执行会被拒的两种删键情形(没有可删的 / 删完同类默认变空),预览如实写明
		let mountReject = '';
		let reject = null;
		if(args.facet === 'mount'){
			const plan = planMountWrite(args.technique, v.values);
			if(!plan.ok){ mountReject = `执行会被拒:${plan.message}`; reject = { code: plan.code || 'E_SETTING_VALUE_INVALID', message: plan.message }; }
		}
		// 无变化:与执行同一份写入计划、同一条按存储键的判据(planSettingsWrite);审批前就拒,不弹审批卡、不记账本。
		// 卡上的「当前值」含缺省(给人看),判不判无变化不看它:从没存过的项写进缺省值也是一次落盘
		if(!reject){
			const nc = noChangeOf(args, v, placeResult);
			if(nc){ reject = { code: nc.code, message: nc.message }; }
		}
		return { ...(reject ? { reject } : {}), title: `修改${settingFacetTitle(args.facet, args.technique)}设置`, before: join(fmt(cur), placeBefore), after: join(join(join(fmtAfter(), placeAfter), mountReject), scope ? `(${scope})` : '') };
	},
	// 无变化预检(注册表在审批前、执行前都经它;纯读):判得出「这次什么也不会改」就回最终结果,不弹审批卡、不进账本
	async noChange(args){
		if(args.facet === 'page'){ await preparePageFacet(args.technique); }
		const v = validateFacetValues(args.facet, args.technique, args.values);
		if(!v.ok){ return null; }
		let placeResult = null;
		if(args.facet === 'chart' && v.values.place !== undefined){
			try{ placeResult = await resolvePlaceOffline(v.values.place); }catch(e){ placeResult = null; }
			if(!placeResult || !placeResult.resolved){ return null; }   // 解析不出:执行另行拒,不算「无变化」
		}
		return noChangeOf(args, v, placeResult);
	},
	async run(args){
		if(args.facet === 'page'){ await preparePageFacet(args.technique); }
		const v = validateFacetValues(args.facet, args.technique, args.values);
		if(!v.ok){
			if(v.castInput){
				const castTech = args.facet === 'page' ? pageCastTechnique(args.technique) : args.technique;
				return { ok: false, code: v.code, message: `${castInputRejectMessage(castTech, [v.badKey], { label: settingTechniqueTitle(args.facet, args.technique), facet: args.facet })}(整体未写入)` };
			}
			// 只读项的拒绝回包带上它在 describe 里的提示(该怎么改),不用再 describe 一次才知道
			return { ok: false, code: v.code || 'E_SETTING_VALUE_INVALID', message: v.badKey ? `键「${v.badKey}」${v.code === 'E_SETTING_KEY_NOT_ALLOWED' ? '不在可改白名单' : '取值不在允许范围'}(整体未写入,请先 describe_settings)${v.hint ? `:${v.hint}` : ''}` : (v.message || '设置校验失败') };
		}
		const before = snapshotFacet(args.facet, args.technique, Object.keys(v.values));
		const r = await applyFacetValues(args.facet, args.technique, v.values);
		if(!r.ok){ return { ok: false, code: r.code || 'E_SETTING_VALUE_INVALID', message: r.message || '设置写入失败' }; }
		// 撤销载荷 = 本次改到的键的写前值 + 写后值(撤销时逐键核对当前值仍等于写后值才还原)
		// 回包只列真正变了的键:按存储键比写前与写后(与写前预览、撤销核对同一判据 settingsChangedKeys)
		const undoPayload = captureWrittenValues(before, r.applied);
		const changed = settingsChangedKeys(args.facet, args.technique, v.values, before && before.snapshot, undoPayload && undoPayload.written);
		// 回包 / 动作条摘要 / 账本与审批卡同一套中文名:摘要只写中文名;回包(模型也要读)中文名后附键名
		const where = settingFacetTitle(args.facet, args.technique);
		const namer = settingItemNamer(args.facet, args.technique, v.values);
		// 「写同值」与「删不存在」统一为无变化 → 拒(注册表收回账本占位,不记一笔「已修改」)
		if(!changed.length){ return { ok: false, code: 'E_SETTING_NO_CHANGE', message: `「${where}」设置没有变化(写的就是现值 / 删的项本来就没有),未写入` }; }
		return {
			ok: true,
			data: { facet: args.facet, technique: args.technique, applied: r.applied, before: before.snapshot },
			message: `已修改「${where}」设置:${changed.map(namer.nameWithKey).join('、')}${r.note ? `(${r.note})` : ''}${args.facet === 'technique' ? `(${techniqueScopeNote(args.technique, changed, { forUser: true })})` : ''}`,
			summary: `改设置 ${where}:${changed.map(namer.nameOf).join('、') || '无变化'}`,
			undo: { kind: 'restore-settings', payload: undoPayload },
		};
	},
};
