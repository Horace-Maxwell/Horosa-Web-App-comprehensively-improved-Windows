package spacex.astrostudy.model;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import spacex.astrostudy.constants.FiveElement;
import spacex.astrostudy.constants.Polarity;

public class GanZiCell {
	public String cell;
	public String relative;
	public FiveElement element;
	public Polarity polar;
	public Set<String> goodGods;
	public Set<String> badGods;
	public Set<String> neutralGods;
	public Set<String> taisuiGods;
	
	public Map<String, Object> gua;
	
	public GanZiCell(String cell, FiveElement element, Polarity polar) {
		this.cell = cell;
		this.element = element;
		this.polar = polar;
		this.goodGods = new HashSet<String>();
		this.badGods = new HashSet<String>();
		this.neutralGods = new HashSet<String>();
		this.taisuiGods = new HashSet<String>();
	}
	
	public void fillRelative(FiveElement riyuanElem, Polarity riyuanPolar) {
		this.relative = this.element.getRelative(riyuanElem, this.polar == riyuanPolar);
	}
	
	public void addGoodGod(String god) {
		this.goodGods.add(god);
	}
	
	public void addBadGod(String god) {
		this.badGods.add(god);
	}
	
	public void addNeutralGod(String god) {
		this.neutralGods.add(god);
	}
	
	public void addTaiSuiGod(String god) {
		this.taisuiGods.add(god);
	}
	
}
