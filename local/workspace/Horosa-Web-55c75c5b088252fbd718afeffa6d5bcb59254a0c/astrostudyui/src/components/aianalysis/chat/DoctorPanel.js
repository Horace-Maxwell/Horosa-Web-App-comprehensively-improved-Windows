// [批二⑫] /doctor 浮层:一屏诊断(纯展示;报告由 buildDoctorReport 产,已脱敏);「复制诊断」走 copyTextSmart(桌面/浏览器同一剪贴板路径)。
import React from 'react';
import { Modal, Button, message } from 'antd';
import { copyTextSmart } from '../../../utils/clipboardText';

const TONE = { ok: 'var(--horosa-success, #2f9e44)', warn: 'var(--horosa-warning, #d9822b)', bad: 'var(--horosa-danger, #d64545)', info: 'var(--horosa-text-soft, #8a8f99)' };

export default function DoctorPanel({ open, report, onClose }){
	if(!open || !report){ return null; }
	const rows = Array.isArray(report.rows) ? report.rows : [];
	return (
		<Modal title="诊断(/doctor)" open visible onCancel={onClose} width={560} footer={[
			<Button key="copy" data-doctor-copy="1" onClick={async ()=>{ try{ await copyTextSmart(report.text || ''); message.success('诊断已复制(已脱敏)'); }catch(e){ message.error('复制失败'); } }}>复制诊断</Button>,
			<Button key="close" type="primary" onClick={onClose}>关闭</Button>,
		]}>
			<div data-doctor-panel="1" data-doctor-worst={report.worst || 'ok'} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
				{rows.map((r)=>(
					<div key={r.key} data-doctor-row={r.key} data-level={r.level} style={{ display: 'flex', gap: 10 }}>
						<span style={{ flex: '0 0 8px', color: TONE[r.level] || TONE.info }}>●</span>
						<span style={{ flex: '0 0 120px', color: 'var(--horosa-text-soft, #8a8f99)' }}>{r.label}</span>
						<span style={{ flex: '1 1 auto', wordBreak: 'break-all' }}>{r.value}</span>
					</div>
				))}
			</div>
		</Modal>
	);
}
