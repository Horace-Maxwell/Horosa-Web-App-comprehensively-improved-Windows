package boundless.function;


public class Consumer0Delegate extends Delegate<Consumer0> {
	private static final long serialVersionUID = -5729340586693545828L;

	public void execute(){
		for(Consumer0 consumer : toArray()){
			if(consumer != null){
				consumer.accept();
			}
		}
	}

	@Override
	protected Consumer0[] newArray(int length) {
		return new Consumer0[length];
	}


}
