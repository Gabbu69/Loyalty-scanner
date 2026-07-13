begin;

drop policy if exists point_transactions_owner_select on public.point_transactions;
drop policy if exists point_transactions_active_staff_select on public.point_transactions;

create policy point_transactions_active_staff_select
on public.point_transactions for select
to authenticated
using ((select loyalty_private.has_store_role(store_id, array['owner', 'staff'])));

create or replace function public.search_members(
  p_store_id uuid,
  p_query text default '',
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_digits text;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 1000);
  v_reward record;
  v_members jsonb;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner', 'staff']) then
    return jsonb_build_object('status', 'forbidden', 'members', '[]'::jsonb);
  end if;

  if char_length(v_query) > 120 then
    return jsonb_build_object('status', 'invalid_query', 'members', '[]'::jsonb);
  end if;

  v_digits := regexp_replace(v_query, '[^0-9]', '', 'g');

  select r.id, r.name, r.cost_points, r.is_enabled
  into v_reward
  from public.rewards as r
  where r.store_id = p_store_id;

  select coalesce(jsonb_agg(q.member order by q.sort_rank, q.created_at desc), '[]'::jsonb)
  into v_members
  from (
    select
      jsonb_build_object(
        'id', m.id,
        'member_code', m.member_code,
        'full_name', m.full_name,
        'masked_phone', loyalty_private.mask_phone(m.phone_normalized),
        'current_balance', m.current_balance,
        'is_active', m.is_active,
        'created_at', m.created_at,
        'updated_at', m.updated_at,
        'reward_eligible', coalesce(
          v_reward.is_enabled and m.current_balance >= v_reward.cost_points,
          false
        )
      ) as member,
      case
        when upper(m.member_code) = upper(v_query) then 0
        when lower(m.full_name) = lower(v_query) then 1
        else 2
      end as sort_rank,
      m.created_at
    from public.members as m
    where m.store_id = p_store_id
      and (
        v_query = ''
        or strpos(lower(m.full_name), lower(v_query)) > 0
        or strpos(upper(m.member_code), upper(v_query)) > 0
        or (
          v_digits <> ''
          and m.phone_normalized is not null
          and strpos(m.phone_normalized, v_digits) > 0
        )
      )
    order by sort_rank, m.created_at desc
    limit v_limit
  ) as q;

  return jsonb_build_object('status', 'ok', 'members', v_members);
end;
$$;

revoke all on function public.search_members(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.search_members(uuid, text, integer) to authenticated;

commit;
