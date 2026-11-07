import 'server-only';
import type { ServiceStatus } from '@mrd/domain';
import { cache } from 'react';
import { createSupabaseAnonClient } from './supabase/server';

const CLOSED: ServiceStatus = {
  environment: 'production',
  intake_open: false,
  payments_open: false,
  live_service_enabled: false,
  active_ruleset_version: null,
  active_ruleset_status: null,
  outstanding_gate_count: -1,
};

/** Live-service status from the database. Fails closed if it cannot be read. */
export const getServiceStatus = cache(async (): Promise<ServiceStatus> => {
  try {
    const { data, error } = await createSupabaseAnonClient().rpc('service_status');
    if (error || !data) return CLOSED;
    return data as unknown as ServiceStatus;
  } catch {
    return CLOSED;
  }
});
