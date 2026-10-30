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

// Anthropic 思考形态族(adaptive / budget):与前端 aiAnalysisProviders.anthropicThinkingMode 共用一份对拍用例表
// (前端 jest modelGenerationParity 读同一份文件)。8 位日期段永远是日期后缀,不是小版本号。
public class AnthropicThinkingModeParityTest {

	private static Path casesFile(){
		String rel = "astrostudyui/src/utils/__tests__/fixtures/anthropicThinkingModeCases.tsv";
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
			if(raw.trim().isEmpty() || raw.startsWith("#")){
				continue;
			}
			String[] cols = raw.split("\t", -1);
			n++;
			String got = AIAnalysisProxyService.anthropicThinkingMode(cols[0]);
			if(!cols[1].trim().equals(got)){
				bad.add(cols[0] + " 期望 " + cols[1] + " 实得 " + got);
			}
			// 第 4 列:关闭形态(与前端 anthropicThinkingOffForm 同表)
			String off = AIAnalysisProxyService.anthropicThinkingOffForm(cols[0]);
			if(cols.length < 4 || !cols[3].trim().equals(off)){
				bad.add(cols[0] + " 关闭形态期望 " + (cols.length < 4 ? "(缺列)" : cols[3]) + " 实得 " + off);
			}
		}
		assertTrue("用例表应有内容", n >= 15);
		assertEquals(new ArrayList<String>(), bad);
	}
}
