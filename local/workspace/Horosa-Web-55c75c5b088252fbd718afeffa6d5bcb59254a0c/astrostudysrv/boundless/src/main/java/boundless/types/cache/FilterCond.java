package boundless.types.cache;

import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;
import java.util.regex.Pattern;

import org.bson.Document;
import org.bson.conversions.Bson;

import com.mongodb.client.model.Filters;

import boundless.utility.ConvertUtility;

public class FilterCond {
	public static enum CondOperator{
		Eq,
		Ne,
		Lt,
		Lte,
		Gt,
		Gte,
		In,
		Like,
		Exists
	}
	
	public static enum MixOperator{
		And,
		Or
	}
	
	private String field;
	private Object value;
	private CondOperator operator;
	
	private FilterCond[] otherCond;
	private MixOperator mixOp;
	
	protected FilterCond(){
		
	}
	
	public FilterCond(String fld, CondOperator op, Object val){
		this.field = fld;
		this.operator = op;
		this.value = val;
	}
	
	public String getField() {
		return field;
	}
	
	public Object getValue() {
		return value;
	}
	
	public void setField(String field) {
		this.field = field;
	}
	
	public void setValue(Object val) {
		this.value = val;
	}
	
	public void set(String field, String value) {
		this.field = field;
		this.value = value;
	}
	
	public String getOp() {
		switch(this.operator){
		case Eq:
			return "$eq";
		case Ne:
			return "$ne";
		case Lt:
			return "$lt";
		case Lte:
			return "$lte";
		case Gt:
			return "$gt";
		case Gte:
			return "$gte";
		case In:
			return "$in";
		case Like:
			return "$regex";
		case Exists:
			return "$exists";
		}
		return "$eq";
	}
	
	public void mix(FilterCond[] cond, MixOperator op){
		this.otherCond = cond;
		this.mixOp = op;
	}
	
	public Bson toBson(){
		Bson res = Filters.eq(field, value);
		switch(this.operator){
		case Eq:
			res = Filters.eq(field, value);
			break;
		case Ne:
			res = Filters.ne(field, value);
			break;
		case Lt:
			res = Filters.lt(field, value);
			break;
		case Lte:
			res = Filters.lte(field, value);
			break;
		case Gt:
			res = Filters.gt(field, value);
			break;
		case Gte:
			res = Filters.gte(field, value);
			break;
		case In:
			res = Filters.in(field, value);
			break;
		case Like:
			if(value instanceof String) {
				res = Filters.regex(field, (String)value);				
			}else if(value instanceof Pattern) {
				res = Filters.regex(field, (Pattern)value);				
			}
			break;
		case Exists:
			res = Filters.exists(field, ConvertUtility.getValueAsBool(value));
			break;
		}
		
		if(this.otherCond != null && this.otherCond.length > 0){
			for(FilterCond cond : this.otherCond){
				if(this.mixOp == MixOperator.And){
					res = Filters.and(res, cond.toBson());
				}else if(this.mixOp == MixOperator.Or){
					res = Filters.or(res, cond.toBson());
				}				
			}
		}
		
		return res;
	}
	
	public Bson toBsonForAggr() {
		Bson res = new Document("$eq", Arrays.asList(field, value));
		switch(this.operator){
		case Eq:
			res = new Document("$eq", Arrays.asList(field, value));
			break;
		case Ne:
			res = new Document("$ne", Arrays.asList(field, value));
			break;
		case Lt:
			res = new Document("$lt", Arrays.asList(field, value));
			break;
		case Lte:
			res = new Document("$lte", Arrays.asList(field, value));
			break;
		case Gt:
			res = new Document("$gt", Arrays.asList(field, value));
			break;
		case Gte:
			res = new Document("$gte", Arrays.asList(field, value));
			break;
		case In:
			res = new Document("$in", Arrays.asList(field, value));
			break;
		case Like:
			res = new Document("$regex", Arrays.asList(field, value));	
			break;
		case Exists:
			res = new Document("$exists", Arrays.asList(field, value));
			break;
		}
		
		return res;
	}
	
	public List<Bson> toBsonListForAggr(String prefix){
		return new LinkedList<Bson>();
	}
	
}
