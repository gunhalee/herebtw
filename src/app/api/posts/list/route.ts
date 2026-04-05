import { ok } from "../../../../lib/api/response";
import { isValidCoordinateInput } from "../../../../lib/geo/resolve-location";
import { loadPostsListRepository } from "../../../../lib/posts/repository";

type PostsListRequest = {
  anonymousDeviceId?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  pagination?: {
    limit?: number;
  };
};

export async function POST(request: Request) {
  const body = (await request.json()) as PostsListRequest;
  const postListState = await loadPostsListRepository({
    anonymousDeviceId: body.anonymousDeviceId,
    limit: body.pagination?.limit ?? 10,
    location: isValidCoordinateInput(body.location) ? body.location : undefined,
  });

  return ok({
    items: postListState.items,
    nextCursor: postListState.nextCursor,
  });
}
