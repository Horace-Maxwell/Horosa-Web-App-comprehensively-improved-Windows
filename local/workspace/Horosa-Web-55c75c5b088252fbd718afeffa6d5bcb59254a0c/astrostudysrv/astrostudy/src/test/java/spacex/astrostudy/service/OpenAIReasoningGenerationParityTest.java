package spacex.astrostudy.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import org.junit.Test;

// OpenAI 推理代际判定:按代际数字比较(gpt 主版本 ≥5、o 系 ≥1),新一代上线即认。
// 与前端 aiAnalysisProviders.isOpenAIReasoningModel 共用一份对拍用例表(前端 jest modelGenerationParity 读同一份文件),
// 两边口径漂开即一边红。
public class OpenAIReasoningGenerationParityTest {

	private static Path casesFile(){
		String rel = "astrostudyui/src/utils/__tests__/fixtures/openaiReasoningGenerationCases.tsv";
		Path dir = Paths.get("").toAbsolutePath();
		for(int i = 0; i < 5 && dir != null; i++){
			Path p = dir.resolve(rel);
			if(Files.isRegularFile(p)){
				return p;
			}
			dir = dir.getParent();
		}
		throw new IllegalStateException("找不到对拍用例表 " + rel);
	}

	@Test
	public void sharedCasesMatch() throws Exception {
		List<String> lines = Files.readAllLines(casesFile(), StandardCharsets.UTF_8);
		List<String> bad = new ArrayList<String>();
		int n = 0;
		for(String raw : lines){
			String line = raw.trim();
			if(line.isEmpty() || line.startsWith("#")){
				continue;
			}
			String[] cols = line.split("\t");
			boolean want = "true".equals(cols[1].trim());
			n++;
			if(AIAnalysisProxyService.isOpenAIReasoningModel(cols[0]) != want){
				bad.add(cols[0] + " 期望 " + want);
			}
			if(want && !AIAnalysisProxyService.isReasoningModel(cols[0])){
				bad.add(cols[0] + " 应同时是推理模型");
			}
		}
		assertTrue("用例表应有内容", n > 20);
		assertEquals(new ArrayList<String>(), bad);
	}
}
