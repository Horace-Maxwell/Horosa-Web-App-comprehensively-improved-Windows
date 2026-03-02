package spacex.basecomm.constants;

import java.util.ArrayList;
import java.util.List;

public class TransGroup extends FuncTrans{
	public List<FuncTrans> functions = new ArrayList<FuncTrans>();
	
	public TransGroup(){
	}
	
	public TransGroup(String id, String name, String desc, String group) {
		super(id, name, desc, group);
	}
	
	public TransGroup clone(){
		TransGroup group = new TransGroup(this.id, this.name, this.desc, this.group);
		for(FuncTrans func : functions){
			FuncTrans fun = func.clone();
			group.functions.add(fun);
		}
		return group;
	}

	public TransGroup cloneWithoutTrans(){
		TransGroup group = new TransGroup(this.id, this.name, this.desc, this.group);
		for(FuncTrans func : functions){
			FuncTrans fun = func.cloneWithoutTrans();
			group.functions.add(fun);
		}
		return group;
	}

	public boolean permit(String transcode){
		for(FuncTrans func : functions){
			if(func.permit(transcode)){
				return true;
			}
		}
		return false;
	}
	
	public boolean permitFunc(String funid){
		for(FuncTrans func : functions){
			if(func.id.equals(funid)){
				return true;
			}
		}
		return false;
	}
}
