package boundless.types.cache;

import org.bson.conversions.Bson;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.bson.Document;

import com.mongodb.client.model.Filters;

public class FilterOrCond extends FilterCond {
	private FilterCond[] conds;

	public FilterOrCond(FilterCond...conds){
		this.conds = conds;
	}
	
	public Bson toBson(){
		Bson[] bsons = new Bson[this.conds.length];
		for(int i=0; i<bsons.length; i++) {
			bsons[i] = this.conds[i].toBson();
		}
		return Filters.or(bsons);
	}
	
	public List<Bson> toBsonListForAggr(String prefix) {
		String s = prefix;
		if(s == null) {
			s = "";
		}
		List<Bson> docs = new ArrayList<Bson>();
		for(int i=0; i<this.conds.length; i++) {
			FilterCond cond = this.conds[i];
			Document doc = new Document("$or", Arrays.asList(s + cond.getField(), cond.getValue()));
			docs.add(doc);
		}
		return docs;
	}
	
}
