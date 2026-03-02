package spacex.astrostudy.model.godrule;

import java.util.Map;
import java.util.Set;

import spacex.astrostudy.model.FourColumns;
import spacex.astrostudy.model.GanZi;
import spacex.astrostudy.helper.WuXingPhaseHelper;

public class GodRuleByPhase extends GodRule {

	public GodRuleByPhase(GodRule rule) {
		this.name = rule.name;
		this.jixiong = rule.jixiong;
		this.keyZhu = rule.keyZhu;
		this.keyType = rule.keyType;
		this.valueZhu = rule.valueZhu;
		this.valueType = rule.valueType;
		this.rule = rule.rule; 
	}
	
	private void findGodsByZhu(FourColumns fourCols, String keyZhu) {
		GanZi keyGanzi = fourCols.fourZhuMap.get(keyZhu);
		if(this.keyType.equals(GodRule.TypeGan)) {
			Set<String> set = this.rule.get(keyGanzi.stem.cell);
			for(String phase : set) {
				String zi = WuXingPhaseHelper.getPhaseZi(fourCols.phaseType, keyGanzi.stem.cell, phase);	
				if(this.valueZhu.isEmpty()) {
					for(Map.Entry<String, GanZi> valEntry : fourCols.fourZhuMap.entrySet()) {
						if(valEntry.getKey().equals(keyZhu)) {
							continue;
						}
						GanZi valGanzi = valEntry.getValue();
						if(zi.equals(valGanzi.branch.cell)) {
							addGod(keyGanzi);
						}
					}
				}else {
					for(String valZu: this.valueZhu) {
						GanZi valGanzi = fourCols.fourZhuMap.get(valZu);
						if(zi.equals(valGanzi.branch.cell)) {
							addGod(keyGanzi);
						}
					}					
				}
			}
		}
	}
	
	public void findGods(FourColumns fourCols, String zhu) { 
		if(!this.valueType.equals(TypePhase)) {
			return;
		}
		
		if(!this.keyZhu.isEmpty()) {
			for(String zu : this.keyZhu) {
				findGodsByZhu(fourCols, zu);
			}
		}else {
			findGodsByZhu(fourCols, zhu);
		}
	}
	
	public void findGod(GanZi gz, GanZi keyGanzi) {
		
	}
	
}
