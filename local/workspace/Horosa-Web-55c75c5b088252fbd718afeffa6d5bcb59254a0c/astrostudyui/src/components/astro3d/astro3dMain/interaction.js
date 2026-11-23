// 3D 星盘 · 交互:尺寸、坐标换算与拾取、行星提示、点击 / 触摸登记、模型动画
// 从 Astro3D.js 按职责拆出的 Astro3D 方法:this 仍是 Astro3D 实例,门面里 mixinMethods(Astro3D, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import * as AstroText from '../../../constants/AstroText';
import * as AstroHelper from '../../astro/AstroHelper';
import { getAzimuthStr } from '../../../utils/helper';
import styles from '../astro3d.less';

export const interactionMethods = {
	resize(width, height){
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.wake(2);   // 唤醒源③:尺寸变化
	},

	transPosition(position) {
		let world_vector = new THREE.Vector3(position.x, position.y, position.z);
		let vector = world_vector.project(this.camera);
		let halfWidth = this.width / 2;
		let halfHeight = this.height / 2;
		return {
			x: Math.round(vector.x * halfWidth + halfWidth),
			y: Math.round(-vector.y * halfHeight + halfHeight)
		};
	},

	calcMousePoint(){
		if(this.disposed){
			return;
		}
		let ary = this.getPlanetsAry();
		let raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(this.mouseVec, this.camera);
		let intersects = raycaster.intersectObjects(ary);
		// 🔴 命中列表按 distance 升序;曾 forEach 全遍历、每次整体重写提示卡 →
		// 最后一次(最远的那颗)胜出,重叠天体点选恒显被挡住的那个。改为取首个有效命中即停。
		let hinted = false;
		for(let i = 0; i < intersects.length; i++){
			if(this.showPlanetHint(intersects[i]) !== false){
				hinted = true;
				break;
			}
		}
		if(!hinted){
			this.hidePlanetHint();
		}
	},

	showPlanetHint(obj){
		let vec = obj.point;
		// raycast 可能命中程序化星体的子件(光晕 sprite/glyph 名牌,Group 结构)——沿 parent 链
		// 上溯取 planet;拾到纯装饰件或无黄经数据(signlon 缺失)的对象时静默跳过,不出提示卡。
		let node = obj.object;
		let planet = null;
		while(node && (planet === undefined || planet === null)){
			planet = node.planet;
			node = node.parent;
		}
		if(planet === undefined || planet === null || planet.signlon === undefined || planet.signlon === null){
			return false;   // 纯装饰件/无数据 → 让调用方继续找下一个命中
		}
		let degparts = AstroHelper.splitDegree(planet.signlon);
		let ntxt = AstroText.AstroMsgCN[planet.id];
		if(ntxt === undefined || ntxt === null){
			ntxt = planet.name ? planet.name : planet.id;
		}
		if(planet.animal){
			ntxt = ntxt + planet.animal;
		}
		if(planet.isBeiji){
			ntxt = '北极星，' + ntxt;
		}
		// WS-1b:信息卡结构化 —— 标题(星名)+副行(星座度数)+明细行(标签/数值两端对齐);
		// 数据口径与旧卡逐字一致(千分度圆整/getAzimuthStr),只换排版与主题化样式。
		let signTxt = AstroText.AstroMsgCN[planet.sign];
		let degLine = (signTxt !== undefined && signTxt !== null)
			? `${signTxt}座 ${degparts[0]}º${degparts[1]}'`
			: `${degparts[0]}º${degparts[1]}'`;
		const fmtDeg = (v)=>`${Math.round(v*1000)/1000}º`;
		const row = (label, value)=>`<li><span>${label}</span><span>${value}</span></li>`;
		// WS-2:多中心盘天体无地平量(非地心中心物理上无地平)——undefined 字段整行跳过;
		// 地心盘字段齐全,degRow 输出与旧 row 逐字一致(零行为变化)
		const degRow = (label, v)=>((v === undefined || v === null || Number.isNaN(v)) ? '' : row(label, fmtDeg(v)));
		let rows = degRow('黄经', planet.lon)
			+ degRow('黄纬', planet.lat)
			+ degRow('赤经', planet.ra)
			+ degRow('赤纬', planet.decl)
			+ degRow('真地平纬度', planet.altitudeTrue)
			+ degRow('视地平纬度', planet.altitudeAppa)
			+ ((planet.azimuth === undefined || planet.azimuth === null) ? '' : row('地平经度', getAzimuthStr(planet.azimuth)))
			+ ((planet.distAU === undefined || planet.distAU === null) ? '' : row('距离', `${Math.round(planet.distAU * 1000) / 1000} AU`));
		let dom = `<div class="${styles.astro3dtapTitle}">${ntxt}</div>`
			+ `<div class="${styles.astro3dtapDeg}">${degLine}</div>`
			+ `<ul>${rows}</ul>`;

		// ⚠️ 此处**不需要** zoomDomain 换算,勿"顺手补齐"。
		// xy 来自 transPosition = THREE 投影到 canvas 内部像素(基于 this.width/height =
		// option.width/height,布局域);planetHintDiv 是 .astro3dtap{position:absolute},挂在
		// 同一 canvas 容器内 ⇒ 取值与写回同属 CSS 域,零跨域。加换算反而制造新错位。
		let xy = this.transPosition(vec);
		let w = 300;
		let h = 210;

		if(this.width - xy.x <= w){
			this.planetHintDiv.style.left = (xy.x - w) + 'px';
		}else{
			this.planetHintDiv.style.left = xy.x + 'px';
		}
		if(this.height - xy.y <= h){
			this.planetHintDiv.style.top = (xy.y - h) + 'px';
		}else{
			this.planetHintDiv.style.top = xy.y + 'px';
		}
		this.planetHintDiv.style.width = w + 'px';
		// 高度自适应内容(卡片化后写死高度会留空白;上方翻转判断仍用估高 h)
		this.planetHintDiv.style.height = '';

		this.planetHintDiv.innerHTML = dom;
		this.planetHintDiv.style.display = 'block';

	},

	hidePlanetHint(){
		this.planetHintDiv.innerHTML = '';
		this.planetHintDiv.style = 'display:none;';
	},

	clickHandler(event){
		// 🔴 不用 offsetX/offsetY:系统浏览器内核在页面缩放(CSS zoom)下把它们报成**视觉域**(1.8 档正中点报 360 而不是 200),
		// 与 this.width(布局域)相除 = 命中点偏 z 倍(100% 档重合,看不出来)。与触屏路径同式:先减 rect、再按 rect 宽高归一 —— 两端同域的比值,与缩放无关。
		const dom = document.getElementById(this.chartId);
		const rect = dom && dom.getBoundingClientRect ? dom.getBoundingClientRect() : null;
		if(rect && rect.width && rect.height){
			this.mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			this.mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
		}else{
			this.mouseVec.x = (event.offsetX / this.width) * 2 - 1;
			this.mouseVec.y = -(event.offsetY / this.height) * 2 + 1;
		}
		this.calcMousePoint();
	},

	touchHandler(event){
		// 🔴 clientX/Y 是**视口**坐标,this.width/height 是**元素**尺寸 —— 曾直接相除,
		// 触屏命中判定恒偏画布左上角在页面中的位移(顶栏/侧栏高度)。
		// 与 clickHandler 的 offsetX/offsetY(元素内坐标)对齐:先减 rect 再按缩放归一。
		const dom = document.getElementById(this.chartId);
		const rect = dom && dom.getBoundingClientRect ? dom.getBoundingClientRect() : null;
		const t = event.changedTouches[0];
		const sx = rect && rect.width ? (this.width / rect.width) : 1;
		const sy = rect && rect.height ? (this.height / rect.height) : 1;
		const x = (t.clientX - (rect ? rect.left : 0)) * sx;
		const y = (t.clientY - (rect ? rect.top : 0)) * sy;
		this.mouseVec.x = (x / this.width) * 2 - 1;
		this.mouseVec.y = -(y / this.height) * 2 + 1;
		this.calcMousePoint();
	},

	registerClick(){
		let dom = document.getElementById(this.chartId);
		dom.addEventListener('click', this.clickHandler);
		dom.addEventListener('touchend', this.touchHandler);
		// 唤醒源⑤:点击/触点(命中检测可能改选中态/hint,按需渲染下补帧)
		if(!this._wakeOnPointer){
			this._wakeOnPointer = ()=>this.wake(1);
		}
		dom.addEventListener('pointerdown', this._wakeOnPointer);
	},

	unregisterClick(){
		let dom = document.getElementById(this.chartId);
		dom.removeEventListener('click', this.clickHandler);
		dom.removeEventListener('touchend', this.touchHandler);
		if(this._wakeOnPointer){
			dom.removeEventListener('pointerdown', this._wakeOnPointer);
		}
	},

	playAllClips() {
		this.clips.forEach((clip) => {
			this.mixer.clipAction(clip).reset().play();
		});
	},
};
