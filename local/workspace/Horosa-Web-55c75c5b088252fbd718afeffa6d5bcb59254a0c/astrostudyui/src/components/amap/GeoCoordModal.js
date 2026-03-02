import { Component } from 'react';
import { Button, } from 'antd';
import Modal from 'drag-modal';
import GeoCoordSelector from './GeoCoordSelector';
import { gpsToGcj02, gcj02ToGps } from '../../utils/helper';

class GeoCoordModal extends Component{

	constructor(props) {
		super(props);

		this.state = {
			visible: false,
			record: null,
		}

		this.showModalHandler = this.showModalHandler.bind(this);
		this.hideModalHandler = this.hideModalHandler.bind(this);
		this.clickOk = this.clickOk.bind(this);
		this.onChange = this.onChange.bind(this);
	}

	showModalHandler(e) {
		if(e){
			e.preventDefault();
		}
		let lat = this.props.lat;
		let lng = this.props.lng;	
		if(lat){
			let gcj = gpsToGcj02(lat, lng);
			this.setState({
				visible: true,
				record:{
					lat: gcj.lat,
					lng: gcj.lon,
					gpsLat: lat,
					gpsLng: lng,
				}
			});	
		}else{
			this.setState({
				visible: true,
			});	
		}
	}

	hideModalHandler(e) {
		if(e){
			e.stopPropagation();
		}
		this.setState({
			visible: false,
		});
	}

	onChange(info){
		this.setState({
			record: info,
		});
	}

	clickOk(){
		const rec = {
			...this.state.record
		};
		if(rec.gpsLat === undefined || rec.gpsLat === null){
			let geo = gcj02ToGps(rec.lat, rec.lng);
			rec.gpsLat = geo.lat;
			rec.gpsLng = geo.lon;
		}
		
		this.setState({
			record: null,
			visible: false,
		});

		if(this.props.onOk){
			this.props.onOk(rec);
		}

	}


	render(){

		const { children } = this.props;
		let lat = this.state.record ? this.state.record.lat : null;
		let lon = this.state.record ? this.state.record.lng : null;
		let gpslat = this.state.record ? this.state.record.gpsLat : null;
		let gpslng = this.state.record ? this.state.record.gpsLng : null;
		lat = lat === NaN ? null : lat;
		lon = lon === NaN ? null : lon;
		gpslat = gpslat === NaN ? null : gpslat;
		gpslng = gpslng === NaN ? null : gpslng;

		return (
			<span>
				<span onClick={this.showModalHandler}>
					{ children }
				</span>
				<Modal open={this.state.visible} 
					onCancel={this.hideModalHandler}
					onOk={this.clickOk}
					width={800} title='经纬度查找'
					bodyStyle={{height: 500, width:800}}
					>
					<GeoCoordSelector onChange={this.onChange} height={400} 
						lat={lat} lng={lon} gpsLat={gpslat} gpsLng={gpslng}					
					/>
				</Modal>
			</span>
		)
	}
}

export default GeoCoordModal;
