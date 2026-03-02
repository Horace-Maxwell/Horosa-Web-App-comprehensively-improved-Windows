package spacex.basecomm.im;

import java.util.List;
import java.util.Map;

import boundless.exception.UnimplementedException;

public interface ThirdPartIM {
	public IMAccount createId();
	public String updateId(String accid);
	public void sendMsg(String from, String to, String txt);
	public void sendTeamMsg(String from, String to, String txt);
	
	default public String createTeam(String ownerAccid, List<String> memberAccid, String teamName, String inviteMsg) { throw new UnimplementedException("unimplemented"); }
	default public void dismissTeam(String ownerAccid, String teamid) { throw new UnimplementedException("unimplemented"); }
	default public void inviteToTeam(String ownerAccid, String teamid, List<String> memberAccid, String inviteMsg) { throw new UnimplementedException("unimplemented"); }
	default public void kickFromTeam(String ownerAccid, String teamid, List<String> memberAccid) { throw new UnimplementedException("unimplemented"); }
	default public List<Map<String, Object>> listTeamMembers(String teamid, long tm, int limit){ throw new UnimplementedException("unimplemented"); }
	default public List<Map<String, Object>> listJoinTeams(String accid){ throw new UnimplementedException("unimplemented"); }
}
