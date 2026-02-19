package boundless.types.cache;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

import com.thoughtworks.xstream.converters.Converter;
import com.thoughtworks.xstream.converters.MarshallingContext;
import com.thoughtworks.xstream.converters.UnmarshallingContext;
import com.thoughtworks.xstream.io.HierarchicalStreamReader;
import com.thoughtworks.xstream.io.HierarchicalStreamWriter;

public class CacheServersConverter implements Converter {

	@Override
	public boolean canConvert(Class type) {
		return Map.class.isAssignableFrom(type);
	}

	@Override
	public void marshal(Object source, HierarchicalStreamWriter writer, MarshallingContext context) {
		Map<String, Object> servers = (Map<String, Object>) source;
		List<String> list = (List<String>) servers.get("urls");
		String cacheName = (String) servers.get("cacheName");
		Object defvalue = servers.get("default");
		if(cacheName != null){
			writer.addAttribute("cacheName", cacheName);
		}
		if(defvalue != null){
			writer.addAttribute("default", "true");
		}
		writer.startNode("servers");
		if(list != null){
			for(String url : list){
				writer.startNode("url");
				writer.setValue(url);
				writer.endNode();
			}
		}
		writer.endNode();
	}

	@Override
	public Object unmarshal(HierarchicalStreamReader reader, UnmarshallingContext context) {
		Map<String, Object> res = new HashMap<String, Object>();
		List<String> urls = new ArrayList<String>();
		String cacheName = reader.getAttribute("cacheName");
		String defvalue = reader.getAttribute("default");
		res.put("cacheName", cacheName);
		res.put("default", ConvertUtility.getValueAsBool(defvalue, false));
		while(reader.hasMoreChildren()) {
			reader.moveDown();
			String url = reader.getValue();
			if(!StringUtility.isNullOrEmpty(url)){
				urls.add(url);
			}
			reader.moveUp();
		}
		res.put("urls", urls);
		return res;
	}

}
