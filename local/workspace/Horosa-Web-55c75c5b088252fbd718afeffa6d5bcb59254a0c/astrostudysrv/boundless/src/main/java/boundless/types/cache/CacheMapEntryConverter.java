package boundless.types.cache;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.utility.ConvertUtility;

import com.thoughtworks.xstream.converters.Converter;
import com.thoughtworks.xstream.converters.MarshallingContext;
import com.thoughtworks.xstream.converters.UnmarshallingContext;
import com.thoughtworks.xstream.io.HierarchicalStreamReader;
import com.thoughtworks.xstream.io.HierarchicalStreamWriter;

public class CacheMapEntryConverter implements Converter {

	@Override
	public boolean canConvert(Class type) {
		return Map.class.isAssignableFrom(type);
	}

	@Override
	public void marshal(Object source, HierarchicalStreamWriter writer, MarshallingContext context) {
		Map<String, Object> cache = (Map<String, Object>) source;
		Converter converter = new CacheServersConverter();
		Map<String, Object> servers = (Map<String, Object>) cache.get("servers");
		String name = (String) cache.get("name");
		writer.addAttribute("name", name);
		writer.startNode("cache");
		context.convertAnother(servers, converter);
		writer.endNode();
	}

	@Override
	public Object unmarshal(HierarchicalStreamReader reader, UnmarshallingContext context) {
		Map<String, Object> map = new HashMap<String, Object>();
		CacheServersConverter converter = new CacheServersConverter();
		String cacheName = reader.getAttribute("name");
		map.put("name", cacheName);
	    while(reader.hasMoreChildren()) {
	        reader.moveDown();
	        String key = reader.getNodeName();
	        if(key.equalsIgnoreCase("servers")){
	        	Map<String, Object> servers = (Map<String, Object>) context.convertAnother(reader, Map.class, converter);
	        	map.put("servers", servers);
	        }
	        reader.moveUp();
	    }
	    if(!map.containsKey("servers")){
	    	Map<String, Object> serv = new HashMap<String, Object>();
	    	serv.put("default", false);
	    	serv.put("urls", new ArrayList<String>());
	    	map.put("servers", serv);
	    }
	    return map;
	}

}
