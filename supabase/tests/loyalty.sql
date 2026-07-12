begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_table('public', 'stores', 'stores table exists');
select has_table('public', 'program_settings', 'program_settings table exists');
select has_table('public', 'staff_memberships', 'staff_memberships table exists');
select has_table('public', 'members', 'members table exists');
select has_table('public', 'qr_credentials', 'qr_credentials table exists');
select has_table('public', 'rewards', 'rewards table exists');
select has_table('public', 'scan_attempts', 'scan_attempts table exists');
select has_table('public', 'point_transactions', 'point_transactions table exists');
select has_table('public', 'audit_events', 'audit_events table exists');
select has_view('public', 'member_balance_reconciliation', 'reconciliation view exists');

select has_function('public', 'bootstrap_store', array['text', 'text']);
select has_function('public', 'resolve_loyalty_id', array['uuid', 'text']);
select has_function('public', 'search_members', array['uuid', 'text', 'integer']);
select has_function('public', 'create_member', array['uuid', 'text', 'text']);
select has_function('public', 'award_visit', array['uuid', 'text', 'uuid']);
select has_function('public', 'award_visit_manual', array['uuid', 'uuid', 'uuid']);
select has_function('public', 'redeem_reward', array['uuid', 'uuid', 'uuid', 'uuid']);
select has_function('public', 'reissue_loyalty_id', array['uuid', 'uuid', 'text']);
select has_function('public', 'adjust_points', array['uuid', 'uuid', 'bigint', 'text', 'uuid']);
select has_function('public', 'reverse_transaction', array['uuid', 'uuid', 'text', 'uuid']);
select has_function(
  'public',
  'update_program_settings',
  array['uuid', 'text', 'text', 'integer', 'integer', 'text', 'bigint', 'boolean']
);

select ok(
  not has_table_privilege('anon', 'public.members', 'SELECT'),
  'anon cannot read members'
);
select ok(
  not has_table_privilege('authenticated', 'public.members', 'INSERT'),
  'authenticated clients cannot insert members directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.point_transactions', 'UPDATE'),
  'authenticated clients cannot mutate the ledger directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.qr_credentials', 'SELECT'),
  'credential hashes are not exposed to authenticated clients'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.award_visit(uuid,text,uuid)',
    'EXECUTE'
  ),
  'authenticated clients can call award_visit'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.award_visit(uuid,text,uuid)',
    'EXECUTE'
  ),
  'anon cannot call award_visit'
);

select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (array[
        'stores', 'program_settings', 'staff_memberships', 'members',
        'qr_credentials', 'rewards', 'scan_attempts',
        'point_transactions', 'audit_events'
      ])
  ),
  'RLS is enabled on every public business table'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'owner-one@example.test', 'test',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'staff-one@example.test', 'test',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'owner-two@example.test', 'test',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config(
  'test.bootstrap',
  public.bootstrap_store('Test Loyalty', 'Asia/Manila')::text,
  true
);
select is(
  current_setting('test.bootstrap')::jsonb ->> 'status',
  'created',
  'first authenticated user bootstraps a store'
);
select set_config(
  'test.store_id',
  current_setting('test.bootstrap')::jsonb ->> 'store_id',
  true
);
select is(
  public.bootstrap_store('Ignored', 'UTC') ->> 'status',
  'existing',
  'bootstrap is safely retryable for an existing membership'
);

select set_config(
  'test.created_member',
  public.create_member(
    current_setting('test.store_id')::uuid,
    'Ada Customer',
    '+63 917 555 1212'
  )::text,
  true
);
select is(
  current_setting('test.created_member')::jsonb ->> 'status',
  'created',
  'staff creates a member'
);
select set_config(
  'test.member_id',
  current_setting('test.created_member')::jsonb #>> '{member,id}',
  true
);
select set_config(
  'test.loyalty_id',
  current_setting('test.created_member')::jsonb ->> 'loyalty_id',
  true
);
select matches(
  current_setting('test.loyalty_id'),
  '^ls1_[A-Za-z0-9_-]{43}$',
  'issued IDs use the exact versioned 256-bit base64url format'
);
select is(
  public.resolve_loyalty_id(
    current_setting('test.store_id')::uuid,
    current_setting('test.loyalty_id')
  ) ->> 'status',
  'valid',
  'issued ID resolves for active staff'
);
select is(
  public.search_members(
    current_setting('test.store_id')::uuid,
    '9175551212',
    20
  ) #>> '{members,0,full_name}',
  'Ada Customer',
  'manual lookup finds a member by normalized phone'
);
select isnt(
  public.search_members(
    current_setting('test.store_id')::uuid,
    '9175551212',
    20
  ) #>> '{members,0,masked_phone}',
  '+63 917 555 1212',
  'manual lookup returns a masked phone'
);

select set_config(
  'test.award_one',
  public.award_visit(
    current_setting('test.store_id')::uuid,
    current_setting('test.loyalty_id'),
    '20000000-0000-0000-0000-000000000001'
  )::text,
  true
);
select is(
  current_setting('test.award_one')::jsonb ->> 'status',
  'awarded',
  'first QR scan awards server-configured points'
);
select is(
  public.award_visit(
    current_setting('test.store_id')::uuid,
    current_setting('test.loyalty_id'),
    '20000000-0000-0000-0000-000000000001'
  ),
  current_setting('test.award_one')::jsonb,
  'an identical award retry returns the original result'
);
select is(
  public.award_visit(
    current_setting('test.store_id')::uuid,
    current_setting('test.loyalty_id'),
    '20000000-0000-0000-0000-000000000002'
  ) ->> 'status',
  'cooldown',
  'a distinct scan during cooldown is explicitly blocked'
);
select is(
  (
    select current_balance
    from public.members
    where id = current_setting('test.member_id')::uuid
  ),
  1::bigint,
  'cooldown and retries do not double-credit the balance'
);

