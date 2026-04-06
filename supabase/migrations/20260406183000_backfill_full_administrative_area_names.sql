update public.posts
set administrative_dong_name = trim(
  concat_ws(
    ' ',
    nullif(split_part(administrative_dong_code, ':', 3), ''),
    nullif(split_part(administrative_dong_code, ':', 4), ''),
    nullif(split_part(administrative_dong_code, ':', 5), '')
  )
)
where administrative_dong_code like 'geo:kr:%:%:%'
  and (
    administrative_dong_name = split_part(administrative_dong_code, ':', 5)
    or administrative_dong_name not like '% %'
  );
