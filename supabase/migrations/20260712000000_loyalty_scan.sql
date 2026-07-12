begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists loyalty_private;
revoke all on schema loyalty_private from public, anon, authenticated;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Manila',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_name_valid check (
    name = btrim(name)
    and char_length(name) between 1 and 120
  ),
  constraint stores_timezone_valid check (
    timezone = btrim(timezone)
    and char_length(timezone) between 1 and 100
  )
);

create table public.program_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  points_per_visit integer not null default 1,
  duplicate_cooldown_minutes integer not null default 10,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_settings_points_per_visit_valid
    check (points_per_visit between 1 and 10000),
  constraint program_settings_cooldown_valid
    check (duplicate_cooldown_minutes between 0 and 10080)
);

create table public.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null,
  is_active boolean not null default true,
  invited_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint staff_memberships_store_user_key unique (store_id, user_id),
  constraint staff_memberships_role_valid check (role in ('owner', 'staff')),
  constraint staff_memberships_active_state_valid check (
    (is_active and deactivated_at is null)
    or (not is_active and deactivated_at is not null)
  )
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  member_code text not null,
  full_name text not null,
  phone text,
  phone_normalized text,
  current_balance bigint not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_store_id_id_key unique (store_id, id),
  constraint members_store_code_key unique (store_id, member_code),
  constraint members_code_valid check (member_code ~ '^LS-[A-F0-9]{12}$'),
  constraint members_name_valid check (
    full_name = btrim(full_name)
    and char_length(full_name) between 1 and 120
  ),
  constraint members_phone_valid check (
    (phone is null and phone_normalized is null)
    or (
      phone is not null
      and phone = btrim(phone)
      and char_length(phone) between 7 and 30
      and phone_normalized ~ '^[0-9]{7,15}$'
    )
  ),
  constraint members_balance_nonnegative check (current_balance >= 0)
);

create table public.qr_credentials (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  member_id uuid not null,
  token_hash text not null,
  version smallint not null default 1,
  status text not null default 'active',
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text,
  constraint qr_credentials_store_id_id_key unique (store_id, id),
  constraint qr_credentials_token_hash_key unique (token_hash),
  constraint qr_credentials_member_fkey
    foreign key (store_id, member_id)
    references public.members(store_id, id)
    on delete cascade,
  constraint qr_credentials_hash_valid check (
    char_length(token_hash) = 64
    and token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint qr_credentials_version_valid check (version = 1),
  constraint qr_credentials_status_valid check (status in ('active', 'revoked')),
  constraint qr_credentials_revocation_state_valid check (
    (status = 'active' and revoked_at is null and revoked_by is null and revocation_reason is null)
    or (
      status = 'revoked'
      and revoked_at is not null
      and revoked_by is not null
      and revocation_reason is not null
      and char_length(btrim(revocation_reason)) between 1 and 500
    )
  )
);

create unique index qr_credentials_one_active_per_member_idx
  on public.qr_credentials (store_id, member_id)
  where status = 'active';

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text,
  cost_points bigint,
  is_enabled boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rewards_one_per_store_key unique (store_id),
  constraint rewards_store_id_id_key unique (store_id, id),
  constraint rewards_name_valid check (
    name is null
    or (name = btrim(name) and char_length(name) between 1 and 120)
  ),
  constraint rewards_cost_valid check (cost_points is null or cost_points > 0),
  constraint rewards_enabled_configuration_valid check (
    not is_enabled or (name is not null and cost_points is not null)
  )
);

create table public.scan_attempts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  member_id uuid,
  credential_id uuid,
  staff_user_id uuid not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  scan_method text not null,
  outcome text not null,
  points_awarded bigint not null default 0,
  balance_after bigint,
  next_eligible_at timestamptz,
  attempted_at timestamptz not null default now(),
  constraint scan_attempts_store_id_id_key unique (store_id, id),
  constraint scan_attempts_store_idempotency_key unique (store_id, idempotency_key),
  constraint scan_attempts_member_fkey
    foreign key (store_id, member_id)
    references public.members(store_id, id)
    on delete restrict,
  constraint scan_attempts_credential_fkey
    foreign key (store_id, credential_id)
    references public.qr_credentials(store_id, id)
    on delete restrict,
  constraint scan_attempts_staff_fkey
    foreign key (store_id, staff_user_id)
    references public.staff_memberships(store_id, user_id)
    on delete restrict,
  constraint scan_attempts_fingerprint_valid check (
    char_length(request_fingerprint) = 64
    and request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint scan_attempts_method_valid check (scan_method in ('qr', 'manual')),
  constraint scan_attempts_outcome_valid
    check (outcome in ('awarded', 'cooldown', 'invalid', 'revoked')),
  constraint scan_attempts_points_valid check (
    (outcome = 'awarded' and points_awarded > 0)
    or (outcome <> 'awarded' and points_awarded = 0)
  ),
  constraint scan_attempts_balance_valid check (
    (member_id is null and balance_after is null)
    or (member_id is not null and balance_after is not null and balance_after >= 0)
  )
);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  member_id uuid not null,
  transaction_type text not null,
  points_delta bigint not null,
  balance_after bigint not null,
  reward_id uuid,
  scan_attempt_id uuid,
  source_transaction_id uuid,
  reason text not null,
  idempotency_key uuid not null,
  staff_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint point_transactions_store_id_id_key unique (store_id, id),
  constraint point_transactions_store_idempotency_key unique (store_id, idempotency_key),
  constraint point_transactions_member_fkey
    foreign key (store_id, member_id)
    references public.members(store_id, id)
    on delete restrict,
  constraint point_transactions_reward_fkey
    foreign key (store_id, reward_id)
    references public.rewards(store_id, id)
    on delete restrict,
  constraint point_transactions_scan_fkey
    foreign key (store_id, scan_attempt_id)
    references public.scan_attempts(store_id, id)
    on delete restrict,
  constraint point_transactions_source_fkey
    foreign key (store_id, source_transaction_id)
    references public.point_transactions(store_id, id)
    on delete restrict,
  constraint point_transactions_staff_fkey
    foreign key (store_id, staff_user_id)
    references public.staff_memberships(store_id, user_id)
    on delete restrict,
  constraint point_transactions_type_valid check (
    transaction_type in ('visit_award', 'reward_redemption', 'manual_adjustment', 'reversal')
  ),
  constraint point_transactions_delta_valid check (
    (transaction_type = 'visit_award' and points_delta > 0)
    or (transaction_type = 'reward_redemption' and points_delta < 0)
    or (transaction_type in ('manual_adjustment', 'reversal') and points_delta <> 0)
  ),
  constraint point_transactions_balance_nonnegative check (balance_after >= 0),
  constraint point_transactions_reason_valid check (
    reason = btrim(reason)
    and char_length(reason) between 1 and 500
  ),
  constraint point_transactions_shape_valid check (
    (transaction_type = 'visit_award' and scan_attempt_id is not null and reward_id is null and source_transaction_id is null)
    or (transaction_type = 'reward_redemption' and reward_id is not null and scan_attempt_id is null and source_transaction_id is null)
    or (transaction_type = 'manual_adjustment' and reward_id is null and scan_attempt_id is null and source_transaction_id is null)
    or (transaction_type = 'reversal' and reward_id is null and scan_attempt_id is null and source_transaction_id is not null)
  )
);

