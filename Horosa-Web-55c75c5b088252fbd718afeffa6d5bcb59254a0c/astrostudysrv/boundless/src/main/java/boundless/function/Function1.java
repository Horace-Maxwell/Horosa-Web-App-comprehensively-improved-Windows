package boundless.function;

@FunctionalInterface
public interface Function1<T_Args,T_Return> {
	T_Return apply(T_Args args);
}
