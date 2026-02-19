package boundless.threading;

import java.util.ArrayList;

public abstract class AbstractPlug implements IPlug{
	private ArrayList<ITicker> _tickers = new ArrayList<ITicker>();

    public abstract ITicker[] install();
    
	public ITicker[] tickers() {
		ITicker[] result=new ITicker[_tickers.size()];
        _tickers.toArray(result);
        return result;
	}
    
	protected void add(ITicker ticker){
		_tickers.add(ticker);
	}
	
	protected void addRange(ITicker[] tickers){
		for(ITicker ticker:tickers) _tickers.add(ticker);
	}
	
    public void uninstall()
    {
    }
}