create unique index point_transactions_one_reversal_idx
  on public.point_transactions (store_id, source_transaction_id)
  where transaction_type = 'reversal';

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  idempotency_key uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_store_idempotency_key unique (store_id, idempotency_key),
  constraint audit_events_actor_fkey
    foreign key (store_id, actor_user_id)
    references public.staff_memberships(store_id, user_id)
    on delete restrict,
  constraint audit_events_action_valid check (
    action = btrim(action)
    and char_length(action) between 1 and 100
  ),
  constraint audit_events_entity_type_valid check (
    entity_type = btrim(entity_type)
    and char_length(entity_type) between 1 and 100
  ),
  constraint audit_events_details_object check (jsonb_typeof(details) = 'object')
);

create index stores_created_by_idx on public.stores (created_by);
create index program_settings_updated_by_idx on public.program_settings (updated_by);
create index staff_memberships_user_store_idx
  on public.staff_memberships (user_id, store_id)
  where is_active;
create index staff_memberships_invited_by_idx
  on public.staff_memberships (invited_by)
  where invited_by is not null;
create index members_store_created_idx on public.members (store_id, created_at desc);
create index members_store_name_idx on public.members (store_id, lower(full_name));
create index members_store_phone_idx
  on public.members (store_id, phone_normalized)
  where phone_normalized is not null;
create index members_created_by_idx on public.members (created_by);
create index qr_credentials_member_idx on public.qr_credentials (store_id, member_id);
create index qr_credentials_issued_by_idx on public.qr_credentials (issued_by);
create index qr_credentials_revoked_by_idx
  on public.qr_credentials (revoked_by)
  where revoked_by is not null;
create index rewards_created_by_idx on public.rewards (created_by);
create index rewards_updated_by_idx on public.rewards (updated_by);
create index scan_attempts_store_staff_created_idx
  on public.scan_attempts (store_id, staff_user_id, attempted_at desc);
create index scan_attempts_awarded_member_idx
  on public.scan_attempts (store_id, member_id, attempted_at desc)
  where outcome = 'awarded';
create index scan_attempts_credential_idx
  on public.scan_attempts (store_id, credential_id)
  where credential_id is not null;
create index point_transactions_member_created_idx
  on public.point_transactions (store_id, member_id, created_at desc);
create index point_transactions_staff_created_idx
  on public.point_transactions (store_id, staff_user_id, created_at desc);
create index point_transactions_reward_idx
  on public.point_transactions (store_id, reward_id)
  where reward_id is not null;
create index audit_events_store_created_idx
  on public.audit_events (store_id, created_at desc);
create index audit_events_actor_created_idx
  on public.audit_events (store_id, actor_user_id, created_at desc);

create or replace function loyalty_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

create or replace function loyalty_private.set_staff_membership_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  if new.is_active then
    new.deactivated_at := null;
  elsif new.deactivated_at is null then
    new.deactivated_at := pg_catalog.clock_timestamp();
  end if;
  return new;
end;
$$;

create or replace function loyalty_private.prevent_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'point_transactions is append-only; create a reversal instead';
end;
$$;

create or replace function loyalty_private.has_store_role(
  p_store_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.staff_memberships as sm
      where sm.store_id = p_store_id
        and sm.user_id = (select auth.uid())
        and sm.is_active
        and sm.role = any (p_roles)
    );
$$;

create or replace function loyalty_private.mask_phone(p_phone text)
returns text
language sql
immutable
returns null on null input
set search_path = ''
as $$
  select case
    when char_length(p_phone) <= 4 then repeat('*', char_length(p_phone))
    else repeat('*', greatest(char_length(p_phone) - 4, 3)) || right(p_phone, 4)
  end;
$$;

