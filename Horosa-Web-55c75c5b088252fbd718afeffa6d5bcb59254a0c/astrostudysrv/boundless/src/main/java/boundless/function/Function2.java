package boundless.function;

import java.io.Serializable;

@FunctionalInterface
public interface Function2<T_Args1,T_Args2,T_Return> extends Serializable {
	T_Return apply(T_Args1 args1,T_Args2 args2);
}
