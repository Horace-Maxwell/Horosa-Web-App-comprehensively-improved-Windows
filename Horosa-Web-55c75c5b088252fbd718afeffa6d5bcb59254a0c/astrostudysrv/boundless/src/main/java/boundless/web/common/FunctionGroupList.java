package boundless.web.common;

import java.io.Serializable;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Set;

import boundless.model.FuncGroup;
import boundless.model.HierarchicalMap;
import boundless.model.SysFunc;
import boundless.utility.JsonUtility;

public class FunctionGroupList extends LinkedList<FuncGroup> implements Serializable {
	private static final long serialVersionUID = 2803453849142513704L;
	
	private Set<String> transcodes;
	
	public FunctionGroupList(){
		super();
		transcodes = new HashSet<String>();
	}
	
	public FunctionGroupList(String xmlFile){
		this();
		build(xmlFile);
	}
	
	public void build(String xmlFile){
		this.clear();
		HierarchicalMap map = HierarchicalMap.createHierarchicalMap(xmlFile);
		for(HierarchicalMap node : map.getNodeList("group")){
			FuncGroup fungrp = createFuncGroup(node);
			this.add(fungrp);
		}
	}
	
	private FuncGroup createFuncGroup(HierarchicalMap node){
		String id = node.getAttributeAsString("id");
		FuncGroup group = new FuncGroup(id);
		group.setName(node.getAttributeAsString("name"));
		group.setDesc(node.getAttributeAsString("desc"));
				
		for(HierarchicalMap map : node.getNodeList("function")){
			SysFunc fun = createSysFunc(map);
			fun.setGroupId(id);
			group.add(fun);	
			addTransCode(fun);
		}
		
		return group;
	}
	
	private void addTransCode(SysFunc fun){
		for(String code : fun.getTrans()){
			if(this.transcodes.contains(code)){
				throw new RuntimeException("two_transcode_have_same_id:" + code);
			}else{
				this.transcodes.add(code);
			}
		}
	}
	
	private SysFunc createSysFunc(HierarchicalMap node){
		String id = node.getAttributeAsString("id");
		SysFunc fun = new SysFunc(id);
		fun.setName(node.getAttributeAsString("name"));
		fun.setDesc(node.getAttributeAsString("desc"));
		
		for(HierarchicalMap transmap : node.getNodeList("transcode")){
			fun.addTransCode(transmap.getAttributeAsString("id"));
		}
		
		return fun;
	}
	
	public SysFunc getFunc(String funid){
		for(FuncGroup group : this){
			SysFunc fun = group.getFunc(funid);
			if(fun != null){
				return fun;
			}
		}
		return null;
	}
	
	public FuncGroup getFuncGroup(String groupid){
		for(FuncGroup group : this){
			if(group.getId().equals(groupid)){
				return group;
			}
		}
		return null;
	}
	
	public String[] getTransCodes(){
		String[] codes = new String[this.transcodes.size()];
		return this.transcodes.toArray(codes);
	}
	

	public String toString(){
		return JsonUtility.encode(this);
	}
	
	public void clear(){
		super.clear();
		this.transcodes.clear();
	}
}
