package spacex.basecomm.constants;

import java.util.HashSet;
import java.util.Set;

public class FuncTrans {
	public String id;
	public String name;
	public String desc;
	public String group;
	public Set<String> transcodes = new HashSet<String>();
	
	public FuncTrans(){
	}
	
	public FuncTrans(String id, String name, String desc, String group){
		this.id = id;
		this.name = name;
		this.desc = desc;
		this.group = group;
	}
	
	public FuncTrans clone(){
		FuncTrans func = new FuncTrans(this.id, this.name, this.desc, this.group);
		func.transcodes.addAll(transcodes);
		return func;
	}
	
	public FuncTrans cloneWithoutTrans(){
		FuncTrans func = new FuncTrans(this.id, this.name, this.desc, this.group);
		return func;
	}
	
	public boolean permit(String transcode){
		return transcodes.contains(transcode);
	}
	
}
