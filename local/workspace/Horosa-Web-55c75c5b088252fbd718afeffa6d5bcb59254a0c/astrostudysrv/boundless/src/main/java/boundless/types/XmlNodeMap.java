package boundless.types;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import boundless.exception.UnimplementedException;
import boundless.utility.JsonUtility;
import boundless.utility.StringUtility;

public class XmlNodeMap implements XmlNode, Jsonable{
	private static final long serialVersionUID = -6825093033053564504L;
	
	private Map<String, Object> attributes = new HashMap<String, Object>();
	private Map<String, XmlNode> nodes = new HashMap<String, XmlNode>();
	private Object value;
	private String name;
	
	public void setAttribute(String key, Object value){
		this.attributes.put(key, value);
	}
	
	public Object getAttribute(String key){
		return this.attributes.get(key);
	}
	
	public void addAttributes(Map<String, Object> map){
		this.attributes.putAll(map);
	}
	
	public void removeAttribute(String key){
		this.attributes.remove(key);
	}
	
	public Map.Entry<String, Object>[] getAttributes(){
		Set<Map.Entry<String, Object>> entries = this.attributes.entrySet();
		Map.Entry<String, Object>[] ary = new Map.Entry[entries.size()];
		return entries.toArray(ary);
	}
	
	public void put(String key, XmlNode map){
		this.nodes.put(key, map);
	}
	
	public XmlNode get(String key){
		return this.nodes.get(key);
	}
	
	public void setValue(Object obj){
		this.value = obj;
	}
	
	public Object getValue(){
		return this.value;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String toString(){
		return JsonUtility.encode(this);
	}
	
	public String toJson(){
		return JsonUtility.encode(this);
	}
	
	public Map<String, Object> toMap(){
		Object obj = toMapOrList();
		if(obj instanceof Map){
			return (Map<String, Object>) obj;
		}
		throw new RuntimeException("node cannot be a map");
	}

	@Override
	public Object toMapOrList() {
		Map<String, Object> map = new HashMap<String, Object>();
		
		if(!this.attributes.isEmpty()){
			map.put("XmlNodeAttributes", this.attributes);
		}
		if(this.nodes.isEmpty()){
			if(map.isEmpty()){
				return this.value;
			}else{
				map.put(this.name, this.value);
				return map;
			}
		}
		
		for(Map.Entry<String, XmlNode> entry : this.nodes.entrySet()){
			String key = entry.getKey();
			XmlNode val = entry.getValue();
			if(val instanceof XmlNodeList){
				XmlNodeList list = (XmlNodeList) val;
				map.put(key, list.toMapOrList());
			}else if(val instanceof XmlNodeMap){
				XmlNodeMap tmp = (XmlNodeMap) val;
				Object obj = tmp.toMapOrList();
				map.put(key, obj);
			}else{
				map.put(key, val);
			}
		}
		
		if(!StringUtility.isNullOrEmpty(this.value)){
			map.put("XmlNodeName", this.name);
			map.put("XmlNodeValue", this.value);
		}

		return map;
	}

	@Override
	public void fromMapOrList(Object jsonobj) {
		throw new UnimplementedException();
	}
}
