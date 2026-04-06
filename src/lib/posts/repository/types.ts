type PostRow = {
  id: string;
  content: string;
  administrative_dong_name: string;
  author_device_id?: string;
  latitude?: number | null;
  longitude?: number | null;
  latitude_bucket_100m?: number | null;
  longitude_bucket_100m?: number | null;
  created_at: string;
  delete_expires_at: string;
};

type NearbyPostRow = PostRow & {
  distance_meters: number;
  agree_count?: number;
  my_agree?: boolean;
  can_report?: boolean;
};

type DeviceIdentityRow = {
  id: string;
  anonymous_device_id: string;
};

type PostListCursor = {
  distanceMeters: number;
  createdAt: string;
  postId: string;
};

type GlobalPostListCursor = {
  createdAt: string;
  postId: string;
};

type PostEngagementRow = {
  post_id: string;
  agree_count: number;
};

type ReactionRow = {
  id: string;
  post_id: string;
  device_id: string;
  reaction_type: string;
};

type ReportRow = {
  id: string;
  post_id: string;
  reporter_device_id: string;
  reason_code: string;
};

type ToggleAgreeRpcRow = {
  agreed: boolean;
  agree_count: number;
};

type FeedScope = "nearby" | "global";

type FeedFallbackReason = "missing_rpc" | "unexpected_rpc_shape";

export type {
  DeviceIdentityRow,
  FeedFallbackReason,
  FeedScope,
  GlobalPostListCursor,
  NearbyPostRow,
  PostEngagementRow,
  PostListCursor,
  PostRow,
  ReactionRow,
  ReportRow,
  ToggleAgreeRpcRow,
};
