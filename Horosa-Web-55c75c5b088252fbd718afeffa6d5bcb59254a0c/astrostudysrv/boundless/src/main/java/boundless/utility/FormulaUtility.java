package boundless.utility;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.mariuszgromada.math.mxparser.Argument;
import org.mariuszgromada.math.mxparser.Expression;
import org.mariuszgromada.math.mxparser.mXparser;

import boundless.io.FileUtility;
import boundless.log.QueueLog;
import boundless.types.OutParameter;
import boundless.types.Tuple;

public class FormulaUtility {

	public static double calculate(String formula, Tuple<String, String>... arguments){
		Argument[] args = new  Argument[0];
		if(arguments != null && arguments.length > 0){
			args = new Argument[arguments.length];
			for(int i=0; i<arguments.length; i++){
				Tuple<String, String> tuple = arguments[i];
				Argument arg = new Argument(String.format("%s=%s", tuple.item1(), tuple.item2()));
				args[i] = arg;
			}
		}
		
		Expression e;
		if(args.length > 0){
			e = new Expression(formula, args);
		}else{
			e = new Expression(formula);
		}
		return e.calculate();
	}
	
	public static double calculateByX(String formula, double x){
		Tuple<String, String> tuple = new Tuple<String, String>("x", x + "");
		return calculate(formula.toLowerCase(), tuple);
	}
	
    private static String[] splitHelp(String text) {
    	int colsCount = 6;
    	String[] res = new String[colsCount];
    	int idx = 0;
    	String txt = text.trim();
    	char[] chars = txt.toCharArray();
		StringBuilder tmp = new StringBuilder();
		StringBuilder sb = new StringBuilder();
		boolean idxfound = false;
    	for(int i=0; i < chars.length; i++) {
    		char c = chars[i];
    		if(!idxfound) {
    			if(c == '.') {
    				idxfound = true;
    				res[idx++] = sb.toString();
    				sb = new StringBuilder();
    			}else {
        			sb.append(c);

    			}
    			continue;
    		}
    		
    		if(idx == colsCount - 1) {
    			res[idx] = txt.substring(i-1).trim();
    			break;
    		}
    		
    		if(c == ' ' || c == '\t') {
    			if(sb.length() == 0) {
    				continue;
    			}else {
    				tmp.append(c);    					
    			}
    		}else {
    			if(tmp.length() == 0) {
    				sb.append(c);
    			}else if(tmp.length() <= 2 && (idx == 2 || idx == 3)) {
    				sb.append(' ').append(c);
    				tmp = new StringBuilder();    					
    			} else {
    				res[idx++] = sb.toString();
    				sb = new StringBuilder();
    				tmp = new StringBuilder();
    				sb.append(c);
    			}
    		}
    	}
    	
    	return res;
    }
    
	
	public static List<Map<String, Object>> getHelp() {
		String helper = mXparser.getHelp();
		try {
			OutParameter<Boolean> flag = new OutParameter<Boolean>();
			flag.value = false;
			List<Map<String, Object>> list = new ArrayList<Map<String, Object>>(500);
			byte[] raw = helper.getBytes("UTF-8");
			ByteArrayInputStream ins = new ByteArrayInputStream(raw);
			FileUtility.readText(ins, "UTF-8", (line)->{
				String txt = line.trim();
				if(!flag.value && txt.startsWith("2.")) {
					flag.value = true;
				}
				if(!flag.value || txt.contains("<Parser Symbol>")) {
					return;
				}
				
				String[] parts = splitHelp(txt);
				Map<String, Object> map = new HashMap<String, Object>();
				map.put("idx", parts[0].trim());
				map.put("name", parts[1].trim());
				map.put("type", parts[2].trim());
				map.put("syntax", parts[3].trim());
				map.put("desc", parts[5].trim());
				list.add(map);
			});
			return list;
		}catch(Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static Tuple<String, String>[] getArgs(String vars){
		Tuple<String, String>[] varargs = new Tuple[0];
		if(!StringUtility.isNullOrEmpty(vars)) {
			String[] ary = StringUtility.splitString(vars, '\n');
			List<Tuple<String, String>> tuples = new ArrayList<Tuple<String, String>>();
			for(String var : ary) {
				String[] parts = StringUtility.splitString(var, ',');
				for(String part : parts) {
					String[] tmpvar = StringUtility.splitString(part, '=');
					Tuple<String, String> tuple = new Tuple<String, String>(tmpvar[0], tmpvar[1]);
					tuples.add(tuple);
				}
			}
			varargs = new Tuple[tuples.size()];
			tuples.toArray(varargs);
		}
		return varargs;
	}
	
	public static void main(String[] args) {
		String formula = "abs((x+y)*(a-b)) > 15";
		Tuple<String, String>[] tuples = new Tuple[] {
				new Tuple<String, String>("x", "10"),
				new Tuple<String, String>("y", "10"),
				new Tuple<String, String>("a", "30"),
				new Tuple<String, String>("b", "60")
		};
		
		double res = calculate(formula, tuples);
		System.out.println(res);
		
		formula = "[deg]";
		res = calculate(formula);
		System.out.println(res);
		
		formula = "pi/180";
		res = calculate(formula);
		System.out.println(res);
		
//		formula = "[']";
//		res = calculate(formula);
//		System.out.println(res);
//		
//		formula = "[deg]/60";
//		res = calculate(formula);
//		System.out.println(res);
		
		formula = "[rad]";
		res = calculate(formula);
		System.out.println(res);
		
		formula = "180/pi";
		res = calculate(formula);
		System.out.println(res);
		
//		formula = "prod(i, 1, 10, i^2)";
//		res = calculate(formula);
//		System.out.println(res);
//
//		
//		formula = "x+100+a+15";
//		String vars = "a=1\nx=10";
//		tuples = getArgs(vars);
//		System.out.println(JsonUtility.encodePretty(tuples));
//		res = calculate(formula, tuples);
//		System.out.println(res);
				
//		List<Map<String, Object>> list = getHelp();
//		System.out.println(JsonUtility.encodePretty(list));
	}
	
}
