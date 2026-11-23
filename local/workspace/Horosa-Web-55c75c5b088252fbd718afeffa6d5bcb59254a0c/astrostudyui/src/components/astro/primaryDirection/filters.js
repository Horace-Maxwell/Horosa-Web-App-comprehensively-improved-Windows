// 主限法表 · 列筛选:迫星列 / 日期列筛选与下拉、搜索与重置
// 从 AstroPrimaryDirection.js 按职责拆出的 AstroPrimaryDirection 方法:this 仍是 AstroPrimaryDirection 实例,门面里 mixinMethods(AstroPrimaryDirection, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { XQButton as Button, XQInput as Input } from '../../xq-ui';
import XQIcon from '../../xq-icons';
import { matchesUserQuery } from '../../../utils/scriptMode';
import { PD_PROM_FILTER_EXTRA, pdPromFilterMatch } from './rowLabels';

export const filterMethods = {
	genStarColFilter(dataIndex, filterKeys, withAspectFilters){
		let filters = [];

		for(let i=0; i<this.objs.length; i++){
			let planet = this.objs[i];
			if(!filterKeys.has(planet)){
				continue;
			}
			let obj = {
				text: this.planetText(planet),
				value: planet,
			}
			filters.push(obj);
		}
		if(withAspectFilters){
			filters = filters.concat(PD_PROM_FILTER_EXTRA);
		}

		let res = {
			filters: filters,
			onFilter: (value, record)=>{
				if(!record[dataIndex]){
					return false;
				}
				const extra = pdPromFilterMatch(value, record[dataIndex]);
				if(extra !== null){
					return extra;
				}
				return record[dataIndex].indexOf(value) >= 0;
			},

		};
		return res;
	},

	genDateColFilter(dataIndex){
		let res = {
			filterDropdown: (option)=>{
				return this.genDateFilterDropdownDom(option)
			},
			onFilterDropdownVisibleChange: (visible)=>{
				if(visible && this.searchInput){
					setTimeout(()=>{ this.searchInput.select()});
				}
			},
			filterIcon: (filtered)=>{
				let dom = (
					<XQIcon name="search" style={{ color: filtered ? 'var(--horosa-accent, #e7bd75)' : undefined }} />
				);
				return dom;
			},
			onFilter: (value, record)=>{
				if(record[dataIndex]){
					// 用户输入的检索词经单源比对(界面繁体时与屏幕同口径)
					return matchesUserQuery(record[dataIndex].toString(), value);
				}
				return false;
			},
		};

		return res;
	},

	genDateFilterDropdownDom(option){
		let { setSelectedKeys, selectedKeys, confirm, clearFilters } = option;
		let dom = (
			<div style={{ padding: 8 }}>
				<Input
					ref={node => {
						this.searchInput = node;
					}}
					placeholder={`输入年份`}
					value={selectedKeys[0]}
					onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
					onPressEnter={() => this.handleSearch(selectedKeys, confirm)}
					style={{ width: 188, marginBottom: 8, display: 'block' }}
				/>
				<Button
					type="primary"
					onClick={() => this.handleSearch(selectedKeys, confirm)}
					icon={<XQIcon name="search" />}
					size="small"
					style={{ width: 90, marginRight: 8 }}
				>
					搜索
				</Button>
				<Button onClick={() => this.handleReset(clearFilters)} size="small" style={{ width: 90 }}>
					重置
				</Button>
			</div>
		);

		return dom;
	},

	handleSearch(selectedKeys, confirm){
		confirm();
		this.setState({ searchYear: selectedKeys[0] });
	},

	handleReset(clearFilters){
		clearFilters();
    	this.setState({ searchYear: '' });
	},
};
