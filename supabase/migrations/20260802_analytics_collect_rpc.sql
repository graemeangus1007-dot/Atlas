-- Atlas Sprint 18.0B hotfix: atomic analytics collect RPC (anon-safe).
-- Avoids SELECT-under-RLS failures for public beacons.

create or replace function public.atlas_record_analytics_event(
  p_event text,
  p_project_id uuid,
  p_session_id text,
  p_visitor_id text,
  p_page_path text,
  p_referrer text default '',
  p_utm_source text default '',
  p_utm_medium text default '',
  p_utm_campaign text default '',
  p_device_type text default 'desktop',
  p_browser text default 'Other',
  p_operating_system text default 'Other',
  p_screen_size text default '',
  p_language text default '',
  p_duration_seconds integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_visit_id uuid;
  v_duration integer := 0;
  v_bounced boolean := true;
  v_page_count integer := 0;
  v_duration_in integer := greatest(0, least(coalesce(p_duration_seconds, 0), 86400));
begin
  if p_event is null or p_event not in ('pageview', 'heartbeat', 'unload') then
    return jsonb_build_object('ok', false, 'error', 'invalid_event');
  end if;

  v_owner := public.project_owner_id(p_project_id);
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_project');
  end if;

  select v.id, v.duration_seconds
    into v_visit_id, v_duration
  from public.site_visits v
  where v.project_id = p_project_id
    and v.session_id = p_session_id
  limit 1;

  if p_event = 'pageview' then
    if v_visit_id is null then
      v_visit_id := gen_random_uuid();
      insert into public.site_visits (
        id, project_id, owner_id, session_id, visitor_id, page_path, referrer,
        utm_source, utm_medium, utm_campaign, country, region, city,
        device_type, browser, operating_system, screen_size, language,
        duration_seconds, bounced
      ) values (
        v_visit_id, p_project_id, v_owner, p_session_id, p_visitor_id,
        coalesce(nullif(p_page_path, ''), '/'),
        coalesce(p_referrer, ''),
        coalesce(p_utm_source, ''),
        coalesce(p_utm_medium, ''),
        coalesce(p_utm_campaign, ''),
        '', '', '',
        coalesce(nullif(p_device_type, ''), 'desktop'),
        coalesce(nullif(p_browser, ''), 'Other'),
        coalesce(nullif(p_operating_system, ''), 'Other'),
        coalesce(p_screen_size, ''),
        coalesce(p_language, ''),
        0,
        true
      );

      insert into public.page_views (id, visit_id, project_id, page_path)
      values (
        gen_random_uuid(),
        v_visit_id,
        p_project_id,
        coalesce(nullif(p_page_path, ''), '/')
      );

      return jsonb_build_object(
        'ok', true,
        'visit_id', v_visit_id,
        'created_visit', true,
        'created_page_view', true
      );
    end if;

    insert into public.page_views (id, visit_id, project_id, page_path)
    values (
      gen_random_uuid(),
      v_visit_id,
      p_project_id,
      coalesce(nullif(p_page_path, ''), '/')
    );

    update public.site_visits
    set bounced = false,
        page_path = coalesce(nullif(p_page_path, ''), page_path)
    where id = v_visit_id;

    return jsonb_build_object(
      'ok', true,
      'visit_id', v_visit_id,
      'created_visit', false,
      'created_page_view', true
    );
  end if;

  -- heartbeat / unload
  if v_visit_id is null then
    if p_event <> 'unload' then
      return jsonb_build_object('ok', true, 'visit_id', null, 'skipped', true);
    end if;

    v_bounced := v_duration_in < 15;
    v_visit_id := gen_random_uuid();
    insert into public.site_visits (
      id, project_id, owner_id, session_id, visitor_id, page_path, referrer,
      utm_source, utm_medium, utm_campaign, country, region, city,
      device_type, browser, operating_system, screen_size, language,
      duration_seconds, bounced
    ) values (
      v_visit_id, p_project_id, v_owner, p_session_id, p_visitor_id,
      coalesce(nullif(p_page_path, ''), '/'),
      coalesce(p_referrer, ''),
      coalesce(p_utm_source, ''),
      coalesce(p_utm_medium, ''),
      coalesce(p_utm_campaign, ''),
      '', '', '',
      coalesce(nullif(p_device_type, ''), 'desktop'),
      coalesce(nullif(p_browser, ''), 'Other'),
      coalesce(nullif(p_operating_system, ''), 'Other'),
      coalesce(p_screen_size, ''),
      coalesce(p_language, ''),
      v_duration_in,
      v_bounced
    );

    return jsonb_build_object('ok', true, 'visit_id', v_visit_id, 'created_visit', true);
  end if;

  select count(*)::integer into v_page_count
  from public.page_views
  where visit_id = v_visit_id;

  v_duration := greatest(coalesce(v_duration, 0), v_duration_in);
  v_bounced := not (v_page_count > 1 or v_duration >= 15);

  update public.site_visits
  set duration_seconds = v_duration,
      bounced = v_bounced
  where id = v_visit_id;

  return jsonb_build_object(
    'ok', true,
    'visit_id', v_visit_id,
    'duration_seconds', v_duration,
    'bounced', v_bounced
  );
end;
$$;

revoke all on function public.atlas_record_analytics_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer
) from public;

grant execute on function public.atlas_record_analytics_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer
) to anon, authenticated, service_role;
