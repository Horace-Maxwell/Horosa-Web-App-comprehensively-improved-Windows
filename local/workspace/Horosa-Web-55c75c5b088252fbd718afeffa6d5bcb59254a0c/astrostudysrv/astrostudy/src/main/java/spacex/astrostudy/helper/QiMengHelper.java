package spacex.astrostudy.helper;

import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.office.OfficeUtility;
import boundless.utility.ConvertUtility;

public class QiMengHelper {
	private static Map<Integer, String> yearGua = new HashMap<Integer, String>();
	
	static {
		try {
			String[] keys = new String[] {"year", "gua"};
			byte[] raw = FileUtility.getBytesFromClassPath("qimeng/奇门年卦.xlsx");
			ByteArrayInputStream bins = new ByteArrayInputStream(raw);
			Map<String, List<Object[]>> map = OfficeUtility.readExcel(bins, 0, keys.length);
			List<Object[]> list = map.get("qimeng");
			
			for(Object[] row : list) {
				int year = ConvertUtility.getValueAsInt(row[0]);
				String gua = (String) row[1];
				yearGua.put(year, gua);
			}
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static String getGua(int year) {
		return yearGua.get(year);
	}
	
	public static void main(String[] args) {
		System.out.println(yearGua);
	}
}
