package spacex.astrostudy.model.godrule;

import java.util.Set;

import spacex.astrostudy.model.FourColumns;
import spacex.astrostudy.model.GanZi;

public class GodRuleByRiZhu extends GodRule {

	public GodRuleByRiZhu(GodRule rule) {
		this.name = rule.name;
		this.jixiong = rule.jixiong;
		this.keyZhu = rule.keyZhu;
		this.keyType = rule.keyType;
		this.valueZhu = rule.valueZhu;
		this.valueType = rule.valueType;
		this.rule = rule.rule; 
	}
	
	public void findGods(FourColumns fourCols) {
		if(!this.keyType.equals(TypeRiZhu)) {
			return;
		}
		
		Set<String> set = this.rule.get(TypeRiZhu);
		if(set.contains(fourCols.day.ganzi)) {
			if(jixiong.equals(JiXiongJi)) {
				fourCols.day.addGoodGod(this.name);
			}else if(jixiong.equals(JiXiongZhong)) {
				fourCols.day.addNeutralGod(this.name);
			}else if(jixiong.equals(JiXiongXiong)) {
				fourCols.day.addBadGod(this.name);
			}
		}
	}
	
	public void findGods(FourColumns fourCols, String zhu) {
		findGods(fourCols);
	}

	public void findGod(GanZi gz, GanZi keyGanzi) {
		
	}
	
}
