package boundless.utility;

import java.util.AbstractMap;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import boundless.model.HierarchicalMap;
import boundless.types.KeyValuePair;
import boundless.types.Tuple3;
import boundless.types.XmlNodeList;
import boundless.types.XmlNodeMap;

import com.thoughtworks.xstream.XStream;
import com.thoughtworks.xstream.converters.Converter;
import com.thoughtworks.xstream.converters.MarshallingContext;
import com.thoughtworks.xstream.converters.UnmarshallingContext;
import com.thoughtworks.xstream.io.HierarchicalStreamReader;
import com.thoughtworks.xstream.io.HierarchicalStreamWriter;

public class XmlUtility {
	
	public static Object fromXml(String xml, List<KeyValuePair<Class, String>> aliases){
		XStream xstream = new XStream();
		if(aliases != null){
			for(KeyValuePair<Class, String> kv : aliases){
				Class clazz = kv.getKey();
				String alias = kv.getValue();
				xstream.alias(alias, clazz);
			}
		}
		return xstream.fromXML(xml);
	}

	public static Object fromXml(String xml, KeyValuePair<Class, String>... aliases){
		XStream xstream = new XStream();
		if(aliases != null){
			for(KeyValuePair<Class, String> kv : aliases){
				Class clazz = kv.getKey();
				String alias = kv.getValue();
				xstream.alias(alias, clazz);
			}
		}
		return xstream.fromXML(xml);
	}

	
	public static String toXml(Object obj){
		XStream xstream = new XStream();
		return xstream.toXML(obj);
	}
	
	public static String toXml(Object obj, KeyValuePair<Class, String>... aliases){
		XStream xstream = new XStream();
		if(aliases != null && aliases.length > 0){
			for(KeyValuePair<Class, String> kv : aliases){
				Class clazz = kv.getKey();
				String alias = kv.getValue();
				xstream.alias(alias, clazz);
			}
		}
		return xstream.toXML(obj);
	}
	
	public static String toXml(Object obj, List<KeyValuePair<Class, String>> aliases){
		XStream xstream = new XStream();
		if(aliases != null){
			for(KeyValuePair<Class, String> kv : aliases){
				Class clazz = kv.getKey();
				String alias = kv.getValue();
				xstream.alias(alias, clazz);
			}
		}
		return xstream.toXML(obj);
	}
	
	public static String toXml(Object obj, List<KeyValuePair<Class, String>> aliases, 
			List<KeyValuePair<Class, String>> impcollection,
			List<Tuple3<Class, String, String>> attraliases
			){
		XStream xstream = new XStream();
		if(aliases != null){
			for(KeyValuePair<Class, String> kv : aliases){
				Class clazz = kv.getKey();
				String alias = kv.getValue();
				xstream.alias(alias, clazz);
			}
		}
		
		if(impcollection != null){
			for(KeyValuePair<Class, String> kv : impcollection){
				Class clazz = kv.getKey();
				String field = kv.getValue();
				xstream.addImplicitCollection(clazz, field);
			}
		}
		
		if(attraliases != null){
			for(Tuple3<Class, String, String> tp : attraliases){
				Class clazz = tp.item1();
				String field = tp.item2();
				String alias = tp.item3();
				xstream.aliasAttribute(clazz, field, alias);
			}
		}
		
		
		return xstream.toXML(obj);
	}
	
	private static HierarchicalMap toHierarchicalMap(Map<String, Object> map, String rootname){
		HierarchicalMap root = new HierarchicalMap();
		root.setName(rootname);
		for(Map.Entry<String, Object> entry : map.entrySet()){
			String key = entry.getKey();
			HierarchicalMap node = root.createNode(key);
			node.setName(key);
			Object obj = entry.getValue();
			if(obj instanceof Map){
				node = toHierarchicalMap((Map)obj, key);
				node.setName(key);
			}else if(obj instanceof Collection){
				HierarchicalMap subnode = node.createNode(key);
				for(Object item : (Collection)obj){
					String itemname = "item";
					HierarchicalMap itemnode = node.createNode(itemname);
					itemnode.setName(itemname);
					itemnode.setValue(item);
					node.addNode(subnode);
				}
			}else{
				node.setValue(obj);
			}

			root.addNode(node);
		}

		return root;
	}
	
