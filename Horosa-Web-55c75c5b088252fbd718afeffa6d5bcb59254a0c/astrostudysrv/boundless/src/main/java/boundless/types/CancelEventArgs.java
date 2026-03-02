package boundless.types;

public class CancelEventArgs extends EventArgs {
	
	private boolean _cancel;

	public CancelEventArgs() {
		_cancel = false;
	}
	
	public CancelEventArgs(boolean cancel){
		_cancel = cancel;
	}
	
	public boolean isCanceled(){
		return _cancel;
	}
	
	public void setCancel(boolean cancel){
		_cancel = cancel;
	}

}
