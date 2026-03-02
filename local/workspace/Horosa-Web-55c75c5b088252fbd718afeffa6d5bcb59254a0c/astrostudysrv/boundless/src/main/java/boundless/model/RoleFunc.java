package boundless.model;

import java.io.Serializable;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class RoleFunc implements Serializable {
	private static final long serialVersionUID = 3842499075223577198L;
	
	private int id; 
	private String name;
	private String desc;
	private Set<SysFunc> functions;
	private Set<String> transcodes;
	
	public RoleFunc(){
		this.functions = new HashSet<SysFunc>();
		this.transcodes = new HashSet<String>();
	}

	public int getId() {
		return id;
	}

	public void setId(int id) {
		this.id = id;
	}
	
	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getDesc() {
		return desc;
	}

	public void setDesc(String desc) {
		this.desc = desc;
	}

	public void addFunc(SysFunc func){
		if(this.functions.contains(func)){
			throw new RuntimeException("two_function_have_same_id:" + func.getId());
		}
		this.functions.add(func);
		
		for(String trans : func.getTrans()){
			if(this.transcodes.contains(trans)){
				throw new RuntimeException("two_transcode_have_same_id:" + trans);
			}
			this.transcodes.add(trans);
		}
	}
	
	public SysFunc[] getFunctions(){
		SysFunc[] funs = new SysFunc[this.functions.size()];
		
		return this.functions.toArray(funs);
	}

	public String[] getTrans(){
		String[] codes = new String[this.transcodes.size()];
		return this.transcodes.toArray(codes);
	}

	public boolean permit(String transcode){
		return this.transcodes.contains(transcode);
	}
	
	public void clear(){
		this.functions.clear();
		this.transcodes.clear();
	}
}
