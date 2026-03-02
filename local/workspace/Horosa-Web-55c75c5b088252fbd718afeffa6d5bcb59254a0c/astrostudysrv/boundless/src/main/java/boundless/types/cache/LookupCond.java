package boundless.types.cache;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.bson.Document;
import org.bson.conversions.Bson;

import com.mongodb.client.model.Aggregates;
import com.mongodb.client.model.Variable;

public class LookupCond {
	
	public static Bson getMatch(List<FilterCond> conds) {
		List<Bson> filist = new ArrayList<Bson>();
		for(FilterCond cond : conds) {
			if(cond != null) {
				filist.add(cond.toBsonForAggr());
			}
		}
		Document exprDoc = new Document("$expr", new Document("$and", filist));
		Document matchDoc = new Document("$match", exprDoc);
		
		return matchDoc;		
	}
	
	public String table;
	public Map<String, String> letVar;
	public String asField;
	public FilterCond[] matches;

	public LookupCond(String table, String asField, Map<String, String> letVar, FilterCond[] matches){
		this.table = table;
		this.letVar = letVar;
		this.asField = asField;
		this.matches = matches;
	}
	
	public Bson genLookup() {
		List<Variable<String>> vars = null;
		if(this.letVar != null) {
			vars = new ArrayList<Variable<String>>();
			for(Map.Entry<String, String> entry : letVar.entrySet()) {
				Variable<String> var = new Variable<String>(entry.getKey(), entry.getValue());
				vars.add(var);
			}			
		}
		
		List<Bson> filist = genMatches();
		
		return Aggregates.lookup(table, vars, filist, asField);
	}
	
	private List<Bson> genMatches(){
		List<Bson> filist = new ArrayList<Bson>();
		for(FilterCond cond : matches) {
			if(cond != null) {
				if(cond instanceof FilterOrCond || cond instanceof FilterAndCond) {
					List<Bson> bsons = cond.toBsonListForAggr("$");
					filist.addAll(bsons);
				}else {
					cond.setField("$" + cond.getField());
					filist.add(cond.toBsonForAggr());					
				}
			}
		}

		Document exprDoc = new Document("$expr", new Document("$and", filist));
		Document matchDoc = new Document("$match", exprDoc);
		
		return Arrays.asList(matchDoc);
	}
	

}
