package test.utility;

import boundless.utility.Script;
import boundless.utility.ScriptUtility;

public class ScriptUtilityTest {
	
	public static void main(String[] args){
		String script = "print('hello script')";
		
		try{
			ScriptUtility.put("a", 1);
			ScriptUtility.put("b", 2);
			
			ScriptUtility.eval(script);
			ScriptUtility.evalFile("d:/file/proc.js");
			
			Script eng = Script.newScript();
			eng.put("a", 2);
			eng.put("b", 3);
			eng.evalFile("d:/file/proc.js");

			ScriptUtility.evalFile("d:/file/proc.js");
		}catch(Exception e){
			e.printStackTrace();
		}
	}
	
	
}
