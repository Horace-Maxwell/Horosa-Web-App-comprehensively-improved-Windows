package boundless.utility;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.Charset;

import javax.script.Invocable;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;

public class Script {
	private static ScriptEngineManager _manager = new ScriptEngineManager();

	private ScriptEngine _engine;
	
	private Script(ScriptEngine engine){
		_engine = engine;
	}
	
	public static Script newScript(){
		ScriptEngine engine = _manager.getEngineByName("nashorn");
		return new Script(engine);
	}
	
	public Object eval(String js){
		try {
			return _engine.eval(js);
		} catch (ScriptException e) {
			throw new RuntimeException(e);
		}
	}
	
	public Object eval(Reader reader){
		try {
			return _engine.eval(reader);
		} catch (ScriptException e) {
			throw new RuntimeException(e);
		}
	}
	
	public Object evalFile(String filepath){
		try{
			InputStream ins = new FileInputStream(filepath);
			InputStreamReader inreader = new InputStreamReader(ins, Charset.forName("UTF-8"));
			BufferedReader reader = new BufferedReader(inreader);
			return eval(reader);
		}catch(Exception e){
			throw new RuntimeException(e);
		}

	}
	
	
	public void put(String key, Object value){
		_engine.put(key, value);
	}
	
	public Object get(String key){
		return _engine.get(key);
	}
	
	public Object invoke(String jsfun, Object... args){
		Invocable inv = (Invocable) _engine;
		try {
			return inv.invokeFunction(jsfun, args);
		} catch (Exception e) {
			throw new RuntimeException(e);
		} 
	}
	
	public Object invokeMethod(Object obj, String jsfun, Object... args){
		Invocable inv = (Invocable) _engine;
		try {
			return inv.invokeMethod(obj, jsfun, args);
		} catch (Exception e) {
			throw new RuntimeException(e);
		} 
	}
	
}
