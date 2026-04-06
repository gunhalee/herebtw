import type { ApiResponse } from "../../types/api";

type FetchClientApiDataParams = {
  errorMessage: string;
  init?: RequestInit;
  path: string;
};

export function createJsonPostRequestInit(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  };
}

export async function fetchClientApiData<T>({
  errorMessage,
  init,
  path,
}: FetchClientApiDataParams): Promise<T> {
  const response = await fetch(path, init);
  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? errorMessage);
  }

  return json.data;
}
