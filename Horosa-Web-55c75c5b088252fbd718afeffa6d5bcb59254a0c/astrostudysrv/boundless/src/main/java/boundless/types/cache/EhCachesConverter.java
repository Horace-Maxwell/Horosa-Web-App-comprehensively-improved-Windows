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

public class EhCachesConverter implements Converter {

	@Override
	public boolean canConvert(Class type) {
		return List.class.isAssignableFrom(type);
	}

	@Override
	public void marshal(Object source, HierarchicalStreamWriter writer, MarshallingContext context) {
		List<Map<String, Object>> list = (List<Map<String, Object>>) source;
		EhCacheMapEntryConverter converter = new EhCacheMapEntryConverter();
		writer.startNode("caches");
		for(Map<String, Object> map : list){
			writer.startNode("cache");
			context.convertAnother(map, converter);
			writer.endNode();
		}
		writer.endNode();
	}

	@Override
	public Object unmarshal(HierarchicalStreamReader reader, UnmarshallingContext context) {
		List<Map<String, Object>> list = new ArrayList<Map<String, Object>>();
		Converter mapconverter = new EhCacheMapEntryConverter();
		
	    while(reader.hasMoreChildren()) {
	        reader.moveDown();
	        Map<String, Object> map = (Map<String, Object>) context.convertAnother(reader, HashMap.class, mapconverter);
	        list.add(map);
	        reader.moveUp();
	    }
	    return list;
	}

}
