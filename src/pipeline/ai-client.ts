/**
 * AI 客户端封装
 * 统一多个 AI 提供商的调用接口
 *
 * 支持：
 * - OpenAI (gpt-4o, gpt-4o-mini, etc.)
 * - Anthropic (claude-sonnet, claude-haiku, etc.)
 * - DeepSeek (deepseek-chat, deepseek-reasoner, etc.)
 * - MiniMax (minimax-text-01, etc.)
 * - Xiaomi MiMo (mimo-v2.5-pro, etc.)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ═══════════════════════════════════════════════════
// 支持的提供商配置
// ═══════════════════════════════════════════════════

type Provider = 'openai' | 'anthropic' | 'deepseek' | 'minimax' | 'mimo';

interface ProviderConfig {
  baseURL: string;
  apiKeyEnv: string;       // 环境变量名
  defaultModel: string;
  supportsJsonMode: boolean;  // 是否支持 response_format json_object
}

const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    supportsJsonMode: true,
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514',
    supportsJsonMode: false,
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    supportsJsonMode: true,
  },
  minimax: {
    baseURL: 'https://api.minimax.chat/v1',
    apiKeyEnv: 'MINIMAX_API_KEY',
    defaultModel: 'MiniMax-Text-01',
    supportsJsonMode: false,
  },
  mimo: {
    baseURL: 'https://token-plan-cn.xiaomimimo.com/v1',
    apiKeyEnv: 'MIMO_API_KEY',
    defaultModel: 'mimo-v2.5-pro',
    supportsJsonMode: false,
  },
};

// ═══════════════════════════════════════════════════
// 配置读取
// ═══════════════════════════════════════════════════

const AI_PROVIDER: Provider = (process.env.AI_PROVIDER as Provider) || 'openai';
const AI_MODEL = process.env.AI_MODEL;

function getProviderConfig(): ProviderConfig {
  const config = PROVIDER_CONFIGS[AI_PROVIDER];
  if (!config) {
    throw new Error(`不支持的 AI 提供商: ${AI_PROVIDER}。支持: ${Object.keys(PROVIDER_CONFIGS).join(', ')}`);
  }
  return config;
}

function getModel(): string {
  return AI_MODEL || getProviderConfig().defaultModel;
}

// ═══════════════════════════════════════════════════
// 客户端初始化（懒加载）
// ═══════════════════════════════════════════════════

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let deepseekClient: OpenAI | null = null;
let minimaxClient: OpenAI | null = null;
let mimoClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: PROVIDER_CONFIGS.openai.baseURL,
    });
  }
  return openaiClient;
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

function getDeepSeek(): OpenAI {
  if (!deepseekClient) {
    deepseekClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: PROVIDER_CONFIGS.deepseek.baseURL,
    });
  }
  return deepseekClient;
}

function getMiniMax(): OpenAI {
  if (!minimaxClient) {
    minimaxClient = new OpenAI({
      apiKey: process.env.MINIMAX_API_KEY,
      baseURL: PROVIDER_CONFIGS.minimax.baseURL,
    });
  }
  return minimaxClient;
}

function getMiMo(): OpenAI {
  if (!mimoClient) {
    mimoClient = new OpenAI({
      apiKey: process.env.MIMO_API_KEY,
      baseURL: PROVIDER_CONFIGS.mimo.baseURL,
      defaultHeaders: {
        'api-key': process.env.MIMO_API_KEY || '',
      },
    });
  }
  return mimoClient;
}

function getClient(): OpenAI | Anthropic {
  switch (AI_PROVIDER) {
    case 'openai': return getOpenAI();
    case 'anthropic': return getAnthropic();
    case 'deepseek': return getDeepSeek();
    case 'minimax': return getMiniMax();
    case 'mimo': return getMiMo();
    default: throw new Error(`未知提供商: ${AI_PROVIDER}`);
  }
}

// ═══════════════════════════════════════════════════
// 统一调用接口
// ═══════════════════════════════════════════════════

export interface AIOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;       // 强制 JSON 输出
}

/**
 * 调用 AI 生成文本
 */
