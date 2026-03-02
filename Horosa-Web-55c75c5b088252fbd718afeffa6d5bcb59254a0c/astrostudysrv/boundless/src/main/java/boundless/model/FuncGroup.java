package boundless.model;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class FuncGroup implements Serializable {
	private static final long serialVersionUID = -3181941780334928026L;
	
	private String id;
	private String name;
	private String desc;
	private Map<String, SysFunc> fungroup;
	
	public FuncGroup(String id){
		fungroup = new HashMap<String, SysFunc>();
		if(StringUtility.isNullOrEmpty(id)){
			throw new RuntimeException("func_group_id_is_null");
		}
		this.id = id;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
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
	
	public void add(SysFunc fun){
		if(this.fungroup.containsKey(fun.getId())){
			throw new RuntimeException("two_function_have_same_id:" + fun.getId());
		}
		this.fungroup.put(fun.getId(), fun);
	}
	
	public SysFunc[] getFuns(){
		SysFunc[] res = new SysFunc[this.fungroup.size()];
		int i = 0;
		for(Map.Entry<String, SysFunc> entry : this.fungroup.entrySet()){
			res[i++] = entry.getValue();
		}
		return res;
	}
	
	public void remove(String funid){
		this.fungroup.remove(funid);
	}
	
	public SysFunc getFunc(String funid){
		return this.fungroup.get(funid);
	}

	public String toString(){
		return JsonUtility.encode(this);
	}
}
