import * as fs from 'fs';
import * as path from 'path';
import { analyzeWithGPT, extractConfidenceScore } from '../index.ts';
import { TestCache } from './cache-helper.ts';

async function analyzeFiles() {
  // Get API key from environment and validate it
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  // Initialize cache
  const cache = new TestCache();

  // Helper function to read file content
  const readFileContent = (filePath: string): string => {
    return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
  };

  // Helper function to get all files in a directory
  const getFilesInDir = (dirPath: string): string[] => {
    return fs.readdirSync(path.join(process.cwd(), dirPath))
      .map(file => path.join(dirPath, file));
  };

  // Helper function to get analysis (from cache or API)
  async function getAnalysis(content: string, metadata: Record<string, any>): Promise<string> {
    const cacheKey = JSON.stringify({ content, metadata });
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse) {
      console.log('(Using cached response)');
      return cachedResponse;
    }

    const response = await analyzeWithGPT(apiKey, metadata);
    cache.set(cacheKey, response);
    return response;
  }

  // Analysis results storage
  const aiScores: number[] = [];
  const humanScores: number[] = [];

  // Analyze AI-generated content
  console.log('\n=== Analyzing AI-Generated Files ===\n');
  const aiFiles = getFilesInDir('tests/ai');
  
  for (const filePath of aiFiles) {
    const content = readFileContent(filePath);
    const metadata = {
      title: 'Test PR',
      description: 'Test Description',
      changes: [{
        filename: filePath,
        additions: content
      }]
    };

    const response = await getAnalysis(content, metadata);
    const confidenceScore = await extractConfidenceScore(response);
    aiScores.push(confidenceScore);

    console.log(`\n=== Analysis for AI file: ${path.basename(filePath)} ===`);
    console.log(response);
    console.log(`Confidence Score: ${confidenceScore}%`);
    console.log('=====================================\n');
  }

  // Analyze human-written content
  console.log('\n=== Analyzing Human-Written Files ===\n');
  const humanFiles = getFilesInDir('tests/human');
  
  for (const filePath of humanFiles) {
    const content = readFileContent(filePath);
    const metadata = {
      title: 'Test PR',
      description: 'Test Description',
      changes: [{
        filename: filePath,
        additions: content
      }]
    };

    const response = await getAnalysis(content, metadata);
    const confidenceScore = await extractConfidenceScore(response);
    humanScores.push(confidenceScore);

    console.log(`\n=== Analysis for human file: ${path.basename(filePath)} ===`);
    console.log(response);
    console.log(`Confidence Score: ${confidenceScore}%`);
    console.log('=====================================\n');
  }

  // Calculate and display summary statistics
  const avgAiScore = aiScores.reduce((a, b) => a + b, 0) / aiScores.length;
  const avgHumanScore = humanScores.reduce((a, b) => a + b, 0) / humanScores.length;

  console.log('\n=== SUMMARY STATISTICS ===');
  console.log(`Number of AI files analyzed: ${aiScores.length}`);
  console.log(`Number of human files analyzed: ${humanScores.length}`);
  console.log(`Average confidence score for AI files: ${avgAiScore.toFixed(2)}%`);
  console.log(`Average confidence score for human files: ${avgHumanScore.toFixed(2)}%`);
  console.log(`Detection gap (AI - Human): ${(avgAiScore - avgHumanScore).toFixed(2)}%`);
  console.log('=========================\n');
}

// Run the analysis
analyzeFiles().catch(console.error); 