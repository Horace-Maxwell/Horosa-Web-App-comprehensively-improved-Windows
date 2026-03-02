package boundless.types.cache;

import org.bson.conversions.Bson;

import com.mongodb.client.model.Filters;

public class SortCond {
	public static enum SortType{
		Asc, Desc
	}
	
	public String field;
	public SortType sort;
	
	private SortCond[] others = new SortCond[0];
	
	public SortCond(String fld, SortType st){
		this.field = fld;
		this.sort = st;
	}
	
	public void and(SortCond... others) {
		this.others = new SortCond[others.length];
		
		for(int i=0; i<others.length; i++) {
			this.others[i] = others[i];
		}
		return;
	}
	
	public Bson toBson(){
		Bson res = Filters.eq(field, 1);
		switch(this.sort){
		case Asc:
			res = Filters.eq(field, 1);
			break;
		case Desc:
			res = Filters.eq(field, -1);
			break;
		}
		
		Bson[] bson = new Bson[others.length + 1];
		bson[0] = res;
		for(int i=0; i<others.length; i++) {
			bson[i+1] = others[i].toBson();
		}
		return Filters.and(bson);
	}
}
