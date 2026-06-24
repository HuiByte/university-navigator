/**
 * 从 AI 响应文本中提取并解析 JSON 字符串。
 *
 * 解析策略（按顺序尝试）：
 *   A. 直接 JSON.parse(text)
 *   B. 匹配最后一个 ```json 或 ``` 代码块，提取块内内容后 parse
 *   C. 提取第一个 { 和最后一个 } 之间的内容后 parse
 *   D. 全部失败则抛出 Error('JSON_PARSE_FAILED')
 *
 * @param text - AI 返回的原始文本
 * @returns 解析后的 JSON 对象
 * @throws Error('JSON_PARSE_FAILED') 当所有策略均失败时
 */
export function parseAIJsonResponse(text: string): any {
  if (!text || typeof text !== "string") {
    throw new Error("JSON_PARSE_FAILED")
  }

  const trimmed = text.trim()

  // 策略 A：直接解析
  try {
    return JSON.parse(trimmed)
  } catch {
    // 继续尝试策略 B
  }

  // 策略 B：匹配最后一个 ```json 或 ``` 代码块
  // 使用非贪婪匹配，从后往前找
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null
  let lastBlock: string | null = null
  while ((match = codeBlockRegex.exec(trimmed)) !== null) {
    lastBlock = match[1].trim()
  }
  if (lastBlock !== null) {
    try {
      return JSON.parse(lastBlock)
    } catch {
      // 继续尝试策略 C
    }
  }

  // 策略 C：提取第一个 { 和最后一个 } 之间的内容
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1)
    try {
      return JSON.parse(jsonCandidate)
    } catch {
      // 继续到兜底
    }
  }

  // 兜底：全部失败
  throw new Error("JSON_PARSE_FAILED")
}