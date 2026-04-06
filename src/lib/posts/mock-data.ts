import type {
  PostDetailState,
  PostListItem,
  PostListState,
} from "../../types/post";

type MockPostRecord = PostListItem;

const MOCK_POSTS: MockPostRecord[] = [
  {
    id: "post_1",
    content: "횡단보도 신호가 너무 짧아요.",
    administrativeDongName: "서울 강남구 역삼1동",
    distanceMeters: 280,
    relativeTime: "3분 전",
    agreeCount: 18,
    myAgree: false,
    canReport: true,
    isHighlighted: true,
  },
  {
    id: "post_2",
    content: "밤길 가로등이 너무 어두워요. 골목 입구가 잘 안 보여요.",
    administrativeDongName: "서울 강남구 역삼2동",
    distanceMeters: 610,
    relativeTime: "12분 전",
    agreeCount: 9,
    myAgree: true,
    canReport: true,
    isHighlighted: false,
  },
  {
    id: "post_3",
    content: "쓰레기통이 없어서 사람들이 그냥 두고 가요.",
    administrativeDongName: "서울 강남구 논현1동",
    distanceMeters: 820,
    relativeTime: "27분 전",
    agreeCount: 4,
    myAgree: false,
    canReport: true,
    isHighlighted: false,
  },
  {
    id: "post_4",
    content: "불법주정차가 많아서 버스가 자주 막혀요.",
    administrativeDongName: "서울 마포구 서교동",
    distanceMeters: 1240,
    relativeTime: "8분 전",
    agreeCount: 13,
    myAgree: false,
    canReport: true,
    isHighlighted: false,
  },
  {
    id: "post_5",
    content: "공원 쪽 조명만 조금 더 밝아지면 좋겠어요.",
    administrativeDongName: "서울 마포구 연남동",
    distanceMeters: 1580,
    relativeTime: "21분 전",
    agreeCount: 7,
    myAgree: false,
    canReport: true,
    isHighlighted: false,
  },
  {
    id: "post_6",
    content: "출근 시간 버스 배차가 조금만 더 촘촘하면 좋겠어요.",
    administrativeDongName: "인천 연수구 송도1동",
    distanceMeters: 2350,
    relativeTime: "17분 전",
    agreeCount: 11,
    myAgree: true,
    canReport: true,
    isHighlighted: false,
  },
];

export function toggleMockPostAgree(postId: string) {
  const targetPost = MOCK_POSTS.find((post) => post.id === postId);

  if (!targetPost) {
    return {
      postId,
      agreed: false,
      agreeCount: 0,
    };
  }

  targetPost.myAgree = !targetPost.myAgree;
  targetPost.agreeCount = targetPost.myAgree
    ? targetPost.agreeCount + 1
    : Math.max(0, targetPost.agreeCount - 1);

  return {
    postId,
    agreed: targetPost.myAgree,
    agreeCount: targetPost.agreeCount,
  };
}

export function getMockPostItems(): PostListItem[] {
  return [...MOCK_POSTS].sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function getMockPostListState(): PostListState {
  const items = getMockPostItems();

  return {
    items,
    nextCursor: null,
    loading: false,
    loadingMore: false,
    empty: items.length === 0,
    errorMessage: null,
    sort: "distance",
  };
}

export function getMockPostDetailState(postId = "post_1"): PostDetailState {
  const post = MOCK_POSTS.find((item) => item.id === postId) ?? MOCK_POSTS[0];

  return {
    postId: post.id,
    open: false,
    loading: false,
    content: post.content,
    administrativeDongName: post.administrativeDongName,
    distanceMeters: post.distanceMeters,
    relativeTime: post.relativeTime,
    agreeCount: post.agreeCount,
    myAgree: post.myAgree,
    canReport: post.canReport,
    canDelete: true,
    deleteRemainingSeconds: 143,
    errorMessage: null,
  };
}
