import { describe, it, expect } from "vitest"
import { parseAIJsonResponse } from "@/lib/ai-response-parser"

describe("parseAIJsonResponse", () => {
  // ========== 策略 A：纯 JSON 字符串 ==========
  describe("策略 A：直接解析纯 JSON", () => {
    it("应该成功解析一个简单的 JSON 对象", () => {
      const input = '{"name":"test","value":123}'
      expect(parseAIJsonResponse(input)).toEqual({ name: "test", value: 123 })
    })

    it("应该成功解析嵌套的 JSON 对象", () => {
      const input = '{"stages":[{"name":"阶段1","actions":["a","b"]}]}'
      const result = parseAIJsonResponse(input)
      expect(result.stages).toHaveLength(1)
      expect(result.stages[0].name).toBe("阶段1")
    })

    it("应该成功解析带有 null、布尔值和数组的 JSON", () => {
      const input = '{"a":null,"b":true,"c":[1,2,3]}'
      expect(parseAIJsonResponse(input)).toEqual({ a: null, b: true, c: [1, 2, 3] })
    })
  })

  // ========== 策略 B：带 markdown 包裹的 JSON ==========
  describe("策略 B：markdown 代码块包裹", () => {
    it("应该提取 ```json 代码块中的 JSON", () => {
      const input = '```json\n{"name":"test","value":123}\n```'
      expect(parseAIJsonResponse(input)).toEqual({ name: "test", value: 123 })
    })

    it("应该提取 ``` 代码块（不含 json 标记）中的 JSON", () => {
      const input = '```\n{"name":"test","value":123}\n```'
      expect(parseAIJsonResponse(input)).toEqual({ name: "test", value: 123 })
    })

    it("如果有多个代码块，应该提取最后一个", () => {
      const input = [
        '```json\n{"first":true}\n```',
        'some text',
        '```json\n{"last":true}\n```',
      ].join("\n")
      expect(parseAIJsonResponse(input)).toEqual({ last: true })
    })

    it("应该忽略代码块外的额外文本", () => {
      const input = '这是解释文字\n```json\n{"key":"value"}\n```\n更多说明'
      expect(parseAIJsonResponse(input)).toEqual({ key: "value" })
    })

    it("代码块内 JSON 带有换行和缩进时应该正确解析", () => {
      const input = '```json\n{\n  "stages": [\n    { "name": "阶段1" }\n  ]\n}\n```'
      const result = parseAIJsonResponse(input)
      expect(result.stages[0].name).toBe("阶段1")
    })
  })

  // ========== 策略 B/C：包含多余解释文字的 JSON ==========
  describe("策略 B/C：包含多余解释文字的 JSON", () => {
    it("如果代码块中的 JSON 无法解析，应回退到策略 C 提取 {} 间内容", () => {
      // 用 ``` 包裹但内容不是合法 JSON → 策略 B 失败 → 策略 C 应提取 {} 间内容
      const input = '这是描述\n```\n这里有额外文字 {"name":"test"} 更多文字\n```'
      expect(parseAIJsonResponse(input)).toEqual({ name: "test" })
    })

    it("没有代码块时，应从解释文字中提取 {} 间内容", () => {
      const input = '这里是一些解释性的文字，返回的 JSON 是 {"result":"success"} 请查收'
      expect(parseAIJsonResponse(input)).toEqual({ result: "success" })
    })

    it("如果有花括号嵌套，应提取最外层 {} 间的内容", () => {
      const input = '结果如下：{"outer":{"inner":"value"}} 结束'
      expect(parseAIJsonResponse(input)).toEqual({ outer: { inner: "value" } })
    })
  })

  // ========== 完全无效的文本 ==========
  describe("兜底：完全无效的文本应抛出错误", () => {
    it("无意义的字符串应该抛出 JSON_PARSE_FAILED", () => {
      expect(() => parseAIJsonResponse("完全没有 JSON 内容")).toThrow("JSON_PARSE_FAILED")
    })

    it("空字符串应该抛出 JSON_PARSE_FAILED", () => {
      expect(() => parseAIJsonResponse("")).toThrow("JSON_PARSE_FAILED")
    })

    it("只有花括号但没有合法内容应该抛出 JSON_PARSE_FAILED", () => {
      expect(() => parseAIJsonResponse("{}之外的无效内容{]}")).toThrow("JSON_PARSE_FAILED")
    })

    it("null/undefined 应该抛出 JSON_PARSE_FAILED", () => {
      expect(() => parseAIJsonResponse(null as any)).toThrow("JSON_PARSE_FAILED")
      expect(() => parseAIJsonResponse(undefined as any)).toThrow("JSON_PARSE_FAILED")
    })
  })
})