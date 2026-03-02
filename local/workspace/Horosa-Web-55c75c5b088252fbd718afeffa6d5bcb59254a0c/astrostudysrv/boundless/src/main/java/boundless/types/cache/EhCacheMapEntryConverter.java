package boundless.types.cache;

import java.util.AbstractMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import com.thoughtworks.xstream.converters.Converter;
import com.thoughtworks.xstream.converters.MarshallingContext;
import com.thoughtworks.xstream.converters.UnmarshallingContext;
import com.thoughtworks.xstream.io.HierarchicalStreamReader;
import com.thoughtworks.xstream.io.HierarchicalStreamWriter;

public class EhCacheMapEntryConverter implements Converter {

	@Override
	public boolean canConvert(Class type) {
		return AbstractMap.class.isAssignableFrom(type);
	}

	@Override
	public void marshal(Object source, HierarchicalStreamWriter writer, MarshallingContext context) {
	    AbstractMap<String,Object> map = (AbstractMap<String,Object>) source;
	    for (Entry<String, Object> entry : map.entrySet()) {
	    	String key = entry.getKey().toString();
	        writer.startNode(key);
	        if(key.equalsIgnoreCase("cacheConfiguration") || key.equalsIgnoreCase("statistics")){
	        	context.convertAnother(entry.getValue(), this);
	        }else{
	        	writer.setValue(entry.getValue().toString());
	        }
	        writer.endNode();
	    }	
	}

	@Override
	public Object unmarshal(HierarchicalStreamReader reader, UnmarshallingContext context) {
		Map<String, Object> map = new HashMap<String, Object>();

	    while(reader.hasMoreChildren()) {
	        reader.moveDown();
	        String key = reader.getNodeName();
	        if(key.equalsIgnoreCase("cacheConfiguration") || key.equalsIgnoreCase("statistics")){
	        	Map<String, Object> innermap = (Map<String, Object>) context.convertAnother(reader, HashMap.class, this);
	        	map.put(key, innermap);
	        }else{
		        map.put(key, reader.getValue());
	        }
	        reader.moveUp();
	    }
	    return map;
	}

}