create or replace function loyalty_private.new_loyalty_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'ls1_' || translate(
    rtrim(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );
$$;

create or replace function loyalty_private.is_valid_loyalty_id(p_loyalty_id text)
returns boolean
language sql
immutable
returns null on null input
set search_path = ''
as $$
  select p_loyalty_id ~ '^ls1_[A-Za-z0-9_-]{43}$';
$$;

create or replace function loyalty_private.hash_loyalty_id(p_loyalty_id text)
returns text
language sql
immutable
returns null on null input
set search_path = ''
as $$
  select pg_catalog.encode(extensions.digest(p_loyalty_id, 'sha256'), 'hex');
$$;

create trigger stores_set_updated_at
before update on public.stores
for each row execute function loyalty_private.set_updated_at();

create trigger program_settings_set_updated_at
before update on public.program_settings
for each row execute function loyalty_private.set_updated_at();

create trigger staff_memberships_set_state
before insert or update on public.staff_memberships
for each row execute function loyalty_private.set_staff_membership_state();

create trigger members_set_updated_at
before update on public.members
for each row execute function loyalty_private.set_updated_at();

create trigger rewards_set_updated_at
before update on public.rewards
for each row execute function loyalty_private.set_updated_at();

create trigger point_transactions_append_only
before update or delete on public.point_transactions
for each row execute function loyalty_private.prevent_ledger_mutation();

alter table public.stores enable row level security;
alter table public.program_settings enable row level security;
alter table public.staff_memberships enable row level security;
alter table public.members enable row level security;
alter table public.qr_credentials enable row level security;
alter table public.rewards enable row level security;
alter table public.scan_attempts enable row level security;
alter table public.point_transactions enable row level security;
alter table public.audit_events enable row level security;

create policy stores_active_staff_select
on public.stores for select
to authenticated
using ((select loyalty_private.has_store_role(id, array['owner', 'staff'])));

create policy program_settings_active_staff_select
on public.program_settings for select
to authenticated
using ((select loyalty_private.has_store_role(store_id, array['owner', 'staff'])));

create policy staff_memberships_same_store_select
on public.staff_memberships for select
to authenticated
using ((select loyalty_private.has_store_role(store_id, array['owner', 'staff'])));

create policy members_owner_select
on public.members for select
to authenticated
using ((select loyalty_private.has_store_role(store_id, array['owner'])));

create policy rewards_active_staff_select
on public.rewards for select
to authenticated
using ((select loyalty_private.has_store_role(store_id, array['owner', 'staff'])));

create policy scan_attempts_owner_select
on public.scan_attempts for select
to authenticated
using ((select loyalty_private.has_store_role(store_id, array['owner'])));

create policy point_transactions_owner_select
on public.point_transactions for select
to authenticated
using ((select loyalty_private.has_store_role(store_id, array['owner'])));

create policy audit_events_owner_select
on public.audit_events for select
to authenticated
using ((select loyalty_private.has_store_role(store_id, array['owner'])));

create or replace function public.bootstrap_store(
  p_store_name text default 'My Loyalty Store',
  p_timezone text default 'Asia/Manila'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_reward_id uuid;
  v_store_name text := btrim(coalesce(p_store_name, ''));
  v_timezone text := btrim(coalesce(p_timezone, ''));
  v_existing_role text;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'forbidden');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('loyalty-bootstrap:' || v_user_id::text, 0)
  );

  select sm.store_id, sm.role
  into v_store_id, v_existing_role
  from public.staff_memberships as sm
  where sm.user_id = v_user_id
    and sm.is_active
  order by sm.created_at
  limit 1;

  if v_store_id is not null then
    select r.id into v_reward_id
    from public.rewards as r
    where r.store_id = v_store_id;

    return jsonb_build_object(
      'status', 'existing',
      'store_id', v_store_id,
      'role', v_existing_role,
      'reward_id', v_reward_id
    );
  end if;

  if char_length(v_store_name) not between 1 and 120 then
    return jsonb_build_object('status', 'invalid_store_name');
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_timezone
  ) then
    return jsonb_build_object('status', 'invalid_timezone');
  end if;

  insert into public.stores (name, timezone, created_by)
  values (v_store_name, v_timezone, v_user_id)
  returning id into v_store_id;

  insert into public.program_settings (
    store_id,
    points_per_visit,
    duplicate_cooldown_minutes,
    updated_by
  ) values (v_store_id, 1, 10, v_user_id);

  insert into public.staff_memberships (
    store_id,
    user_id,
    role,
    is_active,
    invited_by
  ) values (v_store_id, v_user_id, 'owner', true, null);

  insert into public.rewards (
    store_id,
    name,
    cost_points,
    is_enabled,
    created_by,
    updated_by
  ) values (v_store_id, null, null, false, v_user_id, v_user_id)
  returning id into v_reward_id;

  insert into public.audit_events (
    store_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    v_store_id,
    v_user_id,
    'store_bootstrapped',
    'store',
    v_store_id,
    jsonb_build_object('timezone', v_timezone)
  );

  return jsonb_build_object(
    'status', 'created',
    'store_id', v_store_id,
    'role', 'owner',
    'reward_id', v_reward_id
  );
end;
$$;

