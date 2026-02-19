package spacex.astrostudy.model;

import java.util.HashMap;
import java.util.Map;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;
import spacex.astrostudy.helper.QiMengHelper;

public class NongLi {
	public String birth;
	public String year = "  ";
	public String yearJieqi = "  ";
	public String month = "  ";
	public String day = "  ";
	public int dayInt;
	public int monthInt;
	public String time = "  ";
	public boolean leap;
	public String monthGanZi = "  ";
	public String dayGanZi = "  ";
	public String yearNaying = "  ";
	public String yearNayingElement = "  ";
	public String jieqiYearNaying = "  ";
	public String jieqiYearNayingElement = "  ";
	public int ad = 1;
	public int dayOfWeek = 0;
	public double jdn = 0;
	public String jieqi = null;
	public String jieqiTime = null;
	public double jieqiJdn = 0;
	public String moonTime = null;
	public double moonJdn = 0;
	public String date = null;
	public String chef = null;
	public String jiedelta = null;
	public int jieord = 0;
	public String qimengYearGua;
	
	
	public static NongLi emptyNongLi() {
		NongLi nl = new NongLi();
		return nl;
	}
	
	private NongLi() {
		
	}
	
	public NongLi(Map<String, Object> map) {
		this.year = (String) map.get("year");
		this.yearJieqi = this.year;
		this.month = (String) map.get("month");
		if(StringUtility.isNullOrEmpty(this.year)) {
			QueueLog.error(AppLoggers.ErrorLogger, "{}", map.toString());
			throw new RuntimeException("year.is.null");
		}
		if(StringUtility.isNullOrEmpty(this.month)) {
			QueueLog.error(AppLoggers.ErrorLogger, "{}", map.toString());
			throw new RuntimeException("month.is.null");
		}
		this.day = (String) map.get("day");
		this.dayInt = (int) map.get("dayInt");
		if(this.dayInt > 30) {
			QueueLog.error(AppLoggers.ErrorLogger, "{}", map.toString());
			throw new RuntimeException(String.format("day.isnot.correct:%d", this.dayInt));
		}
		this.leap = ConvertUtility.getValueAsBool(map.get("leap"));
		this.ad = ConvertUtility.getValueAsInt(map.get("ad"), 1);
		this.dayOfWeek = ConvertUtility.getValueAsInt(map.get("dayOfWeek"), 0);
		this.jdn = ConvertUtility.getValueAsDouble(map.get("jdn"));
		
		this.date = (String) map.get("date");
		this.jieqi = (String) map.get("jieqi");
		this.jieqiTime = (String) map.get("jieqiTime");
		this.jieqiJdn = ConvertUtility.getValueAsDouble(map.get("jieqiJdn"), 0);
		this.moonTime = (String) map.get("moonTime");
		this.moonJdn = ConvertUtility.getValueAsDouble(map.get("moonJdn"), 0);
		this.chef = (String) map.get("chef");
		this.jiedelta = (String) map.get("jiedelta");
		this.jieord = ConvertUtility.getValueAsInt(map.get("jieord"), 0);		
	}
	
	@Override
	public Object clone() {
		NongLi nongli = new NongLi();
		nongli.birth = this.birth;
		nongli.year = this.year;
		nongli.yearJieqi = this.yearJieqi;
		nongli.month = this.month;
		nongli.day = this.day;
		nongli.dayInt = this.dayInt;
		nongli.monthInt = this.monthInt;
		nongli.time = this.time;
		nongli.leap = this.leap;
		nongli.monthGanZi = this.monthGanZi;
		nongli.dayGanZi = this.dayGanZi;
		nongli.yearNaying = this.yearNaying;
		nongli.yearNayingElement = this.yearNayingElement;
		nongli.jieqiYearNaying = this.jieqiYearNaying;
		nongli.jieqiYearNayingElement = this.jieqiYearNayingElement;
		nongli.ad = this.ad;
		nongli.dayOfWeek = this.dayOfWeek;
		nongli.jdn = this.jdn;
		nongli.jieqi = this.jieqi;
		nongli.jieqiTime = this.jieqiTime;
		nongli.jieqiJdn = this.jieqiJdn;
		nongli.moonJdn = this.moonJdn;
		nongli.moonTime = this.moonTime;
		nongli.date = this.date;
		nongli.qimengYearGua = this.qimengYearGua;
		
		return nongli;
	}
	
	public Map<String, Object> toMap(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.put("birth", this.birth == null ? "  " : this.birth);
		map.put("year", this.year);
		map.put("yearJieqi", this.yearJieqi);
		map.put("month", this.month);
		map.put("day", this.day);
		map.put("dayInt", this.dayInt);
		map.put("monthInt", this.monthInt);
		map.put("time", this.time);
		map.put("leap", this.leap);
		map.put("monthGanZi", this.monthGanZi);
		map.put("dayGanZi", this.dayGanZi);
		map.put("yearNaying", this.yearNaying);
		map.put("yearNayingElement", this.yearNayingElement);
		map.put("jieqiYearNaying", this.jieqiYearNaying);
		map.put("jieqiYearNayingElement", this.jieqiYearNayingElement);
		map.put("ad", this.ad);
		map.put("dayOfWeek", this.dayOfWeek);
		map.put("jdn", this.jdn);
		map.put("jieqi", this.jieqi);
		map.put("jieqiTime", this.jieqiTime);
		map.put("jieqiJdn", this.jieqiJdn);
		map.put("moonJdn", this.moonJdn);
		map.put("moonTime", this.moonTime);
		map.put("date", this.date);
		map.put("jiedelta", this.jiedelta);
		map.put("jieord", this.jieord);
		map.put("chef", this.chef);
		map.put("qimengYearGua", this.qimengYearGua);
		
		return map;
	}
	
}