	public static String toXml(Map<String, Object> map, String rootname){
		HierarchicalMap root = toHierarchicalMap(map, rootname);
		String xml = root.toXml();
		return xml;
	}
	
	public static XmlNodeMap toMap(String xmlStr, String root){
		XStream magicApi = new XStream();
		magicApi.registerConverter(new MapEntryConverter());
		magicApi.alias(root, XmlNodeMap.class);
		
		XmlNodeMap res = (XmlNodeMap) magicApi.fromXML(xmlStr);
		return res;
	}
	
	public static class MapEntryConverter implements Converter {

        public boolean canConvert(Class clazz) {
            return true;
        }

        public void marshal(Object value, HierarchicalStreamWriter writer, MarshallingContext context) {
            AbstractMap map = (AbstractMap) value;
            for (Object obj : map.entrySet()) {
                Map.Entry entry = (Map.Entry) obj;
                writer.startNode(entry.getKey().toString());
                Object val = entry.getValue();
                if ( null != val ) {
                    writer.setValue(val.toString());
                }
                writer.endNode();
            }
        }

        public Object unmarshal(HierarchicalStreamReader reader, UnmarshallingContext context) {
        	XmlNodeMap map = new XmlNodeMap();
            Set<String> subnodes = new HashSet<String>();
            
            String nodename = reader.getNodeName();
            map.setName(nodename);
            int attrcnt = reader.getAttributeCount(); 
            if(attrcnt > 0){
            	Map<String, Object> attrmap = new HashMap<String, Object>();
            	for(int i=0; i<attrcnt; i++){
            		String attr = reader.getAttributeName(i);
            		String attrval = reader.getAttribute(attr);
            		if(attrval.equalsIgnoreCase("true") || attrval.equalsIgnoreCase("false")){
            			attrmap.put(attr, ConvertUtility.getValueAsBool(attrval));
            		}else if(StringUtility.isNumeric(attrval)){
            			attrmap.put(attr, ConvertUtility.getValueAsLong(attrval));
            		}else{
                		attrmap.put(attr, attrval);
            		}
            	}
            	map.addAttributes(attrmap);
            }
            
            if(!reader.hasMoreChildren()){
            	String val = reader.getValue();
            	Object objval;
            	if(StringUtility.isNullOrEmpty(val) || val.trim().length() == 0){
            		objval = val;
            	}else if(val.equalsIgnoreCase("true") || val.equalsIgnoreCase("false")){
            		objval = ConvertUtility.getValueAsBool(val);
            	}else if(StringUtility.isNumeric(val)){
            		objval = ConvertUtility.getValueAsLong(val);
            	}else{
            		objval = val;
            	}
            	
            	map.setValue(objval);
            	return map;
            }

            while(reader.hasMoreChildren()) {
                reader.moveDown();

                String key = reader.getNodeName(); 
                
                if(subnodes.contains(key)){
                	Object obj = map.get(key);
                	XmlNodeList list;
                	if(obj instanceof XmlNodeList){
                		list = (XmlNodeList)obj;
                	}else{
                		list = new XmlNodeList();
                		list.add((XmlNodeMap)obj);
                		map.put(key, list);
                	}
                	XmlNodeMap item = (XmlNodeMap) unmarshal(reader, context);
                	list.add(item);
                }else{
                	XmlNodeMap item = (XmlNodeMap) unmarshal(reader, context);
                	map.put(key, item);
                	subnodes.add(key);
                }
                
                reader.moveUp();
            }

            return map;
        }

    }
	
}
