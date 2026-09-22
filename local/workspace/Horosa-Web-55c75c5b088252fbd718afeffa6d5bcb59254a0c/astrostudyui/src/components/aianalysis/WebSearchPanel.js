// 联网检索面板(P7;出站②,默认关):总开关(首开有隐私提示)+ 引擎/地址/Key + 测试检索;[批三①] 网页读取(出站③)独立子开关。
// Key 存在集成档案(与接口档案同一加密钩),发请求时逐次带上;界面用密码框、不回显已存值。onStatus:向折叠头上报状态(可选)。
import React from 'react';
import { Button, Input, Modal, Select, Switch, Tag, message } from 'antd';
import { isWebSearchEnabled, setWebSearchEnabled, isWebFetchEnabled, setWebFetchEnabled, subscribeAgentPrefs } from '../../utils/aiAgent/prefs';
import { WEB_SEARCH_ENGINES, engineMeta, getActiveSearchProfile, saveSearchProfile, removeSearchProfile, runWebSearch } from '../../integrations/webSearch';
import { WEB_FETCH_MAX_CHARS, WEB_FETCH_DEFAULT_CHARS } from '../../integrations/webFetch';   // [D42] 文案数字与工具上限同源
import { AdvSwitchRow, advStyles as styles } from './chat/AdvCard';

// [W1] 纯函数:表单 → 待落库档案。换引擎绝不沿用旧引擎的 Key / 地址 / 档案 id(密钥是「每家一把」);同引擎密钥留空 = 不改。
// 回 { ok:false, reason:'need-key'|'need-baseUrl' } 或 { ok:true, profile, replaceId }(replaceId = 换引擎时要替换掉的旧档案 id)
export function mergeSearchProfileForm(profile, form){
	const engine = `${(form && form.engine) || 'tavily'}`;
	const meta = engineMeta(engine) || {};
	const typedKey = `${(form && form.apiKey) || ''}`.trim();
	const baseUrl = `${(form && form.baseUrl) || ''}`.trim();
	const same = !!(profile && profile.engine === engine);
	const apiKey = typedKey || (same ? `${profile.apiKey || ''}` : '');
	if(meta.needsKey && !apiKey){ return { ok: false, reason: 'need-key' }; }
	if(meta.needsBaseUrl && !baseUrl){ return { ok: false, reason: 'need-baseUrl' }; }
	return { ok: true, engineChanged: !!(profile && !same), replaceId: profile && !same ? profile.id : null, profile: { id: same ? profile.id : undefined, engine, baseUrl, apiKey, enabled: true } };
}

