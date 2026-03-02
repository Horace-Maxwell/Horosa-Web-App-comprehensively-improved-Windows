import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import {randomStr, formatDate, printArea} from '../../utils/helper';
import { drawTextH, } from '../graph/GraphHelper';
import Gua from './Gua';
import YinYao from './YinYao';
import YangYao from './YangYao';
import TextTable from '../graph/TextTable';
import { randYao, setupYao, ZiList, HourZi, getXunEmpty} from './GuaConst';

export default class GuaChart {
    constructor(options){
		this.chartId = options.id;
		this.chartObj = options.chartObj;
		this.tooltipId = options.tooltipId;

		this.margin = 2;
		this.svgTopgroup = null;
		this.svg = null;

		this.bgColor = AstroConst.AstroColor.Fill;
		this.color = AstroConst.AstroColor.Stroke;
		this.fontSize = 10;

		this.hasDrawGua = false;

    }

	set chart(chartobj){
		this.chartObj = chartobj;
	}

    draw(){
		if(this.chartObj === undefined || this.chartObj === null){
			return null;
		}
		let svgdom = document.getElementById(this.chartId); 
		if(svgdom === undefined || svgdom === null){
			return null;
		}
		let width = svgdom.clientWidth;
		let height = svgdom.clientHeight;
		if(width === 0 || height === 0){
			return null;
		}

        let yaosz = this.chartObj.yao.length;
        let yaoary = this.chartObj.yao;

		let w = width - this.margin * 2;
		let h = height - this.margin * 2;
        let yaoH = h / (yaosz*2 - 1);
        let yaoW = w;
        let y = this.margin;

        let cords = [];
        if(yaosz === 6){
            cords[5] = {x: this.margin, y: this.margin, w: yaoW, h: yaoH};
            cords[4] = {x: this.margin, y: this.margin+yaoH*2, w: yaoW, h: yaoH};
            cords[3] = {x: this.margin, y: this.margin+yaoH*4, w: yaoW, h: yaoH};
            y = this.margin+yaoH*6;
        }
		cords[2] = {x: this.margin, y: y, w: yaoW, h: yaoH};
		cords[1] = {x: this.margin, y: y+yaoH*2, w: yaoW, h: yaoH};
		cords[0] = {x: this.margin, y: y+yaoH*4, w: yaoW, h: yaoH};

		this.hasDrawGua = false;
		let svgid = '#' + this.chartId;
		this.svg = d3.select(svgid);
		this.svg.html('');
		this.svg.attr('stroke', this.color).attr("stroke-width", 1);
	
		this.svgTopgroup = this.svg.append('g');
        
        let opts = cords.map((cord, idx)=>{
            let opt = {
				color: this.color,
				pos: idx,
                change: false,
                x: cord.x,
                y: cord.y,
                width: cord.w,
                height: cord.h,
                owner: this.svgTopgroup,
                showName: false,
                god: false,
            };
            return opt;
        });

        for(let i=0; i<opts.length; i++){
            let opt = opts[i]
            let n = yaoary[i];
            let yaosvg = null;
            if(n === 1){
                yaosvg = new YangYao(opt);
            }else{
                yaosvg = new YinYao(opt);
            }
            yaosvg.draw();
        }

        this.hasDrawGua = true;
    }

}