package boundless.types;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import boundless.exception.UnimplementedException;
import boundless.utility.JsonUtility;

public class XmlNodeList implements XmlNode, Jsonable{
	private static final long serialVersionUID = 8252528765005017967L;

	private List<XmlNodeMap> list = new LinkedList<XmlNodeMap>();
	
	public void add(XmlNodeMap map){
		this.list.add(map);
	}
	
	public int size(){
		return this.size();
	}
	
	public XmlNodeMap[] toArray(){
		XmlNodeMap[] ary = new XmlNodeMap[this.list.size()];
		return this.list.toArray(ary);
	}
	
	public String toString(){
		return JsonUtility.encode(this.list);
	}

	public String toJson(){
		return JsonUtility.encode(this.list);
	}

	@Override
	public Object toMapOrList() {
		List<Object> reslist = new LinkedList<Object>();
		for(XmlNodeMap map : this.list){
			reslist.add(map.toMapOrList());
		}
		return reslist;
	}

	@Override
	public void fromMapOrList(Object jsonobj) {
		throw new UnimplementedException();
	}

}
