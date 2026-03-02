package boundless.function;

import java.io.Serializable;

@FunctionalInterface
public interface Consumer2<T1, T2> extends Serializable {
	public void accept(T1 t1, T2 t2);
}
