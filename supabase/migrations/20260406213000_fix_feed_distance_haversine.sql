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
      viewer_latitude as latitude,
      viewer_longitude as longitude
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
        when viewer.latitude is null
          or viewer.longitude is null
          or p.latitude is null
          or p.longitude is null then 2147483647
        else round(
          2 * 6371000 * asin(
            sqrt(
              power(sin(radians((p.latitude - viewer.latitude) / 2)), 2) +
              cos(radians(viewer.latitude)) *
              cos(radians(p.latitude)) *
              power(sin(radians((p.longitude - viewer.longitude) / 2)), 2)
            )
          )
        )::integer
      end as distance_meters
    from public.posts as p
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

create or replace function public.list_posts_feed(
  viewer_latitude double precision default null,
  viewer_longitude double precision default null,
  viewer_anonymous_device_id text default null,
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
  distance_meters integer,
  agree_count integer,
  my_agree boolean,
  can_report boolean
)
language sql
stable
as $$
  with viewer as (
    select
      viewer_latitude as latitude,
      viewer_longitude as longitude,
      device.id as viewer_device_id,
      viewer_anonymous_device_id is not null as has_viewer_identity
    from (select 1) seed
    left join public.device_identities as device
      on device.anonymous_device_id = viewer_anonymous_device_id
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
      viewer.viewer_device_id,
      viewer.has_viewer_identity,
      case
        when viewer.latitude is null
          or viewer.longitude is null
          or p.latitude is null
          or p.longitude is null then 2147483647
        else round(
          2 * 6371000 * asin(
            sqrt(
              power(sin(radians((p.latitude - viewer.latitude) / 2)), 2) +
              cos(radians(viewer.latitude)) *
              cos(radians(p.latitude)) *
              power(sin(radians((p.longitude - viewer.longitude) / 2)), 2)
            )
          )
        )::integer
      end as distance_meters
    from public.posts as p
    cross join viewer
    where p.status = 'active'
  ),
  selected_posts as (
    select
      ranked_posts.id,
      ranked_posts.content,
      ranked_posts.administrative_dong_name,
      ranked_posts.created_at,
      ranked_posts.delete_expires_at,
      ranked_posts.latitude,
      ranked_posts.longitude,
      ranked_posts.viewer_device_id,
      ranked_posts.has_viewer_identity,
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
    limit least(greatest(coalesce(result_limit, 10), 1), 51)
  ),
  agree_counts as (
    select
      reaction.post_id,
      count(*)::int as agree_count
    from public.post_reactions as reaction
    inner join selected_posts
      on selected_posts.id = reaction.post_id
    where reaction.reaction_type = 'agree'
    group by reaction.post_id
  ),
  viewer_agrees as (
    select reaction.post_id
    from public.post_reactions as reaction
    inner join selected_posts
      on selected_posts.id = reaction.post_id
    where selected_posts.viewer_device_id is not null
      and reaction.reaction_type = 'agree'
      and reaction.device_id = selected_posts.viewer_device_id
    group by reaction.post_id
  ),
  viewer_reports as (
    select report.post_id
    from public.post_reports as report
    inner join selected_posts
      on selected_posts.id = report.post_id
    where selected_posts.viewer_device_id is not null
      and report.reporter_device_id = selected_posts.viewer_device_id
    group by report.post_id
  )
  select
    selected_posts.id,
    selected_posts.content,
    selected_posts.administrative_dong_name,
    selected_posts.created_at,
    selected_posts.delete_expires_at,
    selected_posts.latitude,
    selected_posts.longitude,
    selected_posts.distance_meters,
    coalesce(agree_counts.agree_count, 0) as agree_count,
    coalesce(viewer_agrees.post_id is not null, false) as my_agree,
    case
      when selected_posts.has_viewer_identity = false then false
      when selected_posts.viewer_device_id is null then true
      else viewer_reports.post_id is null
    end as can_report
  from selected_posts
  left join agree_counts
    on agree_counts.post_id = selected_posts.id
  left join viewer_agrees
    on viewer_agrees.post_id = selected_posts.id
  left join viewer_reports
    on viewer_reports.post_id = selected_posts.id
  order by selected_posts.distance_meters asc, selected_posts.created_at desc, selected_posts.id asc;
$$;
