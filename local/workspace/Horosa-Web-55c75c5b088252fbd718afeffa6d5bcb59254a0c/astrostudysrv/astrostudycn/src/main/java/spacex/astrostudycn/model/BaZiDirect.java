package spacex.astrostudycn.model;

import boundless.io.FileUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.DateTimeUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.constants.Polarity;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.JdnHelper;
import spacex.astrostudy.model.GanZi;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.TimeZiAlg;
import spacex.astrostudycn.helper.BaZiPredictHelper;

public class BaZiDirect extends BaZi {
	private static final double DirectTimeFactor = 365.25 / 3;
	
	protected BaZiGender gender;
	protected double directTimeJdn;
	protected String directTime;
	protected double directAge;
	protected FateDirect[] direction = new FateDirect[0];
	protected SmallFateDirect[] smallDirection = new SmallFateDirect[0];

	public BaZiDirect(int ad, String birth, String zone, String lon, String lat, TimeZiAlg timeAlg, boolean useZodicalLon, String godKeyPos, boolean after23NewDay, boolean gender, boolean adjustJieqi) {
		super(ad, birth, zone, lon, lat, timeAlg, useZodicalLon, godKeyPos, after23NewDay, adjustJieqi);
		if(gender) {
			this.gender = BaZiGender.Male;
		}else {
			this.gender = BaZiGender.Female;
		}
		
	}

	public BaZiGender getGender() {
		return this.gender;
	}

	public void calculate(PhaseType phaseType) {
		super.calculate(phaseType);
		if((this.gender == BaZiGender.Male && this.fourColumns.year.stem.polar == Polarity.Positive) ||
				(this.gender == BaZiGender.Female && this.fourColumns.year.stem.polar == Polarity.Negative)) {
			forwardDirect(phaseType);
		}else {
			backwardDirect(phaseType);
		}
		
		GanZi[] keygz = new GanZi[1];
		if(this.godKeyPos.equals("年日")) {
			keygz = new GanZi[2];
			keygz[0] = this.fourColumns.fourZhuMap.get("年");
			keygz[1] = this.fourColumns.fourZhuMap.get("日");			
		}else {
			keygz[0] = this.fourColumns.fourZhuMap.get(this.godKeyPos);
		}
		
		int yearZiIdx = StemBranch.BranchIndex.get(this.fourColumns.year.branch.cell);
		for(GanZi key : keygz) {
			for(FateDirect dir : direction) {
				dir.findGods(key, yearZiIdx);
				dir.fillRela(this.fourColumns.day.stem.cell);
			}
			for(SmallFateDirect dir : smallDirection) {
				dir.findGods(key, yearZiIdx);
				dir.fillRela(this.fourColumns.day.stem.cell);
			}			
		}
		
		BaZiPredictHelper.save(this);
	}
	
	private void forwardDirect(PhaseType phaseType) {
		String ming12 = (String) this.fourColumns.ming12.get("zhi");
		
		String monthGanzi = this.fourColumns.month.ganzi;
		int monthIdx = StemBranch.JiaZiIndex.get(monthGanzi);
		this.directAge = this.nextJieSeconds * DirectTimeFactor / (365.25 * 24 * 3600);
		int sec = ConvertUtility.getValueAsInt(this.nextJieSeconds * DirectTimeFactor);
		
		this.directTimeJdn = this.oldBirthJdn;
		if(this.timeAlg != TimeZiAlg.DirectTime) {
			this.directTimeJdn = this.birthJdn;
		}
		this.directTimeJdn += (sec / 3600.0 / 24.0);
		this.directTime = JdnHelper.getDateFromJdn(this.directTimeJdn, this.zone);
		String cal = JdnHelper.getDateFromJdn(this.directTimeJdn, this.zone);
		int[] calparts = DateTimeUtility.getDateTimeParts(cal);
		int dirYear = calparts[0];
		int birthYear = this.oldBirthParts[0];
		int age = dirYear - birthYear;
		int smallAge = 90;
		
		this.smallDirection = new SmallFateDirect[smallAge + 1];
		int tmidx = (StemBranch.JiaZiIndex.get(this.fourColumns.time.ganzi) + 1) % 60;

		int[] smallCal = this.birthParts;
		if(this.timeAlg == TimeZiAlg.DirectTime) {
			smallCal = this.oldBirthParts;
		}
		int year = smallCal[0];
		int yearIdx = StemBranch.JiaZiIndex.get(this.fourColumns.year.ganzi);
		for(int i=0; i<=smallAge; i++) {
			String ganzi = StemBranch.JiaZi[tmidx];
			int y = year + i;
			this.smallDirection[i] = new SmallFateDirect(i, y, yearIdx, ganzi, this.fourColumns.day.stem.cell, phaseType, this);
			this.smallDirection[i].yearGanzi.setupStarCharger(ming12);
			this.smallDirection[i].setupGong12();
			tmidx = (tmidx + 1) % 60;
			yearIdx = (yearIdx + 1) % 60;
		}
		
		int mainDirJiaziIdx = (monthIdx + 1) % 60;
		this.direction = new FateDirect[9];
		for(int i=0; i<this.direction.length; i++) {
			int startYear = calparts[0];
			String mainDirGanzi = StemBranch.JiaZi[mainDirJiaziIdx];
			this.direction[i] = new FateDirect(age, startYear, mainDirGanzi, this.fourColumns.day.stem.cell, phaseType, this);
			this.direction[i].setupYearCharger(ming12);
			this.direction[i].setupGong12();
			mainDirJiaziIdx = (mainDirJiaziIdx + 1) % 60;
			this.directTimeJdn += (10*365.2425);
			cal = JdnHelper.getDateFromJdn(this.directTimeJdn, this.zone);
			calparts = DateTimeUtility.getDateTimeParts(cal);
			age += 10;
		}
	}
	
