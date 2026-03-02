package boundless.utility;

import java.io.Reader;

public class ScriptUtility {
	private static Script _script = Script.newScript();
		
	public static Object eval(String js){
		return _script.eval(js);
	}
	
	public static Object eval(Reader reader){
		return _script.eval(reader);
	}
	
	public static Object evalFile(String filepath){
		return _script.evalFile(filepath);
	}
	
	
	public static void put(String key, Object value){
		_script.put(key, value);
	}
	
	public static Object get(String key){
		return _script.get(key);
	}
	
	public static Object invoke(String jsfun, Object... args){
		return _script.invoke(jsfun, args);
	}
	
	public static Object invokeMethod(Object obj, String jsfun, Object... args){
		return _script.invokeMethod(obj, jsfun, args);
	}
}