create or replace function public.resolve_loyalty_id(
  p_store_id uuid,
  p_loyalty_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_credential record;
  v_settings record;
  v_reward record;
  v_last_award timestamptz;
  v_next_eligible_at timestamptz;
  v_eligible boolean;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner', 'staff']) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if not coalesce(loyalty_private.is_valid_loyalty_id(p_loyalty_id), false) then
    return jsonb_build_object('status', 'invalid');
  end if;

  select
    qc.id as credential_id,
    qc.status as credential_status,
    m.id as member_id,
    m.member_code,
    m.full_name,
    m.phone_normalized,
    m.current_balance,
    m.is_active as member_is_active
  into v_credential
  from public.qr_credentials as qc
  join public.members as m
    on m.store_id = qc.store_id
   and m.id = qc.member_id
  where qc.store_id = p_store_id
    and qc.token_hash = loyalty_private.hash_loyalty_id(p_loyalty_id);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_credential.credential_status = 'revoked' then
    return jsonb_build_object('status', 'revoked');
  end if;

  if not v_credential.member_is_active then
    return jsonb_build_object('status', 'invalid');
  end if;

  select ps.points_per_visit, ps.duplicate_cooldown_minutes
  into strict v_settings
  from public.program_settings as ps
  where ps.store_id = p_store_id;

  select max(sa.attempted_at)
  into v_last_award
  from public.scan_attempts as sa
  where sa.store_id = p_store_id
    and sa.member_id = v_credential.member_id
    and sa.outcome = 'awarded';

  if v_last_award is null or v_settings.duplicate_cooldown_minutes = 0 then
    v_eligible := true;
    v_next_eligible_at := null;
  else
    v_next_eligible_at := v_last_award
      + (v_settings.duplicate_cooldown_minutes * interval '1 minute');
    v_eligible := pg_catalog.clock_timestamp() >= v_next_eligible_at;
    if v_eligible then
      v_next_eligible_at := null;
    end if;
  end if;

  select r.id, r.name, r.cost_points, r.is_enabled
  into v_reward
  from public.rewards as r
  where r.store_id = p_store_id;

  return jsonb_build_object(
    'status', 'valid',
    'eligible', v_eligible,
    'next_eligible_at', v_next_eligible_at,
    'points_per_visit', v_settings.points_per_visit,
    'member', jsonb_build_object(
      'id', v_credential.member_id,
      'member_code', v_credential.member_code,
      'full_name', v_credential.full_name,
      'masked_phone', loyalty_private.mask_phone(v_credential.phone_normalized),
      'current_balance', v_credential.current_balance
    ),
    'reward', case
      when v_reward.id is null then null
      else jsonb_build_object(
        'id', v_reward.id,
        'name', v_reward.name,
        'cost_points', v_reward.cost_points,
        'is_enabled', v_reward.is_enabled,
        'eligible', v_reward.is_enabled
          and v_credential.current_balance >= v_reward.cost_points
      )
    end
  );
end;
$$;

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
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
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

create or replace function public.create_member(
  p_store_id uuid,
  p_full_name text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_id uuid := gen_random_uuid();
  v_member_code text;
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_phone_normalized text;
  v_loyalty_id text;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner', 'staff']) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if char_length(v_full_name) not between 1 and 120 then
    return jsonb_build_object('status', 'invalid_name');
  end if;

  if v_phone is not null then
    v_phone_normalized := regexp_replace(v_phone, '[^0-9]', '', 'g');
    if char_length(v_phone) > 30
      or v_phone_normalized !~ '^[0-9]{7,15}$'
    then
      return jsonb_build_object('status', 'invalid_phone');
    end if;
  end if;

  v_member_code := 'LS-' || upper(substr(replace(v_member_id::text, '-', ''), 1, 12));
  v_loyalty_id := loyalty_private.new_loyalty_id();

  insert into public.members (
    id,
    store_id,
    member_code,
    full_name,
    phone,
    phone_normalized,
    created_by
  ) values (
    v_member_id,
    p_store_id,
    v_member_code,
    v_full_name,
    v_phone,
    v_phone_normalized,
    v_user_id
  );

  insert into public.qr_credentials (
    store_id,
    member_id,
    token_hash,
    version,
    status,
    issued_by
  ) values (
    p_store_id,
    v_member_id,
    loyalty_private.hash_loyalty_id(v_loyalty_id),
    1,
    'active',
    v_user_id
  );

  insert into public.audit_events (
    store_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    p_store_id,
    v_user_id,
    'member_created',
    'member',
    v_member_id,
    jsonb_build_object(
      'member_code', v_member_code,
      'has_phone', v_phone is not null
    )
  );

  return jsonb_build_object(
    'status', 'created',
    'loyalty_id', v_loyalty_id,
    'member', jsonb_build_object(
      'id', v_member_id,
      'member_code', v_member_code,
      'full_name', v_full_name,
      'masked_phone', loyalty_private.mask_phone(v_phone_normalized),
      'current_balance', 0
    )
  );
end;
$$;

create or replace function loyalty_private.record_visit_award(
  p_store_id uuid,
  p_member_id uuid,
  p_credential_id uuid,
  p_staff_user_id uuid,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_action text,
  p_scan_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing record;
  v_member record;
  v_settings record;
  v_credential_status text;
  v_last_award timestamptz;
  v_now timestamptz;
  v_next_eligible_at timestamptz;
  v_scan_attempt_id uuid;
  v_new_balance bigint;
  v_result jsonb;
begin
  if p_staff_user_id is null
    or p_staff_user_id <> auth.uid()
    or not loyalty_private.has_store_role(p_store_id, array['owner', 'staff'])
  then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_idempotency_key is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_action not in ('award_visit', 'award_visit_manual')
    or p_scan_method not in ('qr', 'manual')
    or (p_scan_method = 'qr' and p_credential_id is null)
    or (p_scan_method = 'manual' and p_credential_id is not null)
  then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'loyalty-idempotency:' || p_store_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select ae.action, ae.actor_user_id, ae.details
  into v_existing
  from public.audit_events as ae
  where ae.store_id = p_store_id
    and ae.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action = p_action
      and v_existing.actor_user_id = p_staff_user_id
      and v_existing.details ->> 'request_fingerprint' = p_request_fingerprint
    then
      return v_existing.details -> 'result';
    end if;
    return jsonb_build_object('status', 'idempotency_conflict');
  end if;

  select
    m.id,
    m.member_code,
    m.full_name,
    m.phone_normalized,
    m.current_balance,
    m.is_active
  into v_member
  from public.members as m
  where m.store_id = p_store_id
    and m.id = p_member_id
  for update;

  if not found then
    v_result := jsonb_build_object('status', 'invalid');
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, p_staff_user_id, p_action, 'member', p_member_id,
      p_idempotency_key,
      jsonb_build_object(
        'request_fingerprint', p_request_fingerprint,
        'scan_method', p_scan_method,
        'result', v_result
      )
    );
    return v_result;
  end if;

  v_now := pg_catalog.clock_timestamp();

  if p_credential_id is not null then
    select qc.status
    into v_credential_status
    from public.qr_credentials as qc
    where qc.store_id = p_store_id
      and qc.id = p_credential_id
      and qc.member_id = p_member_id;

    if not found or v_credential_status <> 'active' then
      v_result := jsonb_build_object(
        'status', case when v_credential_status = 'revoked' then 'revoked' else 'invalid' end
      );

      insert into public.scan_attempts (
        store_id, member_id, credential_id, staff_user_id, idempotency_key,
        request_fingerprint, scan_method, outcome, points_awarded,
        balance_after, attempted_at
      ) values (
        p_store_id, p_member_id,
        case when v_credential_status is null then null else p_credential_id end,
        p_staff_user_id, p_idempotency_key, p_request_fingerprint,
        p_scan_method,
        case when v_credential_status = 'revoked' then 'revoked' else 'invalid' end,
        0, v_member.current_balance, v_now
      );

      insert into public.audit_events (
        store_id, actor_user_id, action, entity_type, entity_id,
        idempotency_key, details
      ) values (
        p_store_id, p_staff_user_id, p_action, 'member', p_member_id,
        p_idempotency_key,
        jsonb_build_object(
          'request_fingerprint', p_request_fingerprint,
          'scan_method', p_scan_method,
          'result', v_result
        )
      );
      return v_result;
    end if;
  end if;

  if not v_member.is_active then
    v_result := jsonb_build_object('status', 'invalid');

    insert into public.scan_attempts (
      store_id, member_id, credential_id, staff_user_id, idempotency_key,
      request_fingerprint, scan_method, outcome, points_awarded,
      balance_after, attempted_at
    ) values (
      p_store_id, p_member_id, p_credential_id, p_staff_user_id,
      p_idempotency_key, p_request_fingerprint, p_scan_method,
      'invalid', 0, v_member.current_balance, v_now
    );

    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, p_staff_user_id, p_action, 'member', p_member_id,
      p_idempotency_key,
      jsonb_build_object(
        'request_fingerprint', p_request_fingerprint,
        'scan_method', p_scan_method,
        'result', v_result
      )
    );
    return v_result;
  end if;

  select ps.points_per_visit, ps.duplicate_cooldown_minutes
  into strict v_settings
  from public.program_settings as ps
  where ps.store_id = p_store_id;

  select max(sa.attempted_at)
  into v_last_award
  from public.scan_attempts as sa
  where sa.store_id = p_store_id
    and sa.member_id = p_member_id
    and sa.outcome = 'awarded';

  if v_last_award is not null and v_settings.duplicate_cooldown_minutes > 0 then
    v_next_eligible_at := v_last_award
      + (v_settings.duplicate_cooldown_minutes * interval '1 minute');
  end if;

  if v_next_eligible_at is not null and v_now < v_next_eligible_at then
    v_result := jsonb_build_object(
      'status', 'cooldown',
      'new_balance', v_member.current_balance,
      'next_eligible_at', v_next_eligible_at,
      'member', jsonb_build_object(
        'id', v_member.id,
        'member_code', v_member.member_code,
        'full_name', v_member.full_name,
        'masked_phone', loyalty_private.mask_phone(v_member.phone_normalized),
        'current_balance', v_member.current_balance
      )
    );

    insert into public.scan_attempts (
      store_id, member_id, credential_id, staff_user_id, idempotency_key,
      request_fingerprint, scan_method, outcome, points_awarded,
      balance_after, next_eligible_at, attempted_at
    ) values (
      p_store_id, p_member_id, p_credential_id, p_staff_user_id,
      p_idempotency_key, p_request_fingerprint, p_scan_method,
      'cooldown', 0, v_member.current_balance, v_next_eligible_at, v_now
    );

    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, p_staff_user_id, p_action, 'member', p_member_id,
      p_idempotency_key,
      jsonb_build_object(
        'request_fingerprint', p_request_fingerprint,
        'scan_method', p_scan_method,
        'result', v_result
      )
    );
    return v_result;
  end if;

  v_new_balance := v_member.current_balance + v_settings.points_per_visit;
  v_next_eligible_at := case
    when v_settings.duplicate_cooldown_minutes = 0 then null
    else v_now + (v_settings.duplicate_cooldown_minutes * interval '1 minute')
  end;

  update public.members
  set current_balance = v_new_balance
  where store_id = p_store_id
    and id = p_member_id;

  insert into public.scan_attempts (
    store_id, member_id, credential_id, staff_user_id, idempotency_key,
    request_fingerprint, scan_method, outcome, points_awarded,
    balance_after, next_eligible_at, attempted_at
  ) values (
    p_store_id, p_member_id, p_credential_id, p_staff_user_id,
    p_idempotency_key, p_request_fingerprint, p_scan_method,
    'awarded', v_settings.points_per_visit, v_new_balance,
    v_next_eligible_at, v_now
  ) returning id into v_scan_attempt_id;

  insert into public.point_transactions (
    store_id, member_id, transaction_type, points_delta, balance_after,
    scan_attempt_id, reason, idempotency_key, staff_user_id, created_at
  ) values (
    p_store_id, p_member_id, 'visit_award', v_settings.points_per_visit,
    v_new_balance, v_scan_attempt_id,
    case when p_scan_method = 'manual' then 'Manual visit award' else 'QR visit award' end,
    p_idempotency_key, p_staff_user_id, v_now
  );

  v_result := jsonb_build_object(
    'status', 'awarded',
    'points_added', v_settings.points_per_visit,
    'new_balance', v_new_balance,
    'next_eligible_at', v_next_eligible_at,
    'member', jsonb_build_object(
      'id', v_member.id,
      'member_code', v_member.member_code,
      'full_name', v_member.full_name,
      'masked_phone', loyalty_private.mask_phone(v_member.phone_normalized),
      'current_balance', v_new_balance
    )
  );

  insert into public.audit_events (
    store_id, actor_user_id, action, entity_type, entity_id,
    idempotency_key, details
  ) values (
    p_store_id, p_staff_user_id, p_action, 'member', p_member_id,
    p_idempotency_key,
    jsonb_build_object(
      'request_fingerprint', p_request_fingerprint,
      'scan_method', p_scan_method,
      'result', v_result
    )
  );

  return v_result;