	private void backwardDirect(PhaseType phaseType) {
		String ming12 = (String) this.fourColumns.ming12.get("zhi");
		
		String monthGanzi = this.fourColumns.month.ganzi;
		int monthIdx = StemBranch.JiaZiIndex.get(monthGanzi);
		this.directAge = this.prevJieSeconds * DirectTimeFactor / (365.25 * 24 * 3600);
		int sec = ConvertUtility.getValueAsInt(this.prevJieSeconds * DirectTimeFactor);
		
		this.directTimeJdn = this.oldBirthJdn;
		if(this.timeAlg != TimeZiAlg.DirectTime) {
			this.directTimeJdn = this.birthJdn;
		}
		this.directTimeJdn += (sec / 3600.0 / 24.0);
		this.directTime = JdnHelper.getDateFromJdn(this.directTimeJdn, this.zone);
		String cal = JdnHelper.getDateFromJdn(this.directTimeJdn, this.zone);
		int[] calparts = DateTimeUtility.getDateTimeParts(cal);
		int dirYear = calparts[0];
		int birthYear = this.oldBirthParts[0];
		int age = dirYear - birthYear;
		int smallAge = 90;
		
		this.smallDirection = new SmallFateDirect[smallAge + 1];
		int tmidx = (StemBranch.JiaZiIndex.get(this.fourColumns.time.ganzi) + 59) % 60;
		int[] smallCal = this.birthParts;
		if(this.timeAlg == TimeZiAlg.DirectTime) {
			smallCal = this.oldBirthParts;
		}
		int year = smallCal[0];
		int yearIdx = StemBranch.JiaZiIndex.get(this.fourColumns.year.ganzi);
		for(int i=0; i<=smallAge; i++) {
			String ganzi = StemBranch.JiaZi[tmidx];
			int y = year + i;
			this.smallDirection[i] = new SmallFateDirect(i, y, yearIdx, ganzi, this.fourColumns.day.stem.cell, phaseType, this);
			this.smallDirection[i].yearGanzi.setupStarCharger(ming12);
			this.smallDirection[i].setupGong12();
			tmidx = (tmidx + 59) % 60;
			yearIdx = (yearIdx + 1) % 60;
		}
		
		int mainDirJiaziIdx = (monthIdx + 59) % 60;
		this.direction = new FateDirect[9];
		for(int i=0; i<this.direction.length; i++) {
			int startYear = calparts[0];
			String mainDirGanzi = StemBranch.JiaZi[mainDirJiaziIdx];
			this.direction[i] = new FateDirect(age, startYear, mainDirGanzi, this.fourColumns.day.stem.cell, phaseType, this);
			this.direction[i].setupYearCharger(ming12);
			this.direction[i].setupGong12();
			mainDirJiaziIdx = (mainDirJiaziIdx + 59) % 60;
			this.directTimeJdn += (10*365.2425);
			cal = JdnHelper.getDateFromJdn(this.directTimeJdn, this.zone);
			calparts = DateTimeUtility.getDateTimeParts(cal);
			age += 10;
		}
	}
	
	
	public static void main(String[] args) {
		String dtstr = "1976-07-06 21:11:00";
//		dtstr = "1976-12-18 18:00:00";
//		dtstr = "2019-07-04 10:29";
		
		String zone = "+08:00";
		String lon = "119e18";
		String lat = "26n06";
		
		dtstr = "1989-01-20 11:30:00";
		lon = "119e39";
		lat = "27n04";
		
		int ad = 1;
		if(dtstr.startsWith("-")) {
			ad = -1;
		}
		BaZiDirect bz = new BaZiDirect(ad, dtstr, zone, lon, lat, TimeZiAlg.RealSun, false, GodRule.ZhuNianRi, false, true, true);
		bz.calculate(PhaseType.HuoTu);
		
		
		String json = JsonUtility.encodePretty(bz);
		System.out.println(json);
		FileUtility.save("/Users/Shared/file/bazi.json", json);
	}
	
}
