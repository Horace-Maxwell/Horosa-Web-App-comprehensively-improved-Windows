package spacex.astrostudy.model.godrule;

import java.util.Set;

import spacex.astrostudy.model.FourColumns;
import spacex.astrostudy.model.GanZi;

public class GodRuleByJiaZi extends GodRule {

	public GodRuleByJiaZi(GodRule rule) {
		this.name = rule.name;
		this.jixiong = rule.jixiong;
		this.keyZhu = rule.keyZhu;
		this.keyType = rule.keyType;
		this.valueZhu = rule.valueZhu;
		this.valueType = rule.valueType;
		this.rule = rule.rule; 
	}
	
	public void findGods(FourColumns fourCols) {
		if(!this.keyType.equals(TypeJiaZi)) {
			return;
		}
		
		Set<String> set = this.rule.get(TypeNianZhu);
		addGods(set, fourCols.year);
		
		set = this.rule.get(TypeYueZhu);
		addGods(set, fourCols.month);
		
		set = this.rule.get(TypeRiZhu);
		addGods(set, fourCols.day);

		set = this.rule.get(TypeShiZhu);
		addGods(set, fourCols.time);
	}
	
	private void addGods(Set<String> set, GanZi gz) {
		if(set == null) {
			return;
		}
		
		if(set.contains(gz.ganzi)) {
			if(jixiong.equals(JiXiongJi)) {
				gz.addGoodGod(this.name);
			}else if(jixiong.equals(JiXiongZhong)) {
				gz.addNeutralGod(this.name);
			}else if(jixiong.equals(JiXiongXiong)) {
				gz.addBadGod(this.name);
			}
		}
		
	}
	
	public void findGods(FourColumns fourCols, String zhu) {
		findGods(fourCols);
	}

	public void findGod(GanZi gz, GanZi keyGanzi) {
		
	}
	
}
