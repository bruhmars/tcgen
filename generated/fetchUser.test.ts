import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchUser } from "../samples/fetchUser";

describe("fetchUser", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it("[happy] returns parsed user for valid id", async () => {
    const mockUser = { id: 1, name: "John Doe" };
    const jsonMock = vi.fn().mockResolvedValue(mockUser);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jsonMock,
    } as Response);
    global.fetch = fetchMock as any;

    const result = await fetchUser(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://jsonplaceholder.typicode.com/users/1"
    );
    expect(jsonMock).toHaveBeenCalledOnce();
    expect(result).toEqual(mockUser);
  });

  it("[bva] accepts smallest positive id (1)", async () => {
    const mockUser = { id: 1 };
    const jsonMock = vi.fn().mockResolvedValue(mockUser);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jsonMock,
    } as Response);
    global.fetch = fetchMock as any;

    const result = await fetchUser(1);
    expect(result).toEqual(mockUser);
  });

  it("[bva] rejects zero id with proper error", async () => {
    await expect(() => fetchUser(0)).rejects.toThrowError(
      new Error("ID must be positive")
    );
  });

  it("[bva] rejects negative id with proper error", async () => {
    await expect(() => fetchUser(-5)).rejects.toThrowError(
      new Error("ID must be positive")
    );
  });

  it("[error] throws HTTP error when response not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn(),
    } as Response);
    global.fetch = fetchMock as any;

    await expect(() => fetchUser(999)).rejects.toThrowError(
      new Error("HTTP error 404")
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("[edge] handles large id values", async () => {
    const largeId = Number.MAX_SAFE_INTEGER;
    const mockUser = { id: largeId };
    const jsonMock = vi.fn().mockResolvedValue(mockUser);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jsonMock,
    } as Response);
    global.fetch = fetchMock as any;

    const result = await fetchUser(largeId);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://jsonplaceholder.typicode.com/users/${largeId}`
    );
    expect(result).toEqual(mockUser);
  });

  it("[edge] propagates fetch rejection as error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network failure"));
    global.fetch = fetchMock as any;

    await expect(() => fetchUser(1)).rejects.toThrowError("Network failure");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
