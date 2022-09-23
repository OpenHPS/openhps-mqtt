import { RemoteNodeOptions, RemoteService } from '@openhps/core';

export interface MQTTNodeOptions<S extends RemoteService> extends RemoteNodeOptions<S> {
    push?: { topic: string; response?: boolean };
    pull?: { topic: string; response?: boolean };
    event?: { topic: string; response?: boolean };
}
