import * as THREE from 'three';
import * as AstroConst from '../../constants/AstroConst';
import { randomStr, } from '../../utils/helper';


class TextSprite {
	constructor(option){
		this.text = option.text ? option.text : '';
		this.fontFace = option.fontFace ? option.fontFace : AstroConst.NormalFont;
		this.fontSize = option.fontSize ? option.fontSize : 20;
		this.font = 'Normal ' + this.fontSize + 'px ' + this.fontFace;

		this.borderThickness = option.borderThickness ? option.borderThickness : 4;
		this.borderColor = option.borderColor ? option.borderColor : { r:255, g:255, b:255, a:1.0 };
		this.backgroundColor = option.backgroundColor ? option.backgroundColor : { r:0, g:255, b:0, a:0.0 };

		this.canvas = document.createElement('canvas');
		this.context = this.canvas.getContext('2d');

	}

	roundRect(x, y, w, h, r){
		let ctx = this.context;
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.lineTo(x+w-r, y);
        ctx.quadraticCurveTo(x+w, y, x+w, y+r);
        ctx.lineTo(x+w, y+h-r);
        ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
        ctx.lineTo(x+r, y+h);
        ctx.quadraticCurveTo(x, y+h, x, y+h-r);
        ctx.lineTo(x, y+r);
        ctx.quadraticCurveTo(x, y, x+r, y);
		ctx.closePath();
		
        ctx.fill();
        ctx.stroke();
	}

	draw(){
		let metrics = this.context.measureText(this.text);

		let textWidth = metrics.width;

		this.context.fillStyle = "rgba(" + this.backgroundColor.r + "," + this.backgroundColor.g + ","
			+ this.backgroundColor.b + "," + this.backgroundColor.a + ")";

		this.context.strokeStyle = "rgba(" + this.borderColor.r + "," + this.borderColor.g + ","
        	+ this.borderColor.b + "," + this.borderColor.a + ")";
		
		this.context.lineWidth = this.borderThickness;
		
		// this.roundRect(this.borderThickness/2, this.borderThickness/2, textWidth + this.borderThickness, this.fontSize * 1.4 + this.borderThickness, 6);

		/* 字体颜色 */
		this.context.fillStyle = "rgba(255, 255, 255, 1.0)";
		this.context.fillText(this.text, this.borderThickness, this.fontSize + this.borderThickness);

		/* 画布内容用于纹理贴图 */
		let texture = new THREE.Texture(this.canvas);
		texture.needsUpdate = true;

		let spriteMaterial = new THREE.SpriteMaterial({ map: texture } );
		let sprite = new THREE.Sprite(spriteMaterial );

		/* 缩放比例 */
		sprite.scale.set(300, 150, 0.01);
		return sprite;
	}
}

export default TextSprite;
