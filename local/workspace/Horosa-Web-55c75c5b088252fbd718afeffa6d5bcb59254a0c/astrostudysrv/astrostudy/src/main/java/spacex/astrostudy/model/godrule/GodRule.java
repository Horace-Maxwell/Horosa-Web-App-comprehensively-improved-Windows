package spacex.astrostudy.model.godrule;

import java.util.Map;
import java.util.Set;

import spacex.astrostudy.model.FourColumns;
import spacex.astrostudy.model.GanZi;
import spacex.astrostudy.model.GanZiCell;


public class GodRule {
	
	public static final String TypeGan = "干"; 
	public static final String TypeZi = "支"; 
	public static final String TypeGanZi = "干支"; 
	public static final String TypePhase = "长生"; 
	public static final String TypeNaYing = "纳音"; 
	public static final String TypeNianZhu = "年柱"; 
	public static final String TypeYueZhu = "月柱"; 
	public static final String TypeRiZhu = "日柱"; 
	public static final String TypeShiZhu = "时柱"; 
	public static final String TypeJiaZi = "甲子"; 

	public static final String JiXiongJi = "吉"; 
	public static final String JiXiongZhong = "中"; 
	public static final String JiXiongXiong = "凶"; 
	
	public static final String ZhuNian = "年";
	public static final String ZhuYue = "月";
	public static final String ZhuRi = "日";
	public static final String ZhuShi = "时";
	public static final String ZhuRiZhu = "日柱";
	public static final String ZhuNianRi = "年日";

	public String name;
	public String jixiong;
	public Set<String> keyZhu;
	public String keyType;
	public Set<String> valueZhu;
	public String valueType;
	public Map<String, Set<String>> rule;
	
		
	protected void addGod(GanZiCell gz) {
		if(jixiong.equals(JiXiongJi)) {
			gz.addGoodGod(this.name);
		}else if(jixiong.equals(JiXiongZhong)) {
			gz.addNeutralGod(this.name);
		}else if(jixiong.equals(JiXiongXiong)) {
			gz.addBadGod(this.name);
		}
	}	
	
	protected void addGod(GanZi gz) {
		if(jixiong.equals(JiXiongJi)) {
			gz.addGoodGod(this.name);
		}else if(jixiong.equals(JiXiongZhong)) {
			gz.addNeutralGod(this.name);
		}else if(jixiong.equals(JiXiongXiong)) {
			gz.addBadGod(this.name);
		}
	}
		
	public void findGods(FourColumns fourCols, String zhu) {
		if(!this.keyZhu.isEmpty()) {
			for(String zu : this.keyZhu) {
				findGodsByZhu(fourCols, zu);
			}
		}else {
			findGodsByZhu(fourCols, zhu);
		}
	}
	
	public void findGod(GanZi gz, GanZi keyGanzi) {
		if(this.keyType.equals(GodRule.TypeGan)) {
			findGodsByTypeGan(gz, keyGanzi);
		}else if(this.keyType.equals(GodRule.TypeZi)) {
			findGodsByTypeZi(gz, keyGanzi);
		}else if(this.keyType.equals(GodRule.TypeGanZi)) {
			findGodsByTypeGanZi(gz, keyGanzi);
		}
		
	}
	
	private void findGodsByTypeGanZi(GanZi valGanzi, GanZi keyGanzi) {
		Set<String> set = this.rule.get(keyGanzi.stem.cell);
		if(set == null) {
			findGodsByTypeZi(valGanzi, keyGanzi);
		}else {
			findGodsByTypeGan(valGanzi, keyGanzi);
			findGodsByTypeZi(valGanzi, keyGanzi);
		}
	}
	
	
	private void findGodsByTypeGan(GanZi valGanzi, GanZi keyGanzi) {
		Set<String> set = this.rule.get(keyGanzi.stem.cell);
		if(set == null || !this.valueZhu.isEmpty()) {
			return;
		}
		for(String cell : set) {
			if(this.valueType.equals(TypeGan)) {
				if(cell.equals(valGanzi.stem.cell)) {
					addGod(valGanzi.stem);
				}						
			}else if(this.valueType.equals(TypeZi)) {
				if(cell.equals(valGanzi.branch.cell)) {
					addGod(valGanzi.branch);
				}						
			}else if(this.valueType.equals(TypeGanZi)) {
				if(cell.equals(valGanzi.stem.cell)) {
					addGod(valGanzi.stem);
				}else if(cell.equals(valGanzi.branch.cell)) {
					addGod(valGanzi.branch);
				}						
			}			
		}
	}
	
