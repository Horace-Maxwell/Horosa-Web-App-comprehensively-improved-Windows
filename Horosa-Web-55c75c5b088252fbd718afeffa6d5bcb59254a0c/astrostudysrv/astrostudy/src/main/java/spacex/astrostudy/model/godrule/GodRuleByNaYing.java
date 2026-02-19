package spacex.astrostudy.model.godrule;

import java.util.Map;
import java.util.Set;

import spacex.astrostudy.model.FourColumns;
import spacex.astrostudy.model.GanZi;
import spacex.astrostudy.helper.WuXingPhaseHelper;

public class GodRuleByNaYing extends GodRule {

	public GodRuleByNaYing(GodRule rule) {
		this.name = rule.name;
		this.jixiong = rule.jixiong;
		this.keyZhu = rule.keyZhu;
		this.keyType = rule.keyType;
		this.valueZhu = rule.valueZhu;
		this.valueType = rule.valueType;
		this.rule = rule.rule; 
	}
	
	public void findGods(FourColumns fourCols) {
		if(!this.keyType.equals(TypeNaYing)) {
			return;
		}
		
		for(String zhu : this.keyZhu) {
			GanZi ganzi = fourCols.fourZhuMap.get(zhu);
			String nayingelem = ganzi.nayingElement.toString();
			Set<String> set = this.rule.get(nayingelem);
			for(String phase : set) {
				String nayingzi = WuXingPhaseHelper.getPhaseZi(fourCols.phaseType, ganzi.nayingElement, phase);
				for(Map.Entry<String, GanZi> entry : fourCols.fourZhuMap.entrySet()) {
					if(entry.getKey().equals(zhu)) {
						continue;
					}
					GanZi val = entry.getValue();
					if(val.branch.cell.equals(nayingzi)) {
						addGod(val.branch);
					}
				}
			}
		}
	}
	
	public void findGods(FourColumns fourCols, String zhu) { 
		findGods(fourCols);
	}
	
	public void findGod(GanZi gz, GanZi keyGanzi) {
		
	}
	
}
