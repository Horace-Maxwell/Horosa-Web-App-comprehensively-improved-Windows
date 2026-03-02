package spacex.astrostudy.helper;

import java.util.HashMap;
import java.util.Map;

import boundless.utility.DateTimeUtility;

public class JdnHelper {
	public static class RealDate{
		public double orgJdn;
		public double realJdn;
		public String realDate;
	}

	public static String getDateFromJdn(double jdn, String zone) {
		String str = DateTimeUtility.getDateFromJdn(jdn, zone, (dj, z)->{
			Map<String, Object> params = new HashMap<String, Object>();
			params.put("jdn", dj);
			params.put("zone", z);
			return AstroHelper.getJdnDate(params);
		});
		
		return str;
	}
	
	public static RealDate addOffset(String date, String zone, double jdnOffset) {
		RealDate realres = new RealDate();
		
		int[] dateparts = DateTimeUtility.getDateTimeParts(date);
		double jd = DateTimeUtility.getDateNum(date, zone);
		double realdateJdn = jd + jdnOffset;
		String realdate = JdnHelper.getDateFromJdn(realdateJdn, zone);
		int[] realdateparts = DateTimeUtility.getDateTimeParts(realdate);
		
		if(jd < 0 && jdnOffset < 0 && realdateparts[2] == dateparts[2] && realdateparts[3] > dateparts[3]) {
			realdateJdn -= 1;
			realdate = JdnHelper.getDateFromJdn(realdateJdn, zone);
		}
		
		realres.orgJdn = jd;
		realres.realJdn = realdateJdn;
		realres.realDate = realdate;
		return realres;
	}
	
}
