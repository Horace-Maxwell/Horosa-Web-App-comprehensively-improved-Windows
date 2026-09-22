import React, { Component } from 'react';
import { Modal } from 'antd';
import { fixedPopupFrame } from '../../utils/zoomDomain';

// 可拖动对话框(按住标题栏拖动),接口与 antd Modal 相同,多一个 saveDistance(拖出窗口时至少留在窗内的像素,缺省 80)。
//
// 取代第三方同名小件的原因:它把鼠标位移(pageX 差,视觉域)原样写进 translate(CSS px,布局域)—— 页面缩放档下对话框比鼠标
// 快 / 慢 z 倍,拖两下就跑出手;边界夹取还拿 rect 域的初始位置去比物理域的 documentElement.clientWidth。
// 这里位移、初始位置、视口三个量一次换到同一个域(zoomDomain.fixedPopupFrame)再算;100% 档逐值与原件相同。
function findWrap(node){
	let el = node;
	while(el && el !== document.body){
		if(el.classList && el.classList.contains('ant-modal-wrap')){ return el; }
		el = el.parentElement;
	}
	return null;
}

class DragTitle extends Component{
	constructor(props){
		super(props);
		this.dx = 0;
		this.dy = 0;
		this.drag = null;
		this.setRef = (el)=>{ this.el = el; };
		this.onDown = this.onDown.bind(this);
		this.onMove = this.onMove.bind(this);
		this.onUp = this.onUp.bind(this);
	}

	componentWillUnmount(){
		document.removeEventListener('mousemove', this.onMove);
		document.removeEventListener('mouseup', this.onUp);
	}

	onDown(evt){
		if(evt.button !== 0 || !this.el){ return; }   // 只认左键:右键不选菜单项时收不到 mouseup
		const wrap = findWrap(this.el);
		const content = wrap ? wrap.querySelector('.ant-modal-content') : null;
		if(!wrap || !content){ return; }
		const frame = fixedPopupFrame();
		const rect = frame.rect(content.getBoundingClientRect());
		this.drag = {
			wrap, frame,
			startX: evt.clientX, startY: evt.clientY,
			baseDx: this.dx, baseDy: this.dy,
			// 未拖动时的原位(布局域)= 当前位置 − 已有位移
			initX: rect.left - this.dx, initY: rect.top - this.dy,
			width: rect.width,
		};
		document.addEventListener('mousemove', this.onMove);
		document.addEventListener('mouseup', this.onUp);
	}

	onMove(evt){
		const d = this.drag;
		if(!d){ return; }
		const save = this.props.saveDistance;
		let tx = d.baseDx + d.frame.toFixed(evt.clientX - d.startX);
		let ty = d.baseDy + d.frame.toFixed(evt.clientY - d.startY);
		if(d.initX + tx < -(d.width - save)){ tx = -(d.width - save) - d.initX; }
		if(d.initX + tx > d.frame.viewportWidth - save){ tx = d.frame.viewportWidth - save - d.initX; }
		if(d.initY + ty < 0){ ty = -d.initY; }
		if(d.initY + ty > d.frame.viewportHeight - save){ ty = d.frame.viewportHeight - save - d.initY; }
		this.dx = tx;
		this.dy = ty;
		d.wrap.style.transform = `translate(${tx}px,${ty}px)`;
	}

	onUp(){
		this.drag = null;
		document.removeEventListener('mousemove', this.onMove);
		document.removeEventListener('mouseup', this.onUp);
	}

	render(){
		return (
			<div ref={this.setRef} onMouseDown={this.onDown} style={{ cursor: 'move', userSelect: 'none' }}>
				{this.props.title}
			</div>
		);
	}
}

class DragModal extends Component{
	render(){
		const { title = '', saveDistance = 80, ...rest } = this.props;
		return <Modal {...rest} title={<DragTitle title={title} saveDistance={saveDistance} />} />;
	}
}

Object.assign(DragModal, Modal);

export default DragModal;