export async function aiGenerate(
  prompt: string,
  options: AIOptions = {}
): Promise<string> {
  const {
    system = '你是一个有用的助手。',
    temperature = 0.7,
    maxTokens = 4096,
    jsonMode = false,
  } = options;

  const config = getProviderConfig();
  const model = getModel();

  console.log(`  🤖 调用 ${AI_PROVIDER} (${model})`);

  // Anthropic 走专用逻辑
  if (AI_PROVIDER === 'anthropic') {
    return callAnthropic(prompt, system, temperature, maxTokens);
  }

  // 其他提供商都走 OpenAI 兼容接口
  return callOpenAICompatible(prompt, system, temperature, maxTokens, jsonMode, config);
}

/**
 * 调用 AI 并解析 JSON 输出
 */
export async function aiGenerateJSON<T = any>(
  prompt: string,
  options: AIOptions = {}
): Promise<T> {
  const jsonOptions = { ...options, jsonMode: true };

  // 在 system prompt 中强调 JSON 格式
  const system = (options.system || '') + '\n\n你必须严格以 JSON 格式输出，不要包含任何其他文字、解释或 markdown 标记。';

  const result = await aiGenerate(prompt, { ...jsonOptions, system });

  // 尝试解析 JSON
  try {
    // 处理可能的 markdown 代码块包裹
    let cleanResult = result.trim();
    if (cleanResult.startsWith('```json')) {
      cleanResult = cleanResult.slice(7);
    } else if (cleanResult.startsWith('```')) {
      cleanResult = cleanResult.slice(3);
    }
    if (cleanResult.endsWith('```')) {
      cleanResult = cleanResult.slice(0, -3);
    }
    cleanResult = cleanResult.trim();

    return JSON.parse(cleanResult) as T;
  } catch (err) {
    console.error('JSON 解析失败，原始输出:', result.slice(0, 200));
    throw new Error(`AI 输出不是有效的 JSON: ${err}`);
  }
}

// ═══════════════════════════════════════════════════
// OpenAI 兼容调用（适用于 OpenAI / DeepSeek / MiniMax / MiMo）
// ═══════════════════════════════════════════════════

async function callOpenAICompatible(
  prompt: string,
  system: string,
  temperature: number,
  maxTokens: number,
  jsonMode: boolean,
  config: ProviderConfig
): Promise<string> {
  const client = getClient() as OpenAI;
  const model = getModel();

  const params: any = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  // 只有支持 jsonMode 的提供商才加这个参数
  if (jsonMode && config.supportsJsonMode) {
    params.response_format = { type: 'json_object' };
  }

  // MiMo 特殊处理：禁用思考模式，增加输出 token
  if (AI_PROVIDER === 'mimo') {
    params.extra_body = {
      thinking: { type: 'disabled' }
    };
    // MiMo 需要更多 token 用于输出
    if (maxTokens < 4096) {
      params.max_tokens = 4096;
    }
  }

  const response = await client.chat.completions.create(params);

  const message = response.choices[0]?.message;

  // MiMo 可能把内容放在 reasoning_content 里
  const content = message?.content || '';
  const reasoning = (message as any)?.reasoning_content || '';

  return content || reasoning || '';
}

// ═══════════════════════════════════════════════════
// Anthropic 调用
// ═══════════════════════════════════════════════════

async function callAnthropic(
  prompt: string,
  system: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const client = getAnthropic();
  const model = getModel();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [
      { role: 'user', content: prompt },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock ? (textBlock as any).text : '';
}

// ═══════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════

/** 获取当前使用的提供商信息 */
export function getProviderInfo(): { provider: Provider; model: string } {
  return {
    provider: AI_PROVIDER,
    model: getModel(),
  };
}

/** 列出所有支持的提供商 */
export function listProviders(): string[] {
  return Object.keys(PROVIDER_CONFIGS);
}