end;
$$;

create or replace function public.award_visit(
  p_store_id uuid,
  p_loyalty_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_fingerprint text := loyalty_private.hash_loyalty_id(coalesce(p_loyalty_id, ''));
  v_existing record;
  v_credential record;
  v_now timestamptz;
  v_result jsonb;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner', 'staff']) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_idempotency_key is null then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'loyalty-idempotency:' || p_store_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select ae.action, ae.actor_user_id, ae.details
  into v_existing
  from public.audit_events as ae
  where ae.store_id = p_store_id
    and ae.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action = 'award_visit'
      and v_existing.actor_user_id = v_user_id
      and v_existing.details ->> 'request_fingerprint' = v_fingerprint
    then
      return v_existing.details -> 'result';
    end if;
    return jsonb_build_object('status', 'idempotency_conflict');
  end if;

  if not coalesce(loyalty_private.is_valid_loyalty_id(p_loyalty_id), false) then
    v_now := pg_catalog.clock_timestamp();
    v_result := jsonb_build_object('status', 'invalid');

    insert into public.scan_attempts (
      store_id, member_id, credential_id, staff_user_id, idempotency_key,
      request_fingerprint, scan_method, outcome, points_awarded,
      balance_after, attempted_at
    ) values (
      p_store_id, null, null, v_user_id, p_idempotency_key,
      v_fingerprint, 'qr', 'invalid', 0, null, v_now
    );

    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'award_visit', 'loyalty_id',
      p_idempotency_key,
      jsonb_build_object(
        'request_fingerprint', v_fingerprint,
        'scan_method', 'qr',
        'result', v_result
      )
    );
    return v_result;
  end if;

  select qc.id, qc.member_id
  into v_credential
  from public.qr_credentials as qc
  where qc.store_id = p_store_id
    and qc.token_hash = v_fingerprint;

  if not found then
    v_now := pg_catalog.clock_timestamp();
    v_result := jsonb_build_object('status', 'invalid');

    insert into public.scan_attempts (
      store_id, member_id, credential_id, staff_user_id, idempotency_key,
      request_fingerprint, scan_method, outcome, points_awarded,
      balance_after, attempted_at
    ) values (
      p_store_id, null, null, v_user_id, p_idempotency_key,
      v_fingerprint, 'qr', 'invalid', 0, null, v_now
    );

    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'award_visit', 'loyalty_id',
      p_idempotency_key,
      jsonb_build_object(
        'request_fingerprint', v_fingerprint,
        'scan_method', 'qr',
        'result', v_result
      )
    );
    return v_result;
  end if;

  return loyalty_private.record_visit_award(
    p_store_id,
    v_credential.member_id,
    v_credential.id,
    v_user_id,
    p_idempotency_key,
    v_fingerprint,
    'award_visit',
    'qr'
  );
end;
$$;

