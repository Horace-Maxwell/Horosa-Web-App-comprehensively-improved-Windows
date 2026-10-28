// 组件式确认框(单源):替代浏览器原生 window.confirm / alert / prompt ——
// 原生对话框画在页面之外:界面简繁的显示层转不到它(繁体界面里弹出简体)、样式与明暗主题不随应用、还会阻塞主线程。
// 这里渲染进页面 DOM(antd Modal),随界面简繁 / 主题一起变。回 Promise<boolean>(确定 = true;取消 / 关闭 = false)。
import { Modal } from 'antd';

export function confirmDialog({ title = '确认操作?', content = '', okText = '确定', cancelText = '取消', danger = false } = {}){
	return new Promise((resolve)=>{
		let done = false;
		const finish = (v)=>{ if(!done){ done = true; resolve(v); } };
		Modal.confirm({
			title,
			content,
			okText,
			cancelText,
			centered: true,
			okType: danger ? 'danger' : 'primary',
			onOk: ()=>finish(true),
			onCancel: ()=>finish(false),
			afterClose: ()=>finish(false),
		});
	});
}

export default confirmDialog;
