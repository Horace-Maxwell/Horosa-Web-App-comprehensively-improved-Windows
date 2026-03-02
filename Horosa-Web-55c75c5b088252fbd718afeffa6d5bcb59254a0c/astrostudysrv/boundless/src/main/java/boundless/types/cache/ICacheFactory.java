package boundless.types.cache;

import boundless.exception.UnimplementedException;
import boundless.types.ICache;

public interface ICacheFactory {
	public void build(String proppath);
	public ICache getCache();
	public void close();
	default public Boolean needMemCache(){ return null; }
	default public Boolean needCompress(){ return null; }
	default public Boolean needHystrix(){ return null; }
	default public void reconnect(){}
	default public String factoryName(){ return this.toString(); }
	default public void factoryName(String name){}
	
	default public ICacheFactory spawnFactory(String dataSetName){ return this; }
}
