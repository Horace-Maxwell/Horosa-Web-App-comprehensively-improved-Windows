package spacex.astrostudycn.model;

import java.util.HashMap;
import java.util.Map;

import boundless.utility.ConvertUtility;
import boundless.utility.DateTimeUtility;
import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.constants.Polarity;
import spacex.astrostudy.constants.StemBranch;
import spacex.astrostudy.helper.JdnHelper;
import spacex.astrostudy.model.FourColumns;
import spacex.astrostudy.model.godrule.GodRule;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.TimeZiAlg;

public class OnlyFourColumns extends BaZi {
	private static final double DirectTimeFactor = 365.25 / 3;

	private BaZiGender gender;
	private double directTimeJdn;
	private String directTime;
	private double directAge;
	private FateDirect[] direction = new FateDirect[0];
	
	public OnlyFourColumns(int ad, String birth, String zone, String lon, String lat, boolean after23NewDay, boolean adjustJieqi) {
		this(ad, birth, zone, lon, lat, after23NewDay, BaZiGender.Male, adjustJieqi);
	}

	public OnlyFourColumns(int ad, String birth, String zone, String lon, String lat, boolean after23NewDay) {
		this(ad, birth, zone, lon, lat, after23NewDay, BaZiGender.Male, false);
	}

	public OnlyFourColumns(int ad, String birth, String zone, String lon, String lat, boolean after23NewDay, BaZiGender gender, boolean adjustJieqi) {
		super(ad, birth, zone, lon, lat, TimeZiAlg.RealSun, false, GodRule.ZhuRiZhu, after23NewDay, adjustJieqi);
		this.gender = gender;
	}
	
	public FourColumns getFourColums() {
		this.calculateFourColumn(PhaseType.HuoTu);

		if((this.gender == BaZiGender.Male && this.fourColumns.year.stem.polar == Polarity.Positive) ||
				(this.gender == BaZiGender.Female && this.fourColumns.year.stem.polar == Polarity.Negative)) {
			forwardDirect(PhaseType.HuoTu);
		}else {
			backwardDirect(PhaseType.HuoTu);
		}
		
		return super.getFourColums();
	}
	
	
	public Map<String, Object> getNongli(){
		FourColumns fourcol = this.getFourColums();
		Map<String, Object> map = super.getNongli();
		map.put("bazi", fourcol);
		
		Map<String, Object> dir = new HashMap<String, Object>();
		dir.put("direction", this.direction);
		dir.put("directAge", this.directAge);
		dir.put("directTime", this.directTime);
		dir.put("directTimeJdn", this.directTimeJdn);

		map.put("direct", dir);
		
		return map;
	}

	private void forwardDirect(PhaseType phaseType) {
		String monthGanzi = this.fourColumns.month.ganzi;
		int monthIdx = StemBranch.JiaZiIndex.get(monthGanzi);
		System.out.println(this.nextJieSeconds/(24 * 3600));
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
		
		int mainDirJiaziIdx = (monthIdx + 1) % 60;
		this.direction = new FateDirect[9];
		for(int i=0; i<this.direction.length; i++) {
			int startYear = calparts[0];
			String mainDirGanzi = StemBranch.JiaZi[mainDirJiaziIdx];
			this.direction[i] = new FateDirect(age, startYear, mainDirGanzi, this.fourColumns.day.stem.cell, phaseType, this);
			mainDirJiaziIdx = (mainDirJiaziIdx + 1) % 60;
			this.directTimeJdn += (10*365.2425);
			cal = JdnHelper.getDateFromJdn(this.directTimeJdn, this.zone);
			calparts = DateTimeUtility.getDateTimeParts(cal);
			age += 10;
		}
	}
	
	private void backwardDirect(PhaseType phaseType) {
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
				
		int mainDirJiaziIdx = (monthIdx + 59) % 60;
		this.direction = new FateDirect[9];
		for(int i=0; i<this.direction.length; i++) {
			int startYear = calparts[0];
			String mainDirGanzi = StemBranch.JiaZi[mainDirJiaziIdx];
			this.direction[i] = new FateDirect(age, startYear, mainDirGanzi, this.fourColumns.day.stem.cell, phaseType, this);
			mainDirJiaziIdx = (mainDirJiaziIdx + 59) % 60;
			this.directTimeJdn += (10*365.2425);
			cal = JdnHelper.getDateFromJdn(this.directTimeJdn, this.zone);
			calparts = DateTimeUtility.getDateTimeParts(cal);
			age += 10;
		}
	}
	
	public static void main(String[] args) {
		String dtstr = "1976-07-06 21:11:00";
//		dtstr = "1-06-10 11:20:38";
//		dtstr = "1-01-01 11:20:38";
//		dtstr = "1500-02-28 11:20:38";
//		dtstr = "1-06-10 11:20:38";
//		dtstr = "-1-12-31 16:48:00";
//		dtstr = "1995-09-30 01:10:00";
		dtstr = "2020-11-07 07:14:04";
		
		String zone = "+08:00";
		String lon = "118e32";
		String lat = "36n37";
		
		lon = "119e18";
		lat = "26n05";
		
		int ad = 1;
		if(dtstr.startsWith("-")) {
			ad = -1;
		}
		
		OnlyFourColumns bz = new OnlyFourColumns(ad, dtstr, zone, lon, lat, false, true);
		Map<String, Object> res = bz.getNongli();
		
		
		String json = JsonUtility.encodePretty(res);
		System.out.println(json);
	}
	
}
