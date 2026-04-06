update public.posts
set administrative_dong_name = trim(
  concat_ws(
    ' ',
    nullif(split_part(administrative_dong_name, ' ', 1), ''),
    nullif(split_part(administrative_dong_name, ' ', 2), ''),
    nullif(split_part(administrative_dong_name, ' ', 3), '')
  )
)
where array_length(regexp_split_to_array(trim(administrative_dong_name), '\s+'), 1) > 3;