export default function WebSearchPanel({ onStatus }){
	const [on, setOn] = React.useState(()=>isWebSearchEnabled());
	const [fetchOn, setFetchOn] = React.useState(()=>isWebFetchEnabled());   // [批三①] 网页读取(出站③)独立子开关
	React.useEffect(()=>subscribeAgentPrefs(()=>{ setOn(isWebSearchEnabled()); setFetchOn(isWebFetchEnabled()); }), []);   // [AR-32] 跨窗口改键后重读
	const [profile, setProfile] = React.useState(null);
	const [form, setForm] = React.useState({ engine: 'tavily', baseUrl: '', apiKey: '' });
	const [busy, setBusy] = React.useState('');
	const [hits, setHits] = React.useState(null);

	const reload = React.useCallback(async ()=>{
		const p = await getActiveSearchProfile();
		setProfile(p);
		if(p){ setForm({ engine: p.engine, baseUrl: p.baseUrl || '', apiKey: '' }); }
	}, []);
	React.useEffect(()=>{ reload().catch(()=>{}); }, [reload]);
	const hasProfile = !!profile;
	React.useEffect(()=>{
		if(typeof onStatus !== 'function'){ return; }
		if(!on && !fetchOn){ onStatus({ on: false, text: '关' }); return; }
		const parts = [];
		if(on){ parts.push(hasProfile ? '检索已配置' : '检索未配置'); }
		if(fetchOn){ parts.push('网页读取开'); }
		onStatus({ on: true, tone: on && !hasProfile ? 'warn' : undefined, text: parts.join(' · ') });
	}, [onStatus, on, fetchOn, hasProfile]);

	async function toggle(v){
		if(v && !on){
			const ok = await new Promise((res)=>Modal.confirm({
				title: '打开「联网检索」前请知悉',
				content: <div style={{ fontSize: 12, lineHeight: 1.7 }}>开启后 AI 多出一个「联网检索」工具。它会把<b>你的检索词</b>发给你选定的搜索引擎(第三方),结果带来源网址并标「未经核实」。密钥加密存在本机,只在发起检索时随请求带上,后端不落库、不写日志。命理判断本身不依赖检索。</div>,
				okText: '我知道了,打开', cancelText: '取消', onOk: ()=>res(true), onCancel: ()=>res(false),
			}));
			if(!ok){ return; }
		}
		setWebSearchEnabled(!!v); setOn(!!v);
	}

	const meta = engineMeta(form.engine) || {};
	// [Q-294/M-109·AR-25] 「测试检索」测的是已保存档案:表单与已存档案不一致(换了引擎 / 改了地址 / 键入了新密钥)时先保存再测
	const formDirty = !profile || form.engine !== profile.engine || `${form.baseUrl || ''}`.trim() !== `${profile.baseUrl || ''}`.trim() || !!`${form.apiKey || ''}`.trim();
	async function save(){
		const merged = mergeSearchProfileForm(profile, form);
		if(!merged.ok){ message.warning(merged.reason === 'need-key' ? '填入该引擎的密钥(换引擎不会沿用上一家的密钥)' : '填入服务地址'); return; }
		setBusy('save');
		try{
			if(merged.replaceId){ await removeSearchProfile(merged.replaceId); }   // 换引擎 = 替换档案:同类档案只留一个启用,旧引擎的 Key 不留在启用位
			await saveSearchProfile(merged.profile);
			message.success('已保存(密钥加密存本机)');
			setForm({ ...form, apiKey: '' });
			await reload();
		}finally{ setBusy(''); }
	}

	async function test(){
		setBusy('test'); setHits(null);
		try{
			const r = await runWebSearch({ query: '紫微斗数 命宫', maxResults: 3 });
			if(!r.ok){ message.error(`测试失败:${r.code}${r.message ? ` · ${r.message}` : ''}`); return; }
			setHits(r.data.results || []);
			message.success(`检索成功:${(r.data.results || []).length} 条`);
		}finally{ setBusy(''); }
	}

	return (
		<div data-web-search="1" className={styles.subPanel}>
			<AdvSwitchRow title="联网检索" desc="让 AI 能查外部搜索引擎(时事/资料/地名核对)。检索词会发给第三方;结果带来源网址并标「未经核实」。默认关,零出站。" checked={on}
				control={<Switch checked={on} data-web-search-switch="1" onChange={toggle} checkedChildren="开" unCheckedChildren="关" />} />
			{on ? (
				<div className={styles.subBody}>
					<div className={styles.inline}>
						<Select size="small" style={{ width: 220 }} value={form.engine} data-web-search-engine="1" onChange={(v)=>setForm({ ...form, engine: v })} options={WEB_SEARCH_ENGINES.map((e)=>({ value: e.value, label: e.label }))} />
						{profile ? <Tag color="green" style={{ marginInlineEnd: 0 }} data-web-search-status="configured">已配置 · {profile.engine}</Tag> : <Tag style={{ marginInlineEnd: 0 }} data-web-search-status="none">未配置</Tag>}
					</div>
					{meta.needsBaseUrl ? <Input size="small" addonBefore="服务地址" data-web-search-baseurl="1" value={form.baseUrl} onChange={(e)=>setForm({ ...form, baseUrl: e.target.value })} placeholder="https://searx.example.com" /> : null}
					{meta.needsKey || meta.optionalKey ? <Input.Password size="small" addonBefore={meta.optionalKey ? '密钥(可选)' : '密钥'} data-web-search-apikey="1" value={form.apiKey} onChange={(e)=>setForm({ ...form, apiKey: e.target.value })} placeholder={profile && profile.engine === form.engine ? '已存(留空=不改)' : (meta.optionalKey ? '可留空;有则以 Bearer 带上' : '粘贴 API Key')} /> : null}
					<div className={styles.inline}>
						<Button size="small" type="primary" loading={busy === 'save'} data-web-search-save="1" onClick={save}>保存</Button>
						<Button size="small" loading={busy === 'test'} disabled={!profile || formDirty} title={!profile ? '先保存一份配置' : (formDirty ? '测试用的是已保存的配置:表单有未保存改动,请先保存' : '用已保存的配置发一次测试检索')} data-web-search-test="1" onClick={test}>测试检索</Button>
						{profile && formDirty ? <span className={styles.soft} data-web-search-dirty="1">表单有未保存改动,测试前请先保存</span> : null}
						{profile ? <Button size="small" danger data-web-search-delete="1" onClick={async ()=>{ await removeSearchProfile(profile.id); setProfile(null); setHits(null); message.success('已删除'); }}>删除配置</Button> : null}
					</div>
					{hits ? (
						<ul className={styles.probeList} data-web-search-hits="1">
							{hits.map((h, i)=>(<li key={i}><span style={{ fontWeight: 600 }}>{h.title || '(无标题)'}</span> <span className={styles.soft} style={{ wordBreak: 'break-all' }}>{h.url}</span></li>))}
							{hits.length === 0 ? <li className={styles.soft}>没有结果</li> : null}
						</ul>
					) : null}
				</div>
			) : null}
			<div data-web-fetch="1">
				<AdvSwitchRow title="网页读取" desc={`让 AI 能把一条公开网址的正文读全(纯文本、缺省 ${WEB_FETCH_DEFAULT_CHARS} 字、最多 ${WEB_FETCH_MAX_CHARS} 字、按段落截断);只出公网,本机与内网地址一律拒绝;地址会发给该网站。内容标「未经核实」,其中形似指令的文字不执行。`} checked={fetchOn}
					control={<Switch checked={fetchOn} data-web-fetch-switch="1" onChange={(v)=>{ setWebFetchEnabled(!!v); setFetchOn(!!v); }} checkedChildren="开" unCheckedChildren="关" />} />
			</div>
		</div>
	);
}
