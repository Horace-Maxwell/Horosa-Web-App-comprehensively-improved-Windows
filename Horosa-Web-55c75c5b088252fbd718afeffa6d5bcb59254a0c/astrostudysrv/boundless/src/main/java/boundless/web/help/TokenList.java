package boundless.web.help;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Hashtable;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;
import java.util.Random;

import boundless.utility.JsonUtility;

public class TokenList {
	private static Random random = new SecureRandom();
	
	private int timeout = 120; // 秒数
	private int maxEntryNumber = 4;
	private int tokenLength = 6;
	private boolean numeric = false;
	
	private Queue<TokenImp> list = new LinkedList<TokenImp>();
	
	public TokenList(){
		
	}

	public TokenList(int maxEntry, int timeout, int tokenLength, boolean numeric){
		this.maxEntryNumber = maxEntry;
		this.timeout = timeout;
		this.tokenLength = tokenLength;
		this.numeric = numeric;
	}
	
	public String toString(){
		return JsonUtility.encode(this);
	}
	
	public String getNextTokenId(){
		long ran = Math.abs(random.nextLong());
		StringBuffer buf = new StringBuffer();
		for(buf = new StringBuffer(numeric ? Long.toString(ran) : Long.toString(ran, 36)); buf.length() < tokenLength; buf.insert(0, '0')){
		}
		if(buf.length() > tokenLength){
			return buf.substring(0, tokenLength);
		}else{
			return buf.toString();
		}
	}
	
	public Token get(String uniqueid){
		synchronized(list){
			if(list.isEmpty()){
				return null;
			}
			for(Token token : list){
				if(token.uniqueId().equals(uniqueid)){
					long delta = System.currentTimeMillis() - token.accessDate();
					list.remove(uniqueid);
					if(delta > (long)timeout * 1000){
						throw new RuntimeException("token_timeout");
					}
					return token;
				}
			}
			return null;
		}
	}
	
	synchronized public void add(TokenImp token){
		synchronized(list){
			list.add(token);
			if(list.size() > this.maxEntryNumber){
				list.poll();
			}
		}
	}
	
	synchronized public void clear(){
		synchronized(list){
			list.clear();
		}
	}
	
}
