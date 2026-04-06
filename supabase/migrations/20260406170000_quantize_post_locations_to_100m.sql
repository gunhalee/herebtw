alter table public.posts
  add column if not exists latitude_bucket_100m integer,
  add column if not exists longitude_bucket_100m integer;

with quantized_posts as (
  select
    p.id,
    case
      when p.latitude is null then null
      else round((p.latitude * 111320.0) / 100.0)::integer
    end as latitude_bucket_100m,
    case
      when p.latitude is null or p.longitude is null then null
      else round(
        (
          p.longitude * greatest(111320.0 * cos(radians(p.latitude)), 0.000001)
        ) / 100.0
      )::integer
    end as longitude_bucket_100m,
    case
      when p.latitude is null then null
      else round((p.latitude * 111320.0) / 100.0) * 100.0 / 111320.0
    end as snapped_latitude,
    case
      when p.latitude is null or p.longitude is null then null
      else round(
        (
          p.longitude * greatest(111320.0 * cos(radians(p.latitude)), 0.000001)
        ) / 100.0
      ) * 100.0 / greatest(111320.0 * cos(radians(p.latitude)), 0.000001)
    end as snapped_longitude
  from public.posts p
)
update public.posts as posts
set
  latitude = quantized_posts.snapped_latitude,
  longitude = quantized_posts.snapped_longitude,
  latitude_bucket_100m = quantized_posts.latitude_bucket_100m,
  longitude_bucket_100m = quantized_posts.longitude_bucket_100m
from quantized_posts
where posts.id = quantized_posts.id;

create index if not exists idx_posts_active_100m_buckets
  on public.posts (latitude_bucket_100m, longitude_bucket_100m, created_at desc)
  where status = 'active'
    and latitude_bucket_100m is not null
    and longitude_bucket_100m is not null;

create or replace function public.list_nearby_posts(
  viewer_latitude double precision default null,
  viewer_longitude double precision default null,
  cursor_distance_meters integer default null,
  cursor_created_at timestamptz default null,
  cursor_post_id uuid default null,
  result_limit integer default 10
)
returns table (
  id uuid,
  content varchar(100),
  administrative_dong_name text,
  created_at timestamptz,
  delete_expires_at timestamptz,
  latitude double precision,
  longitude double precision,
  distance_meters integer
)
language sql
stable
as $$
  with viewer as (
    select
      case
        when viewer_latitude is null then null
        else round((viewer_latitude * 111320.0) / 100.0)::integer
      end as viewer_latitude_bucket_100m,
      case
        when viewer_latitude is null or viewer_longitude is null then null
        else round(
          (
            viewer_longitude *
            greatest(111320.0 * cos(radians(viewer_latitude)), 0.000001)
          ) / 100.0
        )::integer
      end as viewer_longitude_bucket_100m
  ),
  ranked_posts as (
    select
      p.id,
      p.content,
      p.administrative_dong_name,
      p.created_at,
      p.delete_expires_at,
      p.latitude,
      p.longitude,
      case
        when viewer.viewer_latitude_bucket_100m is null
          or viewer.viewer_longitude_bucket_100m is null
          or p.latitude_bucket_100m is null
          or p.longitude_bucket_100m is null then 2147483647
        else ceil(
          sqrt(
            power(
              p.latitude_bucket_100m - viewer.viewer_latitude_bucket_100m,
              2
            ) +
            power(
              p.longitude_bucket_100m - viewer.viewer_longitude_bucket_100m,
              2
            )
          ) * 100.0
        )::integer
      end as distance_meters
    from public.posts p
    cross join viewer
    where p.status = 'active'
  )
  select
    ranked_posts.id,
    ranked_posts.content,
    ranked_posts.administrative_dong_name,
    ranked_posts.created_at,
    ranked_posts.delete_expires_at,
    ranked_posts.latitude,
    ranked_posts.longitude,
    ranked_posts.distance_meters
  from ranked_posts
  where
    cursor_distance_meters is null
    or ranked_posts.distance_meters > cursor_distance_meters
    or (
      ranked_posts.distance_meters = cursor_distance_meters
      and ranked_posts.created_at < cursor_created_at
    )
    or (
      ranked_posts.distance_meters = cursor_distance_meters
      and ranked_posts.created_at = cursor_created_at
      and ranked_posts.id > cursor_post_id
    )
  order by ranked_posts.distance_meters asc, ranked_posts.created_at desc, ranked_posts.id asc
  limit least(greatest(coalesce(result_limit, 10), 1), 51);
$$;