create or replace function public.award_visit_manual(
  p_store_id uuid,
  p_member_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_fingerprint text;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner', 'staff']) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_member_id is null or p_idempotency_key is null then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  v_fingerprint := loyalty_private.hash_loyalty_id('manual:' || p_member_id::text);

  return loyalty_private.record_visit_award(
    p_store_id,
    p_member_id,
    null,
    v_user_id,
    p_idempotency_key,
    v_fingerprint,
    'award_visit_manual',
    'manual'
  );
end;
$$;

create or replace function public.redeem_reward(
  p_store_id uuid,
  p_member_id uuid,
  p_reward_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_fingerprint text;
  v_existing record;
  v_member record;
  v_reward record;
  v_new_balance bigint;
  v_now timestamptz;
  v_result jsonb;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner', 'staff']) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_member_id is null or p_reward_id is null or p_idempotency_key is null then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  v_fingerprint := loyalty_private.hash_loyalty_id(
    'redeem:' || p_member_id::text || ':' || p_reward_id::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'loyalty-idempotency:' || p_store_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select ae.action, ae.actor_user_id, ae.details
  into v_existing
  from public.audit_events as ae
  where ae.store_id = p_store_id
    and ae.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action = 'redeem_reward'
      and v_existing.actor_user_id = v_user_id
      and v_existing.details ->> 'request_fingerprint' = v_fingerprint
    then
      return v_existing.details -> 'result';
    end if;
    return jsonb_build_object('status', 'idempotency_conflict');
  end if;

  select
    m.id,
    m.member_code,
    m.full_name,
    m.phone_normalized,
    m.current_balance,
    m.is_active
  into v_member
  from public.members as m
  where m.store_id = p_store_id
    and m.id = p_member_id
  for update;

  if not found or not v_member.is_active then
    v_result := jsonb_build_object('status', 'invalid');
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'redeem_reward', 'member', p_member_id,
      p_idempotency_key,
      jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
    );
    return v_result;
  end if;

  select r.id, r.name, r.cost_points, r.is_enabled
  into v_reward
  from public.rewards as r
  where r.store_id = p_store_id
    and r.id = p_reward_id;

  if not found or not v_reward.is_enabled then
    v_result := jsonb_build_object('status', 'reward_unavailable');
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'redeem_reward', 'member', p_member_id,
      p_idempotency_key,
      jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
    );
    return v_result;
  end if;

  if v_member.current_balance < v_reward.cost_points then
    v_result := jsonb_build_object(
      'status', 'insufficient_points',
      'current_balance', v_member.current_balance,
      'required_points', v_reward.cost_points
    );
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'redeem_reward', 'member', p_member_id,
      p_idempotency_key,
      jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
    );
    return v_result;
  end if;

  v_now := pg_catalog.clock_timestamp();
  v_new_balance := v_member.current_balance - v_reward.cost_points;

  update public.members
  set current_balance = v_new_balance
  where store_id = p_store_id
    and id = p_member_id;

  insert into public.point_transactions (
    store_id, member_id, transaction_type, points_delta, balance_after,
    reward_id, reason, idempotency_key, staff_user_id, created_at
  ) values (
    p_store_id, p_member_id, 'reward_redemption', -v_reward.cost_points,
    v_new_balance, p_reward_id, 'Reward redeemed: ' || v_reward.name,
    p_idempotency_key, v_user_id, v_now
  );

  v_result := jsonb_build_object(
    'status', 'redeemed',
    'points_spent', v_reward.cost_points,
    'new_balance', v_new_balance,
    'reward', jsonb_build_object(
      'id', v_reward.id,
      'name', v_reward.name,
      'cost_points', v_reward.cost_points
    ),
    'member', jsonb_build_object(
      'id', v_member.id,
      'member_code', v_member.member_code,
      'full_name', v_member.full_name,
      'masked_phone', loyalty_private.mask_phone(v_member.phone_normalized),
      'current_balance', v_new_balance
    )
  );

  insert into public.audit_events (
    store_id, actor_user_id, action, entity_type, entity_id,
    idempotency_key, details
  ) values (
    p_store_id, v_user_id, 'redeem_reward', 'member', p_member_id,
    p_idempotency_key,
    jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
  );

  return v_result;
end;
$$;