	private void findGodsByTypeZi(GanZi valGanzi, GanZi keyGanzi) {
		Set<String> set = this.rule.get(keyGanzi.branch.cell);
		if(set == null || !this.valueZhu.isEmpty()) {
			return;
		}
		for(String cell : set) {
			if(this.valueType.equals(TypeGan)) {
				if(cell.equals(valGanzi.stem.cell)) {
					addGod(valGanzi.stem);
				}						
			}else if(this.valueType.equals(TypeZi)) {
				if(cell.equals(valGanzi.branch.cell)) {
					addGod(valGanzi.branch);
				}						
			}else if(this.valueType.equals(TypeGanZi)) {
				if(cell.equals(valGanzi.stem.cell)) {
					addGod(valGanzi.stem);
				}else if(cell.equals(valGanzi.branch.cell)) {
					addGod(valGanzi.branch);
				}						
			}			
		}
	}
	
	
	private void findGodsByZhu(FourColumns fourCols, String keyZhu) {
		GanZi keyGanzi = fourCols.fourZhuMap.get(keyZhu);
		if(this.keyType.equals(GodRule.TypeGan)) {
			findGodsByTypeGan(fourCols, keyZhu, keyGanzi);
		}else if(this.keyType.equals(GodRule.TypeZi)) {
			findGodsByTypeZi(fourCols, keyZhu, keyGanzi);
		}else if(this.keyType.equals(GodRule.TypeGanZi)) {
			findGodsByTypeGanZi(fourCols, keyZhu, keyGanzi);
		}
	}
	
	private void findGodsByTypeGan(FourColumns fourCols, String keyZhu, GanZi keyGanzi) {
		Set<String> set = this.rule.get(keyGanzi.stem.cell);
		if(set == null) {
			return;
		}
		for(String cell : set) {
			if(this.valueZhu.isEmpty()) {
				for(Map.Entry<String, GanZi> valEntry : fourCols.fourZhuMap.entrySet()) {
					String zhu = valEntry.getKey();
					if(zhu.equals(keyZhu) && this.valueType.equals(TypeGan)) {
						continue;
					}
					GanZi valGanzi = valEntry.getValue();
					if(this.valueType.equals(TypeGan)) {
						if(cell.equals(valGanzi.stem.cell)) {
							addGod(valGanzi.stem);
						}						
					}else if(this.valueType.equals(TypeZi)) {
						if(cell.equals(valGanzi.branch.cell)) {
							addGod(valGanzi.branch);
						}						
					}else if(this.valueType.equals(TypeGanZi)) {
						if(cell.equals(valGanzi.stem.cell)) {
							addGod(valGanzi.stem);
						}else if(cell.equals(valGanzi.branch.cell)) {
							addGod(valGanzi.branch);
						}						
					}
				}
			}else {
				for(String valZu: this.valueZhu) {
					GanZi valGanzi = fourCols.fourZhuMap.get(valZu);
					if(this.valueType.equals(TypeGan)) {
						if(cell.equals(valGanzi.stem.cell)) {
							addGod(valGanzi.stem);
						}						
					}else if(this.valueType.equals(TypeZi)) {
						if(cell.equals(valGanzi.branch.cell)) {
							addGod(valGanzi.branch);
						}						
					}else if(this.valueType.equals(TypeGanZi)) {
						if(cell.equals(valGanzi.stem.cell)) {
							addGod(valGanzi.stem);
						}else if(cell.equals(valGanzi.branch.cell)) {
							addGod(valGanzi.branch);
						}						
					}
				}					
			}
		}
	}
	
	private void findGodsByTypeZi(FourColumns fourCols, String keyZhu, GanZi keyGanzi) {
		Set<String> set = this.rule.get(keyGanzi.branch.cell);
		if(set == null) {
			return;
		}
		for(String cell : set) {
			if(this.valueZhu.isEmpty()) {
				for(Map.Entry<String, GanZi> valEntry : fourCols.fourZhuMap.entrySet()) {
					String zhu = valEntry.getKey();
					if(zhu.equals(keyZhu) && this.valueType.equals(TypeZi)) {
						continue;
					}
					GanZi valGanzi = valEntry.getValue();
					if(this.valueType.equals(TypeGan)) {
						if(cell.equals(valGanzi.stem.cell)) {
							addGod(valGanzi.stem);
						}						
					}else if(this.valueType.equals(TypeZi)) {
						if(cell.equals(valGanzi.branch.cell)) {
							addGod(valGanzi.branch);
						}						
					}else if(this.valueType.equals(TypeGanZi)) {
						if(cell.equals(valGanzi.stem.cell)) {
							addGod(valGanzi.stem);
						}else if(cell.equals(valGanzi.branch.cell)) {
							addGod(valGanzi.branch);
						}						
					}
				}
			}else {
				for(String valZu: this.valueZhu) {
					GanZi valGanzi = fourCols.fourZhuMap.get(valZu);
					if(this.valueType.equals(TypeGan)) {
						if(cell.equals(valGanzi.stem.cell)) {
							addGod(valGanzi.stem);
						}						
					}else if(this.valueType.equals(TypeZi)) {
						if(cell.equals(valGanzi.branch.cell)) {
							addGod(valGanzi.branch);
						}						
					}else if(this.valueType.equals(TypeGanZi)) {
						if(cell.equals(valGanzi.stem.cell)) {
							addGod(valGanzi.stem);
						}else if(cell.equals(valGanzi.branch.cell)) {
							addGod(valGanzi.branch);
						}						
					}
				}					
			}
		}		
	}

	private void findGodsByTypeGanZi(FourColumns fourCols, String keyZhu, GanZi keyGanzi) {
		Set<String> set = this.rule.get(keyGanzi.stem.cell);
		if(set == null) {
			findGodsByTypeZi(fourCols, keyZhu, keyGanzi);
		}else {
			findGodsByTypeGan(fourCols, keyZhu, keyGanzi);
			findGodsByTypeZi(fourCols, keyZhu, keyGanzi);
		}
	}
	
}