select is(
  public.update_program_settings(
    current_setting('test.store_id')::uuid,
    null, null, null, 0, 'Free drink', 1, true
  ) ->> 'status',
  'updated',
  'owner configures the reward and disables cooldown for the next checks'
);
select set_config(
  'test.reward_id',
  (
    select id::text from public.rewards
    where store_id = current_setting('test.store_id')::uuid
  ),
  true
);

select set_config(
  'test.redeem_one',
  public.redeem_reward(
    current_setting('test.store_id')::uuid,
    current_setting('test.member_id')::uuid,
    current_setting('test.reward_id')::uuid,
    '20000000-0000-0000-0000-000000000003'
  )::text,
  true
);
select is(
  current_setting('test.redeem_one')::jsonb ->> 'status',
  'redeemed',
  'eligible reward redemption succeeds'
);
select is(
  public.redeem_reward(
    current_setting('test.store_id')::uuid,
    current_setting('test.member_id')::uuid,
    current_setting('test.reward_id')::uuid,
    '20000000-0000-0000-0000-000000000003'
  ),
  current_setting('test.redeem_one')::jsonb,
  'reward retry is idempotent'
);

reset role;
select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'qr_credentials'
      and column_name in ('token', 'loyalty_id', 'qr_value')
  ),
  0::bigint,
  'no plaintext loyalty ID column exists'
);
select ok(
  exists (
    select 1
    from public.qr_credentials
    where member_id = current_setting('test.member_id')::uuid
      and token_hash = encode(
        extensions.digest(current_setting('test.loyalty_id'), 'sha256'),
        'hex'
      )
  ),
  'only the SHA-256 credential hash is persisted'
);

insert into public.staff_memberships (
  store_id, user_id, role, is_active, invited_by
) values (
  current_setting('test.store_id')::uuid,
  '10000000-0000-0000-0000-000000000002',
  'staff', true,
  '10000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);
select is(
  public.award_visit_manual(
    current_setting('test.store_id')::uuid,
    current_setting('test.member_id')::uuid,
    '20000000-0000-0000-0000-000000000004'
  ) ->> 'status',
  'awarded',
  'manual lookup can award through the same secured visit path'
);
select is(
  public.adjust_points(
    current_setting('test.store_id')::uuid,
    current_setting('test.member_id')::uuid,
    5,
    'Staff must not adjust',
    '20000000-0000-0000-0000-000000000005'
  ) ->> 'status',
  'forbidden',
  'staff cannot make owner-only adjustments'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select is(
  public.adjust_points(
    current_setting('test.store_id')::uuid,
    current_setting('test.member_id')::uuid,
    5,
    'Service recovery',
    '20000000-0000-0000-0000-000000000006'
  ) ->> 'status',
  'adjusted',
  'owner adjustment succeeds with a reason'
);
select set_config(
  'test.adjustment_tx',
  (
    select id::text
    from public.point_transactions
    where idempotency_key = '20000000-0000-0000-0000-000000000006'
  ),
  true
);
select is(
  public.reverse_transaction(
    current_setting('test.store_id')::uuid,
    current_setting('test.adjustment_tx')::uuid,
    'Correction of service recovery',
    '20000000-0000-0000-0000-000000000007'
  ) ->> 'status',
  'reversed',
  'owner reverses a transaction with an append-only compensating entry'
);

select set_config(
  'test.reissue',
  public.reissue_loyalty_id(
    current_setting('test.store_id')::uuid,
    current_setting('test.member_id')::uuid,
    'Lost card'
  )::text,
  true
);
select is(
  current_setting('test.reissue')::jsonb ->> 'status',
  'reissued',
  'lost card is reissued'
);
select is(
  public.resolve_loyalty_id(
    current_setting('test.store_id')::uuid,
    current_setting('test.loyalty_id')
  ) ->> 'status',
  'revoked',
  'the previous QR is permanently revoked'
);
select matches(
  current_setting('test.reissue')::jsonb ->> 'loyalty_id',
  '^ls1_[A-Za-z0-9_-]{43}$',
  'reissue returns one new valid loyalty ID'
);
select ok(
  (
    select is_reconciled
    from public.member_balance_reconciliation
    where member_id = current_setting('test.member_id')::uuid
  ),
  'cached balance reconciles with the immutable ledger'
);

reset role;
select throws_ok(
  format(
    'update public.point_transactions set reason = %L where id = %L',
    'tampered',
    current_setting('test.adjustment_tx')
  ),
  '55000',
  'point_transactions is append-only; create a reversal instead',
  'ledger rows cannot be updated even by a privileged role'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000003',
  true
);
select set_config(
  'test.other_bootstrap',
  public.bootstrap_store('Other Store', 'UTC')::text,
  true
);
select set_config(
  'test.other_store',
  current_setting('test.other_bootstrap')::jsonb ->> 'store_id',
  true
);
select set_config(
  'test.other_member',
  public.create_member(
    current_setting('test.other_store')::uuid,
    'Other Customer',
    null
  )::text,
  true
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select is(
  (
    select count(*)
    from public.members
    where store_id = current_setting('test.other_store')::uuid
  ),
  0::bigint,
  'RLS isolates customers belonging to another store'
);
select is(
  public.resolve_loyalty_id(
    current_setting('test.other_store')::uuid,
    current_setting('test.other_member')::jsonb ->> 'loyalty_id'
  ) ->> 'status',
  'forbidden',
  'RPC authorization also rejects cross-store access'
);

reset role;
select * from finish();
rollback;