create or replace function public.reissue_loyalty_id(
  p_store_id uuid,
  p_member_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_member record;
  v_loyalty_id text;
  v_credential_id uuid;
  v_revoked_count integer;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner', 'staff']) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_member_id is null or char_length(v_reason) not between 1 and 500 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select
    m.id,
    m.member_code,
    m.full_name,
    m.phone_normalized,
    m.current_balance,
    m.is_active
  into v_member
  from public.members as m
  where m.store_id = p_store_id
    and m.id = p_member_id
  for update;

  if not found or not v_member.is_active then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.qr_credentials
  set
    status = 'revoked',
    revoked_by = v_user_id,
    revoked_at = pg_catalog.clock_timestamp(),
    revocation_reason = v_reason
  where store_id = p_store_id
    and member_id = p_member_id
    and status = 'active';

  get diagnostics v_revoked_count = row_count;
  v_loyalty_id := loyalty_private.new_loyalty_id();

  insert into public.qr_credentials (
    store_id, member_id, token_hash, version, status, issued_by
  ) values (
    p_store_id, p_member_id,
    loyalty_private.hash_loyalty_id(v_loyalty_id),
    1, 'active', v_user_id
  ) returning id into v_credential_id;

  insert into public.audit_events (
    store_id, actor_user_id, action, entity_type, entity_id, details
  ) values (
    p_store_id, v_user_id, 'loyalty_id_reissued', 'member', p_member_id,
    jsonb_build_object(
      'reason', v_reason,
      'revoked_credentials', v_revoked_count,
      'new_credential_id', v_credential_id
    )
  );

  return jsonb_build_object(
    'status', 'reissued',
    'loyalty_id', v_loyalty_id,
    'member', jsonb_build_object(
      'id', v_member.id,
      'member_code', v_member.member_code,
      'full_name', v_member.full_name,
      'masked_phone', loyalty_private.mask_phone(v_member.phone_normalized),
      'current_balance', v_member.current_balance
    )
  );
end;
$$;

create or replace function public.adjust_points(
  p_store_id uuid,
  p_member_id uuid,
  p_points_delta bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_fingerprint text;
  v_existing record;
  v_member record;
  v_new_balance bigint;
  v_result jsonb;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner']) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_member_id is null
    or p_idempotency_key is null
    or p_points_delta is null
    or p_points_delta = 0
    or p_points_delta not between -1000000000 and 1000000000
    or char_length(v_reason) not between 1 and 500
  then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  v_fingerprint := loyalty_private.hash_loyalty_id(
    'adjust:' || p_member_id::text || ':' || p_points_delta::text || ':' || v_reason
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'loyalty-idempotency:' || p_store_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select ae.action, ae.actor_user_id, ae.details
  into v_existing
  from public.audit_events as ae
  where ae.store_id = p_store_id
    and ae.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action = 'adjust_points'
      and v_existing.actor_user_id = v_user_id
      and v_existing.details ->> 'request_fingerprint' = v_fingerprint
    then
      return v_existing.details -> 'result';
    end if;
    return jsonb_build_object('status', 'idempotency_conflict');
  end if;

  select m.id, m.current_balance, m.is_active
  into v_member
  from public.members as m
  where m.store_id = p_store_id
    and m.id = p_member_id
  for update;

  if not found or not v_member.is_active then
    v_result := jsonb_build_object('status', 'invalid');
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'adjust_points', 'member', p_member_id,
      p_idempotency_key,
      jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
    );
    return v_result;
  end if;

  v_new_balance := v_member.current_balance + p_points_delta;
  if v_new_balance < 0 then
    v_result := jsonb_build_object(
      'status', 'would_go_negative',
      'current_balance', v_member.current_balance
    );
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'adjust_points', 'member', p_member_id,
      p_idempotency_key,
      jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
    );
    return v_result;
  end if;

  update public.members
  set current_balance = v_new_balance
  where store_id = p_store_id and id = p_member_id;

  insert into public.point_transactions (
    store_id, member_id, transaction_type, points_delta, balance_after,
    reason, idempotency_key, staff_user_id
  ) values (
    p_store_id, p_member_id, 'manual_adjustment', p_points_delta,
    v_new_balance, v_reason, p_idempotency_key, v_user_id
  );

  v_result := jsonb_build_object(
    'status', 'adjusted',
    'points_delta', p_points_delta,
    'new_balance', v_new_balance
  );

  insert into public.audit_events (
    store_id, actor_user_id, action, entity_type, entity_id,
    idempotency_key, details
  ) values (
    p_store_id, v_user_id, 'adjust_points', 'member', p_member_id,
    p_idempotency_key,
    jsonb_build_object(
      'request_fingerprint', v_fingerprint,
      'reason', v_reason,
      'result', v_result
    )
  );

  return v_result;
end;
$$;

create or replace function public.reverse_transaction(
  p_store_id uuid,
  p_transaction_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_fingerprint text;
  v_existing record;
  v_original record;
  v_member record;
  v_existing_reversal_id uuid;
  v_reversal_id uuid;
  v_reversal_delta bigint;
  v_new_balance bigint;
  v_result jsonb;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner']) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_transaction_id is null
    or p_idempotency_key is null
    or char_length(v_reason) not between 1 and 500
  then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  v_fingerprint := loyalty_private.hash_loyalty_id(
    'reverse:' || p_transaction_id::text || ':' || v_reason
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'loyalty-idempotency:' || p_store_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select ae.action, ae.actor_user_id, ae.details
  into v_existing
  from public.audit_events as ae
  where ae.store_id = p_store_id
    and ae.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action = 'reverse_transaction'
      and v_existing.actor_user_id = v_user_id
      and v_existing.details ->> 'request_fingerprint' = v_fingerprint
    then
      return v_existing.details -> 'result';
    end if;
    return jsonb_build_object('status', 'idempotency_conflict');
  end if;

  select pt.member_id
  into v_original
  from public.point_transactions as pt
  where pt.store_id = p_store_id
    and pt.id = p_transaction_id;

  if not found then
    v_result := jsonb_build_object('status', 'invalid_transaction');
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'reverse_transaction', 'point_transaction',
      p_transaction_id, p_idempotency_key,
      jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
    );
    return v_result;
  end if;

  select m.id, m.current_balance
  into strict v_member
  from public.members as m
  where m.store_id = p_store_id
    and m.id = v_original.member_id
  for update;

  select
    pt.id,
    pt.member_id,
    pt.transaction_type,
    pt.points_delta,
    pt.balance_after
  into strict v_original
  from public.point_transactions as pt
  where pt.store_id = p_store_id
    and pt.id = p_transaction_id
  for update;

  if v_original.transaction_type = 'reversal' then
    v_result := jsonb_build_object('status', 'not_reversible');
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'reverse_transaction', 'point_transaction',
      p_transaction_id, p_idempotency_key,
      jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
    );
    return v_result;
  end if;

  select pt.id
  into v_existing_reversal_id
  from public.point_transactions as pt
  where pt.store_id = p_store_id
    and pt.source_transaction_id = p_transaction_id
    and pt.transaction_type = 'reversal';

  if found then
    v_result := jsonb_build_object(
      'status', 'already_reversed',
      'reversal_transaction_id', v_existing_reversal_id,
      'current_balance', v_member.current_balance
    );
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'reverse_transaction', 'point_transaction',
      p_transaction_id, p_idempotency_key,
      jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
    );
    return v_result;
  end if;

  v_reversal_delta := -v_original.points_delta;
  v_new_balance := v_member.current_balance + v_reversal_delta;

  if v_new_balance < 0 then
    v_result := jsonb_build_object(
      'status', 'would_go_negative',
      'current_balance', v_member.current_balance,
      'required_balance', v_original.points_delta
    );
    insert into public.audit_events (
      store_id, actor_user_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_store_id, v_user_id, 'reverse_transaction', 'point_transaction',
      p_transaction_id, p_idempotency_key,
      jsonb_build_object('request_fingerprint', v_fingerprint, 'result', v_result)
    );
    return v_result;
  end if;

  update public.members
  set current_balance = v_new_balance
  where store_id = p_store_id
    and id = v_original.member_id;

  insert into public.point_transactions (
    store_id, member_id, transaction_type, points_delta, balance_after,
    source_transaction_id, reason, idempotency_key, staff_user_id
  ) values (
    p_store_id, v_original.member_id, 'reversal', v_reversal_delta,
    v_new_balance, p_transaction_id, v_reason, p_idempotency_key, v_user_id
  ) returning id into v_reversal_id;

  v_result := jsonb_build_object(
    'status', 'reversed',
    'reversal_transaction_id', v_reversal_id,
    'points_delta', v_reversal_delta,
    'new_balance', v_new_balance
  );

  insert into public.audit_events (
    store_id, actor_user_id, action, entity_type, entity_id,
    idempotency_key, details
  ) values (
    p_store_id, v_user_id, 'reverse_transaction', 'point_transaction',
    p_transaction_id, p_idempotency_key,
    jsonb_build_object(
      'request_fingerprint', v_fingerprint,
      'reason', v_reason,
      'result', v_result
    )
  );

  return v_result;
end;
$$;

