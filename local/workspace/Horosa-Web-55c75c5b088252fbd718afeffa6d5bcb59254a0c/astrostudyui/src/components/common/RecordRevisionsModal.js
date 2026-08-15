// [V5-D11] 记录历史版本查看/恢复:列出该记录最近 10 版快照,「恢复为副本」生成新记录
// (绝不覆盖现档,Joplin 非破坏范式)。
import React, { useEffect, useState } from 'react';
import { Modal, Button, message } from 'antd';
import { listRecordRevisions } from '../../utils/recordRevisions';

export default function RecordRevisionsModal({ visible, storeLabel, record, onClose, onRestoreAsCopy }){
	const [revisions, setRevisions] = useState([]);

	useEffect(()=>{
		if(!visible || !record){
			return;
		}
		listRecordRevisions(storeLabel, record.cid).then(setRevisions);
	}, [visible, record, storeLabel]);

	if(!visible || !record){
		return null;
	}
	const title = record.name || record.event || record.cid;

	function restore(rev){
		try{
			onRestoreAsCopy(rev.record);
			message.success('已按该历史版本生成副本（当前记录未被改动）');
			onClose();
		}catch(e){
			message.error('恢复失败（本地空间不足？）');
		}
	}

	return (
		<Modal visible={visible} title={`历史版本：${title}`} width={520} onCancel={onClose} footer={[<Button key='c' onClick={onClose}>关闭</Button>]}>
			{revisions.length ? revisions.map((rev)=>(
				<div key={rev.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
					<div style={{ flex: 1 }}>
						<div>{new Date(rev.at).toLocaleString()}</div>
						<div style={{ opacity: 0.7, fontSize: 12 }}>
							{`${rev.record.name || rev.record.event || ''} · ${rev.record.birth || rev.record.divTime || ''}${rev.record.memo ? ` · 备注:${`${rev.record.memo}`.slice(0, 12)}` : ''}`}
						</div>
					</div>
					<Button size='small' onClick={()=>restore(rev)}>恢复为副本</Button>
				</div>
			)) : <div style={{ opacity: 0.7 }}>该记录暂无历史版本（每次修改保存时自动留存，最多保留最近 10 版）</div>}
		</Modal>
	);
}
