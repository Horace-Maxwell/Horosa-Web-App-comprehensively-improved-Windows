package spacex.astrostudycn.model;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import boundless.utility.StringUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.GodsHelper;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.helper.LiuRengHelper;

public class LiuReng extends BaZi {
	
	protected Map<String, Object> gods;		// 必备神煞
	protected Map<String, Object> godsZi;		// 支煞
	protected Map<String, Object> godsGan;	// 干煞
	protected Map<String, Object> godsMonth;	// 月煞
	protected Map<String, Object> godsYear;	// 年煞

	protected Map<String, Object> xun;		// 旬日
	
	transient protected String yue;
	transient protected boolean isDiurnal;
	
	protected Map<String, Object> keCuang;
	
	public LiuReng(int ad, String birth, String zone, String lon, String lat, TimeZiAlg timeAlg, boolean useZodicalLon, String godKeyPos, boolean after23NewDay) {
		this(ad, birth, zone, lon, lat, timeAlg, useZodicalLon, godKeyPos, after23NewDay, null, true);
	}

	public LiuReng(int ad, String birth, String zone, String lon, String lat, TimeZiAlg timeAlg, boolean useZodicalLon, String godKeyPos, boolean after23NewDay, String yue, boolean isDiurnal) {
		super(ad, birth, zone, lon, lat, timeAlg, useZodicalLon, godKeyPos, after23NewDay, false);
		
		this.gods = new HashMap<String, Object>();
		this.godsZi = new HashMap<String, Object>();
		this.godsGan = new HashMap<String, Object>();
		this.godsMonth = new HashMap<String, Object>();
		this.godsYear = new HashMap<String, Object>();
		this.xun = new HashMap<String, Object>();
		
		this.yue = yue;
		this.isDiurnal = isDiurnal;
		
	}
	
	public void calculate(PhaseType phaseType) {
		super.calculateFourColumn(PhaseType.ShuiTu);
		
		this.fillXun();
		this.fillGods();
		
		if(!StringUtility.isNullOrEmpty(this.yue)) {
			this.keCuang = LiuRengHelper.calcKeCuang(this.fourColumns, this.yue, this.isDiurnal);
		}
	}
	
	
	private void fillGods() {
		this.godsYear = GodsHelper.findTaiSuiGods(this.fourColumns.year.branch.cell);
		this.godsMonth = GodsHelper.findGods(this.fourColumns.month.branch.cell, new String[]{"天德", "月德", "月破"});
		this.godsGan = GodsHelper.findGods(this.fourColumns.day.stem.cell, new String[]{"长生(水土同)", "干墓(水土同)", "游都"});
		this.godsZi = GodsHelper.findGods(this.fourColumns.day.branch.cell, new String[]{"金神", "亡神", "劫煞", "咸池", "华盖", "支将", "日破"});
		this.gods = GodsHelper.findGods(this.fourColumns.day.stem.cell, new String[]{"日德", "禄勋"});
		Map<String, Object> god = GodsHelper.findGods(this.fourColumns.day.branch.cell, new String[]{"驿马"});
		this.gods.putAll(god);
		
	}
	
	private void fillXun() {
		String ganzi = this.fourColumns.day.ganzi;
		String gan = ganzi.substring(0, 1);
		int ganIdx = StemBranch.StemIndex.get(gan);
		int dingIdx = StemBranch.StemIndex.get(StemBranch.STEM_DING);
		int delta = dingIdx - ganIdx;
		
		String empty = StemBranch.getXunEmpty(ganzi);
		int idx = StemBranch.JiaZiIndex.get(ganzi);
		int xunIdx = idx / 10;
		String ganzi0 = StemBranch.JiaZi[xunIdx*10];
		String ganzi1 = StemBranch.JiaZi[xunIdx*10 + 9];
		int dingGanZiIdx = idx + delta;
		String dinggz = StemBranch.JiaZi[dingGanZiIdx];
		
		this.xun.put("旬丁", dinggz);
		this.xun.put("旬空", empty);
		this.xun.put("旬首", ganzi0);
		this.xun.put("旬尾", ganzi1);
	}

}