create or replace function public.update_program_settings(
  p_store_id uuid,
  p_store_name text default null,
  p_timezone text default null,
  p_points_per_visit integer default null,
  p_duplicate_cooldown_minutes integer default null,
  p_reward_name text default null,
  p_reward_cost bigint default null,
  p_reward_enabled boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_store record;
  v_settings record;
  v_reward record;
  v_store_name text;
  v_timezone text;
  v_points_per_visit integer;
  v_cooldown integer;
  v_reward_name text;
  v_reward_cost bigint;
  v_reward_enabled boolean;
begin
  if not loyalty_private.has_store_role(p_store_id, array['owner']) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select s.id, s.name, s.timezone
  into strict v_store
  from public.stores as s
  where s.id = p_store_id
  for update;

  select ps.points_per_visit, ps.duplicate_cooldown_minutes
  into strict v_settings
  from public.program_settings as ps
  where ps.store_id = p_store_id
  for update;

  select r.id, r.name, r.cost_points, r.is_enabled
  into strict v_reward
  from public.rewards as r
  where r.store_id = p_store_id
  for update;

  v_store_name := case
    when p_store_name is null then v_store.name
    else btrim(p_store_name)
  end;
  v_timezone := case
    when p_timezone is null then v_store.timezone
    else btrim(p_timezone)
  end;
  v_points_per_visit := coalesce(p_points_per_visit, v_settings.points_per_visit);
  v_cooldown := coalesce(
    p_duplicate_cooldown_minutes,
    v_settings.duplicate_cooldown_minutes
  );
  v_reward_name := case
    when p_reward_name is null then v_reward.name
    else btrim(p_reward_name)
  end;
  v_reward_cost := coalesce(p_reward_cost, v_reward.cost_points);
  v_reward_enabled := coalesce(p_reward_enabled, v_reward.is_enabled);

  if char_length(v_store_name) not between 1 and 120 then
    return jsonb_build_object('status', 'invalid_store_name');
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_timezone
  ) then
    return jsonb_build_object('status', 'invalid_timezone');
  end if;

  if v_points_per_visit not between 1 and 10000 then
    return jsonb_build_object('status', 'invalid_points_per_visit');
  end if;

  if v_cooldown not between 0 and 10080 then
    return jsonb_build_object('status', 'invalid_cooldown');
  end if;

  if v_reward_name is not null
    and char_length(v_reward_name) not between 1 and 120
  then
    return jsonb_build_object('status', 'invalid_reward_name');
  end if;

  if v_reward_cost is not null
    and v_reward_cost not between 1 and 1000000000
  then
    return jsonb_build_object('status', 'invalid_reward_cost');
  end if;

  if v_reward_enabled and (v_reward_name is null or v_reward_cost is null) then
    return jsonb_build_object('status', 'invalid_reward_configuration');
  end if;

  update public.stores
  set name = v_store_name,
      timezone = v_timezone
  where id = p_store_id;

  update public.program_settings
  set points_per_visit = v_points_per_visit,
      duplicate_cooldown_minutes = v_cooldown,
      updated_by = v_user_id
  where store_id = p_store_id;

  update public.rewards
  set name = v_reward_name,
      cost_points = v_reward_cost,
      is_enabled = v_reward_enabled,
      updated_by = v_user_id
  where store_id = p_store_id;

  insert into public.audit_events (
    store_id, actor_user_id, action, entity_type, entity_id, details
  ) values (
    p_store_id, v_user_id, 'program_settings_updated', 'store', p_store_id,
    jsonb_build_object(
      'store_name', v_store_name,
      'timezone', v_timezone,
      'points_per_visit', v_points_per_visit,
      'duplicate_cooldown_minutes', v_cooldown,
      'reward_id', v_reward.id,
      'reward_name', v_reward_name,
      'reward_cost', v_reward_cost,
      'reward_enabled', v_reward_enabled
    )
  );

  return jsonb_build_object(
    'status', 'updated',
    'store', jsonb_build_object(
      'id', p_store_id,
      'name', v_store_name,
      'timezone', v_timezone
    ),
    'settings', jsonb_build_object(
      'points_per_visit', v_points_per_visit,
      'duplicate_cooldown_minutes', v_cooldown
    ),
    'reward', jsonb_build_object(
      'id', v_reward.id,
      'name', v_reward_name,
      'cost_points', v_reward_cost,
      'is_enabled', v_reward_enabled
    )
  );
end;
$$;

create view public.member_balance_reconciliation
with (security_invoker = true)
as
select
  m.store_id,
  m.id as member_id,
  m.member_code,
  m.current_balance as cached_balance,
  coalesce(sum(pt.points_delta), 0::numeric)::bigint as ledger_balance,
  m.current_balance = coalesce(sum(pt.points_delta), 0::numeric)::bigint as is_reconciled
from public.members as m
left join public.point_transactions as pt
  on pt.store_id = m.store_id
 and pt.member_id = m.id
group by m.store_id, m.id, m.member_code, m.current_balance;

revoke all on table public.stores from public, anon, authenticated;
revoke all on table public.program_settings from public, anon, authenticated;
revoke all on table public.staff_memberships from public, anon, authenticated;
revoke all on table public.members from public, anon, authenticated;
revoke all on table public.qr_credentials from public, anon, authenticated;
revoke all on table public.rewards from public, anon, authenticated;
revoke all on table public.scan_attempts from public, anon, authenticated;
revoke all on table public.point_transactions from public, anon, authenticated;
revoke all on table public.audit_events from public, anon, authenticated;
revoke all on table public.member_balance_reconciliation from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant usage on schema loyalty_private to authenticated;

grant select on table
  public.stores,
  public.program_settings,
  public.staff_memberships,
  public.members,
  public.rewards,
  public.scan_attempts,
  public.point_transactions,
  public.audit_events,
  public.member_balance_reconciliation
to authenticated;

grant select, insert, update, delete on table
  public.stores,
  public.program_settings,
  public.staff_memberships,
  public.members,
  public.qr_credentials,
  public.rewards,
  public.scan_attempts,
  public.point_transactions,
  public.audit_events
to service_role;

revoke all on function loyalty_private.set_updated_at() from public, anon, authenticated;
revoke all on function loyalty_private.set_staff_membership_state() from public, anon, authenticated;
revoke all on function loyalty_private.prevent_ledger_mutation() from public, anon, authenticated;
revoke all on function loyalty_private.mask_phone(text) from public, anon, authenticated;
revoke all on function loyalty_private.new_loyalty_id() from public, anon, authenticated;
revoke all on function loyalty_private.is_valid_loyalty_id(text) from public, anon, authenticated;
revoke all on function loyalty_private.hash_loyalty_id(text) from public, anon, authenticated;
revoke all on function loyalty_private.record_visit_award(uuid, uuid, uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function loyalty_private.has_store_role(uuid, text[])
  from public, anon, authenticated;
grant execute on function loyalty_private.has_store_role(uuid, text[]) to authenticated;

revoke all on function public.bootstrap_store(text, text) from public, anon, authenticated;
revoke all on function public.resolve_loyalty_id(uuid, text) from public, anon, authenticated;
revoke all on function public.search_members(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.create_member(uuid, text, text) from public, anon, authenticated;
revoke all on function public.award_visit(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.award_visit_manual(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.redeem_reward(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.reissue_loyalty_id(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.adjust_points(uuid, uuid, bigint, text, uuid) from public, anon, authenticated;
revoke all on function public.reverse_transaction(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.update_program_settings(
  uuid, text, text, integer, integer, text, bigint, boolean
) from public, anon, authenticated;

grant execute on function public.bootstrap_store(text, text) to authenticated;
grant execute on function public.resolve_loyalty_id(uuid, text) to authenticated;
grant execute on function public.search_members(uuid, text, integer) to authenticated;
grant execute on function public.create_member(uuid, text, text) to authenticated;
grant execute on function public.award_visit(uuid, text, uuid) to authenticated;
grant execute on function public.award_visit_manual(uuid, uuid, uuid) to authenticated;
grant execute on function public.redeem_reward(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.reissue_loyalty_id(uuid, uuid, text) to authenticated;
grant execute on function public.adjust_points(uuid, uuid, bigint, text, uuid) to authenticated;
grant execute on function public.reverse_transaction(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.update_program_settings(
  uuid, text, text, integer, integer, text, bigint, boolean
) to authenticated;

commit;
