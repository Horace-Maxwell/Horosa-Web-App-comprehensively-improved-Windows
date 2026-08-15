// [V5-D13/D14/D18] 记录深化三 Modal:断事日志 / 关联关系 / 查重与合并。
// 数据层全在 utils/recordRelations(纯函数+闸测试);此处只做确认 UI。
import React, { useEffect, useState } from 'react';
import { Modal, Button, message, Popconfirm } from 'antd';
import { XQSelect, XQTextArea } from '../xq-ui';
import {
	RELATION_TYPES, appendRecordJournal, linkRecords, unlinkRecords, findDuplicateGroups, mergeRecords,
} from '../../utils/recordRelations';

const Option = XQSelect.Option;

// [D14] 断事日志:时间线(新在前)+追加输入。
export function RecordJournalModal({ visible, kind, record, onClose, onChanged }){
	const [text, setText] = useState('');
	if(!visible || !record){
		return null;
	}
	const journal = Array.isArray(record.journal) ? record.journal : [];

	function add(){
		if(!`${text}`.trim()){
			return;
		}
		try{
			appendRecordJournal(kind, record.cid, text);
			setText('');
			message.success('已记入断事日志');
			onChanged();
		}catch(e){
			message.error('保存失败（本地空间不足？）');
		}
	}

	return (
		<Modal visible={visible} title={`断事日志：${record.name || record.event || ''}`} width={520} onCancel={onClose} footer={[<Button key='c' onClick={onClose}>关闭</Button>]}>
			<XQTextArea value={text} onChange={(e)=>setText(e.target.value)} placeholder='记一条：断了什么 / 应验情况 / 回访反馈…' autoSize={{ minRows: 2, maxRows: 4 }} style={{ width: '100%' }} />
			<div style={{ textAlign: 'right', marginTop: 6 }}><Button size='small' type='primary' onClick={add}>追加</Button></div>
			<div style={{ marginTop: 10, maxHeight: 300, overflowY: 'auto' }}>
				{journal.length ? journal.map((j, i)=>(
					<div key={`${j.at}-${i}`} style={{ padding: '6px 0', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
						<div style={{ fontSize: 12, opacity: 0.6 }}>{j.at}</div>
						<div style={{ whiteSpace: 'pre-wrap' }}>{j.text}</div>
					</div>
				)) : <div style={{ opacity: 0.6 }}>暂无日志——每条自动带时间戳，随记录导出/备份全链保留</div>}
			</div>
		</Modal>
	);
}

// [D18] 关联关系:恰选两条时建立/解除双向关系边。
export function RecordLinkModal({ visible, kind, pair, onClose, onChanged }){
	const [type, setType] = useState('friend');
	if(!visible || !pair || pair.length !== 2){
		return null;
	}
	const [a, b] = pair;
	const existing = (Array.isArray(a.relations) ? a.relations : []).find((e)=>e && e.cid === b.cid);

	return (
		<Modal visible={visible} title='关联两条记录' width={420} onCancel={onClose} footer={null}>
			<div style={{ marginBottom: 10 }}>{`${a.name || a.event} ↔ ${b.name || b.event}`}</div>
			{existing ? (
				<div style={{ marginBottom: 10, fontSize: 12, opacity: 0.7 }}>
					{`当前关系：${(RELATION_TYPES.find((t)=>t.value === existing.type) || {}).label || existing.type}（左为右的${(RELATION_TYPES.find((t)=>t.value === existing.type) || {}).label || ''}）`}
				</div>
			) : null}
			<XQSelect value={type} onChange={setType} style={{ width: '100%' }}>
				{RELATION_TYPES.map((t)=><Option key={t.value} value={t.value}>{`右为左的「${t.label}」`}</Option>)}
			</XQSelect>
			<div style={{ textAlign: 'right', marginTop: 12 }}>
				{existing ? (
					<Button style={{ marginRight: 8 }} onClick={()=>{
						unlinkRecords(kind, a.cid, b.cid);
						message.success('已解除关联');
						onChanged();
						onClose();
					}}>解除关联</Button>
				) : null}
				<Button type='primary' onClick={()=>{
					if(linkRecords(kind, a.cid, b.cid, type)){
						message.success('已建立关联（双向）');
						onChanged();
						onClose();
					}else{
						message.error('关联失败');
					}
				}}>建立关联</Button>
			</div>
		</Modal>
	);
}

// [D13] 查重与合并:建议清单式,绝不自动合并;逐组选主记录,副本合并后进回收站可反悔。
export function DuplicateMergeModal({ visible, kind, records, timeField, onClose, onChanged }){
	const [groups, setGroups] = useState([]);
	const [primaryByGroup, setPrimaryByGroup] = useState({});

	useEffect(()=>{
		if(visible){
			setGroups(findDuplicateGroups(records, timeField));
			setPrimaryByGroup({});
		}
	}, [visible, records, timeField]);

	if(!visible){
		return null;
	}

	function doMerge(gi){
		const group = groups[gi];
		const primary = primaryByGroup[gi] || group[0].cid;
		try{
			group.filter((r)=>r.cid !== primary).forEach((r)=>mergeRecords(kind, primary, r.cid));
			message.success('已合并（被并记录在回收站，可反悔）');
			setGroups(groups.filter((_, i)=>i !== gi));
			onChanged();
		}catch(e){
			message.error('合并失败（本地空间不足？）');
		}
	}

	return (
		<Modal visible={visible} title='查重与合并' width={560} onCancel={onClose} footer={[<Button key='c' onClick={onClose}>关闭</Button>]}>
			{groups.length ? groups.map((group, gi)=>(
				<div key={group[0].cid} style={{ marginBottom: 14, padding: 10, border: '1px solid rgba(128,128,128,0.25)', borderRadius: 6 }}>
					<div style={{ marginBottom: 6, fontWeight: 600 }}>{`疑似重复：${group[0].name || group[0].event}（${group.length} 条）`}</div>
					{group.map((r)=>(
						<div key={r.cid} style={{ display: 'flex', alignItems: 'center', fontSize: 12, padding: '2px 0' }}>
							<input
								type='radio'
								name={`primary-${gi}`}
								checked={(primaryByGroup[gi] || group[0].cid) === r.cid}
								onChange={()=>setPrimaryByGroup({ ...primaryByGroup, [gi]: r.cid })}
								style={{ marginRight: 6 }}
							/>
							<span style={{ flex: 1 }}>{`${r.birth || r.divTime || ''} · ${r.pos || ''}${r.memo ? ` · 备注:${`${r.memo}`.slice(0, 10)}` : ''} · 更新:${r.updateTime}`}</span>
						</div>
					))}
					<div style={{ textAlign: 'right', marginTop: 6 }}>
						<Popconfirm title='选中的一条为主记录，其余合并进它后移入回收站（可反悔），确定？' onConfirm={()=>doMerge(gi)}>
							<Button size='small'>合并本组</Button>
						</Popconfirm>
					</div>
				</div>
			)) : <div style={{ opacity: 0.7 }}>未发现疑似重复（判据：同名同生辰分钟级 = 精确重复；同名生辰相差 24 小时内 = 近似重复）</div>}
		</Modal>
	);
}
