type DongPostsFeedVeilProps = {
  message?: string;
};

export function DongPostsFeedVeil({
  message = "서비스 이용을 위해 위치 권한을 허용해주세요.",
}: DongPostsFeedVeilProps) {
  return (
    <div aria-hidden="true" className="global-feed-preview__veil">
      <div className="global-feed-preview__badge">{message}</div>
    </div>
  );
}
