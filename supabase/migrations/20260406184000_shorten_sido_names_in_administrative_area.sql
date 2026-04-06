update public.posts
set administrative_dong_name = trim(
  concat_ws(
    ' ',
    case split_part(administrative_dong_code, ':', 3)
      when '서울특별시' then '서울'
      when '부산광역시' then '부산'
      when '대구광역시' then '대구'
      when '인천광역시' then '인천'
      when '광주광역시' then '광주'
      when '대전광역시' then '대전'
      when '울산광역시' then '울산'
      when '세종특별자치시' then '세종'
      when '경기도' then '경기'
      when '강원특별자치도' then '강원'
      when '강원도' then '강원'
      when '충청북도' then '충북'
      when '충청남도' then '충남'
      when '전북특별자치도' then '전북'
      when '전라북도' then '전북'
      when '전라남도' then '전남'
      when '경상북도' then '경북'
      when '경상남도' then '경남'
      when '제주특별자치도' then '제주'
      when '제주도' then '제주'
      else nullif(split_part(administrative_dong_code, ':', 3), '')
    end,
    nullif(split_part(administrative_dong_code, ':', 4), ''),
    nullif(split_part(administrative_dong_code, ':', 5), '')
  )
)
where administrative_dong_code like 'geo:kr:%:%:%';
