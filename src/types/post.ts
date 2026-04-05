export type PostLocation = {
  latitude: number;
  longitude: number;
};

export type PostListItem = {
  id: string;
  content: string;
  administrativeDongName: string;
  distanceMeters: number;
  relativeTime: string;
  agreeCount: number;
  myAgree: boolean;
  canReport: boolean;
  isHighlighted: boolean;
};

export type PostListState = {
  items: PostListItem[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  empty: boolean;
  errorMessage: string | null;
  sort: "distance";
};

export type PostDetailState = {
  postId: string | null;
  open: boolean;
  loading: boolean;
  content: string;
  administrativeDongName: string;
  distanceMeters: number;
  relativeTime: string;
  agreeCount: number;
  myAgree: boolean;
  canReport: boolean;
  canDelete: boolean;
  deleteRemainingSeconds: number;
  errorMessage: string | null;
};

export type PostComposeState = {
  content: string;
  charCount: number;
  submitting: boolean;
  locationResolved: boolean;
  resolvedDongName: string | null;
  resolvedDongCode: string | null;
  resolvedGridCellPath: string | null;
  cooldownRemainingSeconds: number;
  duplicateBlocked: boolean;
  errorMessage: string | null;
};
