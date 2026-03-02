package boundless.types.cache;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.thoughtworks.xstream.converters.Converter;
import com.thoughtworks.xstream.converters.MarshallingContext;
import com.thoughtworks.xstream.converters.UnmarshallingContext;
import com.thoughtworks.xstream.io.HierarchicalStreamReader;
import com.thoughtworks.xstream.io.HierarchicalStreamWriter;

public class CachesConverter implements Converter {

	@Override
	public boolean canConvert(Class type) {
		return Map.class.isAssignableFrom(type);
	}

	@Override
	public void marshal(Object source, HierarchicalStreamWriter writer, MarshallingContext context) {
		Map<String, Object> res = (Map<String, Object>) source;
		Converter cacheconverter = new CacheMapEntryConverter();
		Converter serverconverter = new CacheServersConverter();
		Map<String, Object> servers = (Map<String, Object>) res.get("servers");
		List<Map<String, Object>> caches = (List<Map<String, Object>>) res.get("caches");
		
		writer.startNode("caches");
		context.convertAnother(servers, serverconverter);
		context.convertAnother(caches, cacheconverter);
		writer.endNode();
	}

	@Override
	public Object unmarshal(HierarchicalStreamReader reader, UnmarshallingContext context) {
		Map<String, Object> res = new HashMap<String, Object>();
		List<Map<String, Object>> list = new ArrayList<Map<String, Object>>();
		Converter cacheconverter = new CacheMapEntryConverter();
		Converter serverconverter = new CacheServersConverter();
		
	    while(reader.hasMoreChildren()) {
	        reader.moveDown();
	        String key = reader.getNodeName();
	        Object obj = null;
	        if(key.equalsIgnoreCase("servers")){
	        	Map<String, Object> servers = (Map<String, Object>) context.convertAnother(reader, HashMap.class, serverconverter);
	        	res.put("servers", servers);
	        }else if(key.equalsIgnoreCase("cache")){
	        	Map<String, Object> cache = (Map<String, Object>) context.convertAnother(reader, HashMap.class, cacheconverter);
		        list.add(cache);
	        }
	        reader.moveUp();
	    }
	    res.put("caches", list);
	    return res;
	}

}
