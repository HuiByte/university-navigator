import { vi } from "vitest"

// streamText 返回的结果对象
const mockStreamTextResult = {
  toTextStreamResponse: vi.fn(
    () =>
      new Response("mock stream response", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
  ),
  toUIMessageStreamResponse: vi.fn(
    () =>
      new Response("mock stream response", {
        status: 200,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      }),
  ),
}

// 变量名以 mock 开头，满足 vi.mock hoisting 例外规则
export const mockStreamText = vi.fn(() => mockStreamTextResult)

export const mockConvertToModelMessages = vi.fn(async (messages: unknown[]) => messages)

/** AI mock 控制器 */
export const aiMock = {
  reset() {
    mockStreamText.mockClear()
    mockStreamTextResult.toTextStreamResponse.mockClear()
    mockStreamTextResult.toUIMessageStreamResponse.mockClear()
    mockConvertToModelMessages.mockClear()
  },
}