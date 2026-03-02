package boundless.model;

import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;

import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class SysFunc implements Serializable {
	private static final long serialVersionUID = 8970496010199236968L;
	
	private String id;
	private String name;
	private String desc;
	private String groupId;
	private Set<String> trans;
	
	public SysFunc(String id){
		trans = new HashSet<String>();
		if(StringUtility.isNullOrEmpty(id)){
			throw new RuntimeException("sysfunc_id_is_null");
		}
		this.id = id;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getGroupId() {
		return groupId;
	}

	public void setGroupId(String groupId) {
		this.groupId = groupId;
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
	
	public void addTransCode(String transcode){
		if(this.trans.contains(transcode)){
			throw new RuntimeException("two_transcode_have_same_id:" + transcode);
		}
		this.trans.add(transcode);
	}
	
	public boolean contains(String transcode){
		return this.trans.contains(transcode);
	}
	
	public String[] getTrans(){
		String[] codes = new String[this.trans.size()];
		return this.trans.toArray(codes);
	}
		
	public boolean permit(String transcode){
		return contains(transcode);
	}
	
	public String toString(){
		return JsonUtility.encode(this);
	}

	@Override
	public boolean equals(Object obj) {
		SysFunc fun = (SysFunc)obj;
		return fun.getId().equals(this.getId());
	}
	
	
}
